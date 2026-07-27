import { logger } from '../core/logger';
import { aiIntegration } from '../ai/integrations';

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
      status: 'draft'
    };
  }

  async generatePDF(proposal: Proposal): Promise<Buffer> {
    logger.info(`ProposalAgent: Generating PDF for proposal #${proposal.id || proposal.leadId}`);
    // In production, use a PDF generation library like puppeteer or docx
    return Buffer.from('PDF content placeholder');
  }

  async sendProposal(proposal: Proposal, email: string): Promise<boolean> {
    logger.info(`ProposalAgent: Sending proposal #${proposal.id || proposal.leadId} to ${email}`);
    // In production, integrate with email service
    return true;
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

  private estimatePricing(websiteScore: number, scopeLength: number): { low: number; high: number; currency: string; interval: string } {
    const basePrice = websiteScore < 30 ? 15000 : websiteScore < 50 ? 25000 : websiteScore < 70 ? 40000 : 55000;
    const multiplier = 1 + (scopeLength * 0.15);
    const low = Math.round(basePrice * multiplier);
    const high = Math.round(low * 1.3);
    return { low, high, currency: 'AED', interval: 'one-time' };
  }
}

export const proposalAgent = new ProposalAgent();
export type { Proposal };
