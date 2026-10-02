class AISecurityException(Exception):
    """Base exception for all AI security violations."""


class UnauthorizedDocumentAccessException(AISecurityException):
    """Raised when an AI workflow or tool attempts to access a document outside its whitelist."""


class CrossTenantAccessException(AISecurityException):
    """Raised when a tenant attempts to access another tenant's vector chunks, state, or documents."""


class SecretDetectedException(AISecurityException):
    """Raised when an unredacted credential or secret is detected in prompt context."""


class UnrestrictedAccessBlockedException(AISecurityException):
    """Raised when an agent attempts to execute an unrestricted tool or network request."""


class ToolRateLimitExceededException(AISecurityException):
    """Raised when a tool invocation exceeds allowed rate limits per workflow run."""
