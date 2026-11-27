# Security Specification — MAKAUT NEXUS 3D

## Data Invariants
1. **Default-Deny & Zero-Trust Identity**: Every document under `/databases/{database}/documents` is denied by default. All authenticated writes require `request.auth != null && request.auth.token.email_verified == true`.
2. **Prevent Self-Assigned Roles**: On `create` of `/user_profiles/{userId}`, non-admin users may ONLY set `role == 'student'`. They cannot self-assign `'mentor'` or `'admin'`.
3. **Immutable Ownership & Timestamps**: `uid` / `authorId` and `createdAt` cannot be modified after creation. `createdAt == request.time` on create; `updatedAt == request.time` on update.
4. **PII Isolation (Split Collection)**: `email` and `rollNumber` live strictly inside `/users/{userId}/private/account`, readable/writable only by `isOwner(userId)` or `isAdmin()` (never listable). `/user_profiles/{userId}` contains zero PII.
5. **Strict Key & Size Bounds**: Every `create` checks `keys().hasAll(...) && keys().hasOnly(...)`; every `update` uses action-based `affectedKeys().hasOnly(...)` wrapped by `isValidEntity(incoming())`. Every string/list has `.size()` caps.
6. **Curated Content RBAC**: Only verified `mentor` (via trusted `user_profiles/{uid}.role == 'mentor'`) or `admin` can create/update/archive `/curated_pyqs/{pyqId}`.
7. **Terminal Locking**: Once `/mentor_requests/{userId}.status` becomes `'approved'` or `'rejected'`, non-admins cannot revert or modify it.
8. **Secure List Queries**: No `get()` or `exists()` calls inside `allow list` rules; every `allow list` evaluates `resource.data` directly.

## Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Self-Role Escalation on Signup**: `POST /user_profiles/u1` with `{ ..., role: "admin" }` by a non-admin user -> DENIED.
2. **Role Tampering on Update**: `PATCH /user_profiles/u1` modifying `{ role: "mentor" }` by owner `u1` -> DENIED.
3. **Identity Spoofing**: `POST /user_profiles/u2` while authenticated as `u1` -> DENIED.
4. **Shadow Field Injection**: `POST /user_profiles/u1` with extra key `{ isVerified: true }` -> DENIED.
5. **PII Cross-Read**: `GET /users/u2/private/account` authenticated as `u1` (non-admin) -> DENIED.
6. **PII Collection Scrape**: `LIST /users/u1/private` -> DENIED.
7. **Unverified Email Bypass**: Admin email claim with `email_verified: false` -> DENIED.
8. **Client Timestamp Forgery**: `POST /user_profiles/u1` with `createdAt: "2020-01-01T00:00:00Z"` instead of `request.time` -> DENIED.
9. **Path ID Poisoning**: `POST /users/u1/projects/${"a".repeat(200)}` -> DENIED by `isValidId()`.
10. **Student Publishing Curated PYQ**: `POST /curated_pyqs/p1` by a user whose `user_profiles/{uid}.role == "student"` -> DENIED.
11. **Terminal Mentor Request Replay**: `PATCH /mentor_requests/u1` changing `status` from `"rejected"` back to `"approved"` by `u1` -> DENIED.
12. **Value Poisoning / Oversized Payload**: `PATCH /users/u1/dsa_submissions/s1` with `code` length 20,000 chars or invalid `language: "rust"` -> DENIED.
