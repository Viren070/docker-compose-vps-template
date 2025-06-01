const axios = require('axios');
const logger = require('../utils/logger');

class RPDBService {
  constructor(cacheService) {
    this.cache = cacheService;
    this.baseURL = 'https://api.ratingposterdb.com';
    this.apiKey = process.env.RPDB_API_KEY;
    
    if (!this.apiKey) {
      logger.warn('RPDB API key not provided - poster ratings will not be available');
    }
  }

  async makeRequest(endpoint, params = {}) {
    if (!this.apiKey) {
      logger.debug('RPDB API key not available, skipping request');
      return null;
    }

    try {
      const cacheKey = `${endpoint}_${JSON.stringify(params)}`;
      const cached = await this.cache.getRPDBData(cacheKey);
      
      if (cached) {
        logger.debug(`Cache hit for RPDB endpoint: ${endpoint}`);
        return cached;
      }

      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        headers: {
          'X-API-Key': this.apiKey
        },
        params,
        timeout: 10000
      });

      await this.cache.setRPDBData(cacheKey, response.data);
      logger.debug(`API call to RPDB endpoint: ${endpoint}`);
      
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        logger.error('RPDB API returned 401 - invalid API key');
        return null;
      }
      
      if (error.response?.status === 404) {
        logger.debug(`RPDB resource not found for ${endpoint}`);
        return null;
      }
      
      if (error.response?.status === 429) {
        logger.warn('RPDB API rate limit exceeded');
        return null;
      }
      
      logger.error(`RPDB API error for ${endpoint}:`, error.message);
      return null;
    }
  }

  async getPoster(imdbId, options = {}) {
    if (!imdbId) {
      logger.warn('No IMDB ID provided for RPDB poster lookup');
      return null;
    }

    // Ensure IMDB ID has the 'tt' prefix
    const formattedImdbId = imdbId.startsWith('tt') ? imdbId : `tt${imdbId}`;

    try {
      const {
        type = 'movie', // 'movie' or 'tv'
        season = null,
        episode = null,
        width = 500,
        fallback = true
      } = options;

      let endpoint = `/v1/poster/${type}/${formattedImdbId}`;
      
      // Add season/episode for TV shows
      if (type === 'tv' && season !== null) {
        endpoint += `/season/${season}`;
        if (episode !== null) {
          endpoint += `/episode/${episode}`;
        }
      }

      const params = { width };
      const data = await this.makeRequest(endpoint, params);

      if (!data) {
        return fallback ? this.getFallbackPoster(formattedImdbId, type) : null;
      }

      // Return the best quality poster URL
      return this.selectBestPoster(data, width);
    } catch (error) {
      logger.error(`Failed to get RPDB poster for ${formattedImdbId}:`, error);
      return options.fallback ? this.getFallbackPoster(formattedImdbId, options.type) : null;
    }
  }

  async getShowPoster(imdbId, options = {}) {
    return this.getPoster(imdbId, { ...options, type: 'tv' });
  }

  async getSeasonPoster(imdbId, season, options = {}) {
    return this.getPoster(imdbId, { ...options, type: 'tv', season });
  }

  async getEpisodePoster(imdbId, season, episode, options = {}) {
    return this.getPoster(imdbId, { ...options, type: 'tv', season, episode });
  }

  async getMoviePoster(imdbId, options = {}) {
    return this.getPoster(imdbId, { ...options, type: 'movie' });
  }

  async searchPosters(query, options = {}) {
    if (!query) {
      logger.warn('No query provided for RPDB poster search');
      return [];
    }

    try {
      const {
        type = 'movie',
        limit = 10,
        year = null
      } = options;

      const params = {
        query,
        type,
        limit
      };

      if (year) {
        params.year = year;
      }

      const data = await this.makeRequest('/v1/search', params);
      return data?.results || [];
    } catch (error) {
      logger.error(`Failed to search RPDB posters for "${query}":`, error);
      return [];
    }
  }

  async getPostersByRating(rating, options = {}) {
    try {
      const {
        type = 'movie',
        limit = 20,
        page = 1
      } = options;

      const params = {
        rating,
        type,
        limit,
        page
      };

      const data = await this.makeRequest('/v1/posters/rating', params);
      return data?.results || [];
    } catch (error) {
      logger.error(`Failed to get RPDB posters by rating ${rating}:`, error);
      return [];
    }
  }

  async getPopularPosters(options = {}) {
    try {
      const {
        type = 'movie',
        limit = 20,
        page = 1,
        timeframe = 'week' // 'day', 'week', 'month', 'year', 'all'
      } = options;

      const params = {
        type,
        limit,
        page,
        timeframe
      };

      const data = await this.makeRequest('/v1/posters/popular', params);
      return data?.results || [];
    } catch (error) {
      logger.error('Failed to get popular RPDB posters:', error);
      return [];
    }
  }

  async getRecentPosters(options = {}) {
    try {
      const {
        type = 'movie',
        limit = 20,
        page = 1
      } = options;

      const params = {
        type,
        limit,
        page
      };

      const data = await this.makeRequest('/v1/posters/recent', params);
      return data?.results || [];
    } catch (error) {
      logger.error('Failed to get recent RPDB posters:', error);
      return [];
    }
  }

  // Helper methods
  selectBestPoster(data, preferredWidth = 500) {
    if (!data || !data.posters || data.posters.length === 0) {
      return null;
    }

    // Sort posters by rating and quality
    const sortedPosters = data.posters.sort((a, b) => {
      // Prefer higher ratings
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }
      
      // Prefer closer to preferred width
      const aDiff = Math.abs(a.width - preferredWidth);
      const bDiff = Math.abs(b.width - preferredWidth);
      return aDiff - bDiff;
    });

    return sortedPosters[0]?.url || null;
  }

  getFallbackPoster(imdbId, type = 'movie') {
    // Return a placeholder or default poster URL
    // This could be integrated with TMDB or other services
    logger.debug(`Using fallback poster for ${imdbId} (${type})`);
    return null;
  }

  // Utility methods for poster analysis
  async getPosterStats(imdbId, type = 'movie') {
    try {
      const data = await this.makeRequest(`/v1/stats/${type}/${imdbId}`);
      return data || {
        total_posters: 0,
        average_rating: 0,
        total_votes: 0
      };
    } catch (error) {
      logger.error(`Failed to get RPDB poster stats for ${imdbId}:`, error);
      return {
        total_posters: 0,
        average_rating: 0,
        total_votes: 0
      };
    }
  }

  async ratePoster(posterId, rating, userId = null) {
    if (!this.apiKey) {
      logger.warn('RPDB API key required for rating posters');
      return false;
    }

    try {
      const data = {
        rating: Math.max(1, Math.min(10, rating)) // Ensure rating is between 1-10
      };

      if (userId) {
        data.user_id = userId;
      }

      await this.makeRequest(`/v1/poster/${posterId}/rate`, data);
      return true;
    } catch (error) {
      logger.error(`Failed to rate RPDB poster ${posterId}:`, error);
      return false;
    }
  }

  // Configuration and status
  async getApiStatus() {
    try {
      const data = await this.makeRequest('/v1/status');
      return data || { status: 'unknown' };
    } catch (error) {
      logger.error('Failed to get RPDB API status:', error);
      return { status: 'error', error: error.message };
    }
  }

  async getApiLimits() {
    try {
      const data = await this.makeRequest('/v1/limits');
      return data || {
        requests_per_minute: 60,
        requests_per_hour: 1000,
        requests_per_day: 10000
      };
    } catch (error) {
      logger.error('Failed to get RPDB API limits:', error);
      return {
        requests_per_minute: 60,
        requests_per_hour: 1000,
        requests_per_day: 10000
      };
    }
  }
}

module.exports = RPDBService;