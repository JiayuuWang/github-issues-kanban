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
│   ├── client/                 # React frontend app
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
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## Getting Started

### Prerequisites

- **Node.js >= 18** (20 LTS recommended)
- **pnpm >= 9** ([install](https://pnpm.io/installation))
- **PostgreSQL** database

### 1. Clone and install

```bash
git clone https://github.com/JiayuuWang/github-issues-kanban.git
cd github-issues-kanban
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your DATABASE_URL and optionally GITHUB_TOKEN
```

### 3. Initialize the database

```bash
pnpm --filter @workspace/db run push
```

### 4. Start development servers

```bash
# Terminal 1: Start backend API (port 3001)
pnpm run dev:server

# Terminal 2: Start frontend (port 5173, proxies /api to backend)
pnpm run dev:client
```

Then open `http://localhost:5173` and enter a repository name like `facebook/react` or `microsoft/vscode`.

## Production Build

```bash
pnpm run build
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/github/issues` | Fetch repo issues (params: owner, repo, state, per_page, page) |
| GET | `/api/github/repo-info` | Get repo info and push permission |
| GET | `/api/github/rate-limit` | Get GitHub API rate limit status |
| GET | `/api/board/state` | Read board column layout (param: repoKey) |
| POST | `/api/board/state` | Save board column layout |
| PATCH | `/api/github/issues/update` | Update issue state/labels on GitHub |

## Read/Write Mode

| Condition | Mode | Columns | Drag & Drop |
|-----------|------|---------|-------------|
| No GITHUB_TOKEN | Read-only | 2 (Open / Closed) | No |
| Token without push access | Read-only | 2 (Open / Closed) | No |
| Token with push access | Read-write | 3 (Open / In Progress / Closed) | Yes |

## License

MIT
