import { Router, type IRouter } from "express";
import { GetIssuesQueryParams, GetIssuesResponse, GetRateLimitResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const GITHUB_API_BASE = "https://api.github.com";

async function githubFetch(path: string, req: any): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "kanban-board-app",
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return fetch(`${GITHUB_API_BASE}${path}`, { headers });
}

router.get("/issues", async (req, res) => {
  const parseResult = GetIssuesQueryParams.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({ error: "bad_request", message: "Missing owner or repo parameter" });
    return;
  }

  const { owner, repo, state = "all", per_page = 100, page = 1 } = parseResult.data;

  try {
    const response = await githubFetch(
      `/repos/${owner}/${repo}/issues?state=${state}&per_page=${per_page}&page=${page}&sort=updated&direction=desc`,
      req
    );

    if (response.status === 403) {
      const data = await response.json() as any;
      if (data.message?.includes("rate limit")) {
        const resetHeader = response.headers.get("x-ratelimit-reset");
        const resetAt = resetHeader ? new Date(Number(resetHeader) * 1000).toISOString() : null;
        res.status(429).json({
          error: "rate_limit_exceeded",
          message: "GitHub API rate limit exceeded. Please wait before trying again.",
          reset_at: resetAt,
        });
        return;
      }
    }

    if (response.status === 404) {
      res.status(404).json({ error: "not_found", message: `Repository ${owner}/${repo} not found or not accessible` });
      return;
    }

    if (!response.ok) {
      const data = await response.json() as any;
      res.status(response.status).json({ error: "github_error", message: data.message || "GitHub API error" });
      return;
    }

    const rawIssues = await response.json() as any[];
    const linkHeader = response.headers.get("link") || "";
    const hasMore = linkHeader.includes('rel="next"');

    const issues = rawIssues.map((issue: any) => ({
      id: issue.id,
      number: issue.number,
      title: issue.title,
      body: issue.body ?? null,
      state: issue.state,
      html_url: issue.html_url,
      created_at: issue.created_at,
      updated_at: issue.updated_at,
      closed_at: issue.closed_at ?? null,
      labels: (issue.labels || []).map((l: any) => ({
        id: l.id,
        name: l.name,
        color: l.color,
        description: l.description ?? null,
      })),
      assignees: (issue.assignees || []).map((a: any) => ({
        login: a.login,
        id: a.id,
        avatar_url: a.avatar_url,
        html_url: a.html_url,
      })),
      user: {
        login: issue.user.login,
        id: issue.user.id,
        avatar_url: issue.user.avatar_url,
        html_url: issue.user.html_url,
      },
      comments: issue.comments,
      pull_request: issue.pull_request ?? null,
    }));

    const validated = GetIssuesResponse.parse({
      issues,
      total_count: issues.length,
      has_more: hasMore,
    });

    res.json(validated);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch GitHub issues");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch issues from GitHub" });
  }
});

router.get("/rate-limit", async (req, res) => {
  try {
    const response = await githubFetch("/rate_limit", req);

    if (!response.ok) {
      res.status(response.status).json({ error: "github_error", message: "Failed to fetch rate limit" });
      return;
    }

    const data = await response.json() as any;
    const core = data.resources?.core || data.rate;

    const validated = GetRateLimitResponse.parse({
      limit: core.limit,
      remaining: core.remaining,
      reset: core.reset,
      used: core.used,
    });

    res.json(validated);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch rate limit");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch rate limit" });
  }
});

export default router;
