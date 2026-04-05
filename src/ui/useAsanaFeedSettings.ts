/**
 * useAsanaFeedSettings — Persistent settings for the Asana feed canvas.
 *
 * Separate from useAsanaSettings (nav sidebar) so feed and sidebar
 * filters don't interfere with each other.
 *
 * Project/workspace context is read from the shared useAsanaSettings hook.
 */

import { useState, useEffect, useCallback } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AsanaFeedSettings {
  /** Due date filter */
  dueDate: 'all' | 'overdue' | 'due_this_week' | 'due_next_week' | 'no_due_date';
  /** Section GID filter, or 'all' */
  sectionGid: string;
  /** Sort field */
  sortBy: 'modified' | 'created' | 'due_date';
  /** Project GID filter for feed, or 'all' */
  projectGid: string;
  /** Completion status filter */
  completionStatus: 'incomplete' | 'completed' | 'all';
}

export const DEFAULT_FEED_SETTINGS: AsanaFeedSettings = {
  dueDate: 'all',
  sectionGid: 'all',
  sortBy: 'modified',
  projectGid: 'all',
  completionStatus: 'incomplete',
};

// ─────────────────────────────────────────────────────────────────────────────
// Storage
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'vienna-plugin:asana:feed-settings';
const CHANGE_EVENT = 'vienna-plugin:asana:feed-settings-changed';

function loadSettings(): AsanaFeedSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FEED_SETTINGS;
    return { ...DEFAULT_FEED_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_FEED_SETTINGS;
  }
}

function saveSettings(settings: AsanaFeedSettings): void {
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

export function useAsanaFeedSettings() {
  const [settings, setSettingsState] = useState(loadSettings);

  useEffect(() => {
    const handler = () => setSettingsState(loadSettings());
    window.addEventListener(CHANGE_EVENT, handler);
    return () => window.removeEventListener(CHANGE_EVENT, handler);
  }, []);

  const updateSettings = useCallback((patch: Partial<AsanaFeedSettings>) => {
    setSettingsState((prev) => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  }, []);

  return { settings, updateSettings };
}
