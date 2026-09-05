"""Email verification service using check-if-email-exists (Rust backend)."""
import os
import logging
import httpx
from typing import Dict, Optional

logger = logging.getLogger(__name__)

EMAIL_VERIFIER_URL = os.getenv("EMAIL_VERIFIER_URL", "http://localhost:8080")


class EmailVerifier:
    """Verify emails using check-if-email-exists Docker sidecar."""

    async def verify(self, email: str) -> Dict:
        """Verify a single email address.

        Returns dict with:
          - email: the input email
          - is_valid: bool
          - is_disposable: bool
          - is_role_account: bool
          - score: 0-100 confidence
          - mx_found: bool
          - smtp_check: bool
          - source: "check-if-email-exists"
        """
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{EMAIL_VERIFIER_URL}/v0/check_email",
                    json={"email": email},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    result = data.get("input", {})
                    smtp = data.get("smtp", {})
                    mx = data.get("mx", {})
                    misc = data.get("misc", {})

                    is_valid = (
                        smtp.get("is_deliverable", False)
                        and not smtp.get("is_catch_all", False)
                    )

                    return {
                        "email": email,
                        "is_valid": is_valid,
                        "is_disposable": misc.get("is_disposable", False),
                        "is_role_account": misc.get("is_role_account", False),
                        "score": data.get("score", 0),
                        "mx_found": mx.get("records", []) != [],
                        "smtp_check": smtp.get("is_deliverable", False),
                        "source": "check-if-email-exists",
                    }
                else:
                    logger.warning(f"Email verifier returned {resp.status_code}")
                    return self._fallback(email)
        except Exception as e:
            logger.debug(f"Email verifier unavailable: {e}")
            return self._fallback(email)

    async def verify_batch(self, emails: list[str]) -> list[Dict]:
        """Verify multiple emails."""
        results = []
        for email in emails:
            result = await self.verify(email)
            results.append(result)
        return results

    def _fallback(self, email: str) -> Dict:
        """Basic regex fallback when verifier is unavailable."""
        import re
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        is_valid = bool(re.match(pattern, email))
        is_disposable = any(
            d in email.lower()
            for d in ['tempmail', 'throwaway', 'guerrillamail', 'mailinator', 'yopmail']
        )
        return {
            "email": email,
            "is_valid": is_valid and not is_disposable,
            "is_disposable": is_disposable,
            "is_role_account": any(
                email.lower().startswith(r)
                for r in ['info@', 'admin@', 'support@', 'contact@', 'hello@']
            ),
            "score": 50 if is_valid else 0,
            "mx_found": False,
            "smtp_check": False,
            "source": "regex-fallback",
        }


email_verifier = EmailVerifier()
