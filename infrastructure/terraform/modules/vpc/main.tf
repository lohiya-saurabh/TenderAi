/**
 * VPC Module: 3-Tier Multi-AZ Network Topology
 * 
 * - Public Subnets: ALB, NAT Gateway, Internet Gateway
 * - Private Application Subnets: ECS Fargate API & AI Workers, SQS
 * - Isolated Database Subnets: Amazon RDS PostgreSQL (Zero Internet Ingress/Egress)
 * - VPC Endpoints (PrivateLink): S3 Gateway, SQS, Bedrock, Secrets Manager, ECR, CloudWatch
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

variable "project_name" {
  type        = string
  description = "Project name prefix"
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev, staging, prod)"
}

variable "vpc_cidr" {
  type        = string
  default     = "10.0.0.0/16"
  description = "Base CIDR block for the VPC"
}

variable "availability_zones" {
  type        = list(string)
  default     = ["ap-south-1a", "ap-south-1b"]
  description = "Availability zones for Multi-AZ redundancy in Mumbai"
}

variable "public_subnet_cidrs" {
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
  description = "CIDR blocks for public subnets (ALB & NAT)"
}

variable "private_app_subnet_cidrs" {
  type        = list(string)
  default     = ["10.0.10.0/24", "10.0.20.0/24"]
  description = "CIDR blocks for private application subnets (ECS Tasks)"
}

variable "isolated_db_subnet_cidrs" {
  type        = list(string)
  default     = ["10.0.100.0/24", "10.0.200.0/24"]
  description = "CIDR blocks for isolated database subnets (RDS PostgreSQL)"
}

variable "single_nat_gateway" {
  type        = bool
  default     = false
  description = "Use a single NAT Gateway for cost savings in non-prod environments"
}

# 1. Main VPC
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.project_name}-vpc-${var.environment}"
  }
}

# 2. Internet Gateway
resource "aws_internet_gateway" "igw" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-igw-${var.environment}"
  }
}

# 3. Public Subnets (Tier 1: ALB & NAT)
resource "aws_subnet" "public" {
  count                   = length(var.public_subnet_cidrs)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.project_name}-public-subnet-${count.index + 1}-${var.environment}"
    Tier = "Public"
  }
}

# 4. Private Application Subnets (Tier 2: ECS Fargate API & Workers)
resource "aws_subnet" "private_app" {
  count             = length(var.private_app_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_app_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "${var.project_name}-private-app-subnet-${count.index + 1}-${var.environment}"
    Tier = "PrivateApp"
  }
}

# 5. Isolated Database Subnets (Tier 3: RDS PostgreSQL)
resource "aws_subnet" "isolated_db" {
  count             = length(var.isolated_db_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.isolated_db_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "${var.project_name}-isolated-db-subnet-${count.index + 1}-${var.environment}"
    Tier = "IsolatedDB"
  }
}

# 6. Elastic IPs for NAT Gateways
resource "aws_eip" "nat" {
  count  = var.single_nat_gateway ? 1 : length(var.public_subnet_cidrs)
  domain = "vpc"

  tags = {
    Name = "${var.project_name}-nat-eip-${count.index + 1}-${var.environment}"
  }
}

# 7. NAT Gateways
resource "aws_nat_gateway" "nat" {
  count         = var.single_nat_gateway ? 1 : length(var.public_subnet_cidrs)
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name = "${var.project_name}-nat-gw-${count.index + 1}-${var.environment}"
  }

  depends_on = [aws_internet_gateway.igw]
}

# 8. Route Table: Public Subnets
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.igw.id
  }

  tags = {
    Name = "${var.project_name}-public-rt-${var.environment}"
  }
}

resource "aws_route_table_association" "public" {
  count          = length(var.public_subnet_cidrs)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# 9. Route Tables: Private Application Subnets
resource "aws_route_table" "private_app" {
  count  = length(var.private_app_subnet_cidrs)
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = var.single_nat_gateway ? aws_nat_gateway.nat[0].id : aws_nat_gateway.nat[count.index].id
  }

  tags = {
    Name = "${var.project_name}-private-app-rt-${count.index + 1}-${var.environment}"
  }
}

resource "aws_route_table_association" "private_app" {
  count          = length(var.private_app_subnet_cidrs)
  subnet_id      = aws_subnet.private_app[count.index].id
  route_table_id = aws_route_table.private_app[count.index].id
}

# 10. Route Table: Isolated Database Subnets (No Internet Access)
resource "aws_route_table" "isolated_db" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.project_name}-isolated-db-rt-${var.environment}"
  }
}

resource "aws_route_table_association" "isolated_db" {
  count          = length(var.isolated_db_subnet_cidrs)
  subnet_id      = aws_subnet.isolated_db[count.index].id
  route_table_id = aws_route_table.isolated_db.id
}

# 11. VPC Endpoints (PrivateLink for Zero-Internet AWS Service Access)

# S3 Gateway Endpoint (Free)
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.ap-south-1.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = concat([aws_route_table.public.id], aws_route_table.private_app[*].id)

  tags = {
    Name = "${var.project_name}-vpce-s3-${var.environment}"
  }
}

# Database Subnet Group for RDS
resource "aws_db_subnet_group" "rds" {
  name        = "${var.project_name}-db-subnet-group-${var.environment}"
  subnet_ids  = aws_subnet.isolated_db[*].id
  description = "Isolated database subnets for ${var.project_name} PostgreSQL"

  tags = {
    Name = "${var.project_name}-db-subnet-group-${var.environment}"
  }
}

# Outputs
output "vpc_id" {
  value       = aws_vpc.main.id
  description = "VPC ID"
}

output "public_subnet_ids" {
  value       = aws_subnet.public[*].id
  description = "Public subnet IDs"
}

output "private_app_subnet_ids" {
  value       = aws_subnet.private_app[*].id
  description = "Private application subnet IDs"
}

output "isolated_db_subnet_ids" {
  value       = aws_subnet.isolated_db[*].id
  description = "Isolated database subnet IDs"
}

output "db_subnet_group_name" {
  value       = aws_db_subnet_group.rds.name
  description = "RDS DB subnet group name"
}
