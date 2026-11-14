import {
  DiagnosticMessage,
  DiagnosticProfile,
  SkillTreeData,
  VideoResult,
  VideoSynthesis,
} from '../types/learning';

export const DEMO_PROFILE: DiagnosticProfile = {
  topic: 'Python for Data Analysis',
  goal: 'Build a portfolio project',
  pace: 'consistent',
  dailyMinutes: 45,
  estimatedLevel: 'Beginner',
  confidenceScore: 84,
  strengths: ['Variables & Types', 'Basic Loops', 'Conditionals'],
  knowledgeGaps: ['Functions & Scope', 'List Comprehensions', 'Pandas DataFrames'],
  readyForSkillTree: true,
  turnCount: 3,
};

export const DEMO_MESSAGES: DiagnosticMessage[] = [
  {
    id: 'demo_m1',
    role: 'assistant',
    content:
      'Welcome! Let us quickly calibrate your Python foundation. When you want to reuse a calculation across multiple datasets without rewriting logic, what structure do you reach for and why?',
    timestamp: '09:41 AM',
    assessment: {
      conceptChecked: 'Initial Calibration',
      verdict: 'initial',
      note: 'Opening diagnostic probe',
    },
  },
  {
    id: 'demo_m2',
    role: 'user',
    content:
      'I usually write a for-loop or copy the block, though I know functions exist—I just get tripped up on return values vs print.',
    timestamp: '09:42 AM',
  },
  {
    id: 'demo_m3',
    role: 'assistant',
    content:
      'Clear and honest starting point! You already understand loops and control flow, and clarifying return vs. print will unlock clean modular code and Pandas transformations.',
    timestamp: '09:42 AM',
    assessment: {
      conceptChecked: 'Functions & Return Scope',
      verdict: 'partial',
      note: 'Solid grasp of loops; ready to formalize reusable functions.',
    },
    suggestedReplies: [
      'A function uses return to pass values back to callers',
      'Show me how this connects to Pandas pipelines',
    ],
  },
];

export const DEMO_SKILL_TREE: SkillTreeData = {
  topic: 'Python for Data Analysis',
  generatedAt: '2026-11-13T18:00:00.000Z',
  recommendedNextId: 'n3',
  nodes: [
    {
      id: 'n1',
      title: 'Variables & Control Flow',
      summary: 'Core data types, conditionals, and iteration patterns for data scripts.',
      tier: 1,
      difficulty: 'Beginner',
      status: 'mastered',
      estimatedMinutes: 30,
      prerequisites: [],
      learningObjectives: [
        'Distinguish integers, floats, strings, and booleans',
        'Write clean for-loops and conditional branches',
      ],
      whyItMatters: 'Every data cleaning script relies on reliable iteration and branching.',
      keyConcepts: ['Data Types', 'For Loops', 'Conditionals'],
      commonMistakes: ['Mutating a list while iterating over it'],
      practiceTask: 'Filter a list of raw sales figures to keep values above 100.',
      diagnosticRationale: 'Verified strength during diagnostic calibration.',
      youtubeSearchQuery: 'Python variables and loops tutorial',
    },
    {
      id: 'n2',
      title: 'Lists & Dictionaries',
      summary: 'Indexing, slicing, and key-value lookups for structured records.',
      tier: 1,
      difficulty: 'Beginner',
      status: 'mastered',
      estimatedMinutes: 35,
      prerequisites: [],
      learningObjectives: [
        'Slice lists and unpack nested collections',
        'Aggregate counts using dictionaries safely with .get()',
      ],
      whyItMatters: 'JSON APIs and CSV rows map directly to lists of dictionaries.',
      keyConcepts: ['Slicing', 'Dict Lookups', 'KeyError Prevention'],
      commonMistakes: ['Accessing missing dictionary keys without .get()'],
      practiceTask: 'Group a list of transaction dicts by category total.',
      diagnosticRationale: 'Strong foundational familiarity demonstrated.',
      youtubeSearchQuery: 'Python lists and dictionaries data analysis',
    },
    {
      id: 'n3',
      title: 'Functions & Modules',
      summary: 'Encapsulate reusable transformations with explicit parameters and return values.',
      tier: 2,
      difficulty: 'Beginner',
      status: 'ready',
      estimatedMinutes: 45,
      prerequisites: ['n1', 'n2'],
      learningObjectives: [
        'Separate return values from print side-effects',
        'Design pure helper functions with default arguments',
        'Import modular utilities across notebook cells',
      ],
      whyItMatters: 'Pandas .apply() and clean data pipelines depend on well-scoped functions.',
      keyConcepts: ['def & return', 'Parameters', 'Pure Functions', 'Imports'],
      commonMistakes: [
        'Printing inside a function instead of returning the computed value',
        'Using mutable default arguments like def add(items=[])',
      ],
      practiceTask:
        'Write a normalize_price(raw_str) function that strips "$" and returns a rounded float.',
      diagnosticRationale: 'Identified as your highest-leverage next step from diagnostic turn 2.',
      youtubeSearchQuery: 'Python functions return vs print tutorial',
    },
    {
      id: 'n4',
      title: 'List Comprehensions',
      summary: 'Express concise, readable filtering and mapping transformations in one line.',
      tier: 2,
      difficulty: 'Intermediate',
      status: 'needs_review',
      estimatedMinutes: 35,
      prerequisites: ['n1', 'n2'],
      learningObjectives: [
        'Convert multi-line append loops into readable comprehensions',
        'Apply conditional filters inside comprehensions',
      ],
      whyItMatters: 'Speeds up feature engineering and column transformations.',
      keyConcepts: ['Mapping', 'Filtering', 'Generator Expressions'],
      commonMistakes: ['Nesting 3+ loops inside a single unreadable comprehension'],
      practiceTask: 'Convert a 5-line loop cleaning column headers into one list comprehension.',
      diagnosticRationale: 'Useful companion skill before vectorized NumPy & Pandas.',
      youtubeSearchQuery: 'Python list comprehensions explained clearly',
    },
    {
      id: 'n5',
      title: 'NumPy Arrays & Vectorization',
      summary: 'Fast numerical computation without slow Python loops.',
      tier: 3,
      difficulty: 'Intermediate',
      status: 'locked',
      estimatedMinutes: 50,
      prerequisites: ['n3', 'n4'],
      learningObjectives: [
        'Understand broadcasting and element-wise operations',
        'Compute descriptive statistics across array axes',
      ],
      whyItMatters: 'Pandas sits directly on top of NumPy arrays.',
      keyConcepts: ['ndarrays', 'Broadcasting', 'Axis Aggregations'],
      commonMistakes: ['Confusing axis=0 (rows) with axis=1 (columns)'],
      practiceTask: 'Normalize a 2D array of test scores using column-wise z-scores.',
      diagnosticRationale: 'Unlocks once Functions & Comprehensions are mastered.',
      youtubeSearchQuery: 'NumPy vectorization broadcasting tutorial',
    },
    {
      id: 'n6',
      title: 'Pandas DataFrames',
      summary: 'Load CSVs, inspect schemas, filter rows, and group tabular datasets.',
      tier: 3,
      difficulty: 'Intermediate',
      status: 'locked',
      estimatedMinutes: 60,
      prerequisites: ['n3', 'n4'],
      learningObjectives: [
        'Select columns and filter rows cleanly with .loc',
        'Handle missing values and compute groupby summaries',
      ],
      whyItMatters: 'The core workbench for real-world data analysis.',
      keyConcepts: ['DataFrame', '.loc / .iloc', 'groupby()', 'Missing Data'],
      commonMistakes: ['Triggering SettingWithCopyWarning on chained indexing'],
      practiceTask: 'Load a CSV dataset and rank top 5 products by monthly revenue.',
      diagnosticRationale: 'Core portfolio milestone built atop Functions.',
      youtubeSearchQuery: 'Pandas DataFrame tutorial for beginners',
    },
    {
      id: 'n7',
      title: 'Exploratory Data Project',
      summary: 'Clean, analyze, and visualize an end-to-end public dataset for your portfolio.',
      tier: 4,
      difficulty: 'Advanced',
      status: 'locked',
      estimatedMinutes: 75,
      prerequisites: ['n5', 'n6'],
      learningObjectives: [
        'Combine modular cleaning functions with Pandas groupby pipelines',
        'Present actionable insights with clear charts and summary metrics',
      ],
      whyItMatters: 'Turns passive knowledge into a shareable portfolio artifact.',
      keyConcepts: ['EDA Workflow', 'Data Storytelling', 'Reproducibility'],
      commonMistakes: ['Plotting raw uncleaned outliers without inspecting distributions'],
      practiceTask: 'Publish a documented analysis notebook answering 3 business questions.',
      diagnosticRationale: 'Capstone synthesis aligned with your portfolio goal.',
      youtubeSearchQuery: 'Python exploratory data analysis portfolio project',
    },
  ],
  edges: [
    { source: 'n1', target: 'n3' },
    { source: 'n2', target: 'n3' },
    { source: 'n1', target: 'n4' },
    { source: 'n2', target: 'n4' },
    { source: 'n3', target: 'n5' },
    { source: 'n4', target: 'n5' },
    { source: 'n3', target: 'n6' },
    { source: 'n4', target: 'n6' },
    { source: 'n5', target: 'n7' },
    { source: 'n6', target: 'n7' },
  ],
  studyPlan: [
    {
      day: 1,
      dateLabel: 'Day 1',
      moduleId: 'n1',
      taskTitle: 'Review Control Flow & Loop Edge Cases',
      estimatedMinutes: 30,
      motivation: 'Quick confidence builder to lock in fundamentals.',
      completed: true,
    },
    {
      day: 2,
      dateLabel: 'Day 2',
      moduleId: 'n2',
      taskTitle: 'Practice Safe Dictionary Aggregations',
      estimatedMinutes: 35,
      motivation: 'Master structured lookups before writing helpers.',
      completed: true,
    },
    {
      day: 3,
      dateLabel: 'Day 3 · Today',
      moduleId: 'n3',
      taskTitle: 'Functions, Scope & Return Values',
      estimatedMinutes: 45,
      motivation: 'Your highest-leverage unlock for Pandas pipelines.',
      completed: false,
    },
    {
      day: 4,
      dateLabel: 'Day 4',
      moduleId: 'n4',
      taskTitle: 'Refactor Loops into List Comprehensions',
      estimatedMinutes: 35,
      motivation: 'Write cleaner, more Pythonic data transforms.',
      completed: false,
    },
    {
      day: 5,
      dateLabel: 'Day 5',
      moduleId: 'n5',
      taskTitle: 'NumPy Vectorization & Axis Operations',
      estimatedMinutes: 45,
      motivation: 'Replace slow loops with fast array math.',
      completed: false,
    },
    {
      day: 6,
      dateLabel: 'Day 6',
      moduleId: 'n6',
      taskTitle: 'Pandas DataFrame Filtering & GroupBy',
      estimatedMinutes: 60,
      motivation: 'Analyze your first real multi-column CSV.',
      completed: false,
    },
    {
      day: 7,
      dateLabel: 'Day 7',
      moduleId: 'n7',
      taskTitle: 'Mini Exploratory Analysis Checkpoint',
      estimatedMinutes: 60,
      motivation: 'Ship a clean, portfolio-ready summary.',
      completed: false,
    },
  ],
};

export const DEMO_VIDEOS: VideoResult[] = [
  {
    videoId: '9Os0o3wzS_I',
    title: 'Python Tutorial for Beginners 8: Functions',
    channelTitle: 'Corey Schafer',
    publishedAt: 'Curated Lecture',
    duration: '21 min',
    description:
      'Clear walkthrough of function definitions, return statements, *args/**kwargs, and avoiding side-effect traps.',
    thumbnailUrl: 'https://i.ytimg.com/vi/9Os0o3wzS_I/hqdefault.jpg',
    url: 'https://www.youtube.com/watch?v=9Os0o3wzS_I',
    source: 'youtube_api',
  },
  {
    videoId: '3dt4OGnU5sM',
    title: 'Python Tutorial: Comprehensions - How they work and why you should use them',
    channelTitle: 'Corey Schafer',
    publishedAt: 'Curated Lecture',
    duration: '17 min',
    description:
      'Step-by-step transition from standard for-loops to readable list, dictionary, and set comprehensions.',
    thumbnailUrl: 'https://i.ytimg.com/vi/3dt4OGnU5sM/hqdefault.jpg',
    url: 'https://www.youtube.com/watch?v=3dt4OGnU5sM',
    source: 'youtube_api',
  },
  {
    videoId: 'vmEHCJofslg',
    title: 'Complete Python Pandas Data Science Tutorial!',
    channelTitle: 'Keith Galli',
    publishedAt: 'Curated Lecture',
    duration: '60 min',
    description:
      'Hands-on dataset loading, filtering, sorting, and groupby aggregations for real-world CSV data.',
    thumbnailUrl: 'https://i.ytimg.com/vi/vmEHCJofslg/hqdefault.jpg',
    url: 'https://www.youtube.com/watch?v=vmEHCJofslg',
    source: 'youtube_api',
  },
];

export const DEMO_SYNTHESIS: VideoSynthesis = {
  videoId: '9Os0o3wzS_I',
  videoTitle: 'Python Tutorial for Beginners 8: Functions',
  executiveSummary:
    'Functions keep data workflows DRY (Don’t Repeat Yourself) by packaging repeatable transformations behind clear inputs and returned outputs—allowing downstream pipelines to compose cleanly.',
  keyTakeaways: [
    'Use return to hand computed values back to callers; print only displays text to the console.',
    'Treat functions as black boxes: clear input parameters in, predictable transformed output out.',
    'Use positional and keyword arguments (*args, **kwargs) to keep helper APIs flexible.',
    'Never use mutable objects like [] or {} as default parameter values.',
  ],
  structuredNotes: [
    {
      heading: 'Why Functions Beat Copy-Pasted Loops',
      timestampHint: '00:00 – 05:40',
      bullets: [
        'Centralizes bug fixes in one definition instead of 5 duplicated notebook cells.',
        'Use pass temporarily when scaffolding module signatures.',
      ],
    },
    {
      heading: 'Return Values vs. Print Statements',
      timestampHint: '05:40 – 11:20',
      bullets: [
        'A function without an explicit return yields None automatically.',
        'Returning a value lets you chain string/list methods or feed directly into Pandas .apply().',
      ],
    },
    {
      heading: 'Parameters, Defaults & Unpacking',
      timestampHint: '11:20 – 21:00',
      bullets: [
        'Required positional parameters come before optional keyword parameters.',
        'Use * and ** to unpack lists and dictionaries into function arguments cleanly.',
      ],
    },
  ],
  mermaidFlowchart: `flowchart TD
  A["Raw Input Data"] --> B["Call Helper Function"]
  B --> C{"Valid Parameters?"}
  C -->|"Yes"| D["Transform & Compute Result"]
  C -->|"No"| E["Apply Safe Default / Raise ValueError"]
  D --> F{"Uses return?"}
  F -->|"Yes"| G["Pass Output to Pandas / Next Step"]
  F -->|"No"| H["Prints Only & Returns None"]`,
  studyChecklist: [
    'Explain why calling print() inside a helper breaks downstream chaining',
    'Write a clean function with 1 required and 1 optional default parameter',
    'Refactor one repeated cleaning snippet into a reusable function',
  ],
  commonMistakes: [
    'Forgetting the return keyword, leaving variables assigned to None.',
    'Sharing state via global variables instead of passing arguments explicitly.',
  ],
  practiceTask:
    'Write a function clean_revenue(value, currency="$") that strips the currency symbol, removes commas, and returns a float.',
};
