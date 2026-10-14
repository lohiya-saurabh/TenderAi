#!/usr/bin/env bash
# ==============================================================================
# TenderPulse AI — AWS IAM OIDC Role Setup for GitHub Actions
#
# Configures:
# 1. GitHub Actions OIDC Identity Provider in AWS IAM (token.actions.githubusercontent.com)
# 2. Least-privilege IAM Role: TenderPulseGitHubActionsDeployRole
# 3. Trust policy locked strictly to repo: lohiya-saurabh/TenderAi
# 4. Permissions policy for Amazon ECR, Amazon ECS, Amazon S3, and CloudFront
# ==============================================================================

set -euo pipefail

# Check for AWS CLI
if ! command -v aws >/dev/null 2>&1; then
  echo "❌ Error: AWS CLI ('aws') is required. Install via 'brew install awscli' or https://aws.amazon.com/cli/"
  exit 1
fi

# Verify AWS credentials
ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text 2>/dev/null || true)
if [ -z "$ACCOUNT_ID" ]; then
  echo "❌ Error: Could not determine AWS Account ID. Please configure AWS CLI via 'aws configure' first."
  exit 1
fi

AWS_REGION="${AWS_REGION:-ap-south-1}"
GITHUB_REPO="${1:-lohiya-saurabh/TenderAi}"
ROLE_NAME="TenderPulseGitHubActionsDeployRole"
POLICY_NAME="TenderPulseGitHubActionsDeployPolicy"

echo "================================================================="
echo "AWS Account ID   : $ACCOUNT_ID"
echo "AWS Region       : $AWS_REGION"
echo "GitHub Repo      : $GITHUB_REPO"
echo "IAM Role Name    : $ROLE_NAME"
echo "================================================================="

# ------------------------------------------------------------------------------
# STEP 1: Create GitHub OIDC Identity Provider (if not already present)
# ------------------------------------------------------------------------------
OIDC_PROVIDER_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"

if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "$OIDC_PROVIDER_ARN" >/dev/null 2>&1; then
  echo "✅ GitHub OIDC Identity Provider already exists: $OIDC_PROVIDER_ARN"
else
  echo "🚀 Creating GitHub OIDC Identity Provider in AWS IAM..."
  # GitHub Actions OIDC thumbprints
  aws iam create-open-id-connect-provider \
    --url "https://token.actions.githubusercontent.com" \
    --client-id-list "sts.amazonaws.com" \
    --thumbprint-list "6938fd4d98bab03faadb97b34396831e3780aea1" "1c58a3a8518e8759bf075b76b750d4f2df264fcd" >/dev/null
  echo "✅ Created GitHub OIDC Provider: $OIDC_PROVIDER_ARN"
fi

# ------------------------------------------------------------------------------
# STEP 2: Create Trust Policy (Scoped strictly to lohiya-saurabh/TenderAi)
# ------------------------------------------------------------------------------
TRUST_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "${OIDC_PROVIDER_ARN}"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
        },
        "StringLike": {
          "token.actions.githubusercontent.com:sub": "repo:${GITHUB_REPO}:*"
        }
      }
    }
  ]
}
EOF
)

# ------------------------------------------------------------------------------
# STEP 3: Create Least-Privilege Permissions Policy
# ------------------------------------------------------------------------------
PERMISSIONS_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRAuthToken",
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken"
      ],
      "Resource": "*"
    },
    {
      "Sid": "ECRRepositoryAccess",
      "Effect": "Allow",
      "Action": [
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:DescribeRepositories",
        "ecr:CreateRepository"
      ],
      "Resource": [
        "arn:aws:ecr:${AWS_REGION}:${ACCOUNT_ID}:repository/tenderpulse-web",
        "arn:aws:ecr:${AWS_REGION}:${ACCOUNT_ID}:repository/tenderpulse-api",
        "arn:aws:ecr:${AWS_REGION}:${ACCOUNT_ID}:repository/tenderpulse-ai-worker"
      ]
    },
    {
      "Sid": "ECSDeploymentAccess",
      "Effect": "Allow",
      "Action": [
        "ecs:UpdateService",
        "ecs:DescribeServices",
        "ecs:DescribeTaskDefinition",
        "ecs:RegisterTaskDefinition",
        "ecs:ListServices",
        "ecs:ListTasks"
      ],
      "Resource": "*"
    },
    {
      "Sid": "PassRoleToECS",
      "Effect": "Allow",
      "Action": [
        "iam:PassRole"
      ],
      "Resource": [
        "arn:aws:iam::${ACCOUNT_ID}:role/tenderpulse-*"
      ]
    },
    {
      "Sid": "S3SPADeployment",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::tenderpulse-web-spa-*",
        "arn:aws:s3:::tenderpulse-web-spa-*/*"
      ]
    },
    {
      "Sid": "CloudFrontCacheInvalidation",
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation"
      ],
      "Resource": "*"
    }
  ]
}
EOF
)

# ------------------------------------------------------------------------------
# STEP 4: Create or Update IAM Policy & Role
# ------------------------------------------------------------------------------
echo "🚀 Creating/updating IAM permissions policy: $POLICY_NAME..."
POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}"

if aws iam get-policy --policy-arn "$POLICY_ARN" >/dev/null 2>&1; then
  echo "ℹ️ Policy already exists. Creating new version..."
  # Prune old policy versions if at AWS limit (5)
  VERSIONS_TO_DELETE=$(aws iam list-policy-versions --policy-arn "$POLICY_ARN" --query 'Versions[?!IsDefaultVersion].VersionId' --output text)
  for v in $VERSIONS_TO_DELETE; do
    aws iam delete-policy-version --policy-arn "$POLICY_ARN" --version-id "$v" >/dev/null 2>&1 || true
    break
  done
  aws iam create-policy-version --policy-arn "$POLICY_ARN" --policy-document "$PERMISSIONS_POLICY" --set-as-default >/dev/null
else
  aws iam create-policy --policy-name "$POLICY_NAME" --policy-document "$PERMISSIONS_POLICY" >/dev/null
fi

echo "🚀 Creating/updating IAM Role: $ROLE_NAME..."
if aws iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  echo "ℹ️ Role exists. Updating trust policy..."
  aws iam update-assume-role-policy --role-name "$ROLE_NAME" --policy-document "$TRUST_POLICY" >/dev/null
else
  aws iam create-role --role-name "$ROLE_NAME" --assume-role-policy-document "$TRUST_POLICY" >/dev/null
fi

echo "🔗 Attaching policy to role..."
aws iam attach-role-policy --role-name "$ROLE_NAME" --policy-arn "$POLICY_ARN" >/dev/null || true

ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/${ROLE_NAME}"

echo "================================================================="
echo "🎉 SUCCESS: AWS IAM OIDC Role is Ready for GitHub Actions!"
echo "================================================================="
echo ""
echo "ROLE ARN to add to GitHub Repository Secrets:"
echo ""
echo "  AWS_ROLE_ARN = $ROLE_ARN"
echo ""
echo "Steps in GitHub:"
echo "  1. Go to https://github.com/${GITHUB_REPO}/settings/secrets/actions"
echo "  2. Click 'New repository secret'"
echo "  3. Name  : AWS_ROLE_ARN"
echo "  4. Value : $ROLE_ARN"
echo "================================================================="
