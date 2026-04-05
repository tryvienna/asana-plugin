/**
 * GraphQL operations for the Asana plugin UI.
 *
 * Import `gql` directly from graphql-tag (a platform external).
 */

import { gql } from 'graphql-tag';

// ── Nav section ────────────────────────────────────────────────────────────

export const GET_ASANA_TASKS = gql`
  query GetAsanaTasks($projectGid: String!, $completedSince: String, $limit: Int) {
    asanaTasks(projectGid: $projectGid, completedSince: $completedSince, limit: $limit) {
      gid
      name
      completed
      assigneeName
      dueOn
      sectionName
      permalink
      projects { gid name }
      tags { gid name color }
    }
  }
`;

export const GET_ASANA_TASKS_FOR_ASSIGNEE = gql`
  query GetAsanaTasksForAssignee($workspaceGid: String!, $assigneeGid: String!, $completedSince: String, $limit: Int) {
    asanaTasksForAssignee(workspaceGid: $workspaceGid, assigneeGid: $assigneeGid, completedSince: $completedSince, limit: $limit) {
      gid
      name
      completed
      assigneeName
      dueOn
      sectionName
      permalink
      projects { gid name }
      tags { gid name color }
    }
  }
`;

export const GET_ASANA_TASKS_FOR_SECTION = gql`
  query GetAsanaTasksForSection($sectionGid: String!, $completedSince: String, $limit: Int) {
    asanaTasksForSection(sectionGid: $sectionGid, completedSince: $completedSince, limit: $limit) {
      gid
      name
      completed
      assigneeName
      dueOn
      sectionName
      permalink
      projects { gid name }
      tags { gid name color }
    }
  }
`;

// ── Feed canvas ───────────────────────────────────────────────────────────

export const GET_ASANA_FEED_TASKS = gql`
  query GetAsanaFeedTasks($projectGid: String!, $completedSince: String, $limit: Int) {
    asanaTasks(projectGid: $projectGid, completedSince: $completedSince, limit: $limit) {
      gid
      name
      completed
      assigneeName
      dueOn
      sectionName
      permalink
      createdAt
      modifiedAt
      projects { gid name }
      tags { gid name color }
    }
  }
`;

export const GET_ASANA_FEED_TASKS_FOR_SECTION = gql`
  query GetAsanaFeedTasksForSection($sectionGid: String!, $completedSince: String, $limit: Int) {
    asanaTasksForSection(sectionGid: $sectionGid, completedSince: $completedSince, limit: $limit) {
      gid
      name
      completed
      assigneeName
      dueOn
      sectionName
      permalink
      createdAt
      modifiedAt
      projects { gid name }
      tags { gid name color }
    }
  }
`;

export const GET_ASANA_FEED_TASKS_FOR_ASSIGNEE = gql`
  query GetAsanaFeedTasksForAssignee($workspaceGid: String!, $assigneeGid: String!, $completedSince: String, $limit: Int) {
    asanaTasksForAssignee(workspaceGid: $workspaceGid, assigneeGid: $assigneeGid, completedSince: $completedSince, limit: $limit) {
      gid
      name
      completed
      assigneeName
      dueOn
      sectionName
      permalink
      createdAt
      modifiedAt
      projects { gid name }
      tags { gid name color }
    }
  }
`;

// ── Search (workspace-wide, no project required) ─────────────────────────

export const GET_ASANA_SEARCH_TASKS = gql`
  query GetAsanaSearchTasks(
    $workspaceGid: String!
    $completed: Boolean
    $assigneeGid: String
    $projectGid: String
    $sectionGid: String
    $dueBefore: String
    $dueAfter: String
    $sortBy: String
    $sortAscending: Boolean
    $limit: Int
  ) {
    asanaSearchTasks(
      workspaceGid: $workspaceGid
      completed: $completed
      assigneeGid: $assigneeGid
      projectGid: $projectGid
      sectionGid: $sectionGid
      dueBefore: $dueBefore
      dueAfter: $dueAfter
      sortBy: $sortBy
      sortAscending: $sortAscending
      limit: $limit
    ) {
      gid
      name
      completed
      assigneeName
      dueOn
      sectionName
      permalink
      createdAt
      modifiedAt
      projects { gid name }
      tags { gid name color }
    }
  }
`;

// ── Settings drawer ────────────────────────────────────────────────────────

export const GET_ASANA_WORKSPACES = gql`
  query GetAsanaWorkspaces {
    asanaWorkspaces { gid name isOrganization }
  }
`;

export const GET_ASANA_PROJECTS = gql`
  query GetAsanaProjects($workspaceGid: String!) {
    asanaProjects(workspaceGid: $workspaceGid) { gid name color archived }
  }
`;

export const GET_ASANA_SECTIONS = gql`
  query GetAsanaSections($projectGid: String!) {
    asanaSections(projectGid: $projectGid) { gid name projectGid }
  }
`;

export const GET_ASANA_ME = gql`
  query GetAsanaMe {
    asanaMe { gid name email }
  }
`;

// ── Entity drawer — task detail ─────────────────────────────────────────────

export const GET_ASANA_TASK = gql`
  query GetAsanaTask($gid: String!) {
    asanaTask(gid: $gid) {
      gid
      name
      completed
      completedAt
      assigneeGid
      assigneeName
      dueOn
      dueAt
      startOn
      notes
      htmlNotes
      projects { gid name }
      sectionGid
      sectionName
      tags { gid name color }
      parentGid
      parentName
      numSubtasks
      permalink
      createdAt
      modifiedAt
      customFields { gid name type displayValue }
    }
  }
`;

// ── Entity drawer — reference data ──────────────────────────────────────────

export const GET_ASANA_USERS = gql`
  query GetAsanaUsers($workspaceGid: String!) {
    asanaUsers(workspaceGid: $workspaceGid) { gid name email }
  }
`;

export const GET_ASANA_TAGS = gql`
  query GetAsanaTags($workspaceGid: String!) {
    asanaTags(workspaceGid: $workspaceGid) { gid name color }
  }
`;

export const GET_ASANA_SUBTASKS = gql`
  query GetAsanaSubtasks($taskGid: String!) {
    asanaSubtasks(taskGid: $taskGid) {
      gid name completed assigneeName dueOn
    }
  }
`;

export const GET_ASANA_STORIES = gql`
  query GetAsanaStories($taskGid: String!, $commentsOnly: Boolean) {
    asanaStories(taskGid: $taskGid, commentsOnly: $commentsOnly) {
      gid text htmlText type createdAt createdByName
    }
  }
`;

// ── Mutations ──────────────────────────────────────────────────────────────

export const CREATE_ASANA_TASK = gql`
  mutation CreateAsanaTask($input: CreateAsanaTaskInput!) {
    createAsanaTask(input: $input) {
      gid name completed assigneeGid assigneeName
      dueOn startOn notes
      projects { gid name }
      sectionGid sectionName
      tags { gid name color }
      permalink
    }
  }
`;

export const UPDATE_ASANA_TASK = gql`
  mutation UpdateAsanaTask($gid: String!, $input: UpdateAsanaTaskInput!) {
    updateAsanaTask(gid: $gid, input: $input) {
      gid name completed assigneeGid assigneeName
      dueOn startOn notes
      projects { gid name }
      sectionGid sectionName
      tags { gid name color }
      permalink
    }
  }
`;

export const DELETE_ASANA_TASK = gql`
  mutation DeleteAsanaTask($gid: String!) {
    deleteAsanaTask(gid: $gid) { success message }
  }
`;

export const ADD_ASANA_COMMENT = gql`
  mutation AddAsanaComment($taskGid: String!, $text: String!) {
    addAsanaComment(taskGid: $taskGid, text: $text) { success message }
  }
`;

export const ADD_ASANA_TAG_TO_TASK = gql`
  mutation AddAsanaTagToTask($taskGid: String!, $tagGid: String!) {
    addAsanaTagToTask(taskGid: $taskGid, tagGid: $tagGid) { success message }
  }
`;

export const REMOVE_ASANA_TAG_FROM_TASK = gql`
  mutation RemoveAsanaTagFromTask($taskGid: String!, $tagGid: String!) {
    removeAsanaTagFromTask(taskGid: $taskGid, tagGid: $tagGid) { success message }
  }
`;

export const MOVE_ASANA_TASK_TO_SECTION = gql`
  mutation MoveAsanaTaskToSection($taskGid: String!, $sectionGid: String!) {
    moveAsanaTaskToSection(taskGid: $taskGid, sectionGid: $sectionGid) { success message }
  }
`;

// ── Vienna workstream entity linking ──────────────────────────────────────

export const LINK_WORKSTREAM_ENTITY = gql`
  mutation LinkWorkstreamEntity($workstreamId: ID!, $entityUri: String!, $entityType: String!, $entityTitle: String) {
    linkWorkstreamEntity(workstreamId: $workstreamId, entityUri: $entityUri, entityType: $entityType, entityTitle: $entityTitle) {
      workstream { id }
    }
  }
`;
