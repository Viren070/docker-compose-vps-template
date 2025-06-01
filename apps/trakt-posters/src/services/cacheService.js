const logger = require('../utils/logger');

class CacheService {
  constructor(redisClient) {
    this.redis = redisClient;
    this.ttl = {
      posters: parseInt(process.env.CACHE_TTL_POSTERS) || 86400, // 1 day
      metadata: parseInt(process.env.CACHE_TTL_METADATA) || 3600, // 1 hour
      trakt: parseInt(process.env.CACHE_TTL_TRAKT) || 1800 // 30 minutes
    };
  }

  async get(key) {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key, value, ttl = null) {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.redis.setEx(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      return true;
    } catch (error) {
      logger.error(`Cache set error for key ${key}:`, error);
      return false;
    }
  }

  async del(key) {
    try {
      await this.redis.del(key);
      return true;
    } catch (error) {
      logger.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  async exists(key) {
    try {
      return await this.redis.exists(key);
    } catch (error) {
      logger.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  async cleanup() {
    try {
      // Get all keys with our prefixes
      const keys = await this.redis.keys('trakt:*');
      const tmdbKeys = await this.redis.keys('tmdb:*');
      const rpdbKeys = await this.redis.keys('rpdb:*');
      
      const allKeys = [...keys, ...tmdbKeys, ...rpdbKeys];
      
      // Check TTL for each key and remove expired ones
      let cleanedCount = 0;
      for (const key of allKeys) {
        const ttl = await this.redis.ttl(key);
        if (ttl === -1) { // Key exists but has no TTL
          await this.redis.expire(key, this.ttl.metadata);
        } else if (ttl === -2) { // Key doesn't exist
          cleanedCount++;
        }
      }
      
      logger.info(`Cache cleanup completed. Processed ${allKeys.length} keys, cleaned ${cleanedCount} expired keys`);
      return cleanedCount;
    } catch (error) {
      logger.error('Cache cleanup error:', error);
      throw error;
    }
  }

  // Helper methods for specific cache types
  async getTraktData(key, ttl = null) {
    return this.get(`trakt:${key}`);
  }

  async setTraktData(key, value, ttl = null) {
    return this.set(`trakt:${key}`, value, ttl || this.ttl.trakt);
  }

  async getTMDBData(key) {
    return this.get(`tmdb:${key}`);
  }

  async setTMDBData(key, value) {
    return this.set(`tmdb:${key}`, value, this.ttl.metadata);
  }

  async getRPDBData(key) {
    return this.get(`rpdb:${key}`);
  }

  async setRPDBData(key, value) {
    return this.set(`rpdb:${key}`, value, this.ttl.posters);
  }
}

module.exports = CacheService;