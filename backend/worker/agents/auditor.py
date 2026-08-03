import logging
from typing import Any, Dict, List
from worker.agents.base import BaseAgent

logger = logging.getLogger(__name__)


class AuditorAgent(BaseAgent):
    """Generates website audits and detects improvements/regressions over time."""
    
    name = 'auditor'
    description = 'Website audit generation and change detection'
    version = '1.0.0'
    
    def get_goals(self) -> List[str]:
        return [
            'Audit every unprocessed company website',
            'Re-run audits when website changes detected',
            'Compare previous audits for improvements',
            'Detect regressions in website quality',
        ]
    
    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        from worker.models.database import SessionLocal
        from worker.models import Company, Website, Audit
        from worker.services.audit import audit_service
        
        session = SessionLocal()
        items_processed = 0
        items_created = 0
        items_updated = 0
        reasoning_parts = []
        
        try:
            config = context.get('config', {})
            max_per_run = config.get('max_per_run', 20)
            company_id = context.get('company_id')
            
            if company_id:
                companies = session.query(Company).filter(
                    Company.id == company_id,
                    Company.is_deleted == False,
                ).all()
            else:
                # Find companies with websites but no audit, or due for re-audit
                companies = session.query(Company).filter(
                    Company.is_deleted == False,
                    Company.website.isnot(None),
                    Company.website != '',
                ).order_by(Company.created_at.desc()).limit(max_per_run).all()
            
            reasoning_parts.append(f'Found {len(companies)} companies to audit')
            
            for company in companies:
                try:
                    if not company.website:
                        continue
                    
                    # Skip if audited recently (within 48 hours)
                    if self.has_already_done('audited', 'company', company.id, within_hours=48):
                        continue
                    
                    # Get or create website record
                    website = session.query(Website).filter(
                        Website.company_id == company.id,
                        Website.is_deleted == False,
                    ).first()
                    
                    if not website:
                        website = Website(
                            company_id=company.id,
                            url=company.website,
                        )
                        session.add(website)
                        session.flush()
                    
                    # Get previous audit for comparison
                    prev_audit = session.query(Audit).filter(
                        Audit.website_id == website.id,
                        Audit.is_deleted == False,
                    ).order_by(Audit.created_at.desc()).first()
                    
                    # Perform audit
                    audit_result = audit_service.perform_audit(website.url)
                    
                    if not audit_result:
                        reasoning_parts.append(f'{company.name}: Audit returned no results')
                        continue
                    
                    changes = []
                    
                    if prev_audit:
                        # Compare scores
                        score_fields = [
                            'overall_score', 'seo_score', 'performance_score',
                            'design_score', 'conversion_score', 'trust_score',
                        ]
                        for field in score_fields:
                            old_val = getattr(prev_audit, field, 0) or 0
                            new_val = audit_result.get(field, 0) or 0
                            delta = new_val - old_val
                            if abs(delta) >= 3:
                                direction = 'improved' if delta > 0 else 'regressed'
                                changes.append(f'{field}: {old_val} -> {new_val} ({direction})')
                        
                        # Update existing audit
                        for key, value in audit_result.items():
                            if hasattr(prev_audit, key):
                                setattr(prev_audit, key, value)
                        prev_audit.updated_at = __import__('datetime').datetime.utcnow()
                        items_updated += 1
                        audit_record = prev_audit
                    else:
                        # Create new audit
                        audit_record = Audit(
                            website_id=website.id,
                            website_score=audit_result.get('website_score', 0),
                            seo_score=audit_result.get('seo_score', 0),
                            performance_score=audit_result.get('performance_score', 0),
                            accessibility_score=audit_result.get('accessibility_score', 0),
                            design_score=audit_result.get('design_score', 0),
                            branding_score=audit_result.get('branding_score', 0),
                            conversion_score=audit_result.get('conversion_score', 0),
                            copywriting_score=audit_result.get('copywriting_score', 0),
                            trust_score=audit_result.get('trust_score', 0),
                            overall_score=audit_result.get('overall_score', 0),
                            checks=audit_result.get('checks', {}),
                            issues=audit_result.get('issues', []),
                            strengths=audit_result.get('strengths', []),
                            weaknesses=audit_result.get('weaknesses', []),
                            quick_wins=audit_result.get('quick_wins', []),
                            estimated_redesign_budget=audit_result.get('estimated_redesign_budget', ''),
                            recommended_services=audit_result.get('recommended_services', []),
                        )
                        session.add(audit_record)
                        items_created += 1
                    
                    session.flush()
                    
                    # Record memory
                    self.remember(
                        'audited',
                        f"Audited {company.name}: overall={audit_result.get('overall_score', 0)}/100",
                        entity_type='company', entity_id=company.id, confidence=0.9,
                    )
                    
                    # Link knowledge graph
                    self.link_entities('company', company.id, 'audit', audit_record.id, 'has_audit')
                    
                    items_processed += 1
                    changes_str = f' ({"; ".join(changes[:3])})' if changes else ''
                    reasoning_parts.append(
                        f'{company.name}: Score {audit_result.get("overall_score", 0)}/100{changes_str}'
                    )
                    
                except Exception as e:
                    logger.error(f'Audit failed for {company.name}: {e}')
                    reasoning_parts.append(f'{company.name}: Error - {str(e)[:100]}')
                    continue
            
            session.commit()
            
            # Publish events
            if items_created > 0:
                self.publish_event('audits.completed', {'count': items_created})
            
        finally:
            session.close()
        
        return {
            'items_processed': items_processed,
            'items_created': items_created,
            'items_updated': items_updated,
            'reasoning': ' | '.join(reasoning_parts),
            'confidence': self.calculate_confidence({
                'data_quality': 0.9,
                'completeness': min(1.0, items_processed / max(1, len(companies))) if companies else 0,
                'recency': 1.0,
            }),
        }


auditor_agent = AuditorAgent()
