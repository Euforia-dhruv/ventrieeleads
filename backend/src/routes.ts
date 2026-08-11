import express, { Router } from 'express';
import { authenticate, requireRole } from './middleware/auth';
import {
  register,
  login,
  logout,
  logoutAll,
  me,
  refreshToken,
  forgotPassword,
  resetPassword,
  changePassword,
  verifyEmail,
  sendVerificationEmail,
  requestMagicLink,
  verifyMagicLink,
  getSessions,
  revokeSession,
  updateProfile,
  oauthCallback,
  googleAuth,
  googleCallback,
} from './controllers/authController';
import { listApiKeys, createApiKey, revokeApiKey } from './controllers/apiKeyController';
import {
  listLeads,
  getLead,
  addLead,
  updateLeadHandler,
  deleteLeadHandler,
  leadStats,
} from './controllers/leadController';
import {
  listCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  addLeadToCampaign,
  removeLeadFromCampaign,
  getCampaignLeads,
} from './controllers/campaignController';
import { createSearchJob, listSearchJobs, getSearchJob, cancelSearchJob } from './controllers/searchController';
import {
  getCompanyContacts,
  getCompanyTechnologies,
  getCompanyAudit,
  enrichCompany,
  getCompanyDetail,
} from './controllers/companyController';
import { exportLeads, getExportHistory } from './controllers/exportController';
import {
  listScheduledSearches,
  createScheduledSearch,
  updateScheduledSearch,
  deleteScheduledSearch,
  runScheduledSearchNow,
} from './controllers/scheduledSearchController';
import {
  getChangeHistory,
  getLeadTimeline,
  getLeadTasks,
  createLeadTask,
  updateLeadTask,
  addLeadNote,
} from './controllers/crmController';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
} from './controllers/notificationController';
import { listPresets, createPreset, deletePreset } from './controllers/presetController';
import { listSettings, updateSetting } from './controllers/adminController';
import {
  listAdminUsers,
  updateUserRole,
  softDeleteUser,
  listWorkspaces,
  updateWorkspace,
  getProviderConfigs,
  updateProviderConfig,
  getQueueStatus,
  getWorkerDetails,
  getStorageStats,
  getAuditLogs,
  getBackupHistory,
  createBackup,
  getSystemMetrics,
  getDatabaseStats,
  toggleMaintenance,
} from './controllers/adminCenterController';
import { getOpportunity, estimateOpportunity } from './controllers/opportunityController';
import {
  getProviderList,
  getCompanyDiscoveryConfig,
  triggerResearch,
  getResearch,
  triggerCompetitorAnalysis,
  getCompetitorAnalysis,
} from './controllers/researchController';
import {
  getMonitoringSchedule,
  updateMonitoringSchedule,
  triggerMonitoringCheck,
  getMonitoringHistory,
} from './controllers/monitoringController';
import { listReports, generateReport, getReport } from './controllers/reportController';
import {
  generateProposal,
  listProposals,
  getProposal,
  generateCopy,
  generateRedesign,
  getCompanyTimeline,
  getSalesPlaybook,
  getExecutiveStats,
} from './controllers/platformController';
import {
  listAgents,
  getAgent,
  runAgent,
  runAllAgents,
  getAgentExecutions,
  getAgentMemory,
  getKnowledgeGraph,
  getExecutiveBriefings,
  generateBriefing,
  intelligentSearch,
  getAgentEvents,
  getQualityMetrics,
  getAgentHealthSummary,
} from './controllers/agentController';
import {
  searchLocations,
  listLocations,
  getLocationTree,
  createLocation,
  updateLocation,
  deleteLocation,
  getLocationsByCountry,
  listIndustries,
  getIndustryTree,
  createIndustry,
  updateIndustry,
  deleteIndustry,
} from './controllers/locationIndustryController';
import {
  listDiscoveryCampaigns,
  getDiscoveryCampaign,
  createDiscoveryCampaign,
  updateDiscoveryCampaign,
  deleteDiscoveryCampaign,
  activateDiscoveryCampaign,
  pauseDiscoveryCampaign,
  getCampaignJobs,
  retryCampaignJobs,
  getCoverageStats,
  getCountryCoverage,
  getIndustryCoverage,
  getDiscoveryHealth,
  getProviderHealth,
  getCostStats,
} from './controllers/campaignOrchestratorController';
import {
  getDiscoveryIntelligence,
  getProviderIntelligence,
  getMarketIntelligence,
  getOpportunityIntelligence,
  getHeatmapData,
  getPredictiveDiscovery,
  getPipelineOptimizations,
  getEconomicsData,
  getBenchmarks,
  getExecutiveReport,
  generateExecutiveReport,
} from './controllers/intelligenceCenterController';
import {
  getPipelineStages,
  getPipelineOverview,
  getPipelineBoard,
  getLeadPipeline,
  transitionLeadPipeline,
  getPipelineStats,
  getClientReadiness,
  computeClientReadiness,
  getTopProspects,
  getNegotiationProfile,
  generateNegotiationProfile,
  listAutomationRules,
  createAutomationRule,
  toggleAutomationRule,
  deleteAutomationRule,
  getAutomationExecutions,
  getAutomationStats,
  getImprovementReports,
  getSystemOverview,
  getMetricsHistory,
  getMorningBriefing,
  triggerMorningBriefing,
  getLearningSignals,
  getLearningPerformance,
  recordLearningSignal,
} from './controllers/modulesController';
import {
  generateOutreach,
  getLeadOutreachHistory,
  recordOutreach,
} from './controllers/outreachController';

export function setupRoutes(): Router {
  const router = express.Router();

  // ── Health (public) ────────────────────────────────────────
  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '3.0.0',
      services: { database: 'connected', redis: 'connected', minio: 'initialized', browser: 'ready' },
    });
  });

  // ── Auth (public) ──────────────────────────────────────────
  router.post('/auth/register', register);
  router.post('/auth/login', login);
  router.post('/auth/refresh', refreshToken);
  router.post('/auth/forgot-password', forgotPassword);
  router.post('/auth/reset-password', resetPassword);
  router.post('/auth/verify-email', verifyEmail);
  router.post('/auth/magic-link', requestMagicLink);
  router.post('/auth/magic-link/verify', verifyMagicLink);
  router.post('/auth/oauth/callback', oauthCallback);
  router.get('/auth/google', googleAuth);
  router.get('/auth/google/callback', googleCallback);

  // ── Auth (authenticated) ───────────────────────────────────
  router.get('/auth/me', authenticate, me);
  router.post('/auth/logout', authenticate, logout);
  router.post('/auth/logout-all', authenticate, logoutAll);
  router.post('/auth/change-password', authenticate, changePassword);
  router.post('/auth/send-verification', authenticate, sendVerificationEmail);
  router.get('/auth/sessions', authenticate, getSessions);
  router.delete('/auth/sessions/:id', authenticate, revokeSession);
  router.put('/auth/profile', authenticate, updateProfile);

  // ── API Keys (authenticated) ──────────────────────────────
  router.get('/api-keys', authenticate, listApiKeys);
  router.post('/api-keys', authenticate, createApiKey);
  router.delete('/api-keys/:id', authenticate, revokeApiKey);

  // ── Protected routes ───────────────────────────────────────
  // All routes below require authentication via JWT or API key

  // Public routes (no auth required)
  router.get('/locations/search', searchLocations);
  router.post('/search', createSearchJob);
  router.get('/search/jobs/:id', getSearchJob);

  router.use(authenticate);

  // Dashboard
  router.get('/dashboard/stats', leadStats);

  // Search (authenticated)
  router.get('/search/jobs', listSearchJobs);
  router.post('/search/jobs/:id/cancel', cancelSearchJob);

  // Leads CRUD
  router.route('/leads').get(listLeads).post(addLead);
  router.route('/leads/:id').get(getLead).put(updateLeadHandler).delete(deleteLeadHandler);

  // CRM
  router.get('/leads/:id/timeline', getLeadTimeline);
  router.get('/leads/:id/tasks', getLeadTasks);
  router.post('/leads/:id/tasks', createLeadTask);
  router.post('/leads/:id/notes', addLeadNote);
  router.put('/leads/:id/tasks/:taskId', updateLeadTask);

  // Outreach
  router.post('/outreach/generate', generateOutreach);
  router.get('/leads/:id/outreach', getLeadOutreachHistory);
  router.post('/leads/:id/outreach', recordOutreach);

  // Campaigns
  router.route('/campaigns').get(listCampaigns).post(createCampaign);
  router.route('/campaigns/:id').put(updateCampaign).delete(deleteCampaign);
  router.get('/campaigns/:id/leads', getCampaignLeads);
  router.post('/campaigns/:id/leads', addLeadToCampaign);
  router.delete('/campaigns/:id/leads/:leadId', removeLeadFromCampaign);

  // Companies
  router.get('/companies', getCompanyDiscoveryConfig);
  router.get('/companies/:id', getCompanyDetail);
  router.get('/companies/:id/contacts', getCompanyContacts);
  router.get('/companies/:id/technologies', getCompanyTechnologies);
  router.get('/companies/:id/audit', getCompanyAudit);
  router.post('/companies/:id/enrich', enrichCompany);

  // Export
  router.get('/export/leads', exportLeads);
  router.get('/export/history', getExportHistory);

  // Scheduled Searches
  router.route('/scheduled-searches').get(listScheduledSearches).post(createScheduledSearch);
  router.route('/scheduled-searches/:id').put(updateScheduledSearch).delete(deleteScheduledSearch);
  router.post('/scheduled-searches/:id/run', runScheduledSearchNow);

  // Change History
  router.get('/change-history', getChangeHistory);

  // Notifications
  router.get('/notifications', listNotifications);
  router.post('/notifications/read-all', markAllNotificationsRead);
  router.put('/notifications/:id/read', markNotificationRead);
  router.delete('/notifications/:id', deleteNotification);

  // Search Presets
  router.route('/presets').get(listPresets).post(createPreset);
  router.delete('/presets/:id', deletePreset);

  // Opportunities
  router.get('/opportunities/:leadId', getOpportunity);
  router.post('/opportunities/:leadId/estimate', estimateOpportunity);

  // ── Admin Center (super_admin + admin) ─────────────────────
  const adminAuth = [requireRole('super_admin', 'admin')];

  // Legacy settings (kept for backward compat)
  router.get('/admin/settings', ...adminAuth, listSettings);
  router.put('/admin/settings/:key', ...adminAuth, updateSetting);

  // Users management
  router.get('/admin/users', ...adminAuth, listAdminUsers);
  router.put('/admin/users/:id', ...adminAuth, updateUserRole);
  router.delete('/admin/users/:id', ...adminAuth, softDeleteUser);

  // Workspaces management
  router.get('/admin/workspaces', ...adminAuth, listWorkspaces);
  router.put('/admin/workspaces/:id', ...adminAuth, updateWorkspace);

  // AI Provider configs
  router.get('/admin/providers', ...adminAuth, getProviderConfigs);
  router.put('/admin/providers/:slug', ...adminAuth, updateProviderConfig);

  // Queue & Worker status
  router.get('/admin/queues', ...adminAuth, getQueueStatus);
  router.get('/admin/workers', ...adminAuth, getWorkerDetails);

  // Storage stats
  router.get('/admin/storage', ...adminAuth, getStorageStats);

  // Audit logs
  router.get('/admin/logs', ...adminAuth, getAuditLogs);

  // Backups
  router.get('/admin/backups', ...adminAuth, getBackupHistory);
  router.post('/admin/backups', ...adminAuth, createBackup);

  // System metrics
  router.get('/admin/metrics', ...adminAuth, getSystemMetrics);

  // Database stats
  router.get('/admin/database', ...adminAuth, getDatabaseStats);

  // Maintenance mode
  router.post('/admin/maintenance', ...adminAuth, toggleMaintenance);

  // Research
  router.get('/providers', getProviderList);
  router.post('/companies/:id/research', triggerResearch);
  router.get('/companies/:id/research', getResearch);
  router.post('/companies/:id/competitors', triggerCompetitorAnalysis);
  router.get('/companies/:id/competitors', getCompetitorAnalysis);

  // Monitoring
  router.get('/companies/:id/monitoring', getMonitoringSchedule);
  router.put('/companies/:id/monitoring', updateMonitoringSchedule);
  router.post('/companies/:id/monitoring/check', triggerMonitoringCheck);
  router.get('/companies/:id/monitoring/history', getMonitoringHistory);

  // Reports
  router.route('/reports').get(listReports).post(generateReport);
  router.get('/reports/:id', getReport);

  // Proposals
  router.route('/proposals').get(listProposals).post(generateProposal);
  router.get('/proposals/:id', getProposal);

  // Copywriter
  router.post('/copywriter', generateCopy);

  // Redesign
  router.post('/redesign', generateRedesign);

  // Company Timeline
  router.get('/companies/:id/timeline', getCompanyTimeline);

  // Sales Playbook
  router.get('/companies/:id/playbook', getSalesPlaybook);

  // Executive Stats
  router.get('/executive/stats', getExecutiveStats);

  // Agent status (legacy)
  router.get('/agents/status', (req, res) => {
    res.json({
      agents: {
        scout: 'ready',
        scraper: 'ready',
        browser: 'ready',
        research: 'ready',
        audit: 'ready',
        techStack: 'ready',
        seo: 'ready',
        copywriting: 'ready',
        proposal: 'ready',
        email: 'ready',
        linkedIn: 'ready',
        crm: 'ready',
        analytics: 'ready',
      },
      browsers: { lightpanda: 'ready', playwright: 'ready (fallback)' },
    });
  });

  // Autonomous AI Agent System
  router.get('/agents', listAgents);
  router.get('/agents/health', getAgentHealthSummary);
  router.get('/agents/events', getAgentEvents);
  router.get('/agents/quality-metrics', getQualityMetrics);
  router.get('/agents/:name', getAgent);
  router.post('/agents/:name/run', runAgent);
  router.get('/agents/:name/executions', getAgentExecutions);
  router.get('/agents/:name/memory', getAgentMemory);
  router.post('/agents/run-all', runAllAgents);

  // Knowledge Graph
  router.get('/knowledge', getKnowledgeGraph);

  // Executive Briefings
  router.get('/briefings', getExecutiveBriefings);
  router.post('/briefings/generate', generateBriefing);

  // Intelligent Search (NL)
  router.post('/intelligence/search', intelligentSearch);

  // Global Location Hierarchy
  router.get('/locations/search', searchLocations);
  router.get('/locations', listLocations);
  router.get('/locations/tree', getLocationTree);
  router.get('/locations/country/:countryCode', getLocationsByCountry);
  router.post('/locations', createLocation);
  router.put('/locations/:id', updateLocation);
  router.delete('/locations/:id', deleteLocation);

  // Global Industry Hierarchy
  router.get('/industries', listIndustries);
  router.get('/industries/tree', getIndustryTree);
  router.post('/industries', createIndustry);
  router.put('/industries/:id', updateIndustry);
  router.delete('/industries/:id', deleteIndustry);

  // Discovery Orchestrator
  router.route('/discovery-campaigns').get(listDiscoveryCampaigns).post(createDiscoveryCampaign);
  router
    .route('/discovery-campaigns/:id')
    .get(getDiscoveryCampaign)
    .put(updateDiscoveryCampaign)
    .delete(deleteDiscoveryCampaign);
  router.post('/discovery-campaigns/:id/activate', activateDiscoveryCampaign);
  router.post('/discovery-campaigns/:id/pause', pauseDiscoveryCampaign);
  router.get('/discovery-campaigns/:id/jobs', getCampaignJobs);
  router.post('/discovery-campaigns/:id/retry', retryCampaignJobs);

  // Discovery Coverage
  router.get('/discovery/coverage', getCoverageStats);
  router.get('/discovery/coverage/countries', getCountryCoverage);
  router.get('/discovery/coverage/industries', getIndustryCoverage);

  // Discovery Health
  router.get('/discovery/health', getDiscoveryHealth);
  router.get('/discovery/health/providers', getProviderHealth);

  // Discovery Cost
  router.get('/discovery/costs', getCostStats);

  // Intelligence Center
  router.get('/intelligence-center/discovery', getDiscoveryIntelligence);
  router.get('/intelligence-center/providers', getProviderIntelligence);
  router.get('/intelligence-center/market', getMarketIntelligence);
  router.get('/intelligence-center/opportunities', getOpportunityIntelligence);
  router.get('/intelligence-center/heatmap', getHeatmapData);
  router.get('/intelligence-center/predictive', getPredictiveDiscovery);
  router.get('/intelligence-center/pipeline', getPipelineOptimizations);
  router.get('/intelligence-center/economics', getEconomicsData);
  router.get('/intelligence-center/benchmarks', getBenchmarks);
  router.get('/intelligence-center/executive', getExecutiveReport);
  router.post('/intelligence-center/executive/generate', generateExecutiveReport);

  // AI Sales Pipeline
  router.get('/pipeline/stages', getPipelineStages);
  router.get('/pipeline/overview', getPipelineOverview);
  router.get('/pipeline/board', getPipelineBoard);
  router.get('/pipeline/stats', getPipelineStats);
  router.get('/pipeline/leads/:leadId', getLeadPipeline);
  router.post('/pipeline/leads/:leadId/transition', transitionLeadPipeline);

  // Client Readiness Score
  router.get('/readiness/top', getTopProspects);
  router.get('/readiness/:companyId', getClientReadiness);
  router.post('/readiness/compute', computeClientReadiness);

  // AI Negotiation Assistant
  router.get('/negotiation/:companyId', getNegotiationProfile);
  router.post('/negotiation/generate', generateNegotiationProfile);

  // Learning Engine
  router.get('/learning/signals', getLearningSignals);
  router.get('/learning/performance', getLearningPerformance);
  router.post('/learning/signals', recordLearningSignal);

  // Intelligent Automation
  router.get('/automation/rules', listAutomationRules);
  router.post('/automation/rules', createAutomationRule);
  router.put('/automation/rules/:id/toggle', toggleAutomationRule);
  router.delete('/automation/rules/:id', deleteAutomationRule);
  router.get('/automation/executions', getAutomationExecutions);
  router.get('/automation/stats', getAutomationStats);

  // Autonomous Improvement
  router.get('/improvement/reports', getImprovementReports);

  // Executive OS
  router.get('/executive/morning', getMorningBriefing);
  router.post('/executive/morning/generate', triggerMorningBriefing);

  // Observability
  router.get('/observability/overview', getSystemOverview);
  router.get('/observability/metrics', getMetricsHistory);

  return router;
}
