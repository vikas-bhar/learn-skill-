import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  DailyStudyMinutes,
  DiagnosticProfile,
  FinalExamResult,
  LearnerLevel,
  LearnerScoreProfile,
  LearningPace,
  SkillCertificate,
  SkillEdge,
  SkillNode,
  SkillTreeData,
  StudyPlanDay,
  VideoSynthesis,
  VideoTestResult,
} from '../types/learning';
import { db, handleFirestoreError, OperationType } from './firebase';

const VALID_ID_REGEX = /^[a-zA-Z0-9_\-]+$/;
const VALID_PACES: LearningPace[] = ['casual', 'consistent', 'intensive'];
const VALID_MINUTES: DailyStudyMinutes[] = [30, 45, 60, 120];
const VALID_LEVELS: LearnerLevel[] = ['Unassessed', 'Beginner', 'Intermediate', 'Advanced'];

export interface SavedLearningPath {
  id: string;
  userId: string;
  profile: DiagnosticProfile;
  skillTree: SkillTreeData;
  selectedNodeId: string;
  bookmarkedVideoIds: string[];
  latestSynthesis: VideoSynthesis | null;
  videoTestResults: VideoTestResult[];
  finalExam: FinalExamResult | null;
  certificate: SkillCertificate | null;
  updatedAtMs: number;
}

function clampString(value: unknown, maxLen: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function sanitizeId(value: unknown, fallback: string): string {
  const str = clampString(value, 128, '');
  if (str && VALID_ID_REGEX.test(str)) return str;
  return fallback;
}

function clampInt(value: unknown, min: number, max: number, fallback = 0): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.max(min, Math.min(max, n));
}

function sanitizeStringArray(arr: unknown, maxItems: number, maxItemLen = 120): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .slice(0, maxItems)
    .map((item) => clampString(item, maxItemLen));
}

function sanitizeSynthesis(syn: VideoSynthesis): VideoSynthesis {
  const base: VideoSynthesis = {
    videoId: clampString(syn.videoId, 128, 'lesson_notes') || 'lesson_notes',
    videoTitle: clampString(syn.videoTitle, 240, 'Study Notes') || 'Study Notes',
    executiveSummary: clampString(syn.executiveSummary, 4000, ''),
    keyTakeaways: sanitizeStringArray(syn.keyTakeaways, 15, 400),
    structuredNotes: Array.isArray(syn.structuredNotes)
      ? syn.structuredNotes.slice(0, 15).map((sec) => ({
          heading: clampString(sec.heading, 180, 'Concept'),
          timestampHint: clampString(sec.timestampHint, 40, '00:00'),
          bullets: sanitizeStringArray(sec.bullets, 10, 400),
        }))
      : [],
    mermaidFlowchart: clampString(syn.mermaidFlowchart, 8000, ''),
    studyChecklist: sanitizeStringArray(syn.studyChecklist, 15, 300),
  };
  if (Array.isArray(syn.commonMistakes) && syn.commonMistakes.length > 0) {
    base.commonMistakes = sanitizeStringArray(syn.commonMistakes, 15, 300);
  }
  if (typeof syn.practiceTask === 'string' && syn.practiceTask.trim().length > 0) {
    base.practiceTask = clampString(syn.practiceTask, 2000, '');
  }
  return base;
}

function sanitizeNodes(nodes: SkillNode[]): SkillNode[] {
  return nodes.slice(0, 25).map((node, index) => ({
    id: clampString(node.id, 128, `n${index + 1}`),
    title: clampString(node.title, 160, `Module ${index + 1}`),
    summary: clampString(node.summary, 600, ''),
    tier: Number.isFinite(node.tier) ? Math.max(0, Math.min(10, Math.round(node.tier))) : 0,
    difficulty: node.difficulty || 'Beginner',
    status: node.status || 'ready',
    estimatedMinutes: Number.isFinite(node.estimatedMinutes)
      ? Math.max(5, Math.min(300, Math.round(node.estimatedMinutes)))
      : 30,
    prerequisites: sanitizeStringArray(node.prerequisites, 10, 128),
    learningObjectives: sanitizeStringArray(node.learningObjectives, 8, 240),
    whyItMatters: clampString(node.whyItMatters || '', 500, ''),
    keyConcepts: sanitizeStringArray(node.keyConcepts || [], 10, 120),
    commonMistakes: sanitizeStringArray(node.commonMistakes || [], 8, 240),
    practiceTask: clampString(node.practiceTask || '', 600, ''),
    diagnosticRationale: clampString(node.diagnosticRationale || '', 500, ''),
    youtubeSearchQuery: clampString(node.youtubeSearchQuery || '', 180, ''),
  }));
}

function sanitizeEdges(edges: SkillEdge[]): SkillEdge[] {
  return edges.slice(0, 60).map((edge) => ({
    source: clampString(edge.source, 128, ''),
    target: clampString(edge.target, 128, ''),
  }));
}

function sanitizeStudyPlan(plan: StudyPlanDay[] | undefined): StudyPlanDay[] {
  if (!Array.isArray(plan)) return [];
  return plan.slice(0, 14).map((day, index) => ({
    day: Number.isFinite(day.day) ? day.day : index + 1,
    dateLabel: clampString(day.dateLabel, 60, `Day ${index + 1}`),
    moduleId: clampString(day.moduleId, 128, ''),
    taskTitle: clampString(day.taskTitle, 180, `Session ${index + 1}`),
    estimatedMinutes: Number.isFinite(day.estimatedMinutes)
      ? Math.max(5, Math.min(240, Math.round(day.estimatedMinutes)))
      : 45,
    motivation: clampString(day.motivation, 400, ''),
    completed: Boolean(day.completed),
  }));
}

function sanitizeVideoTestResults(results: VideoTestResult[] | undefined): VideoTestResult[] {
  if (!Array.isArray(results)) return [];
  return results.slice(0, 30).map((r) => ({
    videoId: clampString(r.videoId, 128, 'video'),
    videoTitle: clampString(r.videoTitle, 240, 'Study Video'),
    nodeId: clampString(r.nodeId, 128, ''),
    score: clampInt(r.score, 0, 100, 0),
    pointsAwarded: clampInt(r.pointsAwarded, 0, 500, 0),
    passed: Boolean(r.passed),
    feedback: clampString(r.feedback, 800, ''),
    completedAtIso: clampString(r.completedAtIso, 64, new Date().toISOString()),
  }));
}

function sanitizeFinalExam(exam: FinalExamResult): FinalExamResult {
  return {
    score: clampInt(exam.score, 0, 100, 0),
    passed: Boolean(exam.passed),
    pointsAwarded: clampInt(exam.pointsAwarded, 0, 1000, 0),
    feedback: clampString(exam.feedback, 2000, ''),
    strengthSummary: clampString(exam.strengthSummary, 500, ''),
    completedAtIso: clampString(exam.completedAtIso, 64, new Date().toISOString()),
  };
}

function sanitizeCertificate(cert: SkillCertificate): SkillCertificate {
  return {
    certificateId: sanitizeId(cert.certificateId, `SP-${Date.now()}`),
    learnerName: clampString(cert.learnerName, 120, 'Learner') || 'Learner',
    topic: clampString(cert.topic, 120, 'Skill Track') || 'Skill Track',
    finalScore: clampInt(cert.finalScore, 0, 100, 70),
    totalScore: clampInt(cert.totalScore, 0, 1000000, 0),
    level: VALID_LEVELS.includes(cert.level) ? cert.level : 'Intermediate',
    strengthSummary: clampString(cert.strengthSummary, 500, 'Demonstrated applied mastery across the full curriculum.'),
    issuedAtIso: clampString(cert.issuedAtIso, 64, new Date().toISOString()),
  };
}

export async function ensureUserAccount(user: User): Promise<void> {
  const userPath = `users/${user.uid}`;
  const privateProfilePath = `users/${user.uid}/private/profile`;

  const displayName = clampString(
    user.displayName || user.email?.split('@')[0] || 'Learner',
    120,
    'Learner'
  );
  const email = clampString(user.email || 'learner@skillpath.local', 320, 'learner@skillpath.local');
  const photoUrl = clampString(user.photoURL || '', 1024, '');

  let userSnap;
  try {
    userSnap = await getDoc(doc(db, 'users', user.uid));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  if (!userSnap.exists()) {
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', user.uid), {
        uid: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(db, 'users', user.uid, 'private', 'profile'), {
        uid: user.uid,
        email,
        displayName,
        photoUrl,
        totalScore: 0,
        testsCompleted: 0,
        videosCompleted: 0,
        certificatesEarned: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      return;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, userPath);
    }
  }

  let profileSnap;
  try {
    profileSnap = await getDoc(doc(db, 'users', user.uid, 'private', 'profile'));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, privateProfilePath);
  }

  if (!profileSnap.exists()) {
    try {
      await setDoc(doc(db, 'users', user.uid, 'private', 'profile'), {
        uid: user.uid,
        email,
        displayName,
        photoUrl,
        totalScore: 0,
        testsCompleted: 0,
        videosCompleted: 0,
        certificatesEarned: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, privateProfilePath);
    }
    return;
  }

  const existing = profileSnap.data();
  if (
    existing?.email !== email ||
    existing?.displayName !== displayName ||
    existing?.photoUrl !== photoUrl
  ) {
    try {
      await updateDoc(doc(db, 'users', user.uid, 'private', 'profile'), {
        email,
        displayName,
        photoUrl,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, privateProfilePath);
    }
  }
}

export function subscribeUserScoreProfile(
  userId: string,
  onData: (scores: LearnerScoreProfile) => void,
  onError: (err: Error) => void
): () => void {
  const privateProfilePath = `users/${userId}/private/profile`;
  return onSnapshot(
    doc(db, 'users', userId, 'private', 'profile'),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData({
          totalScore: 0,
          testsCompleted: 0,
          videosCompleted: 0,
          certificatesEarned: 0,
        });
        return;
      }
      const d = snapshot.data();
      onData({
        totalScore: clampInt(d.totalScore, 0, 1000000, 0),
        testsCompleted: clampInt(d.testsCompleted, 0, 10000, 0),
        videosCompleted: clampInt(d.videosCompleted, 0, 10000, 0),
        certificatesEarned: clampInt(d.certificatesEarned, 0, 1000, 0),
      });
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.GET, privateProfilePath);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function addProfileScore(
  userId: string,
  delta: {
    scoreDelta: number;
    testsDelta: number;
    videosDelta: number;
    certificatesDelta: number;
  }
): Promise<LearnerScoreProfile> {
  const privateProfilePath = `users/${userId}/private/profile`;
  const ref = doc(db, 'users', userId, 'private', 'profile');

  let snap;
  try {
    snap = await getDoc(ref);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, privateProfilePath);
  }

  const current = snap?.exists() ? snap.data() : {};
  const next: LearnerScoreProfile = {
    totalScore: clampInt(
      (typeof current.totalScore === 'number' ? current.totalScore : 0) + delta.scoreDelta,
      0,
      1000000,
      0
    ),
    testsCompleted: clampInt(
      (typeof current.testsCompleted === 'number' ? current.testsCompleted : 0) + delta.testsDelta,
      0,
      10000,
      0
    ),
    videosCompleted: clampInt(
      (typeof current.videosCompleted === 'number' ? current.videosCompleted : 0) + delta.videosDelta,
      0,
      10000,
      0
    ),
    certificatesEarned: clampInt(
      (typeof current.certificatesEarned === 'number' ? current.certificatesEarned : 0) + delta.certificatesDelta,
      0,
      1000,
      0
    ),
  };

  try {
    await updateDoc(ref, {
      totalScore: next.totalScore,
      testsCompleted: next.testsCompleted,
      videosCompleted: next.videosCompleted,
      certificatesEarned: next.certificatesEarned,
      updatedAt: serverTimestamp(),
    });
    return next;
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, privateProfilePath);
  }
}

export async function saveNewLearningPath(
  userId: string,
  params: {
    profile: DiagnosticProfile;
    skillTree: SkillTreeData;
    selectedNodeId: string | null;
    bookmarkedIds: Record<string, boolean>;
    synthesis: VideoSynthesis | null;
    videoTestResults?: VideoTestResult[];
  }
): Promise<string> {
  const pathId = sanitizeId(`path_${Date.now()}`, `path_${Date.now()}`);
  const docPath = `users/${userId}/learningPaths/${pathId}`;

  const pace = VALID_PACES.includes(params.profile.pace) ? params.profile.pace : 'consistent';
  const dailyMinutes = VALID_MINUTES.includes(params.profile.dailyMinutes)
    ? params.profile.dailyMinutes
    : 45;
  const estimatedLevel = VALID_LEVELS.includes(params.profile.estimatedLevel)
    ? params.profile.estimatedLevel
    : 'Beginner';

  const bookmarkedVideoIds = Object.entries(params.bookmarkedIds)
    .filter(([, saved]) => Boolean(saved))
    .map(([id]) => clampString(id, 128))
    .filter(Boolean)
    .slice(0, 50);

  const payload: Record<string, unknown> = {
    id: pathId,
    userId,
    topic: clampString(params.skillTree.topic || params.profile.topic, 120, 'Skill Track') || 'Skill Track',
    goal: clampString(params.profile.goal, 240, 'Master core concepts') || 'Master core concepts',
    pace,
    dailyMinutes,
    estimatedLevel,
    confidenceScore: Math.max(0, Math.min(100, Math.round(params.profile.confidenceScore || 0))),
    strengths: sanitizeStringArray(params.profile.strengths, 12, 120),
    knowledgeGaps: sanitizeStringArray(params.profile.knowledgeGaps, 12, 120),
    selectedNodeId: clampString(params.selectedNodeId || '', 128, ''),
    recommendedNextId: clampString(params.skillTree.recommendedNextId || '', 128, ''),
    nodes: sanitizeNodes(params.skillTree.nodes || []),
    edges: sanitizeEdges(params.skillTree.edges || []),
    studyPlan: sanitizeStudyPlan(params.skillTree.studyPlan),
    bookmarkedVideoIds,
    videoTestResults: sanitizeVideoTestResults(params.videoTestResults),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (params.synthesis) {
    payload.latestSynthesis = sanitizeSynthesis(params.synthesis);
  }

  try {
    await setDoc(doc(db, 'users', userId, 'learningPaths', pathId), payload);
    return pathId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function updateLearningPathProgress(
  userId: string,
  pathId: string,
  nodes: SkillNode[],
  recommendedNextId: string | null,
  selectedNodeId: string | null
): Promise<void> {
  const docPath = `users/${userId}/learningPaths/${pathId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'learningPaths', pathId), {
      nodes: sanitizeNodes(nodes),
      recommendedNextId: clampString(recommendedNextId || '', 128, ''),
      selectedNodeId: clampString(selectedNodeId || '', 128, ''),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function updateLearningPathStudyPlan(
  userId: string,
  pathId: string,
  studyPlan: StudyPlanDay[]
): Promise<void> {
  const docPath = `users/${userId}/learningPaths/${pathId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'learningPaths', pathId), {
      studyPlan: sanitizeStudyPlan(studyPlan),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function updateLearningPathBookmarks(
  userId: string,
  pathId: string,
  bookmarkedIds: Record<string, boolean>
): Promise<void> {
  const docPath = `users/${userId}/learningPaths/${pathId}`;
  const bookmarkedVideoIds = Object.entries(bookmarkedIds)
    .filter(([, saved]) => Boolean(saved))
    .map(([id]) => clampString(id, 128))
    .filter(Boolean)
    .slice(0, 50);

  try {
    await updateDoc(doc(db, 'users', userId, 'learningPaths', pathId), {
      bookmarkedVideoIds,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function updateLearningPathNotes(
  userId: string,
  pathId: string,
  synthesis: VideoSynthesis,
  selectedNodeId: string | null
): Promise<void> {
  const docPath = `users/${userId}/learningPaths/${pathId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'learningPaths', pathId), {
      latestSynthesis: sanitizeSynthesis(synthesis),
      selectedNodeId: clampString(selectedNodeId || '', 128, ''),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function updateLearningPathVideoTests(
  userId: string,
  pathId: string,
  videoTestResults: VideoTestResult[]
): Promise<void> {
  const docPath = `users/${userId}/learningPaths/${pathId}`;
  try {
    await updateDoc(doc(db, 'users', userId, 'learningPaths', pathId), {
      videoTestResults: sanitizeVideoTestResults(videoTestResults),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function saveFinalExamAndCertificate(
  userId: string,
  pathId: string,
  finalExam: FinalExamResult,
  certificate: SkillCertificate | null
): Promise<void> {
  const docPath = `users/${userId}/learningPaths/${pathId}`;
  const updatePayload: Record<string, unknown> = {
    finalExam: sanitizeFinalExam(finalExam),
    updatedAt: serverTimestamp(),
  };
  if (certificate) {
    updatePayload.certificate = sanitizeCertificate(certificate);
  }
  try {
    await updateDoc(doc(db, 'users', userId, 'learningPaths', pathId), updatePayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, docPath);
  }
}

export async function deleteLearningPathDoc(userId: string, pathId: string): Promise<void> {
  const docPath = `users/${userId}/learningPaths/${pathId}`;
  try {
    await deleteDoc(doc(db, 'users', userId, 'learningPaths', pathId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export function subscribeUserLearningPaths(
  userId: string,
  onData: (paths: SavedLearningPath[]) => void,
  onError: (err: Error) => void
): () => void {
  const collectionPath = `users/${userId}/learningPaths`;
  const q = query(
    collection(db, 'users', userId, 'learningPaths'),
    where('userId', '==', userId),
    limit(20)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: SavedLearningPath[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        const updatedAt = d.updatedAt instanceof Timestamp ? d.updatedAt.toMillis() : Date.now();
        const createdAtIso =
          d.createdAt instanceof Timestamp
            ? d.createdAt.toDate().toISOString()
            : new Date().toISOString();

        const topic = typeof d.topic === 'string' ? d.topic : 'Skill Track';
        const profile: DiagnosticProfile = {
          topic,
          goal: typeof d.goal === 'string' ? d.goal : 'Master core concepts',
          pace: VALID_PACES.includes(d.pace) ? d.pace : 'consistent',
          dailyMinutes: VALID_MINUTES.includes(d.dailyMinutes) ? d.dailyMinutes : 45,
          estimatedLevel: VALID_LEVELS.includes(d.estimatedLevel) ? d.estimatedLevel : 'Beginner',
          confidenceScore: typeof d.confidenceScore === 'number' ? d.confidenceScore : 0,
          strengths: Array.isArray(d.strengths) ? d.strengths : [],
          knowledgeGaps: Array.isArray(d.knowledgeGaps) ? d.knowledgeGaps : [],
          readyForSkillTree: true,
          turnCount: 5,
        };

        const skillTree: SkillTreeData = {
          topic,
          generatedAt: createdAtIso,
          nodes: Array.isArray(d.nodes) ? (d.nodes as SkillNode[]) : [],
          edges: Array.isArray(d.edges) ? (d.edges as SkillEdge[]) : [],
          recommendedNextId: typeof d.recommendedNextId === 'string' && d.recommendedNextId ? d.recommendedNextId : null,
          studyPlan: Array.isArray(d.studyPlan) ? (d.studyPlan as StudyPlanDay[]) : [],
        };

        return {
          id: docSnap.id,
          userId: typeof d.userId === 'string' ? d.userId : userId,
          profile,
          skillTree,
          selectedNodeId: typeof d.selectedNodeId === 'string' ? d.selectedNodeId : '',
          bookmarkedVideoIds: Array.isArray(d.bookmarkedVideoIds) ? d.bookmarkedVideoIds : [],
          latestSynthesis: d.latestSynthesis ? (d.latestSynthesis as VideoSynthesis) : null,
          videoTestResults: Array.isArray(d.videoTestResults) ? (d.videoTestResults as VideoTestResult[]) : [],
          finalExam: d.finalExam ? (d.finalExam as FinalExamResult) : null,
          certificate: d.certificate ? (d.certificate as SkillCertificate) : null,
          updatedAtMs: updatedAt,
        };
      });

      items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, collectionPath);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}
