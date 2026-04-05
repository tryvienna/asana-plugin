/**
 * AsanaFeed — Feed canvas component for the Asana plugin.
 *
 * Renders a card with filtered Asana tasks on the home feed.
 * Tasks can be selected and launched as agent workstreams.
 *
 * Query strategy:
 * - Specific project + section → section query
 * - Specific project → project query
 * - All projects → assignee query (workspace-wide, always "my tasks")
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import type { FeedCanvasProps } from '@tryvienna/sdk';
import { usePluginClient, usePluginQuery } from '@tryvienna/sdk/react';
import {
  GET_PROJECTS,
  CREATE_WORKSTREAM,
  SEND_WORKSTREAM_MESSAGE,
} from '@tryvienna/sdk/graphql';
import type {
  GetProjectsResult,
  CreateWorkstreamResult,
  CreateWorkstreamVariables,
  SendWorkstreamMessageResult,
  SendWorkstreamMessageVariables,
} from '@tryvienna/sdk/graphql';
import {
  Checkbox,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  Button,
} from '@tryvienna/ui';
import { Check, ChevronDown, ChevronUp, Loader2, Settings, Zap } from 'lucide-react';
import {
  GET_ASANA_FEED_TASKS,
  GET_ASANA_FEED_TASKS_FOR_ASSIGNEE,
  GET_ASANA_FEED_TASKS_FOR_SECTION,
  GET_ASANA_ME,
  GET_ASANA_PROJECTS,
  GET_ASANA_SECTIONS,
  GET_ASANA_WORKSPACES,
  LINK_WORKSTREAM_ENTITY,
} from '../client/operations';
import { useAsanaFeedSettings } from './useAsanaFeedSettings';
import { useAsanaSettings } from './useAsanaSettings';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ASANA_LOGO_PATH =
  'M110.73 34.0139C110.73 52.5445 95.7048 67.581 77.1742 67.581C58.6319 67.581 43.607 52.5562 43.607 34.0139C43.607 15.4716 58.6319 0.446716 77.1742 0.446716C95.7048 0.446716 110.73 15.4716 110.73 34.0139ZM33.5671 75.967C15.0365 75.967 0 90.9919 0 109.523C0 128.053 15.0248 143.09 33.5671 143.09C52.1094 143.09 67.1343 128.065 67.1343 109.523C67.1343 90.9919 52.1094 75.967 33.5671 75.967ZM120.77 75.967C102.227 75.967 87.2024 90.9919 87.2024 109.534C87.2024 128.076 102.227 143.101 120.77 143.101C139.3 143.101 154.337 128.076 154.337 109.534C154.337 90.9919 139.312 75.967 120.77 75.967Z';

const COLLAPSED_LIMIT = 5;
const FETCH_LIMIT = 50;

const DUE_DATE_OPTIONS = [
  { value: 'all', label: 'Any date' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'due_this_week', label: 'This week' },
  { value: 'due_next_week', label: 'Next week' },
  { value: 'no_due_date', label: 'No date' },
] as const;

const SORT_OPTIONS = [
  { value: 'modified', label: 'Modified' },
  { value: 'created', label: 'Created' },
  { value: 'due_date', label: 'Due date' },
] as const;

const COMPLETION_OPTIONS = [
  { value: 'incomplete', label: 'Incomplete' },
  { value: 'completed', label: 'Completed' },
  { value: 'all', label: 'All' },
] as const;

type LaunchPhase = 'idle' | 'creating' | 'messaging' | 'success';

const MAX_BRANCH_LENGTH = 50;

function toBranchName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug.length > MAX_BRANCH_LENGTH
    ? slug.slice(0, MAX_BRANCH_LENGTH).replace(/-$/, '')
    : slug;
}

// ─────────────────────────────────────────────────────────────────────────────
// Due date helpers
// ─────────────────────────────────────────────────────────────────────────────

function getDueDateColor(dueOn: string | undefined | null): string | undefined {
  if (!dueOn) return undefined;
  const due = new Date(dueOn + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (due < today) return 'text-red-500';
  const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 2) return 'text-amber-500';
  return 'text-muted-foreground';
}

function formatDueDate(dueOn: string | undefined | null): string {
  if (!dueOn) return '';
  const due = new Date(dueOn + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays <= 7) return `${diffDays}d`;
  return dueOn;
}

function matchesDueDateFilter(
  dueOn: string | undefined | null,
  filter: string,
): boolean {
  if (filter === 'all') return true;
  if (filter === 'no_due_date') return !dueOn;
  if (!dueOn) return false;
  const due = new Date(dueOn + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  switch (filter) {
    case 'overdue':
      return due < today;
    case 'due_this_week': {
      const endOfWeek = new Date(today);
      endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
      return due >= today && due <= endOfWeek;
    }
    case 'due_next_week': {
      const startNextWeek = new Date(today);
      startNextWeek.setDate(startNextWeek.getDate() + (7 - startNextWeek.getDay()) + 1);
      const endNextWeek = new Date(startNextWeek);
      endNextWeek.setDate(endNextWeek.getDate() + 6);
      return due >= startNextWeek && due <= endNextWeek;
    }
    default:
      return true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Micro-animation styles
// ─────────────────────────────────────────────────────────────────────────────

const ANIM_STYLE = `
@keyframes feed-cta-enter {
  0% { opacity: 0; transform: translateY(8px) scale(0.97); }
  60% { opacity: 1; transform: translateY(-2px) scale(1.01); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
}
@keyframes feed-cta-count {
  0% { transform: scale(1); }
  40% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
@keyframes feed-success-check {
  0% { transform: scale(0) rotate(-45deg); opacity: 0; }
  50% { transform: scale(1.2) rotate(0deg); opacity: 1; }
  100% { transform: scale(1) rotate(0deg); opacity: 1; }
}
.feed-cta-enter { animation: feed-cta-enter 0.25s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
.feed-cta-count { animation: feed-cta-count 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
.feed-success-check { animation: feed-success-check 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
`;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface AsanaFeedTask {
  gid: string;
  name: string;
  completed: boolean;
  assigneeName?: string;
  dueOn?: string;
  sectionName?: string;
  permalink?: string;
  createdAt?: string;
  modifiedAt?: string;
  projects?: { gid: string; name: string }[];
  tags?: { gid: string; name: string; color: string | null }[];
}

interface AsanaSection {
  gid: string;
  name: string;
  projectGid: string;
}

interface AsanaProject {
  gid: string;
  name: string;
  archived: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function AsanaLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 155 144"
      className={className}
      fill="#FF584A"
    >
      <path d={ASANA_LOGO_PATH} />
    </svg>
  );
}

function TaskRow({
  task,
  selected,
  onToggle,
  onNavigate,
}: {
  task: AsanaFeedTask;
  selected: boolean;
  onToggle: () => void;
  onNavigate?: (uri: string) => void;
}) {
  const dueDateStr = formatDueDate(task.dueOn);
  const dueDateColor = getDueDateColor(task.dueOn);

  return (
    <div
      className={`flex w-full items-center gap-2 px-4 py-2 transition-colors ${
        selected ? 'bg-primary/[0.04]' : ''
      }`}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={onToggle}
        className="shrink-0"
      />
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm hover:underline"
        onClick={() => onNavigate?.(`@vienna//asana_task/${task.gid}`)}
      >
        <span className="min-w-0 flex-1 truncate">{task.name || '(No title)'}</span>
      </button>
      {task.sectionName && (
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {task.sectionName}
        </span>
      )}
      {dueDateStr && (
        <span className={`shrink-0 text-[10px] font-medium ${dueDateColor ?? ''}`}>
          {dueDateStr}
        </span>
      )}
      {task.assigneeName && (
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {task.assigneeName.split(' ')[0]}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CTA Button content by phase
// ─────────────────────────────────────────────────────────────────────────────

function LaunchButtonContent({
  phase,
  count,
  countKey,
}: {
  phase: LaunchPhase;
  count: number;
  countKey: number;
}) {
  switch (phase) {
    case 'creating':
      return (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Launching agents...</span>
        </>
      );
    case 'messaging':
      return (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Messaging agents...</span>
        </>
      );
    case 'success':
      return (
        <>
          <Check className="feed-success-check h-4 w-4" />
          <span>Launched</span>
        </>
      );
    case 'idle':
    default:
      return (
        <>
          <Zap className="h-3.5 w-3.5" />
          <span>Launch agents</span>
          <span
            key={countKey}
            className="feed-cta-count inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-foreground/20 px-1.5 text-xs font-semibold"
          >
            {count}
          </span>
        </>
      );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function AsanaFeed({ hostApi, onNavigate }: FeedCanvasProps) {
  const client = usePluginClient();
  const { settings: navSettings } = useAsanaSettings();
  const { settings, updateSettings } = useAsanaFeedSettings();
  const [expanded, setExpanded] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [countKey, setCountKey] = useState(0);
  const [launchPhase, setLaunchPhase] = useState<LaunchPhase>('idle');

  // Track auth status
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const keys = await hostApi.getCredentialStatus('asana');
        if (cancelled) return;
        setIsAuthenticated(keys.some((k) => k.isSet));
      } catch {
        setIsAuthenticated(false);
      }
    };
    check();
    const handler = () => { check(); };
    window.addEventListener('vienna-plugin:asana:settings-changed', handler);
    return () => { cancelled = true; window.removeEventListener('vienna-plugin:asana:settings-changed', handler); };
  }, [hostApi]);

  const workspaceGid = navSettings.workspaceGid;

  // Resolve effective workspace GID (needed for "All projects" assignee query)
  const { data: wsData } = usePluginQuery<{ asanaWorkspaces: { gid: string }[] }>(
    GET_ASANA_WORKSPACES,
    { skip: workspaceGid !== 'all' },
  );
  const effectiveWorkspaceGid =
    workspaceGid !== 'all' ? workspaceGid : wsData?.asanaWorkspaces?.[0]?.gid;

  // Load projects for the project filter dropdown
  const { data: projectsData } = usePluginQuery<{ asanaProjects: AsanaProject[] }>(
    GET_ASANA_PROJECTS,
    {
      variables: { workspaceGid: effectiveWorkspaceGid ?? '' },
      skip: !effectiveWorkspaceGid,
    },
  );
  const projects = (projectsData?.asanaProjects ?? []).filter((p) => !p.archived);

  // Determine query path
  const effectiveProjectGid = settings.projectGid !== 'all' ? settings.projectGid : undefined;
  const useSectionQuery = !!effectiveProjectGid && settings.sectionGid !== 'all';
  const useAssigneeQuery = !effectiveProjectGid && !useSectionQuery;
  const useProjectQuery = !!effectiveProjectGid && !useSectionQuery;

  // Load sections (only when a project is selected)
  const { data: sectionsData } = usePluginQuery<{ asanaSections: AsanaSection[] }>(
    GET_ASANA_SECTIONS,
    {
      variables: { projectGid: effectiveProjectGid ?? '' },
      skip: !effectiveProjectGid,
    },
  );
  const sections = sectionsData?.asanaSections ?? [];

  const completedSince = settings.completionStatus === 'incomplete' ? 'now' : undefined;

  // Query: tasks assigned to me (workspace-wide — the "All projects" path)
  const { data: assigneeData, loading: assigneeLoading } = usePluginQuery<{
    asanaTasksForAssignee: AsanaFeedTask[];
  }>(GET_ASANA_FEED_TASKS_FOR_ASSIGNEE, {
    variables: {
      workspaceGid: effectiveWorkspaceGid ?? '',
      assigneeGid: 'me',
      completedSince,
      limit: FETCH_LIMIT,
    },
    skip: !useAssigneeQuery || !effectiveWorkspaceGid,
    fetchPolicy: 'cache-and-network',
  });

  // Query: tasks for a project
  const { data: projectTasksData, loading: projectLoading } = usePluginQuery<{
    asanaTasks: AsanaFeedTask[];
  }>(GET_ASANA_FEED_TASKS, {
    variables: {
      projectGid: effectiveProjectGid ?? '',
      completedSince,
      limit: FETCH_LIMIT,
    },
    skip: !useProjectQuery,
    fetchPolicy: 'cache-and-network',
  });

  // Query: tasks for a section
  const { data: sectionTasksData, loading: sectionLoading } = usePluginQuery<{
    asanaTasksForSection: AsanaFeedTask[];
  }>(GET_ASANA_FEED_TASKS_FOR_SECTION, {
    variables: {
      sectionGid: settings.sectionGid,
      completedSince,
      limit: FETCH_LIMIT,
    },
    skip: !useSectionQuery,
    fetchPolicy: 'cache-and-network',
  });

  const tasks = useSectionQuery
    ? (sectionTasksData?.asanaTasksForSection ?? [])
    : useAssigneeQuery
      ? (assigneeData?.asanaTasksForAssignee ?? [])
      : (projectTasksData?.asanaTasks ?? []);
  const loading = useSectionQuery
    ? sectionLoading
    : useAssigneeQuery
      ? assigneeLoading
      : projectLoading;

  // Client-side filters + sort
  const filteredAndSorted = useMemo(() => {
    let result = tasks;

    // Due date filter
    result = result.filter((t) => matchesDueDateFilter(t.dueOn, settings.dueDate));

    // Completion filter (for non-incomplete queries that fetch all)
    if (settings.completionStatus === 'completed') {
      result = result.filter((t) => t.completed);
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (settings.sortBy) {
        case 'due_date':
          if (!a.dueOn && !b.dueOn) return 0;
          if (!a.dueOn) return 1;
          if (!b.dueOn) return -1;
          return a.dueOn.localeCompare(b.dueOn);
        case 'created':
          return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
        case 'modified':
        default:
          return (b.modifiedAt ?? '').localeCompare(a.modifiedAt ?? '');
      }
    });

    return result;
  }, [tasks, settings.dueDate, settings.sortBy, settings.completionStatus]);

  const displayedTasks = expanded
    ? filteredAndSorted
    : filteredAndSorted.slice(0, COLLAPSED_LIMIT);
  const remaining = filteredAndSorted.length - COLLAPSED_LIMIT;

  const toggleExpanded = useCallback(() => setExpanded((v) => !v), []);

  const toggleSelection = useCallback((gid: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(gid)) {
        next.delete(gid);
      } else {
        next.add(gid);
      }
      return next;
    });
    setCountKey((k) => k + 1);
  }, []);

  const tick = useCallback(() => new Promise<void>((r) => setTimeout(r, 50)), []);

  const handleLaunchAgents = useCallback(async () => {
    if (launchPhase !== 'idle' || selectedIds.size === 0) return;

    try {
      const selectedTasks = filteredAndSorted.filter((t) => selectedIds.has(t.gid));

      setLaunchPhase('creating');
      await tick();

      const { data: projectsData } = await client.query<GetProjectsResult>({
        query: GET_PROJECTS,
      });
      const viennaProjectId = projectsData?.projects?.[0]?.id;
      if (!viennaProjectId) {
        console.warn('[AsanaFeed] No Vienna project found');
        setLaunchPhase('idle');
        return;
      }

      const workstreamIds: string[] = [];

      for (const task of selectedTasks) {
        const { data: wsResult } = await client.mutate<
          CreateWorkstreamResult,
          CreateWorkstreamVariables
        >({
          mutation: CREATE_WORKSTREAM,
          variables: {
            input: {
              projectId: viennaProjectId,
              title: task.name,
              groupName: 'Asana Tasks',
              createWorktrees: true,
              branchName: toBranchName(task.name),
            },
          },
        });

        const ws = wsResult?.createWorkstream?.workstream;
        if (!ws) continue;

        await client.mutate({
          mutation: LINK_WORKSTREAM_ENTITY,
          variables: {
            workstreamId: ws.id,
            entityUri: `@vienna//asana_task/${task.gid}`,
            entityType: 'asana_task',
            entityTitle: task.name,
          },
        });

        workstreamIds.push(ws.id);
      }

      setLaunchPhase('messaging');
      await tick();

      for (const wsId of workstreamIds) {
        await client.mutate<
          SendWorkstreamMessageResult,
          SendWorkstreamMessageVariables
        >({
          mutation: SEND_WORKSTREAM_MESSAGE,
          variables: {
            workstreamId: wsId,
            text: 'Work on this asana task',
          },
        });
      }

      setLaunchPhase('success');
      setSelectedIds(new Set());
      await tick();

      setTimeout(() => setLaunchPhase('idle'), 2500);
    } catch (err) {
      console.error('[AsanaFeed] Failed to launch agents:', err);
      setLaunchPhase('idle');
    }
  }, [launchPhase, selectedIds, filteredAndSorted, client, tick]);

  const selectionCount = selectedIds.size;
  const showCta = selectionCount > 0 || launchPhase !== 'idle';

  // Dropdown labels
  const projectLabel =
    settings.projectGid === 'all'
      ? 'My tasks'
      : projects.find((p) => p.gid === settings.projectGid)?.name ?? 'Project';
  const sectionLabel =
    settings.sectionGid === 'all'
      ? 'All sections'
      : sections.find((s) => s.gid === settings.sectionGid)?.name ?? 'Section';

  // Not configured — show setup prompt
  if (isAuthenticated === false) {
    return (
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:bg-surface-interactive">
        <div className="flex items-center gap-2 px-4 py-3">
          <AsanaLogo className="h-4 w-4" />
          <span className="text-sm font-medium">Asana</span>
        </div>
        <div className="border-t border-border px-4 py-6 text-center">
          <Settings className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Connect your Asana account to see tasks here.
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Open Asana settings in the sidebar to add your API token.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:bg-surface-interactive">
      <style dangerouslySetInnerHTML={{ __html: ANIM_STYLE }} />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <AsanaLogo className="h-4 w-4" />
          <span className="text-sm font-medium">Asana</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs font-normal text-muted-foreground">
              {SORT_OPTIONS.find((o) => o.value === settings.sortBy)?.label ?? 'Sort'}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={settings.sortBy}
              onValueChange={(v) => updateSettings({ sortBy: v as 'modified' | 'created' | 'due_date' })}
            >
              {SORT_OPTIONS.map((opt) => (
                <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                  {opt.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-2">
        {/* Project filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 max-w-[140px] px-2 text-xs gap-1">
              <span className="truncate">{projectLabel}</span>
              <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-64 overflow-y-auto">
            <DropdownMenuRadioGroup
              value={settings.projectGid}
              onValueChange={(v) => updateSettings({ projectGid: v, sectionGid: 'all' })}
            >
              <DropdownMenuRadioItem value="all">My tasks</DropdownMenuRadioItem>
              {projects.map((p) => (
                <DropdownMenuRadioItem key={p.gid} value={p.gid}>
                  {p.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Completion filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1">
              {COMPLETION_OPTIONS.find((o) => o.value === settings.completionStatus)?.label ?? 'Status'}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup
              value={settings.completionStatus}
              onValueChange={(v) => updateSettings({ completionStatus: v as 'incomplete' | 'completed' | 'all' })}
            >
              {COMPLETION_OPTIONS.map((opt) => (
                <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                  {opt.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Due date filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1">
              {DUE_DATE_OPTIONS.find((o) => o.value === settings.dueDate)?.label ?? 'Due date'}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuRadioGroup
              value={settings.dueDate}
              onValueChange={(v) => updateSettings({ dueDate: v as typeof settings.dueDate })}
            >
              {DUE_DATE_OPTIONS.map((opt) => (
                <DropdownMenuRadioItem key={opt.value} value={opt.value}>
                  {opt.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Section filter (only when project selected) */}
        {sections.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1">
                {sectionLabel}
                <ChevronDown className="h-3 w-3 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuRadioGroup
                value={settings.sectionGid}
                onValueChange={(v) => updateSettings({ sectionGid: v })}
              >
                <DropdownMenuRadioItem value="all">All sections</DropdownMenuRadioItem>
                {sections.map((s) => (
                  <DropdownMenuRadioItem key={s.gid} value={s.gid}>
                    {s.name}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Task list */}
      <div className="border-t border-border">
        {loading && tasks.length === 0 ? (
          <div className="px-4 py-3">
            <p className="text-xs text-muted-foreground">Loading...</p>
          </div>
        ) : filteredAndSorted.length === 0 ? (
          <div className="px-4 py-3">
            <p className="text-xs text-muted-foreground">No tasks found</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {displayedTasks.map((task) => (
              <TaskRow
                key={task.gid}
                task={task}
                selected={selectedIds.has(task.gid)}
                onToggle={() => toggleSelection(task.gid)}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>

      {/* View more / Show less */}
      {filteredAndSorted.length > COLLAPSED_LIMIT && (
        <button
          type="button"
          className="flex w-full items-center justify-center gap-1 border-t border-border px-4 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/50"
          onClick={toggleExpanded}
        >
          {expanded ? (
            <>
              Show less <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              View more ({remaining}) <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>
      )}

      {/* Selection CTA */}
      {showCta && (
        <div className="feed-cta-enter border-t border-border bg-primary/[0.06] px-4 py-2.5">
          <button
            type="button"
            disabled={launchPhase !== 'idle'}
            className={`flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium shadow-sm transition-all active:scale-[0.98] disabled:cursor-not-allowed ${
              launchPhase === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
            onClick={handleLaunchAgents}
          >
            <LaunchButtonContent
              phase={launchPhase}
              count={selectionCount}
              countKey={countKey}
            />
          </button>
        </div>
      )}
    </div>
  );
}
