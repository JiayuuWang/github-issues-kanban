import React, { useState, useEffect, useCallback } from 'react';
import { Star, GitFork, TrendingUp, ExternalLink, RefreshCw, Flame } from 'lucide-react';

interface TrendingRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  html_url: string;
  owner: { login: string; avatar_url: string };
  topics: string[];
}

type Period = 'daily' | 'weekly' | 'monthly';

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

const LANG_COLORS: Record<string, string> = {
  TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572A5',
  Rust: '#dea584', Go: '#00ADD8', Java: '#b07219', 'C++': '#f34b7d',
  C: '#555555', Ruby: '#701516', Swift: '#F05138', Kotlin: '#A97BFF',
  Dart: '#00B4AB', 'C#': '#178600', PHP: '#4F5D95', Zig: '#ec915c',
  Shell: '#89e051', Nix: '#7e7eff', Vue: '#41b883', Svelte: '#ff3e00',
};

function formatNumber(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

interface TrendingPanelProps {
  onSelectRepo?: (fullName: string) => void;
  token?: string | null;
}

export function TrendingPanel({ onSelectRepo, token }: TrendingPanelProps) {
  const [period, setPeriod] = useState<Period>('weekly');
  const [repos, setRepos] = useState<TrendingRepo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrending = useCallback(async (p: Period) => {
    setIsLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['X-GitHub-Token'] = token;
      const res = await fetch(`${BASE_URL}/api/github/trending?period=${p}`, { headers });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      setRepos(data);
    } catch {
      setError('Failed to load trending repos');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchTrending(period);
  }, [period, fetchTrending]);

  const handlePeriod = (p: Period) => {
    if (p === period) return;
    setPeriod(p);
  };

  return (
    <div className="flex flex-col h-full min-w-[280px] max-w-[340px] w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 mb-2">
        <div className="flex items-center gap-2">
          <Flame className="w-3.5 h-3.5 text-orange-500/70" />
          <span className="text-xs font-medium text-zinc-400 tracking-wider uppercase">Trending</span>
        </div>
        <button
          onClick={() => fetchTrending(period)}
          disabled={isLoading}
          className="w-5 h-5 flex items-center justify-center text-zinc-700 hover:text-zinc-400 transition-colors disabled:opacity-30"
          title="Refresh"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Period tabs */}
      <div className="flex items-center gap-0 mb-3 border border-zinc-800 rounded-sm overflow-hidden mx-0.5">
        {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => handlePeriod(p)}
            className={`flex-1 py-1.5 text-[10px] font-mono transition-colors ${
              period === p
                ? 'bg-zinc-800 text-zinc-200'
                : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900/50'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Accent line (orange for trending) */}
      <div className="h-px w-full mb-3 bg-orange-700 opacity-30" />

      {/* Content */}
      <div className="flex-1 flex flex-col gap-2 overflow-y-auto overflow-x-hidden px-0.5 py-1">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[88px] rounded-sm bg-zinc-900 animate-pulse" />
          ))
        ) : error ? (
          <div className="flex-1 flex items-center justify-center border border-dashed border-zinc-800 rounded-sm min-h-[200px]">
            <p className="text-xs text-zinc-700 font-mono">{error}</p>
          </div>
        ) : repos.length === 0 ? (
          <div className="flex-1 flex items-center justify-center border border-dashed border-zinc-800 rounded-sm min-h-[200px]">
            <p className="text-xs text-zinc-700 font-mono">no repos found</p>
          </div>
        ) : (
          repos.map((repo) => (
            <TrendingRepoCard
              key={repo.id}
              repo={repo}
              onSelect={onSelectRepo}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TrendingRepoCard({ repo, onSelect }: { repo: TrendingRepo; onSelect?: (f: string) => void }) {
  const langColor = repo.language ? (LANG_COLORS[repo.language] || '#71717a') : null;

  return (
    <div
      className={`
        group flex flex-col gap-2 rounded-sm
        bg-zinc-900 border border-zinc-800
        hover:border-zinc-600 hover:bg-zinc-800/80
        transition-colors duration-150 p-3
        ${onSelect ? 'cursor-pointer' : ''}
      `}
      onClick={() => onSelect?.(repo.full_name)}
    >
      {/* Repo name row */}
      <div className="flex items-start gap-2">
        <img
          src={repo.owner.avatar_url}
          alt={repo.owner.login}
          className="w-5 h-5 rounded-full shrink-0 mt-0.5 grayscale group-hover:grayscale-0 transition-all"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-mono text-zinc-400">{repo.owner.login}/</span>
            <span className="text-[11px] font-mono font-medium text-zinc-200 group-hover:text-white transition-colors truncate">
              {repo.name}
            </span>
          </div>
        </div>
        <a
          href={repo.html_url}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-zinc-300 shrink-0"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Description */}
      {repo.description && (
        <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">
          {repo.description}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center gap-3 mt-0.5">
        {langColor && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-zinc-500">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: langColor }} />
            {repo.language}
          </span>
        )}
        <span className="flex items-center gap-1 text-[10px] font-mono text-zinc-600">
          <Star className="w-2.5 h-2.5" />
          {formatNumber(repo.stargazers_count)}
        </span>
        <span className="flex items-center gap-1 text-[10px] font-mono text-zinc-700">
          <GitFork className="w-2.5 h-2.5" />
          {formatNumber(repo.forks_count)}
        </span>
      </div>

      {/* Topics */}
      {repo.topics.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {repo.topics.map((t) => (
            <span key={t} className="text-[9px] font-mono px-1.5 py-0.5 rounded-sm bg-zinc-800 text-zinc-600 border border-zinc-700/50">
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
