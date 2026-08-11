"""Notification dispatch task - drains the notification_queue for email/sms channels."""
import logging

from worker.celery_app import app

logger = logging.getLogger(__name__)


@app.task(name="worker.tasks.notifications.dispatch_pending_emails")
def dispatch_pending_emails(limit: int = 100) -> dict:
    """Send queued email notifications whose scheduled_at has passed."""
    from worker.models.database import get_db_context
    from worker.services.notification_dispatch import (
        dispatch_pending_email,
        fetch_pending_emails,
    )

    dispatched = 0
    failed = 0
    try:
        with get_db_context() as db:
            rows = fetch_pending_emails(db, limit)
            for row in rows:
                dispatch_pending_email(db, row)
                dispatched += 1
    except Exception as e:
        logger.error(f"dispatch_pending_emails failed: {e}")
        failed += 1

    return {"dispatched": dispatched, "failed": failed}


@app.task(name="worker.tasks.notifications.dispatch_pending_browser")
def dispatch_pending_browser(limit: int = 200) -> dict:
    """Mark browser notifications past their scheduled time as delivered."""
    from worker.models.database import get_db_context
    from worker.services.notification_dispatch import mark_browser_delivered

    processed = 0
    try:
        with get_db_context() as db:
            processed = mark_browser_delivered(db, limit)
    except Exception as e:
        logger.error(f"dispatch_pending_browser failed: {e}")

    return {"processed": processed}
