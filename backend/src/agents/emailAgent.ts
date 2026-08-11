import { logger } from '../core/logger';
import { aiIntegration } from '../ai/integrations';

interface EmailSequence {
  leadId: number;
  campaignId?: number;
  emails: Array<{
    step: number;
    subject: string;
    body: string;
    delay: number;
    status: 'pending' | 'scheduled' | 'sent' | 'opened' | 'replied';
  }>;
}

class EmailAgent {
  async createSequence(leadData: Record<string, any>, industry: string): Promise<EmailSequence> {
    logger.info(`EmailAgent: Creating email sequence for ${leadData.company_name || 'unknown lead'}`);

    const primary = await aiIntegration.generateEmail(leadData, industry, 'Initial outreach');
    const followUp1 = await aiIntegration.generateEmail(leadData, industry, 'Follow-up: sharing case study');
    const followUp2 = await aiIntegration.generateEmail(leadData, industry, 'Follow-up: checking in');
    const followUp3 = await aiIntegration.generateEmail(leadData, industry, 'Final follow-up');

    return {
      leadId: leadData.id || 0,
      campaignId: leadData.campaignId,
      emails: [
        { step: 1, subject: primary.subject, body: primary.body, delay: 0, status: 'pending' },
        { step: 2, subject: followUp1.subject, body: followUp1.body, delay: 3, status: 'pending' },
        { step: 3, subject: followUp2.subject, body: followUp2.body, delay: 7, status: 'pending' },
        { step: 4, subject: followUp3.subject, body: followUp3.body, delay: 14, status: 'pending' },
      ],
    };
  }

  async sendEmail(leadId: number, step: number, _email: EmailSequence['emails'][0]): Promise<boolean> {
    logger.info(`EmailAgent: Sending email step ${step} for lead ${leadId}`);
    // In production, integrate with an email service (SES, SendGrid, etc.)
    return true;
  }

  async scheduleFollowUps(sequence: EmailSequence): Promise<void> {
    for (const email of sequence.emails) {
      if (email.delay > 0 && email.status === 'pending') {
        const sendAt = new Date(Date.now() + email.delay * 24 * 60 * 60 * 1000);
        logger.info(`EmailAgent: Scheduled step ${email.step} for ${sendAt.toISOString()}`);
      }
    }
  }

  async personalize(leadData: Record<string, any>, template: string): Promise<string> {
    const replacements: Record<string, string> = {
      '{{company}}': leadData.company_name || '',
      '{{location}}': leadData.location || '',
      '{{industry}}': leadData.industry || '',
      '{{name}}': leadData.contact_name || '',
      '{{website}}': leadData.company_website || '',
      '{{phone}}': leadData.phone || '',
    };

    let result = template;
    for (const [key, value] of Object.entries(replacements)) {
      result = result.replace(new RegExp(key, 'g'), value);
    }

    return result;
  }
}

export const emailAgent = new EmailAgent();
export type { EmailSequence };
