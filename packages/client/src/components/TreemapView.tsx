import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ExternalLink, ArrowLeft, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
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

    if (side <= 0 || currentRect.w <= 0 || currentRect.h <= 0) break;

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
        if (itemHeight <= 0) continue;
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

    const rowSum = row.reduce((s, it) => s + it.value, 0);
    const rowWidth = (rowSum / totalRemaining) * (isWide ? currentRect.w : currentRect.h);

    let offset = 0;
    for (const item of row) {
      const itemSize = (item.value / rowSum) * side;
      nodes.push({
        ...item,
        x: isWide ? currentRect.x : currentRect.x + offset,
        y: isWide ? currentRect.y + offset : currentRect.y,
        w: isWide ? rowWidth : itemSize,
        h: isWide ? itemSize : rowWidth,
      });
      offset += itemSize;
    }

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
  open: { bg: '#065f46', hover: '#047857' },
  closed: { bg: '#3f3f46', hover: '#52525b' },
  'in-progress': { bg: '#1e3a5f', hover: '#1d4ed8' },
};

const TRENDING_COLORS = [
  { bg: '#7c2d12', hover: '#9a3412' },
  { bg: '#713f12', hover: '#854d0e' },
  { bg: '#365314', hover: '#3f6212' },
  { bg: '#134e4a', hover: '#115e59' },
  { bg: '#1e3a5f', hover: '#1e40af' },
  { bg: '#4c1d95', hover: '#5b21b6' },
];

const TOPIC_COLORS = [
  { bg: '#164e63', hover: '#155e75' },
  { bg: '#581c87', hover: '#6b21a8' },
  { bg: '#831843', hover: '#9d174d' },
  { bg: '#78350f', hover: '#92400e' },
  { bg: '#14532d', hover: '#166534' },
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
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [drillCategory, setDrillCategory] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setDims({ w: rect.width, h: rect.height });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(s => Math.max(0.5, Math.min(5, s + delta)));
  }, []);

  // Pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 1 && !(e.button === 0 && e.altKey)) return;
    e.preventDefault();
    isPanning.current = true;
    panStart.current = { x: e.clientX - translate.x, y: e.clientY - translate.y };
  }, [translate]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    setTranslate({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
  }, []);

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  const resetView = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, []);

  // Build treemap items
  const allItems = useMemo((): TreemapItem[] => {
    const items: TreemapItem[] = [];

    const realIssues = issues.filter(i => !i.pull_request);
    const openIssues = realIssues.filter(i => i.state === 'open');
    const closedIssues = realIssues.filter(i => i.state === 'closed');

    if (!drillCategory || drillCategory === 'issues') {
      if (drillCategory === 'issues') {
        for (const issue of realIssues) {
          const col = ISSUE_COLORS[issue.state] || ISSUE_COLORS.open;
          items.push({
            id: `issue-${issue.id}`,
            label: `#${issue.number}`,
            subLabel: issue.title.slice(0, 60),
            value: Math.max(1, issue.comments + 1),
            color: col.bg,
            hoverColor: col.hover,
            url: issue.html_url,
            category: 'issue',
            data: issue,
          });
        }
      } else {
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

    if (!drillCategory || drillCategory === 'topics') {
      const topicItems = topics.slice(0, drillCategory === 'topics' ? 40 : 12);
      topicItems.forEach((t: any, i: number) => {
        const col = TOPIC_COLORS[i % TOPIC_COLORS.length];
        items.push({
          id: `topic-${t.word}`,
          label: t.word,
          subLabel: `${t.count} stories`,
          value: t.weight || t.count || 1,
          color: col.bg,
          hoverColor: col.hover,
          category: 'topic',
          data: t,
        });
      });
    }

    if (!drillCategory || drillCategory === 'trending') {
      const trendItems = trendingRepos.slice(0, drillCategory === 'trending' ? 25 : 8);
      trendItems.forEach((r: any, i: number) => {
        const col = TRENDING_COLORS[i % TRENDING_COLORS.length];
        items.push({
          id: `trending-${r.full_name || r.name || i}`,
          label: r.name || 'repo',
          subLabel: r.full_name || r.description?.slice(0, 40),
          value: Math.max(r.stargazers_count || 1, 1),
          color: col.bg,
          hoverColor: col.hover,
          url: r.html_url,
          category: 'trending',
          data: r,
        });
      });
    }

    // If nothing loaded yet, show placeholder items
    if (items.length === 0) {
      items.push(
        { id: 'placeholder-1', label: 'Loading...', value: 40, color: '#18181b', hoverColor: '#27272a', category: 'issue' },
        { id: 'placeholder-2', label: 'Topics', value: 30, color: '#164e63', hoverColor: '#155e75', category: 'topic' },
        { id: 'placeholder-3', label: 'Trending', value: 30, color: '#7c2d12', hoverColor: '#9a3412', category: 'trending' },
      );
    }

    return items;
  }, [issues, topics, trendingRepos, drillCategory]);

  const nodes = useMemo(() => {
    if (dims.w < 10 || dims.h < 10) return [];
    return squarify(allItems, { x: 0, y: 0, w: dims.w, h: dims.h });
  }, [allItems, dims]);

  const handleClick = useCallback((node: TreemapNode) => {
    if (node.id.startsWith('placeholder')) return;
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
    resetView();
  }, [resetView]);

  const hoveredNode = hoveredId ? nodes.find(n => n.id === hoveredId) : null;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 shrink-0 border-b border-zinc-800/40">
        {drillCategory && (
          <button
            onClick={() => { setDrillCategory(null); resetView(); }}
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

        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setScale(s => Math.min(5, s + 0.3))} className="w-6 h-6 flex items-center justify-center text-zinc-600 hover:text-zinc-300 transition-colors" title="Zoom in">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-zinc-600 w-10 text-center tabular-nums">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.3))} className="w-6 h-6 flex items-center justify-center text-zinc-600 hover:text-zinc-300 transition-colors" title="Zoom out">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button onClick={resetView} className="w-6 h-6 flex items-center justify-center text-zinc-600 hover:text-zinc-300 transition-colors ml-1" title="Reset view">
            <Maximize className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-zinc-700 ml-2">{allItems.length} blocks</span>
        </div>
      </div>

      {/* Treemap area — fills remaining space */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden cursor-grab active:cursor-grabbing"
        style={{ minHeight: 0 }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          style={{
            transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
            transformOrigin: 'top left',
            width: dims.w || '100%',
            height: dims.h || '100%',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        >
          {nodes.map(node => {
            const isHovered = hoveredId === node.id;
            const showSub = node.w > 70 && node.h > 36;
            const showLabel = node.w > 30 && node.h > 20;

            return (
              <div
                key={node.id}
                className="absolute transition-colors duration-100"
                style={{
                  left: node.x,
                  top: node.y,
                  width: node.w,
                  height: node.h,
                  backgroundColor: isHovered ? node.hoverColor : node.color,
                  border: '1px solid rgba(0,0,0,0.5)',
                  borderRadius: 2,
                  cursor: 'pointer',
                }}
                onMouseEnter={() => setHoveredId(node.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={(e) => { e.stopPropagation(); handleClick(node); }}
              >
                {showLabel && (
                  <div className="absolute inset-0 p-1.5 overflow-hidden flex flex-col justify-center">
                    <p
                      className="font-mono font-semibold text-white/90 truncate leading-tight"
                      style={{ fontSize: Math.max(9, Math.min(16, node.w / 8)) }}
                    >
                      {node.label}
                    </p>
                    {showSub && node.subLabel && (
                      <p
                        className="font-mono text-white/50 truncate leading-tight mt-0.5"
                        style={{ fontSize: Math.max(8, Math.min(12, node.w / 12)) }}
                      >
                        {node.subLabel}
                      </p>
                    )}
                  </div>
                )}
                {isHovered && node.url && (
                  <ExternalLink className="absolute top-1 right-1 w-3 h-3 text-white/60" />
                )}
              </div>
            );
          })}
        </div>

        {dims.w === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 border border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Hover detail bar */}
      {hoveredNode && !hoveredNode.id.startsWith('placeholder') && (
        <div className="shrink-0 flex items-center gap-3 px-3 py-1.5 border-t border-zinc-800/60 bg-zinc-950/80 backdrop-blur-sm">
          <span
            className="w-3 h-3 rounded-sm shrink-0"
            style={{ backgroundColor: hoveredNode.color }}
          />
          <span className="text-[11px] font-mono font-medium text-zinc-200 truncate">
            {hoveredNode.label}
          </span>
          {hoveredNode.subLabel && (
            <span className="text-[10px] font-mono text-zinc-500 truncate">
              {hoveredNode.subLabel}
            </span>
          )}
          <span className="text-[9px] font-mono text-zinc-600 ml-auto shrink-0">
            {hoveredNode.category}
          </span>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 px-3 py-1 shrink-0 border-t border-zinc-800/40">
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
        <span className="text-[9px] font-mono text-zinc-700 ml-auto">scroll to zoom · alt+drag to pan · click to drill</span>
      </div>
    </div>
  );
}
