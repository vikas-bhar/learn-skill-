import React from 'react';
import { CheckCircle2, Circle, ArrowRight, Clock } from 'lucide-react';
import { StudyPlanDay } from '../types/learning';

interface StudyPlanViewProps {
  plan: StudyPlanDay[];
  onToggleDay: (dayNumber: number) => void;
  onStartDaySession: (moduleId: string) => void;
}

export const StudyPlanView: React.FC<StudyPlanViewProps> = ({
  plan,
  onToggleDay,
  onStartDaySession,
}) => {
  const completedCount = plan.filter((d) => d.completed).length;
  const totalCount = plan.length || 7;
  const progressPct = Math.round((completedCount / totalCount) * 100);
  const firstIncompleteDay = plan.find((d) => !d.completed)?.day ?? null;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="bg-white dark:bg-[#17213A] border border-slate-200 dark:border-[#273554] rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              Your 7-Day Momentum Plan
            </h2>
            <p className="text-sm text-slate-600 dark:text-[#AAB4C8]">
              Focused daily sessions sequenced directly from your Skill Tree.
            </p>
          </div>
          <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white tabular-nums">
            {completedCount} of {totalCount} sessions completed
          </span>
        </div>

        <div className="w-full h-2 bg-slate-100 dark:bg-[#0B1020] rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#6D5DFB] via-[#4D8DFF] to-[#34D399] transition-all duration-500 rounded-full"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plan.map((item) => {
          const isToday = item.day === firstIncompleteDay;
          return (
            <div
              key={item.day}
              className={`rounded-2xl p-5 border transition-all flex flex-col justify-between space-y-4 ${
                item.completed
                  ? 'bg-emerald-50/50 dark:bg-[#34D399]/[0.06] border-emerald-200 dark:border-[#34D399]/30 opacity-85'
                  : isToday
                  ? 'bg-white dark:bg-[#17213A] border-[#6D5DFB] shadow-[0_0_24px_rgba(109,93,251,0.2)]'
                  : 'bg-white dark:bg-[#17213A] border-slate-200 dark:border-[#273554]'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-mono font-semibold text-slate-500 dark:text-[#AAB4C8]">
                      Day {item.day}
                    </span>
                    {isToday && (
                      <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] text-white text-[11px] font-semibold">
                        Today
                      </span>
                    )}
                    {item.completed && (
                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-[#34D399]">
                        Done
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onToggleDay(item.day)}
                    aria-label={item.completed ? 'Mark session incomplete' : 'Mark session complete'}
                    className="text-slate-400 hover:text-[#34D399] transition-colors cursor-pointer"
                  >
                    {item.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-[#34D399]" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>
                </div>

                <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white leading-snug">
                  {item.taskTitle}
                </h3>

                <p className="text-xs text-slate-600 dark:text-[#AAB4C8] leading-relaxed">
                  {item.motivation}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-[#273554]/80 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-mono text-slate-500 dark:text-[#73809B] tabular-nums">
                  <Clock className="w-3.5 h-3.5" />
                  {item.estimatedMinutes} min
                </span>

                <button
                  type="button"
                  onClick={() => onStartDaySession(item.moduleId)}
                  className={`text-xs font-semibold inline-flex items-center gap-1 cursor-pointer ${
                    isToday
                      ? 'px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] hover:from-[#5B4CF2] hover:to-[#4D8DFF] text-white'
                      : 'text-[#4D8DFF] hover:underline'
                  }`}
                >
                  <span>{isToday ? 'Start Today’s Focus' : 'Open Module'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
