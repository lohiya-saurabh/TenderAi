from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from langgraph.types import Command

from tenderpulse_ai.domain.models import CandidateComplianceItem
from tenderpulse_ai.review.models import (
    CrossTenantReviewException,
    DuplicateReviewException,
    HumanReviewActionPayload,
    HumanReviewDecision,
    HumanReviewTask,
    HumanReviewTaskStatus,
    InvalidReviewActionException,
    ReviewComment,
    ReviewConcurrencyConflictException,
    ReviewerRole,
    ReviewEvidencePackage,
    ReviewTaskExpiredException,
    ReviewUrgency,
    UnauthorizedReviewerException,
)


class HumanReviewManager:
    """
    Manages the Human Review Lifecycle:
    - First-class task repository partitioned by tenant
    - Optimistic Concurrency Control (OCC) via versioning
    - Reviewer roles & RBAC validation
    - Multi-comment collaborative threading
    - Escalation, reassignment, and SLA expiry enforcement
    - Audit-grade distinguishability between AI recommendation and Human decision/override
    - Workflow continuation (LangGraph checkpoint resumption or direct callback)
    """

    def __init__(self) -> None:
        # In-memory repository partitioned by task_id: task_id -> HumanReviewTask
        self._tasks: dict[str, HumanReviewTask] = {}
        # Immutable audit log
        self.review_audit_log: list[dict[str, Any]] = []

    def create_task(
        self,
        tenant_id: str,
        workflow_run_id: str,
        thread_id: str = "",
        entity_type: str = "COMPLIANCE_ITEM",
        entity_id: str = "",
        title: str = "",
        description: str = "",
        urgency: ReviewUrgency = ReviewUrgency.MEDIUM,
        required_role: ReviewerRole = ReviewerRole.BID_MANAGER,
        assigned_user_id: str | None = None,
        expires_at: datetime | None = None,
        sla_deadline: datetime | None = None,
        ai_recommendation: dict[str, Any] | None = None,
        evidence_package: ReviewEvidencePackage | None = None,
        # Backward-compatible parameters for LangGraph compliance workflows:
        bid_id: str = "",
        document_id: str = "",
        page_number: int = 1,
        unverified_items: list[CandidateComplianceItem] | None = None,
        failure_reasons: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> HumanReviewTask:
        task_id = f"rev_task_{uuid.uuid4().hex[:12]}"
        task = HumanReviewTask(
            task_id=task_id,
            version=1,
            thread_id=thread_id,
            workflow_run_id=workflow_run_id,
            tenant_id=tenant_id,
            entity_type=entity_type,
            entity_id=entity_id or bid_id or document_id,
            title=title or f"Review for {entity_type} {entity_id or bid_id}",
            description=description or failure_reasons or "Human review required.",
            urgency=urgency,
            required_role=required_role,
            assigned_user_id=assigned_user_id,
            expires_at=expires_at,
            sla_deadline=sla_deadline or expires_at,
            ai_recommendation=ai_recommendation or {},
            evidence_package=evidence_package or ReviewEvidencePackage(),
            bid_id=bid_id,
            document_id=document_id,
            page_number=page_number,
            unverified_items=unverified_items or [],
            failure_reasons=failure_reasons,
            status=HumanReviewTaskStatus.PENDING,
            metadata=metadata or {},
        )
        self._tasks[task_id] = task

        self.review_audit_log.append(
            {
                "timestamp": datetime.now(UTC).isoformat(),
                "action": "HUMAN_REVIEW_TASK_CREATED",
                "task_id": task_id,
                "version": 1,
                "tenant_id": tenant_id,
                "entity_type": entity_type,
                "entity_id": task.entity_id,
                "required_role": required_role.value,
                "urgency": urgency.value,
                "assigned_user_id": assigned_user_id,
            }
        )

        return task

    def get_task(self, task_id: str, requesting_tenant_id: str) -> HumanReviewTask | None:
        """Retrieves a review task with strict tenant-scoping."""
        task = self._tasks.get(task_id)
        if not task:
            return None
        if task.tenant_id != requesting_tenant_id:
            raise CrossTenantReviewException(
                f"Unauthorized cross-tenant access: Task {task_id} belongs to '{task.tenant_id}', "
                f"not requesting tenant '{requesting_tenant_id}'."
            )
        return task

    def claim_task(
        self,
        task_id: str,
        requesting_tenant_id: str,
        user_id: str,
        user_roles: list[str],
        expected_version: int,
    ) -> HumanReviewTask:
        """
        Reviewer claims a task to begin review.
        Enforces:
        - Strict tenant isolation
        - Optimistic Concurrency Control (OCC)
        - Role suitability
        - Status transition to IN_REVIEW
        """
        task = self.get_task(task_id, requesting_tenant_id)
        if not task:
            raise ValueError(f"Task '{task_id}' not found.")

        # 1. OCC Concurrency Check
        if task.version != expected_version:
            raise ReviewConcurrencyConflictException(
                f"OCC Conflict: Task '{task_id}' is at version {task.version}, but expected version was {expected_version}."
            )

        # 2. Expiry check
        self._check_sla_expiry(task)

        # 3. Status check
        if task.status not in (
            HumanReviewTaskStatus.PENDING,
            HumanReviewTaskStatus.REASSIGNED,
            HumanReviewTaskStatus.ESCALATED,
        ):
            raise InvalidReviewActionException(
                f"Cannot claim task '{task_id}' in state '{task.status.value}'."
            )

        # 4. RBAC Check: Reviewer must possess required role or BID_DIRECTOR
        required_role_name = task.required_role.value
        if (
            required_role_name not in user_roles
            and ReviewerRole.BID_DIRECTOR.value not in user_roles
        ):
            raise UnauthorizedReviewerException(
                f"User '{user_id}' with roles {user_roles} lacks required role '{required_role_name}'."
            )

        # 5. Mutate state & increment OCC version
        task.status = HumanReviewTaskStatus.IN_REVIEW
        task.claimed_by_user_id = user_id
        task.claimed_at = datetime.now(UTC)
        task.version += 1

        self.review_audit_log.append(
            {
                "timestamp": datetime.now(UTC).isoformat(),
                "action": "HUMAN_REVIEW_TASK_CLAIMED",
                "task_id": task_id,
                "version": task.version,
                "tenant_id": task.tenant_id,
                "claimed_by_user_id": user_id,
                "roles": user_roles,
            }
        )
        return task

    def add_comment(
        self,
        task_id: str,
        requesting_tenant_id: str,
        author_id: str,
        author_role: str,
        text: str,
        expected_version: int,
        tagged_clause: str | None = None,
    ) -> HumanReviewTask:
        """Adds a collaborative note/finding to the review task thread."""
        task = self.get_task(task_id, requesting_tenant_id)
        if not task:
            raise ValueError(f"Task '{task_id}' not found.")

        if task.version != expected_version:
            raise ReviewConcurrencyConflictException(
                f"OCC Conflict: Task '{task_id}' is at version {task.version}, but expected version was {expected_version}."
            )

        comment = ReviewComment(
            comment_id=f"comm_{uuid.uuid4().hex[:8]}",
            author_id=author_id,
            author_role=author_role,
            text=text,
            created_at=datetime.now(UTC),
            tagged_clause=tagged_clause,
        )
        task.comments.append(comment)
        task.version += 1

        self.review_audit_log.append(
            {
                "timestamp": datetime.now(UTC).isoformat(),
                "action": "HUMAN_REVIEW_COMMENT_ADDED",
                "task_id": task_id,
                "version": task.version,
                "tenant_id": task.tenant_id,
                "author_id": author_id,
                "author_role": author_role,
                "comment_id": comment.comment_id,
            }
        )
        return task

    def escalate_task(
        self,
        task_id: str,
        requesting_tenant_id: str,
        author_id: str,
        author_role: str,
        reason: str,
        target_role: ReviewerRole,
        expected_version: int,
    ) -> HumanReviewTask:
        """Escalates a review task to a higher authority (e.g. Legal or Bid Director)."""
        task = self.get_task(task_id, requesting_tenant_id)
        if not task:
            raise ValueError(f"Task '{task_id}' not found.")

        if task.version != expected_version:
            raise ReviewConcurrencyConflictException(
                f"OCC Conflict: Task '{task_id}' is at version {task.version}, but expected version was {expected_version}."
            )

        previous_role = task.required_role
        task.status = HumanReviewTaskStatus.ESCALATED
        task.required_role = target_role
        task.claimed_by_user_id = None
        task.claimed_at = None

        # Add system comment capturing escalation rationale
        escalation_comment = ReviewComment(
            comment_id=f"comm_esc_{uuid.uuid4().hex[:8]}",
            author_id=author_id,
            author_role=author_role,
            text=f"ESCALATION from {previous_role.value} to {target_role.value}: {reason}",
            created_at=datetime.now(UTC),
        )
        task.comments.append(escalation_comment)
        task.version += 1

        self.review_audit_log.append(
            {
                "timestamp": datetime.now(UTC).isoformat(),
                "action": "HUMAN_REVIEW_TASK_ESCALATED",
                "task_id": task_id,
                "version": task.version,
                "tenant_id": task.tenant_id,
                "author_id": author_id,
                "previous_role": previous_role.value,
                "target_role": target_role.value,
                "reason": reason,
            }
        )
        return task

    def reassign_task(
        self,
        task_id: str,
        requesting_tenant_id: str,
        new_user_id: str,
        authorizing_user_id: str,
        expected_version: int | None = None,
    ) -> HumanReviewTask:
        """Reassigns a review task to a different user within the same tenant."""
        task = self.get_task(task_id, requesting_tenant_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")

        if expected_version is not None and task.version != expected_version:
            raise ReviewConcurrencyConflictException(
                f"OCC Conflict: Task '{task_id}' is at version {task.version}, but expected version was {expected_version}."
            )

        previous_assignee = task.assigned_user_id
        task.assigned_user_id = new_user_id
        task.status = HumanReviewTaskStatus.REASSIGNED
        task.claimed_by_user_id = None
        task.claimed_at = None
        task.version += 1

        self.review_audit_log.append(
            {
                "timestamp": datetime.now(UTC).isoformat(),
                "action": "HUMAN_REVIEW_TASK_REASSIGNED",
                "task_id": task_id,
                "version": task.version,
                "tenant_id": task.tenant_id,
                "previous_assignee": previous_assignee,
                "new_assignee": new_user_id,
                "authorizing_user_id": authorizing_user_id,
            }
        )

        return task

    async def submit_review(
        self,
        task_id: str,
        action_payload: HumanReviewActionPayload,
        workflow_graph: Any = None,
    ) -> tuple[HumanReviewTask, Any]:
        """
        Submits human review decision:
        1. Validates strict tenant isolation.
        2. Validates Optimistic Concurrency Control (OCC).
        3. Validates reviewer authorization & role.
        4. Validates duplicate review guard.
        5. Validates task SLA/expiry.
        6. Strictly distinguishes Confirmation from Override (mandates justification if overriding).
        7. Updates task state & increments version.
        8. Resumes workflow (LangGraph Command(resume=...) or custom pipeline callback).
        """
        task = self._tasks.get(task_id)
        if not task:
            raise ValueError(f"Review task '{task_id}' not found.")

        # 1. Tenant Isolation Guard
        if action_payload.tenant_id != task.tenant_id:
            raise CrossTenantReviewException(
                f"Cross-tenant review violation: Reviewer tenant '{action_payload.tenant_id}' "
                f"does not match task tenant '{task.tenant_id}'."
            )

        # 2. OCC Concurrency Check
        if (
            action_payload.expected_version is not None
            and task.version != action_payload.expected_version
        ):
            raise ReviewConcurrencyConflictException(
                f"OCC Conflict: Task '{task_id}' is at version {task.version}, but expected version was {action_payload.expected_version}."
            )

        # 3. Duplicate Review Guard
        if task.status == HumanReviewTaskStatus.COMPLETED:
            raise DuplicateReviewException(
                f"Task '{task_id}' has already been reviewed (Status: {task.status.value}). "
                "Duplicate review actions are prohibited."
            )

        # 4. Expiry / SLA Guard
        self._check_sla_expiry(task)

        # 5. Reviewer Authorization & Role Guard
        if not any(
            p in action_payload.reviewer_permissions
            for p in ("compliance:review", "decision:review", "bids:write")
        ):
            raise UnauthorizedReviewerException(
                f"Reviewer '{action_payload.reviewer_id}' lacks mandatory review permissions."
            )

        required_role_name = task.required_role.value
        if (
            required_role_name not in action_payload.reviewer_roles
            and ReviewerRole.BID_DIRECTOR.value not in action_payload.reviewer_roles
        ):
            raise UnauthorizedReviewerException(
                f"Reviewer '{action_payload.reviewer_id}' lacks required role '{required_role_name}'."
            )

        # 6. Override vs Confirmation Distinguishability
        is_override = False
        override_justification = action_payload.override_justification
        ai_verdict = task.ai_recommendation.get("verdict")

        # Explicit OVERRIDE action or changing a definitive AI verdict (GO/CONDITIONAL_GO/NO_GO)
        if action_payload.action == HumanReviewDecision.OVERRIDE or (
            action_payload.override_verdict
            and ai_verdict
            and ai_verdict in ("GO", "CONDITIONAL_GO", "NO_GO")
            and action_payload.override_verdict != ai_verdict
        ):
            is_override = True
            if not override_justification or len(override_justification.strip()) < 10:
                raise InvalidReviewActionException(
                    "Human override requires an explicit, audit-grade justification (minimum 10 characters)."
                )

        # 7. Update Task State
        task.status = HumanReviewTaskStatus.COMPLETED
        task.decision = action_payload.action
        task.is_override = is_override
        task.override_justification = override_justification
        task.completed_by_user_id = action_payload.reviewer_id
        task.completed_by_role = (
            action_payload.reviewer_roles[0] if action_payload.reviewer_roles else None
        )
        task.completed_at = datetime.now(UTC)
        task.review_notes = action_payload.notes
        task.version += 1

        audit_action = (
            "HUMAN_REVIEW_TASK_RESOLVED_OVERRIDDEN"
            if is_override
            else f"HUMAN_REVIEW_{action_payload.action.value}"
        )
        self.review_audit_log.append(
            {
                "timestamp": datetime.now(UTC).isoformat(),
                "action": audit_action,
                "task_id": task_id,
                "version": task.version,
                "tenant_id": task.tenant_id,
                "reviewer_id": action_payload.reviewer_id,
                "role": task.completed_by_role,
                "decision": action_payload.action.value,
                "is_override": is_override,
                "override_justification": override_justification,
                "notes": action_payload.notes,
            }
        )

        # 8. Workflow Continuation
        resumed_result: Any = None
        if workflow_graph is not None:
            config = {"configurable": {"thread_id": task.thread_id}}
            resumed_result = await workflow_graph.ainvoke(
                Command(resume=action_payload.model_dump()),
                config=config,
            )

        return task, resumed_result

    def _check_sla_expiry(self, task: HumanReviewTask) -> None:
        now = datetime.now(UTC)
        if (task.expires_at and now > task.expires_at) or (
            task.sla_deadline and now > task.sla_deadline
        ):
            task.status = HumanReviewTaskStatus.EXPIRED
            raise ReviewTaskExpiredException(
                f"Task '{task.task_id}' has expired. Cannot perform review actions."
            )
