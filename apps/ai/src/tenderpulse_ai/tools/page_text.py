from tenderpulse_ai.security.context import SecurityContext
from tenderpulse_ai.security.exceptions import UnauthorizedDocumentAccessException


class PageTextTool:
    """
    Retrieves physical page text from verified document storage for deterministic
    verbatim substring verification.
    """

    def __init__(self):
        # Key: "{tenant_id}:{document_id}:{page_number}" -> raw page text
        self._pages: dict[str, str] = {}

    def seed_page(self, tenant_id: str, document_id: str, page_number: int, text: str):
        key = f"{tenant_id}:{document_id}:{page_number}"
        self._pages[key] = text

    def get_page_text(
        self,
        security_context: SecurityContext,
        target_document_id: str,
        page_number: int,
    ) -> str:
        """
        Enforces:
        1. target_document_id in security_context.allowed_document_ids.
        2. Lookup scoped by security_context.tenant_id.
        """
        if target_document_id not in security_context.allowed_document_ids:
            raise UnauthorizedDocumentAccessException(
                f"Cannot access page text: Document '{target_document_id}' not in allowed scope."
            )

        key = f"{security_context.tenant_id}:{target_document_id}:{page_number}"
        return self._pages.get(key, "")
