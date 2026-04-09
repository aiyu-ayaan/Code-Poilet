# ActHub (Frontend + Backend)

ActHub is a GitHub Actions-style local CI/CD dashboard powered by `nektos/act`.

## Stack

- Frontend: React + Vite (`src/`)
- Backend API: Express + MongoDB (`backend/src/`)
- Auth: GitHub OAuth with repo-layer permissions
- Runner: Background queue worker with concurrency limits and dedupe
- Live updates: WebSocket stream for queue and run logs/status
- Cache: Redis (optional) with in-memory fallback

## Environment

Create `.env` from `.env.example` and fill these values:

- `PORT` (default: `8090`)
- `VITE_API_PROXY_TARGET` (default: `http://localhost:8090`)
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `GITHUB_CALLBACK_URL` (default: `http://localhost:8090/api/auth/github/callback`)
- `JWT_SECRET` (min 32 chars)
- `ENV_ENCRYPTION_KEY` (min 32 chars)
- `MONGODB_URI`
- `REDIS_URL` (optional)
- `ACT_RUNNER_MODE` (`compose` to use Dockerized act, `binary` to use a local install)
- `ACT_DOCKER_BINARY` (default: `docker`)
- `ACT_DOCKER_HOST` (type: `native | wsl`, default: `native`)
- `ACT_COMPOSE_FILE` (default: `docker-compose.local.yml`)
- `ACT_COMPOSE_SERVICE` (default: `act-runner`)
- `ACT_CONTAINER_REPOS_ROOT` (default: `/workspace/runtime/repos`)

### `ACT_DOCKER_HOST` reference

`ACT_DOCKER_HOST` is used when `ACT_RUNNER_MODE=compose`.

Type:

```txt
native | wsl
```

Supported values:

- `native`: Runs Docker Compose directly from the host shell (default). Use this when `docker` is installed and available in your host PATH.
- `wsl`: Runs Docker Compose through WSL. Use this on Windows when Docker is available inside WSL but not available as `docker.exe` in Windows PATH.

### GitHub OAuth App

- Homepage URL: `http://localhost:5173`
- Callback URL: `http://localhost:8090/api/auth/github/callback`

## Docker Compose (Recommended)

### 1) Local development (no Mongo inside compose)

Uses `docker-compose.local.yml` and expects MongoDB/backend/frontend to be run separately. This file is only for the Dockerized `act` runner.

```bash
docker compose -f docker-compose.local.yml up -d --build act-runner
```

With that running, keep these `.env` values:

```env
ACT_RUNNER_MODE=compose
ACT_DOCKER_BINARY=docker
ACT_DOCKER_HOST=native
ACT_COMPOSE_FILE=docker-compose.local.yml
ACT_COMPOSE_SERVICE=act-runner
ACT_CONTAINER_REPOS_ROOT=/workspace/runtime/repos
```

If you are on Windows and only have Docker available in WSL, use:

```env
ACT_DOCKER_HOST=wsl
```

### 2) Full deployment (includes MongoDB)

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
- `GET /api/repos/:owner/:name/env-profile`
- `POST /api/repos/:owner/:name/env-profile`
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
- Real-time log streaming over WebSockets
- Encrypted env profile storage per workflow
- Repositories cached with Redis/in-memory fallback
