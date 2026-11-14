import React, { useEffect, useId, useState } from 'react';
import mermaid from 'mermaid';
import {
  Copy,
  Check,
  Download,
  RefreshCw,
  AlertTriangle,
  Sparkles,
  GitBranch,
  FileText,
  Loader2,
} from 'lucide-react';
import { SkillNode, VideoSynthesis } from '../types/learning';

interface StudyNotesViewProps {
  nodes: SkillNode[];
  selectedNodeId: string | null;
  synthesis: VideoSynthesis | null;
  isDark: boolean;
  isRegenerating: boolean;
  onSelectNode: (nodeId: string) => void;
  onRegenerateNotes: (node: SkillNode) => Promise<void>;
}

export const StudyNotesView: React.FC<StudyNotesViewProps> = ({
  nodes,
  selectedNodeId,
  synthesis,
  isDark,
  isRegenerating,
  onSelectNode,
  onRegenerateNotes,
}) => {
  const diagramBaseId = useId().replace(/:/g, '');
  const [mermaidSvg, setMermaidSvg] = useState('');
  const [mermaidErr, setMermaidErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showFlowchart, setShowFlowchart] = useState(true);

  const activeNode =
    nodes.find((n) => n.id === selectedNodeId) ||
    nodes.find((n) => n.status === 'ready') ||
    nodes[0] ||
    null;

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: isDark ? 'dark' : 'neutral',
      securityLevel: 'strict',
      flowchart: { curve: 'basis', htmlLabels: true },
    });
  }, [isDark]);

  useEffect(() => {
    let cancelled = false;
    async function renderFlow() {
      if (!synthesis?.mermaidFlowchart) {
        setMermaidSvg('');
        setMermaidErr(null);
        return;
      }
      try {
        setMermaidErr(null);
        const { svg } = await mermaid.render(
          `notes_flow_${diagramBaseId}_${Date.now()}`,
          synthesis.mermaidFlowchart
        );
        if (!cancelled) setMermaidSvg(svg);
      } catch (err) {
        if (!cancelled) {
          setMermaidErr(err instanceof Error ? err.message : 'Unable to render diagram.');
          setMermaidSvg('');
        }
      }
    }
    void renderFlow();
    return () => {
      cancelled = true;
    };
  }, [synthesis?.mermaidFlowchart, diagramBaseId, isDark]);

  const buildMarkdown = () => {
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
  };

  const handleCopy = async () => {
    const md = buildMarkdown();
    if (!md) return;
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = () => {
    const md = buildMarkdown();
    if (!md || !synthesis) return;
    const blob = new Blob([md], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${synthesis.videoId}-study-notes.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            AI Study Notes
          </h2>
          <p className="text-sm text-slate-600 dark:text-[#AAB4C8]">
            Clean conceptual breakdowns paired with Mermaid mechanism flowcharts.
          </p>
        </div>

        {synthesis && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopy()}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] text-xs font-semibold text-slate-700 dark:text-[#F8FAFC] hover:border-slate-300 dark:hover:border-white/20 inline-flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#34D399]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy notes'}</span>
            </button>
            {activeNode && (
              <button
                type="button"
                disabled={isRegenerating}
                onClick={() => void onRegenerateNotes(activeNode)}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] text-xs font-semibold text-slate-700 dark:text-[#F8FAFC] hover:border-slate-300 dark:hover:border-white/20 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isRegenerating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-3.5 h-3.5" />
                )}
                <span>Regenerate notes</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleDownload}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] hover:from-[#5B4CF2] hover:to-[#4D8DFF] text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download notes</span>
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Module Selector */}
        <aside className="lg:col-span-4 bg-white dark:bg-[#11182B] border border-slate-200 dark:border-[#273554] rounded-2xl p-4 space-y-1.5">
          <p className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-[#73809B]">
            Modules in your path
          </p>
          {nodes.map((node) => {
            const isActive = activeNode?.id === node.id;
            return (
              <button
                key={node.id}
                type="button"
                onClick={() => onSelectNode(node.id)}
                className={`w-full text-left px-3.5 py-3 rounded-xl transition-all flex items-center justify-between gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-indigo-50 dark:bg-[#17213A] text-indigo-700 dark:text-white border border-indigo-200 dark:border-[#6D5DFB]/40'
                    : 'text-slate-700 dark:text-[#AAB4C8] hover:bg-slate-50 dark:hover:bg-[#17213A]/50 border border-transparent'
                }`}
              >
                <span className="text-sm font-medium truncate">{node.title}</span>
                <span className="font-mono text-[11px] text-slate-400 dark:text-[#73809B] shrink-0 tabular-nums">
                  {node.estimatedMinutes}m
                </span>
              </button>
            );
          })}
        </aside>

        {/* Right Paper-like Note Content */}
        <div className="lg:col-span-8 bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] rounded-2xl p-6 md:p-8 space-y-7">
          {!synthesis ? (
            <div className="py-12 text-center max-w-md mx-auto space-y-4">
              <FileText className="w-8 h-8 text-[#6D5DFB] mx-auto" />
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                {activeNode ? `Generate notes for ${activeNode.title}` : 'No study notes synthesized yet'}
              </h3>
              <p className="text-sm text-slate-600 dark:text-[#AAB4C8] leading-relaxed">
                Synthesize structured definitions, common mistakes, a practice task, and an interactive Mermaid flowchart in seconds.
              </p>
              {activeNode && (
                <button
                  type="button"
                  disabled={isRegenerating}
                  onClick={() => void onRegenerateNotes(activeNode)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] hover:from-[#5B4CF2] hover:to-[#4D8DFF] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
                >
                  {isRegenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Synthesizing…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Generate Study Notes</span>
                    </>
                  )}
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="space-y-3 border-b border-slate-100 dark:border-[#273554]/80 pb-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[#6D5DFB] dark:text-[#A78BFA]">
                    AI-generated study sheet
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowFlowchart((v) => !v)}
                    className="text-xs font-semibold text-[#4D8DFF] hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                    <span>{showFlowchart ? 'Hide Flowchart' : 'Show Flowchart'}</span>
                  </button>
                </div>
                <h3 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                  {synthesis.videoTitle}
                </h3>
                <p className="text-sm md:text-base text-slate-600 dark:text-[#AAB4C8] leading-relaxed">
                  {synthesis.executiveSummary}
                </p>

                {activeNode?.keyConcepts && activeNode.keyConcepts.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {activeNode.keyConcepts.map((chip) => (
                      <span
                        key={chip}
                        className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#11182B] border border-slate-200 dark:border-[#273554] text-xs font-medium text-slate-700 dark:text-[#AAB4C8]"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Mermaid Concept Flowchart */}
              {showFlowchart && (
                <div className="space-y-3">
                  <h4 className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                    Concept Flow Diagram
                  </h4>
                  {mermaidErr ? (
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-[#FBBF24]/10 text-xs text-amber-800 dark:text-[#FBBF24]">
                      Diagram notice: {mermaidErr}
                    </div>
                  ) : mermaidSvg ? (
                    <div
                      className="p-5 rounded-xl bg-slate-50 dark:bg-[#0B1020]/70 border border-slate-200 dark:border-[#273554]/80 overflow-x-auto flex justify-center"
                      dangerouslySetInnerHTML={{ __html: mermaidSvg }}
                    />
                  ) : null}
                </div>
              )}

              {/* Highlighted Key Definitions / Takeaways */}
              <div className="space-y-3">
                <h4 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  Key Definitions and Takeaways
                </h4>
                <div className="space-y-2.5">
                  {synthesis.keyTakeaways.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-slate-50 dark:bg-[#11182B] border border-slate-200/80 dark:border-[#273554]/80 text-sm text-slate-700 dark:text-[#F8FAFC] leading-relaxed"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              {/* Structured Sections */}
              <div className="space-y-5">
                {synthesis.structuredNotes.map((sec, idx) => (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                        {sec.heading}
                      </h4>
                      <span className="font-mono text-xs text-slate-500 dark:text-[#73809B] tabular-nums">
                        {sec.timestampHint}
                      </span>
                    </div>
                    <ul className="space-y-1.5 text-sm text-slate-600 dark:text-[#AAB4C8] leading-relaxed">
                      {sec.bullets.map((b, bIdx) => (
                        <li key={bIdx}>· {b}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              {/* Common Mistakes Warning Box */}
              {(synthesis.commonMistakes?.length || activeNode?.commonMistakes?.length) ? (
                <div className="p-5 rounded-2xl bg-amber-50 dark:bg-[#FBBF24]/10 border border-amber-200 dark:border-[#FBBF24]/30 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-[#FBBF24]">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Common mistakes to avoid</span>
                  </div>
                  <ul className="space-y-1 text-sm text-amber-900 dark:text-[#F8FAFC]/90">
                    {(synthesis.commonMistakes?.length
                      ? synthesis.commonMistakes
                      : activeNode?.commonMistakes || []
                    ).map((m, idx) => (
                      <li key={idx}>· {m}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Practice Task Box */}
              {(synthesis.practiceTask || activeNode?.practiceTask) && (
                <div className="p-5 rounded-2xl bg-indigo-50 dark:bg-[#6D5DFB]/12 border border-indigo-200 dark:border-[#6D5DFB]/35 space-y-2">
                  <p className="text-xs font-semibold text-[#6D5DFB] dark:text-[#A78BFA]">
                    Hands-on practice task
                  </p>
                  <p className="text-sm text-slate-800 dark:text-[#F8FAFC] leading-relaxed">
                    {synthesis.practiceTask || activeNode?.practiceTask}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
