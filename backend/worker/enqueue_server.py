"""Minimal HTTP server to enqueue Celery tasks from the Node.js backend."""
import json
import os
import sys
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
from celery import Celery

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger("enqueue_server")

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379")

app = Celery(
    "ventriee_leads",
    broker=REDIS_URL,
    backend=REDIS_URL,
)


def send_json(handler, status, data):
    response = json.dumps(data)
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.end_headers()
    handler.wfile.write(response.encode())


class TaskHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_POST(self):
        try:
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            data = json.loads(body) if body else {}
        except (json.JSONDecodeError, ValueError) as e:
            logger.error(f"Invalid JSON: {e}")
            send_json(self, 400, {"error": "Invalid JSON", "status": "failed"})
            return

        parsed = urlparse(self.path)
        path = parsed.path

        try:
            if path == "/search":
                job_id = data.get("job_id")
                if not job_id:
                    send_json(self, 400, {"error": "job_id is required", "status": "failed"})
                    return
                task_name = "worker.tasks.search.discover_businesses"
                kwargs = {"job_id": job_id}
                queue = "search"

            elif path == "/process":
                company_id = data.get("company_id")
                if not company_id:
                    send_json(self, 400, {"error": "company_id is required", "status": "failed"})
                    return
                task_name = "worker.tasks.process.process_company"
                kwargs = {"company_id": company_id}
                queue = "process"

            elif path == "/audit":
                company_id = data.get("company_id")
                if not company_id:
                    send_json(self, 400, {"error": "company_id is required", "status": "failed"})
                    return
                task_name = "worker.tasks.audit.audit_website"
                kwargs = {"company_id": company_id}
                queue = "audit"

            elif path == "/research":
                company_id = data.get("company_id")
                if not company_id:
                    send_json(self, 400, {"error": "company_id is required", "status": "failed"})
                    return
                task_name = "worker.tasks.research.research_company"
                kwargs = {"company_id": company_id}
                queue = "research"

            elif path == "/competitor-analysis":
                company_id = data.get("company_id")
                if not company_id:
                    send_json(self, 400, {"error": "company_id is required", "status": "failed"})
                    return
                task_name = "worker.tasks.research.analyze_competitors"
                kwargs = {"company_id": company_id}
                queue = "research"

            elif path == "/monitoring":
                company_id = data.get("company_id")
                if not company_id:
                    send_json(self, 400, {"error": "company_id is required", "status": "failed"})
                    return
                task_name = "worker.tasks.monitor.start_monitoring"
                kwargs = {
                    "company_id": company_id,
                    "interval_hours": data.get("interval_hours", 24),
                }
                queue = "process"

            elif path == "/monitoring/check":
                company_id = data.get("company_id")
                if not company_id:
                    send_json(self, 400, {"error": "company_id is required", "status": "failed"})
                    return
                task_name = "worker.tasks.monitor.check_company"
                kwargs = {"company_id": company_id}
                queue = "process"

            elif path == "/report":
                report_type = data.get("report_type")
                if not report_type:
                    send_json(self, 400, {"error": "report_type is required", "status": "failed"})
                    return
                task_name = "worker.tasks.research.generate_report"
                kwargs = {
                    "report_type": report_type,
                    "period_start": data.get("period_start"),
                    "period_end": data.get("period_end"),
                    "filters": data.get("filters", {}),
                }
                queue = "research"

            elif path == "/agent":
                agent_name = data.get("agent_name")
                if not agent_name:
                    send_json(self, 400, {"error": "agent_name is required", "status": "failed"})
                    return
                task_name = "worker.tasks.agents.run_agent"
                kwargs = {"agent_name": agent_name, "context": data.get("context", {})}
                queue = "process"

            elif path == "/agent/all":
                task_name = "worker.tasks.agents.run_all_agents"
                kwargs = {"context": data.get("context", {})}
                queue = "process"

            elif path == "/agent/briefing":
                task_name = "worker.tasks.agents.generate_briefing"
                kwargs = {}
                queue = "process"

            elif path == "/intelligence/search":
                query_text = data.get("query")
                if not query_text:
                    send_json(self, 400, {"error": "query is required", "status": "failed"})
                    return
                task_name = "worker.tasks.intelligence.intelligent_search"
                kwargs = {"query": query_text}
                queue = "search"

            elif path == "/outreach":
                company_id = data.get("company_id")
                channel = data.get("channel", "cold_email")
                if not company_id:
                    send_json(self, 400, {"error": "company_id is required", "status": "failed"})
                    return
                try:
                    from worker.models.database import get_db_context
                    from worker.models import Company, Website, Audit, Technology, Lead
                    from worker.services.sales_assistant import sales_assistant
                    import asyncio

                    with get_db_context() as db:
                        company = db.query(Company).filter(Company.id == company_id).first()
                        if not company:
                            send_json(self, 404, {"error": "Company not found", "status": "failed"})
                            return

                        website = db.query(Website).filter(Website.company_id == company_id).first()
                        audit = db.query(Audit).filter(Audit.website_id == website.id).first() if website else None
                        lead = db.query(Lead).filter(Lead.company_id == company_id).first()

                        issues = []
                        if audit:
                            raw_issues = audit.weaknesses or []
                            issues = [i if isinstance(i, str) else i.get("title", str(i)) for i in raw_issues[:5]]
                        if not issues:
                            issues = ["outdated website", "poor online presence"]

                        company_data = {
                            "name": company.name,
                            "industry": company.industry or "",
                            "city": company.city or "",
                            "website": company.website or "",
                            "phone": company.phone or "",
                            "email": company.email or "",
                            "rating": company.rating or 0,
                            "review_count": company.review_count or 0,
                        }

                    if channel == "cold_email":
                        result = asyncio.run(sales_assistant.generate_cold_email(
                            company_name=company_data["name"],
                            industry=company_data["industry"],
                            issues=issues,
                        ))
                    elif channel == "linkedin":
                        result = asyncio.run(sales_assistant.generate_linkedin_message(
                            company_name=company_data["name"],
                            industry=company_data["industry"],
                            issues=issues,
                        ))
                    elif channel == "whatsapp":
                        msg = asyncio.run(sales_assistant.generate_whatsapp_message(
                            company_name=company_data["name"],
                            industry=company_data["industry"],
                            issues=issues,
                        ))
                        result = {"message": msg}
                    elif channel == "instagram":
                        msg = asyncio.run(sales_assistant.generate_whatsapp_message(
                            company_name=company_data["name"],
                            industry=company_data["industry"],
                            issues=issues,
                        ))
                        result = {"message": msg}
                    else:
                        result = {"error": f"Unknown channel: {channel}"}

                    result["company"] = company_data
                    result["channel"] = channel
                    result["issues_used"] = issues
                    send_json(self, 200, {"status": "ok", "data": result})

                except Exception as e:
                    logger.error(f"Outreach generation failed: {e}", exc_info=True)
                    send_json(self, 500, {"error": str(e), "status": "failed"})
                return

            elif path == "/enqueue":
                task_name = data.get("task")
                if not task_name:
                    send_json(self, 400, {"error": "task is required", "status": "failed"})
                    return
                args = data.get("args", [])
                kwargs = data.get("kwargs", {})
                queue = data.get("queue", "process")

            else:
                send_json(self, 404, {"error": f"Unknown endpoint: {path}", "status": "failed"})
                return

            result = app.send_task(
                task_name,
                args=args if path == "/enqueue" else [],
                kwargs=kwargs,
                queue=queue,
            )

            logger.info(f"Enqueued {task_name} -> {result.id}")
            send_json(self, 200, {"task_id": result.id, "status": "queued"})

        except Exception as e:
            logger.error(f"Failed to enqueue task: {e}", exc_info=True)
            send_json(self, 500, {"error": str(e), "status": "failed"})

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/health":
            send_json(self, 200, {"status": "ok"})
        else:
            send_json(self, 404, {"error": "Not found"})

    def log_message(self, format, *args):
        logger.info(f"{self.client_address[0]} - {format % args}")


if __name__ == "__main__":
    port = int(os.getenv("PORT", "8002"))
    server = HTTPServer(("0.0.0.0", port), TaskHandler)
    logger.info(f"Task enqueuer listening on port {port}")
    server.serve_forever()
