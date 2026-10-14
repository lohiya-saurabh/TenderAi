import re
from typing import ClassVar


class SecretSanitizer:
    """
    Scrubs credentials, tokens, and private keys from prompts and model-visible tool outputs
    before dispatch. Enforces Zero-Secrets-in-Context rule.
    """

    SECRET_PATTERNS: ClassVar[list[tuple[re.Pattern, str]]] = [
        # AWS Access Key ID
        (re.compile(r"AKIA[0-9A-Z]{16}"), "[REDACTED_AWS_KEY]"),
        # AWS Secret Key (approximate 40 char base64)
        (
            re.compile(r"(?i)aws_secret_access_key\s*=\s*['\"]?[A-Za-z0-9/+=]{40}['\"]?"),
            "aws_secret_access_key=[REDACTED]",
        ),
        # Bearer Tokens / JWTs
        (
            re.compile(r"Bearer\s+eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+"),
            "Bearer [REDACTED_JWT]",
        ),
        # Standalone JWT
        (
            re.compile(r"eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}"),
            "[REDACTED_JWT]",
        ),
        # Database connection strings (PostgreSQL / MySQL)
        (
            re.compile(
                r"postgres(ql)?://[a-zA-Z0-9_\-]+:[^@]+@[a-zA-Z0-9_.\-]+:[0-9]+/[a-zA-Z0-9_\-]+"
            ),
            "postgres://[REDACTED_DB_CREDENTIALS]",
        ),
        # Private Keys
        (
            re.compile(
                r"-----BEGIN (RSA|EC|OPENSSH) PRIVATE KEY-----[\s\S]+?-----END \1 PRIVATE KEY-----"
            ),
            "[REDACTED_PRIVATE_KEY]",
        ),
        # Generic API Keys / Passwords in JSON / query params
        (
            re.compile(
                r"(?i)(api[_-]?key|password|secret|internal[_-]?service[_-]?key)\s*[:=]\s*['\"][^'\"]{8,}['\"]"
            ),
            r"\1='[REDACTED]'",
        ),
        # Presigned S3/GCS URL query parameters containing signatures/tokens
        (
            re.compile(
                r"([?&](X-Amz-Signature|X-Goog-Signature|Signature|sig|signature|token|access_token|apiKey)=)[^&\"'\s]+",
                re.IGNORECASE,
            ),
            r"\1[REDACTED]",
        ),
        # Indian GSTIN (15 characters)
        (
            re.compile(r"\b[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}\b"),
            "[REDACTED_GSTIN]",
        ),
        # Indian PAN (10 characters)
        (re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b"), "[REDACTED_PAN]"),
        # Indian Aadhaar (12 digits)
        (re.compile(r"\b[2-9][0-9]{3}\s?[0-9]{4}\s?[0-9]{4}\b"), "[REDACTED_AADHAAR]"),
    ]

    CONTENT_PATTERNS_TO_TRUNCATE: ClassVar[list[tuple[re.Pattern, int]]] = [
        # Truncate prompt and document text fields in JSON payloads
        (
            re.compile(
                r'("(?:prompt|full_prompt|system_prompt|user_prompt|document_content|raw_page_text|raw_text|page_text|extracted_text)"\s*:\s*")([^"\\]*(?:\\.[^"\\]*)*)(")',
                re.IGNORECASE,
            ),
            250,
        ),
    ]

    @classmethod
    def scrub(cls, text: str) -> tuple[str, bool]:
        """
        Scrubs known secrets and truncates oversized prompts/document contents from text.
        Returns (scrubbed_text, was_scrubbed_flag).
        """
        scrubbed = text
        found_any = False

        for pattern, replacement in cls.SECRET_PATTERNS:
            if pattern.search(scrubbed):
                found_any = True
                scrubbed = pattern.sub(replacement, scrubbed)

        for pattern, max_len in cls.CONTENT_PATTERNS_TO_TRUNCATE:

            def _truncate_match(m: re.Match) -> str:
                nonlocal found_any
                prefix = m.group(1)
                content = m.group(2)
                suffix = m.group(3)
                if len(content) > max_len:
                    found_any = True
                    omitted = len(content) - max_len
                    return f"{prefix}{content[:max_len]}... [TRUNCATED: {omitted} chars omitted for log safety]{suffix}"
                return m.group(0)

            scrubbed = pattern.sub(_truncate_match, scrubbed)

        return scrubbed, found_any

    @classmethod
    def wrap_untrusted_data(cls, document_id: str, page_number: int, content: str) -> str:
        """
        Wraps untrusted tender text chunks in XML semantic boundaries.
        Neutralizes delimiter hijacking and directs models to treat content as passive data.
        """
        # Escape any closing tag collisions to prevent boundary breaking
        sanitized_content = content.replace("</untrusted_document_data>", "[ESCAPED_CLOSING_TAG]")
        return (
            f'<untrusted_document_data document_id="{document_id}" page="{page_number}">\n'
            f"{sanitized_content}\n"
            f"</untrusted_document_data>"
        )
