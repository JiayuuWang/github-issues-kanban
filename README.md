# GitHub Issues Kanban Board

一个与 GitHub 仓库 Issues 实时同步的交互式看板，支持拖拽操作和本地状态持久化。

![Kanban Board Screenshot](https://raw.githubusercontent.com/github/explore/main/topics/kanban/kanban.png)

## 功能特性

- **GitHub 集成**：连接任意公开 GitHub 仓库，以看板卡片形式展示 Issues
- **三列看板**：待处理（Todo）、进行中（In Progress）、已关闭（Closed）
- **智能列映射**：
  - `待处理`：state=open 且无 in-progress/wip 标签
  - `进行中`：state=open 且包含 in-progress 或 wip 标签
  - `已关闭`：state=closed
- **拖拽操作**：使用 dnd-kit 实现流畅拖拽，跨列移动时验证权限
- **权限校验**：跨列拖拽时提示用户验证 GitHub Token（写权限）
- **实时同步**：页面加载自动获取最新 Issues，提供刷新按钮
- **数据持久化**：看板布局通过后端 PostgreSQL 数据库跨刷新保存
- **速率限制提示**：显示 GitHub API 剩余调用次数，触达限制时给出提示
- **Issue 元数据**：展示标签（带颜色编码）、指派人头像、创建日期、评论数
- **响应式布局**：桌面端水平排列，移动端支持横向滚动
- **暗色主题**：黑白灰色调，默认暗色模式

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + Vite 7 + TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui |
| 拖拽 | @dnd-kit/core + @dnd-kit/sortable |
| 数据请求 | TanStack React Query v5 |
| 后端 | Express 5 + TypeScript |
| 数据库 | PostgreSQL + Drizzle ORM |
| API 契约 | OpenAPI 3.1 + Orval 代码生成 |
| 包管理 | pnpm workspaces（monorepo） |

## 项目结构

```
.
├── artifacts/
│   ├── api-server/          # Express 后端 API
│   │   └── src/routes/
│   │       ├── github.ts    # GitHub API 代理路由
│   │       └── board.ts     # 看板状态持久化路由
│   └── kanban-board/        # React 前端应用
│       └── src/
│           ├── components/
│           │   ├── kanban/  # Board、Column、IssueCard 组件
│           │   ├── PermissionDialog.tsx  # 权限校验弹窗
│           │   ├── RepoForm.tsx
│           │   └── RateLimitBadge.tsx
│           ├── pages/
│           │   └── BoardPage.tsx
│           └── lib/
│               └── github-utils.ts  # Issue 列映射逻辑
├── lib/
│   ├── api-spec/openapi.yaml  # OpenAPI 规范（唯一契约来源）
│   ├── api-client-react/      # 生成的 React Query hooks
│   ├── api-zod/               # 生成的 Zod 校验 schema
│   └── db/                    # Drizzle ORM schema + 数据库连接
└── README.md
```

## 本地启动

### 前提条件

- Node.js >= 18
- pnpm >= 9
- PostgreSQL 数据库（或使用 Replit 内置数据库）

### 安装依赖

```bash
pnpm install
```

### 环境变量

创建或确认以下环境变量已设置：

```bash
DATABASE_URL=postgresql://user:password@host:5432/dbname
PORT=8080                    # API 服务端口（自动设置）
GITHUB_TOKEN=ghp_xxx         # 可选：GitHub Personal Access Token，可提升 API 速率限制（60→5000 次/小时）
```

### 数据库迁移

```bash
pnpm --filter @workspace/db run push
```

### 启动开发服务器

**方式一：在 Replit 中**（推荐）

直接点击 Run 按钮，Replit 会自动启动所有服务。

**方式二：手动分别启动**

```bash
# 启动后端 API（端口 8080）
pnpm --filter @workspace/api-server run dev

# 启动前端（另开终端，端口随机分配）
pnpm --filter @workspace/kanban-board run dev
```

### 生产构建

```bash
# 构建 API 服务
pnpm --filter @workspace/api-server run build

# 构建前端静态文件
pnpm --filter @workspace/kanban-board run build
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/github/issues` | 获取仓库 Issues（参数：owner, repo, state, per_page） |
| GET | `/api/github/rate-limit` | 获取 GitHub API 速率限制状态 |
| GET | `/api/board/state` | 读取看板列排列（参数：repoKey） |
| POST | `/api/board/state` | 保存看板列排列 |
| GET | `/api/healthz` | 健康检查 |

## 列映射规则

```
┌─────────────────┬────────────────────────────────────────────────┐
│ 待处理 (Todo)   │ state = "open"                                 │
│                 │ AND 无 in-progress / wip 标签                   │
├─────────────────┼────────────────────────────────────────────────┤
│ 进行中          │ state = "open"                                 │
│ (In Progress)   │ AND 包含 in-progress 或 wip 标签               │
├─────────────────┼────────────────────────────────────────────────┤
│ 已关闭 (Closed) │ state = "closed"                               │
└─────────────────┴────────────────────────────────────────────────┘
```

用户可通过拖拽在本地覆盖这个默认映射，排列结果会持久化到数据库。跨列拖拽时会弹出权限校验弹窗。

## 拖拽权限说明

- **同列内排序**：无需任何权限，直接保存到本地数据库
- **跨列移动**：弹出对话框
  - 可以选择"仅本地移动"（不修改 GitHub，仅更新看板排列）
  - 或者提供 GitHub Personal Access Token（需要 `repo` 权限）进行权限验证

## GitHub Token（可选）

提供 GitHub Token 可以：
1. 将 API 速率限制从 60 次/小时提升至 5000 次/小时
2. 在跨列拖拽时验证写权限

在 Replit 中，将 Token 设置为 `GITHUB_TOKEN` 环境变量（Secret）即可。
