"""Transactional email service for the notification system.

Sends email via SMTP using Python's stdlib (no extra dependencies). Falls back to
a structured log when SMTP isn't configured so the rest of the pipeline keeps
working in development. Env vars:

- SMTP_HOST / SMTP_PORT (default localhost:587)
- SMTP_USER / SMTP_PASSWORD
- SMTP_FROM (default "Ventriee <no-reply@ventrieeleads.com>")
- SMTP_USE_TLS (default true)
- SMTP_TIMEOUT (default 15s)
"""
import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

logger = logging.getLogger(__name__)

def _smtp_config() -> dict:
    """Read SMTP config from env at call time so tests/restarts pick up changes."""
    return {
        "host": os.getenv("SMTP_HOST", "localhost"),
        "port": int(os.getenv("SMTP_PORT", "587")),
        "user": os.getenv("SMTP_USER", ""),
        "password": os.getenv("SMTP_PASSWORD", ""),
        "from": os.getenv("SMTP_FROM", "Ventriee <no-reply@ventrieeleads.com>"),
        "use_tls": os.getenv("SMTP_USE_TLS", "true").lower() in ("1", "true", "yes"),
        "timeout": int(os.getenv("SMTP_TIMEOUT", "15")),
    }


def _is_configured() -> bool:
    return bool(_smtp_config()["host"] and _smtp_config()["host"] != "localhost")


class EmailService:
    """Send transactional emails, marking them sent/delivered in the queue."""

    def send(
        self,
        to: str,
        subject: str,
        body: str,
        html: Optional[str] = None,
        from_addr: Optional[str] = None,
    ) -> bool:
        """Send an email. Returns True when accepted by SMTP (or logged in dev)."""
        if not to or not subject:
            logger.warning("Email skipped: missing recipient or subject")
            return False

        if not _is_configured():
            logger.info(
                "Email not sent (SMTP not configured). to=%s subject=%s body=%s",
                to, subject, body[:500],
            )
            return True

        cfg = _smtp_config()
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_addr or cfg["from"]
        msg["To"] = to
        msg.attach(MIMEText(body, "plain", "utf-8"))
        if html:
            msg.attach(MIMEText(html, "html", "utf-8"))

        try:
            with smtplib.SMTP(cfg["host"], cfg["port"], timeout=cfg["timeout"]) as server:
                if cfg["use_tls"]:
                    server.starttls()
                if cfg["user"]:
                    server.login(cfg["user"], cfg["password"])
                server.sendmail(from_addr or cfg["from"], [to], msg.as_string())
            logger.info("Email sent to %s: %s", to, subject)
            return True
        except Exception as e:
            logger.error("Email send failed to %s (%s): %s", to, subject, e)
            return False


email_service = EmailService()
