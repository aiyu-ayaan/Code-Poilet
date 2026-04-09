# ActHub (Frontend + Backend)

ActHub is a GitHub Actions-style local CI/CD dashboard powered by `nektos/act`.

## Stack

- Frontend: React + Vite (`src/`)
- Backend API: Express + MongoDB (`backend/src/`)
- Auth: GitHub OAuth with repo-layer permissions
- Runner: Background queue worker with concurrency limits and dedupe
- Live updates: WebSocket stream for queue and run logs/status

## Environment

Create `.env` from `.env.example` and fill these values:

- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_CALLBACK_URL` (default: `http://localhost:8080/api/auth/github/callback`)
- `JWT_SECRET` (min 32 chars)
- `MONGODB_URI`

### GitHub OAuth App

- Homepage URL: `http://localhost:5173`
- Callback URL: `http://localhost:8080/api/auth/github/callback`

## Docker Compose (Recommended)

### 1) Local development (no Mongo inside compose)

Uses `docker-compose.local.yml` and expects MongoDB to be available externally (host/service URL in `.env`).

```bash
docker compose -f docker-compose.local.yml up --build
```

This starts frontend + backend with `act` support and mounts Docker socket for workflow execution.

### 2) Full deployment (includes MongoDB)

Uses `docker-compose.yml` and starts:

- `acthub` app service
- `mongo` database service

```bash
docker compose up --build -d
```

## API Endpoints

- `GET /api/auth/github/start`
- `GET /api/auth/github/callback`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/repos/sync`
- `GET /api/repos`
- `GET /api/repos/:owner/:name/workflows`
- `GET /api/repos/:owner/:name/workflows/:file/content`
- `POST /api/runs/trigger/:owner/:name`
- `GET /api/runs/history`
- `GET /api/runs/:runId`
- `GET /api/runs/status/queue`

## Non-Docker local run

```bash
npm install
npm run dev
npm run dev:backend
```

## Reliability Features

- Queue dedupe for same repo + workflow + branch
- Background worker with `MAX_CONCURRENT_RUNS`
- Repo permission checks before triggering pipelines
- Real-time log streaming storage per run
