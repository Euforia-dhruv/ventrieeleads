"""Pure notification dispatch logic (no celery import so it's unit-testable).

The celery task wrappers live in `worker.tasks.notifications`.
"""
import logging
from sqlalchemy import text

logger = logging.getLogger(__name__)


def dispatch_pending_email(db, row) -> None:
    """Dispatch a single pending email notification row."""
    try:
        from worker.services.email import email_service

        data = row["data"] or {}
        recipient = data.get("to") or data.get("email")
        if not recipient and row["user_id"]:
            # Fall back to the target user's email via the users table.
            result = db.execute(
                text("SELECT email FROM users WHERE id = :uid"),
                {"uid": str(row["user_id"])},
            ).fetchone()
            recipient = result[0] if result else None
        if not recipient:
            db.execute(
                text(
                    "UPDATE notification_queue SET status = 'failed', error_message = :err, updated_at = NOW() "
                    "WHERE id = :nid"
                ),
                {"err": "no recipient", "nid": str(row["id"])},
            )
            return

        sent = email_service.send(
            to=recipient,
            subject=row["title"],
            body=row["body"] or "",
            html=data.get("html"),
            from_addr=data.get("from"),
        )
        if sent:
            db.execute(
                text(
                    "UPDATE notification_queue SET status = 'delivered', delivered_at = NOW(), sent_at = NOW(), "
                    "updated_at = NOW() WHERE id = :nid"
                ),
                {"nid": str(row["id"])},
            )
        else:
            db.execute(
                text(
                    "UPDATE notification_queue SET status = 'failed', error_message = :err, "
                    "retry_count = retry_count + 1, updated_at = NOW() WHERE id = :nid"
                ),
                {"err": "smtp error", "nid": str(row["id"])},
            )
    except Exception as e:
        logger.error(f"Email dispatch failed for row {row['id']}: {e}")
        try:
            db.execute(
                text(
                    "UPDATE notification_queue SET error_message = :err, retry_count = retry_count + 1, "
                    "updated_at = NOW() WHERE id = :nid"
                ),
                {"err": str(e)[:500], "nid": str(row["id"])},
            )
        except Exception:
            pass


def fetch_pending_emails(db, limit: int = 100) -> list:
    """Return pending, due email notification rows from the queue."""
    return db.execute(
        text(
            """SELECT id, user_id, title, body, data AS data, scheduled_at
               FROM notification_queue
               WHERE channel = 'email'
                 AND status = 'pending'
                 AND retry_count < max_retries
                 AND scheduled_at <= NOW()
               ORDER BY priority ASC, scheduled_at ASC
               LIMIT :lim"""
        ),
        {"lim": int(limit)},
    ).mappings().all()


def mark_browser_delivered(db, limit: int = 200) -> int:
    """Mark due browser notifications delivered; returns rows updated."""
    result = db.execute(
        text(
            """UPDATE notification_queue
               SET status = 'delivered', delivered_at = NOW(), updated_at = NOW()
               WHERE id IN (
                 SELECT id FROM notification_queue
                 WHERE channel = 'browser' AND status = 'pending' AND scheduled_at <= NOW()
                 LIMIT :lim
               )"""
        ),
        {"lim": int(limit)},
    )
    return result.rowcount or 0
