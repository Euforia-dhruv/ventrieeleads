import axios from 'axios';
import { logger } from '../core/logger';
import { getPool } from '../database/connection';
import { createLead } from '../database/queries';

interface SearchResult {
  name: string;
  address: string;
  phone: string;
  website: string;
  rating: number;
  reviews: number;
  category: string;
  location: string;
}

interface ScoutConfig {
  query: string;
  location: string;
  city: string;
  country: string;
  industry: string;
  maxResults: number;
  source: string;
}

class ScoutAgent {
  async searchGoogleMaps(config: ScoutConfig): Promise<SearchResult[]> {
    logger.info(`ScoutAgent: Searching Google Maps for "${config.query}" in ${config.location}`);

    if (!process.env.GOOGLE_MAPS_API_KEY) {
      logger.warn('Google Maps API key not configured');
      return [];
    }

    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/place/textsearch/json`,
        {
          params: {
            query: `${config.query} ${config.location}`,
            key: process.env.GOOGLE_MAPS_API_KEY,
            region: config.country || 'AE',
            language: 'en',
            type: 'establishment'
          },
          timeout: 15000
        }
      );

      if (response.data.status !== 'OK') {
        logger.warn(`Google Maps API returned status: ${response.data.status}`);
        return [];
      }

      const results = response.data.results.slice(0, config.maxResults).map((place: any) => ({
        name: place.name,
        address: place.formatted_address || '',
        phone: place.formatted_phone_number || '',
        website: place.website || '',
        rating: place.rating || 0,
        reviews: place.user_ratings_total || 0,
        category: place.types?.[0] || config.industry,
        location: config.location
      }));

      logger.info(`ScoutAgent: Found ${results.length} results from Google Maps`);
      return results;
    } catch (error) {
      logger.error('ScoutAgent: Google Maps search failed:', error);
      return [];
    }
  }

  async searchDubaiBusinessDirectory(config: ScoutConfig): Promise<SearchResult[]> {
    logger.info(`ScoutAgent: Searching Dubai Business Directory for "${config.query}"`);

    try {
      const response = await axios.get(
        `https://api.dubai-businessdirectory.com/v2/search`,
        {
          params: {
            q: config.query,
            location: config.location,
            category: config.industry,
            limit: config.maxResults
          },
          timeout: 15000
        }
      );

      return (response.data?.results || []).map((item: any) => ({
        name: item.name,
        address: item.address || '',
        phone: item.phone || '',
        website: item.website || '',
        rating: item.rating || 0,
        reviews: 0,
        category: item.category || config.industry,
        location: config.location
      }));
    } catch (error) {
      logger.error('ScoutAgent: Dubai Business Directory search failed:', error);
      return [];
    }
  }

  async searchYellowPages(config: ScoutConfig): Promise<SearchResult[]> {
    logger.info(`ScoutAgent: Searching Yellow Pages for "${config.query}"`);
    return [];
  }

  async searchYelloUAE(config: ScoutConfig): Promise<SearchResult[]> {
    logger.info(`ScoutAgent: Searching Yello UAE for "${config.query}"`);
    return [];
  }

  async searchCrunchbase(config: ScoutConfig): Promise<SearchResult[]> {
    logger.info(`ScoutAgent: Searching Crunchbase for "${config.query}"`);
    return [];
  }

  async discover(config: ScoutConfig): Promise<SearchResult[]> {
    logger.info(`ScoutAgent: Starting discovery for "${config.query}" in ${config.location}`);

    const results = await this.searchGoogleMaps(config);

    const dedupResults = this.deduplicate(results);

    logger.info(`ScoutAgent: Discovery complete. Found ${dedupResults.length} unique leads`);
    return dedupResults;
  }

  async discoverAndStore(config: ScoutConfig): Promise<{ found: number; stored: number }> {
    const results = await this.discover(config);
    let stored = 0;

    for (const result of results) {
      try {
        const existing = await getPool().query(
          'SELECT id FROM leads WHERE company_website = $1',
          [result.website]
        );

        if (existing.rows.length > 0) {
          continue;
        }

        await createLead(getPool(), {
          company_name: result.name,
          company_website: result.website,
          location: `${result.address}, ${result.location}`,
          city: config.city,
          country: config.country,
          industry: result.category,
          phone: result.phone,
          email: '',
          address: result.address,
          description: `Scouted via ${config.source}`,
          logo_url: '',
          screenshot_url: '',
          tech_stack: [],
          seo_score: 0,
          lead_score: 0,
          status: 'New',
          source: config.source,
          metadata: {
            rating: result.rating,
            reviews: result.reviews,
            raw: result
          }
        });

        stored++;
      } catch (error) {
        logger.error(`ScoutAgent: Failed to store lead ${result.name}:`, error);
      }
    }

    return { found: results.length, stored };
  }

  private deduplicate(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    return results.filter((result) => {
      const key = result.name.toLowerCase().trim();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}

export const scoutAgent = new ScoutAgent();
export type { ScoutConfig, SearchResult };
