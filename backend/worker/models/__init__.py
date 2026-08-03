"""SQLAlchemy models for the Ventriee Leads platform."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, Float, Text, Boolean, DateTime,
    ForeignKey, JSON, Index, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB
from sqlalchemy.orm import DeclarativeBase, relationship
import enum


class Base(DeclarativeBase):
    pass


class JobStatus(str, enum.Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class LeadScore(str, enum.Enum):
    HOT = "hot"
    WARM = "warm"
    COLD = "cold"


class BaseModel(Base):
    __abstract__ = True

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False, index=True)


class Workspace(BaseModel):
    __tablename__ = "workspaces"

    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text)
    settings = Column(JSONB, default=dict)

    users = relationship("User", back_populates="workspace")
    leads = relationship("Lead", back_populates="workspace")
    search_jobs = relationship("SearchJob", back_populates="workspace")
    tags = relationship("Tag", back_populates="workspace")


class User(BaseModel):
    __tablename__ = "users"

    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), default="user")
    is_active = Column(Boolean, default=True)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, index=True)

    workspace = relationship("Workspace", back_populates="users")


class Company(BaseModel):
    __tablename__ = "companies"

    name = Column(String(255), nullable=False)
    slug = Column(String(255), index=True)
    website = Column(String(500))
    description = Column(Text)
    industry = Column(String(100), index=True)
    city = Column(String(100), index=True)
    area = Column(String(100))
    country = Column(String(100), index=True)
    address = Column(Text)
    phone = Column(String(50))
    email = Column(String(255))
    logo_url = Column(Text)
    rating = Column(Float, default=0)
    review_count = Column(Integer, default=0)
    opening_hours = Column(JSONB, default=dict)
    latitude = Column(Float)
    longitude = Column(Float)
    google_maps_url = Column(Text)
    source = Column(String(100))
    screenshot_url = Column(Text)
    twitter = Column(String(500))
    tiktok = Column(String(500))
    snapchat = Column(String(500))
    founded_year = Column(Integer)
    employee_count = Column(Integer)
    extra_data = Column("metadata", JSONB, default=dict)
    provider_slug = Column(String(100), index=True)
    provider_raw_data = Column(JSONB, default=dict)
    is_monitored = Column(Boolean, default=False)
    last_monitored_at = Column(DateTime)

    __table_args__ = (
        Index("ix_companies_name_website", "name", "website"),
    )

    website_data = relationship("Website", back_populates="company", uselist=False)
    contacts = relationship("Contact", back_populates="company")
    technologies = relationship("Technology", back_populates="company")
    leads = relationship("Lead", back_populates="company")
    research = relationship("CompanyResearch", back_populates="company", uselist=False)
    competitor_analyses = relationship("CompetitorAnalysis", back_populates="company")
    monitoring_snapshots = relationship("MonitoringSnapshot", back_populates="company")


class Website(BaseModel):
    __tablename__ = "websites"

    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    url = Column(String(500), nullable=False)
    title = Column(String(500))
    description = Column(Text)
    logo_url = Column(Text)
    emails = Column(ARRAY(String), default=list)
    phone_numbers = Column(ARRAY(String), default=list)
    whatsapp = Column(String(255))
    instagram = Column(String(500))
    facebook = Column(String(500))
    linkedin = Column(String(500))
    youtube = Column(String(500))
    twitter = Column(String(500))
    tiktok = Column(String(500))
    about_content = Column(Text)
    privacy_policy_url = Column(Text)
    terms_url = Column(Text)
    contact_page = Column(Text)
    about_page = Column(Text)
    services = Column(JSONB, default=list)
    languages = Column(ARRAY(String), default=list)
    last_crawled = Column(DateTime)
    extra_data = Column("metadata", JSONB, default=dict)

    company = relationship("Company", back_populates="website_data")
    screenshots = relationship("Screenshot", back_populates="website")
    audits = relationship("Audit", back_populates="website")


class Contact(BaseModel):
    __tablename__ = "contacts"

    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    name = Column(String(255))
    title = Column(String(255))
    email = Column(String(255), index=True)
    phone = Column(String(50))
    linkedin = Column(String(500))
    is_primary = Column(Boolean, default=False)
    confidence = Column(Float, default=0)
    source = Column(String(100))
    department = Column(String(100))
    seniority = Column(String(50))
    extra_data = Column("metadata", JSONB, default=dict)

    company = relationship("Company", back_populates="contacts")


class Technology(BaseModel):
    __tablename__ = "technologies"

    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False, index=True)
    category = Column(String(100))
    version = Column(String(50))
    confidence = Column(Float, default=1.0)
    detected_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    company = relationship("Company", back_populates="technologies")

    __table_args__ = (
        Index("ix_technologies_company_name", "company_id", "name"),
    )


class Screenshot(BaseModel):
    __tablename__ = "screenshots"

    website_id = Column(UUID(as_uuid=True), ForeignKey("websites.id"), nullable=False, index=True)
    url = Column(String(500))
    device = Column(String(50))
    is_full_page = Column(Boolean, default=False)
    file_path = Column(Text)
    file_size = Column(Integer)
    width = Column(Integer)
    height = Column(Integer)
    extra_data = Column("metadata", JSONB, default=dict)

    website = relationship("Website", back_populates="screenshots")


class Audit(BaseModel):
    __tablename__ = "audits"

    website_id = Column(UUID(as_uuid=True), ForeignKey("websites.id"), nullable=False, index=True)
    website_score = Column(Integer, default=0)
    seo_score = Column(Integer, default=0)
    performance_score = Column(Integer, default=0)
    accessibility_score = Column(Integer, default=0)
    design_score = Column(Integer, default=0)
    branding_score = Column(Integer, default=0)
    conversion_score = Column(Integer, default=0)
    copywriting_score = Column(Integer, default=0)
    trust_score = Column(Integer, default=0)
    overall_score = Column(Integer, default=0)
    checks = Column(JSONB, default=dict)
    issues = Column(JSONB, default=list)
    strengths = Column(JSONB, default=list)
    weaknesses = Column(JSONB, default=list)
    quick_wins = Column(JSONB, default=list)
    estimated_redesign_budget = Column(String(100))
    recommended_services = Column(JSONB, default=list)
    raw_data = Column(JSONB, default=dict)

    website = relationship("Website", back_populates="audits")


class Lead(BaseModel):
    __tablename__ = "leads"

    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    status = Column(String(50), default="New", index=True)
    score = Column(Integer, default=0, index=True)
    score_label = Column(String(20))
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    notes = Column(Text)
    tags = Column(ARRAY(String), default=list)
    source = Column(String(100))
    priority = Column(String(20), default="medium")
    last_contacted_at = Column(DateTime)
    next_follow_up_at = Column(DateTime)
    extra_data = Column("metadata", JSONB, default=dict)

    workspace = relationship("Workspace", back_populates="leads")
    company = relationship("Company", back_populates="leads")
    activities = relationship("Activity", back_populates="lead")

    __table_args__ = (
        Index("ix_leads_workspace_status", "workspace_id", "status"),
        Index("ix_leads_workspace_score", "workspace_id", "score"),
        UniqueConstraint("workspace_id", "company_id", name="uq_workspace_company"),
    )


class Tag(BaseModel):
    __tablename__ = "tags"

    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    color = Column(String(7), default="#3B82F6")

    workspace = relationship("Workspace", back_populates="tags")

    __table_args__ = (
        UniqueConstraint("workspace_id", "name", name="uq_workspace_tag"),
    )


class Activity(BaseModel):
    __tablename__ = "activities"

    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action = Column(String(100), nullable=False, index=True)
    description = Column(Text)
    extra_data = Column("metadata", JSONB, default=dict)

    lead = relationship("Lead", back_populates="activities")


class SearchJob(BaseModel):
    __tablename__ = "search_jobs"

    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=True, index=True)
    query = Column(String(500), nullable=False)
    country = Column(String(100))
    city = Column(String(100))
    area = Column(String(100))
    industry = Column(String(100))
    keyword = Column(String(255))
    min_rating = Column(Float)
    min_reviews = Column(Integer)
    max_results = Column(Integer, default=50)
    status = Column(String(50), default=JobStatus.QUEUED.value, index=True)
    progress = Column(Integer, default=0)
    results_count = Column(Integer, default=0)
    error_message = Column(Text)
    celery_task_id = Column(String(255))
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    extra_data = Column("metadata", JSONB, default=dict)

    workspace = relationship("Workspace", back_populates="search_jobs")
    results = relationship("SearchResult", back_populates="search_job")


class SearchResult(BaseModel):
    __tablename__ = "search_results"

    search_job_id = Column(UUID(as_uuid=True), ForeignKey("search_jobs.id"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=True, index=True)
    source = Column(String(100))
    raw_data = Column(JSONB, default=dict)
    is_duplicate = Column(Boolean, default=False)
    processed = Column(Boolean, default=False)

    search_job = relationship("SearchJob", back_populates="results")


class ChangeHistory(BaseModel):
    __tablename__ = "change_history"

    entity_type = Column(String(50), nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    field_name = Column(String(100), nullable=False)
    old_value = Column(Text)
    new_value = Column(Text)
    change_source = Column(String(100))

    __table_args__ = (
        Index("ix_change_history_entity", "entity_type", "entity_id"),
    )


class ScheduledSearch(BaseModel):
    __tablename__ = "scheduled_searches"

    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    query = Column(String(500), nullable=False)
    country = Column(String(100))
    city = Column(String(100))
    area = Column(String(100))
    industry = Column(String(100))
    keyword = Column(String(255))
    min_rating = Column(Float)
    min_reviews = Column(Integer)
    max_results = Column(Integer, default=50)
    schedule_type = Column(String(50), default="daily")
    cron_expression = Column(String(100))
    is_active = Column(Boolean, default=True, index=True)
    last_run_at = Column(DateTime)
    next_run_at = Column(DateTime, index=True)
    total_runs = Column(Integer, default=0)
    last_results_count = Column(Integer, default=0)


class SearchPreset(BaseModel):
    __tablename__ = "search_presets"

    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False)
    description = Column(Text)
    industry = Column(String(100))
    city = Column(String(100))
    area = Column(String(100))
    country = Column(String(100))
    query_template = Column(String(500))
    icon = Column(String(50))
    sort_order = Column(Integer, default=0)
    is_builtin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)


class Notification(BaseModel):
    __tablename__ = "notifications"

    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=True, index=True)
    type = Column(String(100), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text)
    entity_type = Column(String(50))
    entity_id = Column(UUID(as_uuid=True))
    is_read = Column(Boolean, default=False, index=True)
    action_url = Column(Text)


class LeadTask(BaseModel):
    __tablename__ = "lead_tasks"

    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    status = Column(String(50), default="pending", index=True)
    priority = Column(String(20), default="medium")
    due_date = Column(DateTime, index=True)
    completed_at = Column(DateTime)

    lead = relationship("Lead", backref="tasks")


class CampaignLead(BaseModel):
    __tablename__ = "campaign_leads"

    campaign_id = Column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False, index=True)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=False, index=True)
    status = Column(String(50), default="added")
    notes = Column(Text)
    added_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("campaign_id", "lead_id", name="uq_campaign_lead"),
    )


class Opportunity(BaseModel):
    __tablename__ = "opportunities"

    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=False, index=True)
    website_redesign_min = Column(Integer, default=0)
    website_redesign_max = Column(Integer, default=0)
    seo_min = Column(Integer, default=0)
    seo_max = Column(Integer, default=0)
    branding_min = Column(Integer, default=0)
    branding_max = Column(Integer, default=0)
    performance_min = Column(Integer, default=0)
    performance_max = Column(Integer, default=0)
    booking_engine_min = Column(Integer, default=0)
    booking_engine_max = Column(Integer, default=0)
    ai_chatbot_min = Column(Integer, default=0)
    ai_chatbot_max = Column(Integer, default=0)
    analytics_min = Column(Integer, default=0)
    analytics_max = Column(Integer, default=0)
    maintenance_min = Column(Integer, default=0)
    maintenance_max = Column(Integer, default=0)
    total_min = Column(Integer, default=0)
    total_max = Column(Integer, default=0)
    confidence = Column(Float, default=0)
    recommended_services = Column(JSONB, default=list)
    priority = Column(String(20), default="medium")
    notes = Column(Text)

    lead = relationship("Lead", backref="opportunity")


class AdminSetting(BaseModel):
    __tablename__ = "admin_settings"

    key = Column(String(255), unique=True, nullable=False)
    value = Column(JSONB, default=dict)
    description = Column(Text)
    category = Column(String(100), default="general")


class ExportHistory(BaseModel):
    __tablename__ = "export_history"

    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=True, index=True)
    format = Column(String(50), nullable=False)
    filters = Column(JSONB, default=dict)
    record_count = Column(Integer, default=0)
    file_size = Column(Integer)


class Campaign(BaseModel):
    __tablename__ = "campaigns"

    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    status = Column(String(50), default="active")
    description = Column(Text)
    notes = Column(Text)
    industry_filter = Column(ARRAY(String), default=list)
    location_filter = Column(ARRAY(String), default=list)
    lead_score_min = Column(Integer, default=0)
    lead_score_max = Column(Integer, default=100)

    leads = relationship("CampaignLead", backref="campaign")


class CompanyResearch(BaseModel):
    __tablename__ = "company_research"

    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    business_summary = Column(Text)
    products = Column(JSONB, default=list)
    services = Column(JSONB, default=list)
    target_audience = Column(Text)
    business_type = Column(String(100))
    unique_selling_points = Column(JSONB, default=list)
    growth_indicators = Column(JSONB, default=list)
    likely_pain_points = Column(JSONB, default=list)
    website_weaknesses = Column(JSONB, default=list)
    recommended_services = Column(JSONB, default=list)
    sales_talking_points = Column(JSONB, default=list)
    priority = Column(String(20), default="medium")
    estimated_budget = Column(String(100))
    estimated_company_size = Column(String(50))
    confidence_score = Column(Float, default=0)
    ai_model = Column(String(100))
    raw_ai_response = Column(JSONB, default=dict)

    company = relationship("Company", back_populates="research")


class CompetitorAnalysis(BaseModel):
    __tablename__ = "competitor_analyses"

    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    competitor_name = Column(String(255), nullable=False)
    competitor_website = Column(String(500))
    competitor_industry = Column(String(100))
    competitor_location = Column(String(255))
    overall_comparison = Column(Text)
    strengths_vs_competitor = Column(JSONB, default=list)
    weaknesses_vs_competitor = Column(JSONB, default=list)
    market_position = Column(String(100))
    opportunity_gaps = Column(JSONB, default=list)
    pricing_comparison = Column(JSONB, default=dict)
    ai_model = Column(String(100))
    raw_ai_response = Column(JSONB, default=dict)

    company = relationship("Company", back_populates="competitor_analyses")


class RedesignPreview(BaseModel):
    __tablename__ = "redesign_previews"

    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    original_screenshot_url = Column(Text)
    preview_screenshot_url = Column(Text)
    redesign_style = Column(String(100))
    color_scheme = Column(JSONB, default=dict)
    changes_made = Column(JSONB, default=list)
    ai_model = Column(String(100))
    generation_cost = Column(Float, default=0)


class Proposal(BaseModel):
    __tablename__ = "proposals"

    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    status = Column(String(50), default="draft", index=True)
    services = Column(JSONB, default=list)
    total_amount_min = Column(Integer, default=0)
    total_amount_max = Column(Integer, default=0)
    currency = Column(String(10), default="USD")
    validity_days = Column(Integer, default=30)
    notes = Column(Text)
    generated_by_ai = Column(Boolean, default=False)
    ai_model = Column(String(100))
    pdf_path = Column(Text)
    sent_at = Column(DateTime)
    accepted_at = Column(DateTime)
    rejected_at = Column(DateTime)


class MonitoringSchedule(BaseModel):
    __tablename__ = "monitoring_schedules"

    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    check_interval_hours = Column(Integer, default=24)
    next_check_at = Column(DateTime, index=True)
    last_check_at = Column(DateTime)
    is_active = Column(Boolean, default=True)
    alert_on_changes = Column(Boolean, default=True)
    monitored_fields = Column(JSONB, default=list)

    company = relationship("Company", backref="monitoring_schedules")


class MonitoringSnapshot(BaseModel):
    __tablename__ = "monitoring_snapshots"

    schedule_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    overall_score = Column(Integer)
    seo_score = Column(Integer)
    performance_score = Column(Integer)
    technology_stack = Column(JSONB, default=list)
    review_count = Column(Integer)
    rating = Column(Float)
    changes_detected = Column(JSONB, default=list)
    snapshot_data = Column(JSONB, default=dict)

    company = relationship("Company", back_populates="monitoring_snapshots")


class Report(BaseModel):
    __tablename__ = "reports"

    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=True, index=True)
    title = Column(String(500), nullable=False)
    report_type = Column(String(100), nullable=False, index=True)
    status = Column(String(50), default="generating")
    data = Column(JSONB, default=dict)
    file_path = Column(Text)
    file_size = Column(Integer)
    period_start = Column(DateTime)
    period_end = Column(DateTime)
    generated_by_ai = Column(Boolean, default=False)
    ai_model = Column(String(100))
    sent_at = Column(DateTime)


class SearchAnalytics(BaseModel):
    __tablename__ = "search_analytics"

    search_job_id = Column(UUID(as_uuid=True), ForeignKey("search_jobs.id"), nullable=True, index=True)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=True, index=True)
    query = Column(String(500))
    provider = Column(String(100))
    results_count = Column(Integer, default=0)
    new_leads_count = Column(Integer, default=0)
    duplicates_count = Column(Integer, default=0)
    execution_time_ms = Column(Integer)
    filters_used = Column(JSONB, default=dict)


# ── Phase 6: Autonomous AI Agent Models ─────────────────────────────────────


class AgentState(BaseModel):
    __tablename__ = "agent_states"

    agent_name = Column(String(100), unique=True, nullable=False, index=True)
    status = Column(String(50), default="idle")
    goals = Column(JSONB, default=list)
    confidence = Column(Float, default=0.0)
    reasoning = Column(Text)
    last_run_at = Column(DateTime)
    next_scheduled_run_at = Column(DateTime)
    total_runs = Column(Integer, default=0)
    successful_runs = Column(Integer, default=0)
    failed_runs = Column(Integer, default=0)
    avg_duration_ms = Column(Integer, default=0)
    config = Column(JSONB, default=dict)
    is_enabled = Column(Boolean, default=True)


class AgentExecution(BaseModel):
    __tablename__ = "agent_executions"

    agent_name = Column(String(100), nullable=False, index=True)
    status = Column(String(50), default="running", index=True)
    trigger_type = Column(String(50), default="scheduled")
    trigger_data = Column(JSONB, default=dict)
    input_data = Column(JSONB, default=dict)
    output_data = Column(JSONB, default=dict)
    reasoning = Column(Text)
    confidence = Column(Float, default=0.0)
    items_processed = Column(Integer, default=0)
    items_created = Column(Integer, default=0)
    items_updated = Column(Integer, default=0)
    error_message = Column(Text)
    duration_ms = Column(Integer, default=0)
    retry_count = Column(Integer, default=0)
    completed_at = Column(DateTime)


class AgentMemory(BaseModel):
    __tablename__ = "agent_memory"

    agent_name = Column(String(100), nullable=False, index=True)
    memory_type = Column(String(50), nullable=False)
    entity_type = Column(String(50))
    entity_id = Column(UUID(as_uuid=True))
    content = Column(Text, nullable=False)
    embedding_vector = Column(JSONB)
    confidence = Column(Float, default=1.0)
    access_count = Column(Integer, default=0)
    last_accessed_at = Column(DateTime)
    expires_at = Column(DateTime)

    __table_args__ = (
        Index("ix_agent_memory_name_type", "agent_name", "memory_type"),
        Index("ix_agent_memory_entity", "entity_type", "entity_id"),
    )


class KnowledgeEdge(BaseModel):
    __tablename__ = "knowledge_edges"

    source_type = Column(String(50), nullable=False)
    source_id = Column(UUID(as_uuid=True), nullable=False)
    target_type = Column(String(50), nullable=False)
    target_id = Column(UUID(as_uuid=True), nullable=False)
    relationship = Column(String(100), nullable=False)
    weight = Column(Float, default=1.0)
    metadata_ = Column("metadata", JSONB, default=dict)

    __table_args__ = (
        Index("ix_knowledge_edges_source", "source_type", "source_id"),
        Index("ix_knowledge_edges_target", "target_type", "target_id"),
        Index("ix_knowledge_edges_relationship", "relationship"),
        UniqueConstraint("source_type", "source_id", "target_type", "target_id", "relationship",
                         name="uq_knowledge_edge"),
    )


class AgentEvent(BaseModel):
    __tablename__ = "agent_events"

    event_type = Column(String(100), nullable=False, index=True)
    source_agent = Column(String(100))
    target_agent = Column(String(100), index=True)
    payload = Column(JSONB, default=dict)
    status = Column(String(50), default="pending", index=True)
    processed_at = Column(DateTime)


class ExecutiveBriefing(BaseModel):
    __tablename__ = "executive_briefings"

    briefing_date = Column(DateTime, nullable=False, index=True)
    briefing_type = Column(String(50), default="morning")
    top_opportunities = Column(JSONB, default=list)
    website_changes = Column(JSONB, default=list)
    highest_value_prospects = Column(JSONB, default=list)
    growing_industries = Column(JSONB, default=list)
    active_cities = Column(JSONB, default=list)
    recommended_actions = Column(JSONB, default=list)
    summary = Column(Text)
    generated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_executive_briefings_date", "briefing_date", postgresql_using="btree"),
    )


class QualityMetric(BaseModel):
    __tablename__ = "quality_metrics"

    metric_type = Column(String(100), nullable=False, index=True)
    entity_type = Column(String(50))
    entity_id = Column(UUID(as_uuid=True))
    metric_name = Column(String(200), nullable=False, index=True)
    metric_value = Column(Float, nullable=False)
    baseline_value = Column(Float)
    extra_data = Column("metadata", JSONB, default=dict)


# ── Global Location & Industry Hierarchy ─────────────────────────────────────


class Location(BaseModel):
    __tablename__ = "locations"

    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False, index=True)
    location_type = Column(String(50), nullable=False, index=True)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=True, index=True)
    country_code = Column(String(10), index=True)
    latitude = Column(Float)
    longitude = Column(Float)
    timezone = Column(String(100))
    population = Column(Integer)
    gdp_usd = Column(Float)
    is_active = Column(Boolean, default=True, index=True)
    extra_data = Column("metadata", JSONB, default=dict)

    parent = relationship("Location", remote_side="Location.id", backref="children")

    __table_args__ = (
        Index("ix_locations_parent_type", "parent_id", "location_type"),
        Index("ix_locations_country_slug", "country_code", "slug"),
        UniqueConstraint("slug", "parent_id", name="uq_location_slug_parent"),
    )


class Industry(BaseModel):
    __tablename__ = "industries"

    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False, index=True)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("industries.id"), nullable=True, index=True)
    icon = Column(String(50))
    is_active = Column(Boolean, default=True, index=True)
    sort_order = Column(Integer, default=0)
    extra_data = Column("metadata", JSONB, default=dict)

    parent = relationship("Industry", remote_side="Industry.id", backref="children")

    __table_args__ = (
        UniqueConstraint("slug", "parent_id", name="uq_industry_slug_parent"),
    )


class DiscoveryCampaign(BaseModel):
    __tablename__ = "discovery_campaigns"

    name = Column(String(255), nullable=False)
    description = Column(Text)
    status = Column(String(50), default="draft", index=True)

    country_ids = Column(JSONB, default=list)
    state_ids = Column(JSONB, default=list)
    city_ids = Column(JSONB, default=list)
    industry_ids = Column(JSONB, default=list)
    provider_slugs = Column(JSONB, default=list)

    priority = Column(Integer, default=5)
    max_businesses_per_city = Column(Integer, default=50)
    max_total_businesses = Column(Integer, default=10000)
    concurrency = Column(Integer, default=5)

    schedule_type = Column(String(50), default="once")
    cron_expression = Column(String(100))
    next_run_at = Column(DateTime)
    last_run_at = Column(DateTime)

    total_jobs = Column(Integer, default=0)
    queued_jobs = Column(Integer, default=0)
    running_jobs = Column(Integer, default=0)
    completed_jobs = Column(Integer, default=0)
    failed_jobs = Column(Integer, default=0)
    skipped_jobs = Column(Integer, default=0)
    total_businesses = Column(Integer, default=0)
    unique_businesses = Column(Integer, default=0)
    duplicate_count = Column(Integer, default=0)

    ai_requests = Column(Integer, default=0)
    provider_requests = Column(Integer, default=0)
    browser_sessions = Column(Integer, default=0)
    estimated_cost_usd = Column(Float, default=0)

    jobs = relationship("CampaignJob", back_populates="campaign")


class CampaignJob(BaseModel):
    __tablename__ = "campaign_jobs"

    campaign_id = Column(UUID(as_uuid=True), ForeignKey("discovery_campaigns.id"), nullable=False, index=True)
    search_job_id = Column(UUID(as_uuid=True), ForeignKey("search_jobs.id"), nullable=True, index=True)

    location_id = Column(UUID(as_uuid=True), ForeignKey("locations.id"), nullable=True, index=True)
    industry_id = Column(UUID(as_uuid=True), ForeignKey("industries.id"), nullable=True, index=True)
    provider_slug = Column(String(100), index=True)

    country_code = Column(String(10), index=True)
    state_name = Column(String(255))
    city_name = Column(String(255))
    industry_name = Column(String(255))

    status = Column(String(50), default="queued", index=True)
    businesses_found = Column(Integer, default=0)
    duplicates_found = Column(Integer, default=0)
    new_businesses = Column(Integer, default=0)
    runtime_ms = Column(Integer)
    error_message = Column(Text)
    retry_count = Column(Integer, default=0)
    fallback_provider = Column(String(100))

    campaign = relationship("DiscoveryCampaign", back_populates="jobs")
    search_job = relationship("SearchJob")


class ProviderMetrics(BaseModel):
    __tablename__ = "provider_metrics"

    provider_slug = Column(String(100), nullable=False, index=True)
    country_code = Column(String(10), nullable=False, index=True)

    total_requests = Column(Integer, default=0)
    successful_requests = Column(Integer, default=0)
    failed_requests = Column(Integer, default=0)
    avg_latency_ms = Column(Integer, default=0)
    avg_results_per_request = Column(Float, default=0)
    duplicate_rate = Column(Float, default=0)
    estimated_cost_per_request = Column(Float, default=0)
    last_used_at = Column(DateTime)
    last_error = Column(Text)

    __table_args__ = (
        UniqueConstraint("provider_slug", "country_code", name="uq_provider_country"),
    )


# ── Intelligence Layer: Scores, Insights, Benchmarks, Reports ─────────────────


class CompanyIntelligenceScores(BaseModel):
    __tablename__ = "company_intelligence_scores"

    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    growth_score = Column(Float, default=0)
    digital_maturity_score = Column(Float, default=0)
    marketing_maturity = Column(Float, default=0)
    technology_maturity = Column(Float, default=0)
    branding_maturity = Column(Float, default=0)
    sales_readiness = Column(Float, default=0)
    ai_readiness = Column(Float, default=0)
    automation_readiness = Column(Float, default=0)
    expansion_potential = Column(Float, default=0)
    acquisition_probability = Column(Float, default=0)
    computed_at = Column(DateTime)

    __table_args__ = (
        Index("ix_ci_scores_company", "company_id"),
        Index("ix_ci_scores_computed", "computed_at"),
    )


class DiscoveryInsight(BaseModel):
    __tablename__ = "discovery_insights"

    insight_type = Column(String(100), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(UUID(as_uuid=True))
    entity_name = Column(String(255))
    score = Column(Float, default=0)
    confidence = Column(Float, default=0)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    reasoning = Column(Text)
    action_data = Column(JSONB, default=dict)
    priority = Column(Integer, default=5)
    is_dismissed = Column(Boolean, default=False)

    __table_args__ = (
        Index("ix_di_type_entity", "insight_type", "entity_type"),
        Index("ix_di_priority", "priority", "created_at"),
        Index("ix_di_active", "is_dismissed", "is_deleted"),
    )


class BenchmarkSnapshot(BaseModel):
    __tablename__ = "benchmark_snapshots"

    snapshot_type = Column(String(50), nullable=False)
    entity_id = Column(UUID(as_uuid=True))
    entity_name = Column(String(255))
    country_code = Column(String(10))
    avg_website_score = Column(Float, default=0)
    avg_seo_score = Column(Float, default=0)
    avg_design_score = Column(Float, default=0)
    avg_performance_score = Column(Float, default=0)
    avg_tech_age = Column(Float, default=0)
    avg_review_count = Column(Float, default=0)
    avg_rating = Column(Float, default=0)
    avg_opportunity_score = Column(Float, default=0)
    avg_project_value = Column(Float, default=0)
    total_companies = Column(Integer, default=0)
    total_leads = Column(Integer, default=0)
    total_audits = Column(Integer, default=0)
    period_start = Column(DateTime)
    period_end = Column(DateTime)

    __table_args__ = (
        Index("ix_bs_type", "snapshot_type"),
        Index("ix_bs_country", "country_code"),
        Index("ix_bs_period", "period_start"),
    )


class ExecutiveAiReport(BaseModel):
    __tablename__ = "executive_ai_reports"

    report_date = Column(DateTime, nullable=False)
    report_type = Column(String(100), nullable=False)
    title = Column(String(255), nullable=False)
    summary = Column(Text)
    content = Column(JSONB, default=dict)
    recommendations = Column(JSONB, default=list)
    top_opportunities = Column(JSONB, default=list)
    top_cities = Column(JSONB, default=list)
    top_industries = Column(JSONB, default=list)
    top_campaigns = Column(JSONB, default=list)
    top_providers = Column(JSONB, default=list)
    system_health = Column(JSONB, default=dict)
    economics = Column(JSONB, default=dict)

    __table_args__ = (
        Index("ix_eai_date", "report_date"),
        UniqueConstraint("report_date", "report_type", name="uq_eai_date_type"),
    )


# ── Module 1: AI Sales Pipeline ─────────────────────────────────────────────


class PipelineStage(BaseModel):
    __tablename__ = "pipeline_stages"

    name = Column(String(100), nullable=False, unique=True)
    slug = Column(String(100), nullable=False, unique=True)
    description = Column(Text)
    sort_order = Column(Integer, default=0)
    color = Column(String(20), default='#6B7280')
    icon = Column(String(50))
    is_active = Column(Boolean, default=True)
    auto_transition_rules = Column(JSONB, default=dict)


class LeadPipeline(BaseModel):
    __tablename__ = "lead_pipeline"

    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    stage_id = Column(UUID(as_uuid=True), ForeignKey("pipeline_stages.id"), nullable=False, index=True)
    assigned_agent = Column(String(100))
    confidence = Column(Float, default=0.5)
    estimated_value_min = Column(Integer, default=0)
    estimated_value_max = Column(Integer, default=0)
    probability = Column(Float, default=0)
    entered_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    exited_at = Column(DateTime)
    total_time_in_stage_ms = Column(Integer, default=0)
    extra_data = Column("metadata", JSONB, default=dict)

    lead = relationship("Lead", backref="pipeline_entries")
    company = relationship("Company", backref="pipeline_entries")
    stage = relationship("PipelineStage")
    events = relationship("PipelineEvent", back_populates="pipeline_entry")

    __table_args__ = (
        Index("ix_lp_active", "is_deleted", "stage_id", postgresql_where="is_deleted = FALSE"),
    )


class PipelineEvent(BaseModel):
    __tablename__ = "pipeline_events"

    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id"), nullable=False, index=True)
    pipeline_id = Column(UUID(as_uuid=True), ForeignKey("lead_pipeline.id"), nullable=False, index=True)
    from_stage_id = Column(UUID(as_uuid=True), ForeignKey("pipeline_stages.id"))
    to_stage_id = Column(UUID(as_uuid=True), ForeignKey("pipeline_stages.id"), nullable=False)
    agent_name = Column(String(100))
    reason = Column(Text)
    confidence = Column(Float, default=0.5)
    event_data = Column(JSONB, default=dict)

    pipeline_entry = relationship("LeadPipeline", back_populates="events")
    from_stage = relationship("PipelineStage", foreign_keys=[from_stage_id])
    to_stage = relationship("PipelineStage", foreign_keys=[to_stage_id])


# ── Module 4: Client Readiness Score ────────────────────────────────────────


class ClientReadinessScore(BaseModel):
    __tablename__ = "client_readiness_scores"

    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    budget_score = Column(Float, default=0)
    budget_reasoning = Column(Text)
    urgency_score = Column(Float, default=0)
    urgency_reasoning = Column(Text)
    growth_score = Column(Float, default=0)
    growth_reasoning = Column(Text)
    decision_maker_score = Column(Float, default=0)
    decision_maker_reasoning = Column(Text)
    digital_maturity = Column(Float, default=0)
    digital_maturity_reasoning = Column(Text)
    sales_readiness = Column(Float, default=0)
    sales_readiness_reasoning = Column(Text)
    ai_adoption = Column(Float, default=0)
    ai_adoption_reasoning = Column(Text)
    overall_readiness = Column(Float, default=0)
    recommended_action = Column(Text)
    recommended_outreach = Column(Text)
    recommended_proposal_type = Column(Text)
    recommended_pricing_range = Column(Text)
    follow_up_strategy = Column(Text)
    computed_at = Column(DateTime)

    company = relationship("Company", backref="readiness_scores")

    __table_args__ = (
        Index("ix_crs_overall", "overall_readiness"),
        Index("ix_crs_computed", "computed_at"),
    )


# ── Module 5: AI Negotiation Assistant ──────────────────────────────────────


class NegotiationProfile(BaseModel):
    __tablename__ = "negotiation_profiles"

    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id"), nullable=False, index=True)
    likely_objections = Column(JSONB, default=list)
    talking_points = Column(JSONB, default=list)
    pricing_strategy = Column(JSONB, default=dict)
    upsell_opportunities = Column(JSONB, default=list)
    cross_sell_opportunities = Column(JSONB, default=list)
    meeting_agenda = Column(JSONB, default=list)
    closing_strategy = Column(Text)
    competitor_weaknesses = Column(JSONB, default=list)
    recommended_services = Column(JSONB, default=list)
    ai_model = Column(String(100))
    raw_ai_response = Column(JSONB, default=dict)

    company = relationship("Company", backref="negotiation_profiles")


# ── Module 6: Learning Engine V2 ────────────────────────────────────────────


class LearningSignal(BaseModel):
    __tablename__ = "learning_signals"

    signal_type = Column(String(50), nullable=False)
    entity_type = Column(String(50), nullable=False)
    entity_id = Column(UUID(as_uuid=True))
    outcome = Column(String(50), nullable=False)
    feature_snapshot = Column(JSONB, default=dict)
    prediction = Column(JSONB, default=dict)
    actual_result = Column(JSONB, default=dict)
    error_margin = Column(Float, default=0)
    agent_name = Column(String(100))

    __table_args__ = (
        Index("ix_ls_type_entity", "signal_type", "entity_type"),
        Index("ix_ls_outcome", "outcome"),
        Index("ix_ls_created", "created_at"),
    )


class ModelPerformance(BaseModel):
    __tablename__ = "model_performance"

    model_name = Column(String(100), nullable=False)
    metric_name = Column(String(100), nullable=False)
    metric_value = Column(Float, nullable=False)
    sample_size = Column(Integer, default=0)
    period_start = Column(DateTime)
    period_end = Column(DateTime)
    extra_data = Column(JSONB, default=dict)

    __table_args__ = (
        Index("ix_mp_model", "model_name", "metric_name"),
    )


# ── Module 8: Intelligent Automation ────────────────────────────────────────


class AutomationRule(BaseModel):
    __tablename__ = "automation_rules"

    name = Column(String(255), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    trigger_event = Column(String(100), nullable=False)
    conditions = Column(JSONB, default=list)
    actions = Column(JSONB, default=list)
    cooldown_hours = Column(Integer, default=24)
    max_executions = Column(Integer, default=100)
    total_executions = Column(Integer, default=0)
    last_executed_at = Column(DateTime)
    priority = Column(Integer, default=5)


class AutomationExecution(BaseModel):
    __tablename__ = "automation_executions"

    rule_id = Column(UUID(as_uuid=True), ForeignKey("automation_rules.id"), nullable=False, index=True)
    trigger_event = Column(String(100), nullable=False)
    entity_type = Column(String(50))
    entity_id = Column(UUID(as_uuid=True))
    conditions_met = Column(JSONB, default=list)
    actions_executed = Column(JSONB, default=list)
    status = Column(String(50), default="success")
    error_message = Column(Text)
    execution_time_ms = Column(Integer, default=0)

    rule = relationship("AutomationRule", backref="executions")


# ── Module 9: Autonomous Improvement ────────────────────────────────────────


class ImprovementReport(BaseModel):
    __tablename__ = "improvement_reports"

    report_date = Column(DateTime, nullable=False)
    report_type = Column(String(100), nullable=False)
    system_health = Column(JSONB, default=dict)
    discovery_quality = Column(JSONB, default=dict)
    provider_quality = Column(JSONB, default=dict)
    queue_performance = Column(JSONB, default=dict)
    ai_accuracy = Column(JSONB, default=dict)
    cost_analysis = Column(JSONB, default=dict)
    recommendations = Column(JSONB, default=list)
    implemented_count = Column(Integer, default=0)

    __table_args__ = (
        UniqueConstraint("report_date", "report_type", name="uq_improvement_date_type"),
    )


# ── Module 11: Observability ────────────────────────────────────────────────


class SystemMetric(BaseModel):
    __tablename__ = "system_metrics"

    metric_category = Column(String(50), nullable=False)
    metric_name = Column(String(100), nullable=False)
    metric_value = Column(Float, nullable=False)
    metric_unit = Column(String(50))
    tags = Column(JSONB, default=dict)
    recorded_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        Index("ix_sm_category", "metric_category", "metric_name"),
        Index("ix_sm_recorded", "recorded_at"),
    )
