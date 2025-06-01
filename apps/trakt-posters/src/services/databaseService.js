const logger = require('../utils/logger');

class DatabaseService {
  constructor(pool) {
    this.pool = pool;
  }

  async initializeSchema() {
    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS user_tokens (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) UNIQUE NOT NULL,
          access_token TEXT NOT NULL,
          refresh_token TEXT,
          expires_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS cache_metadata (
          id SERIAL PRIMARY KEY,
          cache_key VARCHAR(255) UNIQUE NOT NULL,
          data JSONB NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await this.pool.query(`
        CREATE INDEX IF NOT EXISTS idx_cache_metadata_key ON cache_metadata(cache_key);
        CREATE INDEX IF NOT EXISTS idx_cache_metadata_expires ON cache_metadata(expires_at);
        CREATE INDEX IF NOT EXISTS idx_user_tokens_user_id ON user_tokens(user_id);
      `);

      logger.info('Database schema initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database schema:', error);
      throw error;
    }
  }

  async storeUserToken(userId, accessToken, refreshToken = null, expiresAt = null) {
    try {
      const query = `
        INSERT INTO user_tokens (user_id, access_token, refresh_token, expires_at, updated_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          expires_at = EXCLUDED.expires_at,
          updated_at = CURRENT_TIMESTAMP
      `;
      
      await this.pool.query(query, [userId, accessToken, refreshToken, expiresAt]);
      logger.info(`Stored token for user: ${userId}`);
    } catch (error) {
      logger.error('Failed to store user token:', error);
      throw error;
    }
  }

  async getUserToken(userId) {
    try {
      const result = await this.pool.query(
        'SELECT * FROM user_tokens WHERE user_id = $1',
        [userId]
      );
      
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to get user token:', error);
      throw error;
    }
  }

  async deleteUserToken(userId) {
    try {
      await this.pool.query('DELETE FROM user_tokens WHERE user_id = $1', [userId]);
      logger.info(`Deleted token for user: ${userId}`);
    } catch (error) {
      logger.error('Failed to delete user token:', error);
      throw error;
    }
  }

  async storeCacheMetadata(key, data, expiresAt) {
    try {
      const query = `
        INSERT INTO cache_metadata (cache_key, data, expires_at)
        VALUES ($1, $2, $3)
        ON CONFLICT (cache_key)
        DO UPDATE SET 
          data = EXCLUDED.data,
          expires_at = EXCLUDED.expires_at
      `;
      
      await this.pool.query(query, [key, JSON.stringify(data), expiresAt]);
    } catch (error) {
      logger.error('Failed to store cache metadata:', error);
      throw error;
    }
  }

  async getCacheMetadata(key) {
    try {
      const result = await this.pool.query(
        'SELECT data FROM cache_metadata WHERE cache_key = $1 AND expires_at > CURRENT_TIMESTAMP',
        [key]
      );
      
      return result.rows[0]?.data || null;
    } catch (error) {
      logger.error('Failed to get cache metadata:', error);
      return null;
    }
  }

  async cleanupExpiredCache() {
    try {
      const result = await this.pool.query(
        'DELETE FROM cache_metadata WHERE expires_at <= CURRENT_TIMESTAMP'
      );
      
      logger.info(`Cleaned up ${result.rowCount} expired cache entries`);
      return result.rowCount;
    } catch (error) {
      logger.error('Failed to cleanup expired cache:', error);
      throw error;
    }
  }

  async getStats() {
    try {
      const userCount = await this.pool.query('SELECT COUNT(*) FROM user_tokens');
      const cacheCount = await this.pool.query('SELECT COUNT(*) FROM cache_metadata');
      const expiredCacheCount = await this.pool.query(
        'SELECT COUNT(*) FROM cache_metadata WHERE expires_at <= CURRENT_TIMESTAMP'
      );

      return {
        users: parseInt(userCount.rows[0].count),
        cacheEntries: parseInt(cacheCount.rows[0].count),
        expiredCacheEntries: parseInt(expiredCacheCount.rows[0].count)
      };
    } catch (error) {
      logger.error('Failed to get database stats:', error);
      throw error;
    }
  }
}

module.exports = DatabaseService;