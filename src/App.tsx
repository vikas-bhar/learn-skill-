import { useEffect, useState, useCallback } from 'react';
import { LandingPage } from './components/LandingPage';
import { SkillSetupPage } from './components/SkillSetupPage';
import { DiagnosticAssessmentPage } from './components/DiagnosticAssessmentPage';
import { DashboardPage } from './components/DashboardPage';
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
  LearningPace,
  SkillNode,
  SkillTreeData,
  VideoResult,
  VideoSynthesis,
} from './types/learning';

const INITIAL_PROFILE: DiagnosticProfile = {
  topic: 'Python',
  goal: 'Build a portfolio project',
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
  const [screen, setScreen] = useState<AppScreen>('landing');
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('overview');
  const [isDark, setIsDark] = useState(true);

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

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  const handleToggleTheme = () => setIsDark((prev) => !prev);

  const handleLaunchDemo = () => {
    setProfile(DEMO_PROFILE);
    setMessages(DEMO_MESSAGES);
    setSkillTree(DEMO_SKILL_TREE);
    setSelectedNodeId('n3');
    setVideos(DEMO_VIDEOS);
    setSelectedVideo(DEMO_VIDEOS[0]);
    setSynthesis(DEMO_SYNTHESIS);
    setDiagError(null);
    setDashboardTab('overview');
    setScreen('dashboard');
  };

  const handleStartSetup = (presetTopic?: string) => {
    if (presetTopic) {
      setProfile((prev) => ({ ...prev, topic: presetTopic }));
    }
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
    setProfile(freshProfile);
    setMessages([]);
    setSkillTree(null);
    setSelectedNodeId(null);
    setVideos([]);
    setSelectedVideo(null);
    setSynthesis(null);
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
        setSkillTree(tree);
        setSelectedNodeId(tree.recommendedNextId || tree.nodes[0]?.id || null);
        setDashboardTab('overview');
        setScreen('dashboard');
      } catch (err) {
        setDiagError(err instanceof Error ? err.message : 'Failed to build skill tree.');
      } finally {
        setTreeLoading(false);
      }
    },
    [profile, messages]
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

  const handleUpdateNodeStatus = useCallback(
    (nodeId: string, passed: boolean) => {
      setSkillTree((prev) => {
        if (!prev) return prev;
        const updated = prev.nodes.map((n) =>
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
          prev.recommendedNextId;
        return {
          ...prev,
          nodes: unlocked,
          recommendedNextId: nextRec,
        };
      });
    },
    []
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
      setSynthesis(data as VideoSynthesis);
      setDashboardTab('notes');
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
      setSynthesis(data as VideoSynthesis);
    } catch (err) {
      setDiagError(err instanceof Error ? err.message : 'Note generation failed.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleTogglePlanDay = (dayNumber: number) => {
    setSkillTree((prev) => {
      if (!prev || !prev.studyPlan) return prev;
      return {
        ...prev,
        studyPlan: prev.studyPlan.map((d) =>
          d.day === dayNumber ? { ...d, completed: !d.completed } : d
        ),
      };
    });
  };

  const handleToggleBookmark = (videoId: string) => {
    setBookmarkedIds((prev) => ({ ...prev, [videoId]: !prev[videoId] }));
  };

  if (screen === 'landing') {
    return (
      <LandingPage
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
        onStartSetup={handleStartSetup}
        onTryDemo={handleLaunchDemo}
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
      onSelectTab={setDashboardTab}
      onToggleTheme={handleToggleTheme}
      onStartNewSkill={() => setScreen('setup')}
      onGoToDiagnostic={() => setScreen('setup')}
      onSelectNode={setSelectedNodeId}
      onUpdateNodeStatus={handleUpdateNodeStatus}
      onVideosLoaded={setVideos}
      onSelectVideo={setSelectedVideo}
      onToggleBookmark={handleToggleBookmark}
      onGenerateNotes={handleGenerateNotesFromVideo}
      onGenerateNotesForNode={handleGenerateNotesForNode}
      onTogglePlanDay={handleTogglePlanDay}
    />
  );
}
