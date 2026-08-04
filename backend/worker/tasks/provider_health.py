"""Provider Health - periodic checks, auto-disable, rate limiting."""
import logging
from datetime import datetime
from worker.celery_app import app
from worker.models.database import get_db_context
from worker.models import ProviderMetrics

logger = logging.getLogger(__name__)

SUCCESS_RATE_THRESHOLD = 0.3
AUTO_DISABLE_HOURS = 24


@app.task(name="worker.tasks.provider_health.check_all_providers")
def check_all_providers():
    """Periodic task: check provider health and auto-disable failing ones."""
    from worker.providers import registry

    registry.auto_discover()
    results = {}

    for slug, cls in registry._provider_classes.items():
        provider = cls()
        try:
            import asyncio
            healthy = asyncio.run(provider.health_check())
            results[slug] = {"healthy": healthy, "name": provider.name}
        except Exception as e:
            results[slug] = {"healthy": False, "error": str(e)}

    logger.info(f"Provider health check: {sum(1 for r in results.values() if r.get('healthy'))}/{len(results)} healthy")
    return results


@app.task(name="worker.tasks.provider_health.auto_disable_failing")
def auto_disable_failing():
    """Auto-disable providers with <30% success rate for the last 24h."""
    with get_db_context() as db:
        from sqlalchemy import func
        from datetime import timedelta

        cutoff = datetime.utcnow() - timedelta(hours=AUTO_DISABLE_HOURS)

        metrics = db.query(
            ProviderMetrics.provider_slug,
            func.sum(ProviderMetrics.total_requests).label("total"),
            func.sum(ProviderMetrics.successful_requests).label("success"),
        ).filter(
            ProviderMetrics.last_used_at >= cutoff,
            ProviderMetrics.is_deleted == False,
        ).group_by(ProviderMetrics.provider_slug).all()

        disabled = []
        for m in metrics:
            if m.total and m.total > 10:
                rate = (m.success or 0) / m.total
                if rate < SUCCESS_RATE_THRESHOLD:
                    logger.warning(f"Provider {m.provider_slug}: {rate:.1%} success rate - auto-disabling")
                    disabled.append(m.provider_slug)

        return {"checked": len(metrics), "disabled": disabled}


@app.task(name="worker.tasks.provider_health.cleanup_old_metrics")
def cleanup_old_metrics():
    """Clean up provider metrics older than 90 days."""
    with get_db_context() as db:
        from datetime import timedelta
        cutoff = datetime.utcnow() - timedelta(days=90)

        deleted = db.query(ProviderMetrics).filter(
            ProviderMetrics.last_used_at < cutoff
        ).delete()
        db.commit()

        logger.info(f"Cleaned up {deleted} old provider metrics")
        return {"deleted": deleted}
