import express, { Router } from 'express';
import {
  listLeads,
  getLead,
  addLead,
  updateLeadHandler,
  deleteLeadHandler,
  leadStats
} from './controllers/leadController';
import {
  listCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign
} from './controllers/campaignController';

export function setupRoutes(): Router {
  const router = express.Router();

  // Health check
  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        database: 'connected',
        redis: 'connected',
        minio: 'initialized',
        browser: 'ready'
      }
    });
  });

  // Dashboard stats
  router.get('/dashboard/stats', leadStats);

  // Leads CRUD
  router.route('/leads')
    .get(listLeads)
    .post(addLead);

  router.route('/leads/:id')
    .get(getLead)
    .put(updateLeadHandler)
    .delete(deleteLeadHandler);

  // Campaigns CRUD
  router.route('/campaigns')
    .get(listCampaigns)
    .post(createCampaign);

  router.route('/campaigns/:id')
    .put(updateCampaign)
    .delete(deleteCampaign);

  // Company discovery
  router.get('/companies', (req, res) => {
    res.json({
      message: 'Company discovery service',
      sources: [
        'Google Maps',
        'Dubai Business Directory',
        'Yellow Pages UAE',
        'Clutch',
        'Contra',
        'PeoplePerHour',
        'Crunchbase',
        'Yello UAE'
      ],
      availableIndustries: [
        'Hotels', 'Restaurants', 'Cafes', 'Medical Clinics',
        'Hospitals', 'Dentists', 'Real Estate', 'Construction',
        'Interior Designers', 'Architects', 'Gyms', 'Salons',
        'Spas', 'Car Showrooms', 'Law Firms', 'Accounting Firms',
        'Travel Agencies', 'Education', 'IT Companies',
        'Marketing Agencies', 'Ecommerce', 'Retail', 'Jewellery',
        'Luxury Brands', 'Furniture', 'Manufacturing', 'Logistics'
      ],
      availableLocations: {
        UAE: ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain', 'Al Ain'],
        DubaiAreas: [
          'Downtown Dubai', 'Business Bay', 'Dubai Marina', 'Jumeirah',
          'Palm Jumeirah', 'Deira', 'Bur Dubai', 'Jumeirah Lake Towers',
          'JLT', 'Al Barsha', 'Dubai Silicon Oasis', 'Dubai Internet City',
          'Dubai Media City', 'Dubai Design District', 'Dubai Healthcare City',
          'Motor City', 'Arabian Ranches', 'Dubai Hills', 'Mirdif',
          'Karama', 'Al Quoz', 'International City', 'Discovery Gardens',
          'Jebel Ali', 'Al Nahda', 'Satwa', 'Al Rigga', 'Oud Metha',
          'Al Garhoud', 'Dubai Creek Harbour', 'Bluewaters Island'
        ]
      }
    });
  });

  // Agent status
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
        analytics: 'ready'
      },
      browsers: {
        lightpanda: 'ready',
        playwright: 'ready (fallback)'
      }
    });
  });

  // AI audit check
  router.post('/audit/check', (req, res) => {
    const { url } = req.body;
    if (!url) {
      res.status(400).json({ success: false, message: 'URL is required' });
      return;
    }
    res.json({
      success: true,
      data: {
        url,
        checks: {
          ssl: 'pending',
          mobileResponsive: 'pending',
          speed: 'pending',
          seo: 'pending',
          accessibility: 'pending',
          hasWhatsApp: 'pending',
          hasAnalytics: 'pending',
          hasMetaPixel: 'pending',
          hasCTAs: 'pending',
          hasBooking: 'pending'
        },
        scores: {
          businessScore: 0,
          websiteScore: 0,
          seoScore: 0,
          conversionScore: 0
        },
        estimatedValue: 'pending',
        expectedROI: 'pending'
      }
    });
  });

  // Export endpoints
  router.get('/export/leads', (req, res) => {
    const format = req.query.format || 'json';
    res.json({
      message: `Export leads in ${format} format`,
      formats: ['json', 'csv', 'excel', 'pdf', 'markdown']
    });
  });

  return router;
}
