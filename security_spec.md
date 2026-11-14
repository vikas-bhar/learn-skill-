# SkillPath AI — Firestore Security Specification

## 1. Data Invariants

1. **Ownership & Master Gate**:
   - Every `/users/{userId}` document must have `uid == userId` matching `request.auth.uid`, with a verified email (`request.auth.token.email_verified == true`).
   - `/users/{userId}/private/{profileDocId}` (`profileDocId == "profile"`) and `/users/{userId}/learningPaths/{pathId}` cannot exist without an active `/users/{userId}` parent anchor (`exists()` / `get()` on reads/updates/deletes/learningPath writes, and `existsAfter()` / `getAfter()` on atomic batch account registration).
2. **PII Isolation & Score Bounds**:
   - Personal identifiers (`email`, `displayName`, `photoUrl`) and cumulative learner score metrics (`totalScore`, `testsCompleted`, `videosCompleted`, `certificatesEarned`) are stored strictly in `/users/{userId}/private/profile` and are readable/writable ONLY by `isOwner(userId)` with verified auth. No blanket `isSignedIn()` reads or `list` access exist on `users` or `private`.
   - Score counters must be non-negative bounded integers (`totalScore <= 1000000`, `testsCompleted <= 10000`, `videosCompleted <= 10000`, `certificatesEarned <= 1000`).
3. **Strict Schema & No Shadow Fields**:
   - All entities enforce exact `keys().hasAll(...)` and `keys().hasOnly(...)` on create, and action-scoped `affectedKeys().hasOnly(...)` on update, backed by standalone `isValid*` helpers on both `create` and `update`.
   - No `role` or `isAdmin` fields are accepted anywhere on client-created documents.
4. **Path Variable & Volumetric Guards**:
   - Every document ID path variable (`userId`, `profileDocId`, `pathId`) is validated with `isValidId(...)` (`<= 128` chars, `^[a-zA-Z0-9_\-]+$`) on single-document operations (`get`, `create`, `update`, `delete`).
   - Every string and array enforces explicit `.size()` boundaries, and bounded arrays validate first-element types when non-empty.
5. **Terminal State Locking (Certificates) & Project Gating**:
   - Once a `certificate` map is issued on a `learningPaths/{pathId}` document, it cannot be altered or overwritten by subsequent client updates.
   - Assigned `capstoneProjects` arrays on `learningPaths/{pathId}` are strictly bounded (`<= 10` items) and updated only through dedicated allowlisted `affectedKeys().hasOnly(...)` action branches.
6. **Temporal Integrity & Immutability**:
   - `createdAt` must equal `request.time` on `create` and remain immutable on `update`.
   - `updatedAt` must equal `request.time` on `create` and `update`.
   - `uid`, `id`, and `userId` are immutable after creation.
7. **Secure List Queries**:
   - Listing `/users/{userId}/learningPaths` is restricted to `isSignedIn() && isEmailVerified() && isOwner(userId) && resource.data.userId == request.auth.uid` with zero `get()`/`exists()` calls inside `allow list`.

---

## 2. The "Dirty Dozen" Adversarial Payloads

| # | Target | Attack Vector | Expected Result |
|---|--------|---------------|-----------------|
| 1 | `/users/user_b` | Cross-tenant create (`user_a` creating doc under `user_b`) | `PERMISSION_DENIED` |
| 2 | `/users/user_a` | Unverified email token (`email_verified: false`) attempting create | `PERMISSION_DENIED` |
| 3 | `/users/user_a` | Self-assigned privilege escalation (`{ uid: "user_a", role: "admin", ... }`) | `PERMISSION_DENIED` |
| 4 | `/users/user_a` | Spoofed client timestamp (`createdAt: new Date(0)` instead of `request.time`) | `PERMISSION_DENIED` |
| 5 | `/users/user_a/private/profile` | Orphaned PII profile write without `/users/user_a` anchor in batch | `PERMISSION_DENIED` |
| 6 | `/users/user_b/private/profile` | Cross-user PII read (`user_a` reading `user_b`'s email/profile) | `PERMISSION_DENIED` |
| 7 | `/users/user_a/private/profile` | Negative or overflow score poisoning (`totalScore: -50` or `99999999`) | `PERMISSION_DENIED` |
| 8 | `/users/user_a/learningPaths/bad..id` | Path ID poisoning (`..` or >128 char ID) | `PERMISSION_DENIED` |
| 9 | `/users/user_a/learningPaths/path_1` | Identity spoofing (`userId: "user_b"` inside `user_a` subcollection) | `PERMISSION_DENIED` |
| 10 | `/users/user_a/learningPaths/path_1` | Shadow field update (`isVerified: true` injected alongside `studyPlan`) | `PERMISSION_DENIED` |
| 11 | `/users/user_a/learningPaths/path_1` | Certificate tampering after certificate issuance (`certificate.finalScore: 100`) | `PERMISSION_DENIED` |
| 12 | `/users/user_b/learningPaths` | Cross-user list query scraping (`user_a` querying `user_b`'s paths) | `PERMISSION_DENIED` |
