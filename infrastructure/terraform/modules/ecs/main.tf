/**
 * ECS & ALB Module: Fargate Compute Cluster & Layer-7 Load Balancer
 * 
 * - Application Load Balancer with 300s idle timeout for Server-Sent Events (SSE)
 * - ECS Fargate Cluster with Container Insights
 * - NestJS API Task Definition & Autoscaling Service
 * - FastAPI AI Worker Task Definition & Queue-Depth Autoscaling Service
 */

terraform {
  required_version = ">= 1.7.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "project_name" { type = string }
variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "public_subnet_ids" { type = list(string) }
variable "private_app_subnet_ids" { type = list(string) }
variable "alb_security_group_id" { type = string }
variable "api_security_group_id" { type = string }
variable "ai_worker_security_group_id" { type = string }
variable "ecs_execution_role_arn" { type = string }
variable "api_task_role_arn" { type = string }
variable "ai_worker_task_role_arn" { type = string }
variable "api_image_uri" { type = string }
variable "ai_worker_image_uri" { type = string }
variable "app_secrets_arn" { type = string }
variable "api_desired_count" {
  type    = number
  default = 2
}
variable "ai_worker_desired_count" {
  type    = number
  default = 2
}

# 1. Application Load Balancer (ALB)
resource "aws_lb" "main" {
  name               = "${var.project_name}-alb-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.alb_security_group_id]
  subnets            = var.public_subnet_ids
  idle_timeout       = 300 # 5 minutes for Server-Sent Events (SSE) streams

  tags = {
    Name        = "${var.project_name}-alb-${var.environment}"
    Environment = var.environment
  }
}

# 2. ALB Target Group for NestJS API
resource "aws_lb_target_group" "api" {
  name        = "${var.project_name}-tg-api-${var.environment}"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/api/v1/bids"
    port                = "3000"
    matcher             = "200,401"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  tags = {
    Name = "${var.project_name}-tg-api-${var.environment}"
  }
}

# 3. ALB Listener
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

# 4. Amazon ECS Cluster
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-cluster-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = {
    Name = "${var.project_name}-cluster-${var.environment}"
  }
}

# 5. CloudWatch Log Groups for Containers
resource "aws_cloudwatch_log_group" "api" {
  name              = "/ecs/${var.project_name}-api-${var.environment}"
  retention_in_days = 30

  tags = {
    Name = "${var.project_name}-api-logs-${var.environment}"
  }
}

resource "aws_cloudwatch_log_group" "ai_worker" {
  name              = "/ecs/${var.project_name}-ai-worker-${var.environment}"
  retention_in_days = 30

  tags = {
    Name = "${var.project_name}-ai-worker-logs-${var.environment}"
  }
}

# 6. NestJS Application API Task Definition
resource "aws_ecs_task_definition" "api" {
  family                   = "${var.project_name}-api-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"  # 0.5 vCPU
  memory                   = "1024" # 1 GB RAM
  execution_role_arn       = var.ecs_execution_role_arn
  task_role_arn            = var.api_task_role_arn

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = var.api_image_uri
      essential = true
      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "NODE_ENV", value = var.environment == "prod" ? "production" : "development" },
        { name = "PORT", value = "3000" }
      ]
      secrets = [
        {
          name      = "APP_SECRETS"
          valueFrom = var.app_secrets_arn
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.api.name
          "awslogs-region"        = "ap-south-1"
          "awslogs-stream-prefix" = "api"
        }
      }
    }
  ])
}

# 7. NestJS API ECS Fargate Service
resource "aws_ecs_service" "api" {
  name            = "${var.project_name}-api-service-${var.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.api_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_app_subnet_ids
    security_groups  = [var.api_security_group_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3000
  }

  deployment_controller {
    type = "ECS"
  }

  tags = {
    Name = "${var.project_name}-api-service-${var.environment}"
  }
}

# 8. FastAPI AI Ingestion Worker Task Definition
resource "aws_ecs_task_definition" "ai_worker" {
  family                   = "${var.project_name}-ai-worker-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "1024" # 1 vCPU
  memory                   = "2048" # 2 GB RAM (PyMuPDF & OCR buffers)
  execution_role_arn       = var.ecs_execution_role_arn
  task_role_arn            = var.ai_worker_task_role_arn

  container_definitions = jsonencode([
    {
      name      = "ai-worker"
      image     = var.ai_worker_image_uri
      essential = true
      environment = [
        { name = "ENVIRONMENT", value = var.environment },
        { name = "AWS_REGION", value = "ap-south-1" }
      ]
      secrets = [
        {
          name      = "APP_SECRETS"
          valueFrom = var.app_secrets_arn
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ai_worker.name
          "awslogs-region"        = "ap-south-1"
          "awslogs-stream-prefix" = "ai-worker"
        }
      }
    }
  ])
}

# 9. FastAPI AI Worker ECS Fargate Service
resource "aws_ecs_service" "ai_worker" {
  name            = "${var.project_name}-ai-worker-service-${var.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.ai_worker.arn
  desired_count   = var.ai_worker_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_app_subnet_ids
    security_groups  = [var.ai_worker_security_group_id]
    assign_public_ip = false
  }

  tags = {
    Name = "${var.project_name}-ai-worker-service-${var.environment}"
  }
}

# Outputs
output "alb_dns_name" { value = aws_lb.main.dns_name }
output "alb_arn" { value = aws_lb.main.arn }
output "ecs_cluster_id" { value = aws_ecs_cluster.main.id }
output "ecs_cluster_name" { value = aws_ecs_cluster.main.name }
output "api_service_name" { value = aws_ecs_service.api.name }
output "ai_worker_service_name" { value = aws_ecs_service.ai_worker.name }
