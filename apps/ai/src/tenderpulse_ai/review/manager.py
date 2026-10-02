import uuid
from datetime import UTC, datetime
from typing import Any

from langgraph.types import Command

from tenderpulse_ai.domain.models import CandidateComplianceItem
from tenderpulse_ai.review.models import (
    CrossTenantReviewException,
    DuplicateReviewException,
    HumanReviewActionPayload,
    HumanReviewTask,
    HumanReviewTaskStatus,
    ReviewTaskExpiredException,
    UnauthorizedReviewerException,
)


class HumanReviewManager:
    """
    Manages human review lifecycle, enforces tenant-scoped access,
    verifies reviewer authorization, handles task expiry and reassignment,
    and resumes LangGraph workflows via Command(resume=...).
    """

    def __init__(self):
        # In-memory task repository partitioned by task_id: task_id -> HumanReviewTask
        self._tasks: dict[str, HumanReviewTask] = {}
        # Audit log for review management events
        self.review_audit_log: list[dict[str, Any]] = []

    def create_task(
        self,
        thread_id: str,
        workflow_run_id: str,
        tenant_id: str,
        bid_id: str,
        document_id: str,
        page_number: int,
        unverified_items: list[CandidateComplianceItem],
        failure_reasons: str | None = None,
        assigned_user_id: str | None = None,
        expires_at: datetime | None = None,
    ) -> HumanReviewTask:
        task_id = f"rev_task_{uuid.uuid4().hex[:12]}"
        task = HumanReviewTask(
            task_id=task_id,
            thread_id=thread_id,
            workflow_run_id=workflow_run_id,
            tenant_id=tenant_id,
            bid_id=bid_id,
            document_id=document_id,
            page_number=page_number,
            unverified_items=unverified_items,
            failure_reasons=failure_reasons,
            status=HumanReviewTaskStatus.PENDING,
            assigned_user_id=assigned_user_id,
            expires_at=expires_at,
        )
        self._tasks[task_id] = task

        self.review_audit_log.append({
            "timestamp": datetime.now(UTC).isoformat(),
            "action": "HUMAN_REVIEW_TASK_CREATED",
            "task_id": task_id,
            "tenant_id": tenant_id,
            "bid_id": bid_id,
            "assigned_user_id": assigned_user_id,
            "items_count": len(unverified_items),
        })

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

    def reassign_task(
        self,
        task_id: str,
        requesting_tenant_id: str,
        new_user_id: str,
        authorizing_user_id: str,
    ) -> HumanReviewTask:
        """Reassigns a review task to a different user within the same tenant."""
        task = self.get_task(task_id, requesting_tenant_id)
        if not task:
            raise ValueError(f"Task {task_id} not found")

        previous_assignee = task.assigned_user_id
        task.assigned_user_id = new_user_id

        self.review_audit_log.append({
            "timestamp": datetime.now(UTC).isoformat(),
            "action": "HUMAN_REVIEW_TASK_REASSIGNED",
            "task_id": task_id,
            "tenant_id": task.tenant_id,
            "previous_assignee": previous_assignee,
            "new_assignee": new_user_id,
            "authorizing_user_id": authorizing_user_id,
        })

        return task

    async def submit_review(
        self,
        task_id: str,
        action_payload: HumanReviewActionPayload,
        workflow_graph: Any,
    ) -> tuple[HumanReviewTask, dict[str, Any]]:
        """
        Executes human review decision:
        1. Validates strict tenant isolation.
        2. Validates reviewer RBAC permissions ('compliance:review').
        3. Prevents duplicate review actions.
        4. Validates task SLA/expiry.
        5. Updates task state.
        6. Resumes LangGraph workflow with Command(resume=action_payload).
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

        # 2. Reviewer Authorization Guard
        if "compliance:review" not in action_payload.reviewer_permissions:
            raise UnauthorizedReviewerException(
                f"Reviewer '{action_payload.reviewer_id}' lacks mandatory 'compliance:review' permission."
            )

        # 3. Duplicate Approval Guard
        if task.status != HumanReviewTaskStatus.PENDING:
            raise DuplicateReviewException(
                f"Task '{task_id}' has already been reviewed (Status: {task.status.value}). "
                "Duplicate review actions are prohibited."
            )

        # 4. Expiry / SLA Guard
        if task.expires_at and datetime.now(UTC) > task.expires_at:
            task.status = HumanReviewTaskStatus.EXPIRED
            raise ReviewTaskExpiredException(
                f"Task '{task_id}' expired at {task.expires_at.isoformat()}. Cannot submit review."
            )

        # 5. Update Task Metadata
        task.status = HumanReviewTaskStatus.COMPLETED
        task.decision = action_payload.action
        task.completed_by_user_id = action_payload.reviewer_id
        task.completed_at = datetime.now(UTC)
        task.review_notes = action_payload.notes

        self.review_audit_log.append({
            "timestamp": datetime.now(UTC).isoformat(),
            "action": f"HUMAN_REVIEW_{action_payload.action.value}",
            "task_id": task_id,
            "tenant_id": task.tenant_id,
            "reviewer_id": action_payload.reviewer_id,
            "decision": action_payload.action.value,
            "notes": action_payload.notes,
        })

        # 6. Resume LangGraph Workflow Checkpoint
        config = {"configurable": {"thread_id": task.thread_id}}
        resumed_state = await workflow_graph.ainvoke(
            Command(resume=action_payload.model_dump()),
            config=config,
        )

        return task, resumed_state
