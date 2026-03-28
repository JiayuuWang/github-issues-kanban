import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Circle, Timer, CheckCircle, LockOpen, Lock, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  type GitHubIssue,
  useGetBoardState,
  useSaveBoardState,
  getGetBoardStateQueryKey,
} from '@workspace/api-client-react';
import { useToast } from '@/hooks/use-toast';
import { Column } from './Column';
import { IssueCard } from './IssueCard';
import { getDefaultColumnForIssue, getReadOnlyColumnForIssue } from '@/lib/github-utils';

export type BoardMode = 'readonly' | 'readwrite';

interface BoardProps {
  repoKey: string;
  issues: GitHubIssue[];
  owner: string;
  repo: string;
  mode: BoardMode;
  token?: string | null;
  totalFromGitHub?: number;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
  expanded?: boolean;
}

type ColumnsState = Record<string, GitHubIssue[]>;

const IN_PROGRESS_LABEL = 'in-progress';

const RW_COLUMNS = [
  {
    id: 'todo',
    title: '待处理',
    label: 'Open',
    icon: <Circle className="w-3.5 h-3.5 text-emerald-600" />,
    accent: 'bg-emerald-700',
  },
  {
    id: 'in-progress',
    title: '进行中',
    label: 'In Progress',
    icon: <Timer className="w-3.5 h-3.5 text-zinc-300" />,
    accent: 'bg-zinc-300',
  },
  {
    id: 'done',
    title: '已关闭',
    label: 'Closed',
    icon: <CheckCircle className="w-3.5 h-3.5 text-zinc-500" />,
    accent: 'bg-zinc-600',
  },
];

const RO_COLUMNS = [
  {
    id: 'open',
    title: '开放',
    label: 'Open',
    icon: <Circle className="w-3.5 h-3.5 text-emerald-600" />,
    accent: 'bg-emerald-700',
  },
  {
    id: 'closed',
    title: '已关闭',
    label: 'Closed',
    icon: <CheckCircle className="w-3.5 h-3.5 text-zinc-500" />,
    accent: 'bg-zinc-600',
  },
];

function buildReadOnlyColumns(issues: GitHubIssue[]): ColumnsState {
  const cols: ColumnsState = { open: [], closed: [] };
  issues.filter((i) => !i.pull_request).forEach((i) => {
    cols[getReadOnlyColumnForIssue(i)].push(i);
  });
  return cols;
}

/** Determine what GitHub actions are needed for a column move */
function getGitHubActions(from: string, to: string): {
  state?: 'open' | 'closed';
  add_labels?: string[];
  remove_labels?: string[];
} {
  if (from === to) return {};

  // → done (close issue)
  if (to === 'done') {
    return {
      state: 'closed',
      remove_labels: from === 'in-progress' ? [IN_PROGRESS_LABEL] : undefined,
    };
  }
  // done → todo (reopen)
  if (from === 'done' && to === 'todo') {
    return { state: 'open' };
  }
  // done → in-progress (reopen + add label)
  if (from === 'done' && to === 'in-progress') {
    return { state: 'open', add_labels: [IN_PROGRESS_LABEL] };
  }
  // todo → in-progress (add label)
  if (from === 'todo' && to === 'in-progress') {
    return { add_labels: [IN_PROGRESS_LABEL] };
  }
  // in-progress → todo (remove label)
  if (from === 'in-progress' && to === 'todo') {
    return { remove_labels: [IN_PROGRESS_LABEL] };
  }
  return {};
}

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, '') || '';

export function Board({
  repoKey,
  issues,
  owner,
  repo,
  mode,
  token,
  totalFromGitHub,
  onLoadMore,
  isLoadingMore,
  expanded = false,
}: BoardProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isReadOnly = mode === 'readonly';
  const COLUMNS = isReadOnly ? RO_COLUMNS : RW_COLUMNS;
  const emptyState: ColumnsState = isReadOnly
    ? { open: [], closed: [] }
    : { todo: [], 'in-progress': [], done: [] };

  const [columns, setColumns] = useState<ColumnsState>(emptyState);
  const [activeIssue, setActiveIssue] = useState<GitHubIssue | null>(null);
  const [syncingIssues, setSyncingIssues] = useState<Set<string>>(new Set());

  // Snapshot for rollback
  const snapshotRef = useRef<ColumnsState | null>(null);

  const { data: savedState, isLoading: isLoadingState } = useGetBoardState(
    { repoKey },
    { query: { enabled: !!repoKey && !isReadOnly, staleTime: 1000 * 60 * 5 } }
  );

  const { mutate: saveState } = useSaveBoardState({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBoardStateQueryKey({ repoKey }) });
      },
    },
  });

  // Build columns from issues + saved state
  useEffect(() => {
    if (isReadOnly) {
      setColumns(buildReadOnlyColumns(issues));
      return;
    }
    if (isLoadingState) return;

    const newCols: ColumnsState = { todo: [], 'in-progress': [], done: [] };
    const validIssues = issues.filter((i) => !i.pull_request);
    const issuesById = new Map(validIssues.map((i) => [i.id, i]));
    const placed = new Set<number>();

    if (savedState?.columns?.length) {
      savedState.columns.forEach((col) => {
        if (!newCols[col.columnId]) return;
        col.issueIds.forEach((id) => {
          const issue = issuesById.get(id);
          if (issue) { newCols[col.columnId].push(issue); placed.add(id); }
        });
      });
    }

    validIssues.forEach((issue) => {
      if (!placed.has(issue.id)) {
        newCols[getDefaultColumnForIssue(issue)].push(issue);
      }
    });

    setColumns(newCols);
  }, [issues, savedState, isLoadingState, isReadOnly]);

  const persistColumns = useCallback(
    (cols: ColumnsState) => {
      saveState({
        data: {
          repoKey,
          columns: Object.entries(cols).map(([colId, items]) => ({
            columnId: colId,
            issueIds: items.map((i) => i.id),
          })),
        },
      });
    },
    [repoKey, saveState]
  );

  /** Sync a column move to GitHub, then persist locally. Reverts on failure. */
  const syncToGitHub = useCallback(
    async (issue: GitHubIssue, fromCol: string, toCol: string, finalCols: ColumnsState, preSnapshot: ColumnsState) => {
      const actions = getGitHubActions(fromCol, toCol);
      const hasActions = actions.state || (actions.add_labels?.length) || (actions.remove_labels?.length);

      if (!hasActions) {
        persistColumns(finalCols);
        return;
      }

      setSyncingIssues((s) => new Set(s).add(String(issue.id)));

      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['X-GitHub-Token'] = token;

        const res = await fetch(`${BASE_URL}/api/github/issues/update`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify({ owner, repo, number: issue.number, ...actions }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as any;
          throw new Error(body?.message || 'GitHub sync failed');
        }

        // Success — persist to DB and show toast
        persistColumns(finalCols);
        const action = toCol === 'done' ? 'Closed' : fromCol === 'done' ? 'Reopened' : 'Updated';
        toast({
          title: `${action} on GitHub`,
          description: `#${issue.number} ${issue.title.slice(0, 60)}`,
        });
      } catch (err: any) {
        // Revert UI to pre-drag snapshot
        setColumns(preSnapshot);
        toast({
          variant: 'destructive',
          title: 'GitHub sync failed',
          description: err?.message || 'Could not update issue on GitHub. Check your token permissions.',
        });
      } finally {
        setSyncingIssues((s) => {
          const next = new Set(s);
          next.delete(String(issue.id));
          return next;
        });
      }
    },
    [owner, repo, token, persistColumns, toast]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === 'Issue') {
      setActiveIssue(event.active.data.current.issue as GitHubIssue);
      // Save snapshot before drag for potential rollback
      snapshotRef.current = JSON.parse(JSON.stringify(columns));
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;
    if (active.data.current?.type !== 'Issue') return;

    const activeCol = Object.keys(columns).find((k) =>
      columns[k].some((i) => i.id.toString() === activeId)
    );
    const isOverIssue = over.data.current?.type === 'Issue';
    const isOverColumn = over.data.current?.type === 'Column';

    let overCol: string | undefined;
    if (isOverIssue) {
      overCol = Object.keys(columns).find((k) => columns[k].some((i) => i.id.toString() === overId));
    } else if (isOverColumn) {
      overCol = overId;
    }

    if (!activeCol || !overCol || activeCol === overCol) return;

    setColumns((prev) => {
      const activeItems = [...prev[activeCol]];
      const overItems = [...prev[overCol!]];
      const activeIdx = activeItems.findIndex((i) => i.id.toString() === activeId);
      const [moved] = activeItems.splice(activeIdx, 1);

      let overIdx = overItems.length;
      if (isOverIssue) {
        const rawIdx = overItems.findIndex((i) => i.id.toString() === overId);
        const below =
          active.rect.current.translated &&
          active.rect.current.translated.top > over.rect.top + over.rect.height / 2;
        overIdx = rawIdx >= 0 ? rawIdx + (below ? 1 : 0) : overItems.length;
      }
      overItems.splice(overIdx, 0, moved);
      return { ...prev, [activeCol]: activeItems, [overCol!]: overItems };
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const draggedIssue = activeIssue;
    setActiveIssue(null);
    const { active, over } = event;
    if (!over || !draggedIssue) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeCol = Object.keys(columns).find((k) =>
      columns[k].some((i) => i.id.toString() === activeId)
    );
    if (!activeCol) return;

    let finalCols = { ...columns };

    const overCol =
      Object.keys(columns).find((k) => columns[k].some((i) => i.id.toString() === overId)) ??
      (over.data.current?.type === 'Column' ? overId : activeCol);

    // Same-column reorder
    if (activeCol === overCol && activeId !== overId) {
      const items = [...columns[activeCol]];
      const ai = items.findIndex((i) => i.id.toString() === activeId);
      const oi = items.findIndex((i) => i.id.toString() === overId);
      if (ai !== -1 && oi !== -1) {
        finalCols = { ...columns, [activeCol]: arrayMove(items, ai, oi) };
        setColumns(finalCols);
      }
      persistColumns(finalCols);
      return;
    }

    // Cross-column move
    if (activeCol !== overCol) {
      const preSnapshot = snapshotRef.current || JSON.parse(JSON.stringify(columns));
      syncToGitHub(draggedIssue, activeCol, overCol, finalCols, preSnapshot);
      return;
    }

    persistColumns(finalCols);
  };

  return (
    <>
      {/* Mode badge + sync indicator */}
      <div className="flex items-center gap-2 mb-3 px-1">
        {isReadOnly ? (
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-600 border border-zinc-800 rounded-sm px-2 py-1 bg-zinc-900/50">
            <Lock className="w-3 h-3" />
            read-only · 2 columns
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-700 border border-emerald-900/50 rounded-sm px-2 py-1 bg-emerald-950/30">
            <LockOpen className="w-3 h-3" />
            read-write · github synced
          </div>
        )}
        {syncingIssues.size > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-500">
            <Loader2 className="w-3 h-3 animate-spin" />
            syncing to github…
          </div>
        )}
        <span className="text-[11px] font-mono text-zinc-700">
          {Object.values(columns).reduce((s, c) => s + c.length, 0)} issues loaded
          {totalFromGitHub !== undefined && ` / ${totalFromGitHub}+ total`}
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={isReadOnly ? undefined : handleDragOver}
        onDragEnd={isReadOnly ? undefined : handleDragEnd}
      >
        <div className={`flex gap-4 h-full w-full overflow-x-auto pb-4 ${
          expanded ? 'justify-center' : ''
        }`}>
          {COLUMNS.map((col) => (
            <Column
              key={col.id}
              id={col.id}
              title={col.title}
              label={col.label}
              icon={col.icon}
              accent={col.accent}
              issues={columns[col.id] || []}
              readOnly={isReadOnly}
              onLoadMore={onLoadMore}
              isLoadingMore={isLoadingMore}
              syncingIds={syncingIssues}
              expanded={expanded}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
          {activeIssue ? <IssueCard issue={activeIssue} isOverlay readOnly={isReadOnly} /> : null}
        </DragOverlay>
      </DndContext>
    </>
  );
}
