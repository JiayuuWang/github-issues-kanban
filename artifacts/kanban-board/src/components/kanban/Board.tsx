import React, { useState, useEffect, useCallback } from 'react';
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
import { Circle, Timer, CheckCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  type GitHubIssue,
  useGetBoardState,
  useSaveBoardState,
  getGetBoardStateQueryKey,
} from '@workspace/api-client-react';
import { Column } from './Column';
import { IssueCard } from './IssueCard';
import { getDefaultColumnForIssue } from '@/lib/github-utils';
import { PermissionDialog } from '@/components/PermissionDialog';

interface BoardProps {
  repoKey: string;
  issues: GitHubIssue[];
  owner: string;
  repo: string;
}

type ColumnsState = Record<string, GitHubIssue[]>;

const COLUMNS = [
  {
    id: 'todo',
    title: '待处理',
    label: 'Todo',
    icon: <Circle className="w-3.5 h-3.5 text-zinc-400" />,
    accent: 'bg-zinc-500',
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

export function Board({ repoKey, issues, owner, repo }: BoardProps) {
  const queryClient = useQueryClient();
  const [columns, setColumns] = useState<ColumnsState>({ todo: [], 'in-progress': [], done: [] });
  const [activeIssue, setActiveIssue] = useState<GitHubIssue | null>(null);
  const [pendingMove, setPendingMove] = useState<{
    issueId: string;
    fromCol: string;
    toCol: string;
    snapshot: ColumnsState;
  } | null>(null);
  const [showPermDialog, setShowPermDialog] = useState(false);

  const { data: savedState, isLoading: isLoadingState } = useGetBoardState(
    { repoKey },
    { query: { enabled: !!repoKey, staleTime: 1000 * 60 * 5 } }
  );

  const { mutate: saveState } = useSaveBoardState({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetBoardStateQueryKey({ repoKey }) });
      },
    },
  });

  // Build columns from issues + saved board state
  useEffect(() => {
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
          if (issue) {
            newCols[col.columnId].push(issue);
            placed.add(id);
          }
        });
      });
    }

    validIssues.forEach((issue) => {
      if (!placed.has(issue.id)) {
        newCols[getDefaultColumnForIssue(issue)].push(issue);
      }
    });

    setColumns(newCols);
  }, [issues, savedState, isLoadingState]);

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const findColumn = (id: string) =>
    Object.keys(columns).find(
      (key) => columns[key].some((i) => i.id.toString() === id) || key === id
    );

  const handleDragStart = (event: DragStartEvent) => {
    if (event.active.data.current?.type === 'Issue') {
      setActiveIssue(event.active.data.current.issue as GitHubIssue);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const isActiveIssue = active.data.current?.type === 'Issue';
    if (!isActiveIssue) return;

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
    setActiveIssue(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeCol = Object.keys(columns).find((k) =>
      columns[k].some((i) => i.id.toString() === activeId)
    );
    if (!activeCol) return;

    let finalCols = { ...columns };

    // Same-column sort
    const overCol =
      Object.keys(columns).find((k) => columns[k].some((i) => i.id.toString() === overId)) ??
      (over.data.current?.type === 'Column' ? overId : activeCol);

    if (activeCol === overCol && activeId !== overId) {
      const items = [...columns[activeCol]];
      const ai = items.findIndex((i) => i.id.toString() === activeId);
      const oi = items.findIndex((i) => i.id.toString() === overId);
      if (ai !== -1 && oi !== -1) {
        finalCols = { ...columns, [activeCol]: arrayMove(items, ai, oi) };
        setColumns(finalCols);
      }
    }

    // Cross-column move — check permission
    if (activeCol !== overCol) {
      // Store the pending move and show dialog
      setPendingMove({ issueId: activeId, fromCol: activeCol, toCol: overCol, snapshot: finalCols });
      setShowPermDialog(true);
      return; // don't persist yet
    }

    persistColumns(finalCols);
  };

  const handlePermissionConfirmed = () => {
    setShowPermDialog(false);
    if (pendingMove) {
      persistColumns(pendingMove.snapshot);
      setPendingMove(null);
    }
  };

  const handlePermissionCancelled = () => {
    setShowPermDialog(false);
    if (pendingMove) {
      // Restore to snapshot BEFORE the drag (re-derive from savedState)
      const rollback: ColumnsState = { todo: [], 'in-progress': [], done: [] };
      const validIssues = issues.filter((i) => !i.pull_request);
      const issuesById = new Map(validIssues.map((i) => [i.id, i]));
      const placed = new Set<number>();

      if (savedState?.columns?.length) {
        savedState.columns.forEach((col) => {
          if (!rollback[col.columnId]) return;
          col.issueIds.forEach((id) => {
            const issue = issuesById.get(id);
            if (issue) { rollback[col.columnId].push(issue); placed.add(id); }
          });
        });
      }
      validIssues.forEach((issue) => {
        if (!placed.has(issue.id)) rollback[getDefaultColumnForIssue(issue)].push(issue);
      });
      setColumns(rollback);
      setPendingMove(null);
    }
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 h-full w-full overflow-x-auto pb-4">
          {COLUMNS.map((col) => (
            <Column
              key={col.id}
              id={col.id}
              title={col.title}
              label={col.label}
              icon={col.icon}
              accent={col.accent}
              issues={columns[col.id] || []}
            />
          ))}
        </div>

        <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
          {activeIssue ? <IssueCard issue={activeIssue} isOverlay /> : null}
        </DragOverlay>
      </DndContext>

      <PermissionDialog
        open={showPermDialog}
        owner={owner}
        repo={repo}
        fromCol={pendingMove?.fromCol ?? ''}
        toCol={pendingMove?.toCol ?? ''}
        onConfirm={handlePermissionConfirmed}
        onCancel={handlePermissionCancelled}
      />
    </>
  );
}
