import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const MODEL_NAME = 'gemini-4-hydrogen';

function handleGeminiError(res: Response, error: unknown, fallbackMessage: string): void {
  console.error('Gemini API error:', error);
  const rawMessage = error instanceof Error ? error.message : String(error ?? '');
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
    res.status(statusCode === 402 ? 402 : 429).json({
      error:
        'Your Gemini API project credits or quota are depleted. Top up billing at https://ai.studio/projects or select a funded API key in Settings > Secrets.',
      code: 'RESOURCE_EXHAUSTED',
    });
    return;
  }

  if (
    statusCode === 403 ||
    rawMessage.includes('PERMISSION_DENIED') ||
    rawMessage.includes('API_KEY_INVALID')
  ) {
    res.status(403).json({
      error:
        'Your Gemini API key is missing permissions or invalid. Please check or select a valid key in Settings > Secrets.',
      code: 'API_KEY_ERROR',
    });
    return;
  }

  if (statusCode === 404 || rawMessage.includes('NOT_FOUND')) {
    res.status(404).json({
      error: 'The configured Gemini model was not found or is currently unavailable.',
      code: 'MODEL_NOT_FOUND',
    });
    return;
  }

  res.status(500).json({
    error: rawMessage || fallbackMessage,
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

function sanitizeMermaidFlowchart(raw: string): string {
  let code = (raw || '')
    .replace(/^```mermaid\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  if (!/^(flowchart|graph)\s+(TD|TB|LR|RL|BT)/i.test(code)) {
    code = `flowchart TD\n${code}`;
  }

  // Normalize unquoted bracket labels that contain special characters
  const lines = code.split('\n').map((line) => {
    const trimmed = line.trim();
    if (!trimmed || /^(flowchart|graph|subgraph|end|classDef|class|style)\b/i.test(trimmed)) {
      return line;
    }
    return line;
  });

  return lines.join('\n');
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

async function fetchYoutubeOEmbed(videoId: string): Promise<{ title: string; author_name: string; thumbnail_url: string } | null> {
  try {
    const target = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(target)}&format=json`,
      { signal: AbortSignal.timeout(4500) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { title?: string; author_name?: string; thumbnail_url?: string };
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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      backend: 'express-typescript',
      fastapiSpecPath: 'backend/main.py',
      hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      hasYoutubeApiKey: Boolean(process.env.YOUTUBE_API_KEY),
    });
  });

  // Module 1: Diagnostic Chat Turn
  app.post('/api/diagnostic/turn', async (req: Request, res: Response) => {
    try {
      const { topic, goal, history = [], userMessage = '', currentProfile } = req.body as {
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
      };

      if (!topic || !topic.trim()) {
        res.status(400).json({ error: 'Topic is required to start diagnostic calibration.' });
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
            'You are an expert adaptive curriculum diagnostician. Ask one sharp conceptual question at a time. Never lecture at length during diagnosis; calibrate the learner efficiently and honestly.',
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
        res.status(502).json({ error: 'Failed to parse diagnostic response from Gemini.' });
        return;
      }

      const validVerdicts = new Set(['initial', 'strong', 'partial', 'gap']);
      const verdict = validVerdicts.has(parsed.assessment.verdict)
        ? parsed.assessment.verdict
        : isInitial
        ? 'initial'
        : 'partial';

      res.json({
        reply: parsed.reply,
        suggestedReplies: (parsed.suggestedReplies || []).slice(0, 3),
        assessment: {
          ...parsed.assessment,
          verdict,
        },
        updatedProfile: {
          topic,
          goal: goal || '',
          estimatedLevel: parsed.updatedProfile.estimatedLevel || 'Beginner',
          confidenceScore: Math.min(100, Math.max(0, Number(parsed.updatedProfile.confidenceScore) || 25)),
          strengths: (parsed.updatedProfile.strengths || []).slice(0, 6),
          knowledgeGaps: (parsed.updatedProfile.knowledgeGaps || []).slice(0, 6),
          readyForSkillTree: Boolean(parsed.updatedProfile.readyForSkillTree || nextTurnCount >= 2),
          turnCount: nextTurnCount,
        },
      });
    } catch (error) {
      handleGeminiError(res, error, 'Diagnostic service error.');
    }
  });

  // Module 2: Adaptive Skill Tree DAG Generation
  app.post('/api/skill-tree/generate', async (req: Request, res: Response) => {
    try {
      const { topic, goal = '', pace = 'consistent', dailyMinutes = 45, profile, history = [] } = req.body as {
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
      };

      if (!topic || !topic.trim()) {
        res.status(400).json({ error: 'Topic is required to generate a skill tree.' });
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

Design 8 tightly scoped skill nodes organized across 4 progressive tiers (tier 1 = Foundations, tier 2 = Core Mechanics, tier 3 = Applied Architecture, tier 4 = Synthesis & Mastery).
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
- Also generate a 7-item studyPlan (days 1..7) referencing node IDs, tailored to ${dailyMinutes} min/day.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            'You are a curriculum architect generating structured acyclic skill dependency graphs and 7-day momentum plans tailored to a learner diagnostic.',
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
        res.status(502).json({ error: 'Failed to generate valid skill tree structure.' });
        return;
      }

      const validStatuses = new Set(['mastered', 'ready', 'needs_review', 'locked']);
      const nodeMap = new Map(parsed.nodes.map((n) => [n.id, n]));

      // Clean DAG: only allow prerequisite edges from lower tier -> higher tier
      const normalizedNodes = parsed.nodes.map((n) => {
        const tier = Math.min(4, Math.max(1, Number(n.tier) || 1));
        const prereqs = (n.prerequisites || []).filter((pid) => {
          const p = nodeMap.get(pid);
          return p && (Number(p.tier) || 1) < tier && pid !== n.id;
        });
        const status = validStatuses.has(n.status) ? n.status : tier === 1 ? 'ready' : 'locked';
        return {
          ...n,
          tier,
          prerequisites: prereqs,
          status: status as 'mastered' | 'ready' | 'needs_review' | 'locked',
          estimatedMinutes: Math.max(5, Math.min(90, Number(n.estimatedMinutes) || 20)),
          learningObjectives: (n.learningObjectives || []).slice(0, 4),
        };
      });

      // Ensure at least one actionable node exists
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
        taskTitle: item.taskTitle,
        estimatedMinutes: Math.max(15, Math.min(120, Number(item.estimatedMinutes) || dailyMinutes)),
        motivation: item.motivation,
        completed: false,
      }));

      res.json({
        topic,
        generatedAt: new Date().toISOString(),
        nodes: normalizedNodes,
        edges,
        recommendedNextId: recommendedNode?.id ?? null,
        studyPlan: normalizedPlan,
      });
    } catch (error) {
      handleGeminiError(res, error, 'Failed to generate skill tree.');
    }
  });

  // Module 2: Generate Quick Mastery Check for a Skill Node
  app.post('/api/skill-tree/quiz', async (req: Request, res: Response) => {
    try {
      const { topic, node } = req.body as {
        topic: string;
        node: { id: string; title: string; summary: string; learningObjectives?: string[] };
      };
      if (!node?.title) {
        res.status(400).json({ error: 'Skill node is required.' });
        return;
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Topic: "${topic}"
Skill Node: "${node.title}" — ${node.summary}
Objectives: ${(node.learningObjectives || []).join('; ')}

Create ONE applied conceptual check question (not trivial trivia) to verify the learner understands this skill. Provide 4 concise, plausible multiple-choice options and a 1-sentence hint.`,
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
        res.status(502).json({ error: 'Could not generate mastery question.' });
        return;
      }

      res.json({
        nodeId: node.id,
        question: parsed.question,
        options: (parsed.options || []).slice(0, 4),
        hint: parsed.hint,
      });
    } catch (error) {
      handleGeminiError(res, error, 'Quiz generation error.');
    }
  });

  // Module 2: Evaluate Mastery Check Answer
  app.post('/api/skill-tree/evaluate', async (req: Request, res: Response) => {
    try {
      const { topic, node, question, userAnswer } = req.body as {
        topic: string;
        node: { title: string; summary: string };
        question: string;
        userAnswer: string;
      };
      if (!question || !userAnswer?.trim()) {
        res.status(400).json({ error: 'Question and answer are required.' });
        return;
      }

      const ai = getAiClient();
      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: `Topic: "${topic}"
Skill: "${node.title}" (${node.summary})
Question: "${question}"
Learner's Answer: "${userAnswer}"

Determine if the learner's answer demonstrates accurate conceptual mastery (passed: true/false) and provide crisp 1-2 sentence pedagogical feedback explaining why.`,
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
        res.status(502).json({ error: 'Failed to evaluate mastery response.' });
        return;
      }
      res.json(parsed);
    } catch (error) {
      handleGeminiError(res, error, 'Evaluation error.');
    }
  });

  // Module 3: YouTube Data API v3 + Grounded Search Video Lookup
  app.post('/api/videos/search', async (req: Request, res: Response) => {
    try {
      const { query, skillTitle = '', topic = '' } = req.body as {
        query: string;
        skillTitle?: string;
        topic?: string;
      };

      const searchTerm = (query || `${topic} ${skillTitle} tutorial`).trim();
      if (!searchTerm) {
        res.status(400).json({ error: 'Search query or YouTube URL is required.' });
        return;
      }

      // 1. Check if the user pasted a direct YouTube URL or 11-char ID
      const directId = extractYouTubeId(searchTerm);
      if (directId) {
        const meta = await fetchYoutubeOEmbed(directId);
        res.json({
          videos: [
            {
              videoId: directId,
              title: meta?.title || `YouTube Study Video (${directId})`,
              channelTitle: meta?.author_name || 'YouTube Creator',
              publishedAt: 'Direct Link',
              description: `Direct video loaded for ${skillTitle || topic || 'study'}.`,
              thumbnailUrl: meta?.thumbnail_url || `https://i.ytimg.com/vi/${directId}/hqdefault.jpg`,
              url: `https://www.youtube.com/watch?v=${directId}`,
              source: 'direct_url',
            },
          ],
          provider: 'direct_url',
        });
        return;
      }

      // 2. Use YouTube Data API v3 if YOUTUBE_API_KEY is configured
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
                title: item.snippet?.title || 'Untitled Video',
                channelTitle: item.snippet?.channelTitle || 'YouTube',
                publishedAt: item.snippet?.publishedAt ? item.snippet.publishedAt.slice(0, 10) : 'YouTube',
                description: item.snippet?.description || '',
                thumbnailUrl:
                  item.snippet?.thumbnails?.high?.url ||
                  item.snippet?.thumbnails?.medium?.url ||
                  `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                url: `https://www.youtube.com/watch?v=${videoId}`,
                source: 'youtube_api' as const,
              };
            });

          if (videos.length > 0) {
            res.json({ videos, provider: 'youtube_data_api_v3' });
            return;
          }
        }
      }

      // 3. Fallback: Gemini Google Search Grounding + YouTube oEmbed verification
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
            title: meta.title,
            channelTitle: meta.author_name,
            publishedAt: 'Verified YouTube',
            description: `Educational video covering ${skillTitle || searchTerm}.`,
            thumbnailUrl: meta.thumbnail_url,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            source: 'gemini_search' as const,
          };
        })
      );

      const videos = verified.filter((v): v is NonNullable<typeof v> => v !== null).slice(0, 6);
      res.json({
        videos,
        provider: 'gemini_search_grounding',
      });
    } catch (error) {
      handleGeminiError(res, error, 'Video search failed.');
    }
  });

  // Module 3: Real-time Video Notes & Mermaid Flowchart Generation
  app.post('/api/videos/summarize', async (req: Request, res: Response) => {
    try {
      const {
        videoId,
        videoTitle,
        channelTitle = '',
        topic = '',
        skillTitle = '',
        userNotesOrTranscript = '',
      } = req.body as {
        videoId: string;
        videoTitle: string;
        channelTitle?: string;
        topic?: string;
        skillTitle?: string;
        userNotesOrTranscript?: string;
      };

      if (!videoId || !videoTitle) {
        res.status(400).json({ error: 'videoId and videoTitle are required.' });
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
- Represent the actual causal/architectural flow of the concept, including at least one decision diamond {"Condition?"}.`;

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction:
            'You are an academic synthesizer creating crisp, high-signal study notes and syntactically valid Mermaid flowcharts.',
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
        res.status(502).json({ error: 'Failed to synthesize video notes.' });
        return;
      }

      res.json({
        videoId,
        videoTitle,
        executiveSummary: parsed.executiveSummary,
        keyTakeaways: (parsed.keyTakeaways || []).slice(0, 6),
        structuredNotes: (parsed.structuredNotes || []).slice(0, 5),
        mermaidFlowchart: sanitizeMermaidFlowchart(parsed.mermaidFlowchart),
        studyChecklist: (parsed.studyChecklist || []).slice(0, 5),
        commonMistakes: (parsed.commonMistakes || []).slice(0, 3),
        practiceTask: parsed.practiceTask || '',
      });
    } catch (error) {
      handleGeminiError(res, error, 'Summarization error.');
    }
  });

  // Vite middleware in development, static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SynapsePath full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
