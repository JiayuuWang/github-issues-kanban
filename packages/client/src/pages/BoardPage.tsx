import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Github, RefreshCw, AlertCircle, GitBranch, Lock, LockOpen, LogOut, ChevronDown, LayoutList, LayoutGrid } from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { type GitHubIssue } from '@workspace/api-client-react';
import { useRepoPersistence } from '@/hooks/use-repo-persistence';
import { useGitHubAuth, type GitHubRepo } from '@/hooks/use-github-auth';
import { RepoForm } from '@/components/RepoForm';
import { RateLimitBadge } from '@/components/RateLimitBadge';
import { Board, type BoardMode } from '@/components/kanban/Board';
import { TrendingPanel } from '@/components/TrendingPanel';
import { TopicCloudPanel } from '@/components/TopicCloudPanel';
import { TreemapView } from '@/components/TreemapView';
import { GitHubAuthModal } from '@/components/GitHubAuthModal';
import { motion, AnimatePresence } from 'framer-motion';

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';
const PER_PAGE = 30;
const VIEW_MODE_KEY = 'kanban_view_mode';

type ViewMode = 'columns' | 'treemap';

function apiUrl(path: string) {
  return `${BASE_URL}${path}`;
}

function buildHeaders(token?: string | null): Record<string, string> {
  const h: Record<string, string> = {};
  if (token) h['X-GitHub-Token'] = token;
  return h;
}

interface RepoInfo {
  has_push: boolean;
  open_issues_count: number;
  full_name: string;
  owner_login: string;
}

// Resize handle component
function ResizeHandle({ className = '' }: { className?: string }) {
  return (
    <PanelResizeHandle className={`group relative flex items-center justify-center ${className}`}>
      <div className="w-px h-full bg-zinc-800 group-hover:bg-zinc-600 group-active:bg-zinc-500 transition-colors" />
      <div className="absolute w-3 h-8 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="w-0.5 h-6 rounded-full bg-zinc-600 group-active:bg-zinc-400" />
      </div>
    </PanelResizeHandle>
  );
}

export function BoardPage() {
  const { repoStr, setRepoStr, owner, repo, isValid } = useRepoPersistence();
  const { token, user, userRepos, isValidating, error: authError, login, logout } = useGitHubAuth();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showReposDropdown, setShowReposDropdown] = useState(false);
  const reposDropdownRef = useRef<HTMLDivElement>(null);

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try { return (localStorage.getItem(VIEW_MODE_KEY) as ViewMode) || 'columns'; } catch { return 'columns'; }
  });

  const setAndSaveViewMode = (m: ViewMode) => {
    setViewMode(m);
    try { localStorage.setItem(VIEW_MODE_KEY, m); } catch {}
  };

  // Issue loading state
  const [issues, setIssues] = useState<GitHubIssue[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<{ status?: number; message: string } | null>(null);

  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [mode, setMode] = useState<BoardMode>('readonly');
  const [totalFromGitHub, setTotalFromGitHub] = useState<number | undefined>(undefined);

  // Treemap data
  const [trendingRepos, setTrendingRepos] = useState<any[]>([]);
  const [topicData, setTopicData] = useState<any[]>([]);

  const abortRef = useRef<AbortController | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (reposDropdownRef.current && !reposDropdownRef.current.contains(e.target as Node)) {
        setShowReposDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Fetch trending + topics for treemap mode
  useEffect(() => {
    const fetchExtra = async () => {
      try {
        const [tRes, hRes] = await Promise.all([
          fetch(`${BASE_URL}/api/github/trending?since=daily`),
          fetch(`${BASE_URL}/api/hn/topic-cloud`),
        ]);
        if (tRes.ok) { const d = await tRes.json(); setTrendingRepos(d); }
        if (hRes.ok) { const d = await hRes.json(); setTopicData(d.topics || []); }
      } catch { /* silent */ }
    };
    fetchExtra();
  }, []);

  const fetchPage = useCallback(async (pg: number, append: boolean, signal: AbortSignal) => {
    if (!owner || !repo) return;
    try {
      const params = new URLSearchParams({ owner, repo, state: 'all', per_page: String(PER_PAGE), page: String(pg) });
      const res = await fetch(apiUrl(`/api/github/issues?${params}`), { signal, headers: buildHeaders(token) });
      if (signal.aborted) return;
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as any;
        throw { status: res.status, message: body?.message || 'Failed to load issues' };
      }
      const data = await res.json() as { issues: GitHubIssue[]; has_more: boolean };
      if (signal.aborted) return;
      setIssues((prev) => append ? [...prev, ...data.issues] : data.issues);
      setHasMore(data.has_more);
      setPage(pg);
      setLoadError(null);
    } catch (err: any) {
      if (err?.name === 'AbortError' || signal.aborted) return;
      setLoadError({ status: err?.status, message: err?.message || 'Failed to load issues' });
    }
  }, [owner, repo, token]);

  const fetchRepoInfo = useCallback(async (signal: AbortSignal) => {
    if (!owner || !repo) return;
    try {
      const res = await fetch(apiUrl(`/api/github/repo-info?owner=${owner}&repo=${repo}`), {
        signal, headers: buildHeaders(token),
      });
      if (signal.aborted || !res.ok) return;
      const info = await res.json() as RepoInfo;
      if (signal.aborted) return;
      setRepoInfo(info);
      setMode(info.has_push ? 'readwrite' : 'readonly');
      setTotalFromGitHub(info.open_issues_count);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
    }
  }, [owner, repo, token]);

  useEffect(() => {
    if (!isValid) {
      setIssues([]); setRepoInfo(null); setMode('readonly');
      setLoadError(null); setPage(1); setHasMore(false);
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setIssues([]); setRepoInfo(null); setLoadError(null);
    setPage(1); setHasMore(false); setIsLoading(true);
    Promise.all([fetchPage(1, false, ctrl.signal), fetchRepoInfo(ctrl.signal)])
      .finally(() => { if (!ctrl.signal.aborted) setIsLoading(false); });
    return () => ctrl.abort();
  }, [owner, repo, isValid, fetchPage, fetchRepoInfo]);

  const handleLoadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;
    setIsLoadingMore(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    await fetchPage(page + 1, true, ctrl.signal);
    if (!ctrl.signal.aborted) setIsLoadingMore(false);
  }, [hasMore, isLoadingMore, page, fetchPage]);

  const handleRefresh = () => {
    if (!isValid) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setIsLoading(true); setIssues([]); setPage(1); setHasMore(false);
    Promise.all([fetchPage(1, false, ctrl.signal), fetchRepoInfo(ctrl.signal)])
      .finally(() => { if (!ctrl.signal.aborted) setIsLoading(false); });
  };

  const handleSelectUserRepo = (r: GitHubRepo) => {
    setRepoStr(r.full_name);
    setShowReposDropdown(false);
  };

  const isRateLimitError = loadError?.status === 429;
  const isNotFoundError = loadError?.status === 404;
  const showBoard = isValid && !isLoading && !loadError;

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#111] text-zinc-200">
      {/* Top Bar */}
      <header className="shrink-0 w-full border-b border-zinc-900 px-5 h-12 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 shrink-0">
          <GitBranch className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-mono font-medium text-zinc-200 tracking-tight">kanban</span>
          <span className="text-zinc-700 text-sm">/</span>
          <span className="text-xs font-mono text-zinc-500">github-issues</span>
        </div>

        <div className="flex-1 flex justify-center max-w-xl">
          <RepoForm currentRepo={repoStr} onSetRepo={setRepoStr} isLoading={isLoading} />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isValid && !isLoading && (
            <div className={`hidden sm:flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded-sm border ${
              mode === 'readwrite'
                ? 'text-emerald-600 border-emerald-900 bg-emerald-950/20'
                : 'text-zinc-600 border-zinc-800 bg-zinc-900/50'
            }`}>
              {mode === 'readwrite' ? <><LockOpen className="w-3 h-3" /> write</> : <><Lock className="w-3 h-3" /> read</>}
            </div>
          )}

          <RateLimitBadge />

          {/* View mode toggle */}
          {showBoard && (
            <div className="hidden sm:flex items-center border border-zinc-800 rounded-sm overflow-hidden">
              <button
                onClick={() => setAndSaveViewMode('columns')}
                className={`w-7 h-7 flex items-center justify-center transition-colors ${
                  viewMode === 'columns'
                    ? 'bg-zinc-800 text-zinc-200'
                    : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900'
                }`}
                title="Column view"
              >
                <LayoutList className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setAndSaveViewMode('treemap')}
                className={`w-7 h-7 flex items-center justify-center transition-colors ${
                  viewMode === 'treemap'
                    ? 'bg-zinc-800 text-zinc-200'
                    : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900'
                }`}
                title="Treemap view"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <button
            onClick={handleRefresh}
            disabled={!isValid || isLoading}
            className="w-7 h-7 flex items-center justify-center rounded-sm border border-zinc-800 hover:border-zinc-600 bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Refresh issues"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {user ? (
            <div className="flex items-center gap-1.5">
              <div className="relative" ref={reposDropdownRef}>
                <button
                  onClick={() => setShowReposDropdown((v) => !v)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-sm border border-zinc-800 hover:border-zinc-600 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors text-[11px] font-mono"
                  title="Your repositories"
                >
                  <img src={user.avatar_url} alt={user.login} className="w-4 h-4 rounded-full" />
                  <span className="hidden sm:inline">{user.login}</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${showReposDropdown ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {showReposDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 top-9 w-72 bg-zinc-950 border border-zinc-800 rounded-sm shadow-2xl z-50 overflow-hidden"
                    >
                      <div className="px-3 py-2 border-b border-zinc-800">
                        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">Your Repositories</p>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {userRepos.length === 0 ? (
                          <p className="text-[11px] font-mono text-zinc-600 p-3">Loading repos…</p>
                        ) : (
                          userRepos.map((r) => (
                            <button
                              key={r.id}
                              onClick={() => handleSelectUserRepo(r)}
                              className="w-full flex items-start gap-2 px-3 py-2.5 text-left hover:bg-zinc-900 transition-colors group"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] font-mono text-zinc-300 group-hover:text-white truncate">{r.name}</span>
                                  {r.private && <span className="text-[9px] font-mono text-zinc-600 border border-zinc-700 rounded px-1">private</span>}
                                  {r.permissions.push && <span className="text-[9px] font-mono text-emerald-700 border border-emerald-900 rounded px-1">write</span>}
                                </div>
                                {r.description && <p className="text-[10px] text-zinc-600 truncate mt-0.5">{r.description}</p>}
                              </div>
                              <span className="text-[10px] font-mono text-zinc-700 shrink-0 mt-0.5">{r.open_issues_count} issues</span>
                            </button>
                          ))
                        )}
                      </div>
                      <div className="border-t border-zinc-800 p-2">
                        <button
                          onClick={() => { logout(); setShowReposDropdown(false); }}
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-[11px] font-mono text-zinc-600 hover:text-red-400 hover:bg-zinc-900 rounded-sm transition-colors"
                        >
                          <LogOut className="w-3 h-3" /> Sign out
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border border-zinc-700 hover:border-zinc-500 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors text-[11px] font-mono"
            >
              <Github className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign in</span>
            </button>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 w-full overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">
          {!isValid ? (
            /* --- Empty state --- */
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex overflow-hidden">
              <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
                <Github className="w-8 h-8 text-zinc-700 mb-4" />
                <h2 className="text-sm font-mono font-medium text-zinc-400 mb-2">Connect a repository</h2>
                <p className="text-xs font-mono text-zinc-600 max-w-xs mb-6">
                  Enter a GitHub repository in the format <span className="text-zinc-400">owner/repo</span> above to load its issues.
                </p>
                {!user && (
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="mb-8 flex items-center gap-2 px-4 py-2 rounded-sm border border-zinc-700 hover:border-zinc-500 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors text-xs font-mono"
                  >
                    <Github className="w-3.5 h-3.5" /> Sign in to browse your repositories
                  </button>
                )}
                <div className="w-full max-w-lg border border-zinc-800/60 rounded-sm bg-zinc-900/30">
                  <TopicCloudPanel />
                </div>
              </div>
              <div className="hidden lg:flex flex-col border-l border-zinc-900 p-5 w-[340px] shrink-0 overflow-hidden">
                <TrendingPanel onSelectRepo={setRepoStr} />
              </div>
            </motion.div>
          ) : isLoading ? (
            /* --- Loading skeleton --- */
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex overflow-hidden">
              <div className="flex-1 p-5 flex gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex-1 min-w-[280px] max-w-[340px]">
                    <div className="h-8 w-24 rounded-sm bg-zinc-900 animate-pulse mb-3" />
                    <div className="h-px bg-zinc-800 mb-3" />
                    <div className="space-y-2">{[1, 2, 3].map((j) => <div key={j} className="h-[130px] rounded-sm bg-zinc-900 animate-pulse" />)}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : loadError ? (
            /* --- Error state --- */
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex-1 flex items-center justify-center p-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-sm p-8 max-w-md text-center">
                <AlertCircle className="w-8 h-8 text-red-500/70 mx-auto mb-4" />
                <h3 className="text-sm font-mono font-medium text-zinc-300 mb-2">Failed to load issues</h3>
                <p className="text-xs font-mono text-zinc-500 mb-5">
                  {isRateLimitError ? 'GitHub API rate limit exceeded.' : isNotFoundError ? `Repository "${owner}/${repo}" not found.` : loadError.message}
                </p>
                <button onClick={handleRefresh} className="px-4 py-2 rounded-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-mono text-zinc-300 hover:text-zinc-100 transition-colors">
                  Try again
                </button>
              </div>
            </motion.div>
          ) : showBoard ? (
            /* --- Board: Column Mode vs Treemap Mode --- */
            viewMode === 'treemap' ? (
              <motion.div key="treemap" initial={{ opacity: 1 }} animate={{ opacity: 1 }}
                className="flex-1 relative overflow-hidden">
                <TreemapView
                  issues={issues}
                  trendingRepos={trendingRepos}
                  topics={topicData}
                  onSelectRepo={setRepoStr}
                />
              </motion.div>
            ) : (
              <motion.div key="columns" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex-1 overflow-hidden">
                <PanelGroup direction="horizontal" className="h-full">
                  {/* Issues Panel */}
                  <Panel defaultSize={50} minSize={25}>
                    <div className="h-full overflow-hidden p-4 flex flex-col">
                      <Board
                        repoKey={repoStr}
                        issues={issues}
                        owner={owner}
                        repo={repo}
                        mode={mode}
                        token={token}
                        totalFromGitHub={totalFromGitHub}
                        onLoadMore={handleLoadMore}
                        isLoadingMore={isLoadingMore}
                      />
                    </div>
                  </Panel>

                  <ResizeHandle />

                  {/* Topics Panel */}
                  <Panel defaultSize={22} minSize={12} collapsible>
                    <div className="h-full overflow-hidden border-zinc-900 flex flex-col">
                      <TopicCloudPanel />
                    </div>
                  </Panel>

                  <ResizeHandle />

                  {/* Trending Panel */}
                  <Panel defaultSize={28} minSize={15} collapsible>
                    <div className="h-full overflow-hidden p-4 flex flex-col">
                      <TrendingPanel onSelectRepo={setRepoStr} />
                    </div>
                  </Panel>
                </PanelGroup>
              </motion.div>
            )
          ) : null}
        </AnimatePresence>
      </main>

      {showAuthModal && (
        <GitHubAuthModal
          onClose={() => setShowAuthModal(false)}
          onLogin={login}
          isValidating={isValidating}
          error={authError}
        />
      )}
    </div>
  );
}
