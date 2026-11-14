import React from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  GitFork,
  MessageSquare,
  Play,
  PlaySquare,
  CalendarDays,
  BookOpen,
  TrendingUp,
  Sun,
  Moon,
  LogOut,
  Loader2,
  AlertTriangle,
  LayoutDashboard,
  Menu,
  X,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { SavedLearningPath } from '../lib/learningStore';
import { SkillPathLogo } from './SkillPathLogo';
import { GoogleGIcon } from './GoogleGIcon';

interface LandingPageProps {
  isDark: boolean;
  user: User | null;
  authReady: boolean;
  authLoading: boolean;
  authError: string | null;
  savedPaths: SavedLearningPath[];
  onToggleTheme: () => void;
  onStartSetup: (presetTopic?: string) => void;
  onEnterDemoSetup: (presetTopic?: string) => void;
  onTryDemo: () => void;
  onSignIn: () => Promise<boolean>;
  onSignOut: () => Promise<void>;
  onOpenSavedPath: (path: SavedLearningPath) => void;
  onClearAuthError: () => void;
}

const EXPLORE_SKILLS = [
  { name: 'Python', summary: 'Automation, scripting, and data analysis pipelines' },
  { name: 'UI/UX Design', summary: 'Visual hierarchy, wireframing, and design systems' },
  { name: 'Machine Learning', summary: 'Supervised models, embeddings, and evaluation' },
  { name: 'Data Analysis', summary: 'SQL queries, Pandas transforms, and storytelling' },
];

const FEATURES = [
  {
    icon: MessageSquare,
    title: 'AI Diagnostic Chat',
    description:
      'Calibrates your true starting level in 5 focused questions instead of forcing you through material you already know.',
  },
  {
    icon: GitFork,
    title: 'Personalized Skill Tree',
    description:
      'Visualizes prerequisites as an interactive dependency graph so you always know what unlocks next.',
  },
  {
    icon: PlaySquare,
    title: 'Smart Video Recommendations',
    description:
      'Matches each skill node with curated, high-signal YouTube lectures tailored to your exact knowledge gap.',
  },
  {
    icon: BookOpen,
    title: 'AI Study Notes',
    description:
      'Transforms lectures and transcripts into scannable summaries, common mistake warnings, and concept flowcharts.',
  },
  {
    icon: CalendarDays,
    title: 'Daily Study Plan',
    description:
      'Builds a realistic 7-day momentum schedule calibrated to your weekly availability and daily focus window.',
  },
  {
    icon: TrendingUp,
    title: 'Progress Tracking',
    description:
      'Verifies conceptual mastery with quick applied checks and automatically unlocks downstream skills.',
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({
  isDark,
  user,
  authReady,
  authLoading,
  authError,
  savedPaths,
  onToggleTheme,
  onStartSetup,
  onEnterDemoSetup,
  onTryDemo,
  onSignIn,
  onSignOut,
  onOpenSavedPath,
  onClearAuthError,
}) => {
  const [pendingTopic, setPendingTopic] = React.useState<string | undefined>(undefined);
  const [showModeModal, setShowModeModal] = React.useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const firstName = user?.displayName?.split(' ')[0] || 'Learner';

  const handleRequestStart = (presetTopic?: string) => {
    setMobileMenuOpen(false);
    if (user) {
      onStartSetup(presetTopic);
      return;
    }
    setPendingTopic(presetTopic);
    setShowModeModal(true);
  };
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1020] text-slate-900 dark:text-[#F8FAFC] relative overflow-x-hidden">
      {/* Subtle architectural grid & indigo radial backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-40 dark:opacity-25"
        style={{
          backgroundImage:
            'radial-gradient(rgba(109, 93, 251, 0.14) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Sticky Glass Top Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-[#273554] bg-white/80 dark:bg-[#0B1020]/80 backdrop-blur-md">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3 sm:gap-6">
          <a
            href="#top"
            className="shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#6D5DFB] rounded-lg"
          >
            <SkillPathLogo />
          </a>

          <nav aria-label="Landing navigation" className="hidden md:flex items-center gap-6 lg:gap-7 text-sm font-medium text-slate-600 dark:text-[#AAB4C8]">
            <a
              href="#how-it-works"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
            <a
              href="#features"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Features
            </a>
            <a
              href="#explore-skills"
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Explore Skills
            </a>
            <button
              type="button"
              onClick={onTryDemo}
              className="hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Demo Mode
            </button>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              className="min-w-[40px] min-h-[40px] p-2 rounded-lg text-slate-600 dark:text-[#AAB4C8] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#17213A] transition-colors flex items-center justify-center cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <div className="hidden md:flex items-center gap-2.5 shrink-0">
              {authReady && user ? (
                <div className="flex items-center gap-2">
                  {savedPaths.length > 0 && (
                    <button
                      type="button"
                      onClick={() => onOpenSavedPath(savedPaths[0])}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-[#F8FAFC] bg-slate-100 dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] hover:border-[#6D5DFB]/60 rounded-[10px] transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5 text-[#4D8DFF]" />
                      <span>My Roadmap</span>
                    </button>
                  )}
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-[10px] bg-slate-100 dark:bg-[#17213A] border border-slate-200 dark:border-[#273554]">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={firstName}
                        referrerPolicy="no-referrer"
                        className="w-5 h-5 rounded-full object-cover"
                      />
                    ) : (
                      <span className="w-5 h-5 rounded-full bg-gradient-to-br from-[#6D5DFB] to-[#4D8DFF] text-white text-[10px] font-bold flex items-center justify-center">
                        {firstName.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <span className="text-xs font-medium text-slate-800 dark:text-[#F8FAFC] max-w-[100px] truncate">
                      {firstName}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void onSignOut()}
                    disabled={authLoading}
                    title="Sign out"
                    aria-label="Sign out"
                    className="p-2 rounded-[10px] text-slate-600 dark:text-[#AAB4C8] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#17213A] border border-transparent hover:border-slate-200 dark:hover:border-[#273554] transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => void onSignIn()}
                  disabled={!authReady || authLoading}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-800 dark:text-[#F8FAFC] bg-white dark:bg-[#11182B] border border-slate-200 dark:border-[#273554] hover:border-[#6D5DFB]/60 rounded-[10px] transition-all inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                >
                  {authLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6D5DFB]" />
                  ) : (
                    <GoogleGIcon className="w-4 h-4" />
                  )}
                  <span>Continue with Google</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleRequestStart()}
                className="px-4 py-2 text-sm font-semibold text-white rounded-[10px] bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] hover:from-[#5B4CF2] hover:to-[#4D8DFF] hover:shadow-[0_0_24px_rgba(109,93,251,0.45)] transition-all whitespace-nowrap shrink-0 cursor-pointer"
              >
                Build My Path
              </button>
            </div>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-landing-menu"
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="md:hidden min-w-[44px] min-h-[44px] rounded-xl bg-slate-100 dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] text-slate-700 dark:text-[#F8FAFC] flex items-center justify-center cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu Sheet */}
        {mobileMenuOpen && (
          <div
            id="mobile-landing-menu"
            className="md:hidden border-t border-slate-200 dark:border-[#273554] bg-white dark:bg-[#11182B] px-4 py-5 space-y-4 shadow-2xl"
          >
            <nav aria-label="Mobile navigation" className="flex flex-col space-y-1">
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-[#AAB4C8] hover:bg-slate-100 dark:hover:bg-[#17213A] hover:text-slate-900 dark:hover:text-white"
              >
                How It Works
              </a>
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-[#AAB4C8] hover:bg-slate-100 dark:hover:bg-[#17213A] hover:text-slate-900 dark:hover:text-white"
              >
                Features
              </a>
              <a
                href="#explore-skills"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-[#AAB4C8] hover:bg-slate-100 dark:hover:bg-[#17213A] hover:text-slate-900 dark:hover:text-white"
              >
                Explore Skills
              </a>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onTryDemo();
                }}
                className="text-left px-3 py-2.5 rounded-xl text-sm font-medium text-slate-700 dark:text-[#AAB4C8] hover:bg-slate-100 dark:hover:bg-[#17213A] hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Demo Mode
              </button>
            </nav>

            <div className="pt-3 border-t border-slate-200 dark:border-[#273554] space-y-2.5">
              {authReady && user ? (
                <>
                  <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#17213A]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={firstName}
                          referrerPolicy="no-referrer"
                          className="w-6 h-6 rounded-full object-cover"
                        />
                      ) : (
                        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[#6D5DFB] to-[#4D8DFF] text-white text-[11px] font-bold flex items-center justify-center">
                          {firstName.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {firstName}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        void onSignOut();
                      }}
                      className="text-xs font-semibold text-slate-600 dark:text-[#AAB4C8] hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign out</span>
                    </button>
                  </div>
                  {savedPaths.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        onOpenSavedPath(savedPaths[0]);
                      }}
                      className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] text-sm font-semibold text-slate-800 dark:text-white inline-flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <LayoutDashboard className="w-4 h-4 text-[#4D8DFF]" />
                      <span>Open My Roadmap</span>
                    </button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    void onSignIn();
                  }}
                  disabled={!authReady || authLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] text-sm font-semibold text-slate-800 dark:text-white inline-flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
                >
                  {authLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#6D5DFB]" />
                  ) : (
                    <GoogleGIcon className="w-4 h-4" />
                  )}
                  <span>Continue with Google</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleRequestStart()}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] hover:from-[#5B4CF2] hover:to-[#4D8DFF] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Build My Path</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </header>

      {authError && (
        <div className="max-w-[1280px] mx-auto px-6 pt-4 relative z-20">
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-[#FB7185]/10 border border-rose-200 dark:border-[#FB7185]/35 flex items-center justify-between gap-3 text-xs text-rose-800 dark:text-[#FB7185]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
            <button
              type="button"
              onClick={onClearAuthError}
              className="font-semibold hover:underline shrink-0 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <main id="top" className="relative z-10">
        {/* Hero Section */}
        <section className="max-w-[1280px] mx-auto px-6 pt-16 pb-24 lg:pt-24 lg:pb-32">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
            {/* Hero Left Copy */}
            <div className="lg:col-span-6 space-y-7 animate-fade-up">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-[#17213A] border border-indigo-200/80 dark:border-[#6D5DFB]/30 text-xs font-medium text-indigo-700 dark:text-[#A78BFA]">
                <Compass className="w-3.5 h-3.5" />
                <span>AI-Powered Personalized Learning</span>
              </div>

              <h1 className="font-display text-[32px] sm:text-[48px] lg:text-[56px] font-bold tracking-tight leading-[1.1] text-slate-900 dark:text-[#F8FAFC]">
                Stop guessing{' '}
                <span className="inline-block">
                  what to{' '}
                  <span className="bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] bg-clip-text text-transparent">
                    learn next.
                  </span>
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-600 dark:text-[#AAB4C8] leading-relaxed max-w-xl">
                SkillPath AI assesses your knowledge and creates a focused learning roadmap with videos, notes, practical tasks, and daily goals.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <button
                  type="button"
                  onClick={() => handleRequestStart()}
                  className="px-6 py-3.5 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] hover:from-[#5B4CF2] hover:to-[#4D8DFF] hover:shadow-[0_0_28px_rgba(109,93,251,0.5)] transition-all inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <span>Build My Learning Path</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onTryDemo}
                  className="px-5 py-3.5 text-sm font-semibold text-slate-800 dark:text-[#F8FAFC] bg-white dark:bg-[#11182B] border border-slate-200 dark:border-white/10 hover:border-[#6D5DFB]/50 rounded-xl transition-all inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
                >
                  <Play className="w-4 h-4 text-[#4D8DFF]" />
                  <span>Demo Mode (No Sign-In)</span>
                </button>
              </div>

              <p className="text-xs text-slate-500 dark:text-[#73809B]">
                Personalized in under 3 minutes · Free diagnostic calibration
              </p>
            </div>

            {/* Hero Right: Rich Dashboard Preview Artwork */}
            <div className="lg:col-span-6 relative">
              {/* Soft Ambient Glow Behind Preview */}
              <div
                aria-hidden="true"
                className="absolute -inset-6 rounded-full bg-gradient-to-tr from-[#6D5DFB]/25 via-[#4D8DFF]/15 to-transparent blur-3xl pointer-events-none"
              />

              {/* Subtle Floating Glass Callout: Top Left */}
              <div className="hidden sm:flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/90 dark:bg-[#17213A]/90 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-lg absolute -top-5 -left-4 z-20 text-xs font-medium text-slate-700 dark:text-[#F8FAFC]">
                <span className="w-2 h-2 rounded-full bg-[#FBBF24]" />
                <span>5 knowledge gaps found</span>
              </div>

              {/* Subtle Floating Glass Callout: Bottom Right */}
              <div className="hidden sm:flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white/90 dark:bg-[#17213A]/90 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-lg absolute -bottom-4 right-4 z-20 text-xs font-medium text-slate-700 dark:text-[#F8FAFC]">
                <span className="w-2 h-2 rounded-full bg-[#34D399]" />
                <span>7-day learning plan ready</span>
              </div>

              {/* Main Preview Card */}
              <div className="relative bg-white dark:bg-[#11182B] border border-slate-200 dark:border-[#273554] rounded-2xl p-6 shadow-2xl space-y-5">
                <div className="flex items-center justify-between gap-4 border-b border-slate-100 dark:border-[#273554]/80 pb-4">
                  <div>
                    <p className="text-xs font-medium text-[#6D5DFB] dark:text-[#A78BFA] mb-1">
                      Python · Beginner
                    </p>
                    <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-[#F8FAFC]">
                      Your Adaptive Roadmap
                    </h2>
                  </div>

                  {/* 32% Progress Ring */}
                  <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12">
                      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                        <circle
                          cx="24"
                          cy="24"
                          r="20"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="4"
                          className="text-slate-100 dark:text-[#17213A]"
                        />
                        <circle
                          cx="24"
                          cy="24"
                          r="20"
                          fill="none"
                          stroke="url(#heroRingGrad)"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray={125.6}
                          strokeDashoffset={125.6 * (1 - 0.32)}
                        />
                        <defs>
                          <linearGradient id="heroRingGrad" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#6D5DFB" />
                            <stop offset="100%" stopColor="#4D8DFF" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <span className="absolute inset-0 flex items-center justify-center font-mono text-[11px] font-semibold text-slate-900 dark:text-white tabular-nums">
                        32%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Mini Skill Graph Preview */}
                <div className="bg-slate-50 dark:bg-[#0B1020]/70 border border-slate-200/80 dark:border-[#273554]/80 rounded-xl p-4">
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#73809B] mb-3">
                    <span>Skill Dependency Graph</span>
                    <span>Next up: Functions</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 items-center">
                    <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-[#34D399]/10 border border-emerald-200 dark:border-[#34D399]/30">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-[#34D399]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Completed</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white mt-1 truncate">
                        Control Flow
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-[#6D5DFB]/15 border border-indigo-300 dark:border-[#6D5DFB]/60 shadow-[0_0_16px_rgba(109,93,251,0.2)]">
                      <p className="text-[11px] font-semibold text-[#6D5DFB] dark:text-[#A78BFA]">
                        Current Focus
                      </p>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white mt-1 truncate">
                        Functions
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white dark:bg-[#17213A] border border-slate-200 dark:border-white/10">
                      <p className="text-[11px] font-medium text-slate-500 dark:text-[#73809B]">
                        Up Next
                      </p>
                      <p className="text-xs font-semibold text-slate-700 dark:text-[#AAB4C8] mt-1 truncate">
                        Pandas Data
                      </p>
                    </div>
                  </div>
                </div>

                {/* Current Lesson & Video Preview Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#17213A] border border-slate-200/80 dark:border-[#273554]/80 space-y-2">
                    <p className="text-[11px] font-medium text-slate-500 dark:text-[#73809B]">
                      Current Lesson · 45 min
                    </p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      Functions and Return Scope
                    </p>
                    <div className="w-full h-1.5 bg-slate-200 dark:bg-[#0B1020] rounded-full overflow-hidden">
                      <div className="h-full w-2/3 bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] hover:from-[#5B4CF2] hover:to-[#4D8DFF] rounded-full" />
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-[#17213A] border border-slate-200/80 dark:border-[#273554]/80 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#6D5DFB]/15 text-[#6D5DFB] dark:text-[#A78BFA] flex items-center justify-center shrink-0">
                      <Play className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-slate-500 dark:text-[#73809B]">
                        Curated Video · 21m
                      </p>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        Python Functions Explained
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {user && savedPaths.length > 0 && (
            <div className="mt-12 bg-white dark:bg-[#11182B] border border-slate-200 dark:border-[#273554] rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-[#6D5DFB] dark:text-[#A78BFA]">
                    Welcome back, {firstName}
                  </p>
                  <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-[#F8FAFC]">
                    Continue your saved learning roadmaps
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => onStartSetup()}
                  className="text-xs font-semibold text-[#4D8DFF] hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Start a new track</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {savedPaths.slice(0, 3).map((path) => {
                  const totalNodes = path.skillTree.nodes.length;
                  const masteredNodes = path.skillTree.nodes.filter((n) => n.status === 'mastered').length;
                  const pct = totalNodes > 0 ? Math.round((masteredNodes / totalNodes) * 100) : 0;
                  return (
                    <button
                      key={path.id}
                      type="button"
                      onClick={() => onOpenSavedPath(path)}
                      className="text-left p-4 rounded-xl bg-slate-50 dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] hover:border-[#6D5DFB]/60 transition-all space-y-2.5 cursor-pointer group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-display text-sm font-semibold text-slate-900 dark:text-white group-hover:text-[#6D5DFB] dark:group-hover:text-[#A78BFA] truncate">
                          {path.skillTree.topic}
                        </span>
                        <span className="font-mono text-xs font-semibold text-[#34D399] tabular-nums">
                          {pct}%
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-[#AAB4C8] line-clamp-1">
                        {path.profile.goal}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-[#73809B]">
                        <span>{path.profile.estimatedLevel}</span>
                        <span className="inline-flex items-center gap-1 text-[#4D8DFF] font-medium">
                          <span>Resume</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="max-w-[1280px] mx-auto px-6 py-20 border-t border-slate-200/80 dark:border-[#273554]/80">
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-semibold text-[#6D5DFB] dark:text-[#A78BFA] mb-2">
              How It Works
            </p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-[#F8FAFC]">
              From uncertainty to a daily plan in three steps
            </h2>
          </div>

          <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Connecting Flow Line (Desktop) */}
            <div
              aria-hidden="true"
              className="hidden md:block absolute top-11 left-[16%] right-[16%] h-px bg-gradient-to-r from-[#6D5DFB]/40 via-[#4D8DFF]/40 to-[#34D399]/40"
            />

            {[
              {
                step: '01',
                title: 'Choose a skill',
                copy: 'Pick a domain like Python, UI/UX Design, or any custom topic, then set your learning goal and weekly pace.',
              },
              {
                step: '02',
                title: 'Take a short knowledge check',
                copy: 'Answer 5 calm, adaptive diagnostic questions so the AI separates what you already know from real gaps.',
              },
              {
                step: '03',
                title: 'Follow your personalized path',
                copy: 'Work through an interactive skill tree with matched YouTube videos, AI study notes, and a 7-day momentum plan.',
              },
            ].map((item) => (
              <div
                key={item.step}
                className="relative bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] rounded-2xl p-7 hover:-translate-y-0.5 transition-transform"
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#6D5DFB] to-[#4D8DFF] text-white font-mono text-sm font-semibold flex items-center justify-center mb-5 shadow-md shadow-[#6D5DFB]/20">
                  {item.step}
                </div>
                <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-[#F8FAFC] mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-[#AAB4C8] leading-relaxed">
                  {item.copy}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Explore Skills Section */}
        <section id="explore-skills" className="max-w-[1280px] mx-auto px-6 py-20 border-t border-slate-200/80 dark:border-[#273554]/80">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <p className="text-xs font-semibold text-[#6D5DFB] dark:text-[#A78BFA] mb-2">
                Explore Skills
              </p>
              <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-[#F8FAFC]">
                Start with a popular track or define your own
              </h2>
            </div>
            <button
              type="button"
              onClick={() => handleRequestStart()}
              className="text-sm font-semibold text-[#6D5DFB] dark:text-[#A78BFA] hover:underline inline-flex items-center gap-1.5 cursor-pointer"
            >
              <span>Browse all topics</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {EXPLORE_SKILLS.map((skill) => (
              <button
                key={skill.name}
                type="button"
                onClick={() => handleRequestStart(skill.name)}
                className="text-left bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] hover:border-[#6D5DFB]/60 rounded-2xl p-6 transition-all hover:-translate-y-0.5 cursor-pointer group"
              >
                <h3 className="font-display text-base font-semibold text-slate-900 dark:text-[#F8FAFC] group-hover:text-[#6D5DFB] dark:group-hover:text-[#A78BFA] transition-colors mb-2">
                  {skill.name}
                </h3>
                <p className="text-sm text-slate-600 dark:text-[#AAB4C8] leading-relaxed mb-4">
                  {skill.summary}
                </p>
                <span className="text-xs font-semibold text-[#4D8DFF] inline-flex items-center gap-1">
                  <span>Start track</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="max-w-[1280px] mx-auto px-6 py-20 border-t border-slate-200/80 dark:border-[#273554]/80">
          <div className="max-w-2xl mb-12">
            <p className="text-xs font-semibold text-[#6D5DFB] dark:text-[#A78BFA] mb-2">
              Capabilities
            </p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 dark:text-[#F8FAFC]">
              Everything needed for calm, deliberate progress
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] rounded-2xl p-7 space-y-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-[#6D5DFB]/15 text-[#6D5DFB] dark:text-[#A78BFA] flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-[#F8FAFC]">
                    {feat.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-[#AAB4C8] leading-relaxed">
                    {feat.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Final CTA */}
        <section className="max-w-[1280px] mx-auto px-6 py-20">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#17213A] to-[#11182B] border border-[#273554] rounded-2xl p-10 md:p-14 text-center space-y-6">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(109,93,251,0.28),transparent_55%)] pointer-events-none"
            />
            <h2 className="relative font-display text-3xl md:text-4xl font-bold tracking-tight text-white max-w-2xl mx-auto">
              Your next skill starts with one clear step.
            </h2>
            <p className="relative text-sm md:text-base text-[#AAB4C8] max-w-xl mx-auto">
              Complete a 2-minute calibration and walk away with a tailored skill tree, curated lectures, and a 7-day plan.
            </p>
            <div className="relative pt-2 flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => handleRequestStart()}
                className="px-7 py-3.5 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] hover:from-[#5B4CF2] hover:to-[#4D8DFF] hover:shadow-[0_0_30px_rgba(109,93,251,0.5)] transition-all inline-flex items-center gap-2 cursor-pointer"
              >
                <span>Create My Learning Path</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 dark:border-[#273554]/80 py-8">
        <div className="max-w-[1280px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-[#73809B]">
          <SkillPathLogo />
          <p>Adaptive assessment, interactive skill trees, and guided study plans.</p>
        </div>
      </footer>

      {showModeModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="mode-dialog-title"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="max-w-md w-full bg-white dark:bg-[#11182B] border border-slate-200 dark:border-[#273554] rounded-2xl p-6 space-y-5 shadow-2xl animate-fade-up">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="mode-dialog-title"
                  className="font-display text-lg font-bold text-slate-900 dark:text-white"
                >
                  Choose how to continue
                </h2>
                <p className="text-xs text-slate-600 dark:text-[#AAB4C8] mt-1">
                  Sign in with Google to save real roadmaps and progress to your account, or explore Demo Mode without signing in.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModeModal(false)}
                aria-label="Close dialog"
                className="min-w-[44px] min-h-[44px] -mr-2 -mt-2 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#17213A] transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-[#FB7185]/10 border border-rose-200 dark:border-[#FB7185]/35 flex items-start justify-between gap-2.5 text-xs text-rose-800 dark:text-[#FB7185]">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
                <button
                  type="button"
                  onClick={onClearAuthError}
                  className="font-semibold hover:underline shrink-0 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="space-y-3">
              <button
                type="button"
                disabled={authLoading}
                onClick={() => {
                  void (async () => {
                    const ok = await onSignIn();
                    if (ok) {
                      setShowModeModal(false);
                      onStartSetup(pendingTopic);
                    }
                  })();
                }}
                className="w-full py-3 px-4 rounded-xl bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] hover:border-[#6D5DFB]/60 text-slate-900 dark:text-white text-sm font-semibold inline-flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-50"
              >
                {authLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#6D5DFB]" />
                ) : (
                  <GoogleGIcon className="w-4 h-4" />
                )}
                <span>Continue with Google</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowModeModal(false);
                  if (pendingTopic) {
                    onEnterDemoSetup(pendingTopic);
                  } else {
                    onTryDemo();
                  }
                }}
                className="w-full py-3 px-4 rounded-xl bg-slate-100 dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] hover:border-[#6D5DFB]/50 text-slate-800 dark:text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Play className="w-4 h-4 text-[#4D8DFF]" />
                <span>
                  {pendingTopic
                    ? `Try ${pendingTopic} in Demo Mode (No Sign-In)`
                    : 'Open Demo Mode (No Sign-In)'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
