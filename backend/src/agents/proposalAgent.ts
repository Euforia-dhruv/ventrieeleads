import { logger } from '../core/logger';

interface Proposal {
  id?: number;
  leadId: number;
  leadName: string;
  companyName: string;
  title: string;
  executiveSummary: string;
  scope: string[];
  timeline: string;
  pricing: {
    low: number;
    high: number;
    currency: string;
    interval: string;
  };
  expectedROI: string;
  createdAt: Date;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined';
}

class ProposalAgent {
  async generateProposal(leadData: Record<string, any>, auditResult: any): Promise<Proposal> {
    logger.info(`ProposalAgent: Generating proposal for ${leadData.company_name || 'unknown'}`);

    const scope = this.generateScope(auditResult);
    const timeline = this.estimateTimeline(scope.length);
    const pricing = this.estimatePricing(auditResult?.websiteScore || 0, scope.length);

    return {
      leadId: leadData.id || 0,
      leadName: leadData.contact_name || '',
      companyName: leadData.company_name || '',
      title: `Web Development & Digital Growth Proposal for ${leadData.company_name || 'Your Company'}`,
      executiveSummary: `After conducting a comprehensive audit of ${leadData.company_name || 'your company'}'s digital presence, we identified ${scope.length} key areas where our expertise can drive measurable growth. This proposal outlines our recommended approach, timeline, and investment.`,
      scope,
      timeline,
      pricing,
      expectedROI: auditResult?.expectedROI || '6-12 months',
      createdAt: new Date(),
      status: 'draft',
    };
  }

  async generatePDF(proposal: Proposal): Promise<Buffer> {
    logger.info(`ProposalAgent: Generating PDF for proposal #${proposal.id || proposal.leadId}`);
    const title = proposal.title || `Proposal for ${proposal.companyName}`;
    const lines: string[] = [
      title,
      '',
      `Prepared for: ${proposal.companyName || proposal.leadName}`,
      proposal.leadName ? `Contact: ${proposal.leadName}` : '',
      `Date: ${proposal.createdAt.toISOString().slice(0, 10)}`,
      `Status: ${proposal.status}`,
      '',
      'EXECUTIVE SUMMARY',
      proposal.executiveSummary,
      '',
      'RECOMMENDED SCOPE OF WORK',
      ...proposal.scope.map((item: string, i: number) => `${i + 1}. ${item}`),
      '',
      `TIMELINE: ${proposal.timeline}`,
      '',
      `ESTIMATED INVESTMENT: ${proposal.pricing.currency} ${proposal.pricing.low.toLocaleString()} - ${proposal.pricing.high.toLocaleString()} (${proposal.pricing.interval})`,
      '',
      `EXPECTED ROI: ${proposal.expectedROI}`,
    ];
    return Buffer.from(buildSimplePdf(lines));
  }

  async sendProposal(proposal: Proposal, email: string): Promise<boolean> {
    logger.info(`ProposalAgent: Sending proposal #${proposal.id || proposal.leadId} to ${email}`);
    try {
      const { notificationService } = await import('../services/notificationService');
      await notificationService.send({
        channel: 'email',
        event_type: 'proposal.sent',
        title: `Proposal for ${proposal.companyName || 'your company'}`,
        body:
          `Hi,\n\nPlease find the attached proposal for ${proposal.companyName || 'your company'}.\n\n` +
          `Timeline: ${proposal.timeline}\n` +
          `Estimated investment: ${proposal.pricing.currency} ${proposal.pricing.low.toLocaleString()} - ${proposal.pricing.high.toLocaleString()} (${proposal.pricing.interval})\n\n` +
          `We look forward to working with you.\n\nBest regards,\nVentriee`,
        data: { to: email, proposal_id: proposal.id, company: proposal.companyName },
      });
      return true;
    } catch (error) {
      logger.error('Failed to queue proposal email:', error);
      return false;
    }
  }

  private generateScope(auditResult: any): string[] {
    const scope: string[] = [];

    if (auditResult?.businessScore < 50) scope.push('Brand identity and messaging review');
    if (auditResult?.websiteScore < 60) scope.push('Website performance optimization');
    if (auditResult?.seoScore < 50) scope.push('SEO audit and on-page optimization');
    if (auditResult?.conversionScore < 50) scope.push('Conversion rate optimization');
    if (auditResult?.checks?.hasAnalytics === false) scope.push('Analytics implementation');
    if (auditResult?.checks?.hasWhatsApp === false) scope.push('WhatsApp business integration');
    if (auditResult?.checks?.hasCTAs === false) scope.push('Call-to-action implementation');
    if (auditResult?.checks?.hasBooking === false) scope.push('Booking system integration');
    scope.push('Monthly reporting and optimization');

    if (scope.length === 0) scope.push('Ongoing digital growth support');

    return scope;
  }

  private estimateTimeline(scopeLength: number): string {
    if (scopeLength <= 3) return '2-4 weeks';
    if (scopeLength <= 6) return '4-8 weeks';
    if (scopeLength <= 10) return '8-12 weeks';
    return '12+ weeks';
  }

  private estimatePricing(
    websiteScore: number,
    scopeLength: number,
  ): { low: number; high: number; currency: string; interval: string } {
    const basePrice = websiteScore < 30 ? 15000 : websiteScore < 50 ? 25000 : websiteScore < 70 ? 40000 : 55000;
    const multiplier = 1 + scopeLength * 0.15;
    const low = Math.round(basePrice * multiplier);
    const high = Math.round(low * 1.3);
    return { low, high, currency: 'USD', interval: 'one-time' };
  }
}

export const proposalAgent = new ProposalAgent();
export type { Proposal };

/**
 * Build a minimal, dependency-free single-page PDF from text lines.
 * Produces a valid PDF that opens in any viewer. Pure string math, no libraries.
 */
function buildSimplePdf(lines: string[]): Buffer {
  const pageWidth = 595;
  const margin = 50;
  const maxLineWidth = pageWidth - margin * 2;
  const fontSize = 11;

  const clean = (s: string) =>
    (s || '')
      .split('')
      .filter((c) => c === '\n' || (c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126))
      .join('')
      .substring(0, 500);

  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  objects.push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
  );
  objects.push(
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  );

  const contentParts: string[] = [];
  contentParts.push('BT', `/${'F1'} ${fontSize} Tf`, '50 800 Td', '14 TL');

  for (const raw of lines) {
    let text = clean(raw);
    if (text === '') {
      contentParts.push('0 -16 Td');
      continue;
    }
    // Approximate character width for Helvetica 11pt (~0.5 * fontSize per char)
    const approxWidth = text.length * fontSize * 0.5;
    if (approxWidth > maxLineWidth) {
      // Hard-wrap long lines.
      const maxChars = Math.floor(maxLineWidth / (fontSize * 0.5));
      while (text.length > maxChars) {
        contentParts.push(`(${text.slice(0, maxChars).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')}) Tj`);
        contentParts.push('0 -16 Td');
        text = text.slice(maxChars);
      }
    }
    contentParts.push(`(${text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')}) Tj`);
    contentParts.push('0 -16 Td');
  }

  contentParts.push('ET');

  const stream = contentParts.join('\n');
  objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);

  const body: string[] = [];
  objects.forEach((obj) => {
    body.push(`${body.length + 1} 0 obj`, obj, 'endobj');
  });

  const xrefOffset = 9;
  const xrefEntries: string[] = ['xref'];
  let cumulative = 0;
  body.forEach((obj) => {
    xrefEntries.push(`${cumulative.toString().padStart(10, '0')} 00000 n`);
    cumulative += obj.length + 1;
  });
  xrefEntries.push('trailer', `<< /Size ${objects.length + 1} /Root 1 0 R >>`, 'startxref', `${xrefOffset + cumulative}`, '%%EOF');

  return Buffer.from(`%PDF-1.4\n${body.join('\n')}\n${xrefEntries.join('\n')}\n`, 'binary');
}
