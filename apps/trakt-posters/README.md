# Trakt Posters Stremio Addon

A Stremio addon that displays your recently watched and upcoming episodes from Trakt with high-quality posters from RPDB (RatingPosterDB).

## Features

- **Recently Watched**: Shows your recently watched TV episodes from Trakt
- **Upcoming Episodes**: Displays upcoming episodes from your Trakt watchlist
- **High-Quality Posters**: Uses RPDB API for enhanced poster quality with ratings
- **TMDB Integration**: Fetches metadata from The Movie Database
- **Intelligent Caching**: Redis-based caching for optimal performance
- **Traefik Integration**: Built-in reverse proxy support
- **Docker Ready**: Fully containerized with Docker Compose

## Prerequisites

- Docker and Docker Compose
- Trakt API credentials (Client ID and Secret)
- TMDB API key
- RPDB API key (optional, for enhanced posters)

## API Keys Required

1. **Trakt API**: Register at [Trakt API Applications](https://trakt.tv/oauth/applications)
2. **TMDB API**: Get your key from [TMDB API Settings](https://www.themoviedb.org/settings/api)
3. **RPDB API**: Register at [RatingPosterDB](https://ratingposterdb.com/) (optional)

## Environment Variables

Add these to your `.env` file:

```env
# Trakt Posters Addon
TRAKT_POSTERS_HOSTNAME=trakt-posters.yourdomain.com
TRAKT_CLIENT_ID=your_trakt_client_id
TRAKT_CLIENT_SECRET=your_trakt_client_secret
TMDB_API_KEY=your_tmdb_api_key
RPDB_API_KEY=your_rpdb_api_key
```

## Installation

1. Add the service to your Docker Compose setup by including `trakt-posters` in your profiles
2. Set the required environment variables
3. Run: `docker-compose up -d trakt-posters`

## Configuration

1. Navigate to `https://your-domain.com/configure`
2. Enter your Trakt access token
3. Generate the install URL
4. Add the addon to Stremio using the generated URL

## Usage

Once configured, the addon will appear in your Stremio home screen with two catalogs:

- **Recently Watched**: Your recently watched TV episodes
- **Upcoming Episodes**: Episodes airing soon from your watchlist

## Caching

The addon implements intelligent caching:

- **Posters**: Cached for 24 hours
- **Metadata**: Cached for 1 hour  
- **Trakt Data**: Cached for 30 minutes

## Architecture

- **Node.js**: Main application runtime
- **Express**: Web framework
- **Redis**: Caching layer
- **PostgreSQL**: User data and metadata storage
- **Traefik**: Reverse proxy with SSL termination

## API Endpoints

- `GET /`: Health check
- `GET /manifest.json`: Addon manifest
- `GET /:config/manifest.json`: User-specific manifest
- `GET /:config/catalog/:type/:id.json`: Catalog data
- `GET /configure`: Configuration page

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build Docker image
npm run build
```

## Logging

Logs are stored in the `/app/logs` directory:

- `error.log`: Error-level logs
- `combined.log`: All logs

## Health Checks

The container includes health checks that verify:

- Application responsiveness
- Database connectivity
- Redis connectivity

## Security

- Rate limiting (100 requests per 15 minutes per IP)
- Helmet.js security headers
- Input validation and sanitization
- Secure token handling

## Troubleshooting

### Common Issues

1. **Invalid Trakt Token**: Ensure your access token is valid and has the required scopes
2. **Missing Posters**: Check RPDB API key and rate limits
3. **Slow Performance**: Verify Redis is running and accessible
4. **Database Errors**: Check PostgreSQL connection and credentials

### Logs

Check the application logs for detailed error information:

```bash
docker logs trakt-posters
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and feature requests, please use the GitHub issue tracker.