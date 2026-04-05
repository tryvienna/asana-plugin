/**
 * Asana Integration — PAT authentication + AsanaClient lifecycle.
 *
 * Uses Personal Access Tokens (PAT) for authentication.
 * The token is stored in secure storage via the credential management UI.
 * API operations are exposed exclusively through GraphQL (see schema.ts and api.ts).
 */

import { defineIntegration } from '@tryvienna/sdk';
import type { IntegrationDefinition } from '@tryvienna/sdk';
import type { AsanaClient } from './helpers';
import { registerAsanaSchema } from './schema';

// ─────────────────────────────────────────────────────────────────────────────
// Asana SVG Icon (tri-dot logo)
// ─────────────────────────────────────────────────────────────────────────────

const ASANA_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M363.8 105.3c-52.5 0-95 42.5-95 95s42.5 95 95 95 95-42.5 95-95-42.5-95-95-95zm-215.6 0c-52.5 0-95 42.5-95 95s42.5 95 95 95 95-42.5 95-95-42.5-95-95-95zm107.8 119.3c-52.5 0-95 42.5-95 95s42.5 95 95 95 95-42.5 95-95-42.5-95-95-95z"/></svg>';

// ─────────────────────────────────────────────────────────────────────────────
// Integration Definition
// ─────────────────────────────────────────────────────────────────────────────

export const asanaIntegration: IntegrationDefinition<AsanaClient> = defineIntegration<AsanaClient>({
  id: 'asana',
  name: 'Asana',
  description: 'Asana API for tasks, projects, and workspace management',
  icon: { svg: ASANA_SVG },

  credentials: ['api_token'],

  createClient: async (ctx) => {
    const apiToken = await ctx.storage.get('api_token');
    if (!apiToken) {
      ctx.logger.warn('No Asana API token configured');
      return null;
    }

    // Build an AsanaClient using the hostApi.fetch for CSP bypass.
    // The fetch function is available on the context at runtime.
    const fetchFn = (ctx as any).fetch ?? globalThis.fetch;

    return {
      token: apiToken,
      fetch: fetchFn,
    };
  },

  schema: registerAsanaSchema,
});

export { ASANA_SVG };
