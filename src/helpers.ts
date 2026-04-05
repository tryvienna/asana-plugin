/**
 * Asana plugin helpers — shape interfaces and converters.
 *
 * Pure types and functions used by api.ts and schema.ts.
 * These shapes represent the normalized data returned from Asana's REST API.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Asana API client type — passed to api.ts functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal Asana client interface.
 * Uses hostApi.fetch() under the hood — this is the "client" created by the
 * integration's createClient callback.
 */
export interface AsanaClient {
  /** Personal Access Token */
  token: string;
  /** The fetch function from hostApi (CSP-bypassing) */
  fetch: (url: string, options?: RequestInit) => Promise<Response>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shape interfaces — match what api.ts functions return
// ─────────────────────────────────────────────────────────────────────────────

export interface AsanaWorkspaceShape {
  gid: string;
  name: string;
  isOrganization: boolean;
}

export interface AsanaProjectShape {
  gid: string;
  name: string;
  color: string | null;
  archived: boolean;
  workspaceGid: string;
  workspaceName: string | null;
}

export interface AsanaSectionShape {
  gid: string;
  name: string;
  projectGid: string;
}

export interface AsanaUserShape {
  gid: string;
  name: string;
  email: string | null;
}

export interface AsanaTagShape {
  gid: string;
  name: string;
  color: string | null;
}

export interface AsanaTaskShape {
  gid: string;
  name: string;
  completed: boolean;
  completedAt: string | null;
  assigneeGid: string | null;
  assigneeName: string | null;
  dueOn: string | null;
  dueAt: string | null;
  startOn: string | null;
  notes: string | null;
  htmlNotes: string | null;
  projects: AsanaTaskProjectRef[];
  sectionGid: string | null;
  sectionName: string | null;
  tags: AsanaTagShape[];
  parentGid: string | null;
  parentName: string | null;
  numSubtasks: number;
  permalink: string | null;
  createdAt: string | null;
  modifiedAt: string | null;
  customFields: AsanaCustomFieldValue[];
}

export interface AsanaTaskProjectRef {
  gid: string;
  name: string;
}

export interface AsanaCustomFieldValue {
  gid: string;
  name: string;
  type: string;
  displayValue: string | null;
  numberValue: number | null;
  textValue: string | null;
  enumValue: { gid: string; name: string; color: string } | null;
}

export interface AsanaSubtaskShape {
  gid: string;
  name: string;
  completed: boolean;
  assigneeName: string | null;
  dueOn: string | null;
}

export interface AsanaStoryShape {
  gid: string;
  text: string;
  htmlText: string | null;
  type: string;
  createdAt: string;
  createdByName: string | null;
}

export interface AsanaMutationResult {
  success: boolean;
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Raw API response types — what Asana actually returns
// ─────────────────────────────────────────────────────────────────────────────

export interface AsanaRawTask {
  gid: string;
  name: string;
  completed: boolean;
  completed_at: string | null;
  assignee: { gid: string; name: string } | null;
  due_on: string | null;
  due_at: string | null;
  start_on: string | null;
  notes: string | null;
  html_notes: string | null;
  projects: Array<{ gid: string; name: string }>;
  memberships: Array<{
    project: { gid: string; name: string };
    section: { gid: string; name: string };
  }>;
  tags: Array<{ gid: string; name: string; color: string | null }>;
  parent: { gid: string; name: string } | null;
  num_subtasks: number;
  permalink_url: string | null;
  created_at: string | null;
  modified_at: string | null;
  custom_fields: Array<{
    gid: string;
    name: string;
    resource_subtype: string;
    display_value: string | null;
    number_value: number | null;
    text_value: string | null;
    enum_value: { gid: string; name: string; color: string } | null;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Converters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convert a raw Asana task response into our normalized shape.
 * Handles missing fields gracefully.
 */
export function rawTaskToShape(raw: AsanaRawTask): AsanaTaskShape {
  // Find the first section membership (primary section)
  const primaryMembership = raw.memberships?.[0];

  return {
    gid: raw.gid,
    name: raw.name,
    completed: raw.completed ?? false,
    completedAt: raw.completed_at ?? null,
    assigneeGid: raw.assignee?.gid ?? null,
    assigneeName: raw.assignee?.name ?? null,
    dueOn: raw.due_on ?? null,
    dueAt: raw.due_at ?? null,
    startOn: raw.start_on ?? null,
    notes: raw.notes ?? null,
    htmlNotes: raw.html_notes ?? null,
    projects: (raw.projects ?? []).map((p) => ({
      gid: p.gid,
      name: p.name,
    })),
    sectionGid: primaryMembership?.section?.gid ?? null,
    sectionName: primaryMembership?.section?.name ?? null,
    tags: (raw.tags ?? []).map((t) => ({
      gid: t.gid,
      name: t.name,
      color: t.color ?? null,
    })),
    parentGid: raw.parent?.gid ?? null,
    parentName: raw.parent?.name ?? null,
    numSubtasks: raw.num_subtasks ?? 0,
    permalink: raw.permalink_url ?? null,
    createdAt: raw.created_at ?? null,
    modifiedAt: raw.modified_at ?? null,
    customFields: (raw.custom_fields ?? []).map((cf) => ({
      gid: cf.gid,
      name: cf.name,
      type: cf.resource_subtype ?? 'text',
      displayValue: cf.display_value ?? null,
      numberValue: cf.number_value ?? null,
      textValue: cf.text_value ?? null,
      enumValue: cf.enum_value
        ? { gid: cf.enum_value.gid, name: cf.enum_value.name, color: cf.enum_value.color }
        : null,
    })),
  };
}

/** Fields to request from the Asana tasks endpoint for full detail. */
export const TASK_DETAIL_OPT_FIELDS = [
  'name',
  'completed',
  'completed_at',
  'assignee.name',
  'due_on',
  'due_at',
  'start_on',
  'notes',
  'html_notes',
  'projects.name',
  'memberships.project.name',
  'memberships.section.name',
  'tags.name',
  'tags.color',
  'parent.name',
  'num_subtasks',
  'permalink_url',
  'created_at',
  'modified_at',
  'custom_fields.name',
  'custom_fields.resource_subtype',
  'custom_fields.display_value',
  'custom_fields.number_value',
  'custom_fields.text_value',
  'custom_fields.enum_value.name',
  'custom_fields.enum_value.color',
].join(',');

/** Fields to request for the nav sidebar (lighter payload). */
export const TASK_NAV_OPT_FIELDS = [
  'name',
  'completed',
  'assignee.name',
  'due_on',
  'projects.name',
  'memberships.section.name',
  'memberships.project.name',
  'tags.name',
  'tags.color',
  'permalink_url',
  'modified_at',
].join(',');

/** Fields for subtask listing. */
export const SUBTASK_OPT_FIELDS = [
  'name',
  'completed',
  'assignee.name',
  'due_on',
].join(',');
