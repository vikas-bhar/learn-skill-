import React from 'react';
import { ArrowLeft, Compass, Play, Sun, Moon } from 'lucide-react';
import { SkillPathLogo } from './SkillPathLogo';

interface NotFoundPageProps {
  isDark: boolean;
  badPath: string;
  onToggleTheme: () => void;
  onGoHome: () => void;
  onTryDemo: () => void;
}

export const NotFoundPage: React.FC<NotFoundPageProps> = ({
  isDark,
  badPath,
  onToggleTheme,
  onGoHome,
  onTryDemo,
}) => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1020] text-slate-900 dark:text-[#F8FAFC] flex flex-col relative overflow-x-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 opacity-40 dark:opacity-25"
        style={{
          backgroundImage:
            'radial-gradient(rgba(109, 93, 251, 0.14) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      <header className="relative z-10 border-b border-slate-200/80 dark:border-[#273554] bg-white/80 dark:bg-[#0B1020]/80 backdrop-blur-md">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onGoHome}
            className="text-left cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#6D5DFB] rounded-lg"
          >
            <SkillPathLogo />
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="min-w-[40px] min-h-[40px] p-2 rounded-lg text-slate-600 dark:text-[#AAB4C8] hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#17213A] transition-colors flex items-center justify-center cursor-pointer"
          >
            {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-5 py-16">
        <div className="max-w-lg w-full bg-white dark:bg-[#11182B] border border-slate-200 dark:border-[#273554] rounded-2xl p-8 sm:p-10 text-center space-y-6 shadow-2xl animate-fade-up">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-[#6D5DFB]/20 to-[#4D8DFF]/20 border border-[#6D5DFB]/40 flex items-center justify-center text-[#6D5DFB] dark:text-[#A78BFA]">
            <Compass className="w-7 h-7" />
          </div>

          <div className="space-y-2.5">
            <p className="font-mono text-xs font-semibold tracking-wider text-[#6D5DFB] dark:text-[#A78BFA] tabular-nums">
              404 · Page Not Found
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              This learning path does not exist
            </h1>
            <p className="text-sm text-slate-600 dark:text-[#AAB4C8] leading-relaxed">
              We could not find a page at{' '}
              <span className="font-mono text-slate-800 dark:text-white break-all">
                {badPath || '/'}
              </span>
              . Head back home to start a personalized roadmap or open Demo Mode.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onGoHome}
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] hover:from-[#5B4CF2] hover:to-[#4D8DFF] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to SkillPath AI</span>
            </button>
            <button
              type="button"
              onClick={onTryDemo}
              className="w-full sm:w-auto px-5 py-3 rounded-xl bg-slate-100 dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] hover:border-[#6D5DFB]/60 text-slate-800 dark:text-white text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <Play className="w-4 h-4 text-[#4D8DFF]" />
              <span>Explore Demo Mode</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
