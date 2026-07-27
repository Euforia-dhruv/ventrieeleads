import { Request, Response } from 'express';
import { getPool } from '../database/connection';
import { getLeads, getLeadById, createLead, updateLead, deleteLead, getLeadStats } from '../database/queries';
import { logger } from '../core/logger';

export async function listLeads(req: Request, res: Response): Promise<void> {
  try {
    const filters: any = {};
    if (req.query.status) filters.status = req.query.status as string;
    if (req.query.city) filters.city = req.query.city as string;
    if (req.query.industry) filters.industry = req.query.industry as string;
    if (req.query.minScore) filters.minScore = parseInt(req.query.minScore as string);
    if (req.query.maxScore) filters.maxScore = parseInt(req.query.maxScore as string);
    if (req.query.source) filters.source = req.query.source as string;

    const leads = await getLeads(getPool(), filters);
    res.json({ success: true, data: leads, count: leads.length });
  } catch (error) {
    logger.error('Error listing leads:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch leads' });
  }
}

export async function getLead(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id);
    const lead = await getLeadById(getPool(), id);
    if (!lead) {
      res.status(404).json({ success: false, message: 'Lead not found' });
      return;
    }
    res.json({ success: true, data: lead });
  } catch (error) {
    logger.error('Error fetching lead:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch lead' });
  }
}

export async function addLead(req: Request, res: Response): Promise<void> {
  try {
    const lead = await createLead(getPool(), {
      company_name: req.body.company_name,
      company_website: req.body.company_website || '',
      location: req.body.location || '',
      city: req.body.city || '',
      country: req.body.country || 'AE',
      industry: req.body.industry || '',
      phone: req.body.phone || '',
      email: req.body.email || '',
      address: req.body.address || '',
      description: req.body.description || '',
      logo_url: req.body.logo_url || '',
      screenshot_url: req.body.screenshot_url || '',
      tech_stack: req.body.tech_stack || [],
      seo_score: req.body.seo_score || 0,
      lead_score: req.body.lead_score || 0,
      status: req.body.status || 'New',
      source: req.body.source || 'manual',
      metadata: req.body.metadata || {}
    });
    res.status(201).json({ success: true, data: lead });
  } catch (error) {
    logger.error('Error creating lead:', error);
    res.status(500).json({ success: false, message: 'Failed to create lead' });
  }
}

export async function updateLeadHandler(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id);
    const lead = await updateLead(getPool(), id, req.body);
    if (!lead) {
      res.status(404).json({ success: false, message: 'Lead not found' });
      return;
    }
    res.json({ success: true, data: lead });
  } catch (error) {
    logger.error('Error updating lead:', error);
    res.status(500).json({ success: false, message: 'Failed to update lead' });
  }
}

export async function deleteLeadHandler(req: Request, res: Response): Promise<void> {
  try {
    const id = parseInt(req.params.id);
    const deleted = await deleteLead(getPool(), id);
    res.json({ success: true, deleted });
  } catch (error) {
    logger.error('Error deleting lead:', error);
    res.status(500).json({ success: false, message: 'Failed to delete lead' });
  }
}

export async function leadStats(req: Request, res: Response): Promise<void> {
  try {
    const stats = await getLeadStats(getPool());
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Error fetching lead stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch lead stats' });
  }
}
