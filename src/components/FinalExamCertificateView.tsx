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
  FolderGit2,
  Send,
  Clock,
  Link2,
} from 'lucide-react';
import {
  CapstoneProjectItem,
  DiagnosticProfile,
  FinalExamEvaluation,
  FinalExamPayload,
  FinalExamResult,
  LearnerScoreProfile,
  ProjectEvaluationResponse,
  SkillCertificate,
  SkillTreeData,
  VideoTestResult,
} from '../types/learning';
import { safeApiPost, toUserFriendlyError } from '../lib/errors';
import {
  downloadCertificatePng,
  formatReadableDate,
} from '../lib/certificateCanvas';
import { useToast } from '../context/ToastContext';

interface FinalExamCertificateViewProps {
  profile: DiagnosticProfile;
  skillTree: SkillTreeData;
  scoreProfile: LearnerScoreProfile;
  videoTestResults: VideoTestResult[];
  finalExam: FinalExamResult | null;
  capstoneProjects: CapstoneProjectItem[];
  certificate: SkillCertificate | null;
  defaultLearnerName: string;
  isDemoMode: boolean;
  onGoToRoadmap: () => void;
  onGoToVideos: () => void;
  onFinalExamEvaluated: (
    evaluation: FinalExamEvaluation,
    learnerName: string
  ) => Promise<void>;
  onProjectsGenerated: (projects: CapstoneProjectItem[]) => Promise<void>;
  onProjectEvaluated: (
    updatedProjects: CapstoneProjectItem[],
    evaluation: ProjectEvaluationResponse,
    learnerName: string
  ) => Promise<void>;
}

export const FinalExamCertificateView: React.FC<FinalExamCertificateViewProps> = ({
  profile,
  skillTree,
  scoreProfile,
  videoTestResults,
  finalExam,
  capstoneProjects,
  certificate,
  defaultLearnerName,
  isDemoMode,
  onGoToRoadmap,
  onGoToVideos,
  onFinalExamEvaluated,
  onProjectsGenerated,
  onProjectEvaluated,
}) => {
  const { showToast } = useToast();
  const [examPayload, setExamPayload] = useState<FinalExamPayload | null>(null);
  const [examLoading, setExamLoading] = useState(false);
  const [examError, setExamError] = useState<{
    action: 'generate' | 'evaluate';
    message: string;
  } | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [notesByQ, setNotesByQ] = useState<Record<string, string>>({});
  const [hintsOpen, setHintsOpen] = useState<Record<string, boolean>>({});
  const [evalLoading, setEvalLoading] = useState(false);
  const [latestEvaluation, setLatestEvaluation] = useState<FinalExamEvaluation | null>(null);
  const [customName, setCustomName] = useState(defaultLearnerName);

  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState<{
    action: 'generate' | 'evaluate' | 'validation';
    project?: CapstoneProjectItem;
    message: string;
  } | null>(null);
  const [projectTexts, setProjectTexts] = useState<Record<string, string>>({});
  const [projectUrls, setProjectUrls] = useState<Record<string, string>>({});
  const [submittingProjectId, setSubmittingProjectId] = useState<string | null>(null);

  const nodes = skillTree.nodes || [];
  const totalCount = nodes.length;
  const masteredCount = nodes.filter((n) => n.status === 'mastered').length;
  const remainingNodes = nodes.filter((n) => n.status !== 'mastered');
  const allModulesMastered = totalCount > 0 && masteredCount === totalCount;
  const skillCompletionPct = totalCount > 0 ? Math.round((masteredCount / totalCount) * 100) : 0;

  const assignedProjectsCount = capstoneProjects.length;
  const passedProjectsCount = capstoneProjects.filter((p) => p.status === 'passed').length;
  const allProjectsPassed =
    assignedProjectsCount > 0 && passedProjectsCount === assignedProjectsCount;
  const examPassed = Boolean(finalExam?.passed);

  const avgVideoScore =
    videoTestResults.length > 0
      ? Math.round(
          videoTestResults.reduce((sum, item) => sum + item.score, 0) / videoTestResults.length
        )
      : 0;

  const handleStartExam = async () => {
    if (examLoading) return;
    setExamLoading(true);
    setExamError(null);
    setLatestEvaluation(null);
    setAnswers({});
    setNotesByQ({});
    setHintsOpen({});

    try {
      const data = await safeApiPost<FinalExamPayload>('/api/skill-tree/final-exam/generate', {
        topic: skillTree.topic,
        goal: profile.goal,
        estimatedLevel: profile.estimatedLevel,
        nodes: skillTree.nodes.map((n) => ({
          id: n.id,
          title: n.title,
          summary: n.summary,
          tier: n.tier,
        })),
      });
      setExamPayload(data);
    } catch (err) {
      const friendly = toUserFriendlyError(
        err,
        'Unable to start the final AI exam right now.'
      );
      setExamError({ action: 'generate', message: friendly });
      showToast(friendly, 'error');
    } finally {
      setExamLoading(false);
    }
  };

  const allQuestionsAnswered =
    examPayload !== null &&
    examPayload.questions.length > 0 &&
    examPayload.questions.every((q) => Boolean((notesByQ[q.id] || answers[q.id] || '').trim()));

  const submitExamEvaluation = async () => {
    if (!examPayload || !allQuestionsAnswered || evalLoading) return;

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

      const data = await safeApiPost<FinalExamEvaluation>('/api/skill-tree/final-exam/evaluate', {
        topic: skillTree.topic,
        estimatedLevel: profile.estimatedLevel,
        questions: examPayload.questions.map((q) => ({
          id: q.id,
          prompt: q.prompt,
          moduleTitle: q.moduleTitle,
        })),
        userAnswers,
      });

      setLatestEvaluation(data);
      const recipientName = (customName.trim() || defaultLearnerName || 'Learner').trim();
      await onFinalExamEvaluated(data, recipientName);
    } catch (err) {
      const friendly = toUserFriendlyError(err, 'Could not evaluate final exam answers.');
      setExamError({ action: 'evaluate', message: friendly });
      showToast(friendly, 'error');
    } finally {
      setEvalLoading(false);
    }
  };

  const handleSubmitExam = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitExamEvaluation();
  };

  const handleGenerateProjects = async () => {
    if (projectsLoading) return;
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const data = await safeApiPost<{ projects?: CapstoneProjectItem[] }>(
        '/api/skill-tree/projects/generate',
        {
          topic: skillTree.topic,
          goal: profile.goal,
          estimatedLevel: profile.estimatedLevel,
          nodes: skillTree.nodes.map((n) => ({
            id: n.id,
            title: n.title,
            summary: n.summary,
            tier: n.tier,
          })),
        }
      );
      const list = (data.projects || []) as CapstoneProjectItem[];
      await onProjectsGenerated(list);
    } catch (err) {
      const friendly = toUserFriendlyError(
        err,
        'Unable to generate assigned projects right now.'
      );
      setProjectsError({ action: 'generate', message: friendly });
      showToast(friendly, 'error');
    } finally {
      setProjectsLoading(false);
    }
  };

  const submitProjectEvaluation = async (project: CapstoneProjectItem) => {
    if (submittingProjectId) return;
    const submissionText = (projectTexts[project.id] ?? project.submissionText ?? '').trim();
    const submissionUrl = (projectUrls[project.id] ?? project.submissionUrl ?? '').trim();
    if (submissionText.length < 20) {
      const valMsg =
        'Please describe your implemented solution, key steps, and deliverables (at least 20 characters).';
      setProjectsError({ action: 'validation', message: valMsg });
      showToast(valMsg, 'error');
      return;
    }

    setSubmittingProjectId(project.id);
    setProjectsError(null);
    try {
      const data = await safeApiPost<ProjectEvaluationResponse>(
        '/api/skill-tree/projects/evaluate',
        {
          topic: skillTree.topic,
          estimatedLevel: profile.estimatedLevel,
          project: {
            id: project.id,
            title: project.title,
            brief: project.brief,
            deliverables: project.deliverables,
            acceptanceCriteria: project.acceptanceCriteria,
          },
          submissionText,
          submissionUrl,
        }
      );

      const updatedProjects: CapstoneProjectItem[] = capstoneProjects.map((item) =>
        item.id === project.id
          ? {
              ...item,
              status: data.passed ? 'passed' : 'needs_revision',
              submissionText,
              submissionUrl: submissionUrl || undefined,
              score: data.score,
              pointsAwarded: data.pointsAwarded,
              feedback: data.feedback,
              strengths: data.strengths,
              improvements: data.improvements,
              completedAtIso: data.completedAtIso,
            }
          : item
      );

      const recipientName = (customName.trim() || defaultLearnerName || 'Learner').trim();
      await onProjectEvaluated(updatedProjects, data, recipientName);
    } catch (err) {
      const friendly = toUserFriendlyError(
        err,
        'Project evaluation failed. Please try again.'
      );
      setProjectsError({ action: 'evaluate', project, message: friendly });
      showToast(friendly, 'error');
    } finally {
      setSubmittingProjectId(null);
    }
  };

  const handleSubmitProject = async (e: React.FormEvent, project: CapstoneProjectItem) => {
    e.preventDefault();
    await submitProjectEvaluation(project);
  };

  return (
    <div className="space-y-7 animate-fade-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Profile Score, Projects and Certificate
          </h2>
          <p className="text-sm text-slate-600 dark:text-[#AAB4C8]">
            Earn points from video tests, pass the Final AI Exam, and complete your assigned capstone projects to unlock your Certificate of Mastery.
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

      {/* 3-Step Certification Requirement Tracker */}
      {!certificate && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            className={`p-4 rounded-2xl border flex items-center gap-3 ${
              allModulesMastered
                ? 'bg-emerald-50/70 dark:bg-[#34D399]/10 border-emerald-200 dark:border-[#34D399]/35'
                : 'bg-white dark:bg-[#17213A] border-slate-200 dark:border-[#273554]'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                allModulesMastered
                  ? 'bg-[#34D399] text-[#0B1020]'
                  : 'bg-slate-100 dark:bg-[#11182B] text-slate-600 dark:text-[#AAB4C8]'
              }`}
            >
              {allModulesMastered ? <CheckCircle2 className="w-4 h-4" /> : '1'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                Complete All Modules
              </p>
              <p className="text-[11px] text-slate-500 dark:text-[#AAB4C8] tabular-nums">
                {masteredCount} of {totalCount} mastered
              </p>
            </div>
          </div>

          <div
            className={`p-4 rounded-2xl border flex items-center gap-3 ${
              examPassed
                ? 'bg-emerald-50/70 dark:bg-[#34D399]/10 border-emerald-200 dark:border-[#34D399]/35'
                : 'bg-white dark:bg-[#17213A] border-slate-200 dark:border-[#273554]'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                examPassed
                  ? 'bg-[#34D399] text-[#0B1020]'
                  : 'bg-slate-100 dark:bg-[#11182B] text-slate-600 dark:text-[#AAB4C8]'
              }`}
            >
              {examPassed ? <CheckCircle2 className="w-4 h-4" /> : '2'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                Pass Final AI Exam
              </p>
              <p className="text-[11px] text-slate-500 dark:text-[#AAB4C8] tabular-nums">
                {examPassed
                  ? `Passed with ${finalExam?.score}%`
                  : allModulesMastered
                  ? 'Unlocked (70% needed)'
                  : 'Unlocks after modules'}
              </p>
            </div>
          </div>

          <div
            className={`p-4 rounded-2xl border flex items-center gap-3 ${
              allProjectsPassed
                ? 'bg-emerald-50/70 dark:bg-[#34D399]/10 border-emerald-200 dark:border-[#34D399]/35'
                : 'bg-white dark:bg-[#17213A] border-slate-200 dark:border-[#273554]'
            }`}
          >
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                allProjectsPassed
                  ? 'bg-[#34D399] text-[#0B1020]'
                  : 'bg-slate-100 dark:bg-[#11182B] text-slate-600 dark:text-[#AAB4C8]'
              }`}
            >
              {allProjectsPassed ? <CheckCircle2 className="w-4 h-4" /> : '3'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                Complete Assigned Projects
              </p>
              <p className="text-[11px] text-slate-500 dark:text-[#AAB4C8] tabular-nums">
                {assignedProjectsCount > 0
                  ? `${passedProjectsCount} of ${assignedProjectsCount} approved`
                  : allModulesMastered
                  ? 'Ready to generate'
                  : 'Unlocks after modules'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Earned Certificate Card */}
      {certificate ? (
        <div className="space-y-5">
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
                  has completed every module, submitted approved capstone projects, and passed the Final AI Certification Examination in
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
                  <p className="text-[11px] text-[#73809B]">Projects Verified</p>
                  <p className="font-display text-lg font-bold text-white mt-0.5 tabular-nums">
                    {certificate.projectsCompleted ?? passedProjectsCount} Completed
                  </p>
                </div>
                <div className="rounded-xl bg-[#17213A] border border-[#273554] p-3.5">
                  <p className="text-[11px] text-[#73809B]">Profile Score</p>
                  <p className="font-display text-lg font-bold text-white mt-0.5 tabular-nums">
                    {certificate.totalScore} pts
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
        <div className="space-y-6">
          {/* Recipient Name Input when unlocked */}
          {allModulesMastered && isDemoMode && (
            <div className="bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <label
                  htmlFor="certificate-learner-name"
                  className="block text-sm font-semibold text-slate-900 dark:text-white"
                >
                  Certificate Recipient Name
                </label>
                <p className="text-xs text-slate-500 dark:text-[#AAB4C8]">
                  This name will appear on your Certificate of Mastery once your exam and projects are complete.
                </p>
              </div>
              <input
                id="certificate-learner-name"
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full sm:w-72 px-3.5 py-2 text-sm bg-slate-50 dark:bg-[#11182B] border border-slate-200 dark:border-[#273554] rounded-xl text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#6D5DFB]/50"
              />
            </div>
          )}

          {/* Module completion progress if still locked */}
          {!allModulesMastered && (
            <div className="bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] rounded-2xl p-6 md:p-8 space-y-5">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-[#AAB4C8]">
                  <Lock className="w-4 h-4 text-slate-400" />
                  <span>Final AI Exam and Projects Locked Until Full Skill Completion</span>
                </div>
                <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                  Complete all {totalCount} modules to unlock your Exam and Projects
                </h3>
                <p className="text-sm text-slate-600 dark:text-[#AAB4C8] max-w-2xl">
                  Work through each module in your Learning Roadmap. Once 100% of modules are mastered, you will take the Final AI Exam and complete 2 real-world capstone projects to earn your certificate.
                </p>
              </div>

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

          {/* Step 2: Final AI Certification Exam */}
          {allModulesMastered && (
            <div className="bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] rounded-2xl p-6 md:p-8 space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#6D5DFB] dark:text-[#A78BFA]">
                    {examPassed ? (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-[#34D399]" />
                        <span className="text-emerald-600 dark:text-[#34D399]">
                          Step 2 Complete: Final AI Exam Passed ({finalExam?.score}%)
                        </span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Step 2: Final AI Certification Exam</span>
                      </>
                    )}
                  </div>
                  <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                    {examPassed
                      ? `Final ${skillTree.topic} Exam Verified`
                      : `Take Your Final ${skillTree.topic} AI Exam`}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-[#AAB4C8] max-w-2xl">
                    {examPassed
                      ? finalExam?.feedback ||
                        'You passed the comprehensive AI exam. Complete the assigned capstone projects below to unlock your certificate.'
                      : 'Answer 5 comprehensive questions across all modules (70% or higher required) and earn bonus points toward your profile.'}
                  </p>
                </div>

                {!examPassed && !examPayload && (
                  <button
                    type="button"
                    onClick={() => void handleStartExam()}
                    disabled={examLoading}
                    aria-busy={examLoading}
                    className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] hover:from-[#5B4CF2] hover:to-[#4D8DFF] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
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

              {examError && (
                <div
                  role="alert"
                  className="p-4 rounded-xl bg-rose-50 dark:bg-[#FB7185]/10 border border-rose-200 dark:border-[#FB7185]/35 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-800 dark:text-[#FB7185]"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{examError.message}</span>
                  </div>
                  <button
                    type="button"
                    disabled={examLoading || evalLoading}
                    onClick={() => {
                      if (examError.action === 'evaluate') {
                        void submitExamEvaluation();
                      } else {
                        void handleStartExam();
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#11182B] border border-rose-200 dark:border-[#FB7185]/40 text-rose-700 dark:text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Try again</span>
                  </button>
                </div>
              )}

              {finalExam && !finalExam.passed && !examPayload && (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-[#FBBF24]/10 border border-amber-200 dark:border-[#FBBF24]/30 space-y-1.5">
                  <p className="text-xs font-semibold text-amber-900 dark:text-[#FBBF24]">
                    Previous Final Exam Attempt: {finalExam.score}% (70% needed)
                  </p>
                  <p className="text-xs text-amber-800 dark:text-[#AAB4C8] leading-relaxed">
                    {finalExam.feedback}
                  </p>
                </div>
              )}

              {examPayload && !examPassed && (
                <form onSubmit={handleSubmitExam} className="space-y-6 pt-2 border-t border-slate-100 dark:border-[#273554]">
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
                          {latestEvaluation.feedback} Score 70% or higher to pass the Final Exam.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={examLoading}
                        aria-busy={examLoading}
                        onClick={() => void handleStartExam()}
                        className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-[#0B1020] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {examLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RotateCcw className="w-3.5 h-3.5" />
                        )}
                        <span>{examLoading ? 'Preparing AI Exam…' : 'Retake Final Exam'}</span>
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
                      aria-busy={evalLoading}
                      className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] hover:from-[#5B4CF2] hover:to-[#4D8DFF] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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

          {/* Step 3: Assigned Real-World Capstone Projects */}
          {allModulesMastered && (
            <div className="bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] rounded-2xl p-6 md:p-8 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#6D5DFB] dark:text-[#A78BFA]">
                    <FolderGit2 className="w-4 h-4" />
                    <span>
                      {allProjectsPassed
                        ? 'Step 3 Complete: All Assigned Projects Approved'
                        : 'Step 3: Hands-On Capstone Projects (Required for Certificate)'}
                    </span>
                  </div>
                  <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                    Build and Submit Your {skillTree.topic} Projects
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-[#AAB4C8] max-w-2xl">
                    After finishing the skill modules, complete these AI-assigned practical projects and submit your implementation summary for AI review to unlock your certificate.
                  </p>
                </div>

                {capstoneProjects.length === 0 && (
                  <button
                    type="button"
                    onClick={() => void handleGenerateProjects()}
                    disabled={projectsLoading}
                    aria-busy={projectsLoading}
                    className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] hover:from-[#5B4CF2] hover:to-[#4D8DFF] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {projectsLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Assigning Projects…</span>
                      </>
                    ) : (
                      <>
                        <FolderGit2 className="w-4 h-4" />
                        <span>Get Assigned Projects</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {projectsError && (
                <div
                  role="alert"
                  className="p-4 rounded-xl bg-rose-50 dark:bg-[#FB7185]/10 border border-rose-200 dark:border-[#FB7185]/35 flex flex-wrap items-center justify-between gap-3 text-xs text-rose-800 dark:text-[#FB7185]"
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{projectsError.message}</span>
                  </div>
                  {projectsError.action !== 'validation' && (
                    <button
                      type="button"
                      disabled={projectsLoading || Boolean(submittingProjectId)}
                      onClick={() => {
                        if (projectsError.action === 'evaluate' && projectsError.project) {
                          void submitProjectEvaluation(projectsError.project);
                        } else {
                          void handleGenerateProjects();
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#11182B] border border-rose-200 dark:border-[#FB7185]/40 text-rose-700 dark:text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Try again</span>
                    </button>
                  )}
                </div>
              )}

              {capstoneProjects.length > 0 && (
                <div className="space-y-6">
                  {capstoneProjects.map((project, idx) => {
                    const isPassed = project.status === 'passed';
                    const isSubmitting = submittingProjectId === project.id;
                    const textVal = projectTexts[project.id] ?? project.submissionText ?? '';
                    const urlVal = projectUrls[project.id] ?? project.submissionUrl ?? '';

                    return (
                      <div
                        key={project.id}
                        className={`rounded-2xl border p-5 md:p-6 space-y-5 ${
                          isPassed
                            ? 'bg-emerald-50/40 dark:bg-[#34D399]/5 border-emerald-200 dark:border-[#34D399]/35'
                            : 'bg-slate-50 dark:bg-[#11182B] border-slate-200 dark:border-[#273554]'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-mono font-semibold text-[#6D5DFB] dark:text-[#A78BFA]">
                                Project {idx + 1}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] text-slate-700 dark:text-[#AAB4C8] font-medium">
                                {project.difficulty}
                              </span>
                              <span className="inline-flex items-center gap-1 text-slate-500 dark:text-[#73809B]">
                                <Clock className="w-3.5 h-3.5" />
                                {project.estimatedHours}
                              </span>
                            </div>
                            <h4 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                              {project.title}
                            </h4>
                          </div>

                          <span
                            className={`px-3 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1.5 ${
                              isPassed
                                ? 'bg-emerald-100 dark:bg-[#34D399]/15 text-emerald-700 dark:text-[#34D399]'
                                : project.status === 'needs_revision'
                                ? 'bg-amber-100 dark:bg-[#FBBF24]/15 text-amber-700 dark:text-[#FBBF24]'
                                : 'bg-indigo-100 dark:bg-[#6D5DFB]/15 text-indigo-700 dark:text-[#A78BFA]'
                            }`}
                          >
                            {isPassed ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Approved ({project.score}%)</span>
                              </>
                            ) : project.status === 'needs_revision' ? (
                              <span>Needs Revision ({project.score}%)</span>
                            ) : (
                              <span>Ready to Build</span>
                            )}
                          </span>
                        </div>

                        <p className="text-sm text-slate-600 dark:text-[#AAB4C8] leading-relaxed">
                          {project.brief}
                        </p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 rounded-xl bg-white dark:bg-[#17213A] border border-slate-200/80 dark:border-[#273554] space-y-2">
                            <p className="text-xs font-semibold text-slate-900 dark:text-white">
                              Deliverables to Complete
                            </p>
                            <ul className="space-y-1.5 text-xs text-slate-600 dark:text-[#AAB4C8]">
                              {project.deliverables.map((d, dIdx) => (
                                <li key={dIdx}>· {d}</li>
                              ))}
                            </ul>
                          </div>

                          <div className="p-4 rounded-xl bg-white dark:bg-[#17213A] border border-slate-200/80 dark:border-[#273554] space-y-2">
                            <p className="text-xs font-semibold text-slate-900 dark:text-white">
                              AI Acceptance Criteria
                            </p>
                            <ul className="space-y-1.5 text-xs text-slate-600 dark:text-[#AAB4C8]">
                              {project.acceptanceCriteria.map((c, cIdx) => (
                                <li key={cIdx}>· {c}</li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {project.feedback && (
                          <div
                            className={`p-4 rounded-xl border space-y-2 text-xs ${
                              isPassed
                                ? 'bg-emerald-50 dark:bg-[#34D399]/10 border-emerald-200 dark:border-[#34D399]/30 text-emerald-900 dark:text-[#34D399]'
                                : 'bg-amber-50 dark:bg-[#FBBF24]/10 border-amber-200 dark:border-[#FBBF24]/30 text-amber-900 dark:text-[#FBBF24]'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 font-semibold">
                              <span>
                                AI Project Review Score: {project.score}% · +{project.pointsAwarded} pts added to profile
                              </span>
                            </div>
                            <p className="text-slate-700 dark:text-[#AAB4C8] leading-relaxed">
                              {project.feedback}
                            </p>
                            {project.strengths && project.strengths.length > 0 && (
                              <p className="text-slate-700 dark:text-slate-300">
                                <span className="font-semibold">Strengths:</span> {project.strengths.join('; ')}
                              </p>
                            )}
                            {project.improvements && project.improvements.length > 0 && (
                              <p className="text-slate-700 dark:text-slate-300">
                                <span className="font-semibold">Next polish:</span> {project.improvements.join('; ')}
                              </p>
                            )}
                          </div>
                        )}

                        {!isPassed && (
                          <form
                            onSubmit={(e) => void handleSubmitProject(e, project)}
                            className="space-y-3 pt-2 border-t border-slate-200/80 dark:border-[#273554]"
                          >
                            <div className="space-y-1.5">
                              <label
                                htmlFor={`project-summary-${project.id}`}
                                className="block text-xs font-semibold text-slate-700 dark:text-[#AAB4C8]"
                              >
                                Describe Your Completed Project and Solution
                              </label>
                              <textarea
                                id={`project-summary-${project.id}`}
                                rows={4}
                                value={textVal}
                                onChange={(e) =>
                                  setProjectTexts((prev) => ({
                                    ...prev,
                                    [project.id]: e.target.value,
                                  }))
                                }
                                placeholder="Explain what you built, how you structured it, key decisions, and how each deliverable was completed…"
                                className="w-full p-3.5 text-sm bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6D5DFB]/50"
                              />
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                              <div className="relative flex-1">
                                <Link2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                  type="url"
                                  value={urlVal}
                                  onChange={(e) =>
                                    setProjectUrls((prev) => ({
                                      ...prev,
                                      [project.id]: e.target.value,
                                    }))
                                  }
                                  placeholder="Optional: GitHub repo, notebook, or live demo URL"
                                  className="w-full pl-10 pr-3.5 py-2.5 text-xs bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6D5DFB]/50"
                                />
                              </div>

                              <button
                                type="submit"
                                disabled={isSubmitting || textVal.trim().length < 20}
                                aria-busy={isSubmitting}
                                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] hover:from-[#5B4CF2] hover:to-[#4D8DFF] text-white text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-45 disabled:cursor-not-allowed"
                              >
                                {isSubmitting ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>AI Reviewing…</span>
                                  </>
                                ) : (
                                  <>
                                    <Send className="w-3.5 h-3.5" />
                                    <span>
                                      {project.status === 'needs_revision'
                                        ? 'Resubmit Project for AI Review'
                                        : 'Submit Project for AI Review'}
                                    </span>
                                  </>
                                )}
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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
