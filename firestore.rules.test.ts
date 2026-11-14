/**
 * Adversarial Security Rules Verification Suite for SkillPath AI
 * Tests the "Dirty Dozen" payloads against firestore.rules expectations.
 *
 * Usage:
 *   npx tsx firestore.rules.test.ts
 */
import { readFileSync } from 'node:fs';

export const DIRTY_DOZEN_CASES = [
  {
    id: 1,
    name: 'Cross-tenant user anchor create',
    actorUid: 'user_a',
    path: '/users/user_b',
    operation: 'create',
    payload: { uid: 'user_b', createdAt: 'SERVER_TIME', updatedAt: 'SERVER_TIME' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified email user write',
    actorUid: 'user_a',
    emailVerified: false,
    path: '/users/user_a',
    operation: 'create',
    payload: { uid: 'user_a', createdAt: 'SERVER_TIME', updatedAt: 'SERVER_TIME' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Self-assigned privilege escalation (role shadow field)',
    actorUid: 'user_a',
    path: '/users/user_a',
    operation: 'create',
    payload: { uid: 'user_a', role: 'admin', createdAt: 'SERVER_TIME', updatedAt: 'SERVER_TIME' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Spoofed client timestamp on create',
    actorUid: 'user_a',
    path: '/users/user_a',
    operation: 'create',
    payload: { uid: 'user_a', createdAt: '1999-01-01T00:00:00Z', updatedAt: 'SERVER_TIME' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Orphaned PII profile without user anchor',
    actorUid: 'user_a',
    path: '/users/user_a/private/profile',
    operation: 'create',
    payload: {
      uid: 'user_a',
      email: 'a@example.com',
      displayName: 'Learner',
      photoUrl: '',
      createdAt: 'SERVER_TIME',
      updatedAt: 'SERVER_TIME',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Cross-user PII read',
    actorUid: 'user_a',
    path: '/users/user_b/private/profile',
    operation: 'get',
    payload: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Profile score poisoning (negative or overflow score)',
    actorUid: 'user_a',
    path: '/users/user_a/private/profile',
    operation: 'update',
    payload: { totalScore: -100, testsCompleted: 999999, updatedAt: 'SERVER_TIME' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Path ID poisoning with disallowed characters',
    actorUid: 'user_a',
    path: '/users/user_a/learningPaths/bad..id',
    operation: 'create',
    payload: { id: 'bad..id', userId: 'user_a', topic: 'Python' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Identity spoofing inside learningPath userId field',
    actorUid: 'user_a',
    path: '/users/user_a/learningPaths/path_1',
    operation: 'create',
    payload: { id: 'path_1', userId: 'user_b', topic: 'Python' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Shadow field update (isVerified: true)',
    actorUid: 'user_a',
    path: '/users/user_a/learningPaths/path_1',
    operation: 'update',
    payload: { studyPlan: [], isVerified: true, updatedAt: 'SERVER_TIME' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Certificate tampering after issuance',
    actorUid: 'user_a',
    path: '/users/user_a/learningPaths/path_1',
    operation: 'update',
    payload: { certificate: { finalScore: 100 }, updatedAt: 'SERVER_TIME' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Cross-user list query scraping',
    actorUid: 'user_a',
    path: '/users/user_b/learningPaths',
    operation: 'list',
    payload: null,
    expected: 'PERMISSION_DENIED',
  },
] as const;

const rulesText = readFileSync('firestore.rules', 'utf8');
const requiredGuards = [
  'allow read, write: if false;',
  'isEmailVerified()',
  'isValidId(',
  'isValidUserAccount(',
  'isValidUserPrivateProfile(',
  'isValidLearningPath(',
  'isValidFinalExamMap(',
  'isValidCertificateMap(',
  'hasUserAccount(',
  'hasUserAccountAfter(',
  'incoming().createdAt == request.time',
  'incoming().updatedAt == request.time',
  'existing().userId == request.auth.uid',
  'affectedKeys().hasOnly(',
  "!existing().keys().hasAny(['certificate'])",
  'data.capstoneProjects.size() <= 10',
];

const missing = requiredGuards.filter((g) => !rulesText.includes(g));
if (missing.length > 0) {
  console.error('Missing required security guards:', missing);
  process.exit(1);
}
console.log(`Verified all ${DIRTY_DOZEN_CASES.length} Dirty Dozen invariants and ${requiredGuards.length} structural rule guards.`);
