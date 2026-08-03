import { Request, Response } from 'express';
import { getPool } from '../database/connection';
import { logger } from '../core/logger';

export async function exportLeads(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const format = (req.query.format as string) || 'csv';
    const status = req.query.status as string;
    const city = req.query.city as string;
    const industry = req.query.industry as string;
    const minScore = parseInt(req.query.minScore as string);
    const maxScore = parseInt(req.query.maxScore as string);
    const technology = req.query.technology as string;

    let query = `
      SELECT l.*, c.name as company_name, c.website as company_website,
             c.industry, c.city, c.area, c.country, c.address, c.phone as company_phone,
             c.email as company_email, c.logo_url, c.rating, c.review_count,
             c.google_maps_url, c.screenshot_url, c.twitter, c.tiktok,
             w.title as website_title, w.description as website_description,
             w.emails, w.phone_numbers, w.whatsapp, w.instagram, w.facebook,
             w.linkedin, w.youtube, w.twitter as website_twitter
      FROM leads l
      LEFT JOIN companies c ON l.company_id = c.id
      LEFT JOIN websites w ON c.id = w.company_id
      WHERE l.is_deleted = false
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (status) { query += ` AND l.status = $${paramIndex++}`; params.push(status); }
    if (city) { query += ` AND c.city = $${paramIndex++}`; params.push(city); }
    if (industry) { query += ` AND c.industry = $${paramIndex++}`; params.push(industry); }
    if (!isNaN(minScore)) { query += ` AND l.score >= $${paramIndex++}`; params.push(minScore); }
    if (!isNaN(maxScore)) { query += ` AND l.score <= $${paramIndex++}`; params.push(maxScore); }
    if (technology) {
      query += ` AND EXISTS (SELECT 1 FROM technologies t WHERE t.company_id = c.id AND t.name ILIKE $${paramIndex++})`;
      params.push(`%${technology}%`);
    }

    query += ' ORDER BY l.score DESC, l.created_at DESC';

    const result = await pool.query(query, params);
    const leads = result.rows;

    // Log export
    await pool.query(
      'INSERT INTO export_history (format, filters, record_count) VALUES ($1, $2, $3)',
      [format, JSON.stringify({ status, city, industry, minScore, maxScore, technology }), leads.length]
    );

    if (format === 'csv') {
      if (leads.length === 0) {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
        res.send('No leads found');
        return;
      }
      const headers = Object.keys(leads[0]);
      const csv = [
        headers.join(','),
        ...leads.map(row => headers.map(h => {
          const val = row[h];
          if (val === null || val === undefined) return '';
          const str = String(val);
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(','))
      ].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="leads.csv"');
      res.send(csv);
    } else if (format === 'json') {
      res.setHeader('Content-Disposition', 'attachment; filename="leads.json"');
      res.json({ success: true, data: leads, count: leads.length });
    } else if (format === 'markdown') {
      if (leads.length === 0) {
        res.setHeader('Content-Type', 'text/markdown');
        res.send('# Lead Export\n\nNo leads found.');
        return;
      }
      const headers = ['Company', 'Website', 'Industry', 'City', 'Score', 'Status', 'Phone', 'Email', 'Rating'];
      const md = [
        '# Lead Export',
        '',
        `Generated: ${new Date().toISOString()}`,
        `Total: ${leads.length} leads`,
        '',
        '| ' + headers.join(' | ') + ' |',
        '| ' + headers.map(() => '---').join(' | ') + ' |',
        ...leads.map(l => '| ' + [
          l.company_name || '', l.company_website || '', l.industry || '',
          l.city || '', String(l.score || 0), l.status || '',
          l.company_phone || '', l.company_email || '', String(l.rating || 0)
        ].join(' | ') + ' |')
      ].join('\n');
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', 'attachment; filename="leads.md"');
      res.send(md);
    } else {
      res.status(400).json({ success: false, message: `Unsupported format: ${format}. Use csv, json, or markdown.` });
    }
  } catch (error) {
    logger.error('Error exporting leads:', error);
    res.status(500).json({ success: false, message: 'Failed to export leads' });
  }
}

export async function getExportHistory(req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const result = await pool.query('SELECT * FROM export_history ORDER BY created_at DESC LIMIT 50');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching export history:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch export history' });
  }
}
