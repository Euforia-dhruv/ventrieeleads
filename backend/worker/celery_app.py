"""Celery application configuration."""
import os
from celery import Celery
from celery.schedules import crontab
from celery.signals import worker_ready

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
CELERY_TIMEZONE = os.getenv("TIMEZONE", "UTC")

app = Celery(
    "ventriee_leads",
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=[
        "worker.tasks.search",
        "worker.tasks.scrape",
        "worker.tasks.audit",
        "worker.tasks.process",
        "worker.tasks.research",
        "worker.tasks.monitor",
        "worker.tasks.agents",
        "worker.tasks.intelligence",
        "worker.tasks.campaign_orchestrator",
        "worker.tasks.intelligence_analytics",
        "worker.tasks.modules",
    ]
)

app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone=CELERY_TIMEZONE,
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=100,
    task_soft_time_limit=300,
    task_time_limit=600,
    task_routes={
        "worker.tasks.search.*": {"queue": "search"},
        "worker.tasks.scrape.*": {"queue": "scrape"},
        "worker.tasks.audit.*": {"queue": "audit"},
        "worker.tasks.process.*": {"queue": "process"},
        "worker.tasks.research.*": {"queue": "research"},
        "worker.tasks.monitor.*": {"queue": "process"},
        "worker.tasks.agents.*": {"queue": "process"},
        "worker.tasks.intelligence.*": {"queue": "search"},
        "worker.tasks.campaign_orchestrator.*": {"queue": "search"},
        "worker.tasks.intelligence_analytics.*": {"queue": "search"},
        "worker.tasks.modules.*": {"queue": "process"},
    },
    beat_schedule={
        "cleanup-stale-jobs": {
            "task": "worker.tasks.process.cleanup_stale_jobs",
            "schedule": 300.0,
        },
        "run-monitoring-checks": {
            "task": "worker.tasks.monitor.run_scheduled_checks",
            "schedule": 600.0,
        },
        "agents-health-check": {
            "task": "worker.tasks.agents.health_check",
            "schedule": 300.0,
        },
        "agents-recover-failures": {
            "task": "worker.tasks.agents.recover_failures",
            "schedule": 600.0,
        },
        "agents-run-all": {
            "task": "worker.tasks.agents.run_all_agents",
            "schedule": 1800.0,
        },
        "agents-daily-briefing": {
            "task": "worker.tasks.agents.generate_briefing",
            "schedule": 86400.0,
        },
        "campaign-progress-update": {
            "task": "worker.tasks.campaign_orchestrator.update_campaign_progress",
            "schedule": 60.0,
        },
        "intelligence-daily-report": {
            "task": "worker.tasks.intelligence_analytics.generate_executive_report",
            "schedule": 86400.0,
        },
        "intelligence-compute-scores": {
            "task": "worker.tasks.intelligence_analytics.compute_opportunity_scores",
            "schedule": 43200.0,
        },
        "intelligence-refresh-benchmarks": {
            "task": "worker.tasks.intelligence_analytics.refresh_benchmarks",
            "schedule": 86400.0,
        },
        "modules-compute-readiness": {
            "task": "worker.tasks.modules.compute_all_readiness_scores",
            "schedule": 43200.0,
        },
        "modules-negotiation-profiles": {
            "task": "worker.tasks.modules.generate_negotiation_profiles",
            "schedule": 86400.0,
        },
        "modules-nightly-improvement": {
            "task": "worker.tasks.modules.nightly_improvement_report",
            "schedule": crontab(hour=2, minute=0),
        },
        "modules-morning-briefing": {
            "task": "worker.tasks.modules.morning_executive_briefing",
            "schedule": crontab(hour=7, minute=0),
        },
        "modules-system-metrics": {
            "task": "worker.tasks.modules.collect_system_metrics",
            "schedule": 300.0,
        },
    }
)


@worker_ready.connect
def initialize_database(sender, **kwargs):
    """Initialize database tables when worker starts."""
    from worker.models.database import init_db
    init_db()
