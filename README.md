# GitHub Issues Kanban Board

一个与 GitHub 仓库 Issues 实时同步的交互式看板，支持拖拽操作和本地状态持久化，具有智能读写权限检测。

## 功能特性

- **两种模式**：
  - **只读模式**（Read-only）：浏览他人仓库，显示 Open / Closed 两列，仅可查看
  - **读写模式**（Read-write）：拥有写权限的仓库，显示 Open / In Progress / Closed 三列，可拖拽并同步到 GitHub
- **GitHub 集成**：连接任意公开 GitHub 仓库，以看板卡片形式展示 Issues
- **智能列映射**（读写模式）：
  - `Open（待处理）`：state=open 且无 in-progress/wip 标签
  - `In Progress（进行中）`：state=open 且包含 in-progress 或 wip 标签
  - `Closed（已关闭）`：state=closed
- **分页加载**：每次加载 30 条 issues，列内每组显示 10 条，支持"show more"逐步展开
- **拖拽操作**：使用 dnd-kit 实现流畅拖拽，跨列移动时验证权限
- **Issue 预览**：卡片右上角悬浮 👁 按钮，鼠标悬停显示完整 issue 内容（含正文 Markdown 渲染）
- **彩色头像**：显示指派人/作者头像（原色，不去色）及正文摘要
- **数据持久化**：看板布局通过后端 PostgreSQL 数据库跨刷新保存
- **速率限制提示**：显示 GitHub API 剩余调用次数
- **暗色主题**：黑白灰色调，默认暗色模式

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + Vite 7 + TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui |
| 拖拽 | @dnd-kit/core + @dnd-kit/sortable |
| 后端 | Express 5 + TypeScript |
| 数据库 | PostgreSQL + Drizzle ORM |
| 包管理 | pnpm workspaces（monorepo） |

## 项目结构

```
.
├── artifacts/
│   ├── api-server/              # Express 后端 API (端口 8080)
│   │   └── src/
│   │       └── routes/
│   │           ├── github.ts          # GitHub API 代理（issues, rate-limit, repo-info）
│   │           ├── board.ts           # 看板状态持久化
│   │           └── github-admin.ts    # 仓库创建/代码推送（Replit 集成）
│   └── kanban-board/            # React 前端应用
│       └── src/
│           ├── components/
│           │   ├── kanban/
│           │   │   ├── Board.tsx              # DnD 根组件，模式切换
│           │   │   ├── Column.tsx             # 列组件（分页 10 条/组）
│           │   │   ├── IssueCard.tsx          # Issue 卡片（拖拽、头像、预览按钮）
│           │   │   └── IssuePreviewPopover.tsx # 悬浮详情预览
│           │   ├── PermissionDialog.tsx       # 跨列移动权限弹窗
│           │   ├── RepoForm.tsx
│           │   └── RateLimitBadge.tsx
│           ├── pages/
│           │   └── BoardPage.tsx              # 主页面（分页加载、权限检测）
│           └── lib/
│               └── github-utils.ts            # Issue 列映射逻辑
├── packages/
│   ├── db/                      # Drizzle ORM schema + 数据库连接
│   └── api-spec/                # OpenAPI 规范
├── package.json
├── pnpm-workspace.yaml
└── README.md
```

## 本地启动

### 前提条件

- **Node.js >= 18**（推荐 20 LTS）
- **pnpm >= 9**（[安装方法](https://pnpm.io/installation)）
- **PostgreSQL 数据库**（或使用 Replit 内置数据库）

### 1. 安装 pnpm（如未安装）

```bash
npm install -g pnpm
```

### 2. 克隆仓库并安装依赖

```bash
git clone https://github.com/JiayuuWang/github-issues-kanban.git
cd github-issues-kanban
pnpm install
```

### 3. 配置环境变量

在项目根目录创建 `.env` 文件（或通过 Replit Secrets 设置）：

```bash
# 必填：PostgreSQL 连接字符串
DATABASE_URL=postgresql://user:password@localhost:5432/kanban_db

# 可选：GitHub Personal Access Token（推荐填写）
# 有 Token 时，API 速率限制从 60 次/小时 → 5000 次/小时
# 同时可以自动检测对私有仓库的写权限（读写模式）
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# 可选：后端监听端口（默认 8080）
PORT=8080

# 必填（Replit 自动注入，本地开发需手动设置）
SESSION_SECRET=your-random-secret-here
```

#### 如何获取 GitHub Personal Access Token

1. 访问 GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. 点击 "Generate new token (classic)"
3. 勾选权限：`repo`（完整仓库访问，含私有仓库）
4. 生成并复制 token（以 `ghp_` 开头）

### 4. 初始化数据库

```bash
# 创建 board_states 表
pnpm --filter @workspace/db run push
```

### 5. 启动开发服务器

需要同时在两个终端中运行：

**终端 1：启动后端 API 服务（端口 8080）**

```bash
pnpm --filter @workspace/api-server run dev
```

**终端 2：启动前端（Vite，端口随机）**

```bash
pnpm --filter @workspace/kanban-board run dev
```

> **Replit 用户**：直接点击 Run 按钮，所有服务会自动启动。

### 6. 访问应用

浏览器打开 `http://localhost:<kanban-port>/`（Vite 会显示实际端口），在顶部输入框中输入仓库名，格式为 `owner/repo`，例如：

- `facebook/react`
- `microsoft/vscode`
- `your-username/your-private-repo`（需要配置有对应仓库权限的 GITHUB_TOKEN）

## 生产构建

```bash
# 构建 API 服务
pnpm --filter @workspace/api-server run build

# 构建前端静态文件
pnpm --filter @workspace/kanban-board run build
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/github/issues` | 获取仓库 Issues（参数：owner, repo, state, per_page, page） |
| GET | `/api/github/repo-info` | 获取仓库信息及当前 token 的写权限 |
| GET | `/api/github/rate-limit` | 获取 GitHub API 速率限制状态 |
| GET | `/api/board/state` | 读取看板列排列（参数：repoKey） |
| POST | `/api/board/state` | 保存看板列排列 |

## 读写模式说明

| 条件 | 模式 | 列数 | 能否拖拽 |
|------|------|------|----------|
| 无 GITHUB_TOKEN | 只读 | 2 (Open / Closed) | ❌ |
| 有 Token 但无 push 权限 | 只读 | 2 (Open / Closed) | ❌ |
| 有 Token 且有 push 权限 | 读写 | 3 (Open / In Progress / Closed) | ✅ |

## 列映射规则（读写模式）

```
┌─────────────────┬────────────────────────────────────────────────┐
│ Open (待处理)   │ state = "open"                                 │
│                 │ AND 无 in-progress / wip 标签                   │
├─────────────────┼────────────────────────────────────────────────┤
│ In Progress     │ state = "open"                                 │
│ (进行中)        │ AND 包含 in-progress 或 wip 标签               │
├─────────────────┼────────────────────────────────────────────────┤
│ Closed (已关闭) │ state = "closed"                               │
└─────────────────┴────────────────────────────────────────────────┘
```

## 分页说明

- 初始每次从 GitHub API 加载 30 条 issues（`state=all`，按 `updated` 降序）
- 每列默认显示最新 10 条，点击列底部 **"show more"** 展示下 10 条
- 当本列已展示完全部已加载 issues 且 GitHub 还有更多时，"show more" 变为 **"load more from github"**，点击后加载下一页（再取 30 条）

## 拖拽权限说明（读写模式）

- **同列内排序**：无需任何权限，直接保存到本地数据库
- **跨列移动**：弹出对话框
  - 选择"仅本地移动"：不修改 GitHub，仅更新看板排列（存数据库）
  - 提供 GitHub Personal Access Token：验证写权限后同步到 GitHub

## 常见问题

**Q: 为什么 issues 数量少于实际？**  
A: 初始只加载前 30 条，点击列底部"load more from github"可继续加载更多。

**Q: 为什么只显示两列而不是三列？**  
A: 未配置 GITHUB_TOKEN 或 token 对该仓库没有 push 权限时，自动切换为只读模式（2列）。

**Q: 速率限制是多少？**  
A: 无 Token 时 60 次/小时；配置 GITHUB_TOKEN 后 5000 次/小时。右上角速率限制徽章会实时显示剩余次数。

**Q: 私有仓库支持吗？**  
A: 支持，需要配置有对应仓库读权限的 GITHUB_TOKEN。
