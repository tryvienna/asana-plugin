/**
 * Entity definition tests.
 *
 * Since the SDK has deep transitive dependencies (Apollo, React) that aren't
 * available in the test environment, we mock `defineEntity` to pass through
 * the config. This tests our entity configuration values, not the SDK itself.
 */

import { describe, it, expect, vi } from 'vitest';

// Mock @tryvienna/sdk — defineEntity just returns its input (sealed)
vi.mock('@tryvienna/sdk', () => ({
  defineEntity: (config: any) => Object.freeze({ ...config, source: config.source ?? 'integration' }),
}));

// Mock the UI drawer component (it imports React)
vi.mock('../ui/AsanaTaskEntityDrawer', () => ({
  AsanaTaskEntityDrawer: () => null,
}));

// Now import after mocks are set up
const { asanaTaskEntity } = await import('../entities/asana-task');
const { ASANA_ENTITY_URI_SEGMENTS, ASANA_URI_PATH } = await import('../entities/uri');

describe('asanaTaskEntity', () => {
  it('has the correct type', () => {
    expect(asanaTaskEntity.type).toBe('asana_task');
  });

  it('has the correct name', () => {
    expect(asanaTaskEntity.name).toBe('Asana Task');
  });

  it('has source set to integration', () => {
    expect(asanaTaskEntity.source).toBe('integration');
  });

  it('has display colors', () => {
    expect(asanaTaskEntity.display!.colors.bg).toBe('#F06A6A');
    expect(asanaTaskEntity.display!.colors.text).toBe('#FFFFFF');
    expect(asanaTaskEntity.display!.colors.border).toBe('#E8616B');
  });

  it('has cache configuration', () => {
    expect(asanaTaskEntity.cache).toEqual({ ttl: 30_000, maxSize: 200 });
  });

  it('has output fields', () => {
    const fieldKeys = asanaTaskEntity.display!.outputFields?.map((f: any) => f.key);
    expect(fieldKeys).toContain('name');
    expect(fieldKeys).toContain('completed');
    expect(fieldKeys).toContain('assignee');
    expect(fieldKeys).toContain('dueOn');
    expect(fieldKeys).toContain('tags');
    expect(fieldKeys).toContain('permalink');
  });

  it('has an icon', () => {
    expect(asanaTaskEntity.icon).toBeDefined();
    expect((asanaTaskEntity.icon as { svg: string }).svg).toContain('<svg');
  });

  it('has uri segments', () => {
    expect(asanaTaskEntity.uri).toEqual(['gid']);
  });
});

describe('ASANA_ENTITY_URI_SEGMENTS', () => {
  it('has a single "gid" segment', () => {
    expect(ASANA_ENTITY_URI_SEGMENTS).toEqual(['gid']);
  });
});

describe('ASANA_URI_PATH', () => {
  it('has segments matching the URI segments', () => {
    expect(ASANA_URI_PATH.segments).toEqual(['gid']);
  });
});
