import { Router, type IRouter } from "express";
import * as cheerio from "cheerio";
import { GetIssuesQueryParams, GetIssuesResponse, GetRateLimitResponse } from "@workspace/api-zod";

const router: IRouter = Router();
const GITHUB_API_BASE = "https://api.github.com";

async function githubFetch(path: string, req: any): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "kanban-board-app",
  };

  // Prefer user-supplied token (from frontend), fall back to server env var
  const userToken = req.headers["x-github-token"] as string | undefined;
  const token = userToken || process.env.GITHUB_TOKEN;
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
    // Use Search API to get only real issues (excludes PRs)
    const stateQualifier = state === "all" ? "" : ` state:${state}`;
    const q = `repo:${owner}/${repo} is:issue${stateQualifier}`;
    const response = await githubFetch(
      `/search/issues?q=${encodeURIComponent(q)}&sort=updated&order=desc&per_page=${per_page}&page=${page}`,
      req
    );

    if (response.status === 403) {
      const data = await response.json() as any;
      if (data.message?.includes("rate limit")) {
        const resetHeader = response.headers.get("x-ratelimit-reset");
        const resetAt = resetHeader ? new Date(Number(resetHeader) * 1000).toISOString() : null;
        res.status(429).json({ error: "rate_limit_exceeded", message: "GitHub API rate limit exceeded.", reset_at: resetAt });
        return;
      }
    }

    if (response.status === 404 || response.status === 422) {
      res.status(404).json({ error: "not_found", message: `Repository ${owner}/${repo} not found or not accessible` });
      return;
    }

    if (!response.ok) {
      const data = await response.json() as any;
      res.status(response.status).json({ error: "github_error", message: data.message || "GitHub API error" });
      return;
    }

    const searchResult = await response.json() as any;
    const rawIssues = searchResult.items || [];
    const totalCount = searchResult.total_count || 0;
    const hasMore = page * per_page < totalCount;

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
      labels: (issue.labels || []).map((l: any) => ({ id: l.id, name: l.name, color: l.color, description: l.description ?? null })),
      assignees: (issue.assignees || []).map((a: any) => ({ login: a.login, id: a.id, avatar_url: a.avatar_url, html_url: a.html_url })),
      user: { login: issue.user.login, id: issue.user.id, avatar_url: issue.user.avatar_url, html_url: issue.user.html_url },
      comments: issue.comments,
      pull_request: issue.pull_request ?? null,
    }));

    const validated = GetIssuesResponse.parse({ issues, total_count: totalCount, has_more: hasMore });
    res.json(validated);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch GitHub issues");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch issues from GitHub" });
  }
});

router.get("/repo-info", async (req, res) => {
  const { owner, repo } = req.query as { owner?: string; repo?: string };
  if (!owner || !repo) {
    res.status(400).json({ error: "bad_request", message: "Missing owner or repo" });
    return;
  }
  try {
    const response = await githubFetch(`/repos/${owner}/${repo}`, req);
    if (!response.ok) {
      res.status(response.status).json({ error: "github_error", message: "Repo not found or not accessible" });
      return;
    }
    const data = await response.json() as any;
    res.json({
      full_name: data.full_name,
      private: data.private,
      open_issues_count: data.open_issues_count,
      has_push: data.permissions?.push || data.permissions?.admin || false,
      has_admin: data.permissions?.admin || false,
      owner_login: data.owner?.login,
      description: data.description,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch repo info");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch repo info" });
  }
});

router.get("/user", async (req, res) => {
  const userToken = req.headers["x-github-token"] as string | undefined;
  if (!userToken) {
    res.status(401).json({ error: "unauthorized", message: "No GitHub token provided" });
    return;
  }
  try {
    const response = await fetch(`${GITHUB_API_BASE}/user`, {
      headers: {
        Authorization: `Bearer ${userToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "kanban-board-app",
      },
    });
    if (!response.ok) {
      res.status(401).json({ error: "unauthorized", message: "Invalid GitHub token" });
      return;
    }
    const user = await response.json() as any;
    res.json({ login: user.login, id: user.id, avatar_url: user.avatar_url, name: user.name, html_url: user.html_url });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch GitHub user");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch user info" });
  }
});

router.get("/user-repos", async (req, res) => {
  try {
    const page = parseInt((req.query.page as string) || "1", 10);
    const response = await githubFetch(`/user/repos?sort=pushed&per_page=50&page=${page}&affiliation=owner,collaborator`, req);
    if (!response.ok) {
      res.status(response.status).json({ error: "github_error", message: "Failed to fetch repos" });
      return;
    }
    const repos = await response.json() as any[];
    res.json(repos.map((r: any) => ({
      id: r.id,
      name: r.name,
      full_name: r.full_name,
      private: r.private,
      description: r.description,
      stargazers_count: r.stargazers_count,
      pushed_at: r.pushed_at,
      language: r.language,
      open_issues_count: r.open_issues_count,
      permissions: { push: r.permissions?.push || false, admin: r.permissions?.admin || false },
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch user repos");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch user repos" });
  }
});

router.patch("/issues/update", async (req, res) => {
  const { owner, repo, number, state, add_labels, remove_labels } = req.body as {
    owner: string;
    repo: string;
    number: number;
    state?: "open" | "closed";
    add_labels?: string[];
    remove_labels?: string[];
  };

  if (!owner || !repo || !number) {
    res.status(400).json({ error: "bad_request", message: "Missing required fields" });
    return;
  }

  const errors: string[] = [];

  try {
    // 1. Update state if specified
    if (state) {
      const userToken = req.headers["x-github-token"] as string | undefined;
      const token = userToken || process.env.GITHUB_TOKEN;
      const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "kanban-board-app",
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const stateRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${number}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ state }),
      });
      if (!stateRes.ok) {
        const d = await stateRes.json() as any;
        errors.push(`State update failed: ${d.message}`);
      }
    }

    // 2. Add labels if specified
    if (add_labels && add_labels.length > 0) {
      const userToken = req.headers["x-github-token"] as string | undefined;
      const token = userToken || process.env.GITHUB_TOKEN;
      const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "kanban-board-app",
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const addRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${number}/labels`, {
        method: "POST",
        headers,
        body: JSON.stringify({ labels: add_labels }),
      });
      if (!addRes.ok) {
        const d = await addRes.json() as any;
        errors.push(`Add labels failed: ${d.message}`);
      }
    }

    // 3. Remove labels if specified
    if (remove_labels && remove_labels.length > 0) {
      const userToken = req.headers["x-github-token"] as string | undefined;
      const token = userToken || process.env.GITHUB_TOKEN;
      const headers: Record<string, string> = {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "kanban-board-app",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      for (const label of remove_labels) {
        const encoded = encodeURIComponent(label);
        await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${number}/labels/${encoded}`, {
          method: "DELETE",
          headers,
        }).catch(() => { /* silent */ });
      }
    }

    if (errors.length > 0) {
      res.status(422).json({ error: "partial_failure", message: errors.join("; ") });
    } else {
      res.json({ ok: true });
    }
  } catch (err) {
    req.log.error({ err }, "Failed to update GitHub issue");
    res.status(500).json({ error: "internal_error", message: "Failed to update issue on GitHub" });
  }
});

// --- Scrape real GitHub Trending page ---

const TRENDING_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
};

function parseStarCount(text: string): number {
  const clean = text.replace(/,/g, "").trim();
  return parseInt(clean, 10) || 0;
}

router.get("/trending", async (req, res) => {
  const since = (req.query.since as string) || "daily";
  const language = (req.query.language as string) || "";

  let url = `https://github.com/trending`;
  if (language) url += `/${encodeURIComponent(language)}`;
  url += `?since=${since}`;

  try {
    const response = await fetch(url, { headers: TRENDING_HEADERS });
    if (!response.ok) {
      res.status(response.status).json({ error: "github_error", message: "Failed to fetch GitHub trending page" });
      return;
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const repos: any[] = [];

    $("article.Box-row").each((_, el) => {
      const article = $(el);

      // Repository full name (owner/name)
      const nameLink = article.find("h2 a");
      const fullNameParts = nameLink.text().trim().replace(/\s+/g, "").split("/");
      const ownerLogin = fullNameParts[0] || "";
      const repoName = fullNameParts[1] || "";
      if (!ownerLogin || !repoName) return;
      const full_name = `${ownerLogin}/${repoName}`;

      // Description
      const description = article.find("p").first().text().trim() || null;

      // Language
      const langEl = article.find('[itemprop="programmingLanguage"]');
      const language = langEl.text().trim() || null;

      // Stars count (total)
      const starsLinks = article.find("a.Link--muted");
      let stargazers_count = 0;
      let forks_count = 0;
      starsLinks.each((i, link) => {
        const href = $(link).attr("href") || "";
        const count = parseStarCount($(link).text());
        if (href.endsWith("/stargazers")) {
          stargazers_count = count;
        } else if (href.endsWith("/forks")) {
          forks_count = count;
        }
      });

      // Today's stars
      const todayStarsEl = article.find("span.d-inline-block.float-sm-right");
      const todayStarsText = todayStarsEl.text().trim();
      const todayStarsMatch = todayStarsText.match(/([\d,]+)\s+stars?\s+(today|this week|this month)/i);
      const stars_today = todayStarsMatch ? parseStarCount(todayStarsMatch[1]) : 0;
      const stars_period = todayStarsMatch ? todayStarsMatch[2] : "today";

      // Avatar
      const avatarImg = article.find("img[src*='avatars']").first();
      const avatar_url = avatarImg.attr("src") || `https://github.com/${ownerLogin}.png`;

      // Built by (contributors)
      const builtBy: { login: string; avatar_url: string }[] = [];
      article.find('span:contains("Built by")').parent().find("a img, a[data-hovercard-type='user'] img").each((_, img) => {
        const src = $(img).attr("src") || "";
        const alt = $(img).attr("alt") || "";
        const login = alt.startsWith("@") ? alt.slice(1) : alt;
        if (login) builtBy.push({ login, avatar_url: src });
      });

      repos.push({
        id: repos.length + 1,
        name: repoName,
        full_name,
        description,
        stargazers_count,
        forks_count,
        language,
        html_url: `https://github.com/${full_name}`,
        owner: { login: ownerLogin, avatar_url },
        topics: [],
        stars_today,
        stars_period,
        built_by: builtBy.slice(0, 5),
      });
    });

    res.json(repos);
  } catch (err) {
    req.log.error({ err }, "Failed to scrape GitHub trending page");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch trending" });
  }
});

// --- Trending Developers ---

router.get("/trending-developers", async (req, res) => {
  const since = (req.query.since as string) || "daily";
  const language = (req.query.language as string) || "";

  let url = `https://github.com/trending/developers`;
  if (language) url += `/${encodeURIComponent(language)}`;
  url += `?since=${since}`;

  try {
    const response = await fetch(url, { headers: TRENDING_HEADERS });
    if (!response.ok) {
      res.status(response.status).json({ error: "github_error", message: "Failed to fetch trending developers page" });
      return;
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const developers: any[] = [];

    $("article.Box-row").each((_, el) => {
      const article = $(el);

      // Avatar
      const avatarImg = article.find("img").first();
      const avatar_url = avatarImg.attr("src") || "";

      // Username & display name
      const nameLink = article.find("h1.h3 a");
      const displayName = nameLink.text().trim();
      const usernameEl = article.find("p.f4 a");
      const username = usernameEl.text().trim();
      if (!username) return;

      // Popular repo
      const repoArticle = article.find("article");
      const repoLink = repoArticle.find("h1 a");
      const popularRepoName = repoLink.text().trim();
      const popularRepoDesc = repoArticle.find(".f6.color-fg-muted").text().trim();

      developers.push({
        id: developers.length + 1,
        username,
        name: displayName || username,
        avatar_url,
        html_url: `https://github.com/${username}`,
        popular_repo: popularRepoName ? {
          name: popularRepoName,
          description: popularRepoDesc || null,
          html_url: `https://github.com/${username}/${popularRepoName}`,
        } : null,
      });
    });

    res.json(developers);
  } catch (err) {
    req.log.error({ err }, "Failed to scrape GitHub trending developers page");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch trending developers" });
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
    const validated = GetRateLimitResponse.parse({ limit: core.limit, remaining: core.remaining, reset: core.reset, used: core.used });
    res.json(validated);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch rate limit");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch rate limit" });
  }
});

export default router;
