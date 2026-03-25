import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { type GitHubIssue } from '@workspace/api-client-react';
import { IssueCard } from './IssueCard';

interface ColumnProps {
  id: string;
  title: string;
  label: string;
  issues: GitHubIssue[];
  icon: React.ReactNode;
  accent: string;
}

export function Column({ id, title, label, issues, icon, accent }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { type: 'Column', columnId: id },
  });

  return (
    <div className="flex flex-col h-full min-w-[300px] max-w-[340px] shrink-0 flex-1">
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-2.5 mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-medium text-zinc-400 tracking-wider uppercase">{label}</span>
          <span className="text-xs text-zinc-600 font-mono ml-0.5">/ {title}</span>
        </div>
        <span className="text-xs font-mono text-zinc-600 tabular-nums">{issues.length}</span>
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
          ${isOver ? 'bg-white/[0.02] ring-1 ring-inset ring-white/10' : ''}
        `}
      >
        <SortableContext items={issues.map((i) => i.id.toString())} strategy={verticalListSortingStrategy}>
          {issues.map((issue) => (
            <IssueCard key={issue.id} issue={issue} />
          ))}
        </SortableContext>

        {issues.length === 0 && (
          <div className="flex-1 min-h-[120px] flex items-center justify-center border border-dashed border-zinc-800 rounded-sm">
            <p className="text-xs text-zinc-700 font-mono">empty</p>
          </div>
        )}
      </div>
    </div>
  );
}
