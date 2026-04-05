/**
 * Asana integration GraphQL schema registration.
 *
 * Registers all Asana-specific GraphQL types, queries, and mutations
 * on the Pothos builder. Called via the integration's `schema` callback
 * during plugin loading.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { GraphQLError } from 'graphql';
import { buildEntityURI } from '@tryvienna/sdk';
import type { BaseEntity } from '@tryvienna/sdk';
import { asanaTaskEntity } from './entities';
import { asanaIntegration } from './integration';
import type { AsanaClient } from './helpers';
import type {
  AsanaTaskShape,
  AsanaWorkspaceShape,
  AsanaProjectShape,
  AsanaSectionShape,
  AsanaUserShape,
  AsanaTagShape,
  AsanaSubtaskShape,
  AsanaStoryShape,
  AsanaMutationResult,
  AsanaCustomFieldValue,
  AsanaTaskProjectRef,
} from './helpers';
import * as api from './api';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getAsanaClient(ctx: any): Promise<AsanaClient> {
  const client = await ctx.getIntegrationClient?.('asana');
  if (!client) {
    throw new GraphQLError('Asana integration is not available. Add your API token in Settings.', {
      extensions: { code: 'INTEGRATION_NOT_AVAILABLE' },
    });
  }
  return client as AsanaClient;
}

async function getAsanaClientOrNull(ctx: any): Promise<AsanaClient | null> {
  const client = await ctx.getIntegrationClient?.('asana');
  return (client as AsanaClient) ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema Registration
// ─────────────────────────────────────────────────────────────────────────────

export function registerAsanaSchema(rawBuilder: unknown): void {
  const builder = rawBuilder as any;

  // ── Object Types ─────────────────────────────────────────────────────────

  // @ts-expect-error — builder type args not available across .d.ts boundary
  const AsanaWorkspaceRef = builder.objectRef<AsanaWorkspaceShape>('AsanaWorkspace');
  builder.objectType(AsanaWorkspaceRef, {
    description: 'An Asana workspace or organization',
    fields: (t: any) => ({
      gid: t.exposeString('gid'),
      name: t.exposeString('name'),
      isOrganization: t.exposeBoolean('isOrganization'),
    }),
  });

  // @ts-expect-error — builder type args not available across .d.ts boundary
  const AsanaProjectRef = builder.objectRef<AsanaProjectShape>('AsanaProject');
  builder.objectType(AsanaProjectRef, {
    description: 'An Asana project',
    fields: (t: any) => ({
      gid: t.exposeString('gid'),
      name: t.exposeString('name'),
      color: t.exposeString('color', { nullable: true }),
      archived: t.exposeBoolean('archived'),
      workspaceGid: t.exposeString('workspaceGid'),
      workspaceName: t.exposeString('workspaceName', { nullable: true }),
    }),
  });

  // @ts-expect-error — builder type args not available across .d.ts boundary
  const AsanaSectionRef = builder.objectRef<AsanaSectionShape>('AsanaSection');
  builder.objectType(AsanaSectionRef, {
    description: 'A section within an Asana project',
    fields: (t: any) => ({
      gid: t.exposeString('gid'),
      name: t.exposeString('name'),
      projectGid: t.exposeString('projectGid'),
    }),
  });

  // @ts-expect-error — builder type args not available across .d.ts boundary
  const AsanaUserRef = builder.objectRef<AsanaUserShape>('AsanaUser');
  builder.objectType(AsanaUserRef, {
    description: 'An Asana user',
    fields: (t: any) => ({
      gid: t.exposeString('gid'),
      name: t.exposeString('name'),
      email: t.exposeString('email', { nullable: true }),
    }),
  });

  // @ts-expect-error — builder type args not available across .d.ts boundary
  const AsanaTagRef = builder.objectRef<AsanaTagShape>('AsanaTag');
  builder.objectType(AsanaTagRef, {
    description: 'An Asana tag',
    fields: (t: any) => ({
      gid: t.exposeString('gid'),
      name: t.exposeString('name'),
      color: t.exposeString('color', { nullable: true }),
    }),
  });

  // @ts-expect-error — builder type args not available across .d.ts boundary
  const AsanaTaskProjectRefType = builder.objectRef<AsanaTaskProjectRef>('AsanaTaskProjectRef');
  builder.objectType(AsanaTaskProjectRefType, {
    description: 'A project reference on an Asana task',
    fields: (t: any) => ({
      gid: t.exposeString('gid'),
      name: t.exposeString('name'),
    }),
  });

  // @ts-expect-error — builder type args not available across .d.ts boundary
  const AsanaCustomFieldRef = builder.objectRef<AsanaCustomFieldValue>('AsanaCustomField');
  builder.objectType(AsanaCustomFieldRef, {
    description: 'A custom field value on an Asana task',
    fields: (t: any) => ({
      gid: t.exposeString('gid'),
      name: t.exposeString('name'),
      type: t.exposeString('type'),
      displayValue: t.exposeString('displayValue', { nullable: true }),
    }),
  });

  // @ts-expect-error — builder type args not available across .d.ts boundary
  const AsanaTaskRef = builder.objectRef<AsanaTaskShape>('AsanaTask');
  builder.objectType(AsanaTaskRef, {
    description: 'An Asana task',
    fields: (t: any) => ({
      gid: t.exposeString('gid'),
      name: t.exposeString('name'),
      completed: t.exposeBoolean('completed'),
      completedAt: t.exposeString('completedAt', { nullable: true }),
      assigneeGid: t.exposeString('assigneeGid', { nullable: true }),
      assigneeName: t.exposeString('assigneeName', { nullable: true }),
      dueOn: t.exposeString('dueOn', { nullable: true }),
      dueAt: t.exposeString('dueAt', { nullable: true }),
      startOn: t.exposeString('startOn', { nullable: true }),
      notes: t.exposeString('notes', { nullable: true }),
      htmlNotes: t.exposeString('htmlNotes', { nullable: true }),
      projects: t.field({ type: [AsanaTaskProjectRefType], resolve: (task: AsanaTaskShape) => task.projects ?? [] }),
      sectionGid: t.exposeString('sectionGid', { nullable: true }),
      sectionName: t.exposeString('sectionName', { nullable: true }),
      tags: t.field({ type: [AsanaTagRef], resolve: (task: AsanaTaskShape) => task.tags ?? [] }),
      parentGid: t.exposeString('parentGid', { nullable: true }),
      parentName: t.exposeString('parentName', { nullable: true }),
      numSubtasks: t.exposeInt('numSubtasks'),
      permalink: t.exposeString('permalink', { nullable: true }),
      createdAt: t.exposeString('createdAt', { nullable: true }),
      modifiedAt: t.exposeString('modifiedAt', { nullable: true }),
      customFields: t.field({ type: [AsanaCustomFieldRef], resolve: (task: AsanaTaskShape) => task.customFields ?? [] }),
    }),
  });

  // @ts-expect-error — builder type args not available across .d.ts boundary
  const AsanaSubtaskRef = builder.objectRef<AsanaSubtaskShape>('AsanaSubtask');
  builder.objectType(AsanaSubtaskRef, {
    description: 'A subtask of an Asana task',
    fields: (t: any) => ({
      gid: t.exposeString('gid'),
      name: t.exposeString('name'),
      completed: t.exposeBoolean('completed'),
      assigneeName: t.exposeString('assigneeName', { nullable: true }),
      dueOn: t.exposeString('dueOn', { nullable: true }),
    }),
  });

  // @ts-expect-error — builder type args not available across .d.ts boundary
  const AsanaStoryRef = builder.objectRef<AsanaStoryShape>('AsanaStory');
  builder.objectType(AsanaStoryRef, {
    description: 'A story (comment or system event) on an Asana task',
    fields: (t: any) => ({
      gid: t.exposeString('gid'),
      text: t.exposeString('text'),
      htmlText: t.exposeString('htmlText', { nullable: true }),
      type: t.exposeString('type'),
      createdAt: t.exposeString('createdAt'),
      createdByName: t.exposeString('createdByName', { nullable: true }),
    }),
  });

  // @ts-expect-error — builder type args not available across .d.ts boundary
  const AsanaMutationResultRef = builder.objectRef<AsanaMutationResult>('AsanaMutationResult');
  builder.objectType(AsanaMutationResultRef, {
    description: 'Result of an Asana mutation',
    fields: (t: any) => ({
      success: t.exposeBoolean('success'),
      message: t.exposeString('message'),
    }),
  });

  // ── Input Types ──────────────────────────────────────────────────────────

  const CreateAsanaTaskInput = builder.inputType('CreateAsanaTaskInput', {
    fields: (t: any) => ({
      name: t.string({ required: true }),
      workspaceGid: t.string({ required: true, description: 'Workspace GID' }),
      projectGid: t.string({ description: 'Project GID to add task to' }),
      sectionGid: t.string({ description: 'Section GID to place task in' }),
      assigneeGid: t.string({ description: 'User GID to assign' }),
      notes: t.string({ description: 'Task description (plain text)' }),
      dueOn: t.string({ description: 'Due date in YYYY-MM-DD format' }),
      startOn: t.string({ description: 'Start date in YYYY-MM-DD format' }),
      tagGids: t.stringList({ description: 'Tag GIDs to attach' }),
      parentGid: t.string({ description: 'Parent task GID for subtasks' }),
    }),
  });

  const UpdateAsanaTaskInput = builder.inputType('UpdateAsanaTaskInput', {
    fields: (t: any) => ({
      name: t.string(),
      completed: t.boolean(),
      assigneeGid: t.string({ description: 'User GID, or null to unassign' }),
      notes: t.string({ description: 'Task description (plain text)' }),
      dueOn: t.string({ description: 'Due date YYYY-MM-DD, or null to clear' }),
      startOn: t.string({ description: 'Start date YYYY-MM-DD, or null to clear' }),
    }),
  });

  // ── Queries ──────────────────────────────────────────────────────────────

  builder.queryFields((t: any) => ({
    asanaTask: t.field({
      type: AsanaTaskRef,
      nullable: true,
      description: 'Get a single Asana task by GID',
      args: { gid: t.arg.string({ required: true }) },
      resolve: async (_root: any, args: any, ctx: any) => {
        const client = await getAsanaClient(ctx);
        return api.getTask(client, { taskGid: args.gid });
      },
    }),

    asanaTasks: t.field({
      type: [AsanaTaskRef],
      description: 'List Asana tasks for a project. Returns empty array if not authenticated.',
      args: {
        projectGid: t.arg.string({ required: true, description: 'Project GID' }),
        completedSince: t.arg.string({ description: '"now" for incomplete only, or ISO date' }),
        limit: t.arg.int({ defaultValue: 50 }),
      },
      resolve: async (_root: any, args: any, ctx: any) => {
        const client = await getAsanaClientOrNull(ctx);
        if (!client) return [];
        return api.listTasksForProject(client, {
          projectGid: args.projectGid,
          completedSince: args.completedSince ?? undefined,
          limit: args.limit ?? 50,
        });
      },
    }),

    asanaTasksForSection: t.field({
      type: [AsanaTaskRef],
      description: 'List Asana tasks for a section',
      args: {
        sectionGid: t.arg.string({ required: true }),
        completedSince: t.arg.string(),
        limit: t.arg.int({ defaultValue: 50 }),
      },
      resolve: async (_root: any, args: any, ctx: any) => {
        const client = await getAsanaClient(ctx);
        return api.listTasksForSection(client, {
          sectionGid: args.sectionGid,
          completedSince: args.completedSince ?? undefined,
          limit: args.limit ?? 50,
        });
      },
    }),

    asanaTasksForAssignee: t.field({
      type: [AsanaTaskRef],
      description: 'List Asana tasks assigned to a user in a workspace',
      args: {
        workspaceGid: t.arg.string({ required: true }),
        assigneeGid: t.arg.string({ required: true, description: 'User GID or "me"' }),
        completedSince: t.arg.string(),
        limit: t.arg.int({ defaultValue: 50 }),
      },
      resolve: async (_root: any, args: any, ctx: any) => {
        const client = await getAsanaClient(ctx);
        return api.listTasksForAssignee(client, {
          workspaceGid: args.workspaceGid,
          assigneeGid: args.assigneeGid,
          completedSince: args.completedSince ?? undefined,
          limit: args.limit ?? 50,
        });
      },
    }),

    asanaSearchTasks: t.field({
      type: [AsanaTaskRef],
      description: 'Search Asana tasks (requires premium workspace)',
      args: {
        workspaceGid: t.arg.string({ required: true }),
        text: t.arg.string(),
        assigneeGid: t.arg.string(),
        projectGid: t.arg.string(),
        sectionGid: t.arg.string(),
        completed: t.arg.boolean(),
        dueBefore: t.arg.string({ description: 'YYYY-MM-DD' }),
        dueAfter: t.arg.string({ description: 'YYYY-MM-DD' }),
        sortBy: t.arg.string({ description: 'due_date, created_at, modified_at, or likes' }),
        sortAscending: t.arg.boolean(),
        limit: t.arg.int({ defaultValue: 50 }),
      },
      resolve: async (_root: any, args: any, ctx: any) => {
        const client = await getAsanaClient(ctx);
        return api.searchTasks(client, {
          workspaceGid: args.workspaceGid,
          text: args.text ?? undefined,
          assigneeGid: args.assigneeGid ?? undefined,
          projectGid: args.projectGid ?? undefined,
          sectionGid: args.sectionGid ?? undefined,
          completed: args.completed ?? undefined,
          dueBefore: args.dueBefore ?? undefined,
          dueAfter: args.dueAfter ?? undefined,
          sortBy: args.sortBy ?? undefined,
          sortAscending: args.sortAscending ?? undefined,
          limit: args.limit ?? 50,
        });
      },
    }),

    asanaWorkspaces: t.field({
      type: [AsanaWorkspaceRef],
      description: 'List Asana workspaces. Returns empty array if not authenticated.',
      resolve: async (_root: any, _args: any, ctx: any) => {
        const client = await getAsanaClientOrNull(ctx);
        if (!client) return [];
        return api.listWorkspaces(client);
      },
    }),

    asanaProjects: t.field({
      type: [AsanaProjectRef],
      description: 'List projects in a workspace',
      args: {
        workspaceGid: t.arg.string({ required: true }),
        archived: t.arg.boolean({ defaultValue: false }),
      },
      resolve: async (_root: any, args: any, ctx: any) => {
        const client = await getAsanaClient(ctx);
        return api.listProjects(client, {
          workspaceGid: args.workspaceGid,
          archived: args.archived ?? false,
        });
      },
    }),

    asanaSections: t.field({
      type: [AsanaSectionRef],
      description: 'List sections in a project',
      args: { projectGid: t.arg.string({ required: true }) },
      resolve: async (_root: any, args: any, ctx: any) => {
        const client = await getAsanaClient(ctx);
        return api.listSections(client, { projectGid: args.projectGid });
      },
    }),

    asanaMe: t.field({
      type: AsanaUserRef,
      nullable: true,
      description: 'Get the currently authenticated Asana user',
      resolve: async (_root: any, _args: any, ctx: any) => {
        const client = await getAsanaClientOrNull(ctx);
        if (!client) return null;
        return api.getMe(client);
      },
    }),

    asanaUsers: t.field({
      type: [AsanaUserRef],
      description: 'List users in a workspace',
      args: { workspaceGid: t.arg.string({ required: true }) },
      resolve: async (_root: any, args: any, ctx: any) => {
        const client = await getAsanaClient(ctx);
        return api.listUsers(client, { workspaceGid: args.workspaceGid });
      },
    }),

    asanaTags: t.field({
      type: [AsanaTagRef],
      description: 'List tags in a workspace',
      args: { workspaceGid: t.arg.string({ required: true }) },
      resolve: async (_root: any, args: any, ctx: any) => {
        const client = await getAsanaClient(ctx);
        return api.listTags(client, { workspaceGid: args.workspaceGid });
      },
    }),

    asanaSubtasks: t.field({
      type: [AsanaSubtaskRef],
      description: 'List subtasks of a task',
      args: { taskGid: t.arg.string({ required: true }) },
      resolve: async (_root: any, args: any, ctx: any) => {
        const client = await getAsanaClient(ctx);
        return api.listSubtasks(client, { taskGid: args.taskGid });
      },
    }),

    asanaStories: t.field({
      type: [AsanaStoryRef],
      description: 'List stories (comments) on a task',
      args: {
        taskGid: t.arg.string({ required: true }),
        commentsOnly: t.arg.boolean({ defaultValue: true }),
      },
      resolve: async (_root: any, args: any, ctx: any) => {
        const client = await getAsanaClient(ctx);
        return api.listStories(client, {
          taskGid: args.taskGid,
          type: args.commentsOnly ? 'comment' : undefined,
        });
      },
    }),
  }));

  // ── Mutations ────────────────────────────────────────────────────────────

  builder.mutationFields((t: any) => ({
    createAsanaTask: t.field({
      type: AsanaTaskRef,
      nullable: true,
      description: 'Create a new Asana task',
      args: { input: t.arg({ type: CreateAsanaTaskInput, required: true }) },
      resolve: async (_root: any, args: any, ctx: any) => {
        const client = await getAsanaClient(ctx);
        return api.createTask(client, {
          name: args.input.name,
          workspaceGid: args.input.workspaceGid,
          projectGid: args.input.projectGid ?? undefined,
          sectionGid: args.input.sectionGid ?? undefined,
          assigneeGid: args.input.assigneeGid ?? undefined,
          notes: args.input.notes ?? undefined,
          dueOn: args.input.dueOn ?? undefined,
          startOn: args.input.startOn ?? undefined,
          tagGids: args.input.tagGids ?? undefined,
          parentGid: args.input.parentGid ?? undefined,
        });
      },
    }),

    updateAsanaTask: t.field({
      type: AsanaTaskRef,
      nullable: true,
      description: 'Update an existing Asana task',
      args: {
        gid: t.arg.string({ required: true }),
        input: t.arg({ type: UpdateAsanaTaskInput, required: true }),
      },
      resolve: async (_root: any, args: any, ctx: any) => {
        const client = await getAsanaClient(ctx);
        return api.updateTask(client, {
          taskGid: args.gid,
          name: args.input.name ?? undefined,
          completed: args.input.completed ?? undefined,
          assigneeGid: args.input.assigneeGid,
          notes: args.input.notes ?? undefined,
          dueOn: args.input.dueOn,
          startOn: args.input.startOn,
        });
      },
    }),

    deleteAsanaTask: t.field({
      type: AsanaMutationResultRef,
      description: 'Delete an Asana task permanently',
      args: { gid: t.arg.string({ required: true }) },
      resolve: async (_root: any, args: any, ctx: any) => {
        const client = await getAsanaClient(ctx);
        return api.deleteTask(client, { taskGid: args.gid });
      },
    }),

    addAsanaComment: t.field({
      type: AsanaMutationResultRef,
      description: 'Add a comment to an Asana task',
      args: {
        taskGid: t.arg.string({ required: true }),
        text: t.arg.string({ required: true }),
      },
      resolve: async (_root: any, args: any, ctx: any) => {
        const client = await getAsanaClient(ctx);
        return api.addComment(client, { taskGid: args.taskGid, text: args.text });
      },
    }),

    addAsanaTagToTask: t.field({
      type: AsanaMutationResultRef,
      description: 'Add a tag to an Asana task',
      args: {
        taskGid: t.arg.string({ required: true }),
        tagGid: t.arg.string({ required: true }),
      },
      resolve: async (_root: any, args: any, ctx: any) => {
        const client = await getAsanaClient(ctx);
        return api.addTagToTask(client, { taskGid: args.taskGid, tagGid: args.tagGid });
      },
    }),

    removeAsanaTagFromTask: t.field({
      type: AsanaMutationResultRef,
      description: 'Remove a tag from an Asana task',
      args: {
        taskGid: t.arg.string({ required: true }),
        tagGid: t.arg.string({ required: true }),
      },
      resolve: async (_root: any, args: any, ctx: any) => {
        const client = await getAsanaClient(ctx);
        return api.removeTagFromTask(client, { taskGid: args.taskGid, tagGid: args.tagGid });
      },
    }),

    moveAsanaTaskToSection: t.field({
      type: AsanaMutationResultRef,
      description: 'Move a task to a different section',
      args: {
        taskGid: t.arg.string({ required: true }),
        sectionGid: t.arg.string({ required: true }),
      },
      resolve: async (_root: any, args: any, ctx: any) => {
        const client = await getAsanaClient(ctx);
        return api.moveTaskToSection(client, {
          taskGid: args.taskGid,
          sectionGid: args.sectionGid,
        });
      },
    }),
  }));

  // ── Entity Handler Registration ──────────────────────────────────────────

  const taskUriPath = { segments: ['gid'] as const };

  builder.registerEntityHandlers(asanaTaskEntity, {
    integrations: { asana: asanaIntegration },
    resolve: async (id: Record<string, string>, ctx: any) => {
      const client = ctx.integrations.asana.client as AsanaClient;
      if (!client) return null;
      try {
        const task = await api.getTask(client, { taskGid: id['gid'] });
        if (!task) return null;
        return {
          id: task.gid,
          type: 'asana_task',
          uri: buildEntityURI('asana_task', id, taskUriPath),
          title: task.name,
          description: task.completed ? 'Completed' : (task.sectionName ?? 'Open'),
          createdAt: task.createdAt ? new Date(task.createdAt).getTime() : undefined,
          updatedAt: task.modifiedAt ? new Date(task.modifiedAt).getTime() : undefined,
        } as BaseEntity;
      } catch {
        return null;
      }
    },
    search: async (query: any, ctx: any) => {
      const client = ctx.integrations.asana.client as AsanaClient;
      if (!client) return [];
      try {
        // Search requires a workspace, try to get the first one
        const workspaces = await api.listWorkspaces(client);
        if (workspaces.length === 0) return [];
        const results = await api.searchTasks(client, {
          workspaceGid: workspaces[0].gid,
          text: query.query || '',
          limit: query.limit ?? 20,
        });
        return results.map((task) => ({
          id: task.gid,
          type: 'asana_task',
          uri: buildEntityURI('asana_task', { gid: task.gid }, taskUriPath),
          title: task.name,
          description: task.completed ? 'Completed' : (task.sectionName ?? 'Open'),
          createdAt: task.createdAt ? new Date(task.createdAt).getTime() : undefined,
          updatedAt: task.modifiedAt ? new Date(task.modifiedAt).getTime() : undefined,
        } as BaseEntity));
      } catch {
        return [];
      }
    },
    resolveContext: async (entity: BaseEntity) => {
      return `### Asana Task: ${entity.title}\n- **URI:** ${entity.uri}`;
    },
  });
}
