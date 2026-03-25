# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A GitHub Issues Kanban Board — interactive board syncing with GitHub repositories. Supports read-only (2-column: Open/Closed) and read-write (3-column: Open/In Progress/Closed) modes based on token permissions.

## Tech Stack

- **Frontend**: React 19 + Vite 7 + TypeScript, Tailwind CSS v4 + shadcn/ui, wouter (routing), @dnd-kit (drag-and-drop), framer-motion, @tanstack/react-query
- **Backend**: Express 5 + TypeScript, esbuild (bundling), pino (logging)
- **Database**: PostgreSQL + Drizzle ORM
- **Monorepo**: pnpm workspaces

## Commands

```bash
# Install dependencies (must use pnpm, enforced by preinstall script)
pnpm install

# Typecheck everything
pnpm run typecheck

# Build all packages
pnpm run build

# Dev — run both servers
pnpm run dev

# Dev — run backend only (port 3001)
pnpm run dev:server

# Dev — run frontend only (port 5173, proxies /api to backend)
pnpm run dev:client

# Typecheck individual packages
pnpm --filter @workspace/client run typecheck
pnpm --filter @workspace/server run typecheck

# Push database schema
pnpm --filter @workspace/db run push
```

## Architecture

### Monorepo Layout

- `packages/client/` — React frontend (`@workspace/client`)
- `packages/server/` — Express backend (`@workspace/server`)
- `lib/db/` — Drizzle ORM schema + DB connection (`@workspace/db`)
- `lib/api-zod/` — Zod schemas for API request/response validation (`@workspace/api-zod`)
- `lib/api-client-react/` — Generated React Query hooks + TypeScript types (`@workspace/api-client-react`)

### Frontend Structure (`packages/client/src/`)

- `App.tsx` — Root: QueryClientProvider + wouter Router, single route `/` → BoardPage
- `pages/BoardPage.tsx` — Main page: handles repo input, issue fetching (paginated, 30/page), repo info + permission detection, renders Board
- `components/kanban/Board.tsx` — DnD root: manages column state, persists via board-state API, syncs cross-column moves to GitHub (with optimistic updates + rollback)
- `components/kanban/Column.tsx` — Column with paginated display (10 per group, "show more")
- `components/kanban/IssueCard.tsx` — Draggable issue card
- `components/kanban/IssuePreviewPopover.tsx` — Hover preview with markdown body
- `hooks/use-github-auth.ts` — Token stored in localStorage, validates via `/api/github/user`
- `lib/github-utils.ts` — Issue-to-column mapping logic (label-based: `in-progress`/`wip` labels → In Progress column)

### Backend Structure (`packages/server/src/`)

- `app.ts` — Express app setup (cors, JSON parsing, pino-http logging), mounts `/api` router
- `routes/github.ts` — GitHub API proxy: issues, repo-info, user, user-repos, trending, rate-limit, issue updates (PATCH). Supports user-supplied token via `X-GitHub-Token` header, falls back to server `GITHUB_TOKEN`
- `routes/board.ts` — Board state CRUD: GET/POST `/api/board/state` backed by PostgreSQL (upsert on repoKey)

### Key Data Flow

1. User enters `owner/repo` → BoardPage fetches issues + repo-info in parallel
2. `repo-info` response includes `has_push` → determines read-only vs read-write mode
3. In read-write mode, Board loads saved column state from DB, merges with fetched issues
4. Cross-column drag → PATCH to `/api/github/issues/update` (state change, label add/remove) → on success, persists column order to DB; on failure, reverts UI to pre-drag snapshot
5. In development, Vite proxies `/api` requests to the backend server

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (required)
- `GITHUB_TOKEN` — Server-side fallback token (optional, increases rate limit from 60→5000/hr)
- `SESSION_SECRET` — Required for sessions
- `PORT` — Backend port (default 3001)

## Conventions

- Dark theme: black/zinc/gray color palette, monospace font throughout
- GitHub token passthrough: frontend sends token via `X-GitHub-Token` header, backend uses it or falls back to env `GITHUB_TOKEN`
- API validation uses Zod schemas from `@workspace/api-zod`
- Frontend API hooks come from `@workspace/api-client-react` (generated React Query hooks)
