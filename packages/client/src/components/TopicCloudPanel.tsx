import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Cloud, RefreshCw, ExternalLink, Maximize2, Minimize2, ChevronDown, ChevronUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
const COLLAPSED_KEY = 'kanban_topiccloud_collapsed';

// Color palette matching the dark theme
const CLOUD_COLORS = [
  '#f97316', // orange-500
  '#fb923c', // orange-400
  '#22d3ee', // cyan-400
  '#a78bfa', // violet-400
  '#34d399', // emerald-400
  '#f472b6', // pink-400
  '#fbbf24', // amber-400
  '#60a5fa', // blue-400
  '#818cf8', // indigo-400
  '#2dd4bf', // teal-400
];

function getColorForIndex(i: number): string {
  return CLOUD_COLORS[i % CLOUD_COLORS.length];
}

interface TopicCloudPanelProps {
  className?: string;
}

export function TopicCloudPanel({ className = '' }: TopicCloudPanelProps) {
  const [data, setData] = useState<TopicCloudData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === 'true'; } catch { return false; }
  });
  const [hoveredTopic, setHoveredTopic] = useState<Topic | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem(COLLAPSED_KEY, String(next)); } catch {}
  };

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
    if (!collapsed) fetchTopics();
  }, [collapsed, fetchTopics]);

  // Compute font sizes based on weight
  const topicsWithSize = useMemo(() => {
    if (!data?.topics.length) return [];
    const maxWeight = Math.max(...data.topics.map((t) => t.weight));
    const minWeight = Math.min(...data.topics.map((t) => t.weight));
    const range = maxWeight - minWeight || 1;

    return data.topics.map((t, i) => {
      const norm = (t.weight - minWeight) / range;
      // Font size from 11px to 28px in zoomed, 10px to 22px normal
      const minFont = zoomed ? 12 : 10;
      const maxFont = zoomed ? 30 : 22;
      const fontSize = minFont + norm * (maxFont - minFont);
      const opacity = 0.5 + norm * 0.5;
      return { ...t, fontSize, opacity, color: getColorForIndex(i) };
    });
  }, [data, zoomed]);

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <button
          onClick={toggleCollapsed}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity"
        >
          <Cloud className="w-3.5 h-3.5 text-cyan-500/70" />
          <span className="text-xs font-medium text-zinc-400 tracking-wider uppercase">Topics</span>
          <span className="text-[10px] font-mono text-zinc-700">HN</span>
          {collapsed ? (
            <ChevronDown className="w-3 h-3 text-zinc-600" />
          ) : (
            <ChevronUp className="w-3 h-3 text-zinc-600" />
          )}
        </button>
        {!collapsed && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setZoomed((z) => !z)}
              className="w-5 h-5 flex items-center justify-center text-zinc-700 hover:text-zinc-400 transition-colors"
              title={zoomed ? 'Shrink' : 'Expand'}
            >
              {zoomed ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </button>
            <button
              onClick={fetchTopics}
              disabled={isLoading}
              className="w-5 h-5 flex items-center justify-center text-zinc-700 hover:text-zinc-400 transition-colors disabled:opacity-30"
              title="Refresh"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {/* Accent line */}
      {!collapsed && <div className="h-px w-full mb-3 bg-cyan-700 opacity-30" />}

      {/* Content */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className={`relative transition-all duration-300 ${
              zoomed ? 'min-h-[280px] max-h-[400px]' : 'min-h-[140px] max-h-[220px]'
            } overflow-hidden`}>
              {isLoading ? (
                <div className="flex items-center justify-center h-[140px]">
                  <div className="w-5 h-5 border border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-[140px]">
                  <p className="text-xs text-zinc-700 font-mono">{error}</p>
                </div>
              ) : topicsWithSize.length === 0 ? (
                <div className="flex items-center justify-center h-[140px]">
                  <p className="text-xs text-zinc-700 font-mono">no topics</p>
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1.5 px-3 py-2">
                  {topicsWithSize.map((topic) => (
                    <span
                      key={topic.word}
                      className="inline-block cursor-default transition-all duration-150 hover:scale-110 hover:drop-shadow-[0_0_6px_rgba(255,255,255,0.15)] relative"
                      style={{
                        fontSize: topic.fontSize,
                        color: topic.color,
                        opacity: hoveredTopic && hoveredTopic.word !== topic.word ? 0.25 : topic.opacity,
                        fontFamily: 'monospace',
                        fontWeight: topic.fontSize > 18 ? 600 : 400,
                        lineHeight: 1.4,
                      }}
                      onMouseEnter={() => setHoveredTopic(topic)}
                      onMouseLeave={() => setHoveredTopic(null)}
                    >
                      {topic.word}
                    </span>
                  ))}
                </div>
              )}

              {/* Tooltip for hovered topic */}
              <AnimatePresence>
                {hoveredTopic && (
                  <motion.div
                    ref={tooltipRef}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.12 }}
                    className="absolute bottom-0 left-0 right-0 bg-zinc-950/95 border-t border-zinc-800 px-3 py-2 backdrop-blur-sm"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] font-mono font-medium text-zinc-200">
                        {hoveredTopic.word}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-600">
                        {hoveredTopic.count} stories
                      </span>
                    </div>
                    {hoveredTopic.sample_titles.map((t, i) => (
                      <p key={i} className="text-[10px] text-zinc-500 leading-relaxed truncate">
                        {t}
                      </p>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            {data && (
              <div className="flex items-center justify-between px-3 py-1.5 border-t border-zinc-800/40">
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
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
