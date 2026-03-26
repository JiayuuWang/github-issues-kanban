# GitHub Issues Kanban Board

An interactive kanban board that syncs with GitHub repository issues. Supports drag-and-drop operations, real-time GitHub synchronization, and intelligent read/write permission detection.

## Features

- **Two modes**:
  - **Read-only**: Browse any public repo — 2 columns (Open / Closed)
  - **Read-write**: Repos you have push access to — 3 columns (Open / In Progress / Closed), drag to sync with GitHub
- **GitHub integration**: Connect any public GitHub repository, view issues as kanban cards
- **Smart column mapping** (read-write mode):
  - `Open` — state=open, no in-progress/wip labels
  - `In Progress` — state=open with `in-progress` or `wip` label
  - `Closed` — state=closed
- **Paginated loading**: 30 issues per API call, 10 per column group with "show more"
- **Drag and drop**: Powered by dnd-kit, cross-column moves sync to GitHub
- **Issue preview**: Hover preview with full markdown body
- **Board persistence**: Column layout saved to PostgreSQL across refreshes
- **Rate limit indicator**: Shows remaining GitHub API calls
- **Dark theme**: Monochrome dark mode by default

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite 7 + TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui |
| Drag & Drop | @dnd-kit/core + @dnd-kit/sortable |
| Backend | Express 5 + TypeScript |
| Database | PostgreSQL + Drizzle ORM |
| Package Manager | pnpm workspaces (monorepo) |

## Project Structure

```
.
├── packages/
│   ├── client/                 # React frontend (Vite dev server, port 5173)
│   │   └── src/
│   │       ├── components/
│   │       │   ├── kanban/     # Board, Column, IssueCard, IssuePreviewPopover
│   │       │   └── ui/        # shadcn/ui components
│   │       ├── hooks/          # useGitHubAuth, useRepoPersistence
│   │       ├── lib/            # github-utils (column mapping logic)
│   │       └── pages/          # BoardPage
│   └── server/                 # Express backend API (port 3001)
│       └── src/
│           └── routes/
│               ├── github.ts   # GitHub API proxy (issues, rate-limit, repo-info)
│               └── board.ts    # Board state persistence
├── lib/
│   ├── db/                     # Drizzle ORM schema + DB connection
│   ├── api-zod/                # Zod schemas for API validation
│   └── api-client-react/       # Generated React Query hooks
├── .env.example                # Environment variable template
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

---

## Getting Started

### Prerequisites

Before you begin, make sure you have the following installed:

| Tool | Version | Installation |
|------|---------|-------------|
| **Node.js** | >= 18 (20 LTS recommended) | https://nodejs.org/ |
| **pnpm** | >= 9 | `npm install -g pnpm` |
| **PostgreSQL** | >= 14 | See [Database Setup](#step-2-set-up-postgresql) below |

### Step 1: Clone and Install Dependencies

```bash
git clone https://github.com/JiayuuWang/github-issues-kanban.git
cd github-issues-kanban
pnpm install
```

> **Note**: This project enforces pnpm — `npm install` and `yarn install` will be rejected.

### Step 2: Set Up PostgreSQL

You need a running PostgreSQL instance. Choose one of the following options:

#### Option A: Local PostgreSQL

Install PostgreSQL on your machine and create a database:

```bash
# macOS (Homebrew)
brew install postgresql@16
brew services start postgresql@16

# Ubuntu/Debian
sudo apt install postgresql
sudo systemctl start postgresql

# Windows (Scoop)
scoop install postgresql

# Then create the database:
createdb kanban_db
```

Your connection string will be:
```
postgresql://postgres:postgres@localhost:5432/kanban_db
```

#### Option B: Docker (recommended for quick setup)

```bash
docker run -d \
  --name kanban-postgres \
  -e POSTGRES_DB=kanban_db \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:16-alpine
```

Your connection string will be:
```
postgresql://postgres:postgres@localhost:5432/kanban_db
```

#### Option C: Cloud PostgreSQL

You can use any managed PostgreSQL provider:

- **[Neon](https://neon.tech)** — free tier, serverless
- **[Supabase](https://supabase.com)** — free tier, full Postgres
- **[Railway](https://railway.app)** — easy deploy
- **[Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)**

Copy the connection string from your provider's dashboard.

### Step 3: Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and fill in the values:

```bash
# REQUIRED — PostgreSQL connection string (from Step 2)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kanban_db

# OPTIONAL — GitHub Personal Access Token
# Without this: 60 API req/hour, public repos only, read-only mode
# With this: 5,000 API req/hour, private repo access, read-write mode
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# OPTIONAL — Server port (default: 3001)
PORT=3001

# REQUIRED for production — Session signing secret
SESSION_SECRET=your-random-secret-here
```

#### How to get a GitHub Personal Access Token

1. Go to **GitHub → Settings → Developer settings → [Personal access tokens (classic)](https://github.com/settings/tokens)**
2. Click **"Generate new token (classic)"**
3. Give it a name (e.g. `kanban-board`)
4. Check the **`repo`** scope (Full control of private repositories)
5. Click **Generate token** and copy it (starts with `ghp_`)
6. Paste it as the `GITHUB_TOKEN` value in your `.env` file

### Step 4: Initialize the Database

Push the Drizzle schema to create the required tables:

```bash
pnpm --filter @workspace/db run push
```

This creates the `board_states` table used for persisting kanban column layouts.

### Step 5: Start the Development Servers

You need to run **two processes** — the backend API server and the frontend dev server:

#### Option A: Two terminals (recommended)

```bash
# Terminal 1 — Backend API server (port 3001)
pnpm run dev:server

# Terminal 2 — Frontend Vite dev server (port 5173)
pnpm run dev:client
```

#### Option B: Single command

```bash
pnpm run dev
```

This starts both servers concurrently. Note: log output from both will be interleaved.

### Step 6: Open the App

Open your browser and go to:

```
http://localhost:5173
```

Enter a repository in the `owner/repo` format in the top search bar. Examples:

| Repository | Description |
|-----------|------------|
| `facebook/react` | Large public repo, read-only mode |
| `microsoft/vscode` | Very active repo |
| `your-username/your-repo` | Your own repo (read-write mode with token) |

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `GITHUB_TOKEN` | No | — | GitHub PAT with `repo` scope. Increases rate limit from 60→5,000/hr. Enables write mode for repos with push access. |
| `PORT` | No | `3001` | Backend API server port |
| `SESSION_SECRET` | Production only | — | Secret for signing session cookies. Use a long random string. |

---

## Development

### Available Scripts

```bash
# Start both servers
pnpm run dev

# Start backend only (port 3001)
pnpm run dev:server

# Start frontend only (port 5173, proxies /api to backend)
pnpm run dev:client

# Type-check all packages
pnpm run typecheck

# Type-check individual package
pnpm --filter @workspace/client run typecheck
pnpm --filter @workspace/server run typecheck

# Build for production
pnpm run build

# Push DB schema changes
pnpm --filter @workspace/db run push
```

### Architecture Notes

- In development, the Vite dev server (port 5173) **proxies** all `/api/*` requests to the backend (port 3001), so you only need to open `localhost:5173`.
- The frontend authenticates with GitHub by sending the user's token via the `X-GitHub-Token` HTTP header. The backend uses this token or falls back to the server-side `GITHUB_TOKEN` env var.
- Cross-column drag-and-drop in read-write mode triggers a `PATCH /api/github/issues/update` call that modifies the issue's state and labels on GitHub. If the sync fails, the UI reverts to the pre-drag state.

---

## Production Build

```bash
# Build everything
pnpm run build
```

This produces:
- `packages/client/dist/` — Static frontend files (serve with nginx, Caddy, etc.)
- `packages/server/dist/index.mjs` — Bundled backend server

To run the production server:

```bash
cd packages/server
node --enable-source-maps ./dist/index.mjs
```

Serve the frontend static files with any web server, configuring it to:
1. Serve `packages/client/dist/` as static files
2. Proxy `/api/*` to the backend server
3. Fall back to `index.html` for client-side routing (SPA)

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/github/issues` | Fetch repo issues (params: owner, repo, state, per_page, page) |
| GET | `/api/github/repo-info` | Get repo info and push permission for current token |
| GET | `/api/github/rate-limit` | Get GitHub API rate limit status |
| GET | `/api/github/user` | Get authenticated GitHub user info |
| GET | `/api/github/user-repos` | List authenticated user's repositories |
| GET | `/api/github/trending` | Get trending repositories |
| PATCH | `/api/github/issues/update` | Update issue state/labels on GitHub |
| GET | `/api/board/state` | Read board column layout (param: repoKey) |
| POST | `/api/board/state` | Save board column layout |
| GET | `/api/healthz` | Health check |

---

## Read/Write Mode

| Condition | Mode | Columns | Drag & Drop |
|-----------|------|---------|-------------|
| No GITHUB_TOKEN | Read-only | 2 (Open / Closed) | No |
| Token without push access | Read-only | 2 (Open / Closed) | No |
| Token with push access | Read-write | 3 (Open / In Progress / Closed) | Yes |

### Column Mapping Rules (Read-Write Mode)

```
┌─────────────────┬────────────────────────────────────────────┐
│ Open            │ state = "open"                             │
│                 │ AND no in-progress / wip label             │
├─────────────────┼────────────────────────────────────────────┤
│ In Progress     │ state = "open"                             │
│                 │ AND has "in-progress" or "wip" label       │
├─────────────────┼────────────────────────────────────────────┤
│ Closed          │ state = "closed"                           │
└─────────────────┴────────────────────────────────────────────┘
```

---

## Troubleshooting

### "Failed to load issues" / 404 error
- Check that the repository name is in `owner/repo` format
- Private repos require a `GITHUB_TOKEN` with `repo` scope

### Only 2 columns showing (no "In Progress")
- This means you're in read-only mode
- Add a `GITHUB_TOKEN` that has push access to the repository

### Rate limit exceeded (429 error)
- Without token: 60 requests/hour — add a `GITHUB_TOKEN` to get 5,000/hour
- The rate limit badge in the top-right corner shows remaining calls

### Database connection error
- Verify `DATABASE_URL` is correct and PostgreSQL is running
- Run `pnpm --filter @workspace/db run push` to create tables

### Port already in use
- Backend default is 3001, frontend is 5173
- Change with `PORT=3002 pnpm run dev:server`
- To change the frontend port: `PORT=3000 pnpm run dev:client`
- If you change the backend port, also set `API_PORT` for the frontend: `API_PORT=3002 pnpm run dev:client`

---

## License

[MIT](LICENSE)
