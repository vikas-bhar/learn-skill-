import { useEffect, useState, useCallback } from 'react';
import { LandingPage } from './components/LandingPage';
import { SkillSetupPage } from './components/SkillSetupPage';
import { DiagnosticAssessmentPage } from './components/DiagnosticAssessmentPage';
import { DashboardPage } from './components/DashboardPage';
import { useFirebase } from './context/FirebaseContext';
import { formatFirebaseUserError } from './lib/firebase';
import {
  deleteLearningPathDoc,
  addProfileScore,
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
  DailyStudyMinutes,
  DashboardTab,
  DiagnosticMessage,
  DiagnosticProfile,
  FinalExamEvaluation,
  FinalExamResult,
  LearnerScoreProfile,
  LearningPace,
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

  const [screen, setScreen] = useState<AppScreen>('landing');
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('overview');
  const [isDark, setIsDark] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isSavingPath, setIsSavingPath] = useState(false);

  const [localScoreProfile, setLocalScoreProfile] = useState<LearnerScoreProfile>({
    totalScore: 0,
    testsCompleted: 0,
    videosCompleted: 0,
    certificatesEarned: 0,
  });

  const [profile, setProfile] = useState<DiagnosticProfile>(INITIAL_PROFILE);
  const [messages, setMessages] = useState<DiagnosticMessage[]>([]);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagError, setDiagError] = useState<string | null>(null);

  const [skillTree, setSkillTree] = useState<SkillTreeData | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);

  const [videos, setVideos] = useState<VideoResult[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<VideoResult | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Record<string, boolean>>({});
  const [synthesis, setSynthesis] = useState<VideoSynthesis | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [videoTestResults, setVideoTestResults] = useState<VideoTestResult[]>([]);
  const [finalExam, setFinalExam] = useState<FinalExamResult | null>(null);
  const [certificate, setCertificate] = useState<SkillCertificate | null>(null);

  const activeScoreProfile = user ? cloudScoreProfile : localScoreProfile;

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
    setCertificate(null);
    setDiagError(null);
    setScreen('diagnostic');

    setDiagLoading(true);
    try {
      const res = await fetch('/api/diagnostic/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: config.topic,
          goal: config.goal,
          history: [],
          userMessage: '',
          currentProfile: freshProfile,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start knowledge check.');

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
      setDiagError(err instanceof Error ? err.message : 'Unable to start knowledge check.');
    } finally {
      setDiagLoading(false);
    }
  };

  const handleGenerateSkillTree = useCallback(
    async (overrideMessages?: DiagnosticMessage[], overrideProfile?: DiagnosticProfile) => {
      const activeProfile = overrideProfile || profile;
      const activeMessages = overrideMessages || messages;
      if (!activeProfile.topic) return;

      setTreeLoading(true);
      setDiagError(null);
      try {
        const res = await fetch('/api/skill-tree/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: activeProfile.topic,
            goal: activeProfile.goal,
            pace: activeProfile.pace,
            dailyMinutes: activeProfile.dailyMinutes,
            profile: activeProfile,
            history: activeMessages.map((m) => ({ role: m.role, content: m.content })),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to build your learning path.');

        const tree = data as SkillTreeData;
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
            setDiagError(formatFirebaseUserError(saveErr));
          }
        } else {
          setActivePathId(null);
        }
      } catch (err) {
        setDiagError(err instanceof Error ? err.message : 'Failed to build skill tree.');
      } finally {
        setTreeLoading(false);
      }
    },
    [profile, messages, user, setActivePathId]
  );

  const handleSendDiagnosticMessage = async (userText: string) => {
    const userMsg: DiagnosticMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: userText,
      timestamp: nowLabel(),
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setDiagLoading(true);
    setDiagError(null);

    try {
      const res = await fetch('/api/diagnostic/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: profile.topic,
          goal: profile.goal,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
          userMessage: userText,
          currentProfile: profile,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Diagnostic evaluation failed.');

      const updatedProfile: DiagnosticProfile = {
        ...profile,
        ...data.updatedProfile,
        pace: profile.pace,
        dailyMinutes: profile.dailyMinutes,
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
      setDiagError(err instanceof Error ? err.message : 'Failed to process answer.');
    } finally {
      setDiagLoading(false);
    }
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
        });
        setActivePathId(newId);
      } catch (err) {
        setDiagError(formatFirebaseUserError(err));
      } finally {
        setIsSavingPath(false);
      }
    },
    [skillTree, profile, selectedNodeId, bookmarkedIds, synthesis, videoTestResults, setActivePathId]
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
      setDiagError(formatFirebaseUserError(err));
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
        ).catch((err) => setDiagError(formatFirebaseUserError(err)));
      }
    },
    [skillTree, user, activePathId, selectedNodeId]
  );

  const handleGenerateNotesFromVideo = async (
    video: VideoResult,
    transcriptContext: string
  ) => {
    setIsSummarizing(true);
    setDiagError(null);
    const activeNode = skillTree?.nodes.find((n) => n.id === selectedNodeId) || null;
    try {
      const res = await fetch('/api/videos/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: video.videoId,
          videoTitle: video.title,
          channelTitle: video.channelTitle,
          topic: skillTree?.topic || profile.topic,
          skillTitle: activeNode?.title || video.title,
          userNotesOrTranscript: transcriptContext,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not synthesize study notes.');
      const nextSynthesis = data as VideoSynthesis;
      setSynthesis(nextSynthesis);
      setDashboardTab('notes');

      if (user && activePathId) {
        try {
          await updateLearningPathNotes(user.uid, activePathId, nextSynthesis, selectedNodeId);
        } catch (saveErr) {
          setDiagError(formatFirebaseUserError(saveErr));
        }
      }
    } catch (err) {
      setDiagError(err instanceof Error ? err.message : 'Failed to synthesize notes.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleGenerateNotesForNode = async (node: SkillNode) => {
    setIsSummarizing(true);
    setDiagError(null);
    try {
      const res = await fetch('/api/videos/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId: selectedVideo?.videoId || `node_${node.id}`,
          videoTitle: selectedVideo?.title || node.title,
          channelTitle: selectedVideo?.channelTitle || 'SkillPath Curriculum',
          topic: skillTree?.topic || profile.topic,
          skillTitle: node.title,
          userNotesOrTranscript: `Objectives: ${node.learningObjectives.join('; ')}. Summary: ${node.summary}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not generate notes.');
      const nextSynthesis = data as VideoSynthesis;
      setSynthesis(nextSynthesis);

      if (user && activePathId) {
        try {
          await updateLearningPathNotes(user.uid, activePathId, nextSynthesis, node.id);
        } catch (saveErr) {
          setDiagError(formatFirebaseUserError(saveErr));
        }
      }
    } catch (err) {
      setDiagError(err instanceof Error ? err.message : 'Note generation failed.');
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
      void updateLearningPathStudyPlan(user.uid, activePathId, updatedPlan).catch((err) =>
        setDiagError(formatFirebaseUserError(err))
      );
    }
  };

  const handleToggleBookmark = (videoId: string) => {
    const nextBookmarks = { ...bookmarkedIds, [videoId]: !bookmarkedIds[videoId] };
    setBookmarkedIds(nextBookmarks);

    if (user && activePathId) {
      void updateLearningPathBookmarks(user.uid, activePathId, nextBookmarks).catch((err) =>
        setDiagError(formatFirebaseUserError(err))
      );
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
        setDiagError(formatFirebaseUserError(err));
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
    const isNewCertificate = evaluation.passed && !certificate;
    const issuedCertificate: SkillCertificate | null = isNewCertificate
      ? {
          certificateId: `SP-${Date.now().toString(36).toUpperCase()}`,
          learnerName,
          topic: skillTree.topic,
          finalScore: evaluation.score,
          totalScore: updatedTotalScore,
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
        setDiagError(formatFirebaseUserError(err));
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
      error={diagError}
      user={user}
      authReady={authReady}
      authLoading={authLoading}
      authError={authError}
      savedPaths={savedPaths}
      activePathId={activePathId}
      isSavingPath={isSavingPath}
      isDemoMode={isDemoMode && !user}
      scoreProfile={activeScoreProfile}
      videoTestResults={videoTestResults}
      finalExam={finalExam}
      certificate={certificate}
      onSelectTab={setDashboardTab}
      onToggleTheme={handleToggleTheme}
      onStartNewSkill={() => setScreen('setup')}
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
