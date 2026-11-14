import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  clearDemoState,
  formatDemoSavedTime,
  loadDemoState,
  saveDemoState,
} from '../src/lib/demoStorage.ts';

function createMemoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  };
}

const originalWindow = (globalThis as { window?: unknown }).window;

beforeEach(() => {
  (globalThis as { window?: unknown }).window = {
    localStorage: createMemoryStorage(),
  };
});

afterEach(() => {
  if (originalWindow === undefined) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    (globalThis as { window?: unknown }).window = originalWindow;
  }
});

describe('demoStorage persistence', () => {
  it('saves, loads, and clears Demo Mode state cleanly', () => {
    const savedTs = saveDemoState({
      screen: 'dashboard',
      dashboardTab: 'roadmap',
      profile: {
        topic: 'Python',
        goal: 'Build a portfolio project',
        pace: 'consistent',
        dailyMinutes: 45,
        estimatedLevel: 'Intermediate',
        confidenceScore: 72,
        strengths: ['Syntax'],
        knowledgeGaps: ['AsyncIO'],
        readyForSkillTree: true,
        turnCount: 3,
      },
      messages: [],
      skillTree: null,
      selectedNodeId: 'node-1',
      videos: [],
      selectedVideo: null,
      bookmarkedIds: { abc123: true },
      synthesis: null,
      videoTestResults: [],
      finalExam: null,
      capstoneProjects: [],
      certificate: null,
      scoreProfile: {
        totalScore: 150,
        testsCompleted: 1,
        videosCompleted: 1,
        certificatesEarned: 0,
      },
    });

    assert.equal(typeof savedTs, 'number');

    const loaded = loadDemoState();
    assert.ok(loaded);
    assert.equal(loaded.profile.topic, 'Python');
    assert.equal(loaded.dashboardTab, 'roadmap');
    assert.equal(loaded.scoreProfile.totalScore, 150);
    assert.equal(loaded.bookmarkedIds.abc123, true);

    clearDemoState();
    assert.equal(loadDemoState(), null);
  });

  it('recovers safely from corrupted or mismatched localStorage payloads', () => {
    const win = (globalThis as unknown as { window: { localStorage: ReturnType<typeof createMemoryStorage> } }).window;
    win.localStorage.setItem('skillpath_demo_state_v1', '{broken-json');
    assert.equal(loadDemoState(), null);

    win.localStorage.setItem(
      'skillpath_demo_state_v1',
      JSON.stringify({ version: 99, profile: { topic: 'Old' }, lastSavedAt: 123 })
    );
    assert.equal(loadDemoState(), null);
  });

  it('formats saved timestamps cleanly', () => {
    assert.equal(formatDemoSavedTime(null), 'Just now');
    const formatted = formatDemoSavedTime(Date.now());
    assert.ok(formatted.length > 0);
  });
});
