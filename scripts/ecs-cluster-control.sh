#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# TenderPulse ECS Cluster Cost & Lifecycle Controller
# Manage Fargate Spot tasks and schedule state
# ==============================================================================

REGION="${AWS_REGION:-ap-south-1}"
CLUSTER="tenderpulse-cluster-prod"
API_SERVICE="tenderpulse-api-service-prod"
AI_WORKER_SERVICE="tenderpulse-ai-worker-service-prod"

usage() {
  echo "Usage: $0 {status|sleep|wake|schedules}"
  echo "  status    - View active tasks, CPU/memory allocations, and target health"
  echo "  sleep     - Immediately scale all services to 0 (pause compute)"
  echo "  wake      - Immediately scale all services to 1 (resume compute)"
  echo "  schedules - List Auto Scaling scheduled sleep/wake actions"
  exit 1
}

case "${1:-}" in
  status)
    echo "=== Active ECS Tasks (${CLUSTER}) ==="
    aws ecs list-tasks --cluster "${CLUSTER}" --region "${REGION}" --output table
    
    echo -e "\n=== API Service Health (ALB) ==="
    aws elbv2 describe-target-health \
      --target-group-arn arn:aws:elasticloadbalancing:${REGION}:364740865830:targetgroup/tenderpulse-api-tg/45fdf17500d44d60 \
      --region "${REGION}" \
      --query 'TargetHealthDescriptions[*].[Target.Id,Target.Port,TargetHealth.State]' \
      --output table
    ;;

  sleep)
    echo "Scaling ${API_SERVICE} and ${AI_WORKER_SERVICE} to 0..."
    aws ecs update-service --cluster "${CLUSTER}" --service "${API_SERVICE}" --desired-count 0 --region "${REGION}" >/dev/null
    aws ecs update-service --cluster "${CLUSTER}" --service "${AI_WORKER_SERVICE}" --desired-count 0 --region "${REGION}" >/dev/null
    echo "✅ Services scaled to 0. Compute paused."
    ;;

  wake)
    echo "Scaling ${API_SERVICE} and ${AI_WORKER_SERVICE} to 1 on Fargate Spot..."
    aws ecs update-service --cluster "${CLUSTER}" --service "${API_SERVICE}" --desired-count 1 --region "${REGION}" >/dev/null
    aws ecs update-service --cluster "${CLUSTER}" --service "${AI_WORKER_SERVICE}" --desired-count 1 --region "${REGION}" >/dev/null
    echo "✅ Services scaled to 1. Containers are provisioning."
    ;;

  schedules)
    echo "=== Active Auto-Scaling Schedules ==="
    aws application-autoscaling describe-scheduled-actions \
      --service-namespace ecs \
      --region "${REGION}" \
      --query 'ScheduledActions[*].[ScheduledActionName,Schedule,Timezone,ScalableTargetAction.MinCapacity]' \
      --output table
    ;;

  *)
    usage
    ;;
esac
