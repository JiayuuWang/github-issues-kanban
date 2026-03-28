import React, { useState, useEffect, useCallback } from 'react';
import { Cloud, RefreshCw, ExternalLink, MessageSquare, TrendingUp, Search } from 'lucide-react';

interface Topic {
  word: string;
  count: number;
  weight: number;
  sample_titles: string[];
}

interface TopicCloudData {
  topics: Topic[];
  total_stories: number;
  generated_at: string;
}

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

interface TopicCloudPanelProps {
  className?: string;
}

export function TopicCloudPanel({ className = '' }: TopicCloudPanelProps) {
  const [data, setData] = useState<TopicCloudData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTopics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/api/hn/topic-cloud`);
      if (!res.ok) throw new Error('Failed');
      const d = await res.json();
      setData(d);
    } catch {
      setError('Failed to load topics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTopics();
  }, [fetchTopics]);

  return (
    <div className={`flex flex-col h-full w-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 mb-2">
        <div className="flex items-center gap-2">
          <Cloud className="w-3.5 h-3.5 text-cyan-500/70" />
          <span className="text-xs font-medium text-zinc-400 tracking-wider uppercase">Topics</span>
          <span className="text-[10px] font-mono text-zinc-700">HN</span>
        </div>
        <button
          onClick={fetchTopics}
          disabled={isLoading}
          className="w-5 h-5 flex items-center justify-center text-zinc-700 hover:text-zinc-400 transition-colors disabled:opacity-30"
          title="Refresh"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Accent line */}
      <div className="h-px w-full mb-3 bg-cyan-700 opacity-30" />

      {/* Content */}
      <div className="flex-1 flex flex-col gap-2 overflow-y-auto overflow-x-hidden px-0.5 py-1">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[72px] rounded-sm bg-zinc-900 animate-pulse" />
          ))
        ) : error ? (
          <div className="flex-1 flex items-center justify-center border border-dashed border-zinc-800 rounded-sm min-h-[200px]">
            <p className="text-xs text-zinc-700 font-mono">{error}</p>
          </div>
        ) : !data || data.topics.length === 0 ? (
          <div className="flex-1 flex items-center justify-center border border-dashed border-zinc-800 rounded-sm min-h-[200px]">
            <p className="text-xs text-zinc-700 font-mono">no topics</p>
          </div>
        ) : (
          <>
            {data.topics.map((topic, i) => (
              <TopicCard key={topic.word} topic={topic} rank={i + 1} />
            ))}
            <div className="flex items-center justify-between px-2 py-1.5 mt-1">
              <span className="text-[9px] font-mono text-zinc-700">
                {data.total_stories} stories analyzed
              </span>
              <a
                href="https://news.ycombinator.com"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[9px] font-mono text-zinc-700 hover:text-zinc-400 transition-colors"
              >
                <ExternalLink className="w-2.5 h-2.5" />
                Hacker News
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function TopicCard({ topic, rank }: { topic: Topic; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const hnSearchUrl = `https://hn.algolia.com/?q=${encodeURIComponent(topic.word)}`;

  return (
    <div
      className="group flex flex-col rounded-sm bg-zinc-900 border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800/80 transition-colors duration-150"
    >
      {/* Main row */}
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
      >
        {/* Rank number */}
        <span className="text-[10px] font-mono text-zinc-600 w-4 text-right shrink-0 tabular-nums">
          {rank}
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono font-medium text-zinc-200 group-hover:text-white transition-colors">
              {topic.word}
            </span>
            <a
              href={hnSearchUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-zinc-300"
              title="Search on HN"
            >
              <Search className="w-3 h-3" />
            </a>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="flex items-center gap-1 text-[10px] font-mono text-zinc-600">
              <TrendingUp className="w-2.5 h-2.5" />
              {topic.weight}
            </span>
            <span className="flex items-center gap-1 text-[10px] font-mono text-zinc-700">
              <MessageSquare className="w-2.5 h-2.5" />
              {topic.count} stories
            </span>
          </div>
        </div>
      </div>

      {/* Expanded: sample titles with links */}
      {expanded && topic.sample_titles.length > 0 && (
        <div className="px-3 pb-2.5 border-t border-zinc-800/60 ml-6">
          {topic.sample_titles.map((title, i) => (
            <a
              key={i}
              href={`https://hn.algolia.com/?q=${encodeURIComponent(title.slice(0, 60))}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-start gap-1.5 text-[10px] text-zinc-500 hover:text-zinc-300 leading-relaxed mt-1.5 transition-colors"
            >
              <ExternalLink className="w-2.5 h-2.5 shrink-0 mt-0.5 text-zinc-700" />
              <span className="truncate">{title}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
