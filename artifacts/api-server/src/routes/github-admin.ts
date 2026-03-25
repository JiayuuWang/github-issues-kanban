/**
 * GitHub admin routes — uses Replit connectors SDK for authenticated GitHub API access.
 * These routes require the GitHub integration to be authorized.
 */
import { Router, type IRouter } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";
import fs from "node:fs";
import path from "node:path";

const router: IRouter = Router();
const ROOT = "/home/runner/workspace";

// Top-level directories to include (allowlist approach)
const INCLUDE_TOP_DIRS = new Set([
  "artifacts",
  "packages",
  "scripts",
]);

// Dirs to always skip at any level
const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  "dist",
  ".cache",
  "dist_server",
  "__pycache__",
  ".pytest_cache",
  "coverage",
  ".nyc_output",
  "build",
]);

// Top-level files to include
const INCLUDE_ROOT_FILES = new Set([
  "package.json",
  "pnpm-workspace.yaml",
  "tsconfig.json",
  "README.md",
  ".gitignore",
]);

function shouldSkip(relPath: string, isRoot: boolean): boolean {
  const parts = relPath.split(path.sep);

  // At root level, only include allowlisted dirs and files
  if (isRoot && parts.length === 1) {
    // Will be handled by caller
    return false;
  }

  // Skip specific dir names at any nesting level
  for (const part of parts) {
    if (SKIP_DIR_NAMES.has(part)) return true;
    // Skip hidden dirs (except .gitignore, etc.)
    if (part.startsWith(".") && !part.includes(".")) return true;
  }

  const base = path.basename(relPath);
  if (base.endsWith(".map") || base.endsWith(".log")) return true;
  // Skip mockup-sandbox
  if (relPath.startsWith("artifacts/mockup-sandbox")) return true;
  return false;
}

function collectFiles(dir: string, root: string, depth = 0): string[] {
  const results: string[] = [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(root, fullPath);

    // At root level, apply allowlist
    if (depth === 0) {
      if (entry.isDirectory() && !INCLUDE_TOP_DIRS.has(entry.name)) continue;
      if (entry.isFile() && !INCLUDE_ROOT_FILES.has(entry.name)) continue;
    }

    if (shouldSkip(relPath, depth === 0)) continue;

    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, root, depth + 1));
    } else if (entry.isFile()) {
      try {
        const stat = fs.statSync(fullPath);
        if (stat.size < 500_000) results.push(fullPath);
      } catch {}
    }
  }
  return results;
}

router.post("/create-repo", async (req, res) => {
  const { name = "github-issues-kanban", description = "" } = req.body;

  try {
    const connectors = new ReplitConnectors();

    const userRes = await connectors.proxy("github", "/user", { method: "GET" });
    if (!userRes.ok) {
      res.status(401).json({ error: "auth_error", message: "GitHub not connected" });
      return;
    }
    const user = await userRes.json() as any;

    // Check if repo exists
    const checkRes = await connectors.proxy("github", `/repos/${user.login}/${name}`, { method: "GET" });
    if (checkRes.ok) {
      const repo = await checkRes.json() as any;
      res.json({ success: true, alreadyExisted: true, html_url: repo.html_url, clone_url: repo.clone_url, owner: user.login, name });
      return;
    }

    // Create repo
    const createRes = await connectors.proxy("github", "/user/repos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: description || "GitHub Issues Kanban Board — interactive kanban synced with GitHub repository issues",
        private: true,
        auto_init: false,
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json() as any;
      res.status(createRes.status).json({ error: "github_error", message: err.message || "Failed to create repo" });
      return;
    }

    const repo = await createRes.json() as any;
    res.json({ success: true, alreadyExisted: false, html_url: repo.html_url, clone_url: repo.clone_url, owner: user.login, name });
  } catch (err) {
    req.log.error({ err }, "Failed to create GitHub repo");
    res.status(500).json({ error: "internal_error", message: "Failed to create repo" });
  }
});

router.post("/push-code", async (req, res) => {
  const { owner, name, message = "Initial commit" } = req.body;

  if (!owner || !name) {
    res.status(400).json({ error: "missing_params", message: "owner and name required" });
    return;
  }

  try {
    const connectors = new ReplitConnectors();

    // Collect all project files
    const allFiles = collectFiles(ROOT, ROOT);
    req.log.info({ count: allFiles.length }, "Collected files for push");

    const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

    async function putFile(filePath: string, existingSha?: string, retries = 3): Promise<boolean> {
      const relPath = path.relative(ROOT, filePath);
      let content: string;
      try {
        const raw = fs.readFileSync(filePath);
        content = raw.toString("base64");
      } catch {
        return false;
      }

      for (let attempt = 0; attempt <= retries; attempt++) {
        const body: Record<string, unknown> = { message: `Add ${relPath}`, content };
        if (existingSha) body.sha = existingSha;

        const putRes = await connectors.proxy("github", `/repos/${owner}/${name}/contents/${relPath}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Accept": "application/vnd.github+json" },
          body: JSON.stringify(body),
        });

        if (putRes.ok) {
          await putRes.body?.cancel().catch(() => {});
          return true;
        }

        const errBody = await putRes.json().catch(() => ({})) as any;

        // File already exists — get its SHA and retry
        if ((putRes.status === 422 || putRes.status === 409) && !existingSha) {
          const getRes = await connectors.proxy("github", `/repos/${owner}/${name}/contents/${relPath}`, {
            method: "GET",
            headers: { "Accept": "application/vnd.github+json" },
          });
          if (getRes.ok) {
            const existing = await getRes.json() as any;
            existingSha = existing?.sha;
            if (existingSha) continue; // retry with sha
          } else {
            await getRes.body?.cancel().catch(() => {});
          }
        }

        if (putRes.status === 429 || putRes.status === 503) {
          const wait = (attempt + 1) * 3000;
          req.log.warn({ file: relPath, attempt, wait }, "Rate limited, waiting...");
          await delay(wait);
          continue;
        }

        req.log.warn({ file: relPath, status: putRes.status, msg: errBody?.message }, "Failed");
        return false;
      }
      return false;
    }

    let uploaded = 0;
    let failed = 0;

    for (const filePath of allFiles) {
      const ok = await putFile(filePath);
      if (ok) uploaded++;
      else failed++;
      // Throttle: 200ms between requests
      await delay(200);
    }

    req.log.info({ uploaded, failed }, "Push complete");

    res.json({
      success: true,
      filesUploaded: uploaded,
      filesFailed: failed,
      html_url: `https://github.com/${owner}/${name}`,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to push code");
    res.status(500).json({ error: "internal_error", message: String(err) });
  }
});

export default router;
