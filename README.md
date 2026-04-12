# GitHub Release Notifier

A monolithic Node.js/TypeScript service that lets users subscribe to email notifications for new GitHub repository releases.

Built with Express, PostgreSQL, and an optional Redis cache. Follows Hexagonal Architecture — business logic is fully decoupled from transport, persistence, and external APIs.

---

## Features

- Subscribe an email to any public GitHub repository
- Email confirmation flow with tokenized links
- Unsubscribe via token link in every notification email
- Background scanner polls GitHub for new releases on a configurable interval
- GitHub rate-limit handling — propagates `Retry-After`, returns `503`
- Optional Redis caching of GitHub API responses (10-min TTL)
- Falls back to structured log output when SMTP is not configured
- Swagger UI served at `/api/docs`

---

## Requirements

- Node.js 20+
- PostgreSQL 14+
- pnpm
- (Optional) Redis 7+
- A GitHub personal access token

---

## Quick Start with Docker

```bash
cp .env.example .env   # fill in GITHUB_TOKEN and SMTP_* values
docker compose up --build
```

The API is available at `http://localhost:3000`.

---

## Local Development

```bash
pnpm install
cp .env.example .env   # fill in required values

# Start Postgres (and optionally Redis) via Docker
docker compose up postgres redis -d

# Run in watch mode
pnpm dev
```

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `GITHUB_TOKEN` | Yes | — | GitHub personal access token |
| `PORT` | No | `3000` | HTTP port |
| `NODE_ENV` | No | `development` | `development` \| `production` \| `test` |
| `APP_BASE_URL` | No | `http://localhost:3000` | Base URL used in email links |
| `REDIS_URL` | No | — | Redis connection URL; enables GitHub API caching |
| `SCAN_INTERVAL_MS` | No | `300000` | Release scan interval in ms (default 5 min) |
| `SCAN_INITIAL_DELAY_MS` | No | `10000` | Delay before first scan after startup |
| `SMTP_HOST` | No | — | SMTP server host; if unset, emails are logged |
| `SMTP_PORT` | No | `587` | SMTP port |
| `SMTP_SECURE` | No | `false` | Use TLS (`true`/`false`) |
| `SMTP_USER` | No | — | SMTP username |
| `SMTP_PASS` | No | — | SMTP password |
| `SMTP_FROM` | No | `noreply@release-notifier.local` | From address for outgoing emails |

---

## API

Full contract: [`api/openapi.yaml`](api/openapi.yaml). Swagger UI is available at `/api/docs` when the server is running.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/subscribe` | Subscribe an email to a repository |
| `GET` | `/api/subscriptions?email=` | List subscriptions for an email |
| `GET` | `/api/confirm/:token` | Confirm a subscription |
| `GET` | `/api/unsubscribe/:token` | Unsubscribe via token |

### Subscribe

```http
POST /api/subscribe
Content-Type: application/json

{
  "email": "you@example.com",
  "repo": "owner/repository"
}
```

Returns `200` on success. Returns `400` for bad input, `404` if the repository does not exist on GitHub, `409` if already subscribed, `503` if GitHub is rate-limiting.

---

## Scripts

```bash
pnpm dev            # start with hot reload
pnpm build          # compile TypeScript to dist/
pnpm start          # run compiled output
pnpm test           # run unit tests (watch mode)
pnpm test:run       # run unit tests once
pnpm test:coverage  # run with coverage report
pnpm lint           # lint source files
pnpm typecheck      # type-check without emitting
```

---

## Architecture

The service uses **Hexagonal Architecture** (Ports & Adapters):

```
src/
├── domain/           # Pure types, value objects, domain errors (no deps)
├── application/      # Business logic + port interfaces (no infrastructure deps)
│   └── ports/        # SubscriptionRepository, ReleaseSource, Notifier interfaces
└── infrastructure/   # All npm packages live here
    ├── http/         # Express app, routers, DTOs, middleware
    ├── postgres/     # PgSubscriptionRepository + migrations runner
    ├── github/       # GithubReleaseSource (Axios)
    ├── smtp/         # SmtpNotifier (Nodemailer) + email templates
    ├── cache/        # CachedReleaseSource decorator (Redis)
    ├── scheduler/    # startScanner — setInterval wrapper around ScanService
    └── logger/       # Pino logger factory
```

`src/main.ts` is the composition root — all concrete types are constructed and wired there. See [`CLAUDE.md`](CLAUDE.md) for detailed pattern documentation.

---

## Testing

Unit tests live next to the source files they cover (`*.test.ts`). Business logic is tested with in-memory fakes — no database or network required.

```bash
pnpm test:run
```

---

## Migrations

SQL migrations in `migrations/` run automatically on startup. To run them manually:

```bash
pnpm migrate
```
