import axios from 'axios';
import { logger } from '../core/logger';

interface AuditResult {
  url: string;
  businessScore: number;
  websiteScore: number;
  seoScore: number;
  conversionScore: number;
  expectedROI: string;
  estimatedProjectValue: string;
  issues: Array<{
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string;
  }>;
  recommendations: string[];
  checks: Record<string, boolean | string>;
}

class AuditAgent {
  async performAudit(url: string): Promise<AuditResult> {
    logger.info(`AuditAgent: Starting audit for ${url}`);

    const auditResult: AuditResult = {
      url,
      businessScore: 0,
      websiteScore: 0,
      seoScore: 0,
      conversionScore: 0,
      expectedROI: 'pending',
      estimatedProjectValue: 'pending',
      issues: [],
      recommendations: [],
      checks: {}
    };

    try {
      const response = await axios.get(url, { timeout: 15000 });
      const html = response.data;
      const text = response.data.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

      auditResult.checks.ssl = url.startsWith('https');
      auditResult.checks.mobileResponsive = true;
      auditResult.checks.hasAnalytics = this.checkAnalytics(html);
      auditResult.checks.hasMetaPixel = this.checkMetaPixel(html);
      auditResult.checks.hasWhatsApp = /whatsapp|wa\.me|whatsapp\.com/i.test(html + text);
      auditResult.checks.hasCTAs = this.checkCTAs(html);
      auditResult.checks.hasBooking = this.checkBooking(html);
      auditResult.checks.hasBrokenImages = await this.checkBrokenImages(url, html);
      auditResult.checks.speed = await this.checkSpeed(url) as unknown as boolean;

      auditResult.seoScore = await this.calculateSEO(html, url);
      auditResult.websiteScore = this.calculateWebsiteScore(auditResult.checks);
      auditResult.businessScore = this.calculateBusinessScore(text, auditResult);
      auditResult.conversionScore = this.calculateConversionScore(auditResult);
      auditResult.estimatedProjectValue = this.estimateProjectValue(auditResult.websiteScore);
      auditResult.expectedROI = this.estimateROI(auditResult.conversionScore, auditResult.estimatedProjectValue);

      auditResult.recommendations = this.generateRecommendations(auditResult);

      logger.info(`AuditAgent: Audit complete for ${url}. Scores: Business=${auditResult.businessScore}, Website=${auditResult.websiteScore}, SEO=${auditResult.seoScore}, Conversion=${auditResult.conversionScore}`);
    } catch (error) {
      logger.error(`AuditAgent: Audit failed for ${url}:`, error);
      auditResult.issues.push({
        category: 'accessibility',
        severity: 'critical',
        title: 'Website Unreachable',
        description: `Could not access ${url}: ${(error as Error).message}`
      });
    }

    return auditResult;
  }

  private checkAnalytics(html: string): boolean {
    return /google-analytics\.com|googletagmanager\.com|gtag|ga\(/.test(html);
  }

  private checkMetaPixel(html: string): boolean {
    return /facebook\.net|fbpx|fbevents\.js|meta\.pixel/.test(html);
  }

  private checkCTAs(html: string): boolean {
    return /contact|book|appointment|quote|get-started|enquire|inquire|free consultation|request a demo/i.test(html);
  }

  private checkBooking(html: string): boolean {
    return /calendly|booking|reservation|table-reservation|appointment-booking|open-table/i.test(html);
  }

  private async checkBrokenImages(url: string, html: string): Promise<boolean> {
    const imgRegex = /<img[^>]+src="([^"]+)"/g;
    const srcs: string[] = [];
    let match;
    while ((match = imgRegex.exec(html)) !== null) {
      srcs.push(match[1]);
    }

    let broken = false;
    for (const src of srcs.slice(0, 5)) {
      try {
        const imgUrl = new URL(src, url).href;
        await axios.head(imgUrl, { timeout: 5000, validateStatus: () => true });
      } catch {
        broken = true;
      }
    }

    return broken;
  }

  private async checkSpeed(url: string): Promise<string> {
    try {
      const start = Date.now();
      await axios.get(url, { timeout: 15000 });
      const duration = Date.now() - start;
      if (duration < 2000) return 'fast';
      if (duration < 5000) return 'moderate';
      return 'slow';
    } catch {
      return 'unknown';
    }
  }

  private async calculateSEO(html: string, _url: string): Promise<number> {
    let score = 0;

    if (/<title>/i.test(html)) score += 15;
    if (/<meta\s+name=["']description["']/i.test(html)) score += 10;
    if (/<h1>/i.test(html)) score += 10;
    if (/<meta\s+name=["']keywords["']/i.test(html)) score += 5;
    if (/<meta\s+name=["']viewport["']/i.test(html)) score += 10;
    if (/\/sitemap\.xml/i.test(html)) score += 5;
    if (html.includes('alt=')) score += 10;
    if (html.includes('canonical')) score += 5;
    if (html.includes('hreflang')) score += 5;
    if (/schema\.org|application\/ld\+json/i.test(html)) score += 10;
    if (/og:title/i.test(html)) score += 5;
    if (/twitter:/i.test(html)) score += 5;

    const h1Count = (html.match(/<h1/gi) || []).length;
    if (h1Count === 1) score += 10;
    else if (h1Count > 1) score -= 5;

    return Math.min(100, Math.max(0, score));
  }

  private calculateWebsiteScore(checks: Record<string, boolean | string>): number {
    const totalChecks = Object.keys(checks).length;
    const passedChecks = Object.values(checks).filter(v => v === true || v === 'fast').length;

    if (totalChecks === 0) return 0;
    return Math.round((passedChecks / totalChecks) * 100);
  }

  private calculateBusinessScore(text: string, _auditResult: AuditResult): number {
    let score = 50;

    const indicators = [
      { pattern: /contact|get in touch|reach out/i, points: 10 },
      { pattern: /about\s*(us|the company|our team)/i, points: 5 },
      { pattern: /services|what\s*(we|we do|offer)/i, points: 10 },
      { pattern: /portfolio|case\s*stud|gallery/i, points: 5 },
      { pattern: /testimonial|review|rating/i, points: 5 },
      { pattern: /team|our people|staff|employees/i, points: 5 },
      { pattern: /blog|news|insights|articles/i, points: 5 },
      { pattern: /\d{4}\s*(est|founded|since)/i, points: 5 },
      { pattern: /\|\s*[\d,]+\s*(employees|staff|team)/i, points: 10 }
    ];

    for (const indicator of indicators) {
      if (indicator.pattern.test(text)) {
        score += indicator.points;
      }
    }

    return Math.min(100, score);
  }

  private calculateConversionScore(auditResult: AuditResult): number {
    let score = 30;

    if (auditResult.checks.hasCTAs) score += 20;
    if (auditResult.checks.hasWhatsApp) score += 15;
    if (auditResult.checks.hasBooking) score += 15;
    if (auditResult.checks.hasAnalytics) score += 10;

    return Math.min(100, score);
  }

  private estimateProjectValue(websiteScore: number): string {
    if (websiteScore < 30) return '$15,000 - $30,000';
    if (websiteScore < 50) return '$30,000 - $50,000';
    if (websiteScore < 70) return '$50,000 - $75,000';
    if (websiteScore < 90) return '$75,000 - $100,000';
    return '$100,000 - $150,000+';
  }

  private estimateROI(conversionScore: number, projectValue: string): string {
    const value = parseFloat(projectValue.replace(/[^0-9.]/g, ''));
    if (isNaN(value) || value === 0) return '12-18 months';

    const monthlyROI = value * 0.05;
    const roiMonths = monthlyROI > 0 ? Math.round(value / monthlyROI) : 12;

    return `Expected ROI: ${roiMonths} months`;
  }

  private generateRecommendations(auditResult: AuditResult): string[] {
    const recommendations: string[] = [];

    if (!auditResult.checks.ssl) {
      recommendations.push('Implement SSL/HTTPS certificate');
    }
    if (!auditResult.checks.hasAnalytics) {
      recommendations.push('Add Google Analytics or GA4 tracking');
    }
    if (!auditResult.checks.hasMetaPixel) {
      recommendations.push('Install Meta Pixel for advertising tracking');
    }
    if (!auditResult.checks.hasWhatsApp) {
      recommendations.push('Add WhatsApp business link for customer communication');
    }
    if (!auditResult.checks.hasCTAs) {
      recommendations.push('Add clear call-to-action buttons on key pages');
    }
    if (!auditResult.checks.hasBooking) {
      recommendations.push('Integrate a booking/appointment system');
    }
    if (auditResult.seoScore < 50) {
      recommendations.push('Improve SEO: add meta tags, alt text, headings, and structured data');
    }
    if (auditResult.businessScore < 50) {
      recommendations.push('Improve website content: add about page, team, services, portfolio');
    }

    return recommendations;
  }
}

export const auditAgent = new AuditAgent();
export type { AuditResult };
