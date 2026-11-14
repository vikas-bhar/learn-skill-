import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  Download,
  Lock,
  PlaySquare,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trophy,
  AlertTriangle,
  ArrowRight,
  Loader2,
  HelpCircle,
} from 'lucide-react';
import {
  DiagnosticProfile,
  FinalExamEvaluation,
  FinalExamPayload,
  FinalExamResult,
  LearnerScoreProfile,
  SkillCertificate,
  SkillTreeData,
  VideoTestResult,
} from '../types/learning';

interface FinalExamCertificateViewProps {
  profile: DiagnosticProfile;
  skillTree: SkillTreeData;
  scoreProfile: LearnerScoreProfile;
  videoTestResults: VideoTestResult[];
  finalExam: FinalExamResult | null;
  certificate: SkillCertificate | null;
  defaultLearnerName: string;
  isDemoMode: boolean;
  onGoToRoadmap: () => void;
  onGoToVideos: () => void;
  onFinalExamEvaluated: (
    evaluation: FinalExamEvaluation,
    learnerName: string
  ) => Promise<void>;
}

function formatReadableDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
}

function sanitizeTextForCanvas(text: string): string {
  return text
    .replace(/\s*&\s*/g, ' and ')
    .replace(/[*^$#@]/g, '')
    .trim();
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number
): number {
  const words = text.split(/\s+/);
  let line = '';
  let currentY = y;

  for (let i = 0; i < words.length; i++) {
    const testLine = line ? `${line} ${words[i]}` : words[i];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = words[i];
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) {
    ctx.fillText(line, x, currentY);
    currentY += lineHeight;
  }
  return currentY;
}

function downloadCertificatePng(cert: SkillCertificate): void {
  const canvas = document.createElement('canvas');
  canvas.width = 1600;
  canvas.height = 1100;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Deep Midnight Navy background
  ctx.fillStyle = '#0B1020';
  ctx.fillRect(0, 0, 1600, 1100);

  // Subtle corner glow accents
  const gradTop = ctx.createRadialGradient(260, 180, 20, 260, 180, 520);
  gradTop.addColorStop(0, 'rgba(109, 93, 251, 0.22)');
  gradTop.addColorStop(1, 'rgba(11, 16, 32, 0)');
  ctx.fillStyle = gradTop;
  ctx.fillRect(0, 0, 1600, 1100);

  const gradBottom = ctx.createRadialGradient(1340, 920, 20, 1340, 920, 520);
  gradBottom.addColorStop(0, 'rgba(77, 141, 255, 0.20)');
  gradBottom.addColorStop(1, 'rgba(11, 16, 32, 0)');
  ctx.fillStyle = gradBottom;
  ctx.fillRect(0, 0, 1600, 1100);

  // Card surface
  ctx.fillStyle = '#11182B';
  ctx.fillRect(64, 64, 1472, 972);

  // Outer and inner border frames
  ctx.strokeStyle = '#6D5DFB';
  ctx.lineWidth = 3;
  ctx.strokeRect(64, 64, 1472, 972);

  ctx.strokeStyle = 'rgba(251, 191, 36, 0.45)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(86, 86, 1428, 928);

  // Brand heading
  ctx.textAlign = 'center';
  ctx.fillStyle = '#A78BFA';
  ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('SKILLPATH AI  -  ADAPTIVE MASTERY CREDENTIAL', 800, 175);

  ctx.fillStyle = '#F8FAFC';
  ctx.font = '700 54px "Sora", sans-serif';
  ctx.fillText('Certificate of Mastery', 800, 255);

  // Divider
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(460, 295);
  ctx.lineTo(1140, 295);
  ctx.stroke();

  ctx.fillStyle = '#AAB4C8';
  ctx.font = '500 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('This certifies that', 800, 365);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 60px "Sora", sans-serif';
  ctx.fillText(sanitizeTextForCanvas(cert.learnerName), 800, 448);

  ctx.fillStyle = '#AAB4C8';
  ctx.font = '500 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(
    'has completed every module and passed the Final AI Certification Exam in',
    800,
    520
  );

  ctx.fillStyle = '#4D8DFF';
  ctx.font = '700 42px "Sora", sans-serif';
  ctx.fillText(sanitizeTextForCanvas(cert.topic), 800, 588);

  ctx.fillStyle = '#CBD5E1';
  ctx.font = '400 22px "Plus Jakarta Sans", sans-serif';
  drawWrappedText(
    ctx,
    sanitizeTextForCanvas(cert.strengthSummary),
    800,
    662,
    1080,
    34
  );

  // Stats boxes
  const stats = [
    { label: 'Final AI Exam Score', value: `${cert.finalScore}%` },
    { label: 'Profile Score', value: `${cert.totalScore} pts` },
    { label: 'Verified Level', value: sanitizeTextForCanvas(cert.level) },
    { label: 'Issued Date', value: sanitizeTextForCanvas(formatReadableDate(cert.issuedAtIso)) },
  ];

  const boxWidth = 280;
  const gap = 36;
  const totalRowW = stats.length * boxWidth + (stats.length - 1) * gap;
  const startX = (1600 - totalRowW) / 2;

  stats.forEach((item, idx) => {
    const bx = startX + idx * (boxWidth + gap);
    ctx.fillStyle = '#17213A';
    ctx.fillRect(bx, 760, boxWidth, 114);
    ctx.strokeStyle = '#273554';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, 760, boxWidth, 114);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#73809B';
    ctx.font = '500 17px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(item.label, bx + boxWidth / 2, 798);

    ctx.fillStyle = '#F8FAFC';
    ctx.font = '700 26px "Sora", sans-serif';
    ctx.fillText(item.value, bx + boxWidth / 2, 845);
  });

  // Footer verification line
  ctx.textAlign = 'center';
  ctx.fillStyle = '#73809B';
  ctx.font = '500 18px "IBM Plex Mono", monospace';
  ctx.fillText(
    `Credential ID ${sanitizeTextForCanvas(cert.certificateId)}  -  Verified by SkillPath AI Examination`,
    800,
    955
  );

  const link = document.createElement('a');
  const slug = cert.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'skill';
  link.download = `skillpath-certificate-${slug}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export const FinalExamCertificateView: React.FC<FinalExamCertificateViewProps> = ({
  profile,
  skillTree,
  scoreProfile,
  videoTestResults,
  finalExam,
  certificate,
  defaultLearnerName,
  isDemoMode,
  onGoToRoadmap,
  onGoToVideos,
  onFinalExamEvaluated,
}) => {
  const [examPayload, setExamPayload] = useState<FinalExamPayload | null>(null);
  const [examLoading, setExamLoading] = useState(false);
  const [examError, setExamError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [notesByQ, setNotesByQ] = useState<Record<string, string>>({});
  const [hintsOpen, setHintsOpen] = useState<Record<string, boolean>>({});
  const [evalLoading, setEvalLoading] = useState(false);
  const [latestEvaluation, setLatestEvaluation] = useState<FinalExamEvaluation | null>(null);
  const [customName, setCustomName] = useState(defaultLearnerName);

  const nodes = skillTree.nodes || [];
  const totalCount = nodes.length;
  const masteredCount = nodes.filter((n) => n.status === 'mastered').length;
  const remainingNodes = nodes.filter((n) => n.status !== 'mastered');
  const allModulesMastered = totalCount > 0 && masteredCount === totalCount;
  const skillCompletionPct = totalCount > 0 ? Math.round((masteredCount / totalCount) * 100) : 0;

  const avgVideoScore =
    videoTestResults.length > 0
      ? Math.round(
          videoTestResults.reduce((sum, item) => sum + item.score, 0) / videoTestResults.length
        )
      : 0;

  const handleStartExam = async () => {
    setExamLoading(true);
    setExamError(null);
    setLatestEvaluation(null);
    setAnswers({});
    setNotesByQ({});
    setHintsOpen({});

    try {
      const res = await fetch('/api/skill-tree/final-exam/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: skillTree.topic,
          goal: profile.goal,
          estimatedLevel: profile.estimatedLevel,
          nodes: skillTree.nodes.map((n) => ({
            id: n.id,
            title: n.title,
            summary: n.summary,
            tier: n.tier,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not generate final certification exam.');
      setExamPayload(data as FinalExamPayload);
    } catch (err) {
      setExamError(
        err instanceof Error ? err.message : 'Unable to start the final AI exam right now.'
      );
    } finally {
      setExamLoading(false);
    }
  };

  const allQuestionsAnswered =
    examPayload !== null &&
    examPayload.questions.length > 0 &&
    examPayload.questions.every((q) => Boolean((notesByQ[q.id] || answers[q.id] || '').trim()));

  const handleSubmitExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!examPayload || !allQuestionsAnswered) return;

    setEvalLoading(true);
    setExamError(null);
    try {
      const userAnswers = examPayload.questions.map((q) => {
        const chosen = answers[q.id] || '';
        const reasoning = (notesByQ[q.id] || '').trim();
        return {
          questionId: q.id,
          answer: reasoning ? `${chosen ? `${chosen} — ` : ''}${reasoning}` : chosen,
        };
      });

      const res = await fetch('/api/skill-tree/final-exam/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: skillTree.topic,
          estimatedLevel: profile.estimatedLevel,
          questions: examPayload.questions.map((q) => ({
            id: q.id,
            prompt: q.prompt,
            moduleTitle: q.moduleTitle,
          })),
          userAnswers,
        }),
      });
      const data = (await res.json()) as FinalExamEvaluation & { error?: string };
      if (!res.ok) throw new Error(data.error || 'Failed to grade final exam.');

      setLatestEvaluation(data);
      const recipientName = (customName.trim() || defaultLearnerName || 'Learner').trim();
      await onFinalExamEvaluated(data, recipientName);
    } catch (err) {
      setExamError(
        err instanceof Error ? err.message : 'Could not evaluate final exam answers.'
      );
    } finally {
      setEvalLoading(false);
    }
  };

  return (
    <div className="space-y-7 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Profile Score and Skill Certificate
          </h2>
          <p className="text-sm text-slate-600 dark:text-[#AAB4C8]">
            Earn profile points after every video test and unlock your AI-verified certificate by completing the full skill exam.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-[#AAB4C8]">
          <span>Track: {skillTree.topic}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{masteredCount} of {totalCount} modules mastered</span>
        </div>
      </div>

      {/* 4 Profile Score KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] rounded-2xl p-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-[#73809B]">
              Total Profile Score
            </p>
            <p className="font-display text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {scoreProfile.totalScore} pts
            </p>
          </div>
          <div className="w-11 h-11 rounded-full bg-indigo-50 dark:bg-[#6D5DFB]/15 border border-indigo-200 dark:border-[#6D5DFB]/40 flex items-center justify-center text-[#6D5DFB] dark:text-[#A78BFA] shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] rounded-2xl p-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-[#73809B]">
              Videos Tested
            </p>
            <p className="font-display text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {scoreProfile.videosCompleted}
            </p>
          </div>
          <div className="w-11 h-11 rounded-full bg-blue-50 dark:bg-[#4D8DFF]/15 flex items-center justify-center text-[#4D8DFF] shrink-0">
            <PlaySquare className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] rounded-2xl p-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-[#73809B]">
              Average Test Score
            </p>
            <p className="font-display text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {videoTestResults.length > 0 ? `${avgVideoScore}%` : 'No tests yet'}
            </p>
          </div>
          <div className="w-11 h-11 rounded-full bg-emerald-50 dark:bg-[#34D399]/10 flex items-center justify-center text-[#34D399] shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] rounded-2xl p-5 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-[#73809B]">
              Certificates Earned
            </p>
            <p className="font-display text-xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
              {scoreProfile.certificatesEarned}
            </p>
          </div>
          <div className="w-11 h-11 rounded-full bg-amber-50 dark:bg-[#FBBF24]/10 flex items-center justify-center text-[#FBBF24] shrink-0">
            <Award className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Certificate OR Final AI Exam Stage */}
      {certificate ? (
        <div className="space-y-5">
          {/* Official Certificate of Mastery */}
          <div className="relative overflow-hidden rounded-2xl bg-[#0B1020] border-2 border-[#6D5DFB]/60 p-3 shadow-[0_0_40px_rgba(109,93,251,0.18)]">
            <div className="rounded-xl border border-[#FBBF24]/40 bg-[#11182B] px-6 py-10 md:px-14 md:py-12 text-center space-y-6">
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#6D5DFB]/25 to-[#4D8DFF]/25 border border-[#FBBF24]/50 flex items-center justify-center">
                  <ShieldCheck className="w-8 h-8 text-[#FBBF24]" />
                </div>
                <p className="text-xs font-semibold tracking-wider text-[#A78BFA]">
                  SKILLPATH AI ADAPTIVE MASTERY CREDENTIAL
                </p>
                <h3 className="font-display text-3xl md:text-4xl font-bold text-white">
                  Certificate of Mastery
                </h3>
              </div>

              <div className="w-48 h-px bg-white/15 mx-auto" />

              <div className="space-y-2">
                <p className="text-sm text-[#AAB4C8]">This certifies that</p>
                <p className="font-display text-3xl md:text-4xl font-bold text-white">
                  {certificate.learnerName}
                </p>
                <p className="text-sm text-[#AAB4C8] max-w-xl mx-auto leading-relaxed">
                  has completed every module in the adaptive skill roadmap and passed the comprehensive Final AI Certification Examination in
                </p>
                <p className="font-display text-2xl font-bold text-[#4D8DFF] pt-1">
                  {certificate.topic}
                </p>
              </div>

              <p className="text-sm text-slate-300 max-w-2xl mx-auto leading-relaxed">
                {certificate.strengthSummary}
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 max-w-3xl mx-auto">
                <div className="rounded-xl bg-[#17213A] border border-[#273554] p-3.5">
                  <p className="text-[11px] text-[#73809B]">Final AI Exam Score</p>
                  <p className="font-display text-lg font-bold text-[#34D399] mt-0.5 tabular-nums">
                    {certificate.finalScore}%
                  </p>
                </div>
                <div className="rounded-xl bg-[#17213A] border border-[#273554] p-3.5">
                  <p className="text-[11px] text-[#73809B]">Profile Score</p>
                  <p className="font-display text-lg font-bold text-white mt-0.5 tabular-nums">
                    {certificate.totalScore} pts
                  </p>
                </div>
                <div className="rounded-xl bg-[#17213A] border border-[#273554] p-3.5">
                  <p className="text-[11px] text-[#73809B]">Verified Level</p>
                  <p className="font-display text-lg font-bold text-white mt-0.5">
                    {certificate.level}
                  </p>
                </div>
                <div className="rounded-xl bg-[#17213A] border border-[#273554] p-3.5">
                  <p className="text-[11px] text-[#73809B]">Issued Date</p>
                  <p className="font-display text-sm font-bold text-white mt-1">
                    {formatReadableDate(certificate.issuedAtIso)}
                  </p>
                </div>
              </div>

              <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/10 max-w-3xl mx-auto">
                <span className="font-mono text-xs text-[#73809B]">
                  Credential ID {certificate.certificateId}
                </span>
                <button
                  type="button"
                  onClick={() => downloadCertificatePng(certificate)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] hover:from-[#5B4CF2] hover:to-[#4D8DFF] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Certificate PNG</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] rounded-2xl p-6 md:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#6D5DFB] dark:text-[#A78BFA]">
                {allModulesMastered ? (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Final AI Certification Exam Unlocked</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-500 dark:text-[#AAB4C8]">
                      Final AI Exam Locked Until Full Skill Completion
                    </span>
                  </>
                )}
              </div>
              <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                {allModulesMastered
                  ? `Ready for your Final ${skillTree.topic} AI Exam`
                  : `Complete all ${totalCount} modules to unlock your Certificate`}
              </h3>
              <p className="text-sm text-slate-600 dark:text-[#AAB4C8] max-w-2xl">
                {allModulesMastered
                  ? 'Pass the 5-question comprehensive AI assessment (70% or higher) to add bonus points to your profile and generate your official Certificate of Mastery.'
                  : 'Work through each module in your Learning Roadmap and pass its mastery check or complete it after studying the video. Once 100% of modules are complete, AI will administer your final certification exam.'}
              </p>
            </div>

            {allModulesMastered && !examPayload && (
              <button
                type="button"
                onClick={() => void handleStartExam()}
                disabled={examLoading}
                className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] hover:from-[#5B4CF2] hover:to-[#4D8DFF] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                {examLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Preparing AI Exam…</span>
                  </>
                ) : (
                  <>
                    <Award className="w-4 h-4" />
                    <span>{finalExam ? 'Retake Final AI Exam' : 'Start Final AI Exam'}</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Module completion progress if still locked */}
          {!allModulesMastered && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#AAB4C8] tabular-nums">
                  <span>Skill tree mastery progress</span>
                  <span>{masteredCount} of {totalCount} completed ({skillCompletionPct}%)</span>
                </div>
                <div className="w-full h-2.5 bg-slate-100 dark:bg-[#0B1020] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(4, skillCompletionPct)}%` }}
                  />
                </div>
              </div>

              {remainingNodes.length > 0 && (
                <div className="pt-2 space-y-2">
                  <p className="text-xs font-medium text-slate-500 dark:text-[#73809B]">
                    Remaining modules to complete:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {remainingNodes.slice(0, 6).map((node) => (
                      <div
                        key={node.id}
                        className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-[#11182B] border border-slate-200/80 dark:border-[#273554]"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                            {node.title}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-[#73809B]">
                            Tier {node.tier} · {node.estimatedMinutes} min
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={onGoToRoadmap}
                          className="text-xs font-semibold text-[#6D5DFB] dark:text-[#A78BFA] hover:underline inline-flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <span>Complete</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {examError && (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-[#FB7185]/10 border border-rose-200 dark:border-[#FB7185]/35 flex items-start gap-2.5 text-xs text-rose-800 dark:text-[#FB7185]">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{examError}</span>
            </div>
          )}

          {/* Previous failed attempt summary if present and not currently retaking */}
          {finalExam && !finalExam.passed && !examPayload && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-[#FBBF24]/10 border border-amber-200 dark:border-[#FBBF24]/30 space-y-1.5">
              <p className="text-xs font-semibold text-amber-900 dark:text-[#FBBF24]">
                Previous Final Exam Attempt: {finalExam.score}% (70% needed for certificate)
              </p>
              <p className="text-xs text-amber-800 dark:text-[#AAB4C8] leading-relaxed">
                {finalExam.feedback}
              </p>
            </div>
          )}

          {/* Active 5-Question Final AI Exam Form */}
          {examPayload && (
            <form onSubmit={handleSubmitExam} className="space-y-6 pt-2 border-t border-slate-100 dark:border-[#273554]">
              {isDemoMode && (
                <div className="max-w-sm space-y-1.5">
                  <label
                    htmlFor="certificate-learner-name"
                    className="block text-xs font-semibold text-slate-700 dark:text-[#AAB4C8]"
                  >
                    Name for Certificate
                  </label>
                  <input
                    id="certificate-learner-name"
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-[#11182B] border border-slate-200 dark:border-[#273554] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6D5DFB]/50"
                  />
                </div>
              )}

              <div className="space-y-5">
                {examPayload.questions.map((q, qIdx) => {
                  const qResult = latestEvaluation?.questionResults?.find(
                    (r) => r.questionId === q.id
                  );
                  return (
                    <div
                      key={q.id}
                      className="p-5 rounded-2xl bg-slate-50 dark:bg-[#11182B] border border-slate-200 dark:border-[#273554] space-y-3.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-medium text-[#6D5DFB] dark:text-[#A78BFA]">
                          Question {qIdx + 1} of {examPayload.questions.length} · {q.moduleTitle}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setHintsOpen((prev) => ({ ...prev, [q.id]: !prev[q.id] }))
                          }
                          className="text-xs text-slate-500 dark:text-[#73809B] hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>{hintsOpen[q.id] ? 'Hide Hint' : 'Hint'}</span>
                        </button>
                      </div>

                      <p className="text-sm font-semibold text-slate-900 dark:text-white leading-relaxed">
                        {q.prompt}
                      </p>

                      {hintsOpen[q.id] && (
                        <p className="text-xs text-slate-600 dark:text-[#AAB4C8] bg-white dark:bg-[#17213A] px-3 py-2 rounded-lg border border-slate-200 dark:border-[#273554]">
                          {q.hint}
                        </p>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {q.options.map((opt, optIdx) => {
                          const selected = answers[q.id] === opt;
                          return (
                            <label
                              key={optIdx}
                              className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                                selected
                                  ? 'border-[#6D5DFB] bg-indigo-50 dark:bg-[#6D5DFB]/15 text-slate-900 dark:text-white'
                                  : 'border-slate-200 dark:border-[#273554] bg-white dark:bg-[#17213A] text-slate-700 dark:text-[#AAB4C8]'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`final-q-${q.id}`}
                                value={opt}
                                checked={selected}
                                onChange={() =>
                                  setAnswers((prev) => ({ ...prev, [q.id]: opt }))
                                }
                                className="mt-0.5 accent-[#6D5DFB]"
                              />
                              <span>{opt}</span>
                            </label>
                          );
                        })}
                      </div>

                      <input
                        type="text"
                        value={notesByQ[q.id] || ''}
                        onChange={(e) =>
                          setNotesByQ((prev) => ({ ...prev, [q.id]: e.target.value }))
                        }
                        placeholder="Optional: explain your reasoning in your own words…"
                        className="w-full px-3.5 py-2 text-xs bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400"
                      />

                      {qResult && (
                        <div
                          className={`p-3 rounded-xl text-xs leading-relaxed ${
                            qResult.correct
                              ? 'bg-emerald-50 dark:bg-[#34D399]/10 text-emerald-800 dark:text-[#34D399]'
                              : 'bg-amber-50 dark:bg-[#FBBF24]/10 text-amber-800 dark:text-[#FBBF24]'
                          }`}
                        >
                          <span className="font-semibold mr-1.5">
                            {qResult.correct ? 'Correct:' : 'Needs review:'}
                          </span>
                          {qResult.feedback}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {latestEvaluation && !latestEvaluation.passed && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-[#FBBF24]/10 border border-amber-200 dark:border-[#FBBF24]/30 flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-amber-900 dark:text-[#FBBF24]">
                      Score: {latestEvaluation.score}% · {latestEvaluation.pointsAwarded} pts added to your profile
                    </p>
                    <p className="text-xs text-amber-800 dark:text-[#AAB4C8]">
                      {latestEvaluation.feedback} Score 70% or higher to earn your Certificate of Mastery.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleStartExam()}
                    className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-[#0B1020] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retake Final Exam</span>
                  </button>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-slate-500 dark:text-[#73809B]">
                  Answer all 5 questions for AI scoring. Minimum passing score is 70%.
                </p>
                <button
                  type="submit"
                  disabled={evalLoading || !allQuestionsAnswered}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] hover:from-[#5B4CF2] hover:to-[#4D8DFF] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-40"
                >
                  {evalLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>AI Grading Final Exam…</span>
                    </>
                  ) : (
                    <>
                      <Award className="w-4 h-4" />
                      <span>Submit Final Exam for AI Score</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Post-Video AI Test History */}
      <div className="bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white">
              Post-Video AI Test History
            </h3>
            <p className="text-xs text-slate-500 dark:text-[#AAB4C8]">
              Every test completed after watching a lecture adds points directly to your learner profile.
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToVideos}
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-[#11182B] border border-slate-200 dark:border-[#273554] text-xs font-semibold text-slate-800 dark:text-white hover:border-[#6D5DFB]/60 cursor-pointer"
          >
            Watch Videos and Take Tests
          </button>
        </div>

        {videoTestResults.length === 0 ? (
          <div className="py-8 text-center space-y-2 border-t border-slate-100 dark:border-[#273554]">
            <p className="text-sm font-medium text-slate-700 dark:text-[#AAB4C8]">
              No post-video AI tests completed on this track yet.
            </p>
            <p className="text-xs text-slate-500 dark:text-[#73809B]">
              Open any recommended video in the Videos tab and click Complete Video and Take AI Test to earn profile points.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-[#273554] border-t border-slate-100 dark:border-[#273554]">
            {videoTestResults.map((item, idx) => (
              <div key={`${item.videoId}_${idx}`} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                    {item.videoTitle}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-[#AAB4C8] leading-relaxed">
                    {item.feedback}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0 text-xs tabular-nums">
                  <span
                    className={`font-semibold inline-flex items-center gap-1 ${
                      item.passed
                        ? 'text-emerald-600 dark:text-[#34D399]'
                        : 'text-amber-600 dark:text-[#FBBF24]'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{item.score}%</span>
                  </span>
                  <span className="font-mono font-semibold text-[#6D5DFB] dark:text-[#A78BFA]">
                    +{item.pointsAwarded} pts
                  </span>
                  <span className="text-slate-400 dark:text-[#73809B]">
                    {formatReadableDate(item.completedAtIso)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
