# Leoniq Monitoring

Leoniq is a self hosted uptime monitoring app built with Next.js, Postgres, and a worker process.

It provides:
- HTTP and TCP monitor checks
- Live status updates over WebSocket
- Dashboard views for uptime, latency, response size, and failure trends
- Time range controls for 1 hour, 6 hours, 24 hours, and 7 days
- Monitor tags, filtered dashboard views, and shareable filter URLs
- Incident timeline on monitor detail pages
- Recent incidents table on the dashboard with direct links to monitor detail pages
- Uptime and latency sparklines in monitor lists
- Per user webhook configuration
- Severity aware alert deduplication with cooldown policies
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

## Dashboard Highlights

- Compact operations wall with range based trends for:
  - latency percentiles
  - uptime timeline
  - latest p95 latency KPI
  - status code distribution
  - response size trend
  - top failure reasons
- Recent incidents card:
  - filtered by selected time range
- Monitor list with:
  - uptime sparkline
  - latency sparkline
  - current state badge
  - tag badges
- Filter controls:
  - type filter for HTTP and TCP
  - tag filter
  - URL query persistence for refresh and sharing

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

Set a webhook URL from the dashboard via `Webhook settings`.

Webhook delivery behavior:
- Notification summaries are down only
- Alerts are grouped by deduplication keys
- Cooldown windows suppress repeated notifications
- Severity levels are derived from down streak progression
- Webhook summary payload includes policy context and suppressed counts

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
