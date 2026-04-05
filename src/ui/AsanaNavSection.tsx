/**
 * AsanaNavSection — Nav sidebar canvas for the Asana plugin.
 *
 * Shows a list of Asana tasks with filtering and grouping.
 * When no project is selected, shows "my tasks" via the assignee query.
 * Settings button opens the AsanaSettingsDrawer.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePluginQuery } from '@tryvienna/sdk/react';
import {
  NavSection,
  NavItem,
  NavSettingsButton,
  NavHeaderActions,
} from '@tryvienna/ui';
import type { NavSidebarCanvasProps } from '@tryvienna/sdk';
import { Settings, CheckCircle2, Circle } from 'lucide-react';
import { useAsanaSettings } from './useAsanaSettings';
import {
  GET_ASANA_TASKS,
  GET_ASANA_TASKS_FOR_ASSIGNEE,
  GET_ASANA_TASKS_FOR_SECTION,
  GET_ASANA_WORKSPACES,
} from '../client/operations';

// ─────────────────────────────────────────────────────────────────────────────
// Logo
// ─────────────────────────────────────────────────────────────────────────────

const ASANA_LOGO_PATH =
  'M110.73 34.0139C110.73 52.5445 95.7048 67.581 77.1742 67.581C58.6319 67.581 43.607 52.5562 43.607 34.0139C43.607 15.4716 58.6319 0.446716 77.1742 0.446716C95.7048 0.446716 110.73 15.4716 110.73 34.0139ZM33.5671 75.967C15.0365 75.967 0 90.9919 0 109.523C0 128.053 15.0248 143.09 33.5671 143.09C52.1094 143.09 67.1343 128.065 67.1343 109.523C67.1343 90.9919 52.1094 75.967 33.5671 75.967ZM120.77 75.967C102.227 75.967 87.2024 90.9919 87.2024 109.534C87.2024 128.076 102.227 143.101 120.77 143.101C139.3 143.101 154.337 128.076 154.337 109.534C154.337 90.9919 139.312 75.967 120.77 75.967Z';

function AsanaNavLogo({ size = 12 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 155 144"
      fill="#FF584A"
      width={size}
      height={size}
    >
      <path d={ASANA_LOGO_PATH} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Types & helpers
// ─────────────────────────────────────────────────────────────────────────────

interface AsanaTaskNav {
  gid: string;
  name: string;
  completed: boolean;
  assigneeName?: string;
  dueOn?: string;
  sectionName?: string;
  permalink?: string;
  projects?: Array<{ gid: string; name: string }>;
  tags?: Array<{ gid: string; name: string; color: string | null }>;
}

function getDueDateColor(dueOn: string | undefined | null): string | undefined {
  if (!dueOn) return undefined;
  const due = new Date(dueOn + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (due < today) return 'var(--status-error)';
  const diffDays = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 2) return 'var(--status-warning)';
  return undefined;
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

function groupTasks(tasks: AsanaTaskNav[], groupBy: string): Map<string, AsanaTaskNav[]> {
  const groups = new Map<string, AsanaTaskNav[]>();
  for (const task of tasks) {
    let key: string;
    switch (groupBy) {
      case 'project':
        key = task.projects?.[0]?.name || 'No Project';
        break;
      case 'section':
        key = task.sectionName || 'No Section';
        break;
      case 'assignee':
        key = task.assigneeName || 'Unassigned';
        break;
      case 'due_date': {
        if (!task.dueOn) {
          key = 'No Due Date';
        } else {
          const due = new Date(task.dueOn + 'T00:00:00');
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const diff = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diff < 0) key = 'Overdue';
          else if (diff === 0) key = 'Today';
          else if (diff <= 7) key = 'This Week';
          else key = 'Later';
        }
        break;
      }
      default:
        key = '';
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(task);
  }
  return groups;
}

/** Compute the `completedSince` arg based on settings. */
function getCompletedSince(completionStatus: string): string | undefined {
  if (completionStatus === 'incomplete') return 'now';
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function TaskNavItem({ task, onSelect }: { task: AsanaTaskNav; onSelect: () => void }) {
  const dueDateColor = getDueDateColor(task.dueOn);
  const dueDateStr = formatDueDate(task.dueOn);

  return (
    <NavItem
      item={{
        id: task.gid,
        label: task.name || '(No title)',
        variant: 'item' as const,
        icon: task.completed
          ? <CheckCircle2 size={14} style={{ color: 'var(--status-success)' }} />
          : <Circle size={14} style={{ color: 'var(--text-muted)' }} />,
        meta: dueDateStr ? (
          <span style={{
            fontSize: '10px',
            color: dueDateColor || 'var(--text-muted)',
            fontWeight: dueDateColor ? 600 : 400,
          }}>
            {dueDateStr}
          </span>
        ) : undefined,
      }}
      onSelect={onSelect}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function AsanaNavSection({
  pluginId,
  openPluginDrawer,
  openEntityDrawer,
  hostApi,
}: NavSidebarCanvasProps) {
  const { settings } = useAsanaSettings();

  // Track auth status
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const keys = await hostApi.getCredentialStatus('asana');
        if (cancelled) return;
        const hasKey = keys.some((k) => k.isSet);
        setIsAuthenticated(hasKey);
      } catch {
        // ignore
      }
    };
    check();
    const handler = () => { check(); };
    window.addEventListener('vienna-plugin:asana:settings-changed', handler);
    return () => { cancelled = true; window.removeEventListener('vienna-plugin:asana:settings-changed', handler); };
  }, [hostApi]);

  // Determine which query to use based on settings
  const completedSince = getCompletedSince(settings.completionStatus);
  const hasProject = settings.projectGid && settings.projectGid !== 'all';
  const useSectionQuery = hasProject && settings.sectionGid !== 'all';
  const useAssigneeQuery = !hasProject;

  // Resolve effective workspace GID for assignee query
  const { data: wsData } = usePluginQuery<{ asanaWorkspaces: { gid: string }[] }>(
    GET_ASANA_WORKSPACES,
    { skip: !isAuthenticated || !useAssigneeQuery || settings.workspaceGid !== 'all' },
  );
  const effectiveWorkspaceGid =
    settings.workspaceGid !== 'all' ? settings.workspaceGid : wsData?.asanaWorkspaces?.[0]?.gid;

  // Query: tasks assigned to me (workspace-wide — the "All projects" path)
  const { data: assigneeData, loading: assigneeLoading, error: assigneeError } = usePluginQuery<{
    asanaTasksForAssignee: AsanaTaskNav[];
  }>(GET_ASANA_TASKS_FOR_ASSIGNEE, {
    variables: {
      workspaceGid: effectiveWorkspaceGid ?? '',
      assigneeGid: 'me',
      completedSince,
      limit: settings.limit,
    },
    skip: !isAuthenticated || !useAssigneeQuery || !effectiveWorkspaceGid,
    fetchPolicy: 'cache-and-network',
  });

  // Query: tasks for a specific section
  const { data: sectionData, loading: sectionLoading, error: sectionError } = usePluginQuery<{
    asanaTasksForSection: AsanaTaskNav[];
  }>(GET_ASANA_TASKS_FOR_SECTION, {
    variables: {
      sectionGid: settings.sectionGid,
      completedSince,
      limit: settings.limit,
    },
    skip: !isAuthenticated || !useSectionQuery,
    fetchPolicy: 'cache-and-network',
  });

  // Query: tasks for a project (default)
  const useProjectQuery = isAuthenticated && hasProject && !useSectionQuery;
  const { data: projectData, loading: projectLoading, error: projectError } = usePluginQuery<{
    asanaTasks: AsanaTaskNav[];
  }>(GET_ASANA_TASKS, {
    variables: {
      projectGid: settings.projectGid,
      completedSince,
      limit: settings.limit,
    },
    skip: !useProjectQuery,
    fetchPolicy: 'cache-and-network',
  });

  // Resolve active data
  const { tasks, loading, error } = useMemo(() => {
    if (useAssigneeQuery) {
      return {
        tasks: assigneeData?.asanaTasksForAssignee ?? [],
        loading: assigneeLoading,
        error: assigneeError,
      };
    }
    if (useSectionQuery) {
      return {
        tasks: sectionData?.asanaTasksForSection ?? [],
        loading: sectionLoading,
        error: sectionError,
      };
    }
    return {
      tasks: projectData?.asanaTasks ?? [],
      loading: projectLoading,
      error: projectError,
    };
  }, [
    useAssigneeQuery, useSectionQuery,
    assigneeData, assigneeLoading, assigneeError,
    sectionData, sectionLoading, sectionError,
    projectData, projectLoading, projectError,
  ]);

  // Client-side filter: completed only
  const filteredTasks = useMemo(() => {
    if (settings.completionStatus === 'completed') {
      return tasks.filter((t) => t.completed);
    }
    return tasks;
  }, [tasks, settings.completionStatus]);

  // Client-side filter: due date
  const dueDateFilteredTasks = useMemo(() => {
    if (settings.dueDate === 'all') return filteredTasks;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return filteredTasks.filter((t) => {
      if (settings.dueDate === 'no_due_date') return !t.dueOn;
      if (!t.dueOn) return false;
      const due = new Date(t.dueOn + 'T00:00:00');
      switch (settings.dueDate) {
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
    });
  }, [filteredTasks, settings.dueDate]);

  const handleTaskSelect = useCallback((task: AsanaTaskNav) => {
    openEntityDrawer(`@vienna//asana_task/${task.gid}`);
  }, [openEntityDrawer]);

  const sectionLabel = useAssigneeQuery
    ? `My Tasks${dueDateFilteredTasks.length ? ` (${dueDateFilteredTasks.length})` : ''}`
    : `Asana${dueDateFilteredTasks.length ? ` (${dueDateFilteredTasks.length})` : ''}`;

  const sectionDataProp = {
    id: `plugin-${pluginId}-nav`,
    label: sectionLabel,
    icon: <AsanaNavLogo size={12} />,
    items: [],
    isLoading: isAuthenticated && loading && dueDateFilteredTasks.length === 0,
    hoverActions: (
      <NavHeaderActions>
        <NavSettingsButton
          onClick={(e: React.MouseEvent) => {
            e.stopPropagation();
            openPluginDrawer({ view: 'settings' });
          }}
          ariaLabel="Asana settings"
        />
      </NavHeaderActions>
    ),
    emptyState: !isAuthenticated
      ? 'Add an API token in settings to get started'
      : error && dueDateFilteredTasks.length === 0
        ? error.message
        : 'No tasks found',
  };

  // Not configured
  if (!isAuthenticated) {
    return (
      <NavSection section={sectionDataProp} defaultExpanded>
        <NavItem
          item={{
            id: 'setup',
            label: 'Open Settings to configure',
            variant: 'item',
            icon: <Settings size={14} />,
          }}
          onSelect={() => openPluginDrawer({ view: 'settings' })}
        />
      </NavSection>
    );
  }


  // Grouped view
  if (settings.groupBy !== 'none' && dueDateFilteredTasks.length > 0) {
    const groups = groupTasks(dueDateFilteredTasks, settings.groupBy);

    return (
      <NavSection section={sectionDataProp} defaultExpanded>
        {Array.from(groups.entries()).map(([groupName, groupedTasks]) => (
          <div key={groupName}>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '8px 12px 2px',
              }}
            >
              {groupName}
            </div>
            {groupedTasks.map((task) => (
              <TaskNavItem
                key={task.gid}
                task={task}
                onSelect={() => handleTaskSelect(task)}
              />
            ))}
          </div>
        ))}
      </NavSection>
    );
  }

  // Flat view
  return (
    <NavSection section={sectionDataProp} defaultExpanded>
      {dueDateFilteredTasks.map((task) => (
        <TaskNavItem
          key={task.gid}
          task={task}
          onSelect={() => handleTaskSelect(task)}
        />
      ))}
    </NavSection>
  );
}
