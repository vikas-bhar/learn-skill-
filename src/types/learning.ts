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

export interface VideoTestResult {
  videoId: string;
  videoTitle: string;
  nodeId: string;
  score: number;
  pointsAwarded: number;
  passed: boolean;
  feedback: string;
  completedAtIso: string;
}

export interface FinalExamResult {
  score: number;
  passed: boolean;
  pointsAwarded: number;
  feedback: string;
  strengthSummary: string;
  completedAtIso: string;
}

export interface CapstoneProjectItem {
  id: string;
  title: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  estimatedHours: string;
  brief: string;
  deliverables: string[];
  acceptanceCriteria: string[];
  status: 'pending' | 'passed' | 'needs_revision';
  submissionText?: string;
  submissionUrl?: string;
  score?: number;
  pointsAwarded?: number;
  feedback?: string;
  strengths?: string[];
  improvements?: string[];
  completedAtIso?: string;
}

export interface CapstoneProjectsPayload {
  topic: string;
  projects: CapstoneProjectItem[];
}

export interface ProjectEvaluationResponse {
  projectId: string;
  score: number;
  passed: boolean;
  pointsAwarded: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  completedAtIso: string;
}

export interface SkillCertificate {
  certificateId: string;
  learnerName: string;
  topic: string;
  finalScore: number;
  totalScore: number;
  projectsCompleted?: number;
  level: LearnerLevel;
  strengthSummary: string;
  issuedAtIso: string;
}

export interface LearnerScoreProfile {
  totalScore: number;
  testsCompleted: number;
  videosCompleted: number;
  certificatesEarned: number;
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

export interface VideoQuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  conceptTag: string;
}

export interface VideoQuizPayload {
  videoId: string;
  questions: VideoQuizQuestion[];
}

export interface QuizQuestionFeedback {
  questionId: string;
  correct: boolean;
  feedback: string;
}

export interface VideoQuizEvaluation {
  score: number;
  passed: boolean;
  pointsAwarded: number;
  feedback: string;
  questionResults: QuizQuestionFeedback[];
}

export interface FinalExamQuestion {
  id: string;
  prompt: string;
  options: string[];
  moduleTitle: string;
  hint: string;
}

export interface FinalExamPayload {
  topic: string;
  questions: FinalExamQuestion[];
}

export interface FinalExamEvaluation extends FinalExamResult {
  questionResults: QuizQuestionFeedback[];
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
export type DashboardTab = 'overview' | 'roadmap' | 'notes' | 'videos' | 'plan' | 'certificate';
