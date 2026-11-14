import { useEffect, useState, useCallback, useRef } from 'react';
import { LandingPage } from './components/LandingPage';
import { SkillSetupPage } from './components/SkillSetupPage';
import { DiagnosticAssessmentPage } from './components/DiagnosticAssessmentPage';
import { DashboardPage } from './components/DashboardPage';
import { NotFoundPage } from './components/NotFoundPage';
import { useFirebase } from './context/FirebaseContext';
import { useToast } from './context/ToastContext';
import { formatFirebaseUserError } from './lib/firebase';
import { clearDemoState, loadDemoState, saveDemoState } from './lib/demoStorage';
import { safeApiPost, toUserFriendlyError } from './lib/errors';
import {
  deleteLearningPathDoc,
  addProfileScore,
  saveCapstoneProjectsAndCertificate,
  SavedLearningPath,
  saveFinalExamAndCertificate,
  saveNewLearningPath,
  updateLearningPathBookmarks,
  updateLearningPathNotes,
  updateLearningPathProgress,
  updateLearningPathStudyPlan,
  updateLearningPathVideoTests,
} from './lib/learningStore';
import {
  DEMO_MESSAGES,
  DEMO_PROFILE,
  DEMO_SKILL_TREE,
  DEMO_SYNTHESIS,
  DEMO_VIDEOS,
} from './data/demoJourney';
import {
  AppScreen,
  CapstoneProjectItem,
  DailyStudyMinutes,
  DashboardTab,
  DiagnosticMessage,
  DiagnosticProfile,
  FinalExamEvaluation,
  FinalExamResult,
  LearnerScoreProfile,
  LearningPace,
  ProjectEvaluationResponse,
  SkillCertificate,
  SkillNode,
  SkillTreeData,
  VideoQuizEvaluation,
  VideoResult,
  VideoSynthesis,
  VideoTestResult,
} from './types/learning';

const INITIAL_PROFILE: DiagnosticProfile = {
  topic: '',
  goal: '',
  pace: 'consistent',
  dailyMinutes: 45,
  estimatedLevel: 'Unassessed',
  confidenceScore: 0,
  strengths: [],
  knowledgeGaps: [],
  readyForSkillTree: false,
  turnCount: 0,
};

function nowLabel(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function isKnownAppPath(pathname: string): boolean {
  const normalized = pathname === '/' ? '/' : pathname.replace(/\/+$/, '');
  return normalized === '/' || normalized === '/index.html';
}

export default function App() {
  const {
    user,
    authReady,
    authLoading,
    authError,
    savedPaths,
    scoreProfile: cloudScoreProfile,
    activePathId,
    setActivePathId,
    signInWithGoogle,
    signOutUser,
    clearAuthError,
  } = useFirebase();

  const { showToast } = useToast();
  const initialDemoRef = useRef(loadDemoState());
  const restoredDemo = initialDemoRef.current;

  const [currentPath, setCurrentPath] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  const [screen, setScreen] = useState<AppScreen>(() =>
    restoredDemo ? restoredDemo.screen : 'landing'
  );
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>(() =>
    restoredDemo ? restoredDemo.dashboardTab : 'overview'
  );
  const [isDark, setIsDark] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(() => Boolean(restoredDemo));
  const [demoLastSavedAt, setDemoLastSavedAt] = useState<number | null>(() =>
    restoredDemo ? restoredDemo.lastSavedAt : null
  );
  const [isSavingPath, setIsSavingPath] = useState(false);

  const [localScoreProfile, setLocalScoreProfile] = useState<LearnerScoreProfile>(() =>
    restoredDemo
      ? restoredDemo.scoreProfile
      : {
          totalScore: 0,
          testsCompleted: 0,
          videosCompleted: 0,
          certificatesEarned: 0,
        }
  );

  const [profile, setProfile] = useState<DiagnosticProfile>(() =>
    restoredDemo ? restoredDemo.profile : INITIAL_PROFILE
  );
  const [messages, setMessages] = useState<DiagnosticMessage[]>(() =>
    restoredDemo ? restoredDemo.messages : []
  );
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagError, setDiagError] = useState<string | null>(null);
  const diagRetryRef = useRef<(() => void) | null>(null);

  const [skillTree, setSkillTree] = useState<SkillTreeData | null>(() =>
    restoredDemo ? restoredDemo.skillTree : null
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(() =>
    restoredDemo ? restoredDemo.selectedNodeId : null
  );
  const [treeLoading, setTreeLoading] = useState(false);

  const [videos, setVideos] = useState<VideoResult[]>(() =>
    restoredDemo ? restoredDemo.videos : []
  );
  const [selectedVideo, setSelectedVideo] = useState<VideoResult | null>(() =>
    restoredDemo ? restoredDemo.selectedVideo : null
  );
  const [bookmarkedIds, setBookmarkedIds] = useState<Record<string, boolean>>(() =>
    restoredDemo ? restoredDemo.bookmarkedIds : {}
  );
  const [synthesis, setSynthesis] = useState<VideoSynthesis | null>(() =>
    restoredDemo ? restoredDemo.synthesis : null
  );
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [videoTestResults, setVideoTestResults] = useState<VideoTestResult[]>(() =>
    restoredDemo ? restoredDemo.videoTestResults : []
  );
  const [finalExam, setFinalExam] = useState<FinalExamResult | null>(() =>
    restoredDemo ? restoredDemo.finalExam : null
  );
  const [capstoneProjects, setCapstoneProjects] = useState<CapstoneProjectItem[]>(() =>
    restoredDemo ? restoredDemo.capstoneProjects : []
  );
  const [certificate, setCertificate] = useState<SkillCertificate | null>(() =>
    restoredDemo ? restoredDemo.certificate : null
  );

  const activeScoreProfile = user ? cloudScoreProfile : localScoreProfile;

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    if (user) {
      setIsDemoMode(false);
    }
  }, [user]);

  useEffect(() => {
    if (!isDemoMode || user) return;
    if (screen === 'landing') return;
    if (screen === 'setup' && !profile.topic.trim() && !skillTree) return;

    const savedAt = saveDemoState({
      screen,
      dashboardTab,
      profile,
      messages,
      skillTree,
      selectedNodeId,
      videos,
      selectedVideo,
      bookmarkedIds,
      synthesis,
      videoTestResults,
      finalExam,
      capstoneProjects,
      certificate,
      scoreProfile: localScoreProfile,
    });
    if (savedAt) {
      setDemoLastSavedAt(savedAt);
    }
  }, [
    isDemoMode,
    user,
    screen,
    dashboardTab,
    profile,
    messages,
    skillTree,
    selectedNodeId,
    videos,
    selectedVideo,
    bookmarkedIds,
    synthesis,
    videoTestResults,
    finalExam,
    capstoneProjects,
    certificate,
    localScoreProfile,
  ]);

  const handleToggleTheme = () => setIsDark((prev) => !prev);

  const handleOpenSavedPath = useCallback(
    (saved: SavedLearningPath) => {
      setProfile(saved.profile);
      setMessages([]);
      setSkillTree(saved.skillTree);
      setSelectedNodeId(
        saved.selectedNodeId ||
          saved.skillTree.recommendedNextId ||
          saved.skillTree.nodes[0]?.id ||
          null
      );
      const bookmarkMap: Record<string, boolean> = {};
      for (const id of saved.bookmarkedVideoIds) {
        bookmarkMap[id] = true;
      }
      setBookmarkedIds(bookmarkMap);
      setVideos([]);
      setSelectedVideo(null);
      setSynthesis(saved.latestSynthesis);
      setVideoTestResults(saved.videoTestResults || []);
      setFinalExam(saved.finalExam || null);
      setCapstoneProjects(saved.capstoneProjects || []);
      setCertificate(saved.certificate || null);
      setActivePathId(saved.id);
      setIsDemoMode(false);
      setDiagError(null);
      setDashboardTab('overview');
      setScreen('dashboard');
    },
    [setActivePathId]
  );

  const handleLaunchDemo = () => {
    setActivePathId(null);
    setIsDemoMode(true);
    setProfile(DEMO_PROFILE);
    setMessages(DEMO_MESSAGES);
    setSkillTree(DEMO_SKILL_TREE);
    setSelectedNodeId('n3');
    setVideos(DEMO_VIDEOS);
    setSelectedVideo(DEMO_VIDEOS[0]);
    setBookmarkedIds({});
    setSynthesis(DEMO_SYNTHESIS);
    setVideoTestResults([]);
    setFinalExam(null);
    setCapstoneProjects([]);
    setCertificate(null);
    setLocalScoreProfile({
      totalScore: 0,
      testsCompleted: 0,
      videosCompleted: 0,
      certificatesEarned: 0,
    });
    setDiagError(null);
    setDashboardTab('overview');
    setScreen('dashboard');
  };

  const handleStartSetup = (presetTopic?: string) => {
    setIsDemoMode(!user);
    setProfile({
      ...INITIAL_PROFILE,
      topic: presetTopic || '',
    });
    setScreen('setup');
  };

  const handleEnterDemoSetup = (presetTopic?: string) => {
    setIsDemoMode(true);
    setProfile({
      ...INITIAL_PROFILE,
      topic: presetTopic || '',
    });
    setScreen('setup');
  };

  const handleExitDemo = () => {
    clearDemoState();
    setDemoLastSavedAt(null);
    setIsDemoMode(false);
    setActivePathId(null);
    setProfile(INITIAL_PROFILE);
    setMessages([]);
    setSkillTree(null);
    setSelectedNodeId(null);
    setVideos([]);
    setSelectedVideo(null);
    setBookmarkedIds({});
    setSynthesis(null);
    setVideoTestResults([]);
    setFinalExam(null);
    setCapstoneProjects([]);
    setCertificate(null);
    setLocalScoreProfile({
      totalScore: 0,
      testsCompleted: 0,
      videosCompleted: 0,
      certificatesEarned: 0,
    });
    setDiagError(null);
    setScreen('landing');
  };

  const handleStartNewSkill = () => {
    if (isDemoMode && !user) {
      clearDemoState();
      setDemoLastSavedAt(null);
      setProfile(INITIAL_PROFILE);
      setMessages([]);
      setSkillTree(null);
      setSelectedNodeId(null);
      setVideos([]);
      setSelectedVideo(null);
      setBookmarkedIds({});
      setSynthesis(null);
      setVideoTestResults([]);
      setFinalExam(null);
      setCapstoneProjects([]);
      setCertificate(null);
      setLocalScoreProfile({
        totalScore: 0,
        testsCompleted: 0,
        videosCompleted: 0,
        certificatesEarned: 0,
      });
    }
    setDiagError(null);
    setScreen('setup');
  };

  const handleCompleteSetup = async (config: {
    topic: string;
    goal: string;
    pace: LearningPace;
    dailyMinutes: DailyStudyMinutes;
  }) => {
    const freshProfile: DiagnosticProfile = {
      topic: config.topic,
      goal: config.goal,
      pace: config.pace,
      dailyMinutes: config.dailyMinutes,
      estimatedLevel: 'Unassessed',
      confidenceScore: 0,
      strengths: [],
      knowledgeGaps: [],
      readyForSkillTree: false,
      turnCount: 0,
    };
    setActivePathId(null);
    setProfile(freshProfile);
    setMessages([]);
    setSkillTree(null);
    setSelectedNodeId(null);
    setVideos([]);
    setSelectedVideo(null);
    setBookmarkedIds({});
    setSynthesis(null);
    setVideoTestResults([]);
    setFinalExam(null);
    setCapstoneProjects([]);
    setCertificate(null);
    setDiagError(null);
    setScreen('diagnostic');

    setDiagLoading(true);
    diagRetryRef.current = () => {
      void handleCompleteSetup(config);
    };
    try {
      const data = await safeApiPost<{
        reply: string;
        suggestedReplies?: string[];
        assessment?: DiagnosticMessage['assessment'];
        updatedProfile: Partial<DiagnosticProfile>;
      }>('/api/diagnostic/turn', {
        topic: config.topic,
        goal: config.goal,
        history: [],
        userMessage: '',
        currentProfile: freshProfile,
      });

      diagRetryRef.current = null;
      setProfile((prev) => ({
        ...prev,
        ...data.updatedProfile,
        pace: config.pace,
        dailyMinutes: config.dailyMinutes,
      }));
      setMessages([
        {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          timestamp: nowLabel(),
          suggestedReplies: data.suggestedReplies,
          assessment: data.assessment,
        },
      ]);
    } catch (err) {
      const friendly = toUserFriendlyError(err, 'Unable to start knowledge check.');
      setDiagError(friendly);
      showToast(friendly, 'error');
    } finally {
      setDiagLoading(false);
    }
  };

  const handleGenerateSkillTree = useCallback(
    async (overrideMessages?: DiagnosticMessage[], overrideProfile?: DiagnosticProfile) => {
      const activeProfile = overrideProfile || profile;
      const activeMessages = overrideMessages || messages;
      if (!activeProfile.topic || treeLoading) return;

      setTreeLoading(true);
      setDiagError(null);
      diagRetryRef.current = () => {
        void handleGenerateSkillTree(overrideMessages, overrideProfile);
      };
      try {
        const tree = await safeApiPost<SkillTreeData>('/api/skill-tree/generate', {
          topic: activeProfile.topic,
          goal: activeProfile.goal,
          pace: activeProfile.pace,
          dailyMinutes: activeProfile.dailyMinutes,
          profile: activeProfile,
          history: activeMessages.map((m) => ({ role: m.role, content: m.content })),
        });
        diagRetryRef.current = null;
        const initialNodeId = tree.recommendedNextId || tree.nodes[0]?.id || null;
        setSkillTree(tree);
        setSelectedNodeId(initialNodeId);
        setDashboardTab('overview');
        setScreen('dashboard');

        if (user) {
          try {
            const newId = await saveNewLearningPath(user.uid, {
              profile: activeProfile,
              skillTree: tree,
              selectedNodeId: initialNodeId,
              bookmarkedIds: {},
              synthesis: null,
            });
            setActivePathId(newId);
          } catch (saveErr) {
            const friendlySave = formatFirebaseUserError(saveErr);
            setDiagError(friendlySave);
            showToast(friendlySave, 'error');
          }
        } else {
          setActivePathId(null);
        }
      } catch (err) {
        const friendly = toUserFriendlyError(err, 'Failed to build your learning path.');
        setDiagError(friendly);
        showToast(friendly, 'error');
      } finally {
        setTreeLoading(false);
      }
    },
    [profile, messages, treeLoading, user, setActivePathId, showToast]
  );

  const sendDiagnosticTurn = async (
    userText: string,
    priorMessages: DiagnosticMessage[],
    priorProfile: DiagnosticProfile
  ) => {
    const userMsg: DiagnosticMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: nowLabel(),
    };
    const nextHistory = [...priorMessages, userMsg];
    setMessages(nextHistory);
    setDiagLoading(true);
    setDiagError(null);
    diagRetryRef.current = () => {
      void sendDiagnosticTurn(userText, priorMessages, priorProfile);
    };

    try {
      const data = await safeApiPost<{
        reply: string;
        suggestedReplies?: string[];
        assessment?: DiagnosticMessage['assessment'];
        updatedProfile: Partial<DiagnosticProfile>;
      }>('/api/diagnostic/turn', {
        topic: priorProfile.topic,
        goal: priorProfile.goal,
        history: priorMessages.map((m) => ({ role: m.role, content: m.content })),
        userMessage: userText,
        currentProfile: priorProfile,
      });

      diagRetryRef.current = null;
      const updatedProfile: DiagnosticProfile = {
        ...priorProfile,
        ...data.updatedProfile,
        pace: priorProfile.pace,
        dailyMinutes: priorProfile.dailyMinutes,
      };
      const assistantMsg: DiagnosticMessage = {
        id: `asst_${Date.now()}`,
        role: 'assistant',
        content: data.reply,
        timestamp: nowLabel(),
        suggestedReplies: data.suggestedReplies,
        assessment: data.assessment,
      };
      const completeHistory = [...nextHistory, assistantMsg];

      setProfile(updatedProfile);
      setMessages(completeHistory);

      // Automatically transition after Question 5
      if (updatedProfile.turnCount >= 5) {
        await handleGenerateSkillTree(completeHistory, updatedProfile);
      }
    } catch (err) {
      const friendly = toUserFriendlyError(err, 'Failed to process answer.');
      setDiagError(friendly);
      showToast(friendly, 'error');
    } finally {
      setDiagLoading(false);
    }
  };

  const handleSendDiagnosticMessage = async (userText: string) => {
    await sendDiagnosticTurn(userText, messages, profile);
  };

  const handleSaveCurrentPathForUser = useCallback(
    async (targetUserId: string) => {
      if (!skillTree) return;
      setIsSavingPath(true);
      setDiagError(null);
      try {
        const newId = await saveNewLearningPath(targetUserId, {
          profile,
          skillTree,
          selectedNodeId,
          bookmarkedIds,
          synthesis,
          videoTestResults,
          capstoneProjects,
        });
        setActivePathId(newId);
        clearDemoState();
        setDemoLastSavedAt(null);
      } catch (err) {
        const msg = formatFirebaseUserError(err);
        setDiagError(msg);
        showToast(msg, 'error');
      } finally {
        setIsSavingPath(false);
      }
    },
    [
      skillTree,
      profile,
      selectedNodeId,
      bookmarkedIds,
      synthesis,
      videoTestResults,
      capstoneProjects,
      setActivePathId,
      showToast,
    ]
  );

  const handleSaveCurrentPath = async () => {
    if (!user) return;
    await handleSaveCurrentPathForUser(user.uid);
  };

  const handleSignInAndSave = async () => {
    const signedInUser = await signInWithGoogle();
    if (signedInUser && skillTree && !activePathId) {
      await handleSaveCurrentPathForUser(signedInUser.uid);
    }
  };

  const handleDeleteSavedPath = async (pathId: string) => {
    if (!user) return;
    try {
      await deleteLearningPathDoc(user.uid, pathId);
      if (pathId === activePathId) {
        setActivePathId(null);
      }
    } catch (err) {
      const msg = formatFirebaseUserError(err);
      setDiagError(msg);
      showToast(msg, 'error');
    }
  };

  const handleUpdateNodeStatus = useCallback(
    (nodeId: string, passed: boolean) => {
      if (!skillTree) return;
      const updated = skillTree.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, status: passed ? ('mastered' as const) : ('needs_review' as const) }
          : n
      );
      const masteredSet = new Set(
        updated.filter((n) => n.status === 'mastered').map((n) => n.id)
      );
      const unlocked = updated.map((n) =>
        n.status === 'locked' && n.prerequisites.every((pid) => masteredSet.has(pid))
          ? { ...n, status: 'ready' as const }
          : n
      );
      const nextRec =
        unlocked.find((n) => n.status === 'ready')?.id ||
        unlocked.find((n) => n.status === 'needs_review')?.id ||
        skillTree.recommendedNextId;

      setSkillTree({
        ...skillTree,
        nodes: unlocked,
        recommendedNextId: nextRec,
      });

      if (user && activePathId) {
        void updateLearningPathProgress(
          user.uid,
          activePathId,
          unlocked,
          nextRec,
          selectedNodeId
        ).catch((err) => {
          const msg = formatFirebaseUserError(err);
          setDiagError(msg);
          showToast(msg, 'error');
        });
      }
    },
    [skillTree, user, activePathId, selectedNodeId, showToast]
  );

  const handleGenerateNotesFromVideo = async (
    video: VideoResult,
    transcriptContext: string
  ) => {
    if (isSummarizing) return;
    setIsSummarizing(true);
    setDiagError(null);
    setNotesError(null);
    const activeNode = skillTree?.nodes.find((n) => n.id === selectedNodeId) || null;
    try {
      const nextSynthesis = await safeApiPost<VideoSynthesis>('/api/videos/summarize', {
        videoId: video.videoId,
        videoTitle: video.title,
        channelTitle: video.channelTitle,
        topic: skillTree?.topic || profile.topic,
        skillTitle: activeNode?.title || video.title,
        userNotesOrTranscript: transcriptContext,
      });
      setSynthesis(nextSynthesis);
      setDashboardTab('notes');

      if (user && activePathId) {
        try {
          await updateLearningPathNotes(user.uid, activePathId, nextSynthesis, selectedNodeId);
        } catch (saveErr) {
          const friendlySave = formatFirebaseUserError(saveErr);
          setNotesError(friendlySave);
          showToast(friendlySave, 'error');
        }
      }
    } catch (err) {
      const friendly = toUserFriendlyError(err, 'Could not synthesize study notes.');
      setNotesError(friendly);
      showToast(friendly, 'error');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleGenerateNotesForNode = async (node: SkillNode) => {
    if (isSummarizing) return;
    setIsSummarizing(true);
    setDiagError(null);
    setNotesError(null);
    try {
      const nextSynthesis = await safeApiPost<VideoSynthesis>('/api/videos/summarize', {
        videoId: selectedVideo?.videoId || `node_${node.id}`,
        videoTitle: selectedVideo?.title || node.title,
        channelTitle: selectedVideo?.channelTitle || 'SkillPath Curriculum',
        topic: skillTree?.topic || profile.topic,
        skillTitle: node.title,
        userNotesOrTranscript: `Objectives: ${node.learningObjectives.join('; ')}. Summary: ${node.summary}`,
      });
      setSynthesis(nextSynthesis);

      if (user && activePathId) {
        try {
          await updateLearningPathNotes(user.uid, activePathId, nextSynthesis, node.id);
        } catch (saveErr) {
          const friendlySave = formatFirebaseUserError(saveErr);
          setNotesError(friendlySave);
          showToast(friendlySave, 'error');
        }
      }
    } catch (err) {
      const friendly = toUserFriendlyError(err, 'Could not generate study notes.');
      setNotesError(friendly);
      showToast(friendly, 'error');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleTogglePlanDay = (dayNumber: number) => {
    if (!skillTree) return;
    const basePlan =
      skillTree.studyPlan && skillTree.studyPlan.length > 0
        ? skillTree.studyPlan
        : skillTree.nodes.slice(0, 7).map((n, idx) => ({
            day: idx + 1,
            dateLabel: idx === 0 ? 'Day 1 · Today' : `Day ${idx + 1}`,
            moduleId: n.id,
            taskTitle: n.title,
            estimatedMinutes: n.estimatedMinutes,
            motivation: n.whyItMatters || n.summary,
            completed: n.status === 'mastered',
          }));
    const updatedPlan = basePlan.map((d) =>
      d.day === dayNumber ? { ...d, completed: !d.completed } : d
    );
    setSkillTree({
      ...skillTree,
      studyPlan: updatedPlan,
    });

    if (user && activePathId) {
      void updateLearningPathStudyPlan(user.uid, activePathId, updatedPlan).catch((err) => {
        const msg = formatFirebaseUserError(err);
        setDiagError(msg);
        showToast(msg, 'error');
      });
    }
  };

  const handleToggleBookmark = (videoId: string) => {
    const nextBookmarks = { ...bookmarkedIds, [videoId]: !bookmarkedIds[videoId] };
    setBookmarkedIds(nextBookmarks);

    if (user && activePathId) {
      void updateLearningPathBookmarks(user.uid, activePathId, nextBookmarks).catch((err) => {
        const msg = formatFirebaseUserError(err);
        setDiagError(msg);
        showToast(msg, 'error');
      });
    }
  };

  const handleVideoTestCompleted = async (
    video: VideoResult,
    node: SkillNode | null,
    evaluation: VideoQuizEvaluation
  ) => {
    const alreadyTested = videoTestResults.some((r) => r.videoId === video.videoId);
    const entry: VideoTestResult = {
      videoId: video.videoId,
      videoTitle: video.title,
      nodeId: node?.id || selectedNodeId || '',
      score: evaluation.score,
      pointsAwarded: evaluation.pointsAwarded,
      passed: evaluation.passed,
      feedback: evaluation.feedback,
      completedAtIso: new Date().toISOString(),
    };
    const nextResults = [
      entry,
      ...videoTestResults.filter((r) => r.videoId !== video.videoId),
    ].slice(0, 30);

    setVideoTestResults(nextResults);

    if (user) {
      try {
        await addProfileScore(user.uid, {
          scoreDelta: evaluation.pointsAwarded,
          testsDelta: 1,
          videosDelta: alreadyTested ? 0 : 1,
          certificatesDelta: 0,
        });
        if (activePathId) {
          await updateLearningPathVideoTests(user.uid, activePathId, nextResults);
        }
      } catch (err) {
        const msg = formatFirebaseUserError(err);
        setDiagError(msg);
        showToast(msg, 'error');
      }
    } else {
      setLocalScoreProfile((prev) => ({
        ...prev,
        totalScore: prev.totalScore + evaluation.pointsAwarded,
        testsCompleted: prev.testsCompleted + 1,
        videosCompleted: prev.videosCompleted + (alreadyTested ? 0 : 1),
      }));
    }
  };

  const handleFinalExamEvaluated = async (
    evaluation: FinalExamEvaluation,
    learnerName: string
  ) => {
    if (!skillTree) return;

    const examRecord: FinalExamResult = {
      score: evaluation.score,
      passed: evaluation.passed,
      pointsAwarded: evaluation.pointsAwarded,
      feedback: evaluation.feedback,
      strengthSummary: evaluation.strengthSummary,
      completedAtIso: evaluation.completedAtIso || new Date().toISOString(),
    };
    setFinalExam(examRecord);

    const updatedTotalScore = activeScoreProfile.totalScore + evaluation.pointsAwarded;
    const allModulesDone =
      skillTree.nodes.length > 0 && skillTree.nodes.every((n) => n.status === 'mastered');
    const allProjectsDone =
      capstoneProjects.length > 0 && capstoneProjects.every((p) => p.status === 'passed');
    const isNewCertificate =
      evaluation.passed && allModulesDone && allProjectsDone && !certificate;

    const issuedCertificate: SkillCertificate | null = isNewCertificate
      ? {
          certificateId: `SP-${Date.now().toString(36).toUpperCase()}`,
          learnerName,
          topic: skillTree.topic,
          finalScore: evaluation.score,
          totalScore: updatedTotalScore,
          projectsCompleted: capstoneProjects.filter((p) => p.status === 'passed').length,
          level: profile.estimatedLevel,
          strengthSummary: evaluation.strengthSummary,
          issuedAtIso: examRecord.completedAtIso,
        }
      : certificate;

    if (issuedCertificate && isNewCertificate) {
      setCertificate(issuedCertificate);
    }

    if (user) {
      try {
        await addProfileScore(user.uid, {
          scoreDelta: evaluation.pointsAwarded,
          testsDelta: 1,
          videosDelta: 0,
          certificatesDelta: isNewCertificate ? 1 : 0,
        });
        if (activePathId) {
          await saveFinalExamAndCertificate(
            user.uid,
            activePathId,
            examRecord,
            isNewCertificate ? issuedCertificate : null
          );
        }
      } catch (err) {
        const msg = formatFirebaseUserError(err);
        setDiagError(msg);
        showToast(msg, 'error');
      }
    } else {
      setLocalScoreProfile((prev) => ({
        ...prev,
        totalScore: prev.totalScore + evaluation.pointsAwarded,
        testsCompleted: prev.testsCompleted + 1,
        certificatesEarned: prev.certificatesEarned + (isNewCertificate ? 1 : 0),
      }));
    }
  };

  const handleProjectsGenerated = async (projects: CapstoneProjectItem[]) => {
    setCapstoneProjects(projects);
    if (user && activePathId) {
      try {
        await saveCapstoneProjectsAndCertificate(user.uid, activePathId, projects, null);
      } catch (err) {
        const msg = formatFirebaseUserError(err);
        setDiagError(msg);
        showToast(msg, 'error');
      }
    }
  };

  const handleProjectEvaluated = async (
    updatedProjects: CapstoneProjectItem[],
    evaluation: ProjectEvaluationResponse,
    learnerName: string
  ) => {
    if (!skillTree) return;
    setCapstoneProjects(updatedProjects);

    const updatedTotalScore = activeScoreProfile.totalScore + evaluation.pointsAwarded;
    const allModulesDone =
      skillTree.nodes.length > 0 && skillTree.nodes.every((n) => n.status === 'mastered');
    const allProjectsDone =
      updatedProjects.length > 0 && updatedProjects.every((p) => p.status === 'passed');
    const isNewCertificate =
      Boolean(finalExam?.passed) && allModulesDone && allProjectsDone && !certificate;

    const issuedCertificate: SkillCertificate | null = isNewCertificate
      ? {
          certificateId: `SP-${Date.now().toString(36).toUpperCase()}`,
          learnerName,
          topic: skillTree.topic,
          finalScore: finalExam?.score ?? evaluation.score,
          totalScore: updatedTotalScore,
          projectsCompleted: updatedProjects.filter((p) => p.status === 'passed').length,
          level: profile.estimatedLevel,
          strengthSummary:
            finalExam?.strengthSummary ||
            `Completed all curriculum modules, Final AI Exam, and applied capstone projects in ${skillTree.topic}.`,
          issuedAtIso: evaluation.completedAtIso || new Date().toISOString(),
        }
      : certificate;

    if (issuedCertificate && isNewCertificate) {
      setCertificate(issuedCertificate);
    }

    if (user) {
      try {
        await addProfileScore(user.uid, {
          scoreDelta: evaluation.pointsAwarded,
          testsDelta: 1,
          videosDelta: 0,
          certificatesDelta: isNewCertificate ? 1 : 0,
        });
        if (activePathId) {
          await saveCapstoneProjectsAndCertificate(
            user.uid,
            activePathId,
            updatedProjects,
            isNewCertificate ? issuedCertificate : null
          );
        }
      } catch (err) {
        const msg = formatFirebaseUserError(err);
        setDiagError(msg);
        showToast(msg, 'error');
      }
    } else {
      setLocalScoreProfile((prev) => ({
        ...prev,
        totalScore: prev.totalScore + evaluation.pointsAwarded,
        testsCompleted: prev.testsCompleted + 1,
        certificatesEarned: prev.certificatesEarned + (isNewCertificate ? 1 : 0),
      }));
    }
  };

  const navigateHome = () => {
    if (typeof window !== 'undefined' && !isKnownAppPath(window.location.pathname)) {
      window.history.pushState({}, '', '/');
      setCurrentPath('/');
    }
    setScreen('landing');
  };

  if (!isKnownAppPath(currentPath)) {
    return (
      <NotFoundPage
        isDark={isDark}
        badPath={currentPath}
        onToggleTheme={handleToggleTheme}
        onGoHome={navigateHome}
        onTryDemo={() => {
          if (typeof window !== 'undefined') {
            window.history.pushState({}, '', '/');
            setCurrentPath('/');
          }
          handleLaunchDemo();
        }}
      />
    );
  }

  if (screen === 'landing') {
    return (
      <LandingPage
        isDark={isDark}
        user={user}
        authReady={authReady}
        authLoading={authLoading}
        authError={authError}
        savedPaths={savedPaths}
        onToggleTheme={handleToggleTheme}
        onStartSetup={handleStartSetup}
        onEnterDemoSetup={handleEnterDemoSetup}
        onTryDemo={handleLaunchDemo}
        onSignIn={async () => {
          const signedIn = await signInWithGoogle();
          return Boolean(signedIn);
        }}
        onSignOut={async () => {
          await signOutUser();
          handleExitDemo();
        }}
        onOpenSavedPath={handleOpenSavedPath}
        onClearAuthError={clearAuthError}
      />
    );
  }

  if (screen === 'setup') {
    return (
      <SkillSetupPage
        initialTopic={profile.topic}
        initialGoal={profile.goal}
        initialPace={profile.pace}
        initialMinutes={profile.dailyMinutes}
        isDemoMode={isDemoMode && !user}
        onBack={() => setScreen('landing')}
        onComplete={(cfg) => void handleCompleteSetup(cfg)}
      />
    );
  }

  if (screen === 'diagnostic') {
    return (
      <DiagnosticAssessmentPage
        profile={profile}
        messages={messages}
        isLoading={diagLoading}
        isGeneratingTree={treeLoading}
        error={diagError}
        onBackToSetup={() => setScreen('setup')}
        onSendMessage={handleSendDiagnosticMessage}
        onGenerateSkillTree={() => handleGenerateSkillTree()}
        onRetry={() => diagRetryRef.current?.()}
        onLaunchDemo={handleLaunchDemo}
      />
    );
  }

  return (
    <DashboardPage
      activeTab={dashboardTab}
      isDark={isDark}
      profile={profile}
      skillTree={skillTree}
      selectedNodeId={selectedNodeId}
      videos={videos}
      selectedVideo={selectedVideo}
      bookmarkedIds={bookmarkedIds}
      synthesis={synthesis}
      isSummarizing={isSummarizing}
      notesError={notesError}
      error={diagError}
      user={user}
      authReady={authReady}
      authLoading={authLoading}
      authError={authError}
      savedPaths={savedPaths}
      activePathId={activePathId}
      isSavingPath={isSavingPath}
      isDemoMode={isDemoMode && !user}
      demoLastSavedAt={demoLastSavedAt}
      scoreProfile={activeScoreProfile}
      videoTestResults={videoTestResults}
      finalExam={finalExam}
      capstoneProjects={capstoneProjects}
      certificate={certificate}
      onSelectTab={setDashboardTab}
      onToggleTheme={handleToggleTheme}
      onStartNewSkill={handleStartNewSkill}
      onGoToDiagnostic={() => setScreen('setup')}
      onGoHome={() => setScreen('landing')}
      onExitDemo={handleExitDemo}
      onSelectNode={setSelectedNodeId}
      onUpdateNodeStatus={handleUpdateNodeStatus}
      onVideosLoaded={setVideos}
      onSelectVideo={setSelectedVideo}
      onToggleBookmark={handleToggleBookmark}
      onGenerateNotes={handleGenerateNotesFromVideo}
      onGenerateNotesForNode={handleGenerateNotesForNode}
      onTogglePlanDay={handleTogglePlanDay}
      onVideoTestCompleted={handleVideoTestCompleted}
      onFinalExamEvaluated={handleFinalExamEvaluated}
      onProjectsGenerated={handleProjectsGenerated}
      onProjectEvaluated={handleProjectEvaluated}
      onSignInAndSave={handleSignInAndSave}
      onSignOut={async () => {
        await signOutUser();
        handleExitDemo();
      }}
      onSaveCurrentPath={handleSaveCurrentPath}
      onOpenSavedPath={handleOpenSavedPath}
      onDeleteSavedPath={handleDeleteSavedPath}
      onClearAuthError={clearAuthError}
    />
  );
}
