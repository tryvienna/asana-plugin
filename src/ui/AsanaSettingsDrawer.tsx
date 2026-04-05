/**
 * AsanaSettingsDrawer — Settings panel for the Asana plugin.
 *
 * Combines credential management + workspace/project/section/assignee/completion filters.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePluginQuery } from '@tryvienna/sdk/react';
import {
  ContentSection,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Button,
  Input,
  Label,
} from '@tryvienna/ui';
import type { PluginHostApi, CanvasLogger } from '@tryvienna/sdk';
import { KeyRound, Check, Trash2, Eye, EyeOff, X } from 'lucide-react';
import { useAsanaSettings, type AsanaSettings } from './useAsanaSettings';
import {
  GET_ASANA_WORKSPACES,
  GET_ASANA_PROJECTS,
  GET_ASANA_SECTIONS,
} from '../client/operations';

// ─────────────────────────────────────────────────────────────────────────────
// Credential Field (reusable)
// ─────────────────────────────────────────────────────────────────────────────

function CredentialField({
  integrationId,
  credentialKey,
  isSet,
  hostApi,
  onUpdate,
}: {
  integrationId: string;
  credentialKey: string;
  isSet: boolean;
  hostApi: PluginHostApi;
  onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [showValue, setShowValue] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await hostApi.setCredential(integrationId, credentialKey, value.trim());
      setValue('');
      setEditing(false);
      onUpdate();
    } finally {
      setSaving(false);
    }
  }, [integrationId, credentialKey, value, hostApi, onUpdate]);

  const handleRemove = useCallback(async () => {
    setSaving(true);
    try {
      await hostApi.removeCredential(integrationId, credentialKey);
      onUpdate();
    } finally {
      setSaving(false);
    }
  }, [integrationId, credentialKey, hostApi, onUpdate]);

  const handleCancel = useCallback(() => {
    setEditing(false);
    setValue('');
  }, []);

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound size={14} className="text-muted-foreground" />
          <Label className="text-xs font-medium">API Token</Label>
        </div>
        <div className="flex items-center gap-1">
          {isSet && !editing && (
            <>
              <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">
                <Check size={10} />
                Set
              </span>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setEditing(true)}>
                <Eye size={12} />
              </Button>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={handleRemove} disabled={saving}>
                <Trash2 size={12} />
              </Button>
            </>
          )}
          {!isSet && !editing && (
            <Button variant="outline" size="sm" className="h-6 text-xs" onClick={() => setEditing(true)}>
              Configure
            </Button>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-2 flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              type={!showValue ? 'password' : 'text'}
              value={value}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
              placeholder={isSet ? 'Enter new token to replace' : 'Paste your Asana PAT'}
              className="h-7 pr-8 text-xs"
              autoFocus
              onKeyDown={(e: React.KeyboardEvent) => {
                if (e.key === 'Enter') handleSave();
                if (e.key === 'Escape') handleCancel();
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 p-0"
              onClick={() => setShowValue(!showValue)}
            >
              {showValue ? <EyeOff size={12} /> : <Eye size={12} />}
            </Button>
          </div>
          <Button variant="default" size="sm" className="h-7 text-xs" onClick={handleSave} disabled={!value.trim() || saving}>
            Save
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCancel}>
            <X size={14} />
          </Button>
        </div>
      )}

      {!isSet && !editing && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          Generate a token at app.asana.com → My Settings → Apps → Developer Apps
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ASSIGNMENT_OPTIONS: { value: AsanaSettings['assignment']; label: string }[] = [
  { value: 'all', label: 'All tasks' },
  { value: 'assigned_to_me', label: 'Assigned to me' },
];

const COMPLETION_OPTIONS: { value: AsanaSettings['completionStatus']; label: string }[] = [
  { value: 'incomplete', label: 'Incomplete only' },
  { value: 'completed', label: 'Completed only' },
  { value: 'all', label: 'All tasks' },
];

const DUE_DATE_OPTIONS: { value: AsanaSettings['dueDate']; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'due_this_week', label: 'Due this week' },
  { value: 'due_next_week', label: 'Due next week' },
  { value: 'no_due_date', label: 'No due date' },
];

const GROUP_BY_OPTIONS: { value: AsanaSettings['groupBy']; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'project', label: 'Project' },
  { value: 'section', label: 'Section' },
  { value: 'assignee', label: 'Assignee' },
  { value: 'due_date', label: 'Due Date' },
];

const LIMIT_OPTIONS = [10, 20, 50, 100];

// ─────────────────────────────────────────────────────────────────────────────
// Settings Drawer
// ─────────────────────────────────────────────────────────────────────────────

export function AsanaSettingsDrawer({
  hostApi,
  logger,
}: {
  hostApi: PluginHostApi;
  logger: CanvasLogger;
}) {
  const { settings, updateSettings, resetSettings } = useAsanaSettings();

  // ── Credential status ──────────────────────────────────────────────────
  const [credentials, setCredentials] = useState<Array<{ key: string; isSet: boolean }>>([]);
  const [credLoading, setCredLoading] = useState(true);

  const fetchCredentials = useCallback(async () => {
    try {
      const keys = await hostApi.getCredentialStatus('asana');
      setCredentials(keys);
      window.dispatchEvent(new CustomEvent('vienna-plugin:asana:settings-changed'));
    } catch (err) {
      logger.warn('Failed to fetch credential status', { error: String(err) });
    } finally {
      setCredLoading(false);
    }
  }, [hostApi, logger]);

  useEffect(() => { fetchCredentials(); }, [fetchCredentials]);

  const apiTokenCred = useMemo(
    () => credentials.find((k) => k.key === 'api_token'),
    [credentials],
  );

  // ── Workspaces query ─────────────────────────────────────────────────────
  const { data: workspacesData } = usePluginQuery<{
    asanaWorkspaces: Array<{ gid: string; name: string; isOrganization: boolean }>;
  }>(GET_ASANA_WORKSPACES, {
    skip: credLoading || !apiTokenCred?.isSet,
    fetchPolicy: 'cache-and-network',
  });
  const workspaces = workspacesData?.asanaWorkspaces ?? [];

  // Auto-select first workspace if only one
  useEffect(() => {
    if (workspaces.length === 1 && settings.workspaceGid === 'all') {
      updateSettings({ workspaceGid: workspaces[0].gid });
    }
  }, [workspaces, settings.workspaceGid, updateSettings]);

  // ── Projects query ──────────────────────────────────────────────────────
  const effectiveWorkspaceGid = settings.workspaceGid !== 'all'
    ? settings.workspaceGid
    : workspaces[0]?.gid;

  const { data: projectsData } = usePluginQuery<{
    asanaProjects: Array<{ gid: string; name: string; color: string | null; archived: boolean }>;
  }>(GET_ASANA_PROJECTS, {
    variables: { workspaceGid: effectiveWorkspaceGid },
    skip: !effectiveWorkspaceGid,
    fetchPolicy: 'cache-and-network',
  });
  const projects = projectsData?.asanaProjects ?? [];

  // ── Sections query ──────────────────────────────────────────────────────
  const { data: sectionsData } = usePluginQuery<{
    asanaSections: Array<{ gid: string; name: string; projectGid: string }>;
  }>(GET_ASANA_SECTIONS, {
    variables: { projectGid: settings.projectGid },
    skip: settings.projectGid === 'all',
    fetchPolicy: 'cache-and-network',
  });
  const sections = sectionsData?.asanaSections ?? [];

  return (
    <div className="space-y-4">
      {/* Authentication */}
      <ContentSection title="Authentication">
        <CredentialField
          integrationId="asana"
          credentialKey="api_token"
          isSet={apiTokenCred?.isSet ?? false}
          hostApi={hostApi}
          onUpdate={fetchCredentials}
        />
      </ContentSection>

      {/* Workspace */}
      {workspaces.length > 1 && (
        <ContentSection title="Workspace">
          <Select
            value={settings.workspaceGid}
            onValueChange={(value) => updateSettings({ workspaceGid: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All workspaces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All workspaces</SelectItem>
              {workspaces.map((ws) => (
                <SelectItem key={ws.gid} value={ws.gid}>
                  {ws.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ContentSection>
      )}

      {/* Project */}
      <ContentSection title="Project">
        <Select
          value={settings.projectGid}
          onValueChange={(value) => updateSettings({ projectGid: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects (requires filter)</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.gid} value={p.gid}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ContentSection>

      {/* Section (only shown when a project is selected) */}
      {settings.projectGid !== 'all' && sections.length > 0 && (
        <ContentSection title="Section">
          <Select
            value={settings.sectionGid}
            onValueChange={(value) => updateSettings({ sectionGid: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All sections" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sections</SelectItem>
              {sections.map((s) => (
                <SelectItem key={s.gid} value={s.gid}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ContentSection>
      )}

      {/* Assignment Filter */}
      <ContentSection title="Assignment">
        <div className="flex flex-col gap-1">
          {ASSIGNMENT_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={settings.assignment === opt.value ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => updateSettings({ assignment: opt.value })}
              className="justify-start"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </ContentSection>

      {/* Completion Status */}
      <ContentSection title="Status">
        <div className="flex flex-col gap-1">
          {COMPLETION_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={settings.completionStatus === opt.value ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => updateSettings({ completionStatus: opt.value })}
              className="justify-start"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </ContentSection>

      {/* Due Date Filter */}
      <ContentSection title="Due date">
        <Select
          value={settings.dueDate}
          onValueChange={(value) => updateSettings({ dueDate: value as AsanaSettings['dueDate'] })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DUE_DATE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ContentSection>

      {/* Group By */}
      <ContentSection title="Group by">
        <div className="flex flex-wrap gap-1">
          {GROUP_BY_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={settings.groupBy === opt.value ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => updateSettings({ groupBy: opt.value })}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </ContentSection>

      {/* Task Limit */}
      <ContentSection title="Task limit">
        <Select
          value={String(settings.limit)}
          onValueChange={(value) => updateSettings({ limit: Number(value) })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LIMIT_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} tasks
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </ContentSection>

      {/* Reset */}
      <ContentSection>
        <Button variant="outline" size="sm" onClick={resetSettings} className="w-full">
          Reset to defaults
        </Button>
        <p className="text-[11px] text-muted-foreground mt-2 text-center">
          Settings are saved automatically
        </p>
      </ContentSection>
    </div>
  );
}
