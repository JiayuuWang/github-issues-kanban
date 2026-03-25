import React from 'react';
import { Github, RefreshCw, AlertCircle, GitBranch } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

import { useGetIssues, getGetIssuesQueryKey } from '@workspace/api-client-react';
import { useRepoPersistence } from '@/hooks/use-repo-persistence';
import { RepoForm } from '@/components/RepoForm';
import { RateLimitBadge } from '@/components/RateLimitBadge';
import { Board } from '@/components/kanban/Board';

export function BoardPage() {
  const queryClient = useQueryClient();
  const { repoStr, setRepoStr, owner, repo, isValid } = useRepoPersistence();

  const { data, isLoading, isError, error, isFetching } = useGetIssues(
    { owner, repo, state: 'all', per_page: 100 },
    {
      query: {
        enabled: isValid,
        retry: false,
      },
    }
  );

  const handleRefresh = () => {
    if (isValid) {
      queryClient.invalidateQueries({
        queryKey: getGetIssuesQueryKey({ owner, repo, state: 'all', per_page: 100 }),
      });
    }
  };

  const isRateLimitError =
    error && typeof error === 'object' && 'status' in error && (error as any).status === 429;
  const isNotFoundError =
    error && typeof error === 'object' && 'status' in error && (error as any).status === 404;

  return (
    <div className="min-h-screen w-full flex flex-col bg-[#111] text-zinc-200">
      {/* Top Bar */}
      <header className="shrink-0 w-full border-b border-zinc-900 px-5 h-12 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <GitBranch className="w-4 h-4 text-zinc-400" />
          <span className="text-sm font-mono font-medium text-zinc-200 tracking-tight">kanban</span>
          <span className="text-zinc-700 text-sm">/</span>
          <span className="text-xs font-mono text-zinc-500">github-issues</span>
        </div>

        {/* Repo Input */}
        <div className="flex-1 flex justify-center max-w-xl">
          <RepoForm
            currentRepo={repoStr}
            onSetRepo={setRepoStr}
            isLoading={isLoading || isFetching}
          />
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3 shrink-0">
          <RateLimitBadge />
          <button
            onClick={handleRefresh}
            disabled={!isValid || isLoading || isFetching}
            className="w-7 h-7 flex items-center justify-center rounded-sm border border-zinc-800 hover:border-zinc-600 bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="Refresh issues"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 w-full overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">
          {!isValid ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center text-center px-6 py-20"
            >
              <Github className="w-8 h-8 text-zinc-700 mb-4" />
              <h2 className="text-sm font-mono font-medium text-zinc-400 mb-2">
                Connect a repository
              </h2>
              <p className="text-xs font-mono text-zinc-600 max-w-xs">
                Enter a GitHub repository in the format{' '}
                <span className="text-zinc-400">owner/repo</span> above to load its issues.
              </p>
            </motion.div>
          ) : isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 p-5 flex gap-4"
            >
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex-1 min-w-[280px] max-w-[340px]">
                  <div className="h-8 w-24 rounded-sm bg-zinc-900 animate-pulse mb-3" />
                  <div className="h-px bg-zinc-800 mb-3" />
                  <div className="space-y-2">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="h-[100px] rounded-sm bg-zinc-900 animate-pulse" />
                    ))}
                  </div>
                </div>
              ))}
            </motion.div>
          ) : isError ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 flex items-center justify-center p-6"
            >
              <div className="bg-zinc-900 border border-zinc-800 rounded-sm p-8 max-w-md text-center">
                <AlertCircle className="w-8 h-8 text-red-500/70 mx-auto mb-4" />
                <h3 className="text-sm font-mono font-medium text-zinc-300 mb-2">
                  Failed to load issues
                </h3>
                <p className="text-xs font-mono text-zinc-500 mb-5">
                  {isRateLimitError
                    ? 'GitHub API rate limit exceeded. Please wait for it to reset.'
                    : isNotFoundError
                    ? `Repository "${owner}/${repo}" not found or not accessible.`
                    : 'An unexpected error occurred while fetching issues.'}
                </p>
                <button
                  onClick={handleRefresh}
                  className="px-4 py-2 rounded-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-mono text-zinc-300 hover:text-zinc-100 transition-colors"
                >
                  Try again
                </button>
              </div>
            </motion.div>
          ) : data ? (
            <motion.div
              key="board"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 overflow-hidden p-5"
            >
              <Board
                repoKey={repoStr}
                issues={data.issues || []}
                owner={owner}
                repo={repo}
              />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </main>
    </div>
  );
}
