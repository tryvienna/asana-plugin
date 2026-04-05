/**
 * Asana REST API wrapper functions.
 *
 * Standalone async functions wrapping the Asana REST API.
 * Each function takes an AsanaClient and returns shaped data.
 * These are called exclusively from GraphQL resolvers in schema.ts.
 *
 * Base URL: https://app.asana.com/api/1.0
 * Auth: Bearer token (PAT)
 * Pagination: offset-based with next_page
 * Rate limits: 150 req/min (free), 1500 req/min (paid)
 */

import { GraphQLError } from 'graphql';
import {
  type AsanaClient,
  type AsanaTaskShape,
  type AsanaWorkspaceShape,
  type AsanaProjectShape,
  type AsanaSectionShape,
  type AsanaUserShape,
  type AsanaTagShape,
  type AsanaSubtaskShape,
  type AsanaStoryShape,
  type AsanaMutationResult,
  type AsanaRawTask,
  rawTaskToShape,
  TASK_DETAIL_OPT_FIELDS,
  TASK_NAV_OPT_FIELDS,
  SUBTASK_OPT_FIELDS,
} from './helpers';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL = 'https://app.asana.com/api/1.0';

// ─────────────────────────────────────────────────────────────────────────────
// HTTP helpers
// ─────────────────────────────────────────────────────────────────────────────

interface AsanaResponse<T> {
  data: T;
  next_page?: {
    offset: string;
    path: string;
    uri: string;
  } | null;
}

interface AsanaErrorResponse {
  errors: Array<{ message: string; help?: string }>;
}

async function asanaFetch<T>(
  client: AsanaClient,
  path: string,
  options?: RequestInit,
): Promise<AsanaResponse<T>> {
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
  const res = await client.fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${client.token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let errorMessage = `Asana API error: ${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as AsanaErrorResponse;
      if (body.errors?.[0]?.message) {
        errorMessage = `Asana API error: ${body.errors[0].message}`;
      }
    } catch {
      // couldn't parse error body
    }

    const code =
      res.status === 401 ? 'ASANA_AUTH_ERROR' :
      res.status === 402 ? 'ASANA_PREMIUM_REQUIRED' :
      res.status === 403 ? 'ASANA_FORBIDDEN' :
      res.status === 404 ? 'ASANA_NOT_FOUND' :
      res.status === 429 ? 'ASANA_RATE_LIMITED' :
      'ASANA_API_ERROR';

    throw new GraphQLError(errorMessage, { extensions: { code } });
  }

  return (await res.json()) as AsanaResponse<T>;
}

/** Paginate through all results (up to `maxItems`). */
async function asanaFetchAll<T>(
  client: AsanaClient,
  path: string,
  maxItems: number = 100,
): Promise<T[]> {
  const results: T[] = [];
  let url = path.includes('?')
    ? `${path}&limit=${Math.min(maxItems, 100)}`
    : `${path}?limit=${Math.min(maxItems, 100)}`;

  while (results.length < maxItems) {
    const response = await asanaFetch<T[]>(client, url);
    results.push(...(response.data ?? []));
    if (!response.next_page || results.length >= maxItems) break;
    url = response.next_page.uri;
  }

  return results.slice(0, maxItems);
}

function wrapAsanaError(err: unknown, context: string): never {
  if (err instanceof GraphQLError) throw err;
  if (err instanceof Error) {
    throw new GraphQLError(`Asana API error: ${err.message}`, {
      extensions: { code: 'ASANA_API_ERROR', context },
    });
  }
  throw err;
}

// ─────────────────────────────────────────────────────────────────────────────
// Workspace queries
// ─────────────────────────────────────────────────────────────────────────────

export async function listWorkspaces(
  client: AsanaClient,
): Promise<AsanaWorkspaceShape[]> {
  try {
    const response = await asanaFetch<
      Array<{ gid: string; name: string; is_organization: boolean }>
    >(client, '/workspaces?opt_fields=name,is_organization&limit=100');
    return (response.data ?? []).map((w) => ({
      gid: w.gid,
      name: w.name,
      isOrganization: w.is_organization ?? false,
    }));
  } catch (err) {
    wrapAsanaError(err, 'listWorkspaces');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Project queries
// ─────────────────────────────────────────────────────────────────────────────

export async function listProjects(
  client: AsanaClient,
  input: { workspaceGid: string; archived?: boolean },
): Promise<AsanaProjectShape[]> {
  try {
    const archived = input.archived ?? false;
    const raw = await asanaFetchAll<{
      gid: string;
      name: string;
      color: string | null;
      archived: boolean;
      workspace: { gid: string; name: string } | null;
    }>(
      client,
      `/workspaces/${input.workspaceGid}/projects?opt_fields=name,color,archived,workspace.name&archived=${archived}`,
      200,
    );
    return raw.map((p) => ({
      gid: p.gid,
      name: p.name,
      color: p.color ?? null,
      archived: p.archived ?? false,
      workspaceGid: p.workspace?.gid ?? input.workspaceGid,
      workspaceName: p.workspace?.name ?? null,
    }));
  } catch (err) {
    wrapAsanaError(err, 'listProjects');
  }
}

export async function getProject(
  client: AsanaClient,
  input: { projectGid: string },
): Promise<AsanaProjectShape | null> {
  try {
    const response = await asanaFetch<{
      gid: string;
      name: string;
      color: string | null;
      archived: boolean;
      workspace: { gid: string; name: string } | null;
    }>(client, `/projects/${input.projectGid}?opt_fields=name,color,archived,workspace.name`);
    const p = response.data;
    return {
      gid: p.gid,
      name: p.name,
      color: p.color ?? null,
      archived: p.archived ?? false,
      workspaceGid: p.workspace?.gid ?? '',
      workspaceName: p.workspace?.name ?? null,
    };
  } catch (err) {
    wrapAsanaError(err, 'getProject');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Section queries
// ─────────────────────────────────────────────────────────────────────────────

export async function listSections(
  client: AsanaClient,
  input: { projectGid: string },
): Promise<AsanaSectionShape[]> {
  try {
    const raw = await asanaFetchAll<{ gid: string; name: string }>(
      client,
      `/projects/${input.projectGid}/sections?opt_fields=name`,
      100,
    );
    return raw.map((s) => ({
      gid: s.gid,
      name: s.name,
      projectGid: input.projectGid,
    }));
  } catch (err) {
    wrapAsanaError(err, 'listSections');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// User queries
// ─────────────────────────────────────────────────────────────────────────────

export async function getMe(
  client: AsanaClient,
): Promise<AsanaUserShape> {
  try {
    const response = await asanaFetch<{ gid: string; name: string; email: string | null }>(
      client,
      '/users/me?opt_fields=name,email',
    );
    const u = response.data;
    return { gid: u.gid, name: u.name, email: u.email ?? null };
  } catch (err) {
    wrapAsanaError(err, 'getMe');
  }
}

export async function listUsers(
  client: AsanaClient,
  input: { workspaceGid: string },
): Promise<AsanaUserShape[]> {
  try {
    const raw = await asanaFetchAll<{ gid: string; name: string; email: string | null }>(
      client,
      `/workspaces/${input.workspaceGid}/users?opt_fields=name,email`,
      200,
    );
    return raw.map((u) => ({
      gid: u.gid,
      name: u.name,
      email: u.email ?? null,
    }));
  } catch (err) {
    wrapAsanaError(err, 'listUsers');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tag queries
// ─────────────────────────────────────────────────────────────────────────────

export async function listTags(
  client: AsanaClient,
  input: { workspaceGid: string },
): Promise<AsanaTagShape[]> {
  try {
    const raw = await asanaFetchAll<{ gid: string; name: string; color: string | null }>(
      client,
      `/workspaces/${input.workspaceGid}/tags?opt_fields=name,color`,
      200,
    );
    return raw.map((t) => ({
      gid: t.gid,
      name: t.name,
      color: t.color ?? null,
    }));
  } catch (err) {
    wrapAsanaError(err, 'listTags');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Task queries
// ─────────────────────────────────────────────────────────────────────────────

export async function getTask(
  client: AsanaClient,
  input: { taskGid: string },
): Promise<AsanaTaskShape | null> {
  try {
    const response = await asanaFetch<AsanaRawTask>(
      client,
      `/tasks/${input.taskGid}?opt_fields=${TASK_DETAIL_OPT_FIELDS}`,
    );
    return rawTaskToShape(response.data);
  } catch (err) {
    // Return null for 404s
    if (err instanceof GraphQLError && err.extensions?.['code'] === 'ASANA_NOT_FOUND') {
      return null;
    }
    wrapAsanaError(err, 'getTask');
  }
}

/**
 * List tasks for a project (primary data source — works for all Asana tiers).
 *
 * Supports filtering by:
 * - completedSince: ISO date string — only returns incomplete tasks or tasks
 *   completed after this date. Pass 'now' for only incomplete tasks.
 * - sectionGid: Filter to a specific section within the project.
 */
export async function listTasksForProject(
  client: AsanaClient,
  input: {
    projectGid: string;
    completedSince?: string;
    limit?: number;
  },
): Promise<AsanaTaskShape[]> {
  try {
    let path = `/projects/${input.projectGid}/tasks?opt_fields=${TASK_NAV_OPT_FIELDS}`;
    if (input.completedSince) {
      path += `&completed_since=${encodeURIComponent(input.completedSince)}`;
    }
    const raw = await asanaFetchAll<AsanaRawTask>(client, path, input.limit ?? 50);
    return raw.map(rawTaskToShape);
  } catch (err) {
    wrapAsanaError(err, 'listTasksForProject');
  }
}

/**
 * List tasks for a section within a project.
 */
export async function listTasksForSection(
  client: AsanaClient,
  input: {
    sectionGid: string;
    completedSince?: string;
    limit?: number;
  },
): Promise<AsanaTaskShape[]> {
  try {
    let path = `/sections/${input.sectionGid}/tasks?opt_fields=${TASK_NAV_OPT_FIELDS}`;
    if (input.completedSince) {
      path += `&completed_since=${encodeURIComponent(input.completedSince)}`;
    }
    const raw = await asanaFetchAll<AsanaRawTask>(client, path, input.limit ?? 50);
    return raw.map(rawTaskToShape);
  } catch (err) {
    wrapAsanaError(err, 'listTasksForSection');
  }
}

/**
 * List tasks assigned to a specific user in a workspace.
 */
export async function listTasksForAssignee(
  client: AsanaClient,
  input: {
    workspaceGid: string;
    assigneeGid: string;
    completedSince?: string;
    limit?: number;
  },
): Promise<AsanaTaskShape[]> {
  try {
    let path = `/tasks?workspace=${input.workspaceGid}&assignee=${input.assigneeGid}&opt_fields=${TASK_NAV_OPT_FIELDS}`;
    if (input.completedSince) {
      path += `&completed_since=${encodeURIComponent(input.completedSince)}`;
    }
    const raw = await asanaFetchAll<AsanaRawTask>(client, path, input.limit ?? 50);
    return raw.map(rawTaskToShape);
  } catch (err) {
    wrapAsanaError(err, 'listTasksForAssignee');
  }
}

/**
 * Search tasks in a workspace (requires Asana premium).
 * Falls back gracefully with a descriptive error if not premium.
 */
export async function searchTasks(
  client: AsanaClient,
  input: {
    workspaceGid: string;
    text?: string;
    assigneeGid?: string;
    projectGid?: string;
    sectionGid?: string;
    completed?: boolean;
    dueBefore?: string;
    dueAfter?: string;
    sortBy?: 'due_date' | 'created_at' | 'modified_at' | 'likes';
    sortAscending?: boolean;
    limit?: number;
  },
): Promise<AsanaTaskShape[]> {
  try {
    const params = new URLSearchParams();
    params.set('opt_fields', TASK_NAV_OPT_FIELDS);
    if (input.text) params.set('text', input.text);
    if (input.assigneeGid) params.set('assignee.any', input.assigneeGid);
    if (input.projectGid) params.set('projects.any', input.projectGid);
    if (input.sectionGid) params.set('sections.any', input.sectionGid);
    if (input.completed !== undefined) params.set('completed', String(input.completed));
    if (input.dueBefore) params.set('due_on.before', input.dueBefore);
    if (input.dueAfter) params.set('due_on.after', input.dueAfter);
    if (input.sortBy) params.set('sort_by', input.sortBy);
    if (input.sortAscending !== undefined) params.set('sort_ascending', String(input.sortAscending));

    const limit = Math.min(input.limit ?? 50, 100);
    params.set('limit', String(limit));

    const response = await asanaFetch<AsanaRawTask[]>(
      client,
      `/workspaces/${input.workspaceGid}/tasks/search?${params.toString()}`,
    );
    return (response.data ?? []).map(rawTaskToShape);
  } catch (err) {
    wrapAsanaError(err, 'searchTasks');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Subtask queries
// ─────────────────────────────────────────────────────────────────────────────

export async function listSubtasks(
  client: AsanaClient,
  input: { taskGid: string },
): Promise<AsanaSubtaskShape[]> {
  try {
    const raw = await asanaFetchAll<{
      gid: string;
      name: string;
      completed: boolean;
      assignee: { name: string } | null;
      due_on: string | null;
    }>(client, `/tasks/${input.taskGid}/subtasks?opt_fields=${SUBTASK_OPT_FIELDS}`, 100);
    return raw.map((s) => ({
      gid: s.gid,
      name: s.name,
      completed: s.completed ?? false,
      assigneeName: s.assignee?.name ?? null,
      dueOn: s.due_on ?? null,
    }));
  } catch (err) {
    wrapAsanaError(err, 'listSubtasks');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Story (comment) queries
// ─────────────────────────────────────────────────────────────────────────────

export async function listStories(
  client: AsanaClient,
  input: { taskGid: string; type?: 'comment' | 'system' },
): Promise<AsanaStoryShape[]> {
  try {
    const raw = await asanaFetchAll<{
      gid: string;
      text: string;
      html_text: string | null;
      type: string;
      resource_subtype: string;
      created_at: string;
      created_by: { name: string } | null;
    }>(
      client,
      `/tasks/${input.taskGid}/stories?opt_fields=text,html_text,type,resource_subtype,created_at,created_by.name`,
      200,
    );
    const stories = raw.map((s) => ({
      gid: s.gid,
      text: s.text ?? '',
      htmlText: s.html_text ?? null,
      type: s.resource_subtype ?? s.type ?? 'system',
      createdAt: s.created_at ?? '',
      createdByName: s.created_by?.name ?? null,
    }));
    // Filter to comments only if requested
    if (input.type === 'comment') {
      return stories.filter((s) => s.type === 'comment_added');
    }
    return stories;
  } catch (err) {
    wrapAsanaError(err, 'listStories');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Task mutations
// ─────────────────────────────────────────────────────────────────────────────

export interface CreateTaskInput {
  name: string;
  workspaceGid: string;
  projectGid?: string;
  sectionGid?: string;
  assigneeGid?: string;
  notes?: string;
  dueOn?: string;
  startOn?: string;
  tagGids?: string[];
  parentGid?: string;
}

export async function createTask(
  client: AsanaClient,
  input: CreateTaskInput,
): Promise<AsanaTaskShape> {
  try {
    const body: Record<string, unknown> = {
      name: input.name,
      workspace: input.workspaceGid,
    };
    if (input.projectGid) body.projects = [input.projectGid];
    if (input.assigneeGid) body.assignee = input.assigneeGid;
    if (input.notes) body.notes = input.notes;
    if (input.dueOn) body.due_on = input.dueOn;
    if (input.startOn) body.start_on = input.startOn;
    if (input.tagGids?.length) body.tags = input.tagGids;
    if (input.parentGid) body.parent = input.parentGid;

    const response = await asanaFetch<AsanaRawTask>(
      client,
      `/tasks?opt_fields=${TASK_DETAIL_OPT_FIELDS}`,
      {
        method: 'POST',
        body: JSON.stringify({ data: body }),
      },
    );

    const task = rawTaskToShape(response.data);

    // If a section was specified, move the task to it
    if (input.sectionGid) {
      try {
        await asanaFetch(client, `/sections/${input.sectionGid}/addTask`, {
          method: 'POST',
          body: JSON.stringify({ data: { task: task.gid } }),
        });
      } catch {
        // Section assignment failed — task is still created
      }
    }

    return task;
  } catch (err) {
    wrapAsanaError(err, 'createTask');
  }
}

export interface UpdateTaskInput {
  name?: string;
  completed?: boolean;
  assigneeGid?: string | null;
  notes?: string;
  dueOn?: string | null;
  startOn?: string | null;
}

export async function updateTask(
  client: AsanaClient,
  input: { taskGid: string } & UpdateTaskInput,
): Promise<AsanaTaskShape> {
  try {
    const { taskGid, ...fields } = input;
    const body: Record<string, unknown> = {};
    if (fields.name !== undefined) body.name = fields.name;
    if (fields.completed !== undefined) body.completed = fields.completed;
    if (fields.assigneeGid !== undefined) body.assignee = fields.assigneeGid;
    if (fields.notes !== undefined) body.notes = fields.notes;
    if (fields.dueOn !== undefined) body.due_on = fields.dueOn;
    if (fields.startOn !== undefined) body.start_on = fields.startOn;

    const response = await asanaFetch<AsanaRawTask>(
      client,
      `/tasks/${taskGid}?opt_fields=${TASK_DETAIL_OPT_FIELDS}`,
      {
        method: 'PUT',
        body: JSON.stringify({ data: body }),
      },
    );
    return rawTaskToShape(response.data);
  } catch (err) {
    wrapAsanaError(err, 'updateTask');
  }
}

export async function deleteTask(
  client: AsanaClient,
  input: { taskGid: string },
): Promise<AsanaMutationResult> {
  try {
    await asanaFetch<Record<string, never>>(client, `/tasks/${input.taskGid}`, {
      method: 'DELETE',
    });
    return { success: true, message: `Deleted task ${input.taskGid}` };
  } catch (err) {
    if (err instanceof GraphQLError) {
      return { success: false, message: err.message };
    }
    wrapAsanaError(err, 'deleteTask');
  }
}

export async function addComment(
  client: AsanaClient,
  input: { taskGid: string; text: string },
): Promise<AsanaMutationResult> {
  try {
    await asanaFetch(client, `/tasks/${input.taskGid}/stories`, {
      method: 'POST',
      body: JSON.stringify({ data: { text: input.text } }),
    });
    return { success: true, message: 'Comment added' };
  } catch (err) {
    if (err instanceof GraphQLError) {
      return { success: false, message: err.message };
    }
    wrapAsanaError(err, 'addComment');
  }
}

/**
 * Add a tag to a task.
 */
export async function addTagToTask(
  client: AsanaClient,
  input: { taskGid: string; tagGid: string },
): Promise<AsanaMutationResult> {
  try {
    await asanaFetch(client, `/tasks/${input.taskGid}/addTag`, {
      method: 'POST',
      body: JSON.stringify({ data: { tag: input.tagGid } }),
    });
    return { success: true, message: 'Tag added' };
  } catch (err) {
    if (err instanceof GraphQLError) {
      return { success: false, message: err.message };
    }
    wrapAsanaError(err, 'addTagToTask');
  }
}

/**
 * Remove a tag from a task.
 */
export async function removeTagFromTask(
  client: AsanaClient,
  input: { taskGid: string; tagGid: string },
): Promise<AsanaMutationResult> {
  try {
    await asanaFetch(client, `/tasks/${input.taskGid}/removeTag`, {
      method: 'POST',
      body: JSON.stringify({ data: { tag: input.tagGid } }),
    });
    return { success: true, message: 'Tag removed' };
  } catch (err) {
    if (err instanceof GraphQLError) {
      return { success: false, message: err.message };
    }
    wrapAsanaError(err, 'removeTagFromTask');
  }
}

/**
 * Move a task to a different section within the same project.
 */
export async function moveTaskToSection(
  client: AsanaClient,
  input: { taskGid: string; sectionGid: string },
): Promise<AsanaMutationResult> {
  try {
    await asanaFetch(client, `/sections/${input.sectionGid}/addTask`, {
      method: 'POST',
      body: JSON.stringify({ data: { task: input.taskGid } }),
    });
    return { success: true, message: 'Task moved to section' };
  } catch (err) {
    if (err instanceof GraphQLError) {
      return { success: false, message: err.message };
    }
    wrapAsanaError(err, 'moveTaskToSection');
  }
}
