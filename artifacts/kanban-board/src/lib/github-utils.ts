import { type GitHubIssue } from "@workspace/api-client-react";

// Labels that indicate "in progress" state
const IN_PROGRESS_LABELS = ['in progress', 'in-progress', 'wip', 'doing', 'work in progress'];

// Labels that indicate "awaiting user feedback" (keep in todo)
const AWAITING_LABELS = ['awaiting user feedback', 'waiting for response', 'needs more info', 'on hold', 'blocked'];

// Labels to optionally exclude from "done" column
const WONT_FIX_LABELS = ['wontfix', "won't fix", 'duplicate', 'invalid'];

export function hasLabel(issue: GitHubIssue, keywords: string[]): boolean {
  return issue.labels.some(l =>
    keywords.some(kw => l.name.toLowerCase().replace(/-/g, ' ').includes(kw.replace(/-/g, ' ')))
  );
}

export function isInProgress(issue: GitHubIssue): boolean {
  return hasLabel(issue, IN_PROGRESS_LABELS);
}

export function isAwaitingFeedback(issue: GitHubIssue): boolean {
  return hasLabel(issue, AWAITING_LABELS);
}

/**
 * Determine the default kanban column for a GitHub issue.
 *
 * Mapping rules:
 *   - Closed issues → "done"
 *   - Open issues with "in-progress" / "wip" labels → "in-progress"
 *   - Open issues without the above labels → "todo"
 *     (includes issues awaiting feedback — they still count as todo)
 */
export function getDefaultColumnForIssue(issue: GitHubIssue): 'todo' | 'in-progress' | 'done' {
  if (issue.state === 'closed') return 'done';
  if (isInProgress(issue)) return 'in-progress';
  return 'todo';
}

/**
 * Check if moving an issue from one column to another is a "privileged" action
 * requiring write access to the repo (changing issue state or labels).
 */
export function isCrossColumnMove(fromColId: string, toColId: string): boolean {
  return fromColId !== toColId;
}

/**
 * Get contrast text color for a hex background (for label badges)
 */
export function getContrastYIQ(hexcolor: string): string {
  const hex = hexcolor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
  return (yiq >= 128) ? '#000000' : '#ffffff';
}

/**
 * Check if the GitHub token stored in localStorage can write to the given repo.
 * Returns: { canWrite: boolean; login: string | null; reason?: string }
 */
export async function checkWritePermission(
  owner: string,
  repo: string,
  token: string
): Promise<{ canWrite: boolean; login: string | null; reason?: string }> {
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!res.ok) {
      return { canWrite: false, login: null, reason: 'Token invalid or repo not accessible' };
    }

    const data = await res.json();
    const permissions = data.permissions;

    // Fetch authenticated user
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });
    const user = userRes.ok ? await userRes.json() : null;

    const canWrite = permissions?.push || permissions?.admin || false;
    return {
      canWrite,
      login: user?.login ?? null,
      reason: canWrite ? undefined : 'You only have read access to this repository',
    };
  } catch {
    return { canWrite: false, login: null, reason: 'Network error checking permissions' };
  }
}
