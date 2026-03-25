import React, { useState, useRef, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Clock, ExternalLink, Eye, Loader2 } from 'lucide-react';
import { type GitHubIssue } from '@workspace/api-client-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { IssuePreviewPopover } from './IssuePreviewPopover';

interface IssueCardProps {
  issue: GitHubIssue;
  isOverlay?: boolean;
  readOnly?: boolean;
  isSyncing?: boolean;
}

function getLabelStyle(color: string) {
  return {
    backgroundColor: `#${color}22`,
    color: `#${color}`,
    border: `1px solid #${color}40`,
  };
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]*`/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/#{1,6}\s+/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/^\s*[-*+>]\s+/gm, '')
    .replace(/\n+/g, ' ')
    .trim();
}

const HIDE_DELAY_MS = 800;

export function IssueCard({ issue, isOverlay = false, readOnly = false, isSyncing = false }: IssueCardProps) {
  const [showPreview, setShowPreview] = useState(false);
  const previewBtnRef = useRef<HTMLButtonElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearHideTimer();
    hideTimerRef.current = setTimeout(() => {
      setShowPreview(false);
    }, HIDE_DELAY_MS);
  }, [clearHideTimer]);

  const handleEyeEnter = useCallback(() => {
    clearHideTimer();
    setShowPreview(true);
  }, [clearHideTimer]);

  const handleEyeLeave = useCallback(() => {
    scheduleHide();
  }, [scheduleHide]);

  const handlePopoverEnter = useCallback(() => {
    clearHideTimer();
  }, [clearHideTimer]);

  const handlePopoverLeave = useCallback(() => {
    scheduleHide();
  }, [scheduleHide]);

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
    disabled: readOnly,
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
        className="h-[140px] w-full rounded-sm border border-dashed border-zinc-700/60 bg-zinc-900/30"
      />
    );
  }

  const bodyPreview = issue.body ? stripMarkdown(issue.body).slice(0, 120) : null;
  const displayUser = (issue.assignees && issue.assignees.length > 0)
    ? issue.assignees.slice(0, 3)
    : [issue.user];
  const isAssigned = issue.assignees && issue.assignees.length > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group relative flex flex-col gap-0 rounded-sm
        bg-zinc-900 border border-zinc-800
        hover:border-zinc-600 hover:bg-zinc-850
        transition-colors duration-150 select-none
        ${isOverlay ? 'shadow-2xl border-zinc-600 rotate-1 scale-[1.02]' : ''}
        ${readOnly ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}
        ${isSyncing ? 'opacity-60 pointer-events-none' : ''}
      `}
      {...(!readOnly ? attributes : {})}
      {...(!readOnly ? listeners : {})}
    >
      {/* Top section: number + title + buttons */}
      <div className="flex items-start gap-2 px-3 pt-3 pb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[10px] font-mono text-zinc-600">#{issue.number}</span>
            <span className={`text-[10px] font-mono ${issue.state === 'closed' ? 'text-zinc-600' : 'text-emerald-600'}`}>
              {issue.state}
            </span>
            {isSyncing && (
              <Loader2 className="w-3 h-3 text-zinc-500 animate-spin ml-0.5" />
            )}
          </div>
          <h4 className="text-xs font-medium leading-snug text-zinc-200 line-clamp-2 group-hover:text-white transition-colors">
            {issue.title}
          </h4>
        </div>

        <div
          className="flex items-center gap-1 shrink-0"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Eye preview button */}
          <button
            ref={previewBtnRef}
            onMouseEnter={handleEyeEnter}
            onMouseLeave={handleEyeLeave}
            className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center rounded-sm text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800"
            title="Preview issue"
          >
            <Eye className="w-3 h-3" />
          </button>
          {/* External link */}
          <a
            href={issue.html_url}
            target="_blank"
            rel="noreferrer"
            className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 flex items-center justify-center rounded-sm text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Body preview */}
      {bodyPreview && (
        <p className="px-3 pb-2 text-[11px] leading-relaxed text-zinc-500 line-clamp-2">
          {bodyPreview}{issue.body && stripMarkdown(issue.body).length > 120 ? '…' : ''}
        </p>
      )}

      {/* Labels */}
      {issue.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 pb-2">
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
      <div className="flex items-center justify-between px-3 pb-3 pt-2 border-t border-zinc-800/60">
        <div className="flex items-center gap-1">
          <div className="flex items-center -space-x-2">
            {displayUser.map((user) => (
              <Avatar key={user.id} className="w-7 h-7 border-2 border-zinc-900" title={user.login}>
                <AvatarImage src={user.avatar_url} />
                <AvatarFallback className="text-[10px] bg-zinc-700 text-zinc-300">
                  {user.login.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
          </div>
          {!isAssigned && (
            <span className="text-[10px] font-mono text-zinc-700 ml-1">{issue.user.login}</span>
          )}
          {isAssigned && issue.assignees && issue.assignees.length > 1 && (
            <span className="text-[10px] font-mono text-zinc-600 ml-1">+{issue.assignees.length - 1}</span>
          )}
        </div>

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

      {/* Hover preview popover */}
      {showPreview && (
        <IssuePreviewPopover
          issue={issue}
          anchorRef={previewBtnRef}
          onMouseEnter={handlePopoverEnter}
          onMouseLeave={handlePopoverLeave}
        />
      )}
    </div>
  );
}
