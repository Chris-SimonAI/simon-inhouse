# Meet Simon - Docker Development

This project uses Docker Compose for development. All commands should be run through Docker containers.

## Prerequisites

- Docker and Docker Compose
- `.env` file configured with required environment variables

## Getting Started

### Start the development environment

```bash

# Start all services with hot reloading (recommended)
docker-compose up --build --watch

# Or start without watch mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

### Development Workflow

```bash
# Start development server with hot reloading
docker-compose up --build --watch

# Run the application at http://localhost:3000
```

**Note**: The `--watch` flag enables automatic file synchronization between your host and container, providing hot reloading during development.

## Available Commands

All npm scripts are run through the Docker container:

### Database Operations

```bash
# Generate database schema from your Drizzle definitions
docker-compose exec app npm run db:generate

# Run pending database migrations
docker-compose exec app npm run db:migrate

# Open Drizzle Studio (database GUI) at http://localhost:4983
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

### Development Commands

```bash
# Start with hot reloading (recommended for development)
docker-compose up --build --watch

# Start without watch mode
docker-compose up -d

# Restart only the app container
docker-compose restart app
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

### Hot Reloading Issues

If hot reloading isn't working, try these solutions:

1. **Use watch mode (recommended)**:
   ```bash
   docker-compose up --build --watch
   ```

2. **Restart the development server**:
   ```bash
   docker-compose restart app
   ```

3. **Alternative: Run Next.js directly on host**:
   ```bash
   # Start only the database in Docker
   docker-compose up -d db

   # Run Next.js on host
   npm run dev
   ```

### Rebuild containers

If you need to rebuild after dependency changes:

```bash
# Rebuild with watch mode (recommended)
docker-compose down
docker-compose up --build --watch

# Or rebuild without watch mode
docker-compose down
docker-compose up --build -d
```

### About Watch Mode

The `--watch` flag enables:
- **Automatic file synchronization** between host and container
- **Hot reloading** when you make changes to source files
- **Automatic container rebuilds** when package.json or package-lock.json changes
- **Better development experience** with instant feedback

Use this for active development work.

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


# Demo Preparation Guide

Run the following commands in order to prepare the demo:

```sh
# 1. Start all services with hot reloading (recommended)
docker-compose up --build --watch

# 2. Generate database schema from your Drizzle definitions
docker-compose exec app npm run db:generate

# 3. Run pending database migrations
docker-compose exec app npm run db:migrate

# 4. Seed initial data

# On macOS / Linux
curl -X POST http://localhost:3000/api/demo

# On Windows
curl.exe -X POST http://localhost:3000/api/demo
