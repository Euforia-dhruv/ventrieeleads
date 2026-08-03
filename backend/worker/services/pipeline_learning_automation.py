"""Learning Engine V2, Automation Engine, Pipeline, Observability - Modules 6,8,9,11."""
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional
from worker.models.database import get_db_context
from worker.models import (
    Company, Lead, Opportunity, Audit, Website,
    LeadPipeline, PipelineStage, PipelineEvent,
    LearningSignal, ModelPerformance,
    AutomationRule, AutomationExecution,
    ImprovementReport, SystemMetric,
    DiscoveryCampaign, CampaignJob, ProviderMetrics,
)

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════
# MODULE 1: SALES PIPELINE SERVICE
# ═══════════════════════════════════════════════════════════════════════════

class PipelineService:
    """Manage the AI Sales Pipeline lifecycle."""

    def get_stages(self) -> List[Dict]:
        with get_db_context() as db:
            stages = db.query(PipelineStage).filter(
                PipelineStage.is_deleted == False, PipelineStage.is_active == True
            ).order_by(PipelineStage.sort_order).all()
            return [{"id": str(s.id), "name": s.name, "slug": s.slug,
                     "color": s.color, "icon": s.icon, "sort_order": s.sort_order} for s in stages]

    def get_pipeline_overview(self) -> Dict:
        with get_db_context() as db:
            stages = db.query(PipelineStage).filter(
                PipelineStage.is_deleted == False, PipelineStage.is_active == True
            ).order_by(PipelineStage.sort_order).all()

            stage_data = []
            total_leads = 0
            total_value_min = 0
            total_value_max = 0
            for stage in stages:
                count = db.query(LeadPipeline).filter(
                    LeadPipeline.stage_id == stage.id,
                    LeadPipeline.is_deleted == False
                ).count()
                entries = db.query(LeadPipeline).filter(
                    LeadPipeline.stage_id == stage.id,
                    LeadPipeline.is_deleted == False
                ).all()
                value_min = sum(e.estimated_value_min or 0 for e in entries)
                value_max = sum(e.estimated_value_max or 0 for e in entries)
                avg_confidence = sum(e.confidence or 0 for e in entries) / max(len(entries), 1)
                total_leads += count
                total_value_min += value_min
                total_value_max += value_max
                stage_data.append({
                    "stage_id": str(stage.id), "stage_name": stage.name,
                    "slug": stage.slug, "color": stage.color, "icon": stage.icon,
                    "count": count, "value_min": value_min, "value_max": value_max,
                    "avg_confidence": round(avg_confidence, 2),
                })

            return {
                "stages": stage_data,
                "summary": {
                    "total_leads": total_leads,
                    "total_value_min": total_value_min,
                    "total_value_max": total_value_max,
                    "avg_probability": round(sum(s["avg_confidence"] for s in stage_data) / max(len(stage_data), 1), 2),
                },
            }

    def get_lead_pipeline(self, lead_id: str) -> Optional[Dict]:
        with get_db_context() as db:
            entry = db.query(LeadPipeline).filter(
                LeadPipeline.lead_id == lead_id,
                LeadPipeline.is_deleted == False
            ).first()
            if not entry:
                return None
            stage = db.query(PipelineStage).filter(PipelineStage.id == entry.stage_id).first()
            events = db.query(PipelineEvent).filter(
                PipelineEvent.lead_id == lead_id,
                PipelineEvent.is_deleted == False
            ).order_by(PipelineEvent.created_at).all()

            return {
                "id": str(entry.id),
                "lead_id": str(entry.lead_id),
                "company_id": str(entry.company_id),
                "stage": {"id": str(stage.id), "name": stage.name, "slug": stage.slug} if stage else None,
                "confidence": entry.confidence,
                "estimated_value_min": entry.estimated_value_min,
                "estimated_value_max": entry.estimated_value_max,
                "probability": entry.probability,
                "entered_at": entry.entered_at.isoformat() if entry.entered_at else None,
                "events": [{
                    "id": str(e.id),
                    "from_stage": e.from_stage_id,
                    "to_stage": e.to_stage_id,
                    "agent": e.agent_name,
                    "reason": e.reason,
                    "confidence": e.confidence,
                    "created_at": e.created_at.isoformat() if e.created_at else None,
                } for e in events],
            }

    def transition_lead(self, lead_id: str, to_stage_slug: str,
                        agent: str = None, reason: str = None,
                        confidence: float = 0.5) -> bool:
        with get_db_context() as db:
            entry = db.query(LeadPipeline).filter(
                LeadPipeline.lead_id == lead_id,
                LeadPipeline.is_deleted == False
            ).first()

            to_stage = db.query(PipelineStage).filter(
                PipelineStage.slug == to_stage_slug
            ).first()
            if not to_stage:
                return False

            if not entry:
                lead = db.query(Lead).filter(Lead.id == lead_id).first()
                if not lead:
                    return False
                entry = LeadPipeline(
                    lead_id=lead_id,
                    company_id=lead.company_id,
                    stage_id=to_stage.id,
                    assigned_agent=agent,
                    confidence=confidence,
                )
                db.add(entry)
                db.flush()

            from_stage_id = entry.stage_id
            if from_stage_id == to_stage.id:
                return True

            event = PipelineEvent(
                lead_id=lead_id,
                pipeline_id=entry.id,
                from_stage_id=from_stage_id,
                to_stage_id=to_stage.id,
                agent_name=agent,
                reason=reason,
                confidence=confidence,
            )
            db.add(event)

            entry.stage_id = to_stage.id
            entry.confidence = confidence
            entry.updated_at = datetime.now(timezone.utc)

            if to_stage.slug in ("won", "lost", "archived"):
                entry.exited_at = datetime.now(timezone.utc)

            db.commit()
            return True

    def get_pipeline_stats(self) -> Dict:
        with get_db_context() as db:
            total = db.query(LeadPipeline).filter(LeadPipeline.is_deleted == False).count()
            won = db.query(LeadPipeline).join(PipelineStage).filter(
                PipelineStage.slug == "won", LeadPipeline.is_deleted == False
            ).count()
            lost = db.query(LeadPipeline).join(PipelineStage).filter(
                PipelineStage.slug == "lost", LeadPipeline.is_deleted == False
            ).count()
            active = total - won - lost - db.query(LeadPipeline).join(PipelineStage).filter(
                PipelineStage.slug == "archived", LeadPipeline.is_deleted == False
            ).count()

            entries = db.query(LeadPipeline).filter(LeadPipeline.is_deleted == False).all()
            total_value_max = sum(e.estimated_value_max or 0 for e in entries)
            won_entries = [e for e in entries if e.estimated_value_max and e.stage_id and db.query(PipelineStage).filter(
                PipelineStage.id == e.stage_id, PipelineStage.slug == "won"
            ).first()]
            won_value = sum(e.estimated_value_max or 0 for e in won_entries)

            return {
                "total": total, "active": active, "won": won, "lost": lost,
                "win_rate": round(won / max(won + lost, 1) * 100, 1),
                "total_pipeline_value": total_value_max,
                "won_value": won_value,
            }


pipeline_service = PipelineService()


# ═══════════════════════════════════════════════════════════════════════════
# MODULE 6: LEARNING ENGINE V2
# ═══════════════════════════════════════════════════════════════════════════

class LearningEngineService:
    """Continuously learn from outcomes to improve predictions."""

    def record_signal(self, signal_type: str, entity_type: str,
                      entity_id: str, outcome: str,
                      feature_snapshot: dict = None,
                      prediction: dict = None,
                      actual_result: dict = None,
                      agent: str = None) -> str:
        with get_db_context() as db:
            signal = LearningSignal(
                signal_type=signal_type,
                entity_type=entity_type,
                entity_id=entity_id,
                outcome=outcome,
                feature_snapshot=feature_snapshot or {},
                prediction=prediction or {},
                actual_result=actual_result or {},
                error_margin=abs(
                    (prediction or {}).get("confidence", 0) -
                    (1 if outcome in ("won", "accepted", "replied") else 0)
                ),
                agent_name=agent,
            )
            db.add(signal)
            db.commit()
            return str(signal.id)

    def get_performance_metrics(self, days: int = 30) -> Dict:
        with get_db_context() as db:
            since = datetime.now(timezone.utc) - timedelta(days=days)
            signals = db.query(LearningSignal).filter(
                LearningSignal.created_at > since,
                LearningSignal.is_deleted == False
            ).all()

            by_type = {}
            for s in signals:
                key = s.signal_type
                if key not in by_type:
                    by_type[key] = {"total": 0, "positive": 0, "negative": 0, "avg_error": 0}
                by_type[key]["total"] += 1
                if s.outcome in ("won", "accepted", "replied", "completed"):
                    by_type[key]["positive"] += 1
                else:
                    by_type[key]["negative"] += 1
                by_type[key]["avg_error"] += s.error_margin

            for k in by_type:
                by_type[k]["accuracy"] = round(
                    by_type[k]["positive"] / max(by_type[k]["total"], 1) * 100, 1
                )
                by_type[k]["avg_error"] = round(
                    by_type[k]["avg_error"] / max(by_type[k]["total"], 1), 3
                )

            return {"period_days": days, "total_signals": len(signals), "by_type": by_type}

    def get_learning_insights(self) -> List[Dict]:
        with get_db_context() as db:
            signals = db.query(LearningSignal).filter(
                LearningSignal.is_deleted == False
            ).order_by(LearningSignal.created_at.desc()).limit(500).all()

            insights = []
            won = [s for s in signals if s.outcome in ("won", "accepted")]
            lost = [s for s in signals if s.outcome in ("lost", "rejected", "ignored")]

            if won and lost:
                won_features = {}
                lost_features = {}
                for s in won:
                    for k, v in (s.feature_snapshot or {}).items():
                        if k not in won_features:
                            won_features[k] = []
                        won_features[k].append(v)
                for s in lost:
                    for k, v in (s.feature_snapshot or {}).items():
                        if k not in lost_features:
                            lost_features[k] = []
                        lost_features[k].append(v)

                for key in set(list(won_features.keys()) + list(lost_features.keys())):
                    w_avg = sum(won_features.get(key, [0])) / max(len(won_features.get(key, [1])), 1)
                    l_avg = sum(lost_features.get(key, [0])) / max(len(lost_features.get(key, [1])), 1)
                    if abs(w_avg - l_avg) > 10:
                        insights.append({
                            "feature": key,
                            "winning_avg": round(w_avg, 1),
                            "losing_avg": round(l_avg, 1),
                            "insight": f"Winners average {round(w_avg, 1)} vs losers {round(l_avg, 1)} on {key}",
                        })

            return insights[:20]


learning_service = LearningEngineService()


# ═══════════════════════════════════════════════════════════════════════════
# MODULE 8: INTELLIGENT AUTOMATION
# ═══════════════════════════════════════════════════════════════════════════

class AutomationEngineService:
    """Rule-based intelligent automation."""

    def create_rule(self, name: str, trigger_event: str,
                    conditions: list, actions: list,
                    description: str = None,
                    cooldown_hours: int = 24,
                    max_executions: int = 100) -> Dict:
        with get_db_context() as db:
            rule = AutomationRule(
                name=name,
                description=description,
                trigger_event=trigger_event,
                conditions=conditions,
                actions=actions,
                cooldown_hours=cooldown_hours,
                max_executions=max_executions,
            )
            db.add(rule)
            db.commit()
            return {"id": str(rule.id), "name": rule.name, "status": "created"}

    def list_rules(self) -> List[Dict]:
        with get_db_context() as db:
            rules = db.query(AutomationRule).filter(
                AutomationRule.is_deleted == False
            ).order_by(AutomationRule.priority.desc()).all()
            return [{
                "id": str(r.id), "name": r.name, "description": r.description,
                "is_active": r.is_active, "trigger_event": r.trigger_event,
                "conditions": r.conditions, "actions": r.actions,
                "total_executions": r.total_executions,
                "last_executed_at": r.last_executed_at.isoformat() if r.last_executed_at else None,
                "priority": r.priority,
            } for r in rules]

    def evaluate_rule(self, rule_id: str, context: Dict) -> Dict:
        with get_db_context() as db:
            rule = db.query(AutomationRule).filter(
                AutomationRule.id == rule_id,
                AutomationRule.is_deleted == False
            ).first()
            if not rule or not rule.is_active:
                return {"executed": False, "reason": "Rule not found or inactive"}

            if rule.total_executions >= rule.max_executions:
                return {"executed": False, "reason": "Max executions reached"}

            if rule.last_executed_at:
                hours_since = (datetime.now(timezone.utc) - rule.last_executed_at.replace(tzinfo=timezone.utc)).total_seconds() / 3600
                if hours_since < rule.cooldown_hours:
                    return {"executed": False, "reason": f"Cooldown: {rule.cooldown_hours - hours_since:.1f}h remaining"}

            conditions_met = self._evaluate_conditions(rule.conditions, context)
            if not all(conditions_met):
                return {"executed": False, "reason": "Conditions not met", "conditions": conditions_met}

            actions_executed = self._execute_actions(rule.actions, context)

            execution = AutomationExecution(
                rule_id=rule.id,
                trigger_event=rule.trigger_event,
                entity_type=context.get("entity_type"),
                entity_id=context.get("entity_id"),
                conditions_met=conditions_met,
                actions_executed=actions_executed,
                status="success",
            )
            db.add(execution)

            rule.total_executions += 1
            rule.last_executed_at = datetime.now(timezone.utc)
            db.commit()

            return {
                "executed": True,
                "rule_name": rule.name,
                "conditions_met": conditions_met,
                "actions_executed": actions_executed,
            }

    def _evaluate_conditions(self, conditions: list, context: Dict) -> list:
        results = []
        for cond in conditions:
            field = cond.get("field", "")
            op = cond.get("operator", "==")
            value = cond.get("value")
            actual = context.get(field)
            try:
                if op == "==" and actual == value:
                    results.append(True)
                elif op == "!=" and actual != value:
                    results.append(True)
                elif op == ">" and actual is not None and float(actual) > float(value):
                    results.append(True)
                elif op == "<" and actual is not None and float(actual) < float(value):
                    results.append(True)
                elif op == ">=" and actual is not None and float(actual) >= float(value):
                    results.append(True)
                elif op == "<=" and actual is not None and float(actual) <= float(value):
                    results.append(True)
                elif op == "contains" and actual and str(value) in str(actual):
                    results.append(True)
                elif op == "not_empty" and actual:
                    results.append(True)
                else:
                    results.append(False)
            except (TypeError, ValueError):
                results.append(False)
        return results

    def _execute_actions(self, actions: list, context: Dict) -> list:
        executed = []
        for action in actions:
            action_type = action.get("type", "")
            executed.append({
                "type": action_type,
                "params": action.get("params", {}),
                "status": "queued",
            })
        return executed

    def get_executions(self, limit: int = 50) -> List[Dict]:
        with get_db_context() as db:
            execs = db.query(AutomationExecution).filter(
                AutomationExecution.is_deleted == False
            ).order_by(AutomationExecution.created_at.desc()).limit(limit).all()
            return [{
                "id": str(e.id), "rule_id": str(e.rule_id),
                "trigger_event": e.trigger_event,
                "entity_type": e.entity_type,
                "status": e.status,
                "actions_executed": e.actions_executed,
                "created_at": e.created_at.isoformat() if e.created_at else None,
            } for e in execs]

    def get_stats(self) -> Dict:
        with get_db_context() as db:
            total_rules = db.query(AutomationRule).filter(AutomationRule.is_deleted == False).count()
            active_rules = db.query(AutomationRule).filter(
                AutomationRule.is_deleted == False, AutomationRule.is_active == True
            ).count()
            total_execs = db.query(AutomationExecution).filter(
                AutomationExecution.is_deleted == False
            ).count()
            success_execs = db.query(AutomationExecution).filter(
                AutomationExecution.is_deleted == False,
                AutomationExecution.status == "success"
            ).count()
            return {
                "total_rules": total_rules, "active_rules": active_rules,
                "total_executions": total_execs, "success_rate": round(success_execs / max(total_execs, 1) * 100, 1),
            }


automation_service = AutomationEngineService()


# ═══════════════════════════════════════════════════════════════════════════
# MODULE 9: AUTONOMOUS IMPROVEMENT
# ═══════════════════════════════════════════════════════════════════════════

class ImprovementService:
    """Nightly self-improvement analysis."""

    def generate_nightly_report(self) -> Dict:
        with get_db_context() as db:
            now = datetime.now(timezone.utc)
            today = now.date()

            existing = db.query(ImprovementReport).filter(
                ImprovementReport.report_date == today,
                ImprovementReport.report_type == "nightly",
                ImprovementReport.is_deleted == False
            ).first()
            if existing:
                return {"status": "already_generated", "report_id": str(existing.id)}

            campaigns = db.query(DiscoveryCampaign).filter(
                DiscoveryCampaign.is_deleted == False
            ).all()
            total_completed = sum(c.completed_jobs or 0 for c in campaigns)
            total_failed = sum(c.failed_jobs or 0 for c in campaigns)
            total_cost = sum(c.estimated_cost_usd or 0 for c in campaigns)

            providers = db.query(ProviderMetrics).filter(
                ProviderMetrics.is_deleted == False
            ).all()
            provider_health = {}
            for p in providers:
                total = max(p.total_requests, 1)
                provider_health[p.provider_slug] = {
                    "success_rate": round(p.successful_requests / total * 100, 1),
                    "avg_latency": p.avg_latency_ms,
                    "countries": p.country_code,
                }

            system_health = {
                "campaigns": {
                    "total": len(campaigns),
                    "completed": total_completed,
                    "failed": total_failed,
                    "success_rate": round(total_completed / max(total_completed + total_failed, 1) * 100, 1),
                },
                "cost": {
                    "total_usd": round(total_cost, 2),
                    "per_business": round(total_cost / max(total_completed, 1), 4),
                },
            }

            recommendations = []
            if total_failed > total_completed * 0.2:
                recommendations.append({
                    "title": "High failure rate detected",
                    "description": f"Failure rate: {round(total_failed / max(total_completed + total_failed, 1) * 100)}%",
                    "priority": 9, "type": "reliability",
                })
            if total_cost > 0 and total_completed > 0:
                recommendations.append({
                    "title": f"Cost efficiency: ${round(total_cost / total_completed, 4)}/business",
                    "description": "Consider optimising provider selection for cost.",
                    "priority": 5, "type": "cost",
                })

            report = ImprovementReport(
                report_date=today,
                report_type="nightly",
                system_health=system_health,
                discovery_quality={"completed": total_completed, "failed": total_failed},
                provider_quality=provider_health,
                recommendations=recommendations,
            )
            db.add(report)
            db.commit()

            return {"status": "generated", "report_id": str(report.id), "recommendations": len(recommendations)}


improvement_service = ImprovementService()


# ═══════════════════════════════════════════════════════════════════════════
# MODULE 11: OBSERVABILITY
# ═══════════════════════════════════════════════════════════════════════════

class ObservabilityService:
    """System-wide observability and metrics."""

    def record_metric(self, category: str, name: str, value: float,
                      unit: str = None, tags: dict = None):
        with get_db_context() as db:
            metric = SystemMetric(
                metric_category=category,
                metric_name=name,
                metric_value=value,
                metric_unit=unit,
                tags=tags or {},
            )
            db.add(metric)
            db.commit()

    def get_system_overview(self) -> Dict:
        with get_db_context() as db:
            from worker.models import Company, SearchJob

            now = datetime.now(timezone.utc)
            hour_ago = now - timedelta(hours=1)
            day_ago = now - timedelta(days=1)

            total_companies = db.query(Company).filter(Company.is_deleted == False).count()
            total_leads = db.query(Lead).filter(Lead.is_deleted == False).count()
            active_searches = db.query(SearchJob).filter(
                SearchJob.status.in_(["queued", "running"])
            ).count()

            recent_campaigns = db.query(CampaignJob).filter(
                CampaignJob.created_at > day_ago,
                CampaignJob.is_deleted == False
            ).count()
            recent_completed = db.query(CampaignJob).filter(
                CampaignJob.created_at > day_ago,
                CampaignJob.status == "completed",
                CampaignJob.is_deleted == False
            ).count()
            recent_failed = db.query(CampaignJob).filter(
                CampaignJob.created_at > day_ago,
                CampaignJob.status == "failed",
                CampaignJob.is_deleted == False
            ).count()

            total_opportunities = db.query(Opportunity).filter(
                Opportunity.is_deleted == False
            ).count() if hasattr(Opportunity, 'is_deleted') else 0

            pipeline = pipeline_service.get_pipeline_stats()

            return {
                "timestamp": now.isoformat(),
                "data": {
                    "total_companies": total_companies,
                    "total_leads": total_leads,
                    "active_searches": active_searches,
                    "total_opportunities": total_opportunities,
                },
                "last_24h": {
                    "campaign_jobs": recent_campaigns,
                    "completed": recent_completed,
                    "failed": recent_failed,
                    "success_rate": round(recent_completed / max(recent_completed + recent_failed, 1) * 100, 1),
                },
                "pipeline": pipeline,
            }

    def get_metrics_history(self, category: str = None, hours: int = 24) -> List[Dict]:
        with get_db_context() as db:
            since = datetime.now(timezone.utc) - timedelta(hours=hours)
            q = db.query(SystemMetric).filter(SystemMetric.recorded_at > since)
            if category:
                q = q.filter(SystemMetric.metric_category == category)
            metrics = q.order_by(SystemMetric.recorded_at.desc()).limit(500).all()
            return [{
                "category": m.metric_category, "name": m.metric_name,
                "value": m.metric_value, "unit": m.metric_unit,
                "tags": m.tags, "recorded_at": m.recorded_at.isoformat(),
            } for m in metrics]


observability_service = ObservabilityService()
