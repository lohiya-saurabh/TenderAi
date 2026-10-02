
from typing import ClassVar

from tenderpulse_ai.security.exceptions import UnrestrictedAccessBlockedException


class NetworkEgressGuard:
    """
    Enforces Deny-By-Default on outbound network connections.
    Only explicit internal endpoints (VPC PrivateLink to Bedrock, S3, internal API Gateway)
    are permitted. Arbitrary web URLs are blocked unconditionally.
    """
    WHITELISTED_HOSTS: ClassVar[set[str]] = {
        "bedrock-runtime.ap-south-1.amazonaws.com",
        "s3.ap-south-1.amazonaws.com",
        "localhost",
        "127.0.0.1",
        "internal-api-gateway",
    }

    @classmethod
    def validate_destination(cls, host_or_url: str):
        # Extract hostname
        clean_host = host_or_url.replace("http://", "").replace("https://", "").split("/")[0].split(":")[0]
        if clean_host not in cls.WHITELISTED_HOSTS:
            raise UnrestrictedAccessBlockedException(
                f"Egress blocked by security policy: Destination '{clean_host}' is not whitelisted. "
                f"Agent possesses ZERO arbitrary internet access."
            )
