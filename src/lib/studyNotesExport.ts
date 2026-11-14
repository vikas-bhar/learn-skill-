import { VideoSynthesis } from '../types/learning';

export function buildStudyNotesMarkdown(synthesis: VideoSynthesis | null): string {
  if (!synthesis) return '';
  return [
    synthesis.videoTitle,
    '========================================',
    '',
    synthesis.executiveSummary,
    '',
    'Key Takeaways',
    '----------------------------------------',
    ...synthesis.keyTakeaways.map((t) => `- ${t}`),
    '',
    'Structured Study Notes',
    '----------------------------------------',
    ...synthesis.structuredNotes.flatMap((s) => [
      `${s.heading} (${s.timestampHint})`,
      ...s.bullets.map((b) => `- ${b}`),
      '',
    ]),
    ...(synthesis.commonMistakes?.length
      ? [
          'Common Mistakes',
          '----------------------------------------',
          ...synthesis.commonMistakes.map((m) => `- ${m}`),
          '',
        ]
      : []),
    ...(synthesis.practiceTask
      ? ['Practice Task', '----------------------------------------', synthesis.practiceTask, '']
      : []),
    'Concept Flowchart (Mermaid)',
    '----------------------------------------',
    synthesis.mermaidFlowchart,
  ].join('\n');
}

export function buildNotesFilename(videoId: string): string {
  const safeId = videoId.replace(/[^a-zA-Z0-9_-]+/g, '') || 'module';
  return `${safeId}-study-notes.txt`;
}
