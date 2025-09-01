# Meet Simon - Docker Development

This project uses Docker Compose for development. All commands should be run through Docker containers.

## Prerequisites

- Docker and Docker Compose
- `.env` file configured with required environment variables

## Getting Started

### Start the development environment

```bash
# Start all services (app and database)
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### Development Workflow

```bash
# Start development server
docker-compose up -d

# Run the application at http://localhost:3000
```

## Available Commands

All npm scripts are run through the Docker container:

### Database Operations

```bash
# Generate database schema
docker-compose exec app npm run db:generate

# Run database migrations
docker-compose exec app npm run db:migrate

# Open Drizzle Studio (database GUI)
docker-compose exec app npm run db:studio
```

### Code Quality

```bash
# Run linting
docker-compose exec app npm run lint

# Run linting with auto-fix
docker-compose exec app npm run lint:fix

# Run tests
docker-compose exec app npm run test
```

### Build Operations

```bash
# Build for production
docker-compose exec app npm run build

# Start production server
docker-compose exec app npm run start
```

## Interactive Development

For multiple commands or interactive development:

```bash
# Start interactive shell in container
docker-compose exec app sh

# Then run commands interactively:
npm run db:migrate
npm run db:generate
npm run test
```

## Database Access

The PostgreSQL database is available at:
- **Host**: localhost
- **Port**: 5432
- **Database**: meet-simon
- **Username**: postgres
- **Password**: 123456

You can connect using any PostgreSQL client or through Drizzle Studio:

```bash
docker-compose exec app npm run db:studio
```

## Troubleshooting

### Hot Reloading Limitations

⚠️ **Known Issue**: Hot reloading does not work inside Docker containers with Next.js/Turbopack.

**Problem**: Changes made to source files are not automatically reflected in the browser when running the development server inside Docker. The host's `.next` directory gets updated, but the container's `.next` directory remains unchanged.

**Workaround**:
- For development, consider running Next.js directly on your host machine instead of Docker
- If using Docker is required, manually restart the container after code changes
- Track this issue: [Next.js GitHub Issue #71622](https://github.com/vercel/next.js/issues/71622)

**Alternative Development Setup**:
```bash
# Run Next.js directly on host (recommended for development)
npm run dev

# Database still runs in Docker
docker-compose up -d postgres
```

### Rebuild containers

If you need to rebuild after dependency changes:

```bash
# Rebuild and restart
docker-compose down
docker-compose up --build -d
```

### Clean up

```bash
# Stop and remove containers, networks, volumes
docker-compose down -v --remove-orphans

# Remove images
docker-compose down --rmi all
```

### View container status

```bash
# List running containers
docker-compose ps

# View resource usage
docker stats
```

## Project Structure

- `docker-compose.yml` - Main Docker Compose configuration
- `Dockerfile.dev` - Development container configuration
- `Dockerfile` - Production container configuration
- `src/` - Application source code
- `package.json` - Node.js dependencies and scripts
