const axios = require('axios');
const logger = require('../utils/logger');

class TraktService {
  constructor(cacheService) {
    this.cache = cacheService;
    this.baseURL = 'https://api.trakt.tv';
    this.clientId = process.env.TRAKT_CLIENT_ID;
    this.clientSecret = process.env.TRAKT_CLIENT_SECRET;
    
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Trakt client ID and secret are required');
    }

    this.headers = {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': this.clientId
    };
  }

  async makeRequest(endpoint, accessToken, params = {}) {
    try {
      const cacheKey = `${endpoint}_${JSON.stringify(params)}_${accessToken.substring(0, 10)}`;
      const cached = await this.cache.getTraktData(cacheKey);
      
      if (cached) {
        logger.debug(`Cache hit for Trakt endpoint: ${endpoint}`);
        return cached;
      }

      const headers = {
        ...this.headers,
        'Authorization': `Bearer ${accessToken}`
      };

      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        headers,
        params,
        timeout: 10000
      });

      await this.cache.setTraktData(cacheKey, response.data);
      logger.debug(`API call to Trakt endpoint: ${endpoint}`);
      
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        logger.warn('Trakt API returned 401 - invalid or expired token');
        throw new Error('Invalid or expired Trakt token');
      }
      
      logger.error(`Trakt API error for ${endpoint}:`, error.message);
      throw error;
    }
  }

  async validateToken(accessToken) {
    try {
      await this.makeRequest('/users/settings', accessToken);
      return true;
    } catch (error) {
      logger.warn('Token validation failed:', error.message);
      return false;
    }
  }

  async getUserProfile(accessToken) {
    try {
      return await this.makeRequest('/users/me', accessToken);
    } catch (error) {
      logger.error('Failed to get user profile:', error);
      throw error;
    }
  }

  async getRecentlyWatched(accessToken, skip = 0, limit = 20) {
    try {
      const params = {
        limit,
        page: Math.floor(skip / limit) + 1,
        extended: 'full'
      };

      const data = await this.makeRequest('/users/me/watched', accessToken, params);
      
      // Transform the data to include episode information
      const recentlyWatched = [];
      
      for (const item of data) {
        if (item.show && item.seasons) {
          // Get the most recently watched episode from each show
          let lastWatched = null;
          let lastWatchedDate = null;

          for (const season of item.seasons) {
            for (const episode of season.episodes || []) {
              if (episode.last_watched_at) {
                const watchedDate = new Date(episode.last_watched_at);
                if (!lastWatchedDate || watchedDate > lastWatchedDate) {
                  lastWatchedDate = watchedDate;
                  lastWatched = {
                    season: season.number,
                    episode: episode.number,
                    last_watched_at: episode.last_watched_at
                  };
                }
              }
            }
          }

          if (lastWatched) {
            recentlyWatched.push({
              ...item,
              last_episode: lastWatched
            });
          }
        }
      }

      // Sort by last watched date
      recentlyWatched.sort((a, b) => 
        new Date(b.last_episode.last_watched_at) - new Date(a.last_episode.last_watched_at)
      );

      return recentlyWatched.slice(skip % limit, (skip % limit) + limit);
    } catch (error) {
      logger.error('Failed to get recently watched:', error);
      throw error;
    }
  }

  async getUpcoming(accessToken, skip = 0, limit = 20) {
    try {
      const params = {
        limit,
        page: Math.floor(skip / limit) + 1,
        extended: 'full'
      };

      // Get upcoming episodes from calendar
      const today = new Date().toISOString().split('T')[0];
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30); // Next 30 days
      const future = futureDate.toISOString().split('T')[0];

      const data = await this.makeRequest(
        `/calendars/my/shows/${today}/${future}`, 
        accessToken, 
        { extended: 'full' }
      );

      // Transform calendar data to show format
      const upcoming = [];
      const showMap = new Map();

      for (const item of data) {
        if (item.show) {
          const showId = item.show.ids.trakt;
          
          if (!showMap.has(showId)) {
            showMap.set(showId, {
              show: item.show,
              next_episode: {
                season: item.episode.season,
                number: item.episode.number,
                title: item.episode.title,
                first_aired: item.first_aired
              }
            });
          }
        }
      }

      const upcomingArray = Array.from(showMap.values());
      
      // Sort by air date
      upcomingArray.sort((a, b) => 
        new Date(a.next_episode.first_aired) - new Date(b.next_episode.first_aired)
      );

      return upcomingArray.slice(skip % limit, (skip % limit) + limit);
    } catch (error) {
      logger.error('Failed to get upcoming episodes:', error);
      throw error;
    }
  }

  async getShowDetails(accessToken, showId) {
    try {
      return await this.makeRequest(`/shows/${showId}`, accessToken, { extended: 'full' });
    } catch (error) {
      logger.error(`Failed to get show details for ${showId}:`, error);
      throw error;
    }
  }

  async searchShows(accessToken, query, limit = 10) {
    try {
      const params = {
        query,
        type: 'show',
        limit,
        extended: 'full'
      };

      return await this.makeRequest('/search/show', accessToken, params);
    } catch (error) {
      logger.error('Failed to search shows:', error);
      throw error;
    }
  }

  // OAuth methods for future enhancement
  getAuthUrl(redirectUri, state = null) {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri
    });

    if (state) {
      params.append('state', state);
    }

    return `${this.baseURL}/oauth/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code, redirectUri) {
    try {
      const response = await axios.post(`${this.baseURL}/oauth/token`, {
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to exchange code for token:', error);
      throw error;
    }
  }

  async refreshToken(refreshToken) {
    try {
      const response = await axios.post(`${this.baseURL}/oauth/token`, {
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        grant_type: 'refresh_token'
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to refresh token:', error);
      throw error;
    }
  }
}

module.exports = TraktService;