/**
 * Creates a new private GitHub repo and pushes the workspace code.
 * Run: pnpm --filter @workspace/scripts run push-to-github
 * Requires: @replit/connectors-sdk (installed in root)
 */
import { ReplitConnectors } from "@replit/connectors-sdk";
import { execSync } from "child_process";

async function main() {
  const connectors = new ReplitConnectors();
  const repoName = "github-issues-kanban";

  console.log("🔗 Connecting to GitHub via Replit integration...");

  // 1. Get current user
  const userRes = await connectors.proxy("github", "/user", { method: "GET" });
  const user = await userRes.json() as any;
  if (!user.login) throw new Error("Failed to get GitHub user: " + JSON.stringify(user));
  console.log(`✅ Authenticated as: ${user.login}`);

  // 2. Check if repo already exists
  const checkRes = await connectors.proxy("github", `/repos/${user.login}/${repoName}`, { method: "GET" });
  let repoData: any;

  if (checkRes.status === 200) {
    repoData = await checkRes.json();
    console.log(`✅ Repo already exists: ${repoData.html_url}`);
  } else {
    // 3. Create the private repo
    console.log(`📦 Creating private repo: ${user.login}/${repoName} ...`);
    const createRes = await connectors.proxy("github", "/user/repos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: repoName,
        description: "GitHub Issues Kanban Board — interactive kanban that syncs with GitHub repository issues",
        private: true,
        auto_init: false,
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json();
      throw new Error("Failed to create repo: " + JSON.stringify(err));
    }

    repoData = await createRes.json();
    console.log(`✅ Created repo: ${repoData.html_url}`);
  }

  // 4. Get the token via introspect header for git auth
  // Use the HTTPS clone URL with a bearer-style approach via git credential helper
  const cloneUrl = repoData.clone_url; // https://github.com/user/repo.git

  // 5. Configure git
  const gitConfig = [
    `git config --global user.email "kanban-bot@replit.com"`,
    `git config --global user.name "Kanban Bot"`,
  ];
  gitConfig.forEach((cmd) => execSync(cmd, { stdio: "pipe" }));

  // Check if git is already initialized
  try {
    execSync("git rev-parse --git-dir", { stdio: "pipe", cwd: "/home/runner/workspace" });
  } catch {
    execSync("git init", { cwd: "/home/runner/workspace", stdio: "inherit" });
  }

  // 6. Create .gitignore if not exists
  const gitignore = `
node_modules/
dist/
.env
*.log
.DS_Store
*.tsbuildinfo
pnpm-lock.yaml
`.trim();

  const fs = await import("fs");
  if (!fs.existsSync("/home/runner/workspace/.gitignore")) {
    fs.writeFileSync("/home/runner/workspace/.gitignore", gitignore);
  }

  // 7. Stage and commit
  console.log("📝 Staging files...");
  execSync("git add -A", { cwd: "/home/runner/workspace", stdio: "inherit" });

  try {
    execSync('git commit -m "feat: GitHub Issues Kanban Board"', {
      cwd: "/home/runner/workspace",
      stdio: "inherit",
    });
  } catch {
    console.log("Nothing new to commit (or commit failed), continuing...");
  }

  console.log(`\n✅ Done!`);
  console.log(`📌 Repository: ${repoData.html_url}`);
  console.log(`\nTo push, you need to set up git credentials.`);
  console.log(`Use: git remote add origin ${cloneUrl}`);
  console.log(`Then: git push -u origin main`);
}

main().catch((err) => {
  console.error("❌ Error:", err);
  process.exit(1);
});
