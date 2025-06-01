# Trakt Posters Setup Guide

This guide will walk you through setting up the Trakt Posters Stremio addon.

## Prerequisites

1. **Docker & Docker Compose** installed
2. **Traefik** running (for production deployment)
3. **API Keys** from the required services

## Step 1: Get API Keys

### Trakt API (Required)
1. Go to [Trakt API Applications](https://trakt.tv/oauth/applications)
2. Create a new application
3. Note down your **Client ID** and **Client Secret**

### TMDB API (Required)
1. Go to [TMDB API Settings](https://www.themoviedb.org/settings/api)
2. Request an API key
3. Note down your **API Key**

### RPDB API (Optional)
1. Go to [RatingPosterDB](https://ratingposterdb.com/)
2. Register for an account
3. Get your **API Key** from your profile

## Step 2: Environment Configuration

1. Copy the example environment file:
   ```bash
   cp apps/trakt-posters/.env.example .env.trakt-posters
   ```

2. Edit `.env.trakt-posters` with your API keys:
   ```env
   TRAKT_CLIENT_ID=your_actual_client_id
   TRAKT_CLIENT_SECRET=your_actual_client_secret
   TMDB_API_KEY=your_actual_tmdb_key
   RPDB_API_KEY=your_actual_rpdb_key
   TRAKT_POSTERS_HOSTNAME=trakt-posters.yourdomain.com
   ```

3. Add the environment variables to your main `.env` file or source the file.

## Step 3: Build the Docker Image

```bash
cd apps/trakt-posters
./build.sh
```

## Step 4: Deploy with Docker Compose

### Development Deployment
```bash
# From the trakt-posters directory
docker-compose -f docker-compose.dev.yml up -d
```

### Production Deployment
```bash
# From the main apps directory
docker-compose up -d trakt-posters
```

## Step 5: Configure the Addon

1. **Access the configuration page:**
   - Development: `http://localhost:3000/configure`
   - Production: `https://trakt-posters.yourdomain.com/configure`

2. **Get your Trakt access token:**
   - Go to [Trakt Settings](https://trakt.tv/settings/applications)
   - Find your application and generate a token
   - Or implement OAuth flow (advanced)

3. **Generate install URL:**
   - Enter your access token in the configuration page
   - Click "Generate Install URL"
   - Copy the generated URL

## Step 6: Install in Stremio

1. Open Stremio
2. Go to **Addons** section
3. Click **Add Addon**
4. Paste the install URL from Step 5
5. Click **Install**

## Step 7: Verify Installation

The addon should now appear in your Stremio home screen with two catalogs:
- **Recently Watched** - Your recently watched episodes
- **Upcoming Episodes** - Episodes airing soon

## Troubleshooting

### Common Issues

1. **"Invalid access token" error:**
   - Verify your Trakt token is correct
   - Check if the token has expired
   - Ensure your Trakt app has the right permissions

2. **No posters showing:**
   - Check your RPDB API key
   - Verify TMDB API key is working
   - Check the logs for API errors

3. **Addon not loading:**
   - Verify all containers are running: `docker-compose ps`
   - Check logs: `docker logs trakt-posters`
   - Ensure Traefik is routing correctly

4. **Database connection errors:**
   - Wait for PostgreSQL to fully start
   - Check database credentials
   - Verify network connectivity

### Checking Logs

```bash
# Application logs
docker logs trakt-posters

# Database logs
docker logs trakt-posters_postgres

# Redis logs
docker logs trakt-posters_redis
```

### Testing the Addon

```bash
cd apps/trakt-posters
node test.js
```

## Advanced Configuration

### Custom Cache TTL
Adjust cache durations in your environment:
```env
CACHE_TTL_POSTERS=86400   # 24 hours
CACHE_TTL_METADATA=3600   # 1 hour
CACHE_TTL_TRAKT=1800      # 30 minutes
```

### Logging Level
```env
LOG_LEVEL=debug  # debug, info, warn, error
```

### OAuth Implementation
For production use, consider implementing proper OAuth flow instead of manual token entry.

## Maintenance

### Regular Tasks
1. **Monitor logs** for errors
2. **Update API keys** when they expire
3. **Clean up old cache** data periodically
4. **Update Docker images** regularly

### Backup
Important data to backup:
- PostgreSQL database (`data/trakt-posters/db`)
- User configurations
- Environment files

## Security Considerations

1. **Keep API keys secure** - never commit them to version control
2. **Use HTTPS** in production with proper SSL certificates
3. **Regular updates** of dependencies and base images
4. **Monitor API usage** to avoid rate limits
5. **Implement proper logging** without exposing sensitive data

## Performance Optimization

1. **Redis memory management** - adjust maxmemory settings
2. **Database indexing** - monitor query performance
3. **API rate limiting** - respect service limits
4. **Cache optimization** - tune TTL values based on usage

## Support

For issues and questions:
1. Check the logs first
2. Review this setup guide
3. Check the main README.md
4. Open an issue on GitHub

## Next Steps

Once the addon is working:
1. **Monitor performance** and adjust cache settings
2. **Add more features** like custom filters
3. **Implement OAuth** for better user experience
4. **Add monitoring** and alerting
5. **Scale horizontally** if needed