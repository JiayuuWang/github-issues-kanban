import { z } from "zod";

// --- GitHub Issues ---

export const GetIssuesQueryParams = z.object({
  owner: z.string(),
  repo: z.string(),
  state: z.enum(["open", "closed", "all"]).optional().default("all"),
  per_page: z.coerce.number().optional().default(100),
  page: z.coerce.number().optional().default(1),
});

const GitHubLabel = z.object({
  id: z.number(),
  name: z.string(),
  color: z.string(),
  description: z.string().nullable(),
});

const GitHubUser = z.object({
  login: z.string(),
  id: z.number(),
  avatar_url: z.string(),
  html_url: z.string(),
});

const GitHubIssue = z.object({
  id: z.number(),
  number: z.number(),
  title: z.string(),
  body: z.string().nullable(),
  state: z.string(),
  html_url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  closed_at: z.string().nullable(),
  labels: z.array(GitHubLabel),
  assignees: z.array(GitHubUser),
  user: GitHubUser,
  comments: z.number(),
  pull_request: z.any().nullable(),
});

export const GetIssuesResponse = z.object({
  issues: z.array(GitHubIssue),
  total_count: z.number(),
  has_more: z.boolean(),
});

// --- Rate Limit ---

export const GetRateLimitResponse = z.object({
  limit: z.number(),
  remaining: z.number(),
  reset: z.number(),
  used: z.number(),
});

// --- Health ---

export const HealthCheckResponse = z.object({
  status: z.literal("ok"),
});

// --- Board State ---

export const GetBoardStateQueryParams = z.object({
  repoKey: z.string(),
});

const BoardColumnState = z.object({
  columnId: z.string(),
  issueIds: z.array(z.number()),
});

export const SaveBoardStateBody = z.object({
  repoKey: z.string(),
  columns: z.array(BoardColumnState),
});

// --- Type exports ---

export type GitHubIssueType = z.infer<typeof GitHubIssue>;
export type GetIssuesResponseType = z.infer<typeof GetIssuesResponse>;
export type GetRateLimitResponseType = z.infer<typeof GetRateLimitResponse>;
export type BoardColumnStateType = z.infer<typeof BoardColumnState>;
