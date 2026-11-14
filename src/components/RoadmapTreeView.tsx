import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import {
  CheckCircle2,
  Target,
  AlertTriangle,
  Lock,
  ZoomIn,
  ZoomOut,
  Maximize2,
  PlaySquare,
  BookOpen,
  HelpCircle,
  Loader2,
  X,
  RotateCcw,
} from 'lucide-react';
import {
  MasteryEvaluation,
  MasteryQuestion,
  SkillNode,
  SkillTreeData,
} from '../types/learning';
import { safeApiPost, toUserFriendlyError } from '../lib/errors';
import { getNodeStatusLabel, getTierLabel } from '../lib/roadmapUtils';
import { useToast } from '../context/ToastContext';

interface RoadmapTreeViewProps {
  skillTree: SkillTreeData;
  selectedNodeId: string | null;
  isDark: boolean;
  error: string | null;
  onSelectNode: (nodeId: string) => void;
  onOpenVideoForNode: (node: SkillNode) => void;
  onOpenNotesForNode: (node: SkillNode) => void;
  onUpdateNodeStatus: (nodeId: string, passed: boolean) => void;
}

export const RoadmapTreeView: React.FC<RoadmapTreeViewProps> = ({
  skillTree,
  selectedNodeId,
  isDark,
  error,
  onSelectNode,
  onOpenVideoForNode,
  onOpenNotesForNode,
  onUpdateNodeStatus,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const { showToast } = useToast();
  const [quiz, setQuiz] = useState<MasteryQuestion | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState('');
  const [customAnswer, setCustomAnswer] = useState('');
  const [evalLoading, setEvalLoading] = useState(false);
  const [evaluation, setEvaluation] = useState<MasteryEvaluation | null>(null);
  const [quizError, setQuizError] = useState<{
    action: 'quiz' | 'evaluate';
    message: string;
  } | null>(null);

  const selectedNode =
    skillTree.nodes.find((n) => n.id === selectedNodeId) ||
    skillTree.nodes.find((n) => n.id === skillTree.recommendedNextId) ||
    skillTree.nodes[0] ||
    null;

  useEffect(() => {
    setQuiz(null);
    setSelectedOption('');
    setCustomAnswer('');
    setEvaluation(null);
    setQuizError(null);
  }, [selectedNode?.id]);

  useEffect(() => {
    if (!mobileSheetOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileSheetOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobileSheetOpen]);

  useEffect(() => {
    if (!svgRef.current) return;

    const svgEl = svgRef.current;
    const height = 520;
    const nodeWidth = 204;
    const nodeHeight = 88;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    const defs = svg.append('defs');
    defs
      .append('marker')
      .attr('id', 'roadmap-arrow-muted')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 8)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', isDark ? '#475569' : '#94A3B8');

    defs
      .append('marker')
      .attr('id', 'roadmap-arrow-active')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 8)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#6D5DFB');

    const viewport = svg.append('g');
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.55, 1.75])
      .on('zoom', (event) => {
        viewport.attr('transform', event.transform.toString());
      });
    zoomRef.current = zoom;
    svg.call(zoom);

    const tiers = [1, 2, 3, 4];
    const colSpacing = 234;
    const startX = 36;
    const positioned = new Map<string, SkillNode & { x: number; y: number }>();

    tiers.forEach((tier, colIdx) => {
      const tierNodes = skillTree.nodes.filter((n) => n.tier === tier);
      const totalH = tierNodes.length * nodeHeight + Math.max(0, tierNodes.length - 1) * 30;
      const topOffset = Math.max(46, (height - totalH) / 2);

      tierNodes.forEach((node, rowIdx) => {
        positioned.set(node.id, {
          ...node,
          x: startX + colIdx * colSpacing,
          y: topOffset + rowIdx * (nodeHeight + 30),
        });
      });

      viewport
        .append('text')
        .attr('x', startX + colIdx * colSpacing)
        .attr('y', 24)
        .attr('fill', isDark ? '#73809B' : '#64748B')
        .attr('font-size', '11px')
        .attr('font-weight', '600')
        .attr('font-family', 'Plus Jakarta Sans, sans-serif')
        .text(getTierLabel(tier));
    });

    const linkGen = d3
      .linkHorizontal<{ source: [number, number]; target: [number, number] }, [number, number]>()
      .x((d) => d[0])
      .y((d) => d[1]);

    const edgesGroup = viewport.append('g');
    skillTree.edges.forEach((edge) => {
      const src = positioned.get(edge.source);
      const tgt = positioned.get(edge.target);
      if (!src || !tgt) return;

      const isActiveEdge = selectedNode?.id === src.id || selectedNode?.id === tgt.id;
      const d = linkGen({
        source: [src.x + nodeWidth, src.y + nodeHeight / 2],
        target: [tgt.x - 4, tgt.y + nodeHeight / 2],
      });

      if (d) {
        edgesGroup
          .append('path')
          .attr('d', d)
          .attr('fill', 'none')
          .attr('stroke', isActiveEdge ? '#6D5DFB' : isDark ? '#273554' : '#CBD5E1')
          .attr('stroke-width', isActiveEdge ? 2.2 : 1.5)
          .attr('marker-end', isActiveEdge ? 'url(#roadmap-arrow-active)' : 'url(#roadmap-arrow-muted)');
      }
    });

    const nodesGroup = viewport.append('g');
    positioned.forEach((node) => {
      const isSelected = selectedNode?.id === node.id;
      const isCurrent = node.status === 'ready';
      const isCompleted = node.status === 'mastered';
      const isUpNext = node.status === 'needs_review';

      const fill = isDark
        ? isCompleted
          ? 'rgba(52, 211, 153, 0.10)'
          : isCurrent
          ? 'rgba(109, 93, 251, 0.16)'
          : isUpNext
          ? 'rgba(167, 139, 250, 0.12)'
          : '#11182B'
        : isCompleted
        ? '#ECFDF5'
        : isCurrent
        ? '#EEF2FF'
        : isUpNext
        ? '#F5F3FF'
        : '#F8FAFC';

      const stroke = isSelected
        ? '#4D8DFF'
        : isCompleted
        ? '#34D399'
        : isCurrent
        ? '#6D5DFB'
        : isUpNext
        ? '#A78BFA'
        : isDark
        ? 'rgba(255,255,255,0.1)'
        : '#CBD5E1';

      const statusLabel = getNodeStatusLabel(node.status);
      const g = nodesGroup
        .append('g')
        .attr('transform', `translate(${node.x}, ${node.y})`)
        .attr('role', 'button')
        .attr('tabindex', '0')
        .attr(
          'aria-label',
          `${node.title}, ${statusLabel}, ${node.estimatedMinutes} minutes`
        )
        .style('cursor', 'pointer')
        .on('click', () => {
          onSelectNode(node.id);
          setMobileSheetOpen(true);
        })
        .on('keydown', (event: KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelectNode(node.id);
            setMobileSheetOpen(true);
          }
        });

      // Subtle pulsing ring for Current Focus node
      if (isCurrent) {
        g.append('rect')
          .attr('x', -4)
          .attr('y', -4)
          .attr('width', nodeWidth + 8)
          .attr('height', nodeHeight + 8)
          .attr('rx', 16)
          .attr('fill', 'none')
          .attr('stroke', '#6D5DFB')
          .attr('stroke-width', 1.5)
          .attr('opacity', 0.45)
          .attr('class', 'animate-pulse');
      }

      g.append('rect')
        .attr('width', nodeWidth)
        .attr('height', nodeHeight)
        .attr('rx', 13)
        .attr('fill', fill)
        .attr('stroke', stroke)
        .attr('stroke-width', isSelected ? 2.2 : 1.3);

      const fo = g
        .append('foreignObject')
        .attr('width', nodeWidth)
        .attr('height', nodeHeight)
        .style('pointer-events', 'none');

      const box = fo
        .append('xhtml:div')
        .style('width', `${nodeWidth}px`)
        .style('height', `${nodeHeight}px`)
        .style('padding', '11px 13px')
        .style('display', 'flex')
        .style('flex-direction', 'column')
        .style('justify-content', 'space-between')
        .style('font-family', 'Plus Jakarta Sans, sans-serif');

      const top = box
        .append('xhtml:div')
        .style('display', 'flex')
        .style('align-items', 'center')
        .style('justify-content', 'space-between')
        .style('font-size', '11px')
        .style('font-weight', '600');

      const labelColor = isCompleted
        ? '#34D399'
        : isCurrent
        ? isDark
          ? '#A78BFA'
          : '#6D5DFB'
        : isUpNext
        ? isDark
          ? '#FBBF24'
          : '#D97706'
        : isDark
        ? '#73809B'
        : '#64748B';

      top.append('xhtml:span').style('color', labelColor).text(statusLabel);
      top
        .append('xhtml:span')
        .style('color', isDark ? '#73809B' : '#64748B')
        .style('font-family', 'IBM Plex Mono, monospace')
        .text(`${node.estimatedMinutes}m`);

      box
        .append('xhtml:div')
        .style('font-size', '13px')
        .style('font-weight', '600')
        .style('line-height', '1.3')
        .style('color', isDark ? '#F8FAFC' : '#0F172A')
        .style('display', '-webkit-box')
        .style('-webkit-line-clamp', '2')
        .style('-webkit-box-orient', 'vertical')
        .style('overflow', 'hidden')
        .text(node.title);
    });
  }, [skillTree, selectedNode?.id, isDark, onSelectNode]);

  const handleZoom = (factor: number) => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(180).call(zoomRef.current.scaleBy, factor);
  };

  const handleResetZoom = () => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(180).call(zoomRef.current.transform, d3.zoomIdentity);
  };

  const handleLoadQuiz = async () => {
    if (!selectedNode || quizLoading) return;
    setQuizLoading(true);
    setQuizError(null);
    setEvaluation(null);
    setSelectedOption('');
    setCustomAnswer('');
    try {
      const data = await safeApiPost<MasteryQuestion>('/api/skill-tree/quiz', {
        topic: skillTree.topic,
        node: selectedNode,
      });
      setQuiz(data);
    } catch (err) {
      const friendly = toUserFriendlyError(err, 'Could not load mastery check.');
      setQuizError({ action: 'quiz', message: friendly });
      showToast(friendly, 'error');
    } finally {
      setQuizLoading(false);
    }
  };

  const submitEvaluation = async () => {
    if (!selectedNode || !quiz || evalLoading) return;
    const answerText = (customAnswer.trim() || selectedOption).trim();
    if (!answerText) return;

    setEvalLoading(true);
    setQuizError(null);
    try {
      const data = await safeApiPost<MasteryEvaluation>('/api/skill-tree/evaluate', {
        topic: skillTree.topic,
        node: selectedNode,
        question: quiz.question,
        userAnswer: answerText,
      });
      setEvaluation(data);
      onUpdateNodeStatus(selectedNode.id, data.passed);
    } catch (err) {
      const friendly = toUserFriendlyError(err, 'Evaluation failed. Please try again.');
      setQuizError({ action: 'evaluate', message: friendly });
      showToast(friendly, 'error');
    } finally {
      setEvalLoading(false);
    }
  };

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitEvaluation();
  };

  const DetailsPanel = selectedNode ? (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-[#6D5DFB]/20 text-indigo-700 dark:text-[#A78BFA] font-medium">
            {selectedNode.difficulty || 'Beginner'}
          </span>
          <span className="font-mono text-slate-500 dark:text-[#AAB4C8] tabular-nums">
            {selectedNode.estimatedMinutes} min
          </span>
          <span aria-hidden="true" className="text-slate-400">·</span>
          <span className="text-slate-600 dark:text-[#AAB4C8]">
            {selectedNode.status === 'mastered'
              ? 'Completed'
              : selectedNode.status === 'ready'
              ? 'Current Focus'
              : selectedNode.status === 'needs_review'
              ? 'Up Next'
              : 'Future'}
          </span>
        </div>

        <h3 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
          {selectedNode.title}
        </h3>
        <p className="text-sm text-slate-600 dark:text-[#AAB4C8] leading-relaxed">
          {selectedNode.summary}
        </p>
      </div>

      <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#0B1020]/70 border border-slate-200/80 dark:border-[#273554]/80 space-y-1.5">
        <p className="text-xs font-semibold text-slate-800 dark:text-white">
          Why this matters
        </p>
        <p className="text-xs text-slate-600 dark:text-[#AAB4C8] leading-relaxed">
          {selectedNode.whyItMatters || selectedNode.diagnosticRationale}
        </p>
      </div>

      {selectedNode.keyConcepts && selectedNode.keyConcepts.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-[#73809B] mb-2">
            Key concepts
          </p>
          <div className="flex flex-wrap gap-1.5">
            {selectedNode.keyConcepts.map((c) => (
              <span
                key={c}
                className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-[#11182B] border border-slate-200 dark:border-[#273554] text-[11px] font-medium text-slate-700 dark:text-[#AAB4C8]"
              >
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {selectedNode.practiceTask && (
        <div className="p-4 rounded-xl bg-indigo-50/60 dark:bg-[#6D5DFB]/10 border border-indigo-200 dark:border-[#6D5DFB]/30 space-y-1.5">
          <p className="text-xs font-semibold text-[#6D5DFB] dark:text-[#A78BFA]">
            Practice task
          </p>
          <p className="text-xs text-slate-700 dark:text-[#F8FAFC] leading-relaxed">
            {selectedNode.practiceTask}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => onOpenVideoForNode(selectedNode)}
          className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-[#11182B] border border-slate-200 dark:border-[#273554] hover:border-[#6D5DFB]/50 text-xs font-semibold text-slate-800 dark:text-white inline-flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <PlaySquare className="w-3.5 h-3.5 text-[#4D8DFF]" />
          <span>Watch Video</span>
        </button>
        <button
          type="button"
          onClick={() => onOpenNotesForNode(selectedNode)}
          className="py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-[#11182B] border border-slate-200 dark:border-[#273554] hover:border-[#6D5DFB]/50 text-xs font-semibold text-slate-800 dark:text-white inline-flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5 text-[#A78BFA]" />
          <span>Study Notes</span>
        </button>
      </div>

      <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-[#273554]/80">
        {selectedNode.status !== 'mastered' && (
          <button
            type="button"
            onClick={() => onUpdateNodeStatus(selectedNode.id, true)}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] hover:from-[#5B4CF2] hover:to-[#4D8DFF] text-white text-xs font-semibold hover:shadow-[0_0_20px_rgba(109,93,251,0.4)] transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Mark as Complete</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => void handleLoadQuiz()}
          disabled={quizLoading}
          aria-busy={quizLoading}
          className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-[#11182B] border border-slate-200 dark:border-[#273554] text-slate-800 dark:text-[#F8FAFC] text-xs font-semibold hover:border-slate-300 dark:hover:border-white/20 transition-all inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {quizLoading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Loading Quick Check…</span>
            </>
          ) : (
            <>
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{quiz ? 'New AI Mastery Check' : 'Run AI Mastery Check'}</span>
            </>
          )}
        </button>
      </div>

      {quizError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl bg-rose-50 dark:bg-[#FB7185]/10 border border-rose-200 dark:border-[#FB7185]/35 space-y-2.5 text-xs text-rose-800 dark:text-[#FB7185]"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{quizError.message}</span>
          </div>
          <button
            type="button"
            disabled={quizLoading || evalLoading}
            onClick={() => {
              if (quizError.action === 'evaluate') {
                void submitEvaluation();
              } else {
                void handleLoadQuiz();
              }
            }}
            className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#11182B] border border-rose-200 dark:border-[#FB7185]/40 text-rose-700 dark:text-white font-semibold inline-flex items-center gap-1.5 hover:border-rose-300 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Try again</span>
          </button>
        </div>
      )}

      {quiz && (
        <form onSubmit={handleEvaluate} className="space-y-3 pt-3 border-t border-slate-100 dark:border-[#273554]/80">
          <p className="text-xs font-semibold text-slate-900 dark:text-white leading-relaxed">
            {quiz.question}
          </p>
          <div className="space-y-1.5">
            {quiz.options.map((opt, idx) => (
              <label
                key={idx}
                className={`flex items-start gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-colors ${
                  selectedOption === opt
                    ? 'border-[#6D5DFB] bg-indigo-50 dark:bg-[#6D5DFB]/15 text-slate-900 dark:text-white'
                    : 'border-slate-200 dark:border-[#273554] text-slate-700 dark:text-[#AAB4C8]'
                }`}
              >
                <input
                  type="radio"
                  name="node-quiz"
                  value={opt}
                  checked={selectedOption === opt}
                  onChange={() => setSelectedOption(opt)}
                  className="mt-0.5 accent-[#6D5DFB]"
                />
                <span>{opt}</span>
              </label>
            ))}
          </div>
          <input
            type="text"
            value={customAnswer}
            onChange={(e) => setCustomAnswer(e.target.value)}
            placeholder="Or write your reasoning…"
            className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-[#0B1020] border border-slate-200 dark:border-[#273554] rounded-xl text-slate-900 dark:text-white"
          />
          <button
            type="submit"
            disabled={evalLoading || (!selectedOption && !customAnswer.trim())}
            aria-busy={evalLoading}
            className="w-full py-2 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-[#0B1020] text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {evalLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Evaluating…</span>
              </>
            ) : (
              <span>Verify Answer</span>
            )}
          </button>
          {evaluation && (
            <div
              className={`p-3 rounded-xl text-xs leading-relaxed ${
                evaluation.passed
                  ? 'bg-emerald-50 dark:bg-[#34D399]/10 text-emerald-800 dark:text-[#34D399]'
                  : 'bg-amber-50 dark:bg-[#FBBF24]/10 text-amber-800 dark:text-[#FBBF24]'
              }`}
            >
              {evaluation.feedback}
            </div>
          )}
        </form>
      )}
    </div>
  ) : null;

  return (
    <div className="space-y-6 animate-fade-up">
      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50 dark:bg-[#FB7185]/10 border border-rose-200 dark:border-[#FB7185]/35 text-xs text-rose-800 dark:text-[#FB7185]"
        >
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Skill Tree Card */}
        <div className="lg:col-span-8 bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-[#273554]/80 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
                Your Personalized Learning Path
              </h2>
              <div className="flex flex-wrap items-center gap-4 mt-1.5 text-xs text-slate-600 dark:text-[#AAB4C8]">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#34D399]" />
                  Completed
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-[#6D5DFB]" />
                  Current Focus
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#FBBF24]" />
                  Up Next
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  Future
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleZoom(1.18)}
                aria-label="Zoom in skill tree"
                className="p-2 rounded-lg text-slate-500 dark:text-[#AAB4C8] hover:bg-slate-100 dark:hover:bg-[#11182B] cursor-pointer"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleZoom(0.84)}
                aria-label="Zoom out skill tree"
                className="p-2 rounded-lg text-slate-500 dark:text-[#AAB4C8] hover:bg-slate-100 dark:hover:bg-[#11182B] cursor-pointer"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleResetZoom}
                aria-label="Reset zoom"
                className="p-2 rounded-lg text-slate-500 dark:text-[#AAB4C8] hover:bg-slate-100 dark:hover:bg-[#11182B] cursor-pointer"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="w-full overflow-x-auto bg-slate-50/70 dark:bg-[#0B1020]/60">
            <svg
              ref={svgRef}
              role="region"
              aria-label={`Interactive skill roadmap for ${skillTree.topic}`}
              viewBox="0 0 980 520"
              className="w-full h-[500px] min-w-[740px] select-none"
            />
          </div>
        </div>

        {/* Desktop Right-Side Module Details Panel */}
        <aside className="hidden lg:block lg:col-span-4 bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] rounded-2xl p-6">
          {DetailsPanel}
        </aside>
      </div>

      {/* Mobile Bottom Sheet for Module Details */}
      {mobileSheetOpen && selectedNode && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Module details for ${selectedNode.title}`}
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end"
        >
          <div className="w-full max-h-[85vh] overflow-y-auto bg-white dark:bg-[#17213A] rounded-t-2xl p-6 space-y-4 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-[#AAB4C8]">
                Module Details
              </span>
              <button
                type="button"
                onClick={() => setMobileSheetOpen(false)}
                aria-label="Close module details"
                className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-xl text-slate-500 dark:text-[#AAB4C8] hover:bg-slate-100 dark:hover:bg-[#11182B] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {DetailsPanel}
          </div>
        </div>
      )}
    </div>
  );
};
