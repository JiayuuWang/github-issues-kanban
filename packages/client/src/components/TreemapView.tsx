import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { ExternalLink, ArrowLeft, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { type GitHubIssue } from '@workspace/api-client-react';

// --- Squarified Treemap Layout ---

interface TreemapRect { x: number; y: number; w: number; h: number }

interface TreemapItem {
  id: string;
  label: string;
  subLabel?: string;
  value: number;
  color: string;
  hoverColor: string;
  textColor: string;
  url?: string;
  category: 'issue' | 'topic' | 'trending';
  data?: any;
}

interface TreemapNode extends TreemapItem, TreemapRect {}

function squarify(items: TreemapItem[], rect: TreemapRect): TreemapNode[] {
  if (items.length === 0 || rect.w <= 0 || rect.h <= 0) return [];
  const totalValue = items.reduce((s, i) => s + i.value, 0);
  if (totalValue <= 0) return [];

  const sorted = [...items].sort((a, b) => b.value - a.value);
  const nodes: TreemapNode[] = [];
  let remaining = [...sorted];
  let cur = { ...rect };

  while (remaining.length > 0 && cur.w > 0 && cur.h > 0) {
    const isWide = cur.w >= cur.h;
    const totalRem = remaining.reduce((s, i) => s + i.value, 0);
    const side = isWide ? cur.h : cur.w;
    if (side <= 0) break;

    let row: TreemapItem[] = [];
    let bestWorst = Infinity;
    for (let i = 1; i <= remaining.length; i++) {
      const cand = remaining.slice(0, i);
      const rSum = cand.reduce((s, it) => s + it.value, 0);
      const rW = (rSum / totalRem) * (isWide ? cur.w : cur.h);
      if (rW <= 0) continue;
      let worst = 0;
      for (const it of cand) {
        const iH = (it.value / rSum) * side;
        if (iH <= 0) continue;
        worst = Math.max(worst, Math.max(rW / iH, iH / rW));
      }
      if (worst <= bestWorst) { bestWorst = worst; row = cand; }
      else break;
    }
    if (row.length === 0) row = [remaining[0]];

    const rSum = row.reduce((s, it) => s + it.value, 0);
    const rW = (rSum / totalRem) * (isWide ? cur.w : cur.h);
    let off = 0;
    for (const item of row) {
      const iS = (item.value / rSum) * side;
      nodes.push({
        ...item,
        x: isWide ? cur.x : cur.x + off,
        y: isWide ? cur.y + off : cur.y,
        w: isWide ? rW : iS,
        h: isWide ? iS : rW,
      });
      off += iS;
    }
    if (isWide) { cur = { x: cur.x + rW, y: cur.y, w: cur.w - rW, h: cur.h }; }
    else { cur = { x: cur.x, y: cur.y + rW, w: cur.w, h: cur.h - rW }; }
    remaining = remaining.slice(row.length);
  }
  return nodes;
}

// --- Red-Green Heatmap Color ---
// ratio 0..1 → deep red(0) → dark neutral(0.5) → deep green(1)
function heatColor(ratio: number): { bg: string; hover: string; text: string } {
  const r = Math.max(0, Math.min(1, ratio));
  // HSL: red=0, green=130. Saturation and lightness tuned for dark theme.
  const hue = r * 130;
  const sat = 50 + Math.abs(r - 0.5) * 60; // more saturated at extremes
  const light = 18 + Math.abs(r - 0.5) * 8;
  const lightHover = light + 6;
  const textLight = 65 + Math.abs(r - 0.5) * 20;
  return {
    bg: `hsl(${hue}, ${sat}%, ${light}%)`,
    hover: `hsl(${hue}, ${sat}%, ${lightHover}%)`,
    text: `hsl(${hue}, ${sat - 10}%, ${textLight}%)`,
  };
}

// --- Component ---

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

  // Transform state: scale + translate
  const [transform, setTransform] = useState({ scale: 1, tx: 0, ty: 0 });
  const isPanning = useRef(false);
  const panLast = useRef({ x: 0, y: 0 });

  // Measure
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 10 && r.height > 10) setDims({ w: Math.floor(r.width), h: Math.floor(r.height) });
      else timer = setTimeout(measure, 50);
    };
    timer = setTimeout(measure, 20);
    const ro = new ResizeObserver(([e]) => {
      if (e.contentRect.width > 10 && e.contentRect.height > 10)
        setDims({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) });
    });
    ro.observe(el);
    return () => { ro.disconnect(); if (timer) clearTimeout(timer); };
  }, []);

  // Wheel zoom at cursor position
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    setTransform(prev => {
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(0.3, Math.min(8, prev.scale * factor));
      // Zoom toward cursor: adjust translate so cursor world-point stays fixed
      const newTx = mx - (mx - prev.tx) * (newScale / prev.scale);
      const newTy = my - (my - prev.ty) * (newScale / prev.scale);
      return { scale: newScale, tx: newTx, ty: newTy };
    });
  }, []);

  // Left-click drag to pan
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    // Don't start pan if clicking on a treemap block (they handle their own click)
    if ((e.target as HTMLElement).closest('[data-block]')) return;
    e.preventDefault();
    isPanning.current = true;
    panLast.current = { x: e.clientX, y: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - panLast.current.x;
    const dy = e.clientY - panLast.current.y;
    panLast.current = { x: e.clientX, y: e.clientY };
    setTransform(prev => ({ ...prev, tx: prev.tx + dx, ty: prev.ty + dy }));
  }, []);

  const handleMouseUp = useCallback(() => { isPanning.current = false; }, []);

  const resetView = useCallback(() => setTransform({ scale: 1, tx: 0, ty: 0 }), []);

  // Build items — show ALL data, not just a few
  const allItems = useMemo((): TreemapItem[] => {
    const items: TreemapItem[] = [];
    const now = Date.now();

    // --- Issues: every individual issue ---
    const realIssues = issues.filter(i => !i.pull_request);
    if (!drillCategory || drillCategory === 'issues') {
      for (const issue of realIssues) {
        // Heat metric: recency (updated_at) + comment activity
        const ageMs = now - new Date(issue.updated_at).getTime();
        const ageDays = ageMs / (1000 * 60 * 60 * 24);
        const recencyScore = Math.max(0, 1 - ageDays / 180); // 0..1, 1=just updated
        const commentScore = Math.min(1, issue.comments / 30);
        const heat = recencyScore * 0.6 + commentScore * 0.4; // combined 0..1
        // open issues get a green tint boost, closed get a red tint
        const ratio = issue.state === 'open'
          ? 0.5 + heat * 0.5 // 0.5..1 (neutral to green)
          : heat * 0.45;      // 0..0.45 (red to neutral)
        const c = heatColor(ratio);
        items.push({
          id: `issue-${issue.id}`,
          label: `#${issue.number}`,
          subLabel: issue.title,
          value: Math.max(2, issue.comments * 2 + 3),
          color: c.bg, hoverColor: c.hover, textColor: c.text,
          url: issue.html_url,
          category: 'issue', data: issue,
        });
      }
    }

    // --- Topics: all available topics ---
    if (!drillCategory || drillCategory === 'topics') {
      const maxW = topics.length > 0 ? Math.max(...topics.map((t: any) => t.weight || 1)) : 1;
      topics.forEach((t: any) => {
        const ratio = (t.weight || 1) / maxW; // high weight = green (hot), low = red
        const c = heatColor(ratio);
        items.push({
          id: `topic-${t.word}`,
          label: t.word,
          subLabel: `${t.count} stories · score ${t.weight}`,
          value: (t.weight || t.count || 1) * 2,
          color: c.bg, hoverColor: c.hover, textColor: c.text,
          category: 'topic', data: t,
        });
      });
    }

    // --- Trending: all repos ---
    if (!drillCategory || drillCategory === 'trending') {
      const maxStars = trendingRepos.length > 0
        ? Math.max(...trendingRepos.map((r: any) => r.stars_today || r.stargazers_count || 1))
        : 1;
      trendingRepos.forEach((r: any) => {
        const velocity = (r.stars_today || 0) / maxStars;
        const ratio = Math.max(0.1, velocity); // high velocity = green
        const c = heatColor(ratio);
        items.push({
          id: `trending-${r.full_name || r.name}`,
          label: r.name || 'repo',
          subLabel: r.full_name || r.description?.slice(0, 50),
          value: Math.max(3, Math.sqrt(r.stargazers_count || 1) * 3),
          color: c.bg, hoverColor: c.hover, textColor: c.text,
          url: r.html_url,
          category: 'trending', data: r,
        });
      });
    }

    if (items.length === 0) {
      const c = heatColor(0.5);
      items.push({ id: 'empty', label: 'No data', value: 1, color: c.bg, hoverColor: c.hover, textColor: c.text, category: 'issue' });
    }
    return items;
  }, [issues, topics, trendingRepos, drillCategory]);

  const nodes = useMemo(() => {
    if (dims.w < 10 || dims.h < 10) return [];
    return squarify(allItems, { x: 0, y: 0, w: dims.w, h: dims.h });
  }, [allItems, dims]);

  const handleClick = useCallback((node: TreemapNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.id === 'empty') return;
    if (node.url) { window.open(node.url, '_blank'); return; }
    if (node.category === 'trending' && node.data?.full_name && onSelectRepo) {
      onSelectRepo(node.data.full_name);
    }
  }, [onSelectRepo]);

  const handleCategoryDrill = useCallback((cat: string) => {
    setDrillCategory(prev => prev === cat ? null : cat);
    resetView();
  }, [resetView]);

  const hoveredNode = hoveredId ? nodes.find(n => n.id === hoveredId) : null;

  return (
    <div className="flex flex-col h-full w-full overflow-hidden" style={{ position: 'absolute', inset: 0 }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 shrink-0 border-b border-zinc-800/40 bg-[#111]">
        {drillCategory && (
          <button onClick={() => { setDrillCategory(null); resetView(); }}
            className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors">
            <ArrowLeft className="w-3 h-3" /> all
          </button>
        )}
        {['issues', 'topics', 'trending'].map(cat => (
          <button key={cat} onClick={() => handleCategoryDrill(cat)}
            className={`text-[10px] font-mono px-2 py-1 rounded-sm border transition-colors ${
              drillCategory === cat ? 'bg-zinc-800 text-zinc-200 border-zinc-600'
              : 'text-zinc-600 border-zinc-800 hover:border-zinc-600 hover:text-zinc-400'
            }`}>
            {cat}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setTransform(p => ({ ...p, scale: Math.min(8, p.scale * 1.3) }))}
            className="w-6 h-6 flex items-center justify-center text-zinc-600 hover:text-zinc-300 transition-colors" title="Zoom in">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-zinc-600 w-10 text-center tabular-nums">
            {Math.round(transform.scale * 100)}%
          </span>
          <button onClick={() => setTransform(p => ({ ...p, scale: Math.max(0.3, p.scale / 1.3) }))}
            className="w-6 h-6 flex items-center justify-center text-zinc-600 hover:text-zinc-300 transition-colors" title="Zoom out">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button onClick={resetView}
            className="w-6 h-6 flex items-center justify-center text-zinc-600 hover:text-zinc-300 transition-colors ml-1" title="Reset">
            <Maximize className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono text-zinc-700 ml-2">{allItems.length} blocks</span>
        </div>
      </div>

      {/* Treemap canvas */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden"
        style={{ minHeight: 0, cursor: isPanning.current ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {dims.w > 10 && dims.h > 10 && (
          <div style={{
            transform: `translate(${transform.tx}px, ${transform.ty}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
            width: dims.w, height: dims.h,
            position: 'absolute', top: 0, left: 0,
          }}>
            {nodes.map(node => {
              const isHov = hoveredId === node.id;
              const canShowLabel = node.w > 28 && node.h > 18;
              const canShowSub = node.w > 60 && node.h > 32;
              return (
                <div
                  key={node.id}
                  data-block="1"
                  className="absolute transition-[background-color] duration-100"
                  style={{
                    left: node.x, top: node.y, width: node.w, height: node.h,
                    backgroundColor: isHov ? node.hoverColor : node.color,
                    border: '1px solid rgba(0,0,0,0.6)',
                    borderRadius: 1,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={(e) => handleClick(node, e)}
                >
                  {canShowLabel && (
                    <div className="absolute inset-0 p-1 overflow-hidden flex flex-col justify-center">
                      <p className="font-mono font-semibold truncate leading-tight"
                        style={{ fontSize: Math.max(8, Math.min(15, node.w / 7, node.h / 3)), color: node.textColor }}>
                        {node.label}
                      </p>
                      {canShowSub && node.subLabel && (
                        <p className="font-mono truncate leading-tight mt-px opacity-60"
                          style={{ fontSize: Math.max(7, Math.min(11, node.w / 11, node.h / 4)), color: node.textColor }}>
                          {node.subLabel}
                        </p>
                      )}
                    </div>
                  )}
                  {isHov && node.url && <ExternalLink className="absolute top-0.5 right-0.5 w-2.5 h-2.5 text-white/50" />}
                </div>
              );
            })}
          </div>
        )}
        {dims.w === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 border border-zinc-700 border-t-zinc-400 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Hover detail */}
      {hoveredNode && hoveredNode.id !== 'empty' && (
        <div className="shrink-0 flex items-center gap-3 px-3 py-1 border-t border-zinc-800/60 bg-zinc-950/90 backdrop-blur-sm">
          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: hoveredNode.color }} />
          <span className="text-[11px] font-mono font-medium text-zinc-200 truncate">{hoveredNode.label}</span>
          {hoveredNode.subLabel && <span className="text-[10px] font-mono text-zinc-500 truncate">{hoveredNode.subLabel}</span>}
          <span className="text-[9px] font-mono text-zinc-600 ml-auto shrink-0">{hoveredNode.category}</span>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 px-3 py-1 shrink-0 border-t border-zinc-800/40 bg-[#111]">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: heatColor(1).bg }} />
          <span className="text-[9px] font-mono text-zinc-600">hot</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: heatColor(0.5).bg }} />
          <span className="text-[9px] font-mono text-zinc-600">neutral</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: heatColor(0).bg }} />
          <span className="text-[9px] font-mono text-zinc-600">cold</span>
        </div>
        <span className="text-zinc-800">|</span>
        <span className="text-[9px] font-mono text-zinc-700">issues: recency+comments</span>
        <span className="text-[9px] font-mono text-zinc-700">topics: score</span>
        <span className="text-[9px] font-mono text-zinc-700">trending: velocity</span>
        <span className="text-[9px] font-mono text-zinc-700 ml-auto">drag to pan · scroll to zoom · click to open</span>
      </div>
    </div>
  );
}
