import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  Loader2,
  AlertTriangle,
  GitFork,
  RotateCcw,
} from 'lucide-react';
import { DiagnosticMessage, DiagnosticProfile } from '../types/learning';
import { SkillPathLogo } from './SkillPathLogo';

interface DiagnosticAssessmentPageProps {
  profile: DiagnosticProfile;
  messages: DiagnosticMessage[];
  isLoading: boolean;
  isGeneratingTree: boolean;
  error: string | null;
  onBackToSetup: () => void;
  onSendMessage: (message: string) => Promise<void>;
  onGenerateSkillTree: () => Promise<void>;
  onRetry?: () => void;
  onLaunchDemo: () => void;
}

const ANALYSIS_STEPS = [
  'Mapping your strengths and knowledge gaps…',
  'Building your personalized path…',
  'Finding the best next steps…',
];

export const DiagnosticAssessmentPage: React.FC<DiagnosticAssessmentPageProps> = ({
  profile,
  messages,
  isLoading,
  isGeneratingTree,
  error,
  onBackToSetup,
  onSendMessage,
  onGenerateSkillTree,
  onRetry,
  onLaunchDemo,
}) => {
  const [selectedChoice, setSelectedChoice] = useState('');
  const [freeText, setFreeText] = useState('');
  const [analysisStepIdx, setAnalysisStepIdx] = useState(0);

  const totalQuestions = 5;
  const currentQuestionNum = Math.min(totalQuestions, profile.turnCount + 1);
  const latestAssistant = [...messages].reverse().find((m) => m.role === 'assistant');

  useEffect(() => {
    setSelectedChoice('');
    setFreeText('');
  }, [latestAssistant?.id]);

  useEffect(() => {
    if (!isGeneratingTree) {
      setAnalysisStepIdx(0);
      return;
    }
    const id = setInterval(() => {
      setAnalysisStepIdx((prev) => (prev + 1) % ANALYSIS_STEPS.length);
    }, 1400);
    return () => clearInterval(id);
  }, [isGeneratingTree]);

  const handleSubmitAnswer = async (e: React.FormEvent) => {
    e.preventDefault();
    const answer = (freeText.trim() || selectedChoice).trim();
    if (!answer || isLoading) return;
    await onSendMessage(answer);
  };

  // Full-screen AI Analysis Transition when building roadmap
  if (isGeneratingTree) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0B1020] text-slate-900 dark:text-[#F8FAFC] flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-8 animate-fade-up">
          {/* Animated Connected Graph Nodes SVG */}
          <div className="relative mx-auto w-56 h-36 flex items-center justify-center">
            <div
              aria-hidden="true"
              className="absolute inset-0 rounded-full bg-gradient-to-tr from-[#6D5DFB]/30 via-[#4D8DFF]/20 to-transparent blur-2xl"
            />
            <svg viewBox="0 0 220 120" className="relative w-full h-full">
              <path
                d="M30 60 C70 60, 75 25, 110 25 C145 25, 150 60, 190 60"
                fill="none"
                stroke="#6D5DFB"
                strokeWidth="2"
                strokeDasharray="6 4"
                className="animate-pulse"
              />
              <path
                d="M30 60 C70 60, 75 95, 110 95 C145 95, 150 60, 190 60"
                fill="none"
                stroke="#4D8DFF"
                strokeWidth="2"
                strokeDasharray="6 4"
                className="animate-pulse"
              />
              <circle cx="30" cy="60" r="10" fill="#34D399" />
              <circle cx="110" cy="25" r="10" fill="#6D5DFB" className="animate-pulse" />
              <circle cx="110" cy="95" r="10" fill="#4D8DFF" className="animate-pulse" />
              <circle cx="190" cy="60" r="11" fill="#A78BFA" />
            </svg>
          </div>

          <div className="space-y-3">
            <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              {ANALYSIS_STEPS[analysisStepIdx]}
            </h1>
            <p className="text-sm text-slate-600 dark:text-[#AAB4C8]">
              Calibrating your {profile.topic} skill tree and {profile.dailyMinutes}-minute daily roadmap.
            </p>
          </div>

          <div className="w-48 h-1.5 bg-slate-200 dark:bg-[#17213A] rounded-full mx-auto overflow-hidden">
            <div className="h-full w-2/3 bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1020] text-slate-900 dark:text-[#F8FAFC] flex flex-col overflow-x-hidden">
      {/* Top Progress Strip */}
      <header className="border-b border-slate-200 dark:border-[#273554] bg-white/80 dark:bg-[#0B1020]/80 backdrop-blur-md">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <button
              type="button"
              onClick={onBackToSetup}
              className="min-w-[40px] min-h-[40px] p-2 rounded-lg text-slate-500 dark:text-[#AAB4C8] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#17213A] transition-colors flex items-center justify-center shrink-0 cursor-pointer"
              aria-label="Back to setup"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <SkillPathLogo />
          </div>

          <div className="flex items-center gap-2 sm:gap-3 text-xs font-medium text-slate-600 dark:text-[#AAB4C8] tabular-nums whitespace-nowrap shrink-0">
            <span className="hidden sm:inline">Step 2 of 2</span>
            <span aria-hidden="true" className="hidden sm:inline">·</span>
            <span>Question {currentQuestionNum} of {totalQuestions}</span>
          </div>
        </div>

        {/* 5-dot animated progress bar */}
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 pb-3 flex items-center gap-2">
          {Array.from({ length: totalQuestions }).map((_, idx) => {
            const done = idx < profile.turnCount;
            const active = idx === profile.turnCount;
            return (
              <div
                key={idx}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  done
                    ? 'bg-[#34D399]'
                    : active
                    ? 'bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF]'
                    : 'bg-slate-200 dark:bg-[#17213A]'
                }`}
              />
            );
          })}
        </div>
      </header>

      <main className="flex-1 max-w-[1360px] w-full mx-auto px-6 py-8 md:py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Compact Context Sidebar */}
        <aside className="lg:col-span-3 bg-white dark:bg-[#11182B] border border-slate-200 dark:border-[#273554] rounded-2xl p-5 space-y-5">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-[#73809B] mb-1">
              Selected skill
            </p>
            <p className="font-display text-base font-semibold text-slate-900 dark:text-white">
              {profile.topic}
            </p>
          </div>

          <div className="border-t border-slate-100 dark:border-[#273554]/80 pt-4">
            <p className="text-xs font-medium text-slate-500 dark:text-[#73809B] mb-1">
              Learning goal
            </p>
            <p className="text-sm text-slate-700 dark:text-[#AAB4C8] leading-snug">
              {profile.goal || 'Master core concepts'}
            </p>
          </div>

          <div className="border-t border-slate-100 dark:border-[#273554]/80 pt-4">
            <p className="text-xs font-medium text-slate-500 dark:text-[#73809B] mb-2">
              Assessment progress
            </p>
            <div className="flex items-center justify-between text-xs font-semibold tabular-nums mb-1.5">
              <span className="text-slate-700 dark:text-[#AAB4C8]">Calibration</span>
              <span className="text-[#4D8DFF]">{profile.confidenceScore}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-100 dark:bg-[#17213A] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] transition-all duration-300"
                style={{ width: `${profile.confidenceScore}%` }}
              />
            </div>
          </div>

          {(profile.readyForSkillTree || profile.turnCount >= 2) && (
            <div className="border-t border-slate-100 dark:border-[#273554]/80 pt-4">
              <button
                type="button"
                disabled={isLoading || isGeneratingTree}
                onClick={() => void onGenerateSkillTree()}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white rounded-xl bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] hover:from-[#5B4CF2] hover:to-[#4D8DFF] hover:shadow-[0_0_20px_rgba(109,93,251,0.4)] transition-all inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isGeneratingTree ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <GitFork className="w-3.5 h-3.5" />
                )}
                <span>Build My Roadmap Now</span>
              </button>
            </div>
          )}
        </aside>

        {/* Central Calm Question Card */}
        <section className="lg:col-span-6 bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] rounded-2xl p-6 md:p-8 shadow-xl space-y-6 animate-fade-up">
          {/* AI Header */}
          <div className="flex items-start gap-4 border-b border-slate-100 dark:border-[#273554]/80 pb-5">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6D5DFB] to-[#4D8DFF] flex items-center justify-center text-white shadow-md shadow-[#6D5DFB]/30 shrink-0">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display text-lg md:text-xl font-semibold text-slate-900 dark:text-white">
                Let’s understand your starting point
              </h1>
              <p className="text-xs md:text-sm text-slate-500 dark:text-[#AAB4C8]">
                There are no wrong answers. This helps us personalize your path.
              </p>
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="p-4 rounded-xl bg-rose-50 dark:bg-[#FB7185]/10 border border-rose-200 dark:border-[#FB7185]/35 space-y-3"
            >
              <div className="flex items-start gap-2.5 text-xs text-rose-800 dark:text-[#FB7185] leading-relaxed">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-[#FB7185]" />
                <span>{error}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {onRetry && (
                  <button
                    type="button"
                    disabled={isLoading || isGeneratingTree}
                    onClick={onRetry}
                    className="px-3.5 py-2 text-xs font-semibold text-rose-800 dark:text-white bg-white dark:bg-[#11182B] border border-rose-200 dark:border-[#FB7185]/40 hover:border-rose-300 rounded-lg inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Try again</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onLaunchDemo}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] hover:from-[#5B4CF2] hover:to-[#4D8DFF] rounded-lg cursor-pointer"
                >
                  Open Interactive Demo Roadmap
                </button>
              </div>
            </div>
          )}

          {isLoading && !latestAssistant ? (
            <div className="py-12 space-y-4">
              <div className="flex items-center gap-2.5 text-sm text-slate-500 dark:text-[#AAB4C8]">
                <Loader2 className="w-4 h-4 animate-spin text-[#6D5DFB]" />
                <span>Preparing your first calibration question for {profile.topic}…</span>
              </div>
              <div className="h-6 w-3/4 bg-slate-100 dark:bg-[#11182B] rounded-lg animate-pulse" />
              <div className="h-14 w-full bg-slate-100 dark:bg-[#11182B] rounded-xl animate-pulse" />
              <div className="h-14 w-full bg-slate-100 dark:bg-[#11182B] rounded-xl animate-pulse" />
            </div>
          ) : latestAssistant ? (
            <form onSubmit={handleSubmitAnswer} className="space-y-6">
              <div className="space-y-2">
                <span className="inline-block font-mono text-xs font-medium text-[#6D5DFB] dark:text-[#A78BFA] tabular-nums">
                  Question {currentQuestionNum} of {totalQuestions}
                </span>
                <p className="font-display text-xl md:text-2xl font-semibold text-slate-900 dark:text-white leading-snug">
                  {latestAssistant.content}
                </p>
                {latestAssistant.assessment?.note &&
                  latestAssistant.assessment.verdict !== 'initial' && (
                    <p className="text-xs text-slate-500 dark:text-[#AAB4C8] pt-1">
                      Previous check ({latestAssistant.assessment.conceptChecked}):{' '}
                      {latestAssistant.assessment.note}
                    </p>
                  )}
              </div>

              {/* Selectable Large Option Cards */}
              {latestAssistant.suggestedReplies && latestAssistant.suggestedReplies.length > 0 && (
                <div className="space-y-2.5">
                  <span className="block text-xs font-medium text-slate-500 dark:text-[#73809B]">
                    Choose the closest description or write your own below
                  </span>
                  {latestAssistant.suggestedReplies.map((option, idx) => {
                    const isSelected = selectedChoice === option;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setSelectedChoice(option);
                          setFreeText('');
                        }}
                        className={`w-full text-left p-4 rounded-xl border text-sm leading-relaxed transition-all flex items-start gap-3 cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 dark:bg-[#6D5DFB]/20 border-[#6D5DFB] text-slate-900 dark:text-white shadow-[0_0_16px_rgba(109,93,251,0.2)]'
                            : 'bg-slate-50 dark:bg-[#11182B] border-slate-200 dark:border-[#273554] text-slate-700 dark:text-[#AAB4C8] hover:border-slate-300 dark:hover:border-white/20'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-mono ${
                            isSelected
                              ? 'border-[#6D5DFB] bg-[#6D5DFB] text-white'
                              : 'border-slate-300 dark:border-white/20 text-slate-400'
                          }`}
                        >
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span>{option}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Free-text reasoning input */}
              <div>
                <label
                  htmlFor="diagnostic-free-text"
                  className="block text-xs font-medium text-slate-600 dark:text-[#AAB4C8] mb-1.5"
                >
                  Or explain in your own words
                </label>
                <textarea
                  id="diagnostic-free-text"
                  rows={2}
                  value={freeText}
                  onChange={(e) => {
                    setFreeText(e.target.value);
                    if (e.target.value.trim()) setSelectedChoice('');
                  }}
                  placeholder="Share what you already know or what feels unclear..."
                  className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-[#11182B] border border-slate-200 dark:border-[#273554] rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#73809B] focus:outline-none focus:ring-2 focus:ring-[#6D5DFB]/50 focus:border-[#6D5DFB]"
                />
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-[#273554]/80 flex flex-wrap items-center justify-between gap-3">
                {profile.turnCount >= 2 ? (
                  <button
                    type="button"
                    disabled={isLoading || isGeneratingTree}
                    onClick={() => void onGenerateSkillTree()}
                    className="text-xs font-semibold text-[#6D5DFB] dark:text-[#A78BFA] hover:underline cursor-pointer disabled:opacity-50"
                  >
                    Skip remaining and generate path
                  </button>
                ) : (
                  <span className="text-xs text-slate-500 dark:text-[#73809B]">
                    Adapts in real time to your answer
                  </span>
                )}

                <button
                  type="submit"
                  disabled={isLoading || (!selectedChoice && !freeText.trim())}
                  className="px-6 py-3 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] hover:from-[#5B4CF2] hover:to-[#4D8DFF] disabled:opacity-40 hover:shadow-[0_0_24px_rgba(109,93,251,0.45)] transition-all inline-flex items-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Evaluating…</span>
                    </>
                  ) : profile.turnCount >= 4 ? (
                    <>
                      <span>Finish and Build Path</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <span>Continue</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : null}
        </section>

        {/* Right Encouragement & Emerging Skill Profile */}
        <aside className="lg:col-span-3 bg-white dark:bg-[#11182B] border border-slate-200 dark:border-[#273554] rounded-2xl p-5 space-y-5">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-[#34D399]">
              You’re doing great
            </p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              This assessment adapts to your answers.
            </p>
            <p className="text-xs text-slate-500 dark:text-[#73809B] leading-relaxed">
              Every response narrows down what you can skip and where your highest-leverage next step sits.
            </p>
          </div>

          <div className="border-t border-slate-100 dark:border-[#273554]/80 pt-4 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 dark:text-[#73809B]">Estimated Level</span>
              <span className="font-semibold text-slate-900 dark:text-white">
                {profile.estimatedLevel}
              </span>
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-[#73809B] mb-1.5">
                Emerging Strengths
              </p>
              {profile.strengths.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {profile.strengths.map((s) => (
                    <span
                      key={s}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-[#34D399]/10 text-emerald-700 dark:text-[#34D399] text-[11px] font-medium"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      {s}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 dark:text-[#73809B]">
                  Surfacing as you respond…
                </p>
              )}
            </div>

            <div>
              <p className="text-xs font-medium text-slate-500 dark:text-[#73809B] mb-1.5">
                Focus Areas Detected
              </p>
              {profile.knowledgeGaps.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {profile.knowledgeGaps.map((g) => (
                    <span
                      key={g}
                      className="px-2.5 py-1 rounded-full bg-amber-50 dark:bg-[#FBBF24]/10 text-amber-700 dark:text-[#FBBF24] text-[11px] font-medium"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 dark:text-[#73809B]">
                  None flagged yet.
                </p>
              )}
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
};
