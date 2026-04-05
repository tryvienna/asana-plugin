/**
 * useAsanaSettings — Persistent settings for the Asana nav section.
 *
 * Settings are stored in localStorage, scoped to the plugin.
 * Uses CustomEvent for cross-component synchronization (nav <-> settings drawer).
 */

import { useState, useEffect, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AsanaSettings {
  /** Workspace GID, or 'all' */
  workspaceGid: string;
  /** Project GID to filter by, or 'all' */
  projectGid: string;
  /** Section GID to filter by, or 'all' */
  sectionGid: string;
  /** Assignment filter mode */
  assignment: 'all' | 'assigned_to_me';
  /** Completion status filter */
  completionStatus: 'incomplete' | 'completed' | 'all';
  /** Due date filter */
  dueDate: 'all' | 'overdue' | 'due_this_week' | 'due_next_week' | 'no_due_date';
  /** How to group tasks in the nav */
  groupBy: 'none' | 'project' | 'section' | 'assignee' | 'due_date';
  /** Max items to fetch */
  limit: number;
}

export const DEFAULT_SETTINGS: AsanaSettings = {
  workspaceGid: 'all',
  projectGid: 'all',
  sectionGid: 'all',
  assignment: 'all',
  completionStatus: 'incomplete',
  dueDate: 'all',
  groupBy: 'none',
  limit: 50,
};

// ─────────────────────────────────────────────────────────────────────────────
// Storage
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'vienna-plugin:asana:settings';
const CHANGE_EVENT = 'vienna-plugin:asana:settings-changed';

function loadSettings(): AsanaSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(settings: AsanaSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  } catch {
    // localStorage unavailable
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useAsanaSettings() {
  const [settings, setSettingsState] = useState(loadSettings);

  useEffect(() => {
    const handler = () => setSettingsState(loadSettings());
    window.addEventListener(CHANGE_EVENT, handler);
    return () => window.removeEventListener(CHANGE_EVENT, handler);
  }, []);

  const updateSettings = useCallback((patch: Partial<AsanaSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      // Reset section when project changes
      if (patch.projectGid && patch.projectGid !== prev.projectGid && !patch.sectionGid) {
        next.sectionGid = 'all';
      }
      // Reset project and section when workspace changes
      if (patch.workspaceGid && patch.workspaceGid !== prev.workspaceGid) {
        if (!patch.projectGid) next.projectGid = 'all';
        if (!patch.sectionGid) next.sectionGid = 'all';
      }
      saveSettings(next);
      return next;
    });
  }, []);

  const resetSettings = useCallback(() => {
    saveSettings(DEFAULT_SETTINGS);
    setSettingsState(DEFAULT_SETTINGS);
  }, []);

  return { settings, updateSettings, resetSettings };
}
