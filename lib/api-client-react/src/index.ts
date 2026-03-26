import {
  useQuery,
  useMutation,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";
import type {
  GetRateLimitResponseType,
  BoardColumnStateType,
} from "@workspace/api-zod";

// --- Types ---

export interface GitHubLabel {
  id: number;
  name: string;
  color: string;
  description: string | null;
}

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  html_url: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: string;
  html_url: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  labels: GitHubLabel[];
  assignees: GitHubUser[];
  user: GitHubUser;
  comments: number;
  pull_request: unknown | null;
}

// --- Board State ---

interface BoardStateResponse {
  repoKey: string;
  columns: BoardColumnStateType[];
  lastUpdated: string;
}

interface GetBoardStateParams {
  repoKey: string;
}

interface SaveBoardStateData {
  repoKey: string;
  columns: BoardColumnStateType[];
}

const BASE_URL = typeof window !== "undefined"
  ? (import.meta as any).env?.BASE_URL?.replace(/\/$/, "") || ""
  : "";

function apiUrl(path: string) {
  return `${BASE_URL}${path}`;
}

export function getGetBoardStateQueryKey(params?: GetBoardStateParams) {
  return params
    ? ["board", "state", params.repoKey] as const
    : ["board", "state"] as const;
}

export function useGetBoardState(
  params: GetBoardStateParams,
  options?: { query?: Partial<UseQueryOptions<BoardStateResponse>> }
) {
  return useQuery<BoardStateResponse>({
    queryKey: getGetBoardStateQueryKey(params),
    queryFn: async () => {
      const res = await fetch(
        apiUrl(`/api/board/state?repoKey=${encodeURIComponent(params.repoKey)}`)
      );
      if (!res.ok) throw new Error("Failed to fetch board state");
      return res.json();
    },
    ...options?.query,
  });
}

export function useSaveBoardState(options?: {
  mutation?: Partial<UseMutationOptions<BoardStateResponse, Error, { data: SaveBoardStateData }>>;
}) {
  return useMutation<BoardStateResponse, Error, { data: SaveBoardStateData }>({
    mutationFn: async ({ data }) => {
      const res = await fetch(apiUrl("/api/board/state"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save board state");
      return res.json();
    },
    ...options?.mutation,
  });
}

// --- Rate Limit ---

export function getGetRateLimitQueryKey() {
  return ["github", "rate-limit"] as const;
}

export function useGetRateLimit(options?: {
  query?: Partial<UseQueryOptions<GetRateLimitResponseType>>;
}) {
  return useQuery<GetRateLimitResponseType>({
    queryKey: getGetRateLimitQueryKey(),
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/github/rate-limit"));
      if (!res.ok) throw new Error("Failed to fetch rate limit");
      return res.json();
    },
    ...options?.query,
  });
}
