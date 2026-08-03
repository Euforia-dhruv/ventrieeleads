import logging
from typing import Any, Dict, List
from worker.agents.base import BaseAgent

logger = logging.getLogger(__name__)


class ScoutAgent(BaseAgent):
    """Continuously discovers businesses across configured industries and cities."""
    
    name = 'scout'
    description = 'Discovers new businesses from directory providers'
    version = '1.0.0'
    
    def get_goals(self) -> List[str]:
        return [
            'Discover new businesses in configured industries',
            'Monitor configured cities and areas',
            'Detect recently launched websites',
            'Auto-enqueue discoveries for processing',
        ]
    
    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        from worker.models.database import SessionLocal
        from worker.models import Company, ScheduledSearch, SearchJob, AdminSetting
        from worker.providers.registry import registry
        from uuid import uuid4
        
        session = SessionLocal()
        items_processed = 0
        items_created = 0
        reasoning_parts = []
        
        try:
            # Get agent config
            config = context.get('config', {})
            industries = config.get('industries', ['Real Estate', 'Technology', 'Healthcare'])
            cities = config.get('cities', [])
            max_per_city = config.get('max_per_city', 20)
            providers = config.get('providers', ['google_maps'])
            
            # Also check active scheduled searches
            scheduled = session.query(ScheduledSearch).filter(
                ScheduledSearch.is_active == True,
            ).all()
            
            searches_to_run = []
            
            # Add configured industry/city combos
            for industry in industries:
                for city in cities:
                    searches_to_run.append({
                        'industry': industry, 'city': city,
                        'query': f'{industry} in {city}',
                        'source': 'scout_agent',
                    })
            
            # Add scheduled searches
            for s in scheduled:
                searches_to_run.append({
                    'industry': s.industry, 'city': s.city,
                    'query': s.query, 'area': s.area,
                    'keyword': s.keyword, 'country': s.country,
                    'min_rating': s.min_rating, 'min_reviews': s.min_reviews,
                    'max_results': s.max_results,
                    'source': 'scheduled_search',
                    'scheduled_id': str(s.id),
                })
            
            reasoning_parts.append(f'Planning {len(searches_to_run)} discovery searches')
            
            # Check what companies already exist (for dedup awareness)
            existing_names = set()
            existing_companies = session.query(Company.name).filter(
                Company.is_deleted == False
            ).all()
            for c in existing_companies:
                existing_names.add(c.name.lower().strip())
            
            reasoning_parts.append(f'{len(existing_names)} existing companies in database')
            
            # Initialize providers
            enabled_slugs = registry.list_enabled_slugs()
            provider_slugs = [p for p in providers if p in enabled_slugs]
            if not provider_slugs:
                provider_slugs = enabled_slugs[:1]
            
            new_companies = []
            
            for search_config in searches_to_run[:10]:  # Limit per run
                try:
                    industry = search_config.get('industry', '')
                    city = search_config.get('city', '')
                    query = search_config.get('query', f'{industry} {city}')
                    location = ' '.join(filter(None, [
                        search_config.get('area', ''),
                        city,
                        search_config.get('country', ''),
                    ]))
                    
                    for provider_slug in provider_slugs:
                        try:
                            results = registry.search_single(
                                provider_slug,
                                query=query,
                                location=location,
                                max_results=min(max_per_city, search_config.get('max_results', 20)),
                                min_rating=search_config.get('min_rating', 0),
                                min_reviews=search_config.get('min_reviews', 0),
                            )
                            
                            for lead in results:
                                items_processed += 1
                                name_lower = lead.name.lower().strip()
                                
                                if name_lower in existing_names:
                                    continue
                                
                                # Create new company
                                company = Company(
                                    name=lead.name,
                                    website=lead.website or '',
                                    industry=lead.industry or industry,
                                    city=lead.city or city,
                                    area=lead.area or '',
                                    country=lead.country or '',
                                    address=lead.address or '',
                                    phone=lead.phone or '',
                                    email=lead.email or '',
                                    logo_url=lead.logo_url or '',
                                    rating=lead.rating or 0,
                                    review_count=lead.review_count or 0,
                                    description=lead.description or '',
                                    latitude=lead.latitude,
                                    longitude=lead.longitude,
                                    google_maps_url=lead.google_maps_url or '',
                                    source=provider_slug,
                                    provider_slug=provider_slug,
                                    provider_raw_data=lead.raw_data or {},
                                )
                                session.add(company)
                                session.flush()
                                
                                existing_names.add(name_lower)
                                new_companies.append({
                                    'id': str(company.id),
                                    'name': company.name,
                                    'website': company.website,
                                })
                                items_created += 1
                                
                                # Link knowledge graph
                                self.link_entities(
                                    'company', company.id,
                                    'industry', None,
                                    'operates_in',
                                    metadata={'industry': industry}
                                )
                                self.link_entities(
                                    'company', company.id,
                                    'city', None,
                                    'located_in',
                                    metadata={'city': city}
                                )
                                
                        except Exception as e:
                            logger.warning(f'Scout search failed for {provider_slug}: {e}')
                            continue
                            
                except Exception as e:
                    logger.warning(f'Scout search config failed: {e}')
                    continue
            
            session.commit()
            
            # Publish event for manager
            if new_companies:
                self.publish_event('companies.discovered', {
                    'count': len(new_companies),
                    'companies': new_companies[:10],
                })
            
            reasoning_parts.append(
                f'Discovered {items_created} new companies from {items_processed} results'
            )
            
            # Track quality
            if items_processed > 0:
                dup_rate = 1.0 - (items_created / items_processed)
                self.track_quality('discovery_rate', 1.0 - dup_rate,
                                   metadata={'total': items_processed, 'new': items_created})
            
        finally:
            session.close()
        
        return {
            'items_processed': items_processed,
            'items_created': items_created,
            'items_updated': 0,
            'reasoning': ' | '.join(reasoning_parts),
            'confidence': self.calculate_confidence({
                'data_quality': 0.8,
                'completeness': min(1.0, items_created / 10) if items_created else 0.1,
                'sample_size': min(1.0, items_processed / 50),
            }),
        }


scout_agent = ScoutAgent()
