import axios from 'axios';
import { logger } from '../core/logger';
import { getPool } from '../database/connection';

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

  async discover(config: ScoutConfig): Promise<SearchResult[]> {
    logger.info(`ScoutAgent: Starting discovery for "${config.query}" in ${config.location}`);
    const results = await this.searchGoogleMaps(config);
    const dedupResults = this.deduplicate(results);
    logger.info(`ScoutAgent: Discovery complete. Found ${dedupResults.length} unique leads`);
    return dedupResults;
  }

  private deduplicate(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    return results.filter((result) => {
      const key = result.name.toLowerCase().trim();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

export const scoutAgent = new ScoutAgent();
export type { ScoutConfig, SearchResult };
