import { describe, it, expect } from 'vitest';
import { rawTaskToShape, TASK_DETAIL_OPT_FIELDS, TASK_NAV_OPT_FIELDS } from '../helpers';
import type { AsanaRawTask } from '../helpers';

function makeRawTask(overrides: Partial<AsanaRawTask> = {}): AsanaRawTask {
  return {
    gid: '12345',
    name: 'Test Task',
    completed: false,
    completed_at: null,
    assignee: null,
    due_on: null,
    due_at: null,
    start_on: null,
    notes: null,
    html_notes: null,
    projects: [],
    memberships: [],
    tags: [],
    parent: null,
    num_subtasks: 0,
    permalink_url: null,
    created_at: '2024-01-01T00:00:00.000Z',
    modified_at: '2024-01-02T00:00:00.000Z',
    custom_fields: [],
    ...overrides,
  };
}

describe('rawTaskToShape', () => {
  it('converts a minimal raw task', () => {
    const shape = rawTaskToShape(makeRawTask());

    expect(shape.gid).toBe('12345');
    expect(shape.name).toBe('Test Task');
    expect(shape.completed).toBe(false);
    expect(shape.assigneeGid).toBeNull();
    expect(shape.assigneeName).toBeNull();
    expect(shape.projects).toEqual([]);
    expect(shape.tags).toEqual([]);
    expect(shape.sectionGid).toBeNull();
    expect(shape.sectionName).toBeNull();
    expect(shape.parentGid).toBeNull();
    expect(shape.numSubtasks).toBe(0);
  });

  it('converts assignee fields', () => {
    const shape = rawTaskToShape(makeRawTask({
      assignee: { gid: 'user-1', name: 'Jane Doe' },
    }));

    expect(shape.assigneeGid).toBe('user-1');
    expect(shape.assigneeName).toBe('Jane Doe');
  });

  it('converts project references', () => {
    const shape = rawTaskToShape(makeRawTask({
      projects: [
        { gid: 'proj-1', name: 'Project Alpha' },
        { gid: 'proj-2', name: 'Project Beta' },
      ],
    }));

    expect(shape.projects).toHaveLength(2);
    expect(shape.projects[0].name).toBe('Project Alpha');
    expect(shape.projects[1].gid).toBe('proj-2');
  });

  it('extracts section from memberships', () => {
    const shape = rawTaskToShape(makeRawTask({
      memberships: [
        {
          project: { gid: 'proj-1', name: 'My Project' },
          section: { gid: 'sec-1', name: 'In Progress' },
        },
      ],
    }));

    expect(shape.sectionGid).toBe('sec-1');
    expect(shape.sectionName).toBe('In Progress');
  });

  it('converts tags', () => {
    const shape = rawTaskToShape(makeRawTask({
      tags: [
        { gid: 'tag-1', name: 'Bug', color: 'red' },
        { gid: 'tag-2', name: 'P1', color: null },
      ],
    }));

    expect(shape.tags).toHaveLength(2);
    expect(shape.tags[0].name).toBe('Bug');
    expect(shape.tags[0].color).toBe('red');
    expect(shape.tags[1].color).toBeNull();
  });

  it('converts parent reference', () => {
    const shape = rawTaskToShape(makeRawTask({
      parent: { gid: 'parent-1', name: 'Parent Task' },
    }));

    expect(shape.parentGid).toBe('parent-1');
    expect(shape.parentName).toBe('Parent Task');
  });

  it('converts custom fields', () => {
    const shape = rawTaskToShape(makeRawTask({
      custom_fields: [
        {
          gid: 'cf-1',
          name: 'Priority',
          resource_subtype: 'enum',
          display_value: 'High',
          number_value: null,
          text_value: null,
          enum_value: { gid: 'ev-1', name: 'High', color: 'red' },
        },
        {
          gid: 'cf-2',
          name: 'Points',
          resource_subtype: 'number',
          display_value: '5',
          number_value: 5,
          text_value: null,
          enum_value: null,
        },
      ],
    }));

    expect(shape.customFields).toHaveLength(2);
    expect(shape.customFields[0].name).toBe('Priority');
    expect(shape.customFields[0].type).toBe('enum');
    expect(shape.customFields[0].enumValue?.name).toBe('High');
    expect(shape.customFields[1].numberValue).toBe(5);
  });

  it('converts completed task', () => {
    const shape = rawTaskToShape(makeRawTask({
      completed: true,
      completed_at: '2024-06-15T10:00:00.000Z',
    }));

    expect(shape.completed).toBe(true);
    expect(shape.completedAt).toBe('2024-06-15T10:00:00.000Z');
  });

  it('converts dates', () => {
    const shape = rawTaskToShape(makeRawTask({
      due_on: '2024-12-31',
      due_at: '2024-12-31T17:00:00.000Z',
      start_on: '2024-12-01',
    }));

    expect(shape.dueOn).toBe('2024-12-31');
    expect(shape.dueAt).toBe('2024-12-31T17:00:00.000Z');
    expect(shape.startOn).toBe('2024-12-01');
  });

  it('handles all null/missing fields gracefully', () => {
    const raw: AsanaRawTask = {
      gid: 'min-1',
      name: '',
      completed: false,
      completed_at: null,
      assignee: null,
      due_on: null,
      due_at: null,
      start_on: null,
      notes: null,
      html_notes: null,
      projects: [],
      memberships: [],
      tags: [],
      parent: null,
      num_subtasks: 0,
      permalink_url: null,
      created_at: null,
      modified_at: null,
      custom_fields: [],
    };

    const shape = rawTaskToShape(raw);
    expect(shape.gid).toBe('min-1');
    expect(shape.permalink).toBeNull();
    expect(shape.createdAt).toBeNull();
    expect(shape.modifiedAt).toBeNull();
  });
});

describe('opt_fields constants', () => {
  it('TASK_DETAIL_OPT_FIELDS includes essential fields', () => {
    expect(TASK_DETAIL_OPT_FIELDS).toContain('name');
    expect(TASK_DETAIL_OPT_FIELDS).toContain('completed');
    expect(TASK_DETAIL_OPT_FIELDS).toContain('assignee.name');
    expect(TASK_DETAIL_OPT_FIELDS).toContain('notes');
    expect(TASK_DETAIL_OPT_FIELDS).toContain('custom_fields.name');
  });

  it('TASK_NAV_OPT_FIELDS is a subset of detail fields', () => {
    expect(TASK_NAV_OPT_FIELDS).toContain('name');
    expect(TASK_NAV_OPT_FIELDS).toContain('completed');
    expect(TASK_NAV_OPT_FIELDS).toContain('assignee.name');
    // Nav doesn't include notes
    expect(TASK_NAV_OPT_FIELDS).not.toContain('notes');
  });
});
