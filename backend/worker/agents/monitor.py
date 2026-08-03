import logging
from typing import Any, Dict, List
from worker.agents.base import BaseAgent

logger = logging.getLogger(__name__)


class MonitorAgent(BaseAgent):
    """Watches websites, reviews, and technologies for changes. Auto-triggers research/audit on change."""

    name = 'monitor'
    description = 'Change detection and automatic response'
    version = '1.0.0'

    def get_goals(self) -> List[str]:
        return [
            'Watch monitored companies for changes',
            'Detect website, review, and technology changes',
            'Auto-trigger research on significant changes',
            'Auto-trigger re-audit on website changes',
            'Re-score leads when data changes',
        ]

    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        from worker.models.database import SessionLocal
        from worker.models import (
            Company, MonitoringSchedule, MonitoringSnapshot, Audit,
            Technology, Notification, Lead, Website
        )

        session = SessionLocal()
        items_processed = 0
        items_created = 0
        items_updated = 0
        reasoning_parts = []

        try:
            config = context.get('config', {})
            company_id = context.get('company_id')

            if company_id:
                schedules = session.query(MonitoringSchedule).filter(
                    MonitoringSchedule.company_id == company_id,
                    MonitoringSchedule.is_active == True,
                    MonitoringSchedule.is_deleted == False,
                ).all()
            else:
                from datetime import datetime
                schedules = session.query(MonitoringSchedule).filter(
                    MonitoringSchedule.is_active == True,
                    MonitoringSchedule.is_deleted == False,
                    MonitoringSchedule.next_check_at <= datetime.utcnow(),
                ).all()

            reasoning_parts.append(f'Processing {len(schedules)} monitoring schedules')

            for schedule in schedules:
                try:
                    company = session.query(Company).filter(
                        Company.id == schedule.company_id,
                        Company.is_deleted == False,
                    ).first()
                    if not company:
                        continue

                    # Get current state
                    website = session.query(Website).filter(
                        Website.company_id == company.id,
                        Website.is_deleted == False,
                    ).first()

                    current_audit = None
                    if website:
                        current_audit = session.query(Audit).filter(
                            Audit.website_id == website.id,
                            Audit.is_deleted == False,
                        ).order_by(Audit.created_at.desc()).first()

                    techs = session.query(Technology).filter(
                        Technology.company_id == company.id,
                        Technology.is_deleted == False,
                    ).all()

                    # Get previous snapshot
                    prev_snapshot = session.query(MonitoringSnapshot).filter(
                        MonitoringSnapshot.company_id == company.id,
                    ).order_by(MonitoringSnapshot.created_at.desc()).first()

                    # Build current snapshot data
                    current_data = {
                        'overall_score': current_audit.overall_score if current_audit else 0,
                        'seo_score': current_audit.seo_score if current_audit else 0,
                        'performance_score': current_audit.performance_score if current_audit else 0,
                        'technology_stack': [t.name for t in techs],
                        'review_count': company.review_count or 0,
                        'rating': float(company.rating or 0),
                    }

                    # Detect changes
                    changes = []
                    if prev_snapshot:
                        # Score changes
                        for field in ['overall_score', 'seo_score', 'performance_score']:
                            old = getattr(prev_snapshot, field, 0) or 0
                            new = current_data[field]
                            if abs(new - old) >= 3:
                                changes.append({
                                    'type': 'score_change',
                                    'field': field,
                                    'old': old, 'new': new,
                                    'delta': new - old,
                                })

                        # Technology changes
                        old_techs = set(prev_snapshot.technology_stack or [])
                        new_techs = set(current_data['technology_stack'])
                        added = new_techs - old_techs
                        removed = old_techs - new_techs
                        if added or removed:
                            changes.append({
                                'type': 'technology_change',
                                'added': list(added),
                                'removed': list(removed),
                            })

                        # Review changes
                        old_reviews = prev_snapshot.review_count or 0
                        new_reviews = current_data['review_count']
                        if abs(new_reviews - old_reviews) >= 5:
                            changes.append({
                                'type': 'review_change',
                                'old': old_reviews,
                                'new': new_reviews,
                                'delta': new_reviews - old_reviews,
                            })

                    # Create snapshot
                    snapshot = MonitoringSnapshot(
                        schedule_id=schedule.id,
                        company_id=company.id,
                        overall_score=current_data['overall_score'],
                        seo_score=current_data['seo_score'],
                        performance_score=current_data['performance_score'],
                        technology_stack=current_data['technology_stack'],
                        review_count=current_data['review_count'],
                        rating=current_data['rating'],
                        changes_detected=changes,
                        snapshot_data=current_data,
                    )
                    session.add(snapshot)

                    # Update schedule
                    from datetime import datetime, timedelta
                    schedule.last_check_at = datetime.utcnow()
                    schedule.next_check_at = datetime.utcnow() + timedelta(hours=schedule.check_interval_hours or 24)

                    company.is_monitored = True
                    company.last_monitored_at = datetime.utcnow()

                    items_processed += 1
                    items_created += 1

                    if changes:
                        items_updated += len(changes)

                        # Create notification
                        change_summary = '; '.join(
                            f'{c["type"]}: {c.get("field", "")} {c.get("old", "")} -> {c.get("new", "")}'
                            for c in changes[:3]
                        )
                        notification = Notification(
                            workspace_id=None,
                            type='monitoring_change',
                            title=f'Changes detected: {company.name}',
                            message=change_summary,
                            entity_type='company',
                            entity_id=company.id,
                            action_url=f'/companies/{company.id}',
                        )
                        session.add(notification)

                        # Auto-trigger re-audit on score changes
                        has_score_change = any(c['type'] == 'score_change' for c in changes)
                        has_tech_change = any(c['type'] == 'technology_change' for c in changes)

                        if has_score_change or has_tech_change:
                            self.publish_event('company.changed', {
                                'company_id': str(company.id),
                                'changes': changes,
                                'trigger_research': True,
                                'trigger_audit': has_score_change,
                            }, target_agent='manager')

                        reasoning_parts.append(f'{company.name}: {len(changes)} changes detected')
                    else:
                        reasoning_parts.append(f'{company.name}: No changes')

                except Exception as e:
                    logger.error(f'Monitoring failed for schedule: {e}')
                    reasoning_parts.append(f'Error: {str(e)[:100]}')
                    continue

            session.commit()

        finally:
            session.close()

        return {
            'items_processed': items_processed,
            'items_created': items_created,
            'items_updated': items_updated,
            'reasoning': ' | '.join(reasoning_parts),
            'confidence': self.calculate_confidence({
                'data_quality': 0.85,
                'completeness': min(1.0, items_processed / max(1, len(schedules))) if schedules else 0,
                'recency': 1.0,
            }),
        }


monitor_agent = MonitorAgent()
