const axios = require('axios');
const logger = require('../utils/logger');

class TMDBService {
  constructor(cacheService) {
    this.cache = cacheService;
    this.baseURL = 'https://api.themoviedb.org/3';
    this.apiKey = process.env.TMDB_API_KEY;
    
    if (!this.apiKey) {
      throw new Error('TMDB API key is required');
    }
  }

  async makeRequest(endpoint, params = {}) {
    try {
      const cacheKey = `${endpoint}_${JSON.stringify(params)}`;
      const cached = await this.cache.getTMDBData(cacheKey);
      
      if (cached) {
        logger.debug(`Cache hit for TMDB endpoint: ${endpoint}`);
        return cached;
      }

      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        params: {
          api_key: this.apiKey,
          ...params
        },
        timeout: 10000
      });

      await this.cache.setTMDBData(cacheKey, response.data);
      logger.debug(`API call to TMDB endpoint: ${endpoint}`);
      
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        logger.error('TMDB API returned 401 - invalid API key');
        throw new Error('Invalid TMDB API key');
      }
      
      if (error.response?.status === 404) {
        logger.warn(`TMDB resource not found for ${endpoint}`);
        return null;
      }
      
      logger.error(`TMDB API error for ${endpoint}:`, error.message);
      throw error;
    }
  }

  async getShowDetails(tmdbId) {
    if (!tmdbId) {
      logger.warn('No TMDB ID provided for show details');
      return null;
    }

    try {
      const data = await this.makeRequest(`/tv/${tmdbId}`, {
        append_to_response: 'external_ids,content_ratings,credits,keywords,recommendations,similar,videos'
      });

      if (!data) {
        return null;
      }

      // Enhance the data with additional useful information
      return {
        ...data,
        imdb_id: data.external_ids?.imdb_id,
        tvdb_id: data.external_ids?.tvdb_id,
        poster_url: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : null,
        backdrop_url: data.backdrop_path ? `https://image.tmdb.org/t/p/w1280${data.backdrop_path}` : null,
        content_rating: this.getContentRating(data.content_ratings),
        cast: data.credits?.cast?.slice(0, 10) || [],
        crew: data.credits?.crew?.filter(person => 
          ['Director', 'Producer', 'Executive Producer', 'Creator'].includes(person.job)
        ) || [],
        trailer: this.getTrailer(data.videos),
        similar_shows: data.similar?.results?.slice(0, 5) || [],
        recommended_shows: data.recommendations?.results?.slice(0, 5) || []
      };
    } catch (error) {
      logger.error(`Failed to get TMDB show details for ID ${tmdbId}:`, error);
      return null;
    }
  }

  async getSeasonDetails(tmdbId, seasonNumber) {
    if (!tmdbId || seasonNumber === undefined) {
      logger.warn('Missing TMDB ID or season number for season details');
      return null;
    }

    try {
      return await this.makeRequest(`/tv/${tmdbId}/season/${seasonNumber}`);
    } catch (error) {
      logger.error(`Failed to get TMDB season details for show ${tmdbId}, season ${seasonNumber}:`, error);
      return null;
    }
  }

  async getEpisodeDetails(tmdbId, seasonNumber, episodeNumber) {
    if (!tmdbId || seasonNumber === undefined || episodeNumber === undefined) {
      logger.warn('Missing parameters for episode details');
      return null;
    }

    try {
      return await this.makeRequest(`/tv/${tmdbId}/season/${seasonNumber}/episode/${episodeNumber}`, {
        append_to_response: 'credits,external_ids,images,videos'
      });
    } catch (error) {
      logger.error(`Failed to get TMDB episode details for show ${tmdbId}, S${seasonNumber}E${episodeNumber}:`, error);
      return null;
    }
  }

  async searchShows(query, page = 1) {
    if (!query) {
      logger.warn('No query provided for show search');
      return { results: [] };
    }

    try {
      return await this.makeRequest('/search/tv', {
        query,
        page,
        include_adult: false
      });
    } catch (error) {
      logger.error(`Failed to search TMDB shows for query "${query}":`, error);
      return { results: [] };
    }
  }

  async findByExternalId(externalId, source = 'imdb_id') {
    if (!externalId) {
      logger.warn(`No ${source} provided for external ID search`);
      return null;
    }

    try {
      const data = await this.makeRequest('/find/' + externalId, {
        external_source: source
      });

      return data?.tv_results?.[0] || null;
    } catch (error) {
      logger.error(`Failed to find TMDB show by ${source} ${externalId}:`, error);
      return null;
    }
  }

  async getPopularShows(page = 1) {
    try {
      return await this.makeRequest('/tv/popular', { page });
    } catch (error) {
      logger.error('Failed to get popular shows from TMDB:', error);
      return { results: [] };
    }
  }

  async getTopRatedShows(page = 1) {
    try {
      return await this.makeRequest('/tv/top_rated', { page });
    } catch (error) {
      logger.error('Failed to get top rated shows from TMDB:', error);
      return { results: [] };
    }
  }

  async getAiringToday(page = 1) {
    try {
      return await this.makeRequest('/tv/airing_today', { page });
    } catch (error) {
      logger.error('Failed to get airing today shows from TMDB:', error);
      return { results: [] };
    }
  }

  async getOnTheAir(page = 1) {
    try {
      return await this.makeRequest('/tv/on_the_air', { page });
    } catch (error) {
      logger.error('Failed to get on the air shows from TMDB:', error);
      return { results: [] };
    }
  }

  // Helper methods
  getContentRating(contentRatings) {
    if (!contentRatings?.results) return null;
    
    // Prefer US rating, fallback to first available
    const usRating = contentRatings.results.find(rating => rating.iso_3166_1 === 'US');
    return usRating?.rating || contentRatings.results[0]?.rating || null;
  }

  getTrailer(videos) {
    if (!videos?.results) return null;
    
    // Look for official trailer on YouTube
    const trailer = videos.results.find(video => 
      video.site === 'YouTube' && 
      video.type === 'Trailer' && 
      video.official
    );
    
    return trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : null;
  }

  // Image helper methods
  getImageUrl(path, size = 'w500') {
    if (!path) return null;
    return `https://image.tmdb.org/t/p/${size}${path}`;
  }

  getPosterUrl(path, size = 'w500') {
    return this.getImageUrl(path, size);
  }

  getBackdropUrl(path, size = 'w1280') {
    return this.getImageUrl(path, size);
  }

  getProfileUrl(path, size = 'w185') {
    return this.getImageUrl(path, size);
  }

  // Configuration and genres
  async getConfiguration() {
    try {
      return await this.makeRequest('/configuration');
    } catch (error) {
      logger.error('Failed to get TMDB configuration:', error);
      return null;
    }
  }

  async getGenres() {
    try {
      return await this.makeRequest('/genre/tv/list');
    } catch (error) {
      logger.error('Failed to get TMDB TV genres:', error);
      return { genres: [] };
    }
  }
}

module.exports = TMDBService;