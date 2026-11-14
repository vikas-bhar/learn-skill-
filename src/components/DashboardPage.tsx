import React from 'react';
import {
  LayoutDashboard,
  GitFork,
  BookOpen,
  PlaySquare,
  CalendarDays,
  PlusCircle,
  Sun,
  Moon,
  Flame,
  CheckCircle2,
  ArrowRight,
  Clock,
  Award,
} from 'lucide-react';
import {
  DashboardTab,
  DiagnosticProfile,
  SkillNode,
  SkillTreeData,
  StudyPlanDay,
  VideoResult,
  VideoSynthesis,
} from '../types/learning';
import { SkillPathLogo } from './SkillPathLogo';
import { RoadmapTreeView } from './RoadmapTreeView';
import { VideosView } from './VideosView';
import { StudyNotesView } from './StudyNotesView';
import { StudyPlanView } from './StudyPlanView';

interface DashboardPageProps {
  activeTab: DashboardTab;
  isDark: boolean;
  profile: DiagnosticProfile;
  skillTree: SkillTreeData | null;
  selectedNodeId: string | null;
  videos: VideoResult[];
  selectedVideo: VideoResult | null;
  bookmarkedIds: Record<string, boolean>;
  synthesis: VideoSynthesis | null;
  isSummarizing: boolean;
  error: string | null;
  onSelectTab: (tab: DashboardTab) => void;
  onToggleTheme: () => void;
  onStartNewSkill: () => void;
  onGoToDiagnostic: () => void;
  onSelectNode: (nodeId: string) => void;
  onUpdateNodeStatus: (nodeId: string, passed: boolean) => void;
  onVideosLoaded: (videos: VideoResult[]) => void;
  onSelectVideo: (video: VideoResult) => void;
  onToggleBookmark: (videoId: string) => void;
  onGenerateNotes: (video: VideoResult, transcriptContext: string) => Promise<void>;
  onGenerateNotesForNode: (node: SkillNode) => Promise<void>;
  onTogglePlanDay: (dayNumber: number) => void;
}

const NAV_TABS: Array<{ id: DashboardTab; label: string; mobileLabel: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', mobileLabel: 'Home', icon: LayoutDashboard },
  { id: 'roadmap', label: 'Learning Roadmap', mobileLabel: 'Roadmap', icon: GitFork },
  { id: 'notes', label: 'Study Notes', mobileLabel: 'Notes', icon: BookOpen },
  { id: 'videos', label: 'Videos', mobileLabel: 'Videos', icon: PlaySquare },
  { id: 'plan', label: '7-Day Plan', mobileLabel: 'Plan', icon: CalendarDays },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  activeTab,
  isDark,
  profile,
  skillTree,
  selectedNodeId,
  videos,
  selectedVideo,
  bookmarkedIds,
  synthesis,
  isSummarizing,
  error,
  onSelectTab,
  onToggleTheme,
  onStartNewSkill,
  onGoToDiagnostic,
  onSelectNode,
  onUpdateNodeStatus,
  onVideosLoaded,
  onSelectVideo,
  onToggleBookmark,
  onGenerateNotes,
  onGenerateNotesForNode,
  onTogglePlanDay,
}) => {
  const nodes = skillTree?.nodes || [];
  const masteredCount = nodes.filter((n) => n.status === 'mastered').length;
  const totalCount = nodes.length;
  const progressPct = totalCount > 0 ? Math.round((masteredCount / totalCount) * 100) : 0;

  const currentFocusNode =
    nodes.find((n) => n.id === skillTree?.recommendedNextId) ||
    nodes.find((n) => n.status === 'ready') ||
    nodes.find((n) => n.status === 'needs_review') ||
    nodes[0] ||
    null;

  const selectedNode =
    nodes.find((n) => n.id === selectedNodeId) || currentFocusNode;

  const studyPlan: StudyPlanDay[] =
    skillTree?.studyPlan && skillTree.studyPlan.length > 0
      ? skillTree.studyPlan
      : nodes.slice(0, 7).map((n, idx) => ({
          day: idx + 1,
          dateLabel: idx === 0 ? 'Day 1 · Today' : `Day ${idx + 1}`,
          moduleId: n.id,
          taskTitle: n.title,
          estimatedMinutes: n.estimatedMinutes,
          motivation: n.whyItMatters || n.summary,
          completed: n.status === 'mastered',
        }));

  const streakDays = Math.max(1, masteredCount + (studyPlan.filter((d) => d.completed).length > 0 ? 1 : 0));

  const handleOpenVideoForNode = (node: SkillNode) => {
    onSelectNode(node.id);
    onSelectTab('videos');
  };

  const handleOpenNotesForNode = (node: SkillNode) => {
    onSelectNode(node.id);
    onSelectTab('notes');
    if (!synthesis) {
      void onGenerateNotesForNode(node);
    }
  };

  const handleStartDaySession = (moduleId: string) => {
    onSelectNode(moduleId);
    onSelectTab('roadmap');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1020] text-slate-900 dark:text-[#F8FAFC] flex pb-20 lg:pb-0">
      {/* Desktop Fixed Left Sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-[264px] shrink-0 border-r border-slate-200 dark:border-[#273554] bg-white dark:bg-[#11182B] sticky top-0 h-screen">
        <div className="p-6 border-b border-slate-100 dark:border-[#273554]/80">
          <SkillPathLogo />
        </div>

        <div className="px-4 py-4 border-b border-slate-100 dark:border-[#273554]/80">
          <p className="px-2 text-[11px] font-medium text-slate-500 dark:text-[#73809B] mb-1">
            Active Track
          </p>
          <p className="px-2 font-display text-sm font-semibold text-slate-900 dark:text-white truncate">
            {skillTree?.topic || profile.topic || 'Select a skill'}
          </p>
        </div>

        <nav aria-label="Dashboard navigation" className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-3 transition-all cursor-pointer ${
                  active
                    ? 'bg-indigo-50 dark:bg-[#17213A] text-[#6D5DFB] dark:text-white border border-indigo-200/80 dark:border-[#6D5DFB]/40'
                    : 'text-slate-600 dark:text-[#AAB4C8] hover:bg-slate-50 dark:hover:bg-[#17213A]/50 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-[#6D5DFB] dark:text-[#A78BFA]' : ''}`} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-100 dark:border-[#273554]/80 space-y-3">
          <button
            type="button"
            onClick={onStartNewSkill}
            className="w-full py-2.5 px-3.5 rounded-xl bg-slate-100 dark:bg-[#17213A] hover:bg-slate-200 dark:hover:bg-[#1e2b4a] text-xs font-semibold text-slate-800 dark:text-white inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-[#4D8DFF]" />
            <span>Start New Skill</span>
          </button>

          <div className="flex items-center gap-3 px-2 pt-1">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6D5DFB] to-[#4D8DFF] text-white text-xs font-bold flex items-center justify-center shrink-0">
              A
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">Alex</p>
              <p className="text-[11px] text-slate-500 dark:text-[#73809B] truncate">
                {profile.estimatedLevel} · {profile.dailyMinutes}m/day
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Dashboard Header */}
        <header className="sticky top-0 z-20 border-b border-slate-200/80 dark:border-[#273554] bg-white/85 dark:bg-[#0B1020]/85 backdrop-blur-md">
          <div className="max-w-[1200px] mx-auto px-5 md:px-8 h-16 md:h-20 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="lg:hidden">
                <SkillPathLogo />
              </div>
              <div className="hidden lg:block min-w-0">
                <h1 className="font-display text-xl md:text-2xl font-bold text-slate-900 dark:text-white truncate">
                  {getGreeting()}, Alex
                </h1>
                <p className="text-xs md:text-sm text-slate-500 dark:text-[#AAB4C8] truncate">
                  You’re making steady progress in {skillTree?.topic || profile.topic}.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onStartNewSkill}
                className="lg:hidden px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-[#17213A] text-xs font-semibold text-slate-800 dark:text-white"
              >
                New Skill
              </button>
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                className="p-2.5 rounded-xl bg-slate-100 dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] text-slate-600 dark:text-[#AAB4C8] hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-[1200px] w-full mx-auto px-5 md:px-8 py-7 md:py-9">
          {!skillTree ? (
            <div className="bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] rounded-2xl p-10 text-center max-w-lg mx-auto space-y-4">
              <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white">
                No roadmap yet
              </h2>
              <p className="text-sm text-slate-600 dark:text-[#AAB4C8] leading-relaxed">
                No roadmap yet. Start a quick knowledge check to build your first learning path.
              </p>
              <button
                type="button"
                onClick={onGoToDiagnostic}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] hover:from-[#5B4CF2] hover:to-[#4D8DFF] text-white text-sm font-semibold cursor-pointer"
              >
                Start Knowledge Check
              </button>
            </div>
          ) : activeTab === 'overview' ? (
            <div className="space-y-7 animate-fade-up">
              {/* Mobile Greeting */}
              <div className="lg:hidden space-y-1">
                <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                  {getGreeting()}, Alex
                </h1>
                <p className="text-sm text-slate-600 dark:text-[#AAB4C8]">
                  You’re making steady progress in {skillTree.topic}.
                </p>
              </div>

              {/* 4 Compact Top Metric Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Current Level */}
                <div className="bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] rounded-2xl p-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-[#73809B]">
                      Current Level
                    </p>
                    <p className="font-display text-lg font-bold text-slate-900 dark:text-white mt-1">
                      {profile.estimatedLevel}
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-full bg-indigo-50 dark:bg-[#6D5DFB]/15 border border-indigo-200 dark:border-[#6D5DFB]/40 flex items-center justify-center text-[#6D5DFB] dark:text-[#A78BFA] shrink-0">
                    <Award className="w-5 h-5" />
                  </div>
                </div>

                {/* 2. Progress Ring */}
                <div className="bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] rounded-2xl p-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-[#73809B]">
                      Progress
                    </p>
                    <p className="font-display text-lg font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                      {progressPct}%
                    </p>
                  </div>
                  <div className="relative w-11 h-11 shrink-0">
                    <svg className="w-11 h-11 -rotate-90" viewBox="0 0 44 44">
                      <circle
                        cx="22"
                        cy="22"
                        r="18"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="4"
                        className="text-slate-100 dark:text-[#11182B]"
                      />
                      <circle
                        cx="22"
                        cy="22"
                        r="18"
                        fill="none"
                        stroke="url(#dashRingGrad)"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={113.1}
                        strokeDashoffset={113.1 * (1 - progressPct / 100)}
                      />
                      <defs>
                        <linearGradient id="dashRingGrad" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#6D5DFB" />
                          <stop offset="100%" stopColor="#4D8DFF" />
                        </linearGradient>
                      </defs>
                    </svg>
                  </div>
                </div>

                {/* 3. Modules Completed */}
                <div className="bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] rounded-2xl p-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-[#73809B]">
                      Modules Completed
                    </p>
                    <p className="font-display text-lg font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                      {masteredCount} of {totalCount}
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-full bg-emerald-50 dark:bg-[#34D399]/10 flex items-center justify-center text-[#34D399] shrink-0">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                </div>

                {/* 4. Learning Streak */}
                <div className="bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] rounded-2xl p-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium text-slate-500 dark:text-[#73809B]">
                      Learning Streak
                    </p>
                    <p className="font-display text-lg font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
                      {streakDays} days
                    </p>
                  </div>
                  <div className="w-11 h-11 rounded-full bg-amber-50 dark:bg-[#FBBF24]/10 flex items-center justify-center text-[#FBBF24] shrink-0">
                    <Flame className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* AI Learning Insight Card + Continue Learning Card */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Personalized AI Insight Card */}
                <div className="lg:col-span-6 relative overflow-hidden bg-white dark:bg-[#17213A] border border-indigo-200 dark:border-[#6D5DFB]/40 rounded-2xl p-6 shadow-[0_0_30px_rgba(109,93,251,0.12)] flex flex-col justify-between space-y-5">
                  <div
                    aria-hidden="true"
                    className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-[#6D5DFB]/15 blur-2xl pointer-events-none"
                  />
                  <div className="relative space-y-3">
                    <p className="text-xs font-semibold text-[#6D5DFB] dark:text-[#A78BFA]">
                      Your AI Learning Insight
                    </p>
                    <p className="text-base font-medium text-slate-900 dark:text-white leading-relaxed">
                      {currentFocusNode
                        ? `You have a solid grasp of ${profile.strengths[0] || 'the fundamentals'}. Focus next on ${currentFocusNode.title} before advancing to higher tiers.`
                        : `Your ${skillTree.topic} roadmap is calibrated and ready for your next focused session.`}
                    </p>

                    <div className="pt-2 space-y-2">
                      {profile.strengths.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-medium text-slate-500 dark:text-[#73809B] mr-1">
                            Strengths:
                          </span>
                          {profile.strengths.slice(0, 3).map((s) => (
                            <span
                              key={s}
                              className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-[#34D399]/10 text-emerald-700 dark:text-[#34D399] text-[11px] font-medium"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}

                      {profile.knowledgeGaps.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[11px] font-medium text-slate-500 dark:text-[#73809B] mr-1">
                            Focus areas:
                          </span>
                          {profile.knowledgeGaps.slice(0, 3).map((g) => (
                            <span
                              key={g}
                              className="px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-[#FBBF24]/10 text-amber-700 dark:text-[#FBBF24] text-[11px] font-medium"
                            >
                              {g}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="relative pt-2">
                    <button
                      type="button"
                      onClick={() => onSelectTab('roadmap')}
                      className="text-xs font-semibold text-[#6D5DFB] dark:text-[#A78BFA] hover:underline inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>View Full Analysis & Skill Tree</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Continue Learning Card */}
                <div className="lg:col-span-6 bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] rounded-2xl p-6 flex flex-col justify-between space-y-5">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#4D8DFF]">Continue Learning</span>
                      {currentFocusNode && (
                        <span className="inline-flex items-center gap-1 font-mono text-slate-500 dark:text-[#AAB4C8] tabular-nums">
                          <Clock className="w-3.5 h-3.5" />
                          {currentFocusNode.estimatedMinutes} min
                        </span>
                      )}
                    </div>

                    <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                      {currentFocusNode?.title || 'Module Complete'}
                    </h2>

                    <p className="text-sm text-slate-600 dark:text-[#AAB4C8] leading-relaxed">
                      {currentFocusNode?.learningObjectives?.[0] ||
                        currentFocusNode?.summary ||
                        'Explore the next unlocked module in your roadmap.'}
                    </p>

                    <div className="pt-1 space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-[#73809B] tabular-nums">
                        <span>Path completion</span>
                        <span>{progressPct}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 dark:bg-[#0B1020] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] hover:from-[#5B4CF2] hover:to-[#4D8DFF] rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(8, progressPct)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        if (currentFocusNode) onSelectNode(currentFocusNode.id);
                        onSelectTab('roadmap');
                      }}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] hover:from-[#5B4CF2] hover:to-[#4D8DFF] text-white text-sm font-semibold hover:shadow-[0_0_22px_rgba(109,93,251,0.4)] transition-all inline-flex items-center gap-2 cursor-pointer"
                    >
                      <span>Resume Module</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectTab('videos')}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-[#11182B] border border-slate-200 dark:border-[#273554] text-sm font-semibold text-slate-800 dark:text-white hover:border-slate-300 dark:hover:border-white/20 cursor-pointer"
                    >
                      Watch Videos
                    </button>
                  </div>
                </div>
              </div>

              {/* Embedded Interactive Skill Tree Preview right on Overview */}
              <RoadmapTreeView
                skillTree={skillTree}
                selectedNodeId={selectedNode?.id || null}
                isDark={isDark}
                error={error}
                onSelectNode={onSelectNode}
                onOpenVideoForNode={handleOpenVideoForNode}
                onOpenNotesForNode={handleOpenNotesForNode}
                onUpdateNodeStatus={onUpdateNodeStatus}
              />
            </div>
          ) : activeTab === 'roadmap' ? (
            <RoadmapTreeView
              skillTree={skillTree}
              selectedNodeId={selectedNode?.id || null}
              isDark={isDark}
              error={error}
              onSelectNode={onSelectNode}
              onOpenVideoForNode={handleOpenVideoForNode}
              onOpenNotesForNode={handleOpenNotesForNode}
              onUpdateNodeStatus={onUpdateNodeStatus}
            />
          ) : activeTab === 'videos' ? (
            <VideosView
              topic={skillTree.topic}
              activeNode={selectedNode}
              videos={videos}
              selectedVideo={selectedVideo}
              bookmarkedIds={bookmarkedIds}
              isSummarizing={isSummarizing}
              onVideosLoaded={onVideosLoaded}
              onSelectVideo={onSelectVideo}
              onToggleBookmark={onToggleBookmark}
              onGenerateNotes={onGenerateNotes}
            />
          ) : activeTab === 'notes' ? (
            <StudyNotesView
              nodes={nodes}
              selectedNodeId={selectedNode?.id || null}
              synthesis={synthesis}
              isDark={isDark}
              isRegenerating={isSummarizing}
              onSelectNode={onSelectNode}
              onRegenerateNotes={onGenerateNotesForNode}
            />
          ) : (
            <StudyPlanView
              plan={studyPlan}
              onToggleDay={onTogglePlanDay}
              onStartDaySession={handleStartDaySession}
            />
          )}
        </main>
      </div>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <nav
        aria-label="Mobile navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-slate-200 dark:border-[#273554] bg-white/95 dark:bg-[#11182B]/95 backdrop-blur-md px-2 py-1.5 flex items-center justify-around"
      >
        {NAV_TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`min-h-[44px] min-w-[56px] px-2 py-1 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                active
                  ? 'text-[#6D5DFB] dark:text-[#A78BFA]'
                  : 'text-slate-500 dark:text-[#73809B]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.mobileLabel}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
