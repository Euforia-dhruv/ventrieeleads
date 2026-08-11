"""CRM service - lead management, pipeline, tasks, notes."""
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from worker.models.database import get_db_context
from worker.models import (
    Lead, Contact, Activity, LeadTask, LeadPipeline,
    PipelineStage, PipelineEvent, Opportunity, Proposal,
)

logger = logging.getLogger(__name__)

DEFAULT_STAGES = [
    {"name": "New", "order": 0, "color": "#3b82f6"},
    {"name": "Qualified", "order": 1, "color": "#8b5cf6"},
    {"name": "Contacted", "order": 2, "color": "#f59e0b"},
    {"name": "Meeting", "order": 3, "color": "#10b981"},
    {"name": "Proposal", "order": 4, "color": "#6366f1"},
    {"name": "Won", "order": 5, "color": "#22c55e"},
    {"name": "Lost", "order": 6, "color": "#ef4444"},
]


class CRMService:
    """CRM operations for lead management."""

    def seed_pipeline_stages(self) -> None:
        """Create default pipeline stages if they don't exist."""
        with get_db_context() as db:
            existing = db.query(PipelineStage).count()
            if existing == 0:
                for stage in DEFAULT_STAGES:
                    db.add(PipelineStage(**stage))
                db.commit()
                logger.info(f"Seeded {len(DEFAULT_STAGES)} pipeline stages")

    def create_lead(self, data: Dict) -> Lead:
        """Create a new lead."""
        with get_db_context() as db:
            lead = Lead(**data)
            db.add(lead)
            db.flush()

            # Auto-assign to the first active pipeline stage
            stage = db.query(PipelineStage).filter(
                PipelineStage.is_active == True
            ).order_by(PipelineStage.sort_order.asc()).first()
            if stage:
                entry = LeadPipeline(lead_id=lead.id, company_id=lead.company_id, stage_id=stage.id)
                db.add(entry)
                db.flush()
                db.add(PipelineEvent(
                    lead_id=lead.id,
                    pipeline_id=entry.id,
                    from_stage_id=None,
                    to_stage_id=stage.id,
                    confidence=0.5,
                ))

            db.commit()
            return lead

    def update_lead(self, lead_id: str, data: Dict) -> Optional[Lead]:
        """Update a lead."""
        with get_db_context() as db:
            lead = db.query(Lead).filter(Lead.id == lead_id).first()
            if not lead:
                return None

            for key, value in data.items():
                if hasattr(lead, key):
                    setattr(lead, key, value)

            lead.updated_at = datetime.utcnow()
            db.commit()
            return lead

    def move_lead(self, lead_id: str, stage_name: str, notes: str = "") -> bool:
        """Move a lead to a new pipeline stage."""
        with get_db_context() as db:
            lead = db.query(Lead).filter(Lead.id == lead_id).first()
            if not lead:
                return False

            new_stage = db.query(PipelineStage).filter(PipelineStage.name == stage_name).first()
            if not new_stage:
                return False

            current = db.query(LeadPipeline).filter(LeadPipeline.lead_id == lead_id).first()
            from_stage = current.stage_id if current else None

            if current:
                current.stage_id = new_stage.id
                current.updated_at = datetime.utcnow()
            else:
                current = LeadPipeline(lead_id=lead_id, company_id=lead.company_id, stage_id=new_stage.id)
                db.add(current)
                db.flush()

            db.add(PipelineEvent(
                lead_id=lead_id,
                pipeline_id=current.id,
                from_stage_id=from_stage,
                to_stage_id=new_stage.id,
                confidence=0.5,
                reason=notes or None,
            ))

            lead.status = stage_name.lower()
            db.commit()
            return True

    def add_note(self, lead_id: str, content: str, user_id: str = None) -> Activity:
        """Add a note to a lead."""
        with get_db_context() as db:
            activity = Activity(
                lead_id=lead_id,
                action="note",
                description=content,
                user_id=user_id,
            )
            db.add(activity)
            db.commit()
            return activity

    def create_task(self, lead_id: str, title: str, due_date: datetime = None, assigned_to: str = None) -> LeadTask:
        """Create a task for a lead."""
        with get_db_context() as db:
            task = LeadTask(
                lead_id=lead_id,
                title=title,
                due_date=due_date or datetime.utcnow() + timedelta(days=3),
                assigned_to=assigned_to,
                status="pending",
            )
            db.add(task)
            db.commit()
            return task

    def complete_task(self, task_id: str) -> bool:
        """Mark a task as complete."""
        with get_db_context() as db:
            task = db.query(LeadTask).filter(LeadTask.id == task_id).first()
            if not task:
                return False
            task.status = "completed"
            task.completed_at = datetime.utcnow()
            db.commit()
            return True

    def get_pipeline(self) -> List[Dict]:
        """Get the full pipeline with leads in each stage."""
        with get_db_context() as db:
            stages = db.query(PipelineStage).order_by(PipelineStage.order).all()
            result = []

            for stage in stages:
                leads = db.query(Lead).join(LeadPipeline).filter(
                    LeadPipeline.stage_id == stage.id
                ).all()

                result.append({
                    "stage": stage.name,
                    "color": stage.color,
                    "count": len(leads),
                    "leads": [
                        {
                            "id": str(l.id),
                            "name": (l.company.name if l.company else None) or "Unknown",
                            "score": l.score or 0,
                            "status": l.status,
                            "industry": (l.company.industry if l.company else "") or "",
                            "city": (l.company.city if l.company else "") or "",
                            "created_at": l.created_at.isoformat() if l.created_at else None,
                        }
                        for l in leads
                    ],
                })

            return result

    def get_lead_activities(self, lead_id: str) -> List[Dict]:
        """Get all activities for a lead."""
        with get_db_context() as db:
            activities = db.query(Activity).filter(
                Activity.lead_id == lead_id
            ).order_by(Activity.created_at.desc()).all()

            return [
                {
                    "id": str(a.id),
                    "action": a.action,
                    "description": a.description,
                    "created_at": a.created_at.isoformat() if a.created_at else None,
                }
                for a in activities
            ]

    def get_lead_tasks(self, lead_id: str) -> List[Dict]:
        """Get all tasks for a lead."""
        with get_db_context() as db:
            tasks = db.query(LeadTask).filter(
                LeadTask.lead_id == lead_id
            ).order_by(LeadTask.due_date).all()

            return [
                {
                    "id": str(t.id),
                    "title": t.title,
                    "status": t.status,
                    "due_date": t.due_date.isoformat() if t.due_date else None,
                    "assigned_to": t.assigned_to,
                }
                for t in tasks
            ]

    def get_dashboard_stats(self) -> Dict:
        """Get CRM dashboard statistics."""
        with get_db_context() as db:
            from sqlalchemy import func

            total = db.query(Lead).count()
            hot = db.query(Lead).filter(Lead.score >= 70).count()
            warm = db.query(Lead).filter(Lead.score >= 40, Lead.score < 70).count()
            cold = db.query(Lead).filter(Lead.score < 40).count()

            pipeline = db.query(LeadPipeline).count()
            pending_tasks = db.query(LeadTask).filter(LeadTask.status == "pending").count()

            stages = db.query(PipelineStage).order_by(PipelineStage.order).all()
            stage_counts = {}
            for stage in stages:
                count = db.query(LeadPipeline).filter(LeadPipeline.stage_id == stage.id).count()
                stage_counts[stage.name] = count

            return {
                "total_leads": total,
                "hot_leads": hot,
                "warm_leads": warm,
                "cold_leads": cold,
                "total_in_pipeline": pipeline,
                "pending_tasks": pending_tasks,
                "stage_counts": stage_counts,
            }


crm_service = CRMService()
