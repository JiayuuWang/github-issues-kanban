import React, { useState, useEffect, useCallback } from 'react';
import { Star, GitFork, ExternalLink, RefreshCw, Flame, TrendingUp, Users, BookOpen } from 'lucide-react';

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
  stars_today?: number;
  stars_period?: string;
}

interface TrendingDeveloper {
  id: number;
  username: string;
  name: string;
  avatar_url: string;
  html_url: string;
  popular_repo: {
    name: string;
    description: string | null;
    html_url: string;
  } | null;
}

type Period = 'daily' | 'weekly' | 'monthly';
type Tab = 'repos' | 'developers';

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
}

export function TrendingPanel({ onSelectRepo }: TrendingPanelProps) {
  const [period, setPeriod] = useState<Period>('daily');
  const [tab, setTab] = useState<Tab>('repos');
  const [repos, setRepos] = useState<TrendingRepo[]>([]);
  const [developers, setDevelopers] = useState<TrendingDeveloper[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrending = useCallback(async (p: Period, t: Tab) => {
    setIsLoading(true);
    setError(null);
    try {
      if (t === 'repos') {
        const res = await fetch(`${BASE_URL}/api/github/trending?since=${p}`);
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        setRepos(data);
      } else {
        const res = await fetch(`${BASE_URL}/api/github/trending-developers?since=${p}`);
        if (!res.ok) throw new Error('Failed');
        const data = await res.json();
        setDevelopers(data);
      }
    } catch {
      setError(t === 'repos' ? 'Failed to load trending repos' : 'Failed to load trending developers');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrending(period, tab);
  }, [period, tab, fetchTrending]);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 mb-2">
        <div className="flex items-center gap-2">
          <Flame className="w-3.5 h-3.5 text-orange-500/70" />
          <span className="text-xs font-medium text-zinc-400 tracking-wider uppercase">Trending</span>
        </div>
        <button
          onClick={() => fetchTrending(period, tab)}
          disabled={isLoading}
          className="w-5 h-5 flex items-center justify-center text-zinc-700 hover:text-zinc-400 transition-colors disabled:opacity-30"
          title="Refresh"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Tab: Repos / Developers */}
      <div className="flex items-center gap-0 mb-2 border border-zinc-800 rounded-sm overflow-hidden mx-0.5">
        <button
          onClick={() => setTab('repos')}
          className={`flex-1 py-1.5 text-[10px] font-mono flex items-center justify-center gap-1 transition-colors ${
            tab === 'repos' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900/50'
          }`}
        >
          <TrendingUp className="w-3 h-3" />
          Repos
        </button>
        <button
          onClick={() => setTab('developers')}
          className={`flex-1 py-1.5 text-[10px] font-mono flex items-center justify-center gap-1 transition-colors ${
            tab === 'developers' ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900/50'
          }`}
        >
          <Users className="w-3 h-3" />
          Developers
        </button>
      </div>

      {/* Period tabs */}
      <div className="flex items-center gap-0 mb-3 border border-zinc-800 rounded-sm overflow-hidden mx-0.5">
        {(['daily', 'weekly', 'monthly'] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
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

      {/* Accent line */}
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
        ) : tab === 'repos' ? (
          repos.length === 0 ? (
            <div className="flex-1 flex items-center justify-center border border-dashed border-zinc-800 rounded-sm min-h-[200px]">
              <p className="text-xs text-zinc-700 font-mono">no repos found</p>
            </div>
          ) : (
            repos.map((repo) => (
              <TrendingRepoCard key={repo.id} repo={repo} onSelect={onSelectRepo} />
            ))
          )
        ) : (
          developers.length === 0 ? (
            <div className="flex-1 flex items-center justify-center border border-dashed border-zinc-800 rounded-sm min-h-[200px]">
              <p className="text-xs text-zinc-700 font-mono">no developers found</p>
            </div>
          ) : (
            developers.map((dev) => (
              <TrendingDeveloperCard key={dev.id} developer={dev} />
            ))
          )
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
        {repo.stars_today !== undefined && repo.stars_today > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-orange-600/80 ml-auto">
            <Star className="w-2.5 h-2.5 fill-current" />
            {formatNumber(repo.stars_today)} {repo.stars_period || 'today'}
          </span>
        )}
      </div>
    </div>
  );
}

function TrendingDeveloperCard({ developer }: { developer: TrendingDeveloper }) {
  return (
    <div className="group flex flex-col gap-2 rounded-sm bg-zinc-900 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/80 transition-colors duration-150 p-3">
      {/* Developer info */}
      <div className="flex items-center gap-2.5">
        <img
          src={developer.avatar_url}
          alt={developer.username}
          className="w-8 h-8 rounded-full shrink-0 grayscale group-hover:grayscale-0 transition-all"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono font-medium text-zinc-200 group-hover:text-white transition-colors truncate">
              {developer.name}
            </span>
            <a
              href={developer.html_url}
              target="_blank"
              rel="noreferrer"
              className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-zinc-300 shrink-0"
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">@{developer.username}</span>
        </div>
      </div>

      {/* Popular repo */}
      {developer.popular_repo && (
        <a
          href={developer.popular_repo.html_url}
          target="_blank"
          rel="noreferrer"
          className="flex items-start gap-1.5 mt-1 p-2 rounded-sm bg-zinc-950/60 border border-zinc-800/60 hover:border-zinc-700 transition-colors"
        >
          <BookOpen className="w-3 h-3 text-zinc-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-mono text-zinc-400 group-hover:text-zinc-300">
              {developer.popular_repo.name}
            </span>
            {developer.popular_repo.description && (
              <p className="text-[10px] text-zinc-600 line-clamp-1 mt-0.5">
                {developer.popular_repo.description}
              </p>
            )}
          </div>
        </a>
      )}
    </div>
  );
}
