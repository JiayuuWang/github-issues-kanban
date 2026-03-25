import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ChevronDown } from 'lucide-react';
import { type GitHubIssue } from '@workspace/api-client-react';
import { IssueCard } from './IssueCard';

const PAGE_SIZE = 10;

interface ColumnProps {
  id: string;
  title: string;
  label: string;
  issues: GitHubIssue[];
  icon: React.ReactNode;
  accent: string;
  readOnly?: boolean;
  totalFromGitHub?: number;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  syncingIds?: Set<string>;
}

export function Column({
  id,
  title,
  label,
  issues,
  icon,
  accent,
  readOnly = false,
  totalFromGitHub,
  onLoadMore,
  isLoadingMore = false,
  syncingIds,
}: ColumnProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { type: 'Column', columnId: id },
  });

  const visibleIssues = issues.slice(0, visibleCount);
  const hasMoreLocal = visibleCount < issues.length;
  const hasMoreRemote = totalFromGitHub !== undefined && issues.length < totalFromGitHub;

  const handleShowMore = () => {
    const next = visibleCount + PAGE_SIZE;
    setVisibleCount(next);
    // If we've shown all locally loaded and there are more on GitHub, trigger load
    if (next >= issues.length && hasMoreRemote && onLoadMore) {
      onLoadMore();
    }
  };

  const showMoreBtn = hasMoreLocal || (visibleCount >= issues.length && hasMoreRemote);

  return (
    <div className="flex flex-col h-full min-w-[300px] max-w-[340px] shrink-0 flex-1">
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-2.5 mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-medium text-zinc-400 tracking-wider uppercase">{label}</span>
          <span className="text-xs text-zinc-600 font-mono ml-0.5">/ {title}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-zinc-600 tabular-nums">
            {issues.length}
            {totalFromGitHub !== undefined && totalFromGitHub > issues.length && (
              <span className="text-zinc-700"> / {totalFromGitHub}+</span>
            )}
          </span>
        </div>
      </div>

      {/* Accent Line */}
      <div className={`h-px w-full mb-3 ${accent} opacity-30`} />

      {/* Drop Zone */}
      <div
        ref={setNodeRef}
        className={`
          flex-1 flex flex-col gap-2 overflow-y-auto overflow-x-hidden
          rounded-sm px-0.5 py-1 min-h-[200px]
          transition-colors duration-150
          ${isOver && !readOnly ? 'bg-white/[0.02] ring-1 ring-inset ring-white/10' : ''}
        `}
      >
        <SortableContext
          items={visibleIssues.map((i) => i.id.toString())}
          strategy={verticalListSortingStrategy}
        >
          {visibleIssues.map((issue) => (
            <IssueCard
              key={issue.id}
              issue={issue}
              readOnly={readOnly}
              isSyncing={syncingIds?.has(String(issue.id)) ?? false}
            />
          ))}
        </SortableContext>

        {issues.length === 0 && (
          <div className="flex-1 min-h-[120px] flex items-center justify-center border border-dashed border-zinc-800 rounded-sm">
            <p className="text-xs text-zinc-700 font-mono">empty</p>
          </div>
        )}

        {/* Load more button */}
        {showMoreBtn && (
          <button
            onClick={handleShowMore}
            disabled={isLoadingMore && !hasMoreLocal}
            className={`
              w-full mt-1 py-2 flex items-center justify-center gap-1.5
              text-[11px] font-mono text-zinc-600 hover:text-zinc-300
              border border-dashed border-zinc-800 hover:border-zinc-600
              rounded-sm bg-transparent hover:bg-zinc-900/60
              transition-all duration-150
              disabled:opacity-40 disabled:cursor-not-allowed
            `}
          >
            {isLoadingMore && !hasMoreLocal ? (
              <>
                <span className="w-3 h-3 border border-zinc-600 border-t-zinc-300 rounded-full animate-spin" />
                loading...
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                {hasMoreLocal
                  ? `show ${Math.min(PAGE_SIZE, issues.length - visibleCount)} more`
                  : `load more from github`}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
