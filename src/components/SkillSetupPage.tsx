import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Code2,
  Palette,
  BarChart3,
  Megaphone,
  Cpu,
  Mic,
  Terminal,
  Compass,
  Clock,
} from 'lucide-react';
import { DailyStudyMinutes, LearningPace } from '../types/learning';
import { SkillPathLogo } from './SkillPathLogo';

interface SkillSetupPageProps {
  initialTopic: string;
  initialGoal: string;
  initialPace: LearningPace;
  initialMinutes: DailyStudyMinutes;
  onBack: () => void;
  onComplete: (config: {
    topic: string;
    goal: string;
    pace: LearningPace;
    dailyMinutes: DailyStudyMinutes;
  }) => void;
}

const TOPIC_OPTIONS = [
  {
    name: 'Python',
    description: 'Scripting, data pipelines, and backend fundamentals',
    icon: Terminal,
  },
  {
    name: 'JavaScript',
    description: 'Modern ES6+, async workflows, and web apps',
    icon: Code2,
  },
  {
    name: 'UI/UX Design',
    description: 'Design systems, user flows, and visual craft',
    icon: Palette,
  },
  {
    name: 'Data Analysis',
    description: 'SQL, Pandas, exploratory stats, and dashboards',
    icon: BarChart3,
  },
  {
    name: 'Digital Marketing',
    description: 'Acquisition funnels, SEO, and growth analytics',
    icon: Megaphone,
  },
  {
    name: 'Machine Learning',
    description: 'Supervised learning, neural nets, and evaluation',
    icon: Cpu,
  },
  {
    name: 'Public Speaking',
    description: 'Storytelling structure, clarity, and delivery',
    icon: Mic,
  },
  {
    name: 'Custom Topic',
    description: 'Define any technical, creative, or academic skill',
    icon: Compass,
  },
];

const GOAL_OPTIONS = [
  'Learn the basics',
  'Build a portfolio project',
  'Prepare for a job',
  'Prepare for an exam',
  'Improve an existing skill',
];

const PACE_OPTIONS: Array<{ id: LearningPace; title: string; subtitle: string }> = [
  { id: 'casual', title: 'Casual', subtitle: '3 days/week · Steady pace' },
  { id: 'consistent', title: 'Consistent', subtitle: '5 days/week · Balanced growth' },
  { id: 'intensive', title: 'Intensive', subtitle: 'Every day · Accelerated track' },
];

const TIME_OPTIONS: Array<{ value: DailyStudyMinutes; label: string }> = [
  { value: 30, label: '30 min/day' },
  { value: 45, label: '45 min/day' },
  { value: 60, label: '1 hour/day' },
  { value: 120, label: '2 hours/day' },
];

export const SkillSetupPage: React.FC<SkillSetupPageProps> = ({
  initialTopic,
  initialGoal,
  initialPace,
  initialMinutes,
  onBack,
  onComplete,
}) => {
  const [topic, setTopic] = useState(initialTopic || 'Python');
  const [selectedPreset, setSelectedPreset] = useState(
    TOPIC_OPTIONS.some((t) => t.name === initialTopic) ? initialTopic : initialTopic ? 'Custom Topic' : 'Python'
  );
  const [goal, setGoal] = useState(initialGoal || 'Build a portfolio project');
  const [customGoal, setCustomGoal] = useState('');
  const [pace, setPace] = useState<LearningPace>(initialPace || 'consistent');
  const [dailyMinutes, setDailyMinutes] = useState<DailyStudyMinutes>(initialMinutes || 45);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSelectTopicCard = (name: string) => {
    setSelectedPreset(name);
    setValidationError(null);
    if (name === 'Custom Topic') {
      setTopic('');
    } else {
      setTopic(name);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTopic = topic.trim();
    if (!finalTopic) {
      setValidationError('Please enter or select a skill you would like to learn.');
      return;
    }
    const finalGoal = customGoal.trim() || goal;
    onComplete({
      topic: finalTopic,
      goal: finalGoal,
      pace,
      dailyMinutes,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0B1020] text-slate-900 dark:text-[#F8FAFC] flex flex-col">
      {/* Minimal Header */}
      <header className="border-b border-slate-200 dark:border-[#273554] bg-white/80 dark:bg-[#0B1020]/80 backdrop-blur-md">
        <div className="max-w-[960px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <SkillPathLogo />
          <span className="text-xs font-medium text-slate-500 dark:text-[#AAB4C8]">
            Step 1 of 2 · Choose your learning goal
          </span>
        </div>
        <div className="h-0.5 bg-slate-200 dark:bg-[#17213A]">
          <div className="h-full w-1/2 bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF]" />
        </div>
      </header>

      <main className="flex-1 max-w-[960px] w-full mx-auto px-6 py-10 md:py-14">
        <form onSubmit={handleSubmit} className="space-y-12 animate-fade-up">
          {/* Section 1: Skill Selection */}
          <div className="space-y-5">
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-[#F8FAFC] mb-2">
                What would you like to learn?
              </h1>
              <p className="text-sm md:text-base text-slate-600 dark:text-[#AAB4C8]">
                Select a track below or type any specialized skill to begin your calibration.
              </p>
            </div>

            <div>
              <label htmlFor="skill-input" className="block text-xs font-semibold text-slate-700 dark:text-[#AAB4C8] mb-2">
                Target skill or subject
              </label>
              <input
                id="skill-input"
                type="text"
                value={topic}
                onChange={(e) => {
                  setTopic(e.target.value);
                  setValidationError(null);
                }}
                placeholder="Try Python, UI/UX Design, Data Analysis…"
                className="w-full px-4 py-3.5 text-base bg-white dark:bg-[#11182B] border border-slate-200 dark:border-[#273554] rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#73809B] focus:outline-none focus:ring-2 focus:ring-[#6D5DFB]/60 focus:border-[#6D5DFB]"
              />
              {validationError && (
                <p className="mt-2 text-xs font-medium text-rose-600 dark:text-[#FB7185]">
                  {validationError}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {TOPIC_OPTIONS.map((item) => {
                const Icon = item.icon;
                const isSelected =
                  selectedPreset === item.name ||
                  (item.name !== 'Custom Topic' && topic.toLowerCase() === item.name.toLowerCase());
                return (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => handleSelectTopicCard(item.name)}
                    className={`text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/70 dark:bg-[#17213A] border-[#6D5DFB] shadow-[0_0_20px_rgba(109,93,251,0.22)]'
                        : 'bg-white dark:bg-[#11182B] border-slate-200 dark:border-[#273554] hover:border-slate-300 dark:hover:border-white/20'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 ${
                        isSelected
                          ? 'bg-gradient-to-br from-[#6D5DFB] to-[#4D8DFF] text-white'
                          : 'bg-slate-100 dark:bg-[#17213A] text-slate-600 dark:text-[#AAB4C8]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                      {item.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-[#73809B] leading-snug">
                      {item.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Learning Goal */}
          <div className="space-y-4 pt-6 border-t border-slate-200 dark:border-[#273554]">
            <div>
              <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-[#F8FAFC]">
                What is your goal?
              </h2>
              <p className="text-sm text-slate-600 dark:text-[#AAB4C8]">
                This shapes the depth of your skill tree and practice tasks.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {GOAL_OPTIONS.map((opt) => {
                const active = goal === opt && !customGoal.trim();
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => {
                      setGoal(opt);
                      setCustomGoal('');
                    }}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium border transition-all cursor-pointer ${
                      active
                        ? 'bg-indigo-50 dark:bg-[#6D5DFB]/20 border-[#6D5DFB] text-indigo-700 dark:text-white'
                        : 'bg-white dark:bg-[#11182B] border-slate-200 dark:border-[#273554] text-slate-700 dark:text-[#AAB4C8] hover:border-slate-300 dark:hover:border-white/20'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>

            <div>
              <label htmlFor="custom-goal-input" className="block text-xs font-medium text-slate-500 dark:text-[#73809B] mb-1.5">
                Or describe a custom goal (optional)
              </label>
              <input
                id="custom-goal-input"
                type="text"
                value={customGoal}
                onChange={(e) => setCustomGoal(e.target.value)}
                placeholder="e.g., Automate weekly CSV reports at work"
                className="w-full px-4 py-2.5 text-sm bg-white dark:bg-[#11182B] border border-slate-200 dark:border-[#273554] rounded-xl text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-[#73809B] focus:outline-none focus:ring-2 focus:ring-[#6D5DFB]/50 focus:border-[#6D5DFB]"
              />
            </div>
          </div>

          {/* Section 3: Pace & Daily Study Time */}
          <div className="space-y-5 pt-6 border-t border-slate-200 dark:border-[#273554]">
            <div>
              <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-[#F8FAFC]">
                How do you want to learn?
              </h2>
              <p className="text-sm text-slate-600 dark:text-[#AAB4C8]">
                Used to generate your realistic 7-Day Momentum Plan.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {PACE_OPTIONS.map((p) => {
                const selected = pace === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPace(p.id)}
                    className={`text-left p-5 rounded-2xl border transition-all cursor-pointer ${
                      selected
                        ? 'bg-indigo-50/70 dark:bg-[#17213A] border-[#6D5DFB] shadow-[0_0_18px_rgba(109,93,251,0.2)]'
                        : 'bg-white dark:bg-[#11182B] border-slate-200 dark:border-[#273554] hover:border-slate-300 dark:hover:border-white/20'
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                      {p.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-[#AAB4C8]">{p.subtitle}</p>
                  </button>
                );
              })}
            </div>

            <div>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-[#AAB4C8] mb-2.5">
                <Clock className="w-3.5 h-3.5" />
                Daily focus budget
              </span>
              <div className="flex flex-wrap gap-2.5">
                {TIME_OPTIONS.map((opt) => {
                  const selected = dailyMinutes === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDailyMinutes(opt.value)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all tabular-nums cursor-pointer ${
                        selected
                          ? 'bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] hover:from-[#5B4CF2] hover:to-[#4D8DFF] border-transparent text-white'
                          : 'bg-white dark:bg-[#11182B] border-slate-200 dark:border-[#273554] text-slate-700 dark:text-[#AAB4C8] hover:border-slate-300 dark:hover:border-white/20'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Navigation Bar */}
          <div className="pt-6 border-t border-slate-200 dark:border-[#273554] flex flex-col sm:flex-row items-center justify-between gap-4">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-[#AAB4C8] hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <span className="text-xs text-slate-500 dark:text-[#73809B]">
                Takes about 2 minutes.
              </span>
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-3.5 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-[#6D5DFB] to-[#4D8DFF] hover:from-[#5B4CF2] hover:to-[#4D8DFF] hover:shadow-[0_0_28px_rgba(109,93,251,0.45)] transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Start Knowledge Check</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
};
