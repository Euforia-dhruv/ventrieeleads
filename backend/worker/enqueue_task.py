"""Helper to enqueue Celery tasks from external services (e.g., Node.js backend)."""
import sys
import json
import os
from celery import Celery

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")

app = Celery(
    "ventriee_leads",
    broker=REDIS_URL,
    backend=REDIS_URL,
)


def enqueue_task(task_name: str, args: list = None, kwargs: dict = None):
    """Send a Celery task using the proper protocol."""
    result = app.send_task(
        task_name,
        args=args or [],
        kwargs=kwargs or {},
    )
    print(json.dumps({"task_id": result.id, "status": "queued"}))
    return result.id


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: enqueue_task.py <task_name> [args_json] [kwargs_json]"}))
        sys.exit(1)

    task_name = sys.argv[1]
    args = json.loads(sys.argv[2]) if len(sys.argv) > 2 else []
    kwargs = json.loads(sys.argv[3]) if len(sys.argv) > 3 else {}

    enqueue_task(task_name, args, kwargs)
