import {
  AppScreen,
  CapstoneProjectItem,
  DashboardTab,
  DiagnosticMessage,
  DiagnosticProfile,
  FinalExamResult,
  LearnerScoreProfile,
  SkillCertificate,
  SkillTreeData,
  VideoResult,
  VideoSynthesis,
  VideoTestResult,
} from '../types/learning';

const DEMO_STORAGE_KEY = 'skillpath_demo_state_v1';

export interface PersistedDemoState {
  version: 1;
  screen: AppScreen;
  dashboardTab: DashboardTab;
  profile: DiagnosticProfile;
  messages: DiagnosticMessage[];
  skillTree: SkillTreeData | null;
  selectedNodeId: string | null;
  videos: VideoResult[];
  selectedVideo: VideoResult | null;
  bookmarkedIds: Record<string, boolean>;
  synthesis: VideoSynthesis | null;
  videoTestResults: VideoTestResult[];
  finalExam: FinalExamResult | null;
  capstoneProjects: CapstoneProjectItem[];
  certificate: SkillCertificate | null;
  scoreProfile: LearnerScoreProfile;
  lastSavedAt: number;
}

export function loadDemoState(): PersistedDemoState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DEMO_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedDemoState>;
    if (
      !parsed ||
      parsed.version !== 1 ||
      !parsed.profile ||
      typeof parsed.lastSavedAt !== 'number'
    ) {
      return null;
    }
    return {
      version: 1,
      screen: parsed.screen || 'dashboard',
      dashboardTab: parsed.dashboardTab || 'overview',
      profile: parsed.profile,
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      skillTree: parsed.skillTree || null,
      selectedNodeId: parsed.selectedNodeId || null,
      videos: Array.isArray(parsed.videos) ? parsed.videos : [],
      selectedVideo: parsed.selectedVideo || null,
      bookmarkedIds:
        parsed.bookmarkedIds && typeof parsed.bookmarkedIds === 'object'
          ? parsed.bookmarkedIds
          : {},
      synthesis: parsed.synthesis || null,
      videoTestResults: Array.isArray(parsed.videoTestResults) ? parsed.videoTestResults : [],
      finalExam: parsed.finalExam || null,
      capstoneProjects: Array.isArray(parsed.capstoneProjects) ? parsed.capstoneProjects : [],
      certificate: parsed.certificate || null,
      scoreProfile: parsed.scoreProfile || {
        totalScore: 0,
        testsCompleted: 0,
        videosCompleted: 0,
        certificatesEarned: 0,
      },
      lastSavedAt: parsed.lastSavedAt,
    };
  } catch {
    return null;
  }
}

export function saveDemoState(
  state: Omit<PersistedDemoState, 'version' | 'lastSavedAt'>
): number | null {
  if (typeof window === 'undefined') return null;
  const now = Date.now();
  try {
    const payload: PersistedDemoState = {
      version: 1,
      ...state,
      lastSavedAt: now,
    };
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(payload));
    return now;
  } catch {
    return null;
  }
}

export function clearDemoState(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(DEMO_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

export function formatDemoSavedTime(ts: number | null): string {
  if (!ts) return 'Just now';
  try {
    return new Date(ts).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Recently';
  }
}
