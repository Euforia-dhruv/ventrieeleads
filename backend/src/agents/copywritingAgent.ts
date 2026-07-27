import { logger } from '../core/logger';

interface CopywritingOptions {
  tone: 'professional' | 'friendly' | 'persuasive' | 'luxury' | 'casual' | 'formal';
  length: 'short' | 'medium' | 'long';
  includeCTA: boolean;
  includePricing: boolean;
  personalized: boolean;
}

class CopywritingAgent {
  generateEmail(
    companyName: string,
    leadData: Record<string, any>,
    context: string,
    options?: Partial<CopywritingOptions>
  ): { subject: string; body: string; followUpSubject: string; followUpBody: string } {
    const opts: CopywritingOptions = {
      tone: 'professional',
      length: 'medium',
      includeCTA: true,
      includePricing: false,
      personalized: true,
      ...options
    };

    logger.info(`CopywritingAgent: Generating email for ${companyName}`);

    const { subject, body } = this.generatePrimaryEmail(companyName, leadData, context, opts);
    const { subject: followUpSubject, body: followUpBody } = this.generateFollowUpEmail(companyName, leadData, opts);

    return { subject, body, followUpSubject, followUpBody };
  }

  generateProposal(
    companyName: string,
    leadData: Record<string, any>,
    auditResult?: Record<string, any>
  ): { title: string; summary: string; scope: string[]; timeline: string; pricing: string } {
    logger.info(`CopywritingAgent: Generating proposal for ${companyName}`);

    const scope = this.generateScope(auditResult, leadData);
    const timeline = this.estimateTimeline(scope.length);
    const pricing = this.estimatePricing(auditResult?.websiteScore || 0, scope.length);

    return {
      title: `Web Development Proposal for ${companyName}`,
      summary: `We have analyzed ${companyName}'s website and identified ${scope.length} key areas for improvement. This proposal outlines the recommended scope of work, timeline, and expected ROI.`,
      scope,
      timeline,
      pricing
    };
  }

  private generatePrimaryEmail(
    companyName: string,
    leadData: Record<string, any>,
    context: string,
    opts: CopywritingOptions
  ): { subject: string; body: string } {
    const subjectTemplates = {
      professional: `Helping ${companyName} Grow with a Stronger Online Presence`,
      friendly: `Quick Idea for ${companyName}'s Website?`,
      persuasive: `Your Website Costing You Customers - Here's How We Can Fix That`,
      luxury: `${companyName}: Elevating Your Digital Presence`,
      casual: `Hey ${companyName}! Got a Quick Idea?`,
      formal: `[Subject TBD]`
    };

    const bodyTemplates = {
      professional: `Dear ${companyName} Team,

I came across ${companyName} while researching businesses in ${leadData.location || 'your area'} and was impressed by what you do.

After analyzing your current web presence, I've identified several opportunities to strengthen your digital footprint and attract more qualified leads.

Key findings:
- Your website shows strong potential for growth
- There are clear opportunities to improve online visibility
- Your business is well-positioned for increased digital engagement

I'd love to share a few specific recommendations that could make a meaningful impact on your business.

Would you be open to a brief 15-minute call this week?

Best regards`,
      friendly: `Hi there!

I recently came across ${companyName} and wanted to reach out with a quick idea that could help your business stand out online.

We specialize in helping businesses like yours get more leads through smart website improvements and digital marketing strategies.

No pressure at all - just thought it'd be worth a quick chat!

Would you have 15 minutes this week?`,
      persuasive: `Are You Leaving Money on the Table?

I analyzed ${companyName}'s website and found specific opportunities that could significantly increase your qualified leads and revenue.

Most businesses in ${leadData.industry || 'your sector'} leave 30-50% of potential revenue on the table because of preventable website issues.

I'd like to show you exactly what's holding ${companyName} back and how we can fix it.

Want me to send over a free audit report? It only takes 2 minutes to review.`,
      luxury: `Exclusive Opportunity for ${companyName}`,
      casual: `Hi! Quick thought about ${companyName}'s web presence...`
    };

    const subject = subjectTemplates[opts.tone] || subjectTemplates.professional;
    let body = bodyTemplates[opts.tone] || bodyTemplates.professional;

    if (context) {
      body += `\n\nContext: ${context}`;
    }

    if (opts.includeCTA) {
      body += `\n\nWould you be available for a quick 15-minute call to discuss?`;
    }

    return { subject, body };
  }

  private generateFollowUpEmail(
    companyName: string,
    leadData: Record<string, any>,
    opts: CopywritingOptions
  ): { subject: string; body: string } {
    return {
      subject: `Following Up - ${companyName} Web Opportunity`,
      body: `Hi again,

Just circling back on my previous message about an opportunity I spotted for ${companyName}.

I know you're busy, so I'll keep this short: we've helped ${leadData.industry || 'similar'} businesses in your area grow their online presence and increase qualified leads by an average of 40%.

Would it make sense to connect briefly this week?

If now isn't a good time, I completely understand. Feel free to reply when you have a moment.

Best regards`
    };
  }

  private generateScope(auditResult: Record<string, any> | undefined, leadData: Record<string, any>): string[] {
    const scope: string[] = [];

    if (!auditResult) {
      scope.push('Full website audit and analysis');
      scope.push('SEO optimization');
      scope.push('Conversion rate optimization');
      scope.push('Mobile responsiveness improvements');
      return scope;
    }

    if (auditResult.businessScore < 50) {
      scope.push('Brand identity and messaging review');
    }

    if (auditResult.websiteScore < 60) {
      scope.push('Website performance optimization');
    }

    if (auditResult.seoScore < 50) {
      scope.push('SEO audit and on-page optimization');
    }

    if (auditResult.conversionScore < 50) {
      scope.push('Conversion rate optimization (CRO)');
    }

    if (!auditResult.checks?.hasAnalytics) {
      scope.push('Analytics implementation and tracking setup');
    }

    if (!auditResult.checks?.hasWhatsApp) {
      scope.push('WhatsApp business integration');
    }

    if (auditResult.checks?.speed === 'slow') {
      scope.push('Website speed optimization');
    }

    if (!auditResult.checks?.hasCTAs) {
      scope.push('Call-to-action strategy and implementation');
    }

    if (scope.length === 0) {
      scope.push('Website maintenance and continuous improvement');
    }

    return scope;
  }

  private estimateTimeline(scopeLength: number): string {
    if (scopeLength <= 3) return '2-4 weeks';
    if (scopeLength <= 6) return '4-8 weeks';
    if (scopeLength <= 10) return '8-12 weeks';
    return '12+ weeks';
  }

  private estimatePricing(websiteScore: number, scopeLength: number): string {
    const basePrice = websiteScore < 30 ? 15000 : websiteScore < 50 ? 25000 : websiteScore < 70 ? 40000 : 55000;
    const multiplier = 1 + (scopeLength * 0.15);
    const total = Math.round(basePrice * multiplier);
    return `$${total.toLocaleString()} - ${Math.round(total * 1.3).toLocaleString()}`;
  }
}

export const copywritingAgent = new CopywritingAgent();
export type { CopywritingOptions };
