import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Clock, ExternalLink, GripVertical } from 'lucide-react';
import { type GitHubIssue } from '@workspace/api-client-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';

interface IssueCardProps {
  issue: GitHubIssue;
  isOverlay?: boolean;
}

function getLabelStyle(color: string) {
  return {
    backgroundColor: `#${color}18`,
    color: `#${color}`,
    border: `1px solid #${color}30`,
  };
}

export function IssueCard({ issue, isOverlay = false }: IssueCardProps) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: issue.id.toString(),
    data: { type: 'Issue', issue },
  });

  const style = {
    transition,
    transform: CSS.Transform.toString(transform),
  };

  if (isDragging && !isOverlay) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="h-[110px] w-full rounded-sm border border-dashed border-zinc-700/60 bg-zinc-900/30"
      />
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group relative flex flex-col gap-2.5 rounded-sm
        bg-zinc-900 border border-zinc-800
        hover:border-zinc-600 hover:bg-zinc-800/80
        transition-colors duration-150
        ${isOverlay ? 'shadow-2xl border-zinc-600 rotate-1 scale-[1.02]' : ''}
      `}
    >
      {/* Drag handle row */}
      <div className="flex items-start gap-2 px-3 pt-3">
        <div
          {...attributes}
          {...listeners}
          className="mt-0.5 shrink-0 cursor-grab active:cursor-grabbing text-zinc-700 hover:text-zinc-400 transition-colors"
        >
          <GripVertical className="w-3 h-3" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Issue number + state */}
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-mono text-zinc-600">#{issue.number}</span>
            <span className={`text-[10px] font-mono ${issue.state === 'closed' ? 'text-zinc-600' : 'text-zinc-400'}`}>
              {issue.state}
            </span>
            <a
              href={issue.html_url}
              target="_blank"
              rel="noreferrer"
              className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-zinc-300"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Title */}
          <h4 className="text-xs font-medium leading-snug text-zinc-200 line-clamp-2 group-hover:text-white transition-colors">
            {issue.title}
          </h4>
        </div>
      </div>

      {/* Labels */}
      {issue.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3">
          {issue.labels.slice(0, 4).map((label) => (
            <span
              key={label.id}
              className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-mono leading-none"
              style={getLabelStyle(label.color)}
            >
              {label.name}
            </span>
          ))}
          {issue.labels.length > 4 && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-sm text-[10px] font-mono text-zinc-600 bg-zinc-800 border border-zinc-700">
              +{issue.labels.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-3 pb-3 border-t border-zinc-800 pt-2">
        {/* Assignees */}
        <div className="flex items-center -space-x-1.5">
          {issue.assignees && issue.assignees.length > 0 ? (
            issue.assignees.slice(0, 3).map((user) => (
              <Tooltip key={user.id}>
                <TooltipTrigger asChild>
                  <Avatar className="w-5 h-5 border border-zinc-800 ring-1 ring-zinc-900">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback className="text-[8px] bg-zinc-800 text-zinc-400">
                      {user.login.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs font-mono">
                  {user.login}
                </TooltipContent>
              </Tooltip>
            ))
          ) : (
            <Avatar className="w-5 h-5 border border-zinc-800 opacity-30 grayscale">
              <AvatarImage src={issue.user.avatar_url} />
              <AvatarFallback className="text-[8px] bg-zinc-800">?</AvatarFallback>
            </Avatar>
          )}
        </div>

        {/* Meta */}
        <div className="flex items-center gap-2.5 text-zinc-600 text-[10px] font-mono">
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            {issue.comments}
          </span>
          <span className="flex items-center gap-1" title={new Date(issue.created_at).toLocaleString()}>
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(new Date(issue.created_at), { addSuffix: false })}
          </span>
        </div>
      </div>
    </div>
  );
}
