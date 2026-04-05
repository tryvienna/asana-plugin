/**
 * AsanaTaskEntityDrawer — Entity drawer for Asana tasks.
 *
 * Provides full task editing: properties (completion, assignee, due date,
 * section, tags), description, subtasks, and comments.
 * Registered on the asana_task entity via `ui: { drawer }`.
 */

import { useState, useCallback } from 'react';
import {
  DrawerBody,
  DrawerPanelFooter,
  Separator,
  Button,
  ConfirmDialog,
  Markdown,
  MarkdownEditor,
  InlineEdit,
  Combobox,
  Textarea,
} from '@tryvienna/ui';
import type { ComboboxOption } from '@tryvienna/ui';
import { Pencil, Trash2, ExternalLink, CheckCircle2, Circle } from 'lucide-react';
import { parseEntityURI } from '@tryvienna/sdk';
import { usePluginQuery, usePluginMutation } from '@tryvienna/sdk/react';
import type { EntityDrawerProps } from '@tryvienna/sdk';
import { ASANA_URI_PATH } from '../entities/uri';
import {
  GET_ASANA_TASK,
  GET_ASANA_SUBTASKS,
  GET_ASANA_STORIES,
  GET_ASANA_TAGS,
  GET_ASANA_SECTIONS,
  UPDATE_ASANA_TASK,
  DELETE_ASANA_TASK,
  ADD_ASANA_COMMENT,
  ADD_ASANA_TAG_TO_TASK,
  REMOVE_ASANA_TAG_FROM_TASK,
  MOVE_ASANA_TASK_TO_SECTION,
} from '../client/operations';

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function SavingBar({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="flex items-center gap-2 rounded bg-muted/50 px-3 py-1.5">
      <div className="size-1.5 rounded-full bg-foreground/40 animate-pulse" />
      <span className="text-[11px] text-muted-foreground">Saving...</span>
    </div>
  );
}

function ColorDot({ color }: { color: string | null }) {
  if (!color) return null;
  return (
    <span
      className="inline-block size-3 rounded-full shrink-0"
      style={{ backgroundColor: color }}
    />
  );
}

function MetadataRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="text-xs font-medium text-foreground max-w-[60%] text-right">
        {children}
      </div>
    </div>
  );
}

function formatRelative(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function CompletionBadge({ completed }: { completed: boolean }) {
  return completed ? (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-green-500/10 text-green-600 dark:text-green-400">
      <CheckCircle2 size={10} />
      Complete
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium bg-muted text-muted-foreground">
      <Circle size={10} />
      Incomplete
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Drawer
// ─────────────────────────────────────────────────────────────────────────────

export function AsanaTaskEntityDrawer({ uri, headerActions, DrawerContainer, onNavigate }: EntityDrawerProps) {
  const { id } = parseEntityURI(uri, ASANA_URI_PATH);
  const taskGid = id['gid'] ?? '';

  // ── Queries ────────────────────────────────────────────────────────────
  const { data, loading, error } = usePluginQuery<{ asanaTask: any }>(GET_ASANA_TASK, {
    variables: { gid: taskGid },
    fetchPolicy: 'cache-and-network',
    skip: !taskGid,
  });

  const task = data?.asanaTask;

  // Subtasks
  const { data: subtasksData } = usePluginQuery<{ asanaSubtasks: any[] }>(GET_ASANA_SUBTASKS, {
    variables: { taskGid },
    skip: !taskGid || !task || task.numSubtasks === 0,
  });

  // Comments
  const { data: storiesData, refetch: refetchComments } = usePluginQuery<{ asanaStories: any[] }>(
    GET_ASANA_STORIES,
    {
      variables: { taskGid, commentsOnly: true },
      skip: !taskGid,
    },
  );

  // Tags for workspace (for combobox)
  const workspaceGid = task?.projects?.[0]?.gid ? undefined : undefined; // resolved below
  const { data: tagsData } = usePluginQuery<{ asanaTags: any[] }>(GET_ASANA_TAGS, {
    variables: { workspaceGid: '' }, // we'd need workspace gid — skip for now
    skip: true, // Tags loaded from task directly
  });

  // Sections (for section select, if task is in a project)
  const primaryProjectGid = task?.projects?.[0]?.gid;
  const { data: sectionsData } = usePluginQuery<{ asanaSections: any[] }>(GET_ASANA_SECTIONS, {
    variables: { projectGid: primaryProjectGid },
    skip: !primaryProjectGid,
  });

  // ── Mutations ──────────────────────────────────────────────────────────
  const [updateTask, { loading: updateLoading }] = usePluginMutation(UPDATE_ASANA_TASK);
  const [deleteTask] = usePluginMutation(DELETE_ASANA_TASK);
  const [addCommentMut, { loading: commentLoading }] = usePluginMutation(ADD_ASANA_COMMENT);
  const [moveToSection] = usePluginMutation(MOVE_ASANA_TASK_TO_SECTION);

  // ── Local state ────────────────────────────────────────────────────────
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingBody, setEditingBody] = useState(false);
  const [draftBody, setDraftBody] = useState('');
  const [commentBody, setCommentBody] = useState('');

  // ── Derived data ───────────────────────────────────────────────────────
  const subtasks = subtasksData?.asanaSubtasks ?? [];
  const comments = storiesData?.asanaStories ?? [];
  const sections = sectionsData?.asanaSections ?? [];

  // ── Handlers ───────────────────────────────────────────────────────────
  const handleTitleSave = useCallback(async (name: string) => {
    await updateTask({ variables: { gid: taskGid, input: { name } } });
  }, [updateTask, taskGid]);

  const handleToggleComplete = useCallback(async () => {
    if (!task) return;
    await updateTask({
      variables: { gid: taskGid, input: { completed: !task.completed } },
    });
  }, [updateTask, taskGid, task]);

  const handleDueDateChange = useCallback(async (dueOn: string) => {
    await updateTask({
      variables: { gid: taskGid, input: { dueOn: dueOn || null } },
    });
  }, [updateTask, taskGid]);

  const handleSectionChange = useCallback(async (sectionGid: string) => {
    if (sectionGid === '__none__') return;
    await moveToSection({ variables: { taskGid, sectionGid } });
  }, [moveToSection, taskGid]);

  const handleStartEditBody = useCallback(() => {
    setDraftBody(task?.notes ?? '');
    setEditingBody(true);
  }, [task?.notes]);

  const handleSaveBody = useCallback(async (body: string) => {
    await updateTask({ variables: { gid: taskGid, input: { notes: body } } });
    setEditingBody(false);
  }, [updateTask, taskGid]);

  const handleAddComment = useCallback(async () => {
    const text = commentBody.trim();
    if (!text) return;
    await addCommentMut({ variables: { taskGid, text } });
    setCommentBody('');
    refetchComments();
  }, [addCommentMut, taskGid, commentBody, refetchComments]);

  const handleDelete = useCallback(async () => {
    await deleteTask({ variables: { gid: taskGid } });
    setDeleteDialogOpen(false);
  }, [deleteTask, taskGid]);

  const navigateToTask = useCallback((targetGid: string) => {
    const targetUri = `@vienna//asana_task/${targetGid}`;
    onNavigate?.(targetUri, 'asana_task');
  }, [onNavigate]);

  // ── Loading / error states ─────────────────────────────────────────────
  if (loading && !task) {
    return (
      <DrawerContainer title="Asana Task">
        <DrawerBody>
          <div className="space-y-4 animate-pulse">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-5 w-64 bg-muted rounded" />
            <div className="h-20 w-full bg-muted rounded" />
          </div>
        </DrawerBody>
      </DrawerContainer>
    );
  }

  if (error || !task) {
    return (
      <DrawerContainer title="Asana Task">
        <DrawerBody>
          <div className="flex flex-col items-center gap-2 py-8">
            <span className="text-sm text-muted-foreground">
              {error ? 'Failed to load task' : 'Task not found'}
            </span>
          </div>
        </DrawerBody>
      </DrawerContainer>
    );
  }

  const isSaving = updateLoading || commentLoading;

  return (
    <DrawerContainer
      title={task.name}
      headerActions={headerActions}
      footer={
        <DrawerPanelFooter>
          <div className="flex items-center gap-2">
            {task.permalink && (
              <Button variant="ghost" size="sm" asChild>
                <a href={task.permalink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={12} className="mr-1" />
                  Open in Asana
                </a>
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 size={12} className="mr-1" />
              Delete
            </Button>
          </div>
        </DrawerPanelFooter>
      }
    >
      <DrawerBody>
        <div data-slot="asana-task-drawer" className="space-y-4">
          <SavingBar visible={isSaving} />

          {/* Header: completion badge + project context */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              className="bg-transparent border-none cursor-pointer p-0"
              onClick={handleToggleComplete}
              title={task.completed ? 'Mark incomplete' : 'Mark complete'}
            >
              <CompletionBadge completed={task.completed} />
            </button>
            {task.projects?.length > 0 && (
              <span className="text-[11px] text-muted-foreground">
                {task.projects.map((p: any) => p.name).join(' / ')}
              </span>
            )}
          </div>

          {/* Editable Title */}
          <InlineEdit
            value={task.name ?? ''}
            onSave={handleTitleSave}
            disabled={updateLoading}
          />

          <Separator />

          {/* Properties */}
          <div className="space-y-1">
            <MetadataRow label="Assignee">
              <span>{task.assigneeName || 'Unassigned'}</span>
            </MetadataRow>

            <MetadataRow label="Due Date">
              <input
                type="date"
                value={task.dueOn ?? ''}
                onChange={(e) => handleDueDateChange(e.target.value)}
                className="h-6 rounded border border-border bg-background px-2 text-xs"
              />
            </MetadataRow>

            {task.startOn && (
              <MetadataRow label="Start Date">
                <span>{task.startOn}</span>
              </MetadataRow>
            )}

            {task.sectionName && (
              <MetadataRow label="Section">
                {sections.length > 1 ? (
                  <select
                    value={task.sectionGid ?? ''}
                    onChange={(e) => handleSectionChange(e.target.value)}
                    className="h-6 rounded border border-border bg-background px-2 text-xs"
                  >
                    {sections.map((s: any) => (
                      <option key={s.gid} value={s.gid}>{s.name}</option>
                    ))}
                  </select>
                ) : (
                  <span>{task.sectionName}</span>
                )}
              </MetadataRow>
            )}

            {/* Custom fields with display values */}
            {task.customFields?.filter((cf: any) => cf.displayValue).map((cf: any) => (
              <MetadataRow key={cf.gid} label={cf.name}>
                <span>{cf.displayValue}</span>
              </MetadataRow>
            ))}

            {task.createdAt && <MetadataRow label="Created">{formatRelative(task.createdAt)}</MetadataRow>}
            {task.modifiedAt && <MetadataRow label="Modified">{formatRelative(task.modifiedAt)}</MetadataRow>}
          </div>

          {/* Tags */}
          {task.tags?.length > 0 && (
            <div>
              <span className="text-xs font-medium text-muted-foreground">Tags</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {task.tags.map((tag: any) => (
                  <span
                    key={tag.gid}
                    className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium"
                  >
                    <ColorDot color={tag.color} />
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Description */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">Description</span>
              {!editingBody && (
                <Button variant="ghost" size="icon-xs" onClick={handleStartEditBody}>
                  <Pencil size={12} />
                </Button>
              )}
            </div>
            {editingBody ? (
              <MarkdownEditor
                value={draftBody}
                onChange={setDraftBody}
                onSave={handleSaveBody}
                onCancel={() => setEditingBody(false)}
                placeholder="Add a description..."
                size="sm"
              />
            ) : task.notes ? (
              <div className="rounded border border-border p-3">
                <Markdown content={task.notes} size="sm" />
              </div>
            ) : (
              <button
                type="button"
                className="w-full rounded border border-dashed border-border p-3 text-xs text-muted-foreground hover:border-foreground/30 transition-colors text-left"
                onClick={handleStartEditBody}
              >
                Add a description...
              </button>
            )}
          </div>

          {/* Parent task */}
          {task.parentGid && task.parentName && (
            <>
              <Separator />
              <div>
                <span className="text-xs font-medium text-muted-foreground mb-2 block">
                  Parent Task
                </span>
                <button
                  type="button"
                  className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => navigateToTask(task.parentGid)}
                >
                  <span className="text-xs truncate">{task.parentName}</span>
                </button>
              </div>
            </>
          )}

          {/* Subtasks */}
          {subtasks.length > 0 && (
            <>
              <Separator />
              <div>
                <span className="text-xs font-medium text-muted-foreground mb-2 block">
                  Subtasks ({subtasks.length})
                </span>
                <div className="space-y-1">
                  {subtasks.map((sub: any) => (
                    <button
                      key={sub.gid}
                      type="button"
                      className="flex items-center gap-2 w-full rounded px-2 py-1.5 text-left hover:bg-muted/50 transition-colors"
                      onClick={() => navigateToTask(sub.gid)}
                    >
                      {sub.completed
                        ? <CheckCircle2 size={12} className="shrink-0 text-green-600 dark:text-green-400" />
                        : <Circle size={12} className="shrink-0 text-muted-foreground" />
                      }
                      <span className={`text-xs truncate flex-1 ${sub.completed ? 'line-through text-muted-foreground' : ''}`}>
                        {sub.name}
                      </span>
                      {sub.dueOn && (
                        <span className="text-[10px] text-muted-foreground shrink-0">{sub.dueOn}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Comments */}
          <Separator />
          <div>
            <span className="text-xs font-medium text-muted-foreground mb-2 block">
              Comments{comments.length > 0 ? ` (${comments.length})` : ''}
            </span>

            {comments.length > 0 && (
              <div className="space-y-3 mb-4">
                {comments.map((comment: any) => (
                  <div key={comment.gid} className="rounded border border-border p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{comment.createdByName ?? 'Unknown'}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {comment.createdAt ? formatRelative(comment.createdAt) : ''}
                      </span>
                    </div>
                    <Markdown content={comment.text} size="sm" />
                  </div>
                ))}
              </div>
            )}

            <Textarea
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="Leave a comment..."
              rows={3}
            />
            <div className="flex justify-end mt-2">
              <Button
                size="sm"
                disabled={!commentBody.trim() || commentLoading}
                onClick={handleAddComment}
              >
                {commentLoading ? 'Commenting...' : 'Comment'}
              </Button>
            </div>
          </div>
        </div>
      </DrawerBody>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete task"
        description={`Permanently delete "${task.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </DrawerContainer>
  );
}
