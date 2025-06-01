const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createClient } = require('redis');
const { Pool } = require('pg');
const cron = require('node-cron');
const logger = require('./src/utils/logger');
const TraktService = require('./src/services/traktService');
const TMDBService = require('./src/services/tmdbService');
const RPDBService = require('./src/services/rpdbService');
const CacheService = require('./src/services/cacheService');
const DatabaseService = require('./src/services/databaseService');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Initialize services
let redisClient, dbPool, cacheService, traktService, tmdbService, rpdbService, databaseService;

async function initializeServices() {
  try {
    // Redis client
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379'
    });
    await redisClient.connect();
    logger.info('Connected to Redis');

    // PostgreSQL pool
    dbPool = new Pool({
      connectionString: process.env.POSTGRES_URL || 'postgresql://postgres:postgres@localhost:5432/trakt_posters'
    });
    logger.info('Connected to PostgreSQL');

    // Initialize services
    cacheService = new CacheService(redisClient);
    databaseService = new DatabaseService(dbPool);
    traktService = new TraktService(cacheService);
    tmdbService = new TMDBService(cacheService);
    rpdbService = new RPDBService(cacheService);

    // Initialize database schema
    await databaseService.initializeSchema();
    
    logger.info('All services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

// Stremio addon manifest
const manifest = {
  id: 'org.trakt.posters',
  version: '1.0.0',
  name: 'Trakt Posters',
  description: 'Display your recently watched and upcoming episodes from Trakt with RPDB posters',
  logo: 'https://trakt.tv/assets/logos/header.svg',
  resources: ['catalog'],
  types: ['series'],
  catalogs: [
    {
      type: 'series',
      id: 'trakt-recently-watched',
      name: 'Recently Watched',
      extra: [
        {
          name: 'skip',
          isRequired: false
        }
      ]
    },
    {
      type: 'series',
      id: 'trakt-upcoming',
      name: 'Upcoming Episodes',
      extra: [
        {
          name: 'skip',
          isRequired: false
        }
      ]
    }
  ],
  idPrefixes: ['tt', 'trakt'],
  behaviorHints: {
    configurable: true,
    configurationRequired: true
  }
};

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Trakt Posters Stremio Addon' });
});

app.get('/manifest.json', (req, res) => {
  res.json(manifest);
});

app.get('/:userConfig/manifest.json', async (req, res) => {
  try {
    const { userConfig } = req.params;
    const config = JSON.parse(Buffer.from(userConfig, 'base64').toString());
    
    if (!config.accessToken) {
      return res.status(400).json({ error: 'Access token required' });
    }

    // Validate token with Trakt
    const isValid = await traktService.validateToken(config.accessToken);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid access token' });
    }

    res.json(manifest);
  } catch (error) {
    logger.error('Error in manifest route:', error);
    res.status(400).json({ error: 'Invalid configuration' });
  }
});

app.get('/:userConfig/catalog/:type/:id.json', async (req, res) => {
  try {
    const { userConfig, type, id } = req.params;
    const { skip = 0 } = req.query;
    
    const config = JSON.parse(Buffer.from(userConfig, 'base64').toString());
    
    if (!config.accessToken) {
      return res.status(400).json({ error: 'Access token required' });
    }

    let metas = [];

    if (id === 'trakt-recently-watched') {
      metas = await getRecentlyWatchedMetas(config.accessToken, parseInt(skip));
    } else if (id === 'trakt-upcoming') {
      metas = await getUpcomingMetas(config.accessToken, parseInt(skip));
    }

    res.json({ metas });
  } catch (error) {
    logger.error('Error in catalog route:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Configuration page
app.get('/configure', (req, res) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Trakt Posters Configuration</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .form-group { margin-bottom: 20px; }
            label { display: block; margin-bottom: 5px; font-weight: bold; }
            input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
            button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
            button:hover { background: #0056b3; }
            .install-url { background: #f8f9fa; padding: 15px; border-radius: 4px; margin-top: 20px; word-break: break-all; }
        </style>
    </head>
    <body>
        <h1>Trakt Posters Configuration</h1>
        <p>To use this addon, you need to authorize it with your Trakt account.</p>
        
        <div class="form-group">
            <label for="accessToken">Trakt Access Token:</label>
            <input type="text" id="accessToken" placeholder="Enter your Trakt access token">
            <small>Get your token from: <a href="https://trakt.tv/oauth/applications" target="_blank">Trakt API Applications</a></small>
        </div>
        
        <button onclick="generateInstallUrl()">Generate Install URL</button>
        
        <div id="installUrl" class="install-url" style="display: none;">
            <strong>Install URL:</strong><br>
            <span id="urlText"></span>
        </div>

        <script>
            function generateInstallUrl() {
                const accessToken = document.getElementById('accessToken').value;
                if (!accessToken) {
                    alert('Please enter your Trakt access token');
                    return;
                }
                
                const config = { accessToken };
                const encodedConfig = btoa(JSON.stringify(config));
                const baseUrl = window.location.origin;
                const installUrl = baseUrl + '/' + encodedConfig + '/manifest.json';
                
                document.getElementById('urlText').textContent = installUrl;
                document.getElementById('installUrl').style.display = 'block';
            }
        </script>
    </body>
    </html>
  `;
  res.send(html);
});

async function getRecentlyWatchedMetas(accessToken, skip = 0) {
  try {
    const recentlyWatched = await traktService.getRecentlyWatched(accessToken, skip);
    const metas = [];

    for (const item of recentlyWatched) {
      if (item.show) {
        const tmdbData = await tmdbService.getShowDetails(item.show.ids.tmdb);
        const rpdbPoster = await rpdbService.getShowPoster(item.show.ids.imdb);
        
        const meta = {
          id: `tt${item.show.ids.imdb}`,
          type: 'series',
          name: item.show.title,
          poster: rpdbPoster || (tmdbData?.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : null),
          background: tmdbData?.backdrop_path ? `https://image.tmdb.org/t/p/w1280${tmdbData.backdrop_path}` : null,
          description: tmdbData?.overview || item.show.overview,
          year: item.show.year,
          imdbRating: tmdbData?.vote_average,
          genres: tmdbData?.genres?.map(g => g.name) || [],
          runtime: tmdbData?.episode_run_time?.[0],
          country: tmdbData?.origin_country || [],
          language: tmdbData?.original_language,
          status: tmdbData?.status,
          behaviorHints: {
            defaultVideoId: null
          }
        };

        // Add last watched episode info for recently watched
        if (item.last_episode) {
          meta.description = `Last watched: S${item.last_episode.season}E${item.last_episode.episode}\n\n${meta.description}`;
        }

        metas.push(meta);
      }
    }

    return metas;
  } catch (error) {
    logger.error('Error getting recently watched metas:', error);
    return [];
  }
}

async function getUpcomingMetas(accessToken, skip = 0) {
  try {
    const upcoming = await traktService.getUpcoming(accessToken, skip);
    const metas = [];

    for (const item of upcoming) {
      if (item.show) {
        const tmdbData = await tmdbService.getShowDetails(item.show.ids.tmdb);
        const rpdbPoster = await rpdbService.getShowPoster(item.show.ids.imdb);
        
        const meta = {
          id: `tt${item.show.ids.imdb}`,
          type: 'series',
          name: item.show.title,
          poster: rpdbPoster || (tmdbData?.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : null),
          background: tmdbData?.backdrop_path ? `https://image.tmdb.org/t/p/w1280${tmdbData.backdrop_path}` : null,
          description: tmdbData?.overview || item.show.overview,
          year: item.show.year,
          imdbRating: tmdbData?.vote_average,
          genres: tmdbData?.genres?.map(g => g.name) || [],
          runtime: tmdbData?.episode_run_time?.[0],
          country: tmdbData?.origin_country || [],
          language: tmdbData?.original_language,
          status: tmdbData?.status,
          behaviorHints: {
            defaultVideoId: null
          }
        };

        // Add next episode info for upcoming
        if (item.next_episode) {
          const airDate = new Date(item.next_episode.first_aired).toLocaleDateString();
          meta.description = `Next episode: S${item.next_episode.season}E${item.next_episode.number} - ${item.next_episode.title}\nAirs: ${airDate}\n\n${meta.description}`;
        }

        metas.push(meta);
      }
    }

    return metas;
  } catch (error) {
    logger.error('Error getting upcoming metas:', error);
    return [];
  }
}

// Scheduled cache cleanup
cron.schedule('0 2 * * *', async () => {
  logger.info('Running scheduled cache cleanup');
  try {
    await cacheService.cleanup();
    logger.info('Cache cleanup completed');
  } catch (error) {
    logger.error('Cache cleanup failed:', error);
  }
});

// Error handling
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  if (redisClient) await redisClient.quit();
  if (dbPool) await dbPool.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  if (redisClient) await redisClient.quit();
  if (dbPool) await dbPool.end();
  process.exit(0);
});

// Start server
async function startServer() {
  await initializeServices();
  
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Trakt Posters addon listening on port ${PORT}`);
    logger.info(`Configuration page: http://localhost:${PORT}/configure`);
  });
}

startServer().catch(error => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});