SkillPath AI
============

SkillPath AI is an adaptive learning platform that turns any technical or creative subject into a structured, verifiable mastery path. Instead of leaving learners stuck in tutorial hell with disconnected playlists and guesswork, it diagnoses current skill level through an AI interview, generates an interactive dependency skill tree, pairs every concept with curated video lessons, AI study notes, and Mermaid mechanism diagrams, grades comprehension with post-video and node quizzes, and unlocks capstone projects plus a Final AI Exam leading to a downloadable Certificate of Mastery.

Live deployment: https://learn-skill-rho.vercel.app/


What Problem It Solves
----------------------

Self-taught learners typically face three roadblocks:

1. No clear starting point: generic courses repeat basics you already know or skip critical prerequisites.
2. Passive watching without retention: finishing videos feels productive, yet learners struggle to recall concepts or apply them.
3. No proof of practical mastery: watching tutorials does not verify hands-on problem solving or provide structured assessment.

SkillPath AI solves this end to end by combining diagnostic calibration, graph-based curriculum planning, active recall testing, and project evaluation in one studio.


Key Features
------------

- Adaptive AI Diagnostic Interview: Multi-turn assessment calibrates whether you are a Beginner, Intermediate, or Advanced learner before generating your roadmap.
- Interactive D3 Skill Tree: Visualizes prerequisite and core modules as an interactive directed acyclic graph with progress ring tracking and node status states.
- Per-Node AI Mastery Checks: Short adaptive quizzes verify understanding on any skill node and update profile mastery scores automatically.
- Curated Video Search and AI Study Notes: Finds relevant YouTube tutorials and generates structured study notes, key takeaways, and interactive Mermaid flowcharts with safe clipboard copy support.
- Post-Video Knowledge Checks: After watching a lesson, learners complete an AI-graded quiz that awards profile points and marks lessons complete.
- 7-Day Action Plan: Organizes upcoming modules and daily study milestones into an actionable weekly schedule.
- Capstone Projects and Final AI Exam: Unlocks practical build challenges after core skill completion, followed by a cumulative Final AI Exam and downloadable PNG Certificate of Mastery.
- Persistent Demo Mode and Cloud Sync: Full Demo Mode persists tracks, module completions, answers, and scores in localStorage across reloads; optional Google sign-in syncs progress with Firebase Authentication and Cloud Firestore.
- Resilient UX and Error Recovery: Mobile-friendly navigation sheet, branded 404 route handling, loading states on all AI actions, readable error toasts, and inline Try again recovery controls.


Tech Stack
----------

- Frontend: React 19, TypeScript, Vite 8, Tailwind CSS v4, D3 v7, Mermaid v12, Motion, Lucide React
- Server and Serverless API: Express (local full-stack runtime) and pure Node 22 ESM HTTP router for Vercel Serverless Functions
- AI Engine: Google GenAI TypeScript SDK running server-side only (never exposed to browser bundles)
- Video Lookup: Optional YouTube Data API v3 with automatic Gemini Google Search Grounding and YouTube oEmbed fallback
- Authentication and Storage: Firebase Auth (Google Sign-In), Cloud Firestore, and browser localStorage


Project Structure
-----------------

```text
.
├── api/
│   ├── _lib/
│   │   └── router.ts          Shared Node ESM API router for all API routes
│   ├── index.ts               Vercel serverless function entrypoint
│   └── tsconfig.json          NodeNext TypeScript config for api/
├── scripts/
│   └── smoke-api.ts           Automated API smoke test checking all endpoints
├── src/
│   ├── components/
│   │   ├── DashboardPage.tsx
│   │   ├── DiagnosticAssessmentPage.tsx
│   │   ├── FinalExamCertificateView.tsx
│   │   ├── GoogleGIcon.tsx
│   │   ├── LandingPage.tsx
│   │   ├── NotFoundPage.tsx
│   │   ├── RoadmapTreeView.tsx
│   │   ├── SkillPathLogo.tsx
│   │   ├── SkillSetupPage.tsx
│   │   ├── StudyNotesView.tsx
│   │   ├── StudyPlanView.tsx
│   │   └── VideosView.tsx
│   ├── context/               Auth, Theme, and Toast contexts
│   ├── lib/                   API client, error mapper, Firebase setup, certificate generator
│   ├── types/                 Shared TypeScript interfaces
│   ├── App.tsx                Root application shell and route/view orchestration
│   └── main.tsx               Vite React mount entrypoint
├── server.ts                  Local Express + Vite development and production server
├── vercel.json                Vercel build, function runtime, and API rewrite config
├── firestore.rules            Cloud Firestore security rules
├── .env.example               Environment variable template
└── package.json               Dependencies and npm scripts
```


Local Development Setup
-----------------------

Prerequisites: Node.js 20 or newer (Node 22 recommended) and npm.

1. Install dependencies:

```bash
npm install
```

2. Create a local `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

3. Set environment variables in `.env`:

- `GEMINI_API_KEY` (required): Google Gemini API key used by server-side AI endpoints.
- `YOUTUBE_API_KEY` (optional): YouTube Data API v3 key. When omitted, video search automatically uses Gemini Google Search Grounding and YouTube oEmbed.
- `APP_URL` (optional): Base URL where the application is hosted.

4. Start the full-stack development server on port 3000:

```bash
npm run dev
```

Open http://localhost:3000 in your browser.


Available Scripts
-----------------

- `npm run dev` - Starts the Express + Vite full-stack server on port 3000
- `npm run start` - Starts the server in Node production mode
- `npm run build` - Builds the production frontend bundle into `dist/`
- `npm run preview` - Previews the built Vite bundle locally
- `npm run lint` - Runs TypeScript type-checking (`tsc --noEmit`)
- `npm run test:api` - Runs the API smoke test suite against local or deployed endpoints
- `npm run clean` - Removes `dist/` and build artifacts


API Endpoints
-------------

All API routes run same-origin under `/api` and return JSON.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET / POST | `/api` | API index and route summary |
| GET | `/api/health` | Health and AI key configuration status |
| POST | `/api/diagnostic/turn` | Evaluates a diagnostic interview turn |
| POST | `/api/skill-tree/generate` | Generates a structured skill tree DAG |
| POST | `/api/skill-tree/quiz` | Generates a mastery quiz for a skill node |
| POST | `/api/skill-tree/evaluate` | Grades node quiz answers and updates mastery |
| POST | `/api/videos/search` | Searches curated learning videos for a topic |
| POST | `/api/videos/summarize` | Generates AI study notes and Mermaid flowchart |
| POST | `/api/videos/quiz` | Generates a post-video comprehension quiz |
| POST | `/api/videos/evaluate` | Grades post-video answers and awards points |
| POST | `/api/skill-tree/final-exam/generate` | Generates cumulative Final AI Exam |
| POST | `/api/skill-tree/final-exam/evaluate` | Grades Final AI Exam for certification |
| POST | `/api/skill-tree/projects/generate` | Generates hands-on capstone projects |
| POST | `/api/skill-tree/projects/evaluate` | Evaluates submitted capstone project work |


Vercel Deployment
-----------------

The project uses `vercel.json` to rewrite all API subroutes to `/api` with the `__api_path` query parameter handled by `api/index.ts` and `api/_lib/router.ts`.

1. Configure Environment Variables in Vercel Project Settings (Production and Preview):
   - Add `GEMINI_API_KEY` with a valid Gemini API key.
   - Optionally add `YOUTUBE_API_KEY`.
2. Trigger a fresh deployment after updating environment variables so serverless functions receive the new configuration.
3. If using Google Sign-In on a custom or preview domain, add the hostname under Firebase Console -> Authentication -> Settings -> Authorized domains.
4. Verify all deployed API routes with the smoke test script:

```bash
API_BASE_URL=https://learn-skill-rho.vercel.app npm run test:api
```
