import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ExternalLink, ArrowLeft } from 'lucide-react';
import { type GitHubIssue } from '@workspace/api-client-react';

// --- Squarified Treemap Layout ---

interface TreemapRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface TreemapItem {
  id: string;
  label: string;
  subLabel?: string;
  value: number;
  color: string;
  hoverColor: string;
  url?: string;
  category: 'issue' | 'topic' | 'trending';
  data?: any;
}

interface TreemapNode extends TreemapItem, TreemapRect {}

function squarify(items: TreemapItem[], rect: TreemapRect): TreemapNode[] {
  if (items.length === 0) return [];
  const totalValue = items.reduce((s, i) => s + i.value, 0);
  if (totalValue === 0) return [];

  const sorted = [...items].sort((a, b) => b.value - a.value);
  const nodes: TreemapNode[] = [];

  let remaining = [...sorted];
  let currentRect = { ...rect };

  while (remaining.length > 0) {
    const isWide = currentRect.w >= currentRect.h;
    const totalRemaining = remaining.reduce((s, i) => s + i.value, 0);
    const side = isWide ? currentRect.h : currentRect.w;

    if (side <= 0) break;

    // Find the best row
    let row: TreemapItem[] = [];
    let bestWorst = Infinity;

    for (let i = 1; i <= remaining.length; i++) {
      const candidate = remaining.slice(0, i);
      const rowSum = candidate.reduce((s, it) => s + it.value, 0);
      const rowWidth = (rowSum / totalRemaining) * (isWide ? currentRect.w : currentRect.h);
      if (rowWidth <= 0) continue;

      let worst = 0;
      for (const it of candidate) {
        const itemHeight = (it.value / rowSum) * side;
        const aspect = Math.max(rowWidth / itemHeight, itemHeight / rowWidth);
        worst = Math.max(worst, aspect);
      }

      if (worst <= bestWorst) {
        bestWorst = worst;
        row = candidate;
      } else {
        break;
      }
    }

    if (row.length === 0) {
      row = [remaining[0]];
    }

    // Layout the row
    const rowSum = row.reduce((s, it) => s + it.value, 0);
    const rowWidth = (rowSum / totalRemaining) * (isWide ? currentRect.w : currentRect.h);

    let offset = 0;
    for (const item of row) {
      const itemSize = (item.value / rowSum) * side;
      const node: TreemapNode = {
        ...item,
        x: isWide ? currentRect.x : currentRect.x + offset,
        y: isWide ? currentRect.y + offset : currentRect.y,
        w: isWide ? rowWidth : itemSize,
        h: isWide ? itemSize : rowWidth,
      };
      nodes.push(node);
      offset += itemSize;
    }

    // Shrink remaining rect
    if (isWide) {
      currentRect = {
        x: currentRect.x + rowWidth,
        y: currentRect.y,
        w: currentRect.w - rowWidth,
        h: currentRect.h,
      };
    } else {
      currentRect = {
        x: currentRect.x,
        y: currentRect.y + rowWidth,
        w: currentRect.w,
        h: currentRect.h - rowWidth,
      };
    }

    remaining = remaining.slice(row.length);
  }

  return nodes;
}

// --- Color helpers ---

const ISSUE_COLORS: Record<string, { bg: string; hover: string }> = {
  open: { bg: '#065f46', hover: '#047857' },     // emerald-800 / 700
  closed: { bg: '#3f3f46', hover: '#52525b' },    // zinc-700 / 600
  'in-progress': { bg: '#1e3a5f', hover: '#1d4ed8' },
};

const TRENDING_COLORS = [
  { bg: '#7c2d12', hover: '#9a3412' }, // orange
  { bg: '#713f12', hover: '#854d0e' }, // amber
  { bg: '#365314', hover: '#3f6212' }, // lime
  { bg: '#134e4a', hover: '#115e59' }, // teal
  { bg: '#1e3a5f', hover: '#1e40af' }, // blue
  { bg: '#4c1d95', hover: '#5b21b6' }, // violet
];

const TOPIC_COLORS = [
  { bg: '#164e63', hover: '#155e75' }, // cyan
  { bg: '#581c87', hover: '#6b21a8' }, // purple
  { bg: '#831843', hover: '#9d174d' }, // pink
  { bg: '#78350f', hover: '#92400e' }, // amber
  { bg: '#14532d', hover: '#166534' }, // green
];

// --- Main Component ---

interface TreemapViewProps {
  issues: GitHubIssue[];
  trendingRepos: any[];
  topics: any[];
  onSelectRepo?: (name: string) => void;
}

export function TreemapView({ issues, trendingRepos, topics, onSelectRepo }: TreemapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 500 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [drillCategory, setDrillCategory] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setDims({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Build treemap items from the 3 data categories
  const allItems = useMemo((): TreemapItem[] => {
    const items: TreemapItem[] = [];

    // Category 1: Issues — group by state
    const openIssues = issues.filter(i => i.state === 'open' && !i.pull_request);
    const closedIssues = issues.filter(i => i.state === 'closed' && !i.pull_request);

    if (!drillCategory || drillCategory === 'issues') {
      if (drillCategory === 'issues') {
        // Drilled: show individual issues
        for (const issue of issues.filter(i => !i.pull_request)) {
          const col = ISSUE_COLORS[issue.state] || ISSUE_COLORS.open;
          items.push({
            id: `issue-${issue.id}`,
            label: `#${issue.number}`,
            subLabel: issue.title.slice(0, 50),
            value: Math.max(1, issue.comments + 1),
            color: col.bg,
            hoverColor: col.hover,
            url: issue.html_url,
            category: 'issue',
            data: issue,
          });
        }
      } else {
        // Overview: group
        if (openIssues.length > 0) {
          items.push({
            id: 'group-issues-open',
            label: `Open Issues`,
            subLabel: `${openIssues.length} issues`,
            value: Math.max(openIssues.length * 3, 10),
            color: ISSUE_COLORS.open.bg,
            hoverColor: ISSUE_COLORS.open.hover,
            category: 'issue',
          });
        }
        if (closedIssues.length > 0) {
          items.push({
            id: 'group-issues-closed',
            label: `Closed Issues`,
            subLabel: `${closedIssues.length} issues`,
            value: Math.max(closedIssues.length * 2, 8),
            color: ISSUE_COLORS.closed.bg,
            hoverColor: ISSUE_COLORS.closed.hover,
            category: 'issue',
          });
        }
      }
    }

    // Category 2: Topics
    if (!drillCategory || drillCategory === 'topics') {
      const topicItems = topics.slice(0, drillCategory === 'topics' ? 40 : 12);
      topicItems.forEach((t: any, i: number) => {
        const col = TOPIC_COLORS[i % TOPIC_COLORS.length];
        items.push({
          id: `topic-${t.word}`,
          label: t.word,
          subLabel: `${t.count} stories`,
          value: t.weight || t.count,
          color: col.bg,
          hoverColor: col.hover,
          category: 'topic',
          data: t,
        });
      });
    }

    // Category 3: Trending
    if (!drillCategory || drillCategory === 'trending') {
      const trendItems = trendingRepos.slice(0, drillCategory === 'trending' ? 25 : 8);
      trendItems.forEach((r: any, i: number) => {
        const col = TRENDING_COLORS[i % TRENDING_COLORS.length];
        items.push({
          id: `trending-${r.full_name || r.name}`,
          label: r.name,
          subLabel: r.full_name,
          value: Math.max(r.stargazers_count || 1, 1),
          color: col.bg,
          hoverColor: col.hover,
          url: r.html_url,
          category: 'trending',
          data: r,
        });
      });
    }

    return items;
  }, [issues, topics, trendingRepos, drillCategory]);

  const nodes = useMemo(() => {
    if (dims.w < 10 || dims.h < 10) return [];
    return squarify(allItems, { x: 0, y: 0, w: dims.w, h: dims.h });
  }, [allItems, dims]);

  const handleClick = useCallback((node: TreemapNode) => {
    if (node.url) {
      window.open(node.url, '_blank');
      return;
    }
    if (node.id.startsWith('group-issues')) {
      setDrillCategory('issues');
    } else if (node.category === 'trending' && node.data?.full_name && onSelectRepo) {
      onSelectRepo(node.data.full_name);
    }
  }, [onSelectRepo]);

  const handleCategoryDrill = useCallback((cat: string) => {
    setDrillCategory(prev => prev === cat ? null : cat);
  }, []);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Category filter chips */}
      <div className="flex items-center gap-2 px-3 py-2 shrink-0">
        {drillCategory && (
          <button
            onClick={() => setDrillCategory(null)}
            className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            overview
          </button>
        )}
        {['issues', 'topics', 'trending'].map(cat => (
          <button
            key={cat}
            onClick={() => handleCategoryDrill(cat)}
            className={`text-[10px] font-mono px-2 py-1 rounded-sm border transition-colors ${
              drillCategory === cat
                ? 'bg-zinc-800 text-zinc-200 border-zinc-600'
                : 'text-zinc-600 border-zinc-800 hover:border-zinc-600 hover:text-zinc-400'
            }`}
          >
            {cat}
          </button>
        ))}
        <span className="text-[10px] font-mono text-zinc-700 ml-auto">
          {allItems.length} blocks
        </span>
      </div>

      {/* Treemap */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden mx-1 mb-1 rounded-sm">
        {nodes.map(node => {
          const isHovered = hoveredId === node.id;
          const minW = node.w;
          const minH = node.h;
          const showSub = minW > 70 && minH > 36;
          const showLabel = minW > 30 && minH > 20;

          return (
            <div
              key={node.id}
              className="absolute cursor-pointer transition-colors duration-100"
              style={{
                left: node.x,
                top: node.y,
                width: node.w,
                height: node.h,
                backgroundColor: isHovered ? node.hoverColor : node.color,
                border: '1px solid rgba(0,0,0,0.4)',
                borderRadius: 2,
              }}
              onMouseEnter={() => setHoveredId(node.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => handleClick(node)}
            >
              {showLabel && (
                <div className="absolute inset-0 p-1.5 overflow-hidden flex flex-col justify-center">
                  <p
                    className="font-mono font-semibold text-white/90 truncate leading-tight"
                    style={{ fontSize: Math.max(9, Math.min(14, minW / 10)) }}
                  >
                    {node.label}
                  </p>
                  {showSub && node.subLabel && (
                    <p
                      className="font-mono text-white/50 truncate leading-tight mt-0.5"
                      style={{ fontSize: Math.max(8, Math.min(11, minW / 14)) }}
                    >
                      {node.subLabel}
                    </p>
                  )}
                </div>
              )}
              {isHovered && node.url && (
                <ExternalLink
                  className="absolute top-1 right-1 w-3 h-3 text-white/60"
                />
              )}
            </div>
          );
        })}

        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-xs text-zinc-700 font-mono">no data to display</p>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-3 py-1.5 shrink-0 border-t border-zinc-800/40">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: ISSUE_COLORS.open.bg }} />
          <span className="text-[9px] font-mono text-zinc-600">open</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: ISSUE_COLORS.closed.bg }} />
          <span className="text-[9px] font-mono text-zinc-600">closed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: TOPIC_COLORS[0].bg }} />
          <span className="text-[9px] font-mono text-zinc-600">topics</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: TRENDING_COLORS[0].bg }} />
          <span className="text-[9px] font-mono text-zinc-600">trending</span>
        </div>
        <span className="text-[9px] font-mono text-zinc-700 ml-auto">click to drill / open</span>
      </div>
    </div>
  );
}
