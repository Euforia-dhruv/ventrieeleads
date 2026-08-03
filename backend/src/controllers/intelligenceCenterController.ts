import { Request, Response } from 'express';
import { getPool } from '../database/connection';
import { logger } from '../core/logger';
import axios from 'axios';

const TASK_ENQUEUER_URL = process.env.TASK_ENQUEUER_URL || 'http://task-enqueuer:8002';

// ─── MODULE 1: Discovery Intelligence ──────────────────────────────────────

export async function getDiscoveryIntelligence(_req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();

    const [totalComp, totalLoc, totalInd, coveredLoc, coveredInd, countries] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM companies WHERE is_deleted = FALSE'),
      pool.query("SELECT COUNT(*) FROM locations WHERE is_deleted = FALSE AND is_active = TRUE AND location_type = 'city'"),
      pool.query("SELECT COUNT(*) FROM industries WHERE is_deleted = FALSE AND is_active = TRUE AND parent_id IS NOT NULL"),
      pool.query("SELECT COUNT(DISTINCT location_id) FROM campaign_jobs WHERE status = 'completed' AND is_deleted = FALSE AND location_id IS NOT NULL"),
      pool.query("SELECT COUNT(DISTINCT industry_id) FROM campaign_jobs WHERE status = 'completed' AND is_deleted = FALSE AND industry_id IS NOT NULL"),
      pool.query("SELECT COUNT(DISTINCT country) FROM companies WHERE is_deleted = FALSE AND country != ''"),
    ]);

    const tc = parseInt(totalComp.rows[0].count);
    const tl = parseInt(totalLoc.rows[0].count);
    const ti = parseInt(totalInd.rows[0].count);
    const cl = parseInt(coveredLoc.rows[0].count);
    const ci = parseInt(coveredInd.rows[0].count);
    const cw = parseInt(countries.rows[0].count);

    const coverageScore = tl > 0 ? Math.round(cl / tl * 1000) / 10 : 0;
    const industryCoverage = ti > 0 ? Math.round(ci / ti * 1000) / 10 : 0;

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString();

    const [newWeek, newMonth, prevWeek] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM companies WHERE is_deleted = FALSE AND created_at > $1', [weekAgo]),
      pool.query('SELECT COUNT(*) FROM companies WHERE is_deleted = FALSE AND created_at > $1', [monthAgo]),
      pool.query('SELECT COUNT(*) FROM companies WHERE is_deleted = FALSE AND created_at > $1 AND created_at <= $2', [twoWeeksAgo, weekAgo]),
    ]);

    const nw = parseInt(newWeek.rows[0].count);
    const nm = parseInt(newMonth.rows[0].count);
    const pw = parseInt(prevWeek.rows[0].count);
    const velocity = Math.round(nw / 7 * 10) / 10;
    const density = tl > 0 ? Math.round(tc / tl * 10) / 10 : 0;
    const growthRate = pw > 0 ? Math.round((nw - pw) / Math.max(pw, 1) * 1000) / 10 : 0;
    const confidence = Math.min(100, Math.round(
      coverageScore * 0.3 + Math.min(velocity, 50) * 2 * 0.3 +
      Math.min(tc, 1000) / 10 * 0.2 + industryCoverage * 0.2
    ));

    const recommendations: any[] = [];
    if (coverageScore < 20) recommendations.push({
      title: 'Expand geographic coverage',
      description: `Only ${coverageScore}% of cities explored. Run campaigns in uncovered regions.`,
      confidence: 0.9, priority: 9, type: 'expansion',
    });
    if (velocity < 5) recommendations.push({
      title: 'Increase discovery velocity',
      description: `Currently ${velocity}/day. Increase concurrency or add providers.`,
      confidence: 0.85, priority: 8, type: 'optimization',
    });
    if (growthRate < 0) recommendations.push({
      title: 'Reverse growth decline',
      description: `Growth rate is ${growthRate}%. Review provider health.`,
      confidence: 0.95, priority: 10, type: 'alert',
    });

    res.json({
      success: true,
      data: {
        summary: { total_companies: tc, total_locations: tl, total_industries: ti, covered_locations: cl, covered_industries: ci, countries_with_data: cw },
        scores: { coverage_score: coverageScore, industry_coverage: industryCoverage, discovery_velocity: velocity, business_density: density, growth_rate: growthRate, discovery_confidence: confidence },
        trends: { new_this_week: nw, new_this_month: nm, velocity_per_day: velocity },
        recommendations,
      },
    });
  } catch (error) {
    logger.error('Error getting discovery intelligence:', error);
    res.status(500).json({ success: false, message: 'Failed to get discovery intelligence' });
  }
}

// ─── MODULE 2: Provider AI ─────────────────────────────────────────────────

export async function getProviderIntelligence(_req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const result = await pool.query(
      "SELECT * FROM provider_metrics WHERE is_deleted = FALSE ORDER BY successful_requests DESC"
    );

    const providers: Record<string, any> = {};
    for (const m of result.rows) {
      if (!providers[m.provider_slug]) {
        providers[m.provider_slug] = {
          slug: m.provider_slug, countries: 0, total_requests: 0, successful: 0,
          failed: 0, total_latency: 0, total_results: 0, total_dup_rate: 0, last_error: null, by_country: {},
        };
      }
      const p = providers[m.provider_slug];
      p.countries++;
      p.total_requests += m.total_requests;
      p.successful += m.successful_requests;
      p.failed += m.failed_requests;
      p.total_latency += (m.avg_latency_ms || 0) * Math.max(m.total_requests, 1);
      p.total_results += m.avg_results_per_request || 0;
      p.total_dup_rate += m.duplicate_rate || 0;
      if (m.last_error) p.last_error = m.last_error;
      if (m.total_requests > 0) {
        p.by_country[m.country_code] = {
          success_rate: Math.round(m.successful_requests / m.total_requests * 1000) / 1000,
          avg_latency: m.avg_latency_ms,
          avg_results: Math.round((m.avg_results_per_request || 0) * 10) / 10,
          requests: m.total_requests,
        };
      }
    }

    const scored = Object.values(providers).map((p: any) => {
      const total = Math.max(p.total_requests, 1);
      const health = Math.round(p.successful / total * 1000) / 1000;
      const latency = Math.max(0, 1 - p.total_latency / Math.max(total * 30000, 1));
      const quality = Math.round(p.total_results / Math.max(p.countries, 1) * 10) / 10;
      const dup = Math.round(1 - p.total_dup_rate / Math.max(p.countries, 1) * 1000) / 1000;
      const freshness = p.last_error === null ? 1.0 : 0.5;
      const composite = Math.round(
        (health * 0.25 + latency * 0.15 + Math.min(quality / 20, 1) * 0.2 +
        dup * 0.15 + freshness * 0.1 + Math.min(p.countries / 5, 1) * 0.15) * 1000
      ) / 1000;
      return {
        provider: p.slug,
        scores: {
          health_score: health, coverage_score: Math.min(p.countries / 5, 1),
          quality_score: Math.min(quality / 20, 1), latency_score: latency,
          duplicate_score: dup, freshness_score: freshness, composite_score: composite,
        },
        stats: {
          total_requests: p.total_requests, success_rate: health,
          countries_served: p.countries,
          avg_results_per_request: Math.round(p.total_results / Math.max(p.countries, 1) * 10) / 10,
        },
        by_country: p.by_country, last_error: p.last_error,
      };
    });

    scored.sort((a: any, b: any) => b.scores.composite_score - a.scores.composite_score);

    const recommendations: any[] = [];
    if (scored.length === 0) {
      recommendations.push({ title: 'No provider data available', description: 'Run campaigns to collect metrics.', confidence: 1.0, priority: 10, type: 'setup' });
    } else {
      recommendations.push({
        title: `Primary provider: ${scored[0].provider}`,
        description: `Composite score ${scored[0].scores.composite_score}. Best overall.`,
        confidence: 0.9, priority: 8, type: 'recommendation',
      });
      scored.filter((s: any) => s.scores.health_score < 0.7).forEach((s: any) => {
        recommendations.push({
          title: `Provider ${s.provider} needs attention`,
          description: `Health ${Math.round(s.scores.health_score * 100)}%. Consider reducing load.`,
          confidence: 0.85, priority: 7, type: 'warning',
        });
      });
    }

    res.json({ success: true, data: { providers: scored, recommendations } });
  } catch (error) {
    logger.error('Error getting provider intelligence:', error);
    res.status(500).json({ success: false, message: 'Failed to get provider intelligence' });
  }
}

// ─── MODULE 3: Market Intelligence ─────────────────────────────────────────

export async function getMarketIntelligence(_req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const citiesResult = await pool.query(`
      SELECT l.name as city, l.country_code, l.population, l.gdp_usd,
        COALESCE(c.company_count, 0) as total_companies,
        COALESCE(c.new_week, 0) as new_this_week
      FROM locations l
      LEFT JOIN (
        SELECT city, COUNT(*) as company_count,
          COUNT(*) FILTER (WHERE created_at > $1) as new_week
        FROM companies WHERE is_deleted = FALSE GROUP BY city
      ) c ON c.city = l.name
      WHERE l.location_type = 'city' AND l.is_deleted = FALSE AND l.is_active = TRUE
      AND (COALESCE(c.company_count, 0) > 0 OR COALESCE(c.new_week, 0) > 0)
      ORDER BY COALESCE(c.new_week, 0) DESC
    `, [weekAgo]);

    const cityData = citiesResult.rows.map((r: any) => ({
      city: r.city, country_code: r.country_code,
      total_companies: parseInt(r.total_companies),
      new_this_week: parseInt(r.new_this_week),
      growth_rate: r.total_companies > 0 ? Math.round(parseInt(r.new_this_week) / parseInt(r.total_companies) * 1000) / 10 : 0,
      population: r.population || 0, gdp_usd: r.gdp_usd || 0,
    }));

    const indResult = await pool.query(`
      SELECT i.name as industry,
        COALESCE(c.company_count, 0) as total_companies,
        COALESCE(c.new_week, 0) as new_this_week
      FROM industries i
      LEFT JOIN (
        SELECT industry, COUNT(*) as company_count,
          COUNT(*) FILTER (WHERE created_at > $1) as new_week
        FROM companies WHERE is_deleted = FALSE AND industry IS NOT NULL GROUP BY industry
      ) c ON c.industry = i.name
      WHERE i.is_deleted = FALSE AND i.is_active = TRUE AND i.parent_id IS NOT NULL
      AND COALESCE(c.company_count, 0) > 0
      ORDER BY COALESCE(c.company_count, 0) DESC
    `, [weekAgo]);

    const industryData = indResult.rows.map((r: any) => ({
      industry: r.industry,
      total_companies: parseInt(r.total_companies),
      new_this_week: parseInt(r.new_this_week),
      growth_rate: parseInt(r.total_companies) > 0 ? Math.round(parseInt(r.new_this_week) / parseInt(r.total_companies) * 1000) / 10 : 0,
    }));

    res.json({
      success: true,
      data: {
        fastest_growing_cities: cityData.filter((c: any) => c.total_companies >= 3).sort((a: any, b: any) => b.growth_rate - a.growth_rate).slice(0, 10),
        fastest_growing_industries: [...industryData].sort((a: any, b: any) => b.growth_rate - a.growth_rate).slice(0, 10),
        most_competitive_industries: industryData.slice(0, 10),
        least_competitive_industries: [...industryData].filter((i: any) => i.total_companies > 0).sort((a: any, b: any) => a.total_companies - b.total_companies).slice(0, 10),
        top_cities_by_volume: cityData.slice(0, 10),
        top_industries_by_volume: industryData.slice(0, 10),
        emerging_markets: cityData.filter((c: any) => c.growth_rate > 10 && c.total_companies < 20).slice(0, 10),
      },
    });
  } catch (error) {
    logger.error('Error getting market intelligence:', error);
    res.status(500).json({ success: false, message: 'Failed to get market intelligence' });
  }
}

// ─── MODULE 4: Opportunity Intelligence ────────────────────────────────────

export async function getOpportunityIntelligence(_req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT c.id, c.name, c.industry, c.city, c.country, c.website, c.email, c.phone,
        c.rating, c.review_count, c.logo_url, c.description,
        a.overall_score as website_score, a.seo_score, a.design_score, a.performance_score,
        w.instagram, w.facebook, w.linkedin, w.whatsapp,
        (SELECT COUNT(*) FROM technologies t WHERE t.company_id = c.id) as tech_count,
        a.overall_score as audit_score
      FROM companies c
      LEFT JOIN websites w ON w.company_id = c.id
      LEFT JOIN audits a ON a.website_id = w.id
      WHERE c.is_deleted = FALSE
      ORDER BY COALESCE(a.overall_score, 0) DESC
      LIMIT 200
    `);

    const scored = result.rows.map((c: any) => {
      const tc = parseInt(c.tech_count) || 0;
      const digital = computeDigital(c, tc);
      const marketing = computeMarketing(c);
      const technology = computeTechnology(c, tc);
      const branding = computeBranding(c);
      const sales = computeSales(c);
      const growth = computeGrowth(c);
      const ai = computeAI(c, tc);
      const automation = computeAutomation(c, tc);
      const expansion = computeExpansion(c);
      const acquisition = computeAcquisition(c);
      const overall = Math.round(
        digital * 0.15 + marketing * 0.15 + technology * 0.15 +
        branding * 0.1 + sales * 0.15 + growth * 0.1 +
        ai * 0.05 + automation * 0.05 + expansion * 0.05 + acquisition * 0.05
      );

      return {
        company_id: c.id, company_name: c.name,
        industry: c.industry || '', city: c.city || '', country: c.country || '',
        scores: {
          overall, growth_score: growth, digital_maturity: digital,
          marketing_maturity: marketing, technology_maturity: technology,
          branding_maturity: branding, sales_readiness: sales,
          ai_readiness: ai, automation_readiness: automation,
          expansion_potential: expansion, acquisition_probability: acquisition,
        },
      };
    });

    scored.sort((a: any, b: any) => b.scores.overall - a.scores.overall);

    const byIndustry: Record<string, any> = {};
    for (const s of scored) {
      const key = s.industry || 'Unknown';
      if (!byIndustry[key]) byIndustry[key] = { count: 0, total: 0 };
      byIndustry[key].count++;
      byIndustry[key].total += s.scores.overall;
    }
    for (const k of Object.keys(byIndustry)) {
      byIndustry[k].avg_score = Math.round(byIndustry[k].total / byIndustry[k].count);
      delete byIndustry[k].total;
    }

    res.json({
      success: true,
      data: {
        total_scored: scored.length,
        top_opportunities: scored.slice(0, 100),
        by_industry: byIndustry,
        summary: {
          avg_score: scored.length > 0 ? Math.round(scored.reduce((s: number, x: any) => s + x.scores.overall, 0) / scored.length) : 0,
          high_value: scored.filter((s: any) => s.scores.overall >= 70).length,
          medium_value: scored.filter((s: any) => s.scores.overall >= 40 && s.scores.overall < 70).length,
          low_value: scored.filter((s: any) => s.scores.overall < 40).length,
        },
      },
    });
  } catch (error) {
    logger.error('Error getting opportunity intelligence:', error);
    res.status(500).json({ success: false, message: 'Failed to get opportunity intelligence' });
  }
}

function computeDigital(c: any, tc: number): number {
  let s = 0;
  if (c.website) s += 15;
  if (c.email) s += 10;
  if (c.phone) s += 5;
  if (c.instagram) s += 10;
  if (c.facebook) s += 8;
  if (c.linkedin) s += 8;
  if (c.audit_score) s += Math.min(c.audit_score * 0.4, 40);
  if (tc > 3) s += 10; else if (tc > 0) s += 5;
  return Math.min(Math.round(s * 10) / 10, 100);
}

function computeMarketing(c: any): number {
  let s = 0;
  if (c.instagram) s += 10;
  if (c.facebook) s += 15;
  if (c.linkedin) s += 15;
  if (c.audit_score && c.audit_score > 70) s += 20;
  if (c.rating && c.rating >= 4.5) s += 10;
  if (c.review_count && c.review_count > 100) s += 10;
  return Math.min(Math.round(s * 10) / 10, 100);
}

function computeTechnology(c: any, tc: number): number {
  let s = 0;
  if (tc > 10) s += 40; else if (tc > 5) s += 30; else if (tc > 2) s += 20; else if (tc > 0) s += 10;
  return Math.min(Math.round(s * 10) / 10, 100);
}

function computeBranding(c: any): number {
  let s = 0;
  if (c.logo_url) s += 20;
  if (c.website_score && c.website_score > 70) s += 30;
  else if (c.website_score && c.website_score > 40) s += 15;
  if (c.description && c.description.length > 100) s += 10;
  return Math.min(Math.round(s * 10) / 10, 100);
}

function computeSales(c: any): number {
  let s = 0;
  if (c.email) s += 20;
  if (c.phone) s += 15;
  if (c.website) s += 10;
  if (c.whatsapp) s += 10;
  if (c.audit_score && c.audit_score > 50) s += 15;
  return Math.min(Math.round(s * 10) / 10, 100);
}

function computeGrowth(c: any): number {
  let s = 50;
  if (c.review_count && c.review_count > 50) s += 15;
  if (c.rating && c.rating >= 4.0) s += 10;
  return Math.min(Math.round(s * 10) / 10, 100);
}

function computeAI(c: any, tc: number): number {
  let s = 20;
  if (tc > 5) s += 20;
  if (tc > 10) s += 15;
  return Math.min(Math.round(s * 10) / 10, 100);
}

function computeAutomation(c: any, tc: number): number {
  let s = 15;
  if (tc > 5) s += 10;
  return Math.min(Math.round(s * 10) / 10, 100);
}

function computeExpansion(c: any): number {
  let s = 30;
  if (c.review_count && c.review_count > 100) s += 20;
  if (c.rating && c.rating >= 4.0) s += 10;
  if (c.website) s += 10;
  if (c.email) s += 5;
  if (c.phone) s += 5;
  return Math.min(Math.round(s * 10) / 10, 100);
}

function computeAcquisition(c: any): number {
  let s = 20;
  if (c.website_score && c.website_score < 50) s += 25;
  if (!c.whatsapp && c.website) s += 15;
  if (c.audit_score && c.audit_score < 40) s += 15;
  if (!c.website) s += 10;
  return Math.min(Math.round(s * 10) / 10, 100);
}

// ─── MODULE 5: Global Heatmap ──────────────────────────────────────────────

export async function getHeatmapData(_req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const result = await pool.query(`
      SELECT l.country_code, l.name as country_name, l.latitude, l.longitude,
        (SELECT COUNT(*) FROM locations WHERE country_code = l.country_code AND location_type = 'city' AND is_deleted = FALSE) as total_cities,
        (SELECT COUNT(*) FROM companies WHERE country = l.country_code AND is_deleted = FALSE) as total_companies,
        (SELECT COUNT(*) FROM campaign_jobs WHERE country_code = l.country_code AND status = 'completed' AND is_deleted = FALSE) as coverage_jobs,
        (SELECT COALESCE(AVG(a.overall_score), 0) FROM audits a JOIN websites w ON a.website_id = w.id JOIN companies c ON w.company_id = c.id WHERE c.country = l.country_code AND a.is_deleted = FALSE) as avg_website_score
      FROM locations l
      WHERE l.location_type = 'country' AND l.is_deleted = FALSE AND l.is_active = TRUE
      ORDER BY (SELECT COUNT(*) FROM companies WHERE country = l.country_code AND is_deleted = FALSE) DESC
    `);

    const countries = result.rows.map((r: any) => {
      const tc = parseInt(r.total_companies);
      const cities = parseInt(r.total_cities);
      const cj = parseInt(r.coverage_jobs);
      return {
        country_code: r.country_code, country_name: r.country_name,
        latitude: r.latitude, longitude: r.longitude,
        total_cities: cities, total_companies: tc,
        coverage_jobs: cj, lead_density: cities > 0 ? Math.round(tc / cities * 10) / 10 : 0,
        avg_website_score: Math.round(parseFloat(r.avg_website_score) * 10) / 10,
        coverage_pct: Math.round(cj / Math.max(cities * 5, 1) * 1000) / 10,
        avg_project_value: tc * 15000,
      };
    });

    res.json({ success: true, data: { countries } });
  } catch (error) {
    logger.error('Error getting heatmap data:', error);
    res.status(500).json({ success: false, message: 'Failed to get heatmap data' });
  }
}

// ─── MODULE 6: Predictive Discovery ────────────────────────────────────────

export async function getPredictiveDiscovery(_req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const cityResult = await pool.query(`
      SELECT l.name as city, l.country_code, l.population, l.gdp_usd,
        COALESCE(c.company_count, 0) as existing_companies,
        COALESCE(c.new_week, 0) as new_week,
        (SELECT COUNT(*) FROM campaign_jobs WHERE city_name = l.name AND is_deleted = FALSE) > 0 as has_campaign
      FROM locations l
      LEFT JOIN (
        SELECT city, COUNT(*) as company_count,
          COUNT(*) FILTER (WHERE created_at > $1) as new_week
        FROM companies WHERE is_deleted = FALSE GROUP BY city
      ) c ON c.city = l.name
      WHERE l.location_type = 'city' AND l.is_deleted = FALSE AND l.is_active = TRUE
      ORDER BY l.population DESC NULLS LAST
    `, [weekAgo]);

    const predictions = cityResult.rows.map((r: any) => {
      const existing = parseInt(r.existing_companies) || 0;
      const newWeek = parseInt(r.new_week) || 0;
      const growth = existing > 0 ? newWeek / existing : 0;
      const pop = r.population || 500000;
      const gdp = r.gdp_usd || 0;
      const hasCampaign = r.has_campaign;

      const potential = Math.round(
        (Math.min(pop, 5000000) / 5000000 * 30) +
        (growth * 20 * (existing > 0 ? 1 : 0.5)) +
        (gdp / 100000000000 * 20) +
        (hasCampaign ? 0 : 10) +
        (existing < 50 ? 10 : 0)
      );
      const confidence = Math.min(0.95, Math.round(
        (existing > 0 ? 0.3 : 0.1) + (r.latitude ? 0.3 : 0) + (r.population ? 0.2 : 0.1) + 0.2
      ) * 100) / 100;

      return {
        city: r.city, country_code: r.country_code,
        population: pop, existing_companies: existing,
        growth_rate: Math.round(growth * 1000) / 10,
        has_campaign: hasCampaign, potential_score: potential, confidence,
      };
    });

    predictions.sort((a: any, b: any) => b.potential_score - a.potential_score);

    res.json({
      success: true,
      data: {
        top_locations: predictions.slice(0, 20),
        recommended_campaigns: predictions.slice(0, 5).map((p: any) => ({
          name: `Discover ${p.city}`, location: `${p.city}, ${p.country_code}`,
          expected_results: Math.max(p.existing_companies, 20),
          estimated_cost: Math.round(Math.max(p.existing_companies, 20) * 0.05 * 100) / 100,
          confidence: p.confidence,
          reasoning: `Potential ${p.potential_score}/100, pop ${p.population.toLocaleString()}`,
        })),
      },
    });
  } catch (error) {
    logger.error('Error getting predictive discovery:', error);
    res.status(500).json({ success: false, message: 'Failed to get predictive discovery' });
  }
}

// ─── MODULE 7: Self-Optimising Pipeline ────────────────────────────────────

export async function getPipelineOptimizations(_req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();

    const [queued, running, completed, failed] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM campaign_jobs WHERE status = 'queued' AND is_deleted = FALSE"),
      pool.query("SELECT COUNT(*) FROM campaign_jobs WHERE status = 'running' AND is_deleted = FALSE"),
      pool.query("SELECT COUNT(*) FROM campaign_jobs WHERE status = 'completed' AND is_deleted = FALSE"),
      pool.query("SELECT COUNT(*) FROM campaign_jobs WHERE status = 'failed' AND is_deleted = FALSE"),
    ]);

    const q = parseInt(queued.rows[0].count);
    const r = parseInt(running.rows[0].count);
    const comp = parseInt(completed.rows[0].count);
    const fail = parseInt(failed.rows[0].count);
    const total = q + r + comp + fail;
    const successRate = comp + fail > 0 ? Math.round(comp / (comp + fail) * 1000) / 1000 : 0;
    const failureRate = total > 0 ? Math.round(fail / total * 1000) / 1000 : 0;

    const avgResult = await pool.query(`
      SELECT COALESCE(AVG(runtime_ms), 0) as avg_runtime
      FROM campaign_jobs WHERE runtime_ms IS NOT NULL AND is_deleted = FALSE
    `);
    const avgRuntime = parseInt(avgResult.rows[0].avg_runtime) || 0;

    const errorsResult = await pool.query(`
      SELECT error_message, COUNT(*) as cnt
      FROM campaign_jobs WHERE status = 'failed' AND error_message IS NOT NULL AND is_deleted = FALSE
      GROUP BY error_message ORDER BY cnt DESC LIMIT 5
    `);

    const recommendations: any[] = [];
    if (failureRate > 0.3) recommendations.push({ title: 'High failure rate', description: `${Math.round(failureRate * 100)}% failure rate. Review providers.`, confidence: 0.9, priority: 9 });
    if (q > r * 10) recommendations.push({ title: 'Queue backlog', description: `${q} queued vs ${r} running. Increase concurrency.`, confidence: 0.85, priority: 8 });
    if (avgRuntime > 60000) recommendations.push({ title: 'Jobs running slowly', description: `Avg ${Math.round(avgRuntime / 1000)}s. Check provider latency.`, confidence: 0.8, priority: 7 });
    if (successRate > 0.95 && total > 10) recommendations.push({ title: 'High success rate', description: `${Math.round(successRate * 100)}% success. Safe to increase throughput.`, confidence: 0.75, priority: 5 });

    res.json({
      success: true,
      data: {
        queue: { queued: q, running: r, completed: comp, failed: fail, total },
        metrics: { success_rate: successRate, failure_rate: failureRate, avg_runtime_ms: avgRuntime },
        top_errors: errorsResult.rows.map((e: any) => ({ error: e.error_message?.slice(0, 100), count: parseInt(e.cnt) })),
        recommendations,
      },
    });
  } catch (error) {
    logger.error('Error getting pipeline optimizations:', error);
    res.status(500).json({ success: false, message: 'Failed to get pipeline optimizations' });
  }
}

// ─── MODULE 8: Discovery Economics ─────────────────────────────────────────

export async function getEconomicsData(_req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();
    const [companies, leads, opportunities, searchJobs, audits, campaigns] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM companies WHERE is_deleted = FALSE'),
      pool.query('SELECT COUNT(*) FROM leads WHERE is_deleted = FALSE'),
      pool.query('SELECT COUNT(*) FROM opportunities'),
      pool.query('SELECT COUNT(*) FROM search_jobs WHERE is_deleted = FALSE'),
      pool.query('SELECT COUNT(*) FROM audits WHERE is_deleted = FALSE'),
      pool.query('SELECT COALESCE(SUM(total_businesses),0) as tb, COALESCE(SUM(unique_businesses),0) as ub, COALESCE(SUM(provider_requests),0) as pr, COALESCE(SUM(estimated_cost_usd),0) as cost FROM discovery_campaigns WHERE is_deleted = FALSE'),
    ]);

    const tc = parseInt(companies.rows[0].count);
    const tl = parseInt(leads.rows[0].count);
    const to = parseInt(opportunities.rows[0].count);
    const sj = parseInt(searchJobs.rows[0].count);
    const ta = parseInt(audits.rows[0].count);
    const camp = campaigns.rows[0];

    res.json({
      success: true,
      data: {
        totals: {
          companies: tc, leads: tl, opportunities: to,
          search_jobs: sj, audits: ta,
          businesses_discovered: parseInt(camp.tb),
        },
        costs: {
          total_cost_usd: Math.round(parseFloat(camp.cost) * 100) / 100,
          cost_per_company: tc > 0 ? Math.round(parseFloat(camp.cost) / tc * 10000) / 10000 : 0,
          cost_per_enriched: parseInt(camp.ub) > 0 ? Math.round(parseFloat(camp.cost) / parseInt(camp.ub) * 10000) / 10000 : 0,
          cost_per_proposal: to > 0 ? Math.round(parseFloat(camp.cost) / to * 10000) / 10000 : 0,
          provider_requests: parseInt(camp.pr),
        },
        efficiency: {
          dedup_rate: parseInt(camp.tb) > 0 ? Math.round((1 - parseInt(camp.ub) / parseInt(camp.tb)) * 1000) / 1000 : 0,
          enrichment_rate: parseInt(camp.tb) > 0 ? Math.round(parseInt(camp.ub) / parseInt(camp.tb) * 1000) / 1000 : 0,
          proposal_rate: tl > 0 ? Math.round(to / tl * 1000) / 1000 : 0,
        },
      },
    });
  } catch (error) {
    logger.error('Error getting economics data:', error);
    res.status(500).json({ success: false, message: 'Failed to get economics data' });
  }
}

// ─── MODULE 9: Global Benchmarks ───────────────────────────────────────────

export async function getBenchmarks(_req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();

    const countryResult = await pool.query(`
      SELECT l.name as entity, l.country_code,
        (SELECT COUNT(*) FROM companies WHERE country = l.country_code AND is_deleted = FALSE) as total_companies,
        (SELECT COALESCE(AVG(a.overall_score), 0) FROM audits a JOIN websites w ON a.website_id = w.id JOIN companies c ON w.company_id = c.id WHERE c.country = l.country_code AND a.is_deleted = FALSE) as avg_website_score,
        (SELECT COALESCE(AVG(a.seo_score), 0) FROM audits a JOIN websites w ON a.website_id = w.id JOIN companies c ON w.company_id = c.id WHERE c.country = l.country_code AND a.is_deleted = FALSE) as avg_seo_score,
        (SELECT COALESCE(AVG(a.design_score), 0) FROM audits a JOIN websites w ON a.website_id = w.id JOIN companies c ON w.company_id = c.id WHERE c.country = l.country_code AND a.is_deleted = FALSE) as avg_design_score,
        (SELECT COALESCE(AVG(a.performance_score), 0) FROM audits a JOIN websites w ON a.website_id = w.id JOIN companies c ON w.company_id = c.id WHERE c.country = l.country_code AND a.is_deleted = FALSE) as avg_performance_score,
        (SELECT COALESCE(AVG(c2.rating), 0) FROM companies c2 WHERE c2.country = l.country_code AND c2.is_deleted = FALSE AND c2.rating > 0) as avg_rating,
        (SELECT COALESCE(AVG(c2.review_count), 0) FROM companies c2 WHERE c2.country = l.country_code AND c2.is_deleted = FALSE AND c2.review_count > 0) as avg_review_count
      FROM locations l
      WHERE l.location_type = 'country' AND l.is_deleted = FALSE AND l.is_active = TRUE
      ORDER BY (SELECT COUNT(*) FROM companies WHERE country = l.country_code AND is_deleted = FALSE) DESC
    `);

    const indResult = await pool.query(`
      SELECT i.name as entity,
        (SELECT COUNT(*) FROM companies WHERE industry = i.name AND is_deleted = FALSE) as total_companies,
        (SELECT COALESCE(AVG(a.overall_score), 0) FROM audits a JOIN websites w ON a.website_id = w.id JOIN companies c ON w.company_id = c.id WHERE c.industry = i.name AND a.is_deleted = FALSE) as avg_website_score,
        (SELECT COALESCE(AVG(c2.rating), 0) FROM companies c2 WHERE c2.industry = i.name AND c2.is_deleted = FALSE AND c2.rating > 0) as avg_rating
      FROM industries i
      WHERE i.is_deleted = FALSE AND i.is_active = TRUE AND i.parent_id IS NOT NULL
      AND (SELECT COUNT(*) FROM companies WHERE industry = i.name AND is_deleted = FALSE) > 0
      ORDER BY (SELECT COUNT(*) FROM companies WHERE industry = i.name AND is_deleted = FALSE) DESC
    `);

    res.json({
      success: true,
      data: {
        country_benchmarks: countryResult.rows.map((r: any) => ({
          entity: r.entity, country_code: r.country_code,
          total_companies: parseInt(r.total_companies),
          avg_website_score: Math.round(parseFloat(r.avg_website_score) * 10) / 10,
          avg_seo_score: Math.round(parseFloat(r.avg_seo_score) * 10) / 10,
          avg_design_score: Math.round(parseFloat(r.avg_design_score) * 10) / 10,
          avg_performance_score: Math.round(parseFloat(r.avg_performance_score) * 10) / 10,
          avg_rating: Math.round(parseFloat(r.avg_rating) * 100) / 100,
          avg_review_count: Math.round(parseFloat(r.avg_review_count)),
        })),
        industry_benchmarks: indResult.rows.map((r: any) => ({
          entity: r.entity,
          total_companies: parseInt(r.total_companies),
          avg_website_score: Math.round(parseFloat(r.avg_website_score) * 10) / 10,
          avg_rating: Math.round(parseFloat(r.avg_rating) * 100) / 100,
        })),
      },
    });
  } catch (error) {
    logger.error('Error getting benchmarks:', error);
    res.status(500).json({ success: false, message: 'Failed to get benchmarks' });
  }
}

// ─── MODULE 10: Executive AI ───────────────────────────────────────────────

export async function getExecutiveReport(_req: Request, res: Response): Promise<void> {
  try {
    const pool = getPool();

    const latestReport = await pool.query(
      'SELECT * FROM executive_ai_reports WHERE is_deleted = FALSE ORDER BY report_date DESC LIMIT 1'
    );

    if (latestReport.rows.length > 0) {
      res.json({ success: true, data: latestReport.rows[0] });
      return;
    }

    res.json({ success: true, data: null, message: 'No reports generated yet. POST to generate one.' });
  } catch (error) {
    logger.error('Error getting executive report:', error);
    res.status(500).json({ success: false, message: 'Failed to get executive report' });
  }
}

export async function generateExecutiveReport(_req: Request, res: Response): Promise<void> {
  try {
    const enqueuerUrl = process.env.TASK_ENQUEUER_URL || 'http://task-enqueuer:8002';
    const response = await axios.post(`${enqueuerUrl}/enqueue`, {
      task: 'worker.tasks.intelligence_analytics.generate_executive_report',
      args: [],
      kwargs: {},
      queue: 'search',
    });
    res.json({ success: true, data: { task_id: response.data?.task_id, status: 'queued' } });
  } catch (err: any) {
    logger.warn(`Could not enqueue executive report task: ${err.message}`);
    res.status(500).json({ success: false, message: 'Failed to generate report' });
  }
}
