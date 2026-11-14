import type { IncomingMessage, ServerResponse } from 'node:http';
import { GoogleGenAI, Type } from '@google/genai';

const MODEL_NAME = 'gemini-4-hydrogen';
const MAX_JSON_BODY_BYTES = 2 * 1024 * 1024;

export type ApiRequest = IncomingMessage & {
  body?: unknown;
  originalUrl?: string;
};

export const API_ROUTES = [
  '/api/health',
  '/api/diagnostic/turn',
  '/api/skill-tree/generate',
  '/api/skill-tree/quiz',
  '/api/skill-tree/evaluate',
  '/api/videos/search',
  '/api/videos/summarize',
  '/api/videos/quiz',
  '/api/videos/evaluate',
  '/api/skill-tree/final-exam/generate',
  '/api/skill-tree/final-exam/evaluate',
  '/api/skill-tree/projects/generate',
  '/api/skill-tree/projects/evaluate',
] as const;

class HttpPayloadError extends Error {
  statusCode: number;
  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

function sendJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  if (res.writableEnded || res.headersSent) return;
  const json = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(json);
}

async function readJsonBody<T extends Record<string, unknown>>(req: ApiRequest): Promise<Partial<T>> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      return Array.isArray(req.body) ? {} : (req.body as Partial<T>);
    }
    const rawFromPreparsed = Buffer.isBuffer(req.body)
      ? req.body.toString('utf8')
      : String(req.body);
    const trimmed = rawFromPreparsed.trim();
    if (!trimmed) return {};
    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Partial<T>)
        : {};
    } catch {
      throw new HttpPayloadError(400, 'Invalid JSON request body.');
    }
  }

  if (req.readableEnded) {
    return {};
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buf.length;
    if (totalBytes > MAX_JSON_BODY_BYTES) {
      throw new HttpPayloadError(413, 'Request body exceeds 2MB limit.');
    }
    chunks.push(buf);
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Partial<T>)
      : {};
  } catch {
    throw new HttpPayloadError(400, 'Invalid JSON request body.');
  }
}

function normalizePathname(rawUrl: string | undefined): string {
  const safeUrl = rawUrl || '/api';
  let pathname = '/api';
  try {
    const parsed = new URL(safeUrl, 'http://localhost');
    pathname = parsed.pathname;
  } catch {
    pathname = safeUrl.split('?')[0] || '/api';
  }

  pathname = pathname.replace(/\/+$/, '') || '/';
  if (pathname === '/') return '/api';
  if (!pathname.startsWith('/api')) {
    return `/api${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
  }
  return pathname;
}

function handleGeminiError(res: ServerResponse, error: unknown, fallbackMessage: string): void {
  console.error('Gemini API error:', error);
  if (error instanceof HttpPayloadError) {
    sendJson(res, error.statusCode, { error: error.message });
    return;
  }

  const rawMessage = error instanceof Error ? error.message : String(error ?? '');
  if (rawMessage.includes('GEMINI_API_KEY is not configured')) {
    sendJson(res, 503, {
      error: 'Server AI configuration is missing GEMINI_API_KEY.',
      code: 'MISSING_API_KEY',
    });
    return;
  }

  const statusMatch = rawMessage.match(/"code"\s*:\s*(\d{3})/);
  const statusCode =
    (error as { status?: number })?.status ||
    (statusMatch ? Number(statusMatch[1]) : 500);

  if (
    statusCode === 402 ||
    rawMessage.includes('prepayment credits are depleted') ||
    (statusCode === 429 && rawMessage.includes('RESOURCE_EXHAUSTED')) ||
    rawMessage.includes('RESOURCE_EXHAUSTED')
  ) {
    sendJson(res, statusCode === 402 ? 402 : 429, {
      error:
        'Your AI service credits or quota are currently depleted. Top up billing or try Demo Mode.',
      code: 'RESOURCE_EXHAUSTED',
    });
    return;
  }

  if (
    statusCode === 403 ||
    rawMessage.includes('PERMISSION_DENIED') ||
    rawMessage.includes('API_KEY_INVALID')
  ) {
    sendJson(res, 403, {
      error: 'The AI service API key is missing permissions or invalid.',
      code: 'API_KEY_ERROR',
    });
    return;
  }

  if (statusCode === 404 || rawMessage.includes('NOT_FOUND')) {
    sendJson(res, 502, {
      error: 'The configured AI model is currently unavailable.',
      code: 'MODEL_NOT_FOUND',
    });
    return;
  }

  sendJson(res, 500, {
    error: fallbackMessage,
  });
}

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function safeJsonParse<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    return JSON.parse(cleaned) as T;
  } catch {
    return fallback;
  }
}

function cleanDisplayText(raw: string | undefined): string {
  if (!raw) return '';
  return raw
    .replace(/\s*&\s*/g, ' and ')
    .replace(/[*^$#@]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function cleanDisplayList(list: string[] | undefined, max: number): string[] {
  if (!Array.isArray(list)) return [];
  return list
    .slice(0, max)
    .map((item) => cleanDisplayText(item))
    .filter(Boolean);
}

function sanitizeMermaidFlowchart(raw: string): string {
  let code = (raw || '')
    .replace(/^```mermaid\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  if (!/^(flowchart|graph)\s+(TD|TB|LR|RL|BT)/i.test(code)) {
    code = `flowchart TD\n${code}`;
  }

  return code;
}

function extractYouTubeId(input: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = input.match(p);
    if (m && m[1]) return m[1];
  }
  return null;
}

async function fetchYoutubeOEmbed(
  videoId: string
): Promise<{ title: string; author_name: string; thumbnail_url: string } | null> {
  try {
    const target = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(target)}&format=json`,
      { signal: AbortSignal.timeout(4500) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      title?: string;
      author_name?: string;
      thumbnail_url?: string;
    };
    if (!data.title) return null;
    return {
      title: data.title,
      author_name: data.author_name || 'YouTube Educator',
      thumbnail_url: data.thumbnail_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  } catch {
    return null;
  }
}

async function handleDiagnosticTurn(req: ApiRequest, res: ServerResponse): Promise<void> {
  try {
    const {
      topic = '',
      goal = '',
      history = [],
      userMessage = '',
      currentProfile,
    } = await readJsonBody<{
      topic: string;
      goal?: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      userMessage?: string;
      currentProfile?: {
        estimatedLevel?: string;
        confidenceScore?: number;
        strengths?: string[];
        knowledgeGaps?: string[];
        turnCount?: number;
      };
    }>(req);

    if (!topic || !topic.trim()) {
      sendJson(res, 400, { error: 'Topic is required to start diagnostic calibration.' });
      return;
    }

    const ai = getAiClient();
    const isInitial = !userMessage.trim() && history.length === 0;
    const nextTurnCount = isInitial ? 0 : (currentProfile?.turnCount ?? 0) + 1;

    const conversationText = history
      .map((m) => `${m.role === 'user' ? 'Learner' : 'Diagnostician'}: ${m.content}`)
      .join('\n');

    const prompt = isInitial
      ? `Start a Socratic diagnostic assessment for a learner studying "${topic}"${goal ? ` with the goal: "${goal}"` : ''}.
Greet them briefly in 1 sentence, then ask ONE crisp, concrete diagnostic question to gauge their foundational mental model.
Provide 3 short suggested reply options ranging from beginner ("I'm new to this...") to intermediate/advanced explanations so the learner can respond quickly or write their own answer.`
      : `Topic: "${topic}"${goal ? `\nGoal: "${goal}"` : ''}
Current profile:
- Estimated level: ${currentProfile?.estimatedLevel || 'Unassessed'}
- Strengths so far: ${(currentProfile?.strengths || []).join(', ') || 'None yet'}
- Knowledge gaps so far: ${(currentProfile?.knowledgeGaps || []).join(', ') || 'None yet'}
- Completed diagnostic turns: ${nextTurnCount}

Conversation so far:
${conversationText}
Learner's latest response: "${userMessage}"

Evaluate the learner's latest response accurately:
1. Assess whether they demonstrated strong understanding, partial understanding, or a conceptual gap.
2. Update strengths and knowledgeGaps cleanly (concise 2-5 word concept labels, max 5 items each).
3. Update estimatedLevel ("Beginner", "Intermediate", or "Advanced") and confidenceScore (15 to 95).
4. Set readyForSkillTree to true once at least 2 meaningful learner turns have been evaluated (nextTurnCount >= 2).
5. Give brief, encouraging, precise feedback (1-2 sentences) on their answer, and ask ONE next targeted probing question on an adjacent or deeper concept (unless readyForSkillTree is true and 4+ turns have elapsed, in which case invite them to generate their Skill Tree or keep probing).
6. Provide 3 concise suggestedReplies for the next question.`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction:
          'You are an expert adaptive curriculum diagnostician. Ask one sharp conceptual question at a time. Never lecture at length during diagnosis; calibrate the learner efficiently and honestly. Use plain clean prose and never include the characters *, &, ^, $, #, or @ in your text.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING, description: 'Concise response + single probing question.' },
            suggestedReplies: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 realistic sample replies at varying mastery levels.',
            },
            assessment: {
              type: Type.OBJECT,
              properties: {
                conceptChecked: { type: Type.STRING },
                verdict: { type: Type.STRING, description: 'One of: initial, strong, partial, gap' },
                note: { type: Type.STRING },
              },
              required: ['conceptChecked', 'verdict', 'note'],
            },
            updatedProfile: {
              type: Type.OBJECT,
              properties: {
                estimatedLevel: { type: Type.STRING, description: 'Beginner, Intermediate, or Advanced' },
                confidenceScore: { type: Type.INTEGER },
                strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                knowledgeGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
                readyForSkillTree: { type: Type.BOOLEAN },
              },
              required: ['estimatedLevel', 'confidenceScore', 'strengths', 'knowledgeGaps', 'readyForSkillTree'],
            },
          },
          required: ['reply', 'suggestedReplies', 'assessment', 'updatedProfile'],
        },
      },
    });

    const parsed = safeJsonParse<{
      reply: string;
      suggestedReplies: string[];
      assessment: { conceptChecked: string; verdict: 'initial' | 'strong' | 'partial' | 'gap'; note: string };
      updatedProfile: {
        estimatedLevel: 'Beginner' | 'Intermediate' | 'Advanced';
        confidenceScore: number;
        strengths: string[];
        knowledgeGaps: string[];
        readyForSkillTree: boolean;
      };
    } | null>(response.text, null);

    if (!parsed) {
      sendJson(res, 502, { error: 'Failed to parse diagnostic response from AI service.' });
      return;
    }

    const validVerdicts = new Set(['initial', 'strong', 'partial', 'gap']);
    const verdict = validVerdicts.has(parsed.assessment.verdict)
      ? parsed.assessment.verdict
      : isInitial
      ? 'initial'
      : 'partial';

    sendJson(res, 200, {
      reply: cleanDisplayText(parsed.reply),
      suggestedReplies: cleanDisplayList(parsed.suggestedReplies, 3),
      assessment: {
        conceptChecked: cleanDisplayText(parsed.assessment.conceptChecked),
        note: cleanDisplayText(parsed.assessment.note),
        verdict,
      },
      updatedProfile: {
        topic: cleanDisplayText(topic),
        goal: cleanDisplayText(goal || ''),
        estimatedLevel: parsed.updatedProfile.estimatedLevel || 'Beginner',
        confidenceScore: Math.min(100, Math.max(0, Number(parsed.updatedProfile.confidenceScore) || 25)),
        strengths: cleanDisplayList(parsed.updatedProfile.strengths, 6),
        knowledgeGaps: cleanDisplayList(parsed.updatedProfile.knowledgeGaps, 6),
        readyForSkillTree: Boolean(parsed.updatedProfile.readyForSkillTree || nextTurnCount >= 2),
        turnCount: nextTurnCount,
      },
    });
  } catch (error) {
    handleGeminiError(res, error, 'Diagnostic service error.');
  }
}

async function handleSkillTreeGenerate(req: ApiRequest, res: ServerResponse): Promise<void> {
  try {
    const {
      topic = '',
      goal = '',
      pace = 'consistent',
      dailyMinutes = 45,
      profile,
      history = [],
    } = await readJsonBody<{
      topic: string;
      goal?: string;
      pace?: string;
      dailyMinutes?: number;
      profile?: {
        estimatedLevel?: string;
        strengths?: string[];
        knowledgeGaps?: string[];
      };
      history?: Array<{ role: string; content: string }>;
    }>(req);

    if (!topic || !topic.trim()) {
      sendJson(res, 400, { error: 'Topic is required to generate a skill tree.' });
      return;
    }

    const ai = getAiClient();
    const transcript = history
      .slice(-8)
      .map((m) => `${m.role}: ${m.content}`)
      .join('\n');

    const prompt = `Build an adaptive learning Skill Tree (Directed Acyclic Graph) AND a 7-day momentum study plan for:
Topic: "${topic}"
${goal ? `Goal: "${goal}"` : ''}
Preferred Pace: ${pace} (${dailyMinutes} min/day)
Estimated Level: ${profile?.estimatedLevel || 'Beginner'}
Verified Strengths: ${(profile?.strengths || []).join(', ') || 'None specified'}
Identified Knowledge Gaps: ${(profile?.knowledgeGaps || []).join(', ') || 'General foundations'}
Diagnostic Excerpt:
${transcript || 'Direct generation requested.'}

Design 8 tightly scoped skill nodes organized across 4 progressive tiers (tier 1 = Foundations, tier 2 = Core Mechanics, tier 3 = Applied Architecture, tier 4 = Synthesis and Mastery).
Rules:
- Use short, valid IDs like "n1", "n2", ..., "n8".
- Every prerequisite edge MUST point strictly from a lower tier to a higher tier (so the graph is strictly acyclic).
- Tier 1 nodes have prerequisites: [].
- Tier 2-4 nodes each list 1 or 2 prerequisite IDs from earlier tiers.
- Set status thoughtfully based on the diagnostic profile:
  * "mastered" for Tier 1 concepts clearly covered in Verified Strengths.
  * "needs_review" for concepts matching Identified Knowledge Gaps whose prerequisites are met.
  * "ready" for the ideal immediate next step(s) where prerequisites are mastered or Tier 1.
  * "locked" for advanced Tier 3-4 nodes whose prerequisites are not yet mastered.
- Ensure at least 2 nodes are immediately actionable ("ready" or "needs_review").
- Include difficulty ("Beginner", "Intermediate", or "Advanced"), whyItMatters (1 crisp sentence), keyConcepts (2-4 short keywords), commonMistakes (1-2 items), practiceTask (1 concrete hands-on exercise), learningObjectives (2-3 items), diagnosticRationale, estimatedMinutes (15-60), and a focused youtubeSearchQuery.
- Also generate a 7-item studyPlan (days 1..7) referencing node IDs, tailored to ${dailyMinutes} min/day.
- Never use the characters *, &, ^, $, #, or @ in any titles, summaries, objectives, or tasks; write "and" instead of "&".`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction:
          'You are a curriculum architect generating structured acyclic skill dependency graphs and 7-day momentum plans tailored to a learner diagnostic. Never output *, &, ^, $, #, or @ in text.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nodes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  tier: { type: Type.INTEGER },
                  difficulty: { type: Type.STRING, description: 'Beginner, Intermediate, or Advanced' },
                  status: { type: Type.STRING, description: 'mastered, ready, needs_review, or locked' },
                  estimatedMinutes: { type: Type.INTEGER },
                  prerequisites: { type: Type.ARRAY, items: { type: Type.STRING } },
                  learningObjectives: { type: Type.ARRAY, items: { type: Type.STRING } },
                  whyItMatters: { type: Type.STRING },
                  keyConcepts: { type: Type.ARRAY, items: { type: Type.STRING } },
                  commonMistakes: { type: Type.ARRAY, items: { type: Type.STRING } },
                  practiceTask: { type: Type.STRING },
                  diagnosticRationale: { type: Type.STRING },
                  youtubeSearchQuery: { type: Type.STRING },
                },
                required: [
                  'id',
                  'title',
                  'summary',
                  'tier',
                  'difficulty',
                  'status',
                  'estimatedMinutes',
                  'prerequisites',
                  'learningObjectives',
                  'whyItMatters',
                  'keyConcepts',
                  'commonMistakes',
                  'practiceTask',
                  'diagnosticRationale',
                  'youtubeSearchQuery',
                ],
              },
            },
            recommendedNextId: { type: Type.STRING },
            studyPlan: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  day: { type: Type.INTEGER },
                  moduleId: { type: Type.STRING },
                  taskTitle: { type: Type.STRING },
                  estimatedMinutes: { type: Type.INTEGER },
                  motivation: { type: Type.STRING },
                },
                required: ['day', 'moduleId', 'taskTitle', 'estimatedMinutes', 'motivation'],
              },
            },
          },
          required: ['nodes', 'recommendedNextId', 'studyPlan'],
        },
      },
    });

    const parsed = safeJsonParse<{
      nodes: Array<{
        id: string;
        title: string;
        summary: string;
        tier: number;
        difficulty?: string;
        status: string;
        estimatedMinutes: number;
        prerequisites: string[];
        learningObjectives: string[];
        whyItMatters?: string;
        keyConcepts?: string[];
        commonMistakes?: string[];
        practiceTask?: string;
        diagnosticRationale: string;
        youtubeSearchQuery: string;
      }>;
      recommendedNextId?: string;
      studyPlan?: Array<{
        day: number;
        moduleId: string;
        taskTitle: string;
        estimatedMinutes: number;
        motivation: string;
      }>;
    } | null>(response.text, null);

    if (!parsed || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
      sendJson(res, 502, { error: 'Failed to generate valid skill tree structure.' });
      return;
    }

    const validStatuses = new Set(['mastered', 'ready', 'needs_review', 'locked']);
    const nodeMap = new Map(parsed.nodes.map((n) => [n.id, n]));

    const normalizedNodes = parsed.nodes.map((n) => {
      const tier = Math.min(4, Math.max(1, Number(n.tier) || 1));
      const prereqs = (n.prerequisites || []).filter((pid) => {
        const p = nodeMap.get(pid);
        return p && (Number(p.tier) || 1) < tier && pid !== n.id;
      });
      const status = validStatuses.has(n.status) ? n.status : tier === 1 ? 'ready' : 'locked';
      return {
        ...n,
        title: cleanDisplayText(n.title),
        summary: cleanDisplayText(n.summary),
        whyItMatters: cleanDisplayText(n.whyItMatters),
        keyConcepts: cleanDisplayList(n.keyConcepts, 4),
        commonMistakes: cleanDisplayList(n.commonMistakes, 3),
        practiceTask: cleanDisplayText(n.practiceTask),
        diagnosticRationale: cleanDisplayText(n.diagnosticRationale),
        youtubeSearchQuery: cleanDisplayText(n.youtubeSearchQuery),
        tier,
        prerequisites: prereqs,
        status: status as 'mastered' | 'ready' | 'needs_review' | 'locked',
        estimatedMinutes: Math.max(5, Math.min(90, Number(n.estimatedMinutes) || 20)),
        learningObjectives: cleanDisplayList(n.learningObjectives, 4),
      };
    });

    const hasActionable = normalizedNodes.some((n) => n.status === 'ready' || n.status === 'needs_review');
    if (!hasActionable && normalizedNodes.length > 0) {
      const firstUnmastered = normalizedNodes.find((n) => n.status !== 'mastered') || normalizedNodes[0];
      firstUnmastered.status = 'ready';
    }

    const edges = normalizedNodes.flatMap((n) =>
      n.prerequisites.map((source) => ({
        source,
        target: n.id,
      }))
    );

    const recommendedNode =
      normalizedNodes.find((n) => n.id === parsed.recommendedNextId) ||
      normalizedNodes.find((n) => n.status === 'needs_review') ||
      normalizedNodes.find((n) => n.status === 'ready') ||
      normalizedNodes[0];

    const normalizedPlan = (parsed.studyPlan || []).slice(0, 7).map((item, idx) => ({
      day: idx + 1,
      dateLabel: idx === 0 ? 'Day 1 · Today' : `Day ${idx + 1}`,
      moduleId: item.moduleId || normalizedNodes[idx % normalizedNodes.length]?.id || 'n1',
      taskTitle: cleanDisplayText(item.taskTitle),
      estimatedMinutes: Math.max(15, Math.min(120, Number(item.estimatedMinutes) || dailyMinutes)),
      motivation: cleanDisplayText(item.motivation),
      completed: false,
    }));

    sendJson(res, 200, {
      topic: cleanDisplayText(topic),
      generatedAt: new Date().toISOString(),
      nodes: normalizedNodes,
      edges,
      recommendedNextId: recommendedNode?.id ?? null,
      studyPlan: normalizedPlan,
    });
  } catch (error) {
    handleGeminiError(res, error, 'Failed to generate skill tree.');
  }
}

async function handleSkillTreeQuiz(req: ApiRequest, res: ServerResponse): Promise<void> {
  try {
    const { topic = '', node } = await readJsonBody<{
      topic: string;
      node: { id?: string; title?: string; summary?: string; learningObjectives?: string[] };
    }>(req);

    if (!node?.title) {
      sendJson(res, 400, { error: 'Skill node is required.' });
      return;
    }

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Topic: "${topic}"
Skill Node: "${node.title}" — ${node.summary || ''}
Objectives: ${(node.learningObjectives || []).join('; ')}

Create ONE applied conceptual check question (not trivial trivia) to verify the learner understands this skill. Provide 4 concise, plausible multiple-choice options and a 1-sentence hint. Never use *, &, ^, $, #, or @ characters.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            hint: { type: Type.STRING },
          },
          required: ['question', 'options', 'hint'],
        },
      },
    });

    const parsed = safeJsonParse<{ question: string; options: string[]; hint: string } | null>(
      response.text,
      null
    );
    if (!parsed) {
      sendJson(res, 502, { error: 'Could not generate mastery question.' });
      return;
    }

    sendJson(res, 200, {
      nodeId: node.id || 'n1',
      question: cleanDisplayText(parsed.question),
      options: cleanDisplayList(parsed.options, 4),
      hint: cleanDisplayText(parsed.hint),
    });
  } catch (error) {
    handleGeminiError(res, error, 'Quiz generation error.');
  }
}

async function handleSkillTreeEvaluate(req: ApiRequest, res: ServerResponse): Promise<void> {
  try {
    const { topic = '', node, question = '', userAnswer = '' } = await readJsonBody<{
      topic: string;
      node: { title?: string; summary?: string };
      question: string;
      userAnswer: string;
    }>(req);

    if (!question || !userAnswer?.trim()) {
      sendJson(res, 400, { error: 'Question and answer are required.' });
      return;
    }

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Topic: "${topic}"
Skill: "${node?.title || topic}" (${node?.summary || ''})
Question: "${question}"
Learner's Answer: "${userAnswer}"

Determine if the learner's answer demonstrates accurate conceptual mastery (passed: true/false) and provide crisp 1-2 sentence pedagogical feedback explaining why. Never use *, &, ^, $, #, or @ characters.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            passed: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING },
          },
          required: ['passed', 'feedback'],
        },
      },
    });

    const parsed = safeJsonParse<{ passed: boolean; feedback: string } | null>(response.text, null);
    if (!parsed) {
      sendJson(res, 502, { error: 'Failed to evaluate mastery response.' });
      return;
    }
    sendJson(res, 200, {
      passed: Boolean(parsed.passed),
      feedback: cleanDisplayText(parsed.feedback),
    });
  } catch (error) {
    handleGeminiError(res, error, 'Evaluation error.');
  }
}

async function handleVideosSearch(req: ApiRequest, res: ServerResponse): Promise<void> {
  try {
    const { query = '', skillTitle = '', topic = '' } = await readJsonBody<{
      query: string;
      skillTitle?: string;
      topic?: string;
    }>(req);

    const rawBase = (query || `${topic} ${skillTitle}`).trim();
    if (!rawBase) {
      sendJson(res, 400, { error: 'Search query or YouTube URL is required.' });
      return;
    }
    const searchTerm = query.trim() ? query.trim() : `${rawBase} tutorial`;

    const directId = extractYouTubeId(searchTerm);
    if (directId) {
      const meta = await fetchYoutubeOEmbed(directId);
      sendJson(res, 200, {
        videos: [
          {
            videoId: directId,
            title: cleanDisplayText(meta?.title) || `YouTube Study Video (${directId})`,
            channelTitle: cleanDisplayText(meta?.author_name) || 'YouTube Creator',
            publishedAt: 'Direct Link',
            description: cleanDisplayText(`Direct video loaded for ${skillTitle || topic || 'study'}.`),
            thumbnailUrl: meta?.thumbnail_url || `https://i.ytimg.com/vi/${directId}/hqdefault.jpg`,
            url: `https://www.youtube.com/watch?v=${directId}`,
            source: 'direct_url',
          },
        ],
        provider: 'direct_url',
      });
      return;
    }

    const youtubeApiKey = process.env.YOUTUBE_API_KEY;
    if (youtubeApiKey) {
      const ytUrl = new URL('https://www.googleapis.com/youtube/v3/search');
      ytUrl.searchParams.set('part', 'snippet');
      ytUrl.searchParams.set('type', 'video');
      ytUrl.searchParams.set('videoEmbeddable', 'true');
      ytUrl.searchParams.set('maxResults', '6');
      ytUrl.searchParams.set('q', searchTerm);
      ytUrl.searchParams.set('key', youtubeApiKey);

      const ytRes = await fetch(ytUrl.toString(), { signal: AbortSignal.timeout(7000) });
      if (ytRes.ok) {
        const ytData = (await ytRes.json()) as {
          items?: Array<{
            id?: { videoId?: string };
            snippet?: {
              title?: string;
              channelTitle?: string;
              publishedAt?: string;
              description?: string;
              thumbnails?: { high?: { url?: string }; medium?: { url?: string } };
            };
          }>;
        };

        const videos = (ytData.items || [])
          .filter((item) => item.id?.videoId)
          .map((item) => {
            const videoId = item.id!.videoId!;
            return {
              videoId,
              title: cleanDisplayText(item.snippet?.title) || 'Untitled Video',
              channelTitle: cleanDisplayText(item.snippet?.channelTitle) || 'YouTube',
              publishedAt: item.snippet?.publishedAt ? item.snippet.publishedAt.slice(0, 10) : 'YouTube',
              description: cleanDisplayText(item.snippet?.description),
              thumbnailUrl:
                item.snippet?.thumbnails?.high?.url ||
                item.snippet?.thumbnails?.medium?.url ||
                `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
              url: `https://www.youtube.com/watch?v=${videoId}`,
              source: 'youtube_api' as const,
            };
          });

        if (videos.length > 0) {
          sendJson(res, 200, { videos, provider: 'youtube_data_api_v3' });
          return;
        }
      }
    }

    const ai = getAiClient();
    const groundedResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Find 6 high-quality educational YouTube videos for learning "${searchTerm}".
Return exact https://www.youtube.com/watch?v=... URLs with video titles and channel names.`,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const candidateIds = new Set<string>();
    const chunks = groundedResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    for (const chunk of chunks) {
      const uri = (chunk as { web?: { uri?: string } }).web?.uri;
      if (uri) {
        const id = extractYouTubeId(uri);
        if (id) candidateIds.add(id);
      }
    }

    const textMatches = (groundedResponse.text || '').matchAll(
      /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/g
    );
    for (const m of textMatches) {
      if (m[1]) candidateIds.add(m[1]);
    }

    const idList = Array.from(candidateIds).slice(0, 8);
    const verified = await Promise.all(
      idList.map(async (videoId) => {
        const meta = await fetchYoutubeOEmbed(videoId);
        if (!meta) return null;
        return {
          videoId,
          title: cleanDisplayText(meta.title) || 'YouTube Study Video',
          channelTitle: cleanDisplayText(meta.author_name) || 'YouTube',
          publishedAt: 'Verified YouTube',
          description: cleanDisplayText(`Educational video covering ${skillTitle || searchTerm}.`),
          thumbnailUrl: meta.thumbnail_url,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          source: 'gemini_search' as const,
        };
      })
    );

    const videos = verified.filter((v): v is NonNullable<typeof v> => v !== null).slice(0, 6);
    sendJson(res, 200, {
      videos,
      provider: 'gemini_search_grounding',
    });
  } catch (error) {
    handleGeminiError(res, error, 'Video search failed.');
  }
}

async function handleVideosSummarize(req: ApiRequest, res: ServerResponse): Promise<void> {
  try {
    const {
      videoId = '',
      videoTitle = '',
      channelTitle = '',
      topic = '',
      skillTitle = '',
      userNotesOrTranscript = '',
    } = await readJsonBody<{
      videoId: string;
      videoTitle: string;
      channelTitle?: string;
      topic?: string;
      skillTitle?: string;
      userNotesOrTranscript?: string;
    }>(req);

    if (!videoId || !videoTitle) {
      sendJson(res, 400, { error: 'videoId and videoTitle are required.' });
      return;
    }

    const ai = getAiClient();
    const prompt = `Synthesize structured study notes and a Mermaid flowchart for this educational video:
Video Title: "${videoTitle}"
Channel: "${channelTitle}"
YouTube URL: https://www.youtube.com/watch?v=${videoId}
Learning Topic: "${topic}"
Target Skill Node: "${skillTitle}"
${
  userNotesOrTranscript.trim()
    ? `Learner's Transcript / Notes / Focus Prompts:\n"""\n${userNotesOrTranscript.trim()}\n"""`
    : 'No transcript pasted yet — synthesize a rigorous conceptual breakdown, structured study notes, and architectural/process flowchart aligned with the video title and target skill.'
}

Requirements for mermaidFlowchart:
- Must be valid Mermaid v11 syntax starting with "flowchart TD".
- Use 6 to 10 clear nodes (IDs A, B, C...) with quoted labels like A["Core Concept"] --> B["Mechanism"].
- Avoid raw parentheses (), colons :, or curly braces inside unquoted node labels — always wrap labels in double quotes inside square brackets: A["Label text"].
- Represent the actual causal/architectural flow of the concept, including at least one decision diamond {"Condition?"}.
- Never include *, &, ^, $, #, or @ characters anywhere in notes, takeaways, or node labels; write "and" instead of "&".`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        systemInstruction:
          'You are an academic synthesizer creating crisp, high-signal study notes and syntactically valid Mermaid flowcharts. Never include *, &, ^, $, #, or @ characters in your text.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            executiveSummary: { type: Type.STRING },
            keyTakeaways: { type: Type.ARRAY, items: { type: Type.STRING } },
            structuredNotes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  heading: { type: Type.STRING },
                  timestampHint: { type: Type.STRING },
                  bullets: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['heading', 'timestampHint', 'bullets'],
              },
            },
            mermaidFlowchart: { type: Type.STRING },
            studyChecklist: { type: Type.ARRAY, items: { type: Type.STRING } },
            commonMistakes: { type: Type.ARRAY, items: { type: Type.STRING } },
            practiceTask: { type: Type.STRING },
          },
          required: [
            'executiveSummary',
            'keyTakeaways',
            'structuredNotes',
            'mermaidFlowchart',
            'studyChecklist',
            'commonMistakes',
            'practiceTask',
          ],
        },
      },
    });

    const parsed = safeJsonParse<{
      executiveSummary: string;
      keyTakeaways: string[];
      structuredNotes: Array<{ heading: string; timestampHint: string; bullets: string[] }>;
      mermaidFlowchart: string;
      studyChecklist: string[];
      commonMistakes?: string[];
      practiceTask?: string;
    } | null>(response.text, null);

    if (!parsed) {
      sendJson(res, 502, { error: 'Failed to synthesize video notes.' });
      return;
    }

    sendJson(res, 200, {
      videoId,
      videoTitle: cleanDisplayText(videoTitle),
      executiveSummary: cleanDisplayText(parsed.executiveSummary),
      keyTakeaways: cleanDisplayList(parsed.keyTakeaways, 6),
      structuredNotes: (parsed.structuredNotes || []).slice(0, 5).map((s) => ({
        heading: cleanDisplayText(s.heading),
        timestampHint: cleanDisplayText(s.timestampHint),
        bullets: cleanDisplayList(s.bullets, 6),
      })),
      mermaidFlowchart: cleanDisplayText(sanitizeMermaidFlowchart(parsed.mermaidFlowchart)),
      studyChecklist: cleanDisplayList(parsed.studyChecklist, 5),
      commonMistakes: cleanDisplayList(parsed.commonMistakes, 3),
      practiceTask: cleanDisplayText(parsed.practiceTask),
    });
  } catch (error) {
    handleGeminiError(res, error, 'Summarization error.');
  }
}

async function handleVideosQuiz(req: ApiRequest, res: ServerResponse): Promise<void> {
  try {
    const {
      videoId = '',
      videoTitle = '',
      channelTitle = '',
      topic = '',
      skillTitle = '',
      learningObjectives = [],
      synthesisSummary = '',
    } = await readJsonBody<{
      videoId: string;
      videoTitle: string;
      channelTitle?: string;
      topic?: string;
      skillTitle?: string;
      learningObjectives?: string[];
      synthesisSummary?: string;
    }>(req);

    if (!videoId || !videoTitle) {
      sendJson(res, 400, { error: 'videoId and videoTitle are required.' });
      return;
    }

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Create a 3-question post-video mastery test for a learner who just completed this educational video:
Video Title: "${videoTitle}"
Channel: "${channelTitle}"
Skill Topic: "${topic}"
Module: "${skillTitle}"
Learning Objectives: ${learningObjectives.join('; ') || 'Core concepts covered in this video'}
${synthesisSummary ? `Summary Context: ${synthesisSummary}` : ''}

Requirements:
- Generate 3 distinct, practical questions (IDs "q1", "q2", "q3") testing comprehension and real-world application of the video.
- Each question must include 4 plausible multiple-choice options and a concise 2-4 word conceptTag.
- Never include *, &, ^, $, #, or @ characters anywhere; write "and" instead of "&".`,
      config: {
        systemInstruction:
          'You are an educational assessment designer creating concise post-video comprehension checks. Never output *, &, ^, $, #, or @ characters.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  prompt: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  conceptTag: { type: Type.STRING },
                },
                required: ['id', 'prompt', 'options', 'conceptTag'],
              },
            },
          },
          required: ['questions'],
        },
      },
    });

    const parsed = safeJsonParse<{
      questions: Array<{ id: string; prompt: string; options: string[]; conceptTag: string }>;
    } | null>(response.text, null);

    if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      sendJson(res, 502, { error: 'Could not generate post-video test questions.' });
      return;
    }

    sendJson(res, 200, {
      videoId,
      questions: parsed.questions.slice(0, 3).map((q, idx) => ({
        id: cleanDisplayText(q.id) || `q${idx + 1}`,
        prompt: cleanDisplayText(q.prompt),
        options: cleanDisplayList(q.options, 4),
        conceptTag: cleanDisplayText(q.conceptTag) || 'Concept Check',
      })),
    });
  } catch (error) {
    handleGeminiError(res, error, 'Post-video quiz generation error.');
  }
}

async function handleVideosEvaluate(req: ApiRequest, res: ServerResponse): Promise<void> {
  try {
    const {
      videoId = '',
      videoTitle = '',
      topic = '',
      skillTitle = '',
      questions = [],
      userAnswers = [],
    } = await readJsonBody<{
      videoId: string;
      videoTitle: string;
      topic?: string;
      skillTitle?: string;
      questions: Array<{ id: string; prompt: string; options?: string[] }>;
      userAnswers: Array<{ questionId: string; answer: string }>;
    }>(req);

    if (!videoId || !Array.isArray(questions) || questions.length === 0) {
      sendJson(res, 400, { error: 'Questions and learner answers are required.' });
      return;
    }

    const answerMap = new Map(userAnswers.map((a) => [a.questionId, a.answer]));
    const qaText = questions
      .map(
        (q, idx) =>
          `Question ${idx + 1} (${q.id}): ${q.prompt}\nLearner Answer: ${
            answerMap.get(q.id) || 'No answer provided'
          }`
      )
      .join('\n\n');

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Grade this post-video comprehension test accurately and fairly:
Topic: "${topic}"
Module: "${skillTitle}"
Video: "${videoTitle}"

${qaText}

Grading rules:
- Evaluate each question carefully (correct: true/false) with a 1-sentence pedagogical explanation.
- Compute score as an integer from 0 to 100 reflecting overall accuracy.
- Set passed to true when score is 60 or higher.
- Provide concise overall feedback (2 sentences max).
- Never include *, &, ^, $, #, or @ characters; write "and" instead of "&".`,
      config: {
        systemInstruction:
          'You are a fair, accurate academic grader evaluating post-video test answers. Never output *, &, ^, $, #, or @ characters.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER },
            passed: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING },
            questionResults: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  questionId: { type: Type.STRING },
                  correct: { type: Type.BOOLEAN },
                  feedback: { type: Type.STRING },
                },
                required: ['questionId', 'correct', 'feedback'],
              },
            },
          },
          required: ['score', 'passed', 'feedback', 'questionResults'],
        },
      },
    });

    const parsed = safeJsonParse<{
      score: number;
      passed: boolean;
      feedback: string;
      questionResults: Array<{ questionId: string; correct: boolean; feedback: string }>;
    } | null>(response.text, null);

    if (!parsed) {
      sendJson(res, 502, { error: 'Failed to score post-video test.' });
      return;
    }

    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
    const passed = score >= 60;
    const pointsAwarded = passed ? score + (score >= 85 ? 25 : 10) : Math.max(10, Math.round(score * 0.4));

    sendJson(res, 200, {
      score,
      passed,
      pointsAwarded,
      feedback: cleanDisplayText(parsed.feedback),
      questionResults: (parsed.questionResults || []).slice(0, 5).map((qr, idx) => ({
        questionId: cleanDisplayText(qr.questionId) || questions[idx]?.id || `q${idx + 1}`,
        correct: Boolean(qr.correct),
        feedback: cleanDisplayText(qr.feedback),
      })),
    });
  } catch (error) {
    handleGeminiError(res, error, 'Post-video scoring error.');
  }
}

async function handleFinalExamGenerate(req: ApiRequest, res: ServerResponse): Promise<void> {
  try {
    const {
      topic = '',
      goal = '',
      estimatedLevel = 'Intermediate',
      nodes = [],
    } = await readJsonBody<{
      topic: string;
      goal?: string;
      estimatedLevel?: string;
      nodes: Array<{ id: string; title: string; summary: string; tier: number }>;
    }>(req);

    if (!topic || !topic.trim()) {
      sendJson(res, 400, { error: 'Topic is required to generate the final certification exam.' });
      return;
    }

    const modulesText = nodes
      .slice(0, 12)
      .map((n) => `Tier ${n.tier} - ${n.title}: ${n.summary}`)
      .join('\n');

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Generate a Final Comprehensive Certification Exam for a learner who has completed all modules in this skill track:
Topic: "${topic}"
${goal ? `Goal: "${goal}"` : ''}
Target Level: ${estimatedLevel}
Completed Skill Modules:
${modulesText || topic}

Requirements:
- Generate exactly 5 applied synthesis questions (IDs "f1" through "f5") spanning foundations to real-world architecture and troubleshooting.
- Each question must include prompt, 4 plausible multiple-choice options, the moduleTitle it tests, and a short 1-sentence hint.
- Never include *, &, ^, $, #, or @ characters anywhere; write "and" instead of "&".`,
      config: {
        systemInstruction:
          'You are a lead certification examiner creating rigorous, fair final mastery exams. Never output *, &, ^, $, #, or @ characters.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  prompt: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  moduleTitle: { type: Type.STRING },
                  hint: { type: Type.STRING },
                },
                required: ['id', 'prompt', 'options', 'moduleTitle', 'hint'],
              },
            },
          },
          required: ['questions'],
        },
      },
    });

    const parsed = safeJsonParse<{
      questions: Array<{ id: string; prompt: string; options: string[]; moduleTitle: string; hint: string }>;
    } | null>(response.text, null);

    if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
      sendJson(res, 502, { error: 'Failed to generate final certification exam.' });
      return;
    }

    sendJson(res, 200, {
      topic: cleanDisplayText(topic),
      questions: parsed.questions.slice(0, 5).map((q, idx) => ({
        id: cleanDisplayText(q.id) || `f${idx + 1}`,
        prompt: cleanDisplayText(q.prompt),
        options: cleanDisplayList(q.options, 4),
        moduleTitle: cleanDisplayText(q.moduleTitle) || topic,
        hint: cleanDisplayText(q.hint),
      })),
    });
  } catch (error) {
    handleGeminiError(res, error, 'Final exam generation error.');
  }
}

async function handleFinalExamEvaluate(req: ApiRequest, res: ServerResponse): Promise<void> {
  try {
    const {
      topic = '',
      estimatedLevel = 'Intermediate',
      questions = [],
      userAnswers = [],
    } = await readJsonBody<{
      topic: string;
      estimatedLevel?: string;
      questions: Array<{ id: string; prompt: string; moduleTitle?: string }>;
      userAnswers: Array<{ questionId: string; answer: string }>;
    }>(req);

    if (!topic || !Array.isArray(questions) || questions.length === 0) {
      sendJson(res, 400, { error: 'Final exam questions and answers are required.' });
      return;
    }

    const answerMap = new Map(userAnswers.map((a) => [a.questionId, a.answer]));
    const qaText = questions
      .map(
        (q, idx) =>
          `Question ${idx + 1} (${q.id} - ${q.moduleTitle || topic}): ${q.prompt}\nLearner Answer: ${
            answerMap.get(q.id) || 'No answer provided'
          }`
      )
      .join('\n\n');

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Evaluate this Final Certification Exam for "${topic}" (${estimatedLevel} level):

${qaText}

Grading rules:
- Grade each question accurately (correct: true/false) with a clear 1-sentence feedback note.
- Compute overall score from 0 to 100.
- Set passed to true if score is 70 or higher.
- Write concise overall feedback (2 sentences max) explaining performance and any weak areas.
- Write strengthSummary: a polished 1-sentence academic commendation describing what the learner mastered (for display on their Certificate of Mastery).
- Never include *, &, ^, $, #, or @ characters anywhere; write "and" instead of "&".`,
      config: {
        systemInstruction:
          'You are a certification board examiner grading a comprehensive final skill exam accurately and encouragingly. Never output *, &, ^, $, #, or @ characters.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER },
            passed: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING },
            strengthSummary: { type: Type.STRING },
            questionResults: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  questionId: { type: Type.STRING },
                  correct: { type: Type.BOOLEAN },
                  feedback: { type: Type.STRING },
                },
                required: ['questionId', 'correct', 'feedback'],
              },
            },
          },
          required: ['score', 'passed', 'feedback', 'strengthSummary', 'questionResults'],
        },
      },
    });

    const parsed = safeJsonParse<{
      score: number;
      passed: boolean;
      feedback: string;
      strengthSummary: string;
      questionResults: Array<{ questionId: string; correct: boolean; feedback: string }>;
    } | null>(response.text, null);

    if (!parsed) {
      sendJson(res, 502, { error: 'Failed to evaluate final certification exam.' });
      return;
    }

    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
    const passed = score >= 70;
    const pointsAwarded = passed ? score * 3 : Math.max(25, Math.round(score * 0.5));

    sendJson(res, 200, {
      score,
      passed,
      pointsAwarded,
      feedback: cleanDisplayText(parsed.feedback),
      strengthSummary:
        cleanDisplayText(parsed.strengthSummary) ||
        `Demonstrated applied mastery across all modules in ${cleanDisplayText(topic)}.`,
      completedAtIso: new Date().toISOString(),
      questionResults: (parsed.questionResults || []).slice(0, 6).map((qr, idx) => ({
        questionId: cleanDisplayText(qr.questionId) || questions[idx]?.id || `f${idx + 1}`,
        correct: Boolean(qr.correct),
        feedback: cleanDisplayText(qr.feedback),
      })),
    });
  } catch (error) {
    handleGeminiError(res, error, 'Final exam evaluation error.');
  }
}

async function handleProjectsGenerate(req: ApiRequest, res: ServerResponse): Promise<void> {
  try {
    const {
      topic = '',
      goal = '',
      estimatedLevel = 'Intermediate',
      nodes = [],
    } = await readJsonBody<{
      topic: string;
      goal?: string;
      estimatedLevel?: string;
      nodes?: Array<{ id: string; title: string; summary: string; tier?: number }>;
    }>(req);

    if (!topic || !topic.trim()) {
      sendJson(res, 400, { error: 'Skill topic is required to generate projects.' });
      return;
    }

    const moduleSummary = nodes
      .map((n) => `Tier ${n.tier || 1}: ${n.title} - ${n.summary}`)
      .join('\n');

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Design 2 practical, portfolio-worthy hands-on capstone projects for a learner who just completed all modules in:
Topic: "${topic}"
Learner Goal: "${goal || 'Build real-world applied mastery'}"
Level: ${estimatedLevel}
Completed Modules:
${moduleSummary || topic}

Requirements:
- Generate exactly 2 distinct progressive projects (IDs "p1" and "p2"):
  1. p1: Core Applied Project (focused build combining foundational and core modules, 2-3 hours)
  2. p2: End-to-End Portfolio Capstone (integrates full workflow aligned with their goal, 4-6 hours)
- For each project include:
  - title (crisp, concrete project title)
  - difficulty ("Beginner", "Intermediate", or "Advanced")
  - estimatedHours (e.g. "2 to 3 hours")
  - brief (2-3 sentence real-world scenario explaining what to build and why)
  - deliverables (3-4 specific concrete deliverables)
  - acceptanceCriteria (3 measurable review criteria the learner must address)
- Never include *, &, ^, $, #, or @ characters anywhere; write "and" instead of "&".`,
      config: {
        systemInstruction:
          'You are a senior technical mentor designing practical capstone projects that prove real-world mastery before awarding a certificate. Never output *, &, ^, $, #, or @ characters.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            projects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  difficulty: { type: Type.STRING },
                  estimatedHours: { type: Type.STRING },
                  brief: { type: Type.STRING },
                  deliverables: { type: Type.ARRAY, items: { type: Type.STRING } },
                  acceptanceCriteria: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: [
                  'id',
                  'title',
                  'difficulty',
                  'estimatedHours',
                  'brief',
                  'deliverables',
                  'acceptanceCriteria',
                ],
              },
            },
          },
          required: ['projects'],
        },
      },
    });

    const parsed = safeJsonParse<{
      projects: Array<{
        id: string;
        title: string;
        difficulty: string;
        estimatedHours: string;
        brief: string;
        deliverables: string[];
        acceptanceCriteria: string[];
      }>;
    } | null>(response.text, null);

    if (!parsed || !Array.isArray(parsed.projects) || parsed.projects.length === 0) {
      sendJson(res, 502, { error: 'Failed to generate capstone projects.' });
      return;
    }

    const validDifficulties = new Set(['Beginner', 'Intermediate', 'Advanced']);
    sendJson(res, 200, {
      topic: cleanDisplayText(topic),
      projects: parsed.projects.slice(0, 3).map((p, idx) => ({
        id: cleanDisplayText(p.id).replace(/[^a-zA-Z0-9_-]/g, '') || `p${idx + 1}`,
        title: cleanDisplayText(p.title) || `Applied Project ${idx + 1}`,
        difficulty: validDifficulties.has(p.difficulty)
          ? (p.difficulty as 'Beginner' | 'Intermediate' | 'Advanced')
          : 'Intermediate',
        estimatedHours: cleanDisplayText(p.estimatedHours) || '2 to 4 hours',
        brief: cleanDisplayText(p.brief),
        deliverables: cleanDisplayList(p.deliverables, 5),
        acceptanceCriteria: cleanDisplayList(p.acceptanceCriteria, 5),
        status: 'pending' as const,
      })),
    });
  } catch (error) {
    handleGeminiError(res, error, 'Capstone project generation error.');
  }
}

async function handleProjectsEvaluate(req: ApiRequest, res: ServerResponse): Promise<void> {
  try {
    const {
      topic = '',
      estimatedLevel = 'Intermediate',
      project,
      submissionText = '',
      submissionUrl = '',
    } = await readJsonBody<{
      topic: string;
      estimatedLevel?: string;
      project: {
        id: string;
        title: string;
        brief: string;
        deliverables?: string[];
        acceptanceCriteria?: string[];
      };
      submissionText: string;
      submissionUrl?: string;
    }>(req);

    if (!project?.id || !project?.title) {
      sendJson(res, 400, { error: 'Project details are required.' });
      return;
    }

    if (!submissionText.trim() || submissionText.trim().length < 20) {
      sendJson(res, 400, {
        error: 'Please describe your implemented solution, approach, and deliverables (at least 20 characters).',
      });
      return;
    }

    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Review and score this learner capstone project submission:
Topic: "${topic}" (${estimatedLevel} level)
Project Title: "${project.title}"
Project Brief: ${project.brief}
Required Deliverables: ${(project.deliverables || []).join('; ')}
Acceptance Criteria: ${(project.acceptanceCriteria || []).join('; ')}

Learner Submission Summary:
"""
${submissionText.trim()}
"""
${submissionUrl.trim() ? `Submitted Link or Repo: ${submissionUrl.trim()}` : 'No external link provided.'}

Grading rules:
- Score from 0 to 100 based on how thoroughly the learner demonstrated real implementation, covered the deliverables, and met acceptance criteria.
- Set passed to true if score is 60 or higher.
- Provide concise, constructive feedback (2 sentences max).
- Provide 2 short strengths and 1-2 concrete improvements.
- Never include *, &, ^, $, #, or @ characters anywhere; write "and" instead of "&".`,
      config: {
        systemInstruction:
          'You are a fair, rigorous senior project reviewer grading hands-on capstone submissions before certificate issuance. Never output *, &, ^, $, #, or @ characters.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.INTEGER },
            passed: { type: Type.BOOLEAN },
            feedback: { type: Type.STRING },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['score', 'passed', 'feedback', 'strengths', 'improvements'],
        },
      },
    });

    const parsed = safeJsonParse<{
      score: number;
      passed: boolean;
      feedback: string;
      strengths: string[];
      improvements: string[];
    } | null>(response.text, null);

    if (!parsed) {
      sendJson(res, 502, { error: 'Failed to evaluate project submission.' });
      return;
    }

    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
    const passed = score >= 60;
    const pointsAwarded = passed ? score * 2 + 50 : Math.max(20, Math.round(score * 0.5));

    sendJson(res, 200, {
      projectId: project.id,
      score,
      passed,
      pointsAwarded,
      feedback: cleanDisplayText(parsed.feedback),
      strengths: cleanDisplayList(parsed.strengths, 3),
      improvements: cleanDisplayList(parsed.improvements, 3),
      completedAtIso: new Date().toISOString(),
    });
  } catch (error) {
    handleGeminiError(res, error, 'Project evaluation error.');
  }
}

export async function handleApiHttpRequest(
  req: ApiRequest,
  res: ServerResponse
): Promise<void> {
  try {
    const method = (req.method || 'GET').toUpperCase();
    const pathname = normalizePathname(req.originalUrl || req.url);

    if (method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Allow', 'GET, POST, OPTIONS');
      res.end();
      return;
    }

    if (pathname === '/api') {
      sendJson(res, 200, {
        status: 'ok',
        service: 'SkillPath AI API',
        runtime: 'node-http-esm',
        routes: API_ROUTES,
      });
      return;
    }

    if (pathname === '/api/health' && (method === 'GET' || method === 'HEAD')) {
      sendJson(res, 200, {
        status: 'ok',
        backend: 'node-http-esm',
        fastapiSpecPath: 'backend/main.py',
        hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
        hasYoutubeApiKey: Boolean(process.env.YOUTUBE_API_KEY),
        routesCount: API_ROUTES.length,
      });
      return;
    }

    if (method === 'POST') {
      switch (pathname) {
        case '/api/diagnostic/turn':
          await handleDiagnosticTurn(req, res);
          return;
        case '/api/skill-tree/generate':
          await handleSkillTreeGenerate(req, res);
          return;
        case '/api/skill-tree/quiz':
          await handleSkillTreeQuiz(req, res);
          return;
        case '/api/skill-tree/evaluate':
          await handleSkillTreeEvaluate(req, res);
          return;
        case '/api/videos/search':
          await handleVideosSearch(req, res);
          return;
        case '/api/videos/summarize':
          await handleVideosSummarize(req, res);
          return;
        case '/api/videos/quiz':
          await handleVideosQuiz(req, res);
          return;
        case '/api/videos/evaluate':
          await handleVideosEvaluate(req, res);
          return;
        case '/api/skill-tree/final-exam/generate':
          await handleFinalExamGenerate(req, res);
          return;
        case '/api/skill-tree/final-exam/evaluate':
          await handleFinalExamEvaluate(req, res);
          return;
        case '/api/skill-tree/projects/generate':
          await handleProjectsGenerate(req, res);
          return;
        case '/api/skill-tree/projects/evaluate':
          await handleProjectsEvaluate(req, res);
          return;
        default:
          break;
      }
    }

    sendJson(res, 404, {
      error: `API endpoint not found: ${method} ${pathname}`,
    });
  } catch (err) {
    console.error('Unhandled API router error:', err);
    sendJson(res, 500, {
      error: 'Internal API error while handling request.',
    });
  }
}
