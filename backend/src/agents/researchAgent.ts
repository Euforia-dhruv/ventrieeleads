import axios from 'axios';
import { logger } from '../core/logger';

interface CompanyData {
  name: string;
  website: string;
  description: string;
  founded?: string;
  employees?: string;
  revenue?: string;
  industry: string;
  location: string;
  socialProfiles: Record<string, string>;
  technologies: string[];
  emails: string[];
  phoneNumbers: string[];
  keyPeople: Array<{ name: string; title: string; email: string }>;
}

interface ResearchOptions {
  includeSocial: boolean;
  includeTechStack: boolean;
  includeEmails: boolean;
  includeFinancials: boolean;
  deepScan: boolean;
}

class ResearchAgent {
  async research(companyName: string, website: string, options?: Partial<ResearchOptions>): Promise<CompanyData> {
    const opts: ResearchOptions = {
      includeSocial: true,
      includeTechStack: true,
      includeEmails: true,
      includeFinancials: false,
      deepScan: false,
      ...options
    };

    logger.info(`ResearchAgent: Starting research for ${companyName} (${website})`);

    const data: CompanyData = {
      name: companyName,
      website,
      description: '',
      industry: '',
      location: '',
      socialProfiles: {},
      technologies: [],
      emails: [],
      phoneNumbers: [],
      keyPeople: []
    };

    if (opts.includeTechStack) {
      try {
        const techData = await this.detectTechStack(website);
        data.technologies = techData;
      } catch (error) {
        logger.error('ResearchAgent: Tech stack detection failed:', error);
      }
    }

    if (opts.includeSocial) {
      try {
        const socialData = await this.discoverSocialProfiles(companyName, website);
        data.socialProfiles = socialData;
      } catch (error) {
        logger.error('ResearchAgent: Social discovery failed:', error);
      }
    }

    if (opts.includeEmails) {
      try {
        const emailData = await this.extractEmails(website);
        data.emails = emailData.emails;
        data.phoneNumbers = emailData.phoneNumbers;
      } catch (error) {
        logger.error('ResearchAgent: Email extraction failed:', error);
      }
    }

    logger.info(`ResearchAgent: Research complete for ${companyName}`);
    return data;
  }

  private async detectTechStack(website: string): Promise<string[]> {
    const technologies: string[] = [];

    try {
      const builtwithUrl = `https://api.builtwith.com/v21/api.json?KEY=&LOOKUP=${website}`;
      const response = await axios.get(builtwithUrl, { timeout: 10000 });
      if (response.data && response.data.Results) {
        for (const result of response.data.Results) {
          if (result.Result && result.Result.length) {
            for (const tech of result.Result) {
              technologies.push(tech.Name);
            }
          }
        }
      }
    } catch (error) {
      logger.warn('BuiltWith lookup failed, falling back to basic detection');
    }

    try {
      const response = await axios.get(website, { timeout: 15000 });
      const html = response.data;

      if (html.includes('wp-content') || html.includes('wp-json')) {
        technologies.push('WordPress');
      }
      if (html.includes('nextjs') || html.includes('__NEXT_DATA__')) {
        technologies.push('Next.js');
      }
      if (html.includes('react-dom') || html.includes('react.production.min')) {
        technologies.push('React');
      }
      if (html.includes('nuxt') || html.includes('vue.config')) {
        technologies.push('Vue.js');
      }
      if (html.includes('angular')) {
        technologies.push('Angular');
      }
      if (html.includes('shopify')) {
        technologies.push('Shopify');
      }
      if (html.includes('bigcommerce')) {
        technologies.push('BigCommerce');
      }
      if (html.includes('cloudflare') || html.includes('cf-ray')) {
        technologies.push('Cloudflare');
      }
      if (html.includes('googletagmanager.com') || html.includes('gtm.js')) {
        technologies.push('Google Tag Manager');
      }
      if (html.includes('google-analytics.com') || html.includes('analytics.js')) {
        technologies.push('Google Analytics');
      }
      if (html.includes('facebook.net') || html.includes('fbpx')) {
        technologies.push('Meta Pixel');
      }

      const metaTags = [
        { pattern: /generator:\s*"?([^"?\s]+)/i, name: 'CMS' },
        { pattern: /powered-by[:\s]+([^"<\s]+)/i, name: 'Framework' }
      ];

      for (const tag of metaTags) {
        const match = html.match(tag.pattern);
        if (match && !technologies.includes(tag.name)) {
          technologies.push(`${tag.name}: ${match[1]}`);
        }
      }
    } catch (error) {
      logger.warn(`Tech stack detection failed for ${website}:`, error);
    }

    return technologies;
  }

  private async discoverSocialProfiles(companyName: string, website: string): Promise<Record<string, string>> {
    const profiles: Record<string, string> = {};

    const platforms = [
      { name: 'linkedin', url: `https://www.linkedin.com/company/${companyName.toLowerCase().replace(/\s+/g, '-')}` },
      { name: 'twitter', url: `https://twitter.com/${companyName.toLowerCase().replace(/\s+/g, '')}` },
      { name: 'instagram', url: `https://www.instagram.com/${companyName.toLowerCase().replace(/\s+/g, '')}` },
      { name: 'facebook', url: `https://www.facebook.com/${companyName.toLowerCase().replace(/\s+/g, '')}` },
      { name: 'youtube', url: `https://www.youtube.com/@${companyName.toLowerCase().replace(/\s+/g, '')}` }
    ];

    for (const platform of platforms) {
      try {
        const response = await axios.head(platform.url, { timeout: 5000, validateStatus: () => true });
        if (response.status === 200) {
          profiles[platform.name] = platform.url;
        }
      } catch {
        // Platform not found or unreachable, skip
      }
    }

    return profiles;
  }

  private async extractEmails(website: string): Promise<{ emails: string[]; phoneNumbers: string[] }> {
    const emails: string[] = [];
    const phoneNumbers: string[] = [];

    try {
      const response = await axios.get(website, { timeout: 15000 });
      const html = response.data;
      const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');

      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const foundEmails = text.match(emailRegex);
      if (foundEmails) {
        emails.push(...new Set(foundEmails));
      }

      const phoneRegex = /(?:\+?(\d{1,3})?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
      const foundPhones = text.match(phoneRegex);
      if (foundPhones) {
        phoneNumbers.push(...new Set(foundPhones));
      }
    } catch (error) {
      logger.warn(`Email extraction failed for ${website}:`, error);
    }

    return { emails, phoneNumbers };
  }
}

export const researchAgent = new ResearchAgent();
export type { CompanyData, ResearchOptions };
