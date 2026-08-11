"""
Base Agent Framework for Ventriee Leads Autonomous AI System.

Every agent inherits from BaseAgent and gets:
- Memory (read/write/query)
- Goals (define, track, achieve)
- Confidence scoring
- Reasoning (explain decisions)
- Execution history
- Retry logic
- Event publishing
"""

import time
import json
import traceback
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

logger = logging.getLogger(__name__)


class AgentEvent:
    """Event published by agents for inter-agent communication."""

    def __init__(self, event_type: str, source_agent: str, payload: dict,
                 target_agent: str = None):
        self.id = str(uuid4())
        self.event_type = event_type
        self.source_agent = source_agent
        self.target_agent = target_agent
        self.payload = payload
        self.status = 'pending'
        self.created_at = datetime.utcnow()

    def to_dict(self) -> dict:
        return {
            'id': self.id,
            'event_type': self.event_type,
            'source_agent': self.source_agent,
            'target_agent': self.target_agent,
            'payload': self.payload,
            'status': self.status,
            'created_at': self.created_at.isoformat(),
        }


class BaseAgent(ABC):
    """
    Base class for all autonomous agents.

    Subclasses must implement:
    - execute(context) -> dict  (the main work)
    - get_goals() -> list       (what this agent tries to achieve)
    """

    name: str = 'base'
    description: str = 'Base agent'
    version: str = '1.0.0'

    def __init__(self):
        self._db = None
        self._ai_client = None
        self._events: List[AgentEvent] = []
        self._execution_id = None
        self._start_time = None

    @property
    def db(self):
        if self._db is None:
            from worker.models.database import SessionLocal
            self._db = SessionLocal()
        return self._db

    @property
    def ai(self):
        if self._ai_client is None:
            from worker.services.ai_client import ai_client
            self._ai_client = ai_client
        return self._ai_client

    def close(self):
        if self._db:
            try:
                self._db.close()
            except Exception:
                pass
            self._db = None

    # ── Abstract methods ──────────────────────────────────────────────

    @abstractmethod
    def execute(self, context: Dict[str, Any]) -> Dict[str, Any]:
        """Main agent work. Returns result dict."""
        pass

    @abstractmethod
    def get_goals(self) -> List[str]:
        """List of goals this agent pursues."""
        pass

    # ── Memory ────────────────────────────────────────────────────────

    def remember(self, memory_type: str, content: str,
                 entity_type: str = None, entity_id=None,
                 confidence: float = 1.0, expires_in_hours: int = None):
        """Store a memory."""
        from worker.models import AgentMemory
        expires_at = None
        if expires_in_hours:
            expires_at = datetime.utcnow() + timedelta(hours=expires_in_hours)

        memory = AgentMemory(
            agent_name=self.name,
            memory_type=memory_type,
            entity_type=entity_type,
            entity_id=entity_id,
            content=content,
            confidence=confidence,
            expires_at=expires_at,
        )
        self.db.add(memory)
        self.db.commit()
        return memory.id

    def recall(self, memory_type: str = None, entity_type: str = None,
               entity_id=None, limit: int = 10) -> List[dict]:
        """Retrieve memories."""
        from worker.models import AgentMemory
        q = self.db.query(AgentMemory).filter(
            AgentMemory.agent_name == self.name,
            AgentMemory.expires_at.is_(None) | (AgentMemory.expires_at > datetime.utcnow())
        )
        if memory_type:
            q = q.filter(AgentMemory.memory_type == memory_type)
        if entity_type:
            q = q.filter(AgentMemory.entity_type == entity_type)
        if entity_id:
            q = q.filter(AgentMemory.entity_id == entity_id)
        q = q.order_by(AgentMemory.created_at.desc()).limit(limit)
        results = []
        for m in q.all():
            m.access_count += 1
            m.last_accessed_at = datetime.utcnow()
            results.append({
                'id': str(m.id), 'type': m.memory_type, 'content': m.content,
                'entity_type': m.entity_type, 'entity_id': str(m.entity_id) if m.entity_id else None,
                'confidence': m.confidence, 'created_at': m.created_at.isoformat(),
            })
        self.db.commit()
        return results

    def forget(self, memory_id: str):
        """Delete a memory."""
        from worker.models import AgentMemory
        m = self.db.query(AgentMemory).filter(AgentMemory.id == memory_id).first()
        if m:
            self.db.delete(m)
            self.db.commit()

    def has_already_done(self, action: str, entity_type: str,
                         entity_id, within_hours: int = 24) -> bool:
        """Check if this agent already performed an action on an entity recently."""
        from worker.models import AgentMemory
        since = datetime.utcnow() - timedelta(hours=within_hours)
        count = self.db.query(AgentMemory).filter(
            AgentMemory.agent_name == self.name,
            AgentMemory.memory_type == action,
            AgentMemory.entity_type == entity_type,
            AgentMemory.entity_id == entity_id,
            AgentMemory.created_at > since,
        ).count()
        return count > 0

    # ── Knowledge Graph ───────────────────────────────────────────────

    def link_entities(self, source_type: str, source_id,
                      target_type: str, target_id,
                      relationship: str, weight: float = 1.0,
                      metadata: dict = None):
        """Create or update a knowledge graph edge."""
        if source_id is None or target_id is None:
            return
        from worker.models import KnowledgeEdge
        existing = self.db.query(KnowledgeEdge).filter(
            KnowledgeEdge.source_type == source_type,
            KnowledgeEdge.source_id == source_id,
            KnowledgeEdge.target_type == target_type,
            KnowledgeEdge.target_id == target_id,
            KnowledgeEdge.relationship == relationship,
        ).first()
        if existing:
            existing.weight = weight
            if metadata:
                existing.metadata = metadata
        else:
            edge = KnowledgeEdge(
                source_type=source_type, source_id=source_id,
                target_type=target_type, target_id=target_id,
                relationship=relationship, weight=weight,
                metadata=metadata or {},
            )
            self.db.add(edge)
        self.db.commit()

    def query_graph(self, entity_type: str = None, entity_id=None,
                    relationship: str = None, direction: str = 'outgoing',
                    limit: int = 50) -> List[dict]:
        """Query the knowledge graph."""
        from worker.models import KnowledgeEdge
        q = self.db.query(KnowledgeEdge)
        if direction == 'outgoing':
            if entity_type:
                q = q.filter(KnowledgeEdge.source_type == entity_type)
            if entity_id:
                q = q.filter(KnowledgeEdge.source_id == entity_id)
        else:
            if entity_type:
                q = q.filter(KnowledgeEdge.target_type == entity_type)
            if entity_id:
                q = q.filter(KnowledgeEdge.target_id == entity_id)
        if relationship:
            q = q.filter(KnowledgeEdge.relationship == relationship)
        edges = q.order_by(KnowledgeEdge.weight.desc()).limit(limit).all()
        return [{
            'source': {'type': e.source_type, 'id': str(e.source_id)},
            'target': {'type': e.target_type, 'id': str(e.target_id)},
            'relationship': e.relationship, 'weight': e.weight,
        } for e in edges]

    # ── Events ────────────────────────────────────────────────────────

    def publish_event(self, event_type: str, payload: dict,
                      target_agent: str = None):
        """Publish an event for other agents."""
        event = AgentEvent(event_type, self.name, payload, target_agent)
        self._events.append(event)
        # Store in DB
        from worker.models import AgentEvent as AgentEventModel
        db_event = AgentEventModel(
            event_type=event_type,
            source_agent=self.name,
            target_agent=target_agent,
            payload=payload,
        )
        self.db.add(db_event)
        self.db.commit()
        return event

    def get_pending_events(self, target_agent: str = None,
                           event_type: str = None) -> List[dict]:
        """Get pending events for this agent."""
        from worker.models import AgentEvent as AgentEventModel
        q = self.db.query(AgentEventModel).filter(
            AgentEventModel.status == 'pending'
        )
        if target_agent:
            q = q.filter(
                (AgentEventModel.target_agent == target_agent) |
                (AgentEventModel.target_agent.is_(None))
            )
        if event_type:
            q = q.filter(AgentEventModel.event_type == event_type)
        events = q.order_by(AgentEventModel.created_at.asc()).limit(100).all()
        return [{
            'id': str(e.id), 'type': e.event_type, 'source': e.source_agent,
            'payload': e.payload, 'created_at': e.created_at.isoformat(),
        } for e in events]

    def mark_event_processed(self, event_id: str):
        """Mark an event as processed."""
        from worker.models import AgentEvent as AgentEventModel
        e = self.db.query(AgentEventModel).filter(AgentEventModel.id == event_id).first()
        if e:
            e.status = 'processed'
            e.processed_at = datetime.utcnow()
            self.db.commit()

    # ── Confidence & Reasoning ────────────────────────────────────────

    def calculate_confidence(self, factors: Dict[str, float]) -> float:
        """Calculate confidence from multiple factors (0.0 - 1.0)."""
        if not factors:
            return 0.0
        weights = {
            'data_quality': 0.25,
            'completeness': 0.20,
            'recency': 0.15,
            'consistency': 0.15,
            'source_reliability': 0.15,
            'sample_size': 0.10,
        }
        total = 0.0
        total_weight = 0.0
        for factor, value in factors.items():
            w = weights.get(factor, 0.1)
            total += min(1.0, max(0.0, value)) * w
            total_weight += w
        return round(total / total_weight if total_weight > 0 else 0.0, 3)

    # ── Quality Tracking ──────────────────────────────────────────────

    def track_quality(self, metric_name: str, value: float,
                      entity_type: str = None, entity_id=None,
                      baseline: float = None, metadata: dict = None):
        """Track a quality metric for self-improvement."""
        from worker.models import QualityMetric
        metric = QualityMetric(
            metric_type=self.name,
            entity_type=entity_type,
            entity_id=entity_id,
            metric_name=metric_name,
            metric_value=value,
            baseline_value=baseline,
            metadata=metadata or {},
        )
        self.db.add(metric)
        self.db.commit()

    # ── State Management ──────────────────────────────────────────────

    def get_state(self) -> dict:
        """Get this agent's current state."""
        from worker.models import AgentState
        state = self.db.query(AgentState).filter(
            AgentState.agent_name == self.name
        ).first()
        if not state:
            return {}
        return {
            'status': state.status,
            'goals': state.goals,
            'confidence': state.confidence,
            'reasoning': state.reasoning,
            'total_runs': state.total_runs,
            'successful_runs': state.successful_runs,
            'failed_runs': state.failed_runs,
            'avg_duration_ms': state.avg_duration_ms,
            'last_run_at': state.last_run_at.isoformat() if state.last_run_at else None,
        }

    def update_state(self, status: str = None, reasoning: str = None,
                     confidence: float = None, goals: list = None):
        """Update this agent's state, creating the row if it doesn't exist yet."""
        from worker.models import AgentState
        state = self.db.query(AgentState).filter(
            AgentState.agent_name == self.name
        ).first()
        if not state:
            state = AgentState(
                agent_name=self.name,
                status=status or 'idle',
                goals=goals or self.get_goals(),
                confidence=confidence or 0.0,
                reasoning=reasoning or '',
            )
            self.db.add(state)
            self.db.commit()
            return
        if status:
            state.status = status
        if reasoning:
            state.reasoning = reasoning
        if confidence is not None:
            state.confidence = confidence
        if goals is not None:
            state.goals = goals
        state.updated_at = datetime.utcnow()
        self.db.commit()

    # ── Main Execution ────────────────────────────────────────────────

    def run(self, context: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Execute the agent with full lifecycle management.

        Returns:
            {
                'success': bool,
                'agent': str,
                'execution_id': str,
                'duration_ms': int,
                'items_processed': int,
                'items_created': int,
                'items_updated': int,
                'reasoning': str,
                'confidence': float,
                'events': list,
                'error': str | None,
            }
        """
        context = context or {}
        self._execution_id = str(uuid4())
        self._start_time = time.time()
        self._events = []

        result = {
            'success': False,
            'agent': self.name,
            'execution_id': self._execution_id,
            'duration_ms': 0,
            'items_processed': 0,
            'items_created': 0,
            'items_updated': 0,
            'reasoning': '',
            'confidence': 0.0,
            'events': [],
            'error': None,
        }

        try:
            self.update_state(status='running')
            logger.info(f'[{self.name}] Starting execution {self._execution_id}')

            output = self.execute(context)

            result.update({
                'success': True,
                'items_processed': output.get('items_processed', 0),
                'items_created': output.get('items_created', 0),
                'items_updated': output.get('items_updated', 0),
                'reasoning': output.get('reasoning', ''),
                'confidence': output.get('confidence', 0.0),
            })

            self.update_state(
                status='idle',
                reasoning=result['reasoning'],
                confidence=result['confidence'],
            )

            logger.info(
                f'[{self.name}] Completed in {result["duration_ms"]}ms - '
                f'processed={result["items_processed"]}, '
                f'created={result["items_created"]}, '
                f'updated={result["items_updated"]}'
            )

        except Exception as e:
            result['error'] = str(e)
            result['reasoning'] = f'Error: {str(e)}\n{traceback.format_exc()}'
            self.update_state(status='error', reasoning=result['reasoning'])
            logger.error(f'[{self.name}] Execution failed: {e}', exc_info=True)

        finally:
            elapsed = int((time.time() - self._start_time) * 1000)
            result['duration_ms'] = elapsed
            result['events'] = [e.to_dict() for e in self._events]

            self._record_execution(result)
            self._update_stats(result)
            self.close()

        return result

    def _record_execution(self, result: dict):
        """Record this execution in history."""
        try:
            from worker.models import AgentExecution
            execution = AgentExecution(
                agent_name=self.name,
                status='completed' if result['success'] else 'failed',
                input_data=result.get('input_data', {}),
                output_data={
                    'items_processed': result['items_processed'],
                    'items_created': result['items_created'],
                    'items_updated': result['items_updated'],
                },
                reasoning=result['reasoning'],
                confidence=result['confidence'],
                items_processed=result['items_processed'],
                items_created=result['items_created'],
                items_updated=result['items_updated'],
                error_message=result.get('error'),
                duration_ms=result['duration_ms'],
            )
            self.db.add(execution)
            self.db.commit()
        except Exception as e:
            logger.error(f'[{self.name}] Failed to record execution: {e}')

    def _update_stats(self, result: dict):
        """Update agent state statistics."""
        try:
            from worker.models import AgentState
            state = self.db.query(AgentState).filter(
                AgentState.agent_name == self.name
            ).first()
            if state:
                state.total_runs += 1
                state.last_run_at = datetime.utcnow()
                if result['success']:
                    state.successful_runs += 1
                else:
                    state.failed_runs += 1
                total = state.total_runs
                state.avg_duration_ms = int(
                    (state.avg_duration_ms * (total - 1) + result['duration_ms']) / total
                )
                state.updated_at = datetime.utcnow()
                self.db.commit()
        except Exception as e:
            logger.error(f'[{self.name}] Failed to update stats: {e}')
