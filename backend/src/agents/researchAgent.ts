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
      ...options,
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
      keyPeople: [],
    };

    if (opts.includeTechStack) {
      try {
        data.technologies = await this.detectTechStack(website);
      } catch (error) {
        logger.error('ResearchAgent: Tech stack detection failed:', error);
      }
    }

    if (opts.includeSocial) {
      try {
        data.socialProfiles = await this.discoverSocialProfiles(companyName);
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
      const response = await axios.get(website, { timeout: 15000 });
      const html: string = typeof response.data === 'string' ? response.data : String(response.data);

      if (html.includes('wp-content') || html.includes('wp-json')) technologies.push('WordPress');
      if (html.includes('nextjs') || html.includes('__NEXT_DATA__')) technologies.push('Next.js');
      if (html.includes('react-dom') || html.includes('react.production.min')) technologies.push('React');
      if (html.includes('nuxt') || html.includes('vue.config')) technologies.push('Vue.js');
      if (html.includes('angular')) technologies.push('Angular');
      if (html.includes('shopify')) technologies.push('Shopify');
      if (html.includes('bigcommerce')) technologies.push('BigCommerce');
      if (html.includes('cloudflare') || html.includes('cf-ray')) technologies.push('Cloudflare');
      if (html.includes('googletagmanager.com') || html.includes('gtm.js')) technologies.push('Google Tag Manager');
      if (html.includes('google-analytics.com') || html.includes('analytics.js')) technologies.push('Google Analytics');
      if (html.includes('facebook.net') || html.includes('fbpx')) technologies.push('Meta Pixel');
    } catch (error) {
      logger.warn(`Tech stack detection failed for ${website}:`, error);
    }

    return technologies;
  }

  private async discoverSocialProfiles(companyName: string): Promise<Record<string, string>> {
    const profiles: Record<string, string> = {};
    const slug = companyName.toLowerCase().replace(/\s+/g, '-');
    const nospace = companyName.toLowerCase().replace(/\s+/g, '');

    const platforms = [
      { name: 'linkedin', url: `https://www.linkedin.com/company/${slug}` },
      { name: 'twitter', url: `https://twitter.com/${nospace}` },
      { name: 'instagram', url: `https://www.instagram.com/${nospace}` },
      { name: 'facebook', url: `https://www.facebook.com/${nospace}` },
      { name: 'youtube', url: `https://www.youtube.com/@${nospace}` },
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
      const html: string = typeof response.data === 'string' ? response.data : String(response.data);
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
