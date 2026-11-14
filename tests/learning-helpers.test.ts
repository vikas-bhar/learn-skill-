import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCertificateFilename,
  formatReadableDate,
  sanitizeTextForCanvas,
} from '../src/lib/certificateCanvas.ts';
import {
  buildFallbackStudyPlan,
  computeRoadmapStats,
  getNodeStatusLabel,
  getTierLabel,
} from '../src/lib/roadmapUtils.ts';
import {
  buildNotesFilename,
  buildStudyNotesMarkdown,
} from '../src/lib/studyNotesExport.ts';
import type { SkillTreeData, VideoSynthesis } from '../src/types/learning.ts';

describe('roadmapUtils', () => {
  it('computes progress percentage, mastered count, and current focus node accurately', () => {
    const tree: SkillTreeData = {
      topic: 'Python',
      generatedAt: new Date().toISOString(),
      recommendedNextId: 'n2',
      nodes: [
        {
          id: 'n1',
          title: 'Syntax Basics',
          tier: 1,
          status: 'mastered',
          estimatedMinutes: 30,
          summary: 'Core syntax',
          whyItMatters: 'Foundation',
          prerequisites: [],
          keyConcepts: ['variables'],
          learningObjectives: ['Understand variables and control flow'],
          diagnosticRationale: 'Verified in diagnostic',
          youtubeSearchQuery: 'python syntax basics tutorial',
        },
        {
          id: 'n2',
          title: 'AsyncIO',
          tier: 2,
          status: 'ready',
          estimatedMinutes: 45,
          summary: 'Concurrency',
          whyItMatters: 'Scalable I/O',
          prerequisites: ['n1'],
          keyConcepts: ['await'],
          learningObjectives: ['Write async/await coroutines'],
          diagnosticRationale: 'Next recommended module',
          youtubeSearchQuery: 'python asyncio tutorial',
        },
        {
          id: 'n3',
          title: 'FastAPI',
          tier: 3,
          status: 'locked',
          estimatedMinutes: 60,
          summary: 'Web endpoints',
          whyItMatters: 'Production APIs',
          prerequisites: ['n2'],
          keyConcepts: ['routes'],
          learningObjectives: ['Build typed HTTP endpoints'],
          diagnosticRationale: 'Unlocks after AsyncIO',
          youtubeSearchQuery: 'python fastapi tutorial',
        },
      ],
      edges: [
        { source: 'n1', target: 'n2' },
        { source: 'n2', target: 'n3' },
      ],
      studyPlan: [],
    };

    const stats = computeRoadmapStats(tree);
    assert.equal(stats.totalCount, 3);
    assert.equal(stats.masteredCount, 1);
    assert.equal(stats.progressPct, 33);
    assert.equal(stats.allModulesMastered, false);
    assert.equal(stats.currentFocusNode?.id, 'n2');

    assert.equal(getTierLabel(1), 'Foundations');
    assert.equal(getTierLabel(4), 'Synthesis');
    assert.equal(getNodeStatusLabel('ready'), 'Current Focus');

    const fallbackPlan = buildFallbackStudyPlan(tree.nodes);
    assert.equal(fallbackPlan.length, 3);
    assert.equal(fallbackPlan[0].completed, true);
    assert.equal(fallbackPlan[1].dateLabel, 'Day 2');
  });
});

describe('studyNotesExport', () => {
  it('formats complete study notes markdown and sanitized download filenames', () => {
    const synthesis: VideoSynthesis = {
      videoId: 'abc-123',
      videoTitle: 'Async Python Deep Dive',
      executiveSummary: 'Covers event loops and tasks.',
      keyTakeaways: ['Use asyncio.gather for concurrent tasks'],
      structuredNotes: [
        {
          heading: 'Event Loop',
          timestampHint: '02:15',
          bullets: ['Schedules coroutines cleanly'],
        },
      ],
      commonMistakes: ['Blocking the loop with time.sleep'],
      practiceTask: 'Fetch 3 URLs concurrently.',
      studyChecklist: ['Trace event loop ticks'],
      mermaidFlowchart: 'flowchart TD\nA[Start] --> B[Await]',
    };

    const md = buildStudyNotesMarkdown(synthesis);
    assert.match(md, /Async Python Deep Dive/);
    assert.match(md, /Key Takeaways/);
    assert.match(md, /Event Loop \(02:15\)/);
    assert.match(md, /Blocking the loop with time\.sleep/);
    assert.match(md, /flowchart TD/);
    assert.equal(buildStudyNotesMarkdown(null), '');
    assert.equal(buildNotesFilename('abc/123?x=1'), 'abc123x1-study-notes.txt');
  });
});

describe('certificateCanvas helpers', () => {
  it('builds clean filenames, readable dates, and symbol-sanitized certificate text', () => {
    assert.equal(
      buildCertificateFilename('UI/UX Design & Prototyping'),
      'skillpath-certificate-ui-ux-design-prototyping.png'
    );
    assert.equal(
      sanitizeTextForCanvas('React & TypeScript *Pro* #1'),
      'React and TypeScript Pro 1'
    );
    assert.equal(formatReadableDate('not-a-date'), 'not-a-date');
  });
});
