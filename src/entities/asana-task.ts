import { defineEntity } from '@tryvienna/sdk';
import { ASANA_ENTITY_URI_SEGMENTS } from './uri';
import { AsanaTaskEntityDrawer } from '../ui/AsanaTaskEntityDrawer';

const ASANA_TASK_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>';

export const asanaTaskEntity = defineEntity({
  type: 'asana_task',
  name: 'Asana Task',
  description: 'A task from Asana project management',
  icon: { svg: ASANA_TASK_SVG },
  source: 'integration',
  uri: [...ASANA_ENTITY_URI_SEGMENTS],

  display: {
    emoji: '\u2705',
    colors: { bg: '#F06A6A', text: '#FFFFFF', border: '#E8616B' },
    description: 'Asana project management tasks',
    outputFields: [
      { key: 'name', label: 'Name', metadataPath: 'name' },
      { key: 'completed', label: 'Completed', metadataPath: 'completed' },
      { key: 'assignee', label: 'Assignee', metadataPath: 'assigneeName' },
      { key: 'project', label: 'Project', metadataPath: 'projects[0].name' },
      { key: 'section', label: 'Section', metadataPath: 'sectionName' },
      { key: 'dueOn', label: 'Due Date', metadataPath: 'dueOn' },
      { key: 'tags', label: 'Tags', metadataPath: 'tags' },
      { key: 'permalink', label: 'URL', metadataPath: 'permalink' },
    ],
  },

  cache: { ttl: 30_000, maxSize: 200 },

  ui: { drawer: AsanaTaskEntityDrawer },
});
