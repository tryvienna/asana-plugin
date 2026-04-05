import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AsanaClient } from '../helpers';
import * as api from '../api';

// ─────────────────────────────────────────────────────────────────────────────
// Mock fetch helper
// ─────────────────────────────────────────────────────────────────────────────

function createMockClient(responses: Map<string, { ok: boolean; status: number; data: unknown }>): AsanaClient {
  const fetchFn = vi.fn(async (url: string) => {
    for (const [pattern, resp] of responses) {
      if (url.includes(pattern)) {
        return {
          ok: resp.ok,
          status: resp.status,
          statusText: resp.ok ? 'OK' : 'Error',
          json: async () => resp.data,
        } as unknown as Response;
      }
    }
    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ errors: [{ message: 'Not found' }] }),
    } as unknown as Response;
  });

  return { token: 'test-token', fetch: fetchFn };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('listWorkspaces', () => {
  it('returns workspace shapes', async () => {
    const client = createMockClient(new Map([
      ['/workspaces', {
        ok: true,
        status: 200,
        data: {
          data: [
            { gid: 'ws-1', name: 'My Workspace', is_organization: true },
            { gid: 'ws-2', name: 'Personal', is_organization: false },
          ],
        },
      }],
    ]));

    const workspaces = await api.listWorkspaces(client);
    expect(workspaces).toHaveLength(2);
    expect(workspaces[0].gid).toBe('ws-1');
    expect(workspaces[0].name).toBe('My Workspace');
    expect(workspaces[0].isOrganization).toBe(true);
    expect(workspaces[1].isOrganization).toBe(false);
  });
});

describe('listProjects', () => {
  it('returns project shapes', async () => {
    const client = createMockClient(new Map([
      ['/workspaces/ws-1/projects', {
        ok: true,
        status: 200,
        data: {
          data: [
            { gid: 'proj-1', name: 'Alpha', color: 'blue', archived: false, workspace: { gid: 'ws-1', name: 'My Workspace' } },
          ],
        },
      }],
    ]));

    const projects = await api.listProjects(client, { workspaceGid: 'ws-1' });
    expect(projects).toHaveLength(1);
    expect(projects[0].gid).toBe('proj-1');
    expect(projects[0].name).toBe('Alpha');
    expect(projects[0].workspaceGid).toBe('ws-1');
  });
});

describe('getTask', () => {
  it('returns a task shape', async () => {
    const client = createMockClient(new Map([
      ['/tasks/task-1', {
        ok: true,
        status: 200,
        data: {
          data: {
            gid: 'task-1',
            name: 'My Task',
            completed: false,
            completed_at: null,
            assignee: { gid: 'user-1', name: 'Alice' },
            due_on: '2024-12-31',
            due_at: null,
            start_on: null,
            notes: 'Some notes',
            html_notes: null,
            projects: [{ gid: 'proj-1', name: 'Alpha' }],
            memberships: [{
              project: { gid: 'proj-1', name: 'Alpha' },
              section: { gid: 'sec-1', name: 'To Do' },
            }],
            tags: [{ gid: 'tag-1', name: 'Bug', color: 'red' }],
            parent: null,
            num_subtasks: 2,
            permalink_url: 'https://app.asana.com/0/0/task-1',
            created_at: '2024-01-01T00:00:00.000Z',
            modified_at: '2024-01-02T00:00:00.000Z',
            custom_fields: [],
          },
        },
      }],
    ]));

    const task = await api.getTask(client, { taskGid: 'task-1' });
    expect(task).not.toBeNull();
    expect(task!.gid).toBe('task-1');
    expect(task!.name).toBe('My Task');
    expect(task!.assigneeName).toBe('Alice');
    expect(task!.sectionName).toBe('To Do');
    expect(task!.tags).toHaveLength(1);
    expect(task!.numSubtasks).toBe(2);
  });

  it('returns null for 404', async () => {
    const client = createMockClient(new Map([
      ['/tasks/nonexistent', {
        ok: false,
        status: 404,
        data: { errors: [{ message: 'Not Found' }] },
      }],
    ]));

    const task = await api.getTask(client, { taskGid: 'nonexistent' });
    expect(task).toBeNull();
  });
});

describe('listSubtasks', () => {
  it('returns subtask shapes', async () => {
    const client = createMockClient(new Map([
      ['/tasks/task-1/subtasks', {
        ok: true,
        status: 200,
        data: {
          data: [
            { gid: 'st-1', name: 'Sub 1', completed: false, assignee: { name: 'Bob' }, due_on: '2024-06-01' },
            { gid: 'st-2', name: 'Sub 2', completed: true, assignee: null, due_on: null },
          ],
        },
      }],
    ]));

    const subtasks = await api.listSubtasks(client, { taskGid: 'task-1' });
    expect(subtasks).toHaveLength(2);
    expect(subtasks[0].name).toBe('Sub 1');
    expect(subtasks[0].assigneeName).toBe('Bob');
    expect(subtasks[1].completed).toBe(true);
    expect(subtasks[1].assigneeName).toBeNull();
  });
});

describe('createTask', () => {
  it('creates a task and returns the shape', async () => {
    const client = createMockClient(new Map([
      ['/tasks?opt_fields', {
        ok: true,
        status: 201,
        data: {
          data: {
            gid: 'new-task-1',
            name: 'New Task',
            completed: false,
            completed_at: null,
            assignee: null,
            due_on: null,
            due_at: null,
            start_on: null,
            notes: '',
            html_notes: null,
            projects: [],
            memberships: [],
            tags: [],
            parent: null,
            num_subtasks: 0,
            permalink_url: null,
            created_at: '2024-06-15T00:00:00.000Z',
            modified_at: '2024-06-15T00:00:00.000Z',
            custom_fields: [],
          },
        },
      }],
    ]));

    const task = await api.createTask(client, {
      name: 'New Task',
      workspaceGid: 'ws-1',
    });
    expect(task.gid).toBe('new-task-1');
    expect(task.name).toBe('New Task');
  });
});

describe('updateTask', () => {
  it('updates a task and returns the shape', async () => {
    const client = createMockClient(new Map([
      ['/tasks/task-1', {
        ok: true,
        status: 200,
        data: {
          data: {
            gid: 'task-1',
            name: 'Updated Task',
            completed: true,
            completed_at: '2024-06-15T10:00:00.000Z',
            assignee: null,
            due_on: null,
            due_at: null,
            start_on: null,
            notes: '',
            html_notes: null,
            projects: [],
            memberships: [],
            tags: [],
            parent: null,
            num_subtasks: 0,
            permalink_url: null,
            created_at: '2024-01-01T00:00:00.000Z',
            modified_at: '2024-06-15T10:00:00.000Z',
            custom_fields: [],
          },
        },
      }],
    ]));

    const task = await api.updateTask(client, {
      taskGid: 'task-1',
      completed: true,
    });
    expect(task.completed).toBe(true);
    expect(task.name).toBe('Updated Task');
  });
});

describe('deleteTask', () => {
  it('returns success result', async () => {
    const client = createMockClient(new Map([
      ['/tasks/task-1', {
        ok: true,
        status: 200,
        data: { data: {} },
      }],
    ]));

    const result = await api.deleteTask(client, { taskGid: 'task-1' });
    expect(result.success).toBe(true);
  });
});

describe('addComment', () => {
  it('returns success result', async () => {
    const client = createMockClient(new Map([
      ['/tasks/task-1/stories', {
        ok: true,
        status: 201,
        data: { data: { gid: 'story-1' } },
      }],
    ]));

    const result = await api.addComment(client, {
      taskGid: 'task-1',
      text: 'Hello!',
    });
    expect(result.success).toBe(true);
    expect(result.message).toBe('Comment added');
  });
});

describe('error handling', () => {
  it('throws GraphQLError for auth errors', async () => {
    const client = createMockClient(new Map([
      ['/workspaces', {
        ok: false,
        status: 401,
        data: { errors: [{ message: 'Not Authorized' }] },
      }],
    ]));

    await expect(api.listWorkspaces(client)).rejects.toThrow('Not Authorized');
  });

  it('throws GraphQLError for rate limiting', async () => {
    const client = createMockClient(new Map([
      ['/workspaces', {
        ok: false,
        status: 429,
        data: { errors: [{ message: 'Rate limited' }] },
      }],
    ]));

    await expect(api.listWorkspaces(client)).rejects.toThrow('Rate limited');
  });
});

describe('fetch sends correct headers', () => {
  it('sends Bearer token and Content-Type', async () => {
    const fetchFn = vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ data: [] }),
    })) as unknown as AsanaClient['fetch'];

    const client: AsanaClient = { token: 'my-pat-token', fetch: fetchFn };

    await api.listWorkspaces(client);

    expect(fetchFn).toHaveBeenCalledTimes(1);
    const [url, options] = (fetchFn as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toContain('/workspaces');
    expect(options.headers['Authorization']).toBe('Bearer my-pat-token');
    expect(options.headers['Content-Type']).toBe('application/json');
  });
});
