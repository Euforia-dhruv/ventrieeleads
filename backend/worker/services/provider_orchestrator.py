"""Provider Orchestrator - intelligent provider selection with fallback."""
import logging
from typing import List, Dict
from datetime import datetime
from worker.models.database import get_db_context
from worker.models import ProviderMetrics

logger = logging.getLogger(__name__)


class ProviderOrchestrator:
    """Selects the best provider for a given location and handles fallback on failure."""

    def get_ranked_providers(self, country_code: str, preferred_providers: List[str]) -> List[str]:
        """Rank providers by success rate and latency for a given country."""
        if not preferred_providers:
            return []

        with get_db_context() as db:
            metrics = db.query(ProviderMetrics).filter(
                ProviderMetrics.country_code == country_code,
                ProviderMetrics.is_deleted == False
            ).all()

            metrics_map = {m.provider_slug: m for m in metrics}

            scored = []
            for slug in preferred_providers:
                m = metrics_map.get(slug)
                if m and m.total_requests > 0:
                    success_rate = m.successful_requests / max(m.total_requests, 1)
                    latency_score = max(0.0, 1.0 - (m.avg_latency_ms / 30000.0))
                    score = (success_rate * 0.7) + (latency_score * 0.3)
                    scored.append((slug, score))
                else:
                    scored.append((slug, 0.5))

            scored.sort(key=lambda x: x[1], reverse=True)
            return [s[0] for s in scored]

    def record_success(
        self, provider_slug: str, country_code: str,
        latency_ms: int, results_count: int, duplicates: int
    ):
        """Record a successful provider request and update running averages."""
        with get_db_context() as db:
            metrics = db.query(ProviderMetrics).filter(
                ProviderMetrics.provider_slug == provider_slug,
                ProviderMetrics.country_code == country_code,
                ProviderMetrics.is_deleted == False
            ).first()

            if not metrics:
                metrics = ProviderMetrics(
                    provider_slug=provider_slug,
                    country_code=country_code,
                )
                db.add(metrics)

            n = metrics.total_requests
            metrics.total_requests += 1
            metrics.successful_requests += 1
            metrics.avg_latency_ms = int((metrics.avg_latency_ms * n + latency_ms) / (n + 1))
            metrics.avg_results_per_request = round(
                (metrics.avg_results_per_request * n + results_count) / (n + 1), 2
            )
            if results_count > 0:
                dup_rate = duplicates / results_count
                metrics.duplicate_rate = round(
                    (metrics.duplicate_rate * n + dup_rate) / (n + 1), 4
                )
            metrics.last_used_at = datetime.utcnow()
            db.commit()

    def record_failure(self, provider_slug: str, country_code: str, error: str):
        """Record a failed provider request."""
        with get_db_context() as db:
            metrics = db.query(ProviderMetrics).filter(
                ProviderMetrics.provider_slug == provider_slug,
                ProviderMetrics.country_code == country_code,
                ProviderMetrics.is_deleted == False
            ).first()

            if not metrics:
                metrics = ProviderMetrics(
                    provider_slug=provider_slug,
                    country_code=country_code,
                )
                db.add(metrics)

            metrics.total_requests += 1
            metrics.failed_requests += 1
            metrics.last_error = str(error)[:500]
            metrics.last_used_at = datetime.utcnow()
            db.commit()

    def get_provider_health(self) -> List[Dict]:
        """Get aggregated health stats for all providers across all countries."""
        with get_db_context() as db:
            metrics = db.query(ProviderMetrics).filter(
                ProviderMetrics.is_deleted == False
            ).all()

            health: Dict[str, Dict] = {}
            for m in metrics:
                if m.provider_slug not in health:
                    health[m.provider_slug] = {
                        "provider": m.provider_slug,
                        "total_requests": 0,
                        "successful_requests": 0,
                        "failed_requests": 0,
                        "total_latency_ms": 0,
                        "total_results": 0.0,
                        "total_dup_rate": 0.0,
                        "countries": 0,
                        "last_used_at": None,
                        "last_error": None,
                    }
                h = health[m.provider_slug]
                h["total_requests"] += m.total_requests
                h["successful_requests"] += m.successful_requests
                h["failed_requests"] += m.failed_requests
                h["total_latency_ms"] += m.avg_latency_ms * m.total_requests
                h["total_results"] += m.avg_results_per_request
                h["total_dup_rate"] += m.duplicate_rate
                h["countries"] += 1
                if m.last_used_at and (not h["last_used_at"] or m.last_used_at > h["last_used_at"]):
                    h["last_used_at"] = m.last_used_at
                if m.last_error:
                    h["last_error"] = m.last_error

            result = []
            for h in health.values():
                c = max(h["countries"], 1)
                total = max(h["total_requests"], 1)
                result.append({
                    "provider": h["provider"],
                    "total_requests": h["total_requests"],
                    "successful_requests": h["successful_requests"],
                    "failed_requests": h["failed_requests"],
                    "success_rate": round(h["successful_requests"] / total, 3),
                    "avg_latency_ms": int(h["total_latency_ms"] / total),
                    "avg_results_per_request": round(h["total_results"] / c, 1),
                    "duplicate_rate": round(h["total_dup_rate"] / c, 4),
                    "countries_served": h["countries"],
                    "last_used_at": h["last_used_at"].isoformat() if h["last_used_at"] else None,
                    "last_error": h["last_error"],
                })

            return sorted(result, key=lambda x: x["success_rate"], reverse=True)

    def get_country_provider_matrix(self) -> List[Dict]:
        """Get provider performance per country for the coverage view."""
        with get_db_context() as db:
            metrics = db.query(ProviderMetrics).filter(
                ProviderMetrics.is_deleted == False
            ).order_by(ProviderMetrics.country_code).all()

            matrix = {}
            for m in metrics:
                key = m.country_code
                if key not in matrix:
                    matrix[key] = {"country_code": key, "providers": {}}
                total = max(m.total_requests, 1)
                matrix[key]["providers"][m.provider_slug] = {
                    "success_rate": round(m.successful_requests / total, 3),
                    "total_requests": m.total_requests,
                    "avg_latency_ms": m.avg_latency_ms,
                }

            return list(matrix.values())


provider_orchestrator = ProviderOrchestrator()
