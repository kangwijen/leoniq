# Leoniq Monitoring

Leoniq is a self hosted uptime monitoring app built with Next.js, Postgres, and a worker process.

It provides:
- HTTP and TCP monitor checks
- Live status updates over WebSocket
- Dashboard views for uptime and latency
- Per user webhook configuration
- Down only summary webhook delivery

## Requirements

- Node.js 20+
- npm
- Docker and Docker Compose for containerized runs
- PostgreSQL 16+ if running without Docker

## Environment Variables

Required values:

```dotenv
DATABASE_URL=postgres://postgres:postgres@localhost:5432/leoniq
BETTER_AUTH_SECRET=secret
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:4001
WORKER_POLL_INTERVAL_MS=10000
MONITOR_RETENTION_DAYS=30
```

Additional optional worker values:

```dotenv
WEBHOOK_SUMMARY_INTERVAL_MS=300000
WEBHOOK_TIMEOUT_MS=10000
WS_PORT=4001
```

## Quick Start With Docker

1. Copy environment values
2. Start database, app, and worker

```bash
docker compose up -d --build
```

Open `http://localhost:3000`.

## Local Development

```bash
npm ci
npm run db:migrate
npm run dev
```

In a second terminal:

```bash
npm run worker
```

## Database Workflow

Generate new migration files after schema changes:

```bash
npm run db:generate
```

Apply generated migrations:

```bash
npm run db:migrate
```

Push schema directly without generating migrations:

```bash
npm run db:push
```

## Monitoring Behavior

- The worker scans active monitors on each poll cycle
- Only due monitors are executed based on `intervalSeconds`
- Each check writes a row to `check_results` and updates monitor state
- On monitor creation, the API runs an immediate first check
- The worker publishes monitor updates over WebSocket
- Old check history is cleaned using `MONITOR_RETENTION_DAYS`

## Webhook Behavior

Set a webhook URL from the dashboard via `Webhook settings`. Currently only support Discord webhook.

## Scripts

- `npm run dev` start Next.js development server
- `npm run build` build production app
- `npm run start` run production app
- `npm run worker` run monitoring worker
- `npm run lint` run ESLint
- `npm run test:jest` run Jest tests with coverage
- `npm run test` run Node test suite

## Testing

Run Jest coverage:

```bash
npm run test:jest -- --runInBand
```

Run Node tests:

```bash
npm run test
```
