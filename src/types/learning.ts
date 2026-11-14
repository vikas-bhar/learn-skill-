export type DiagnosticVerdict = 'initial' | 'strong' | 'partial' | 'gap';

export interface DiagnosticAssessment {
  conceptChecked: string;
  verdict: DiagnosticVerdict;
  note: string;
}

export interface DiagnosticMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  suggestedReplies?: string[];
  assessment?: DiagnosticAssessment;
}

export type LearnerLevel = 'Unassessed' | 'Beginner' | 'Intermediate' | 'Advanced';
export type LearningPace = 'casual' | 'consistent' | 'intensive';
export type DailyStudyMinutes = 30 | 45 | 60 | 120;

export interface DiagnosticProfile {
  topic: string;
  goal: string;
  pace: LearningPace;
  dailyMinutes: DailyStudyMinutes;
  estimatedLevel: LearnerLevel;
  confidenceScore: number;
  strengths: string[];
  knowledgeGaps: string[];
  readyForSkillTree: boolean;
  turnCount: number;
}

export type SkillNodeStatus = 'mastered' | 'ready' | 'needs_review' | 'locked';

export interface SkillNode {
  id: string;
  title: string;
  summary: string;
  tier: number;
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced';
  status: SkillNodeStatus;
  estimatedMinutes: number;
  prerequisites: string[];
  learningObjectives: string[];
  whyItMatters?: string;
  keyConcepts?: string[];
  commonMistakes?: string[];
  practiceTask?: string;
  diagnosticRationale: string;
  youtubeSearchQuery: string;
}

export interface SkillEdge {
  source: string;
  target: string;
}

export interface StudyPlanDay {
  day: number;
  dateLabel: string;
  moduleId: string;
  taskTitle: string;
  estimatedMinutes: number;
  motivation: string;
  completed: boolean;
}

export interface SkillTreeData {
  topic: string;
  generatedAt: string;
  nodes: SkillNode[];
  edges: SkillEdge[];
  recommendedNextId: string | null;
  studyPlan?: StudyPlanDay[];
}

export interface MasteryQuestion {
  nodeId: string;
  question: string;
  options: string[];
  hint: string;
}

export interface MasteryEvaluation {
  passed: boolean;
  feedback: string;
}

export interface VideoResult {
  videoId: string;
  title: string;
  channelTitle: string;
  publishedAt: string;
  duration?: string;
  description: string;
  thumbnailUrl: string;
  url: string;
  source: 'youtube_api' | 'gemini_search' | 'direct_url';
}

export interface VideoNoteSection {
  heading: string;
  timestampHint: string;
  bullets: string[];
}

export interface VideoSynthesis {
  videoId: string;
  videoTitle: string;
  executiveSummary: string;
  keyTakeaways: string[];
  structuredNotes: VideoNoteSection[];
  mermaidFlowchart: string;
  studyChecklist: string[];
  commonMistakes?: string[];
  practiceTask?: string;
}

export type AppScreen = 'landing' | 'setup' | 'diagnostic' | 'dashboard';
export type DashboardTab = 'overview' | 'roadmap' | 'notes' | 'videos' | 'plan';
