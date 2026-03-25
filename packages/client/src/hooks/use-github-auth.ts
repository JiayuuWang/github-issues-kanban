import { useState, useEffect, useCallback } from 'react';

const TOKEN_KEY = 'gh_kanban_token';
const USER_KEY = 'gh_kanban_user';

export interface GitHubUser {
  login: string;
  id: number;
  avatar_url: string;
  name: string | null;
  html_url: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  description: string | null;
  stargazers_count: number;
  pushed_at: string;
  language: string | null;
  open_issues_count: number;
  permissions: { push: boolean; admin: boolean };
}

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

function apiUrl(path: string) {
  return `${BASE_URL}${path}`;
}

export function useGitHubAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<GitHubUser | null>(() => {
    const stored = localStorage.getItem(USER_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  const [userRepos, setUserRepos] = useState<GitHubRepo[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (inputToken: string): Promise<boolean> => {
    setIsValidating(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/github/user'), {
        headers: { 'X-GitHub-Token': inputToken },
      });
      if (!res.ok) {
        setError('Invalid token. Make sure it has "repo" scope.');
        setIsValidating(false);
        return false;
      }
      const userData: GitHubUser = await res.json();
      localStorage.setItem(TOKEN_KEY, inputToken);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      setToken(inputToken);
      setUser(userData);
      setIsValidating(false);
      return true;
    } catch {
      setError('Network error. Please try again.');
      setIsValidating(false);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    setUserRepos([]);
  }, []);

  const fetchUserRepos = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(apiUrl('/api/github/user-repos'), {
        headers: { 'X-GitHub-Token': token },
      });
      if (res.ok) {
        const repos: GitHubRepo[] = await res.json();
        setUserRepos(repos);
      }
    } catch {
      // silent
    }
  }, [token]);

  useEffect(() => {
    if (token && userRepos.length === 0) {
      fetchUserRepos();
    }
  }, [token, fetchUserRepos, userRepos.length]);

  return { token, user, userRepos, isValidating, error, login, logout, fetchUserRepos };
}
