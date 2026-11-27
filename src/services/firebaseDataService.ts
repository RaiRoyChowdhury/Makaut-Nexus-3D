import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  User,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  storage,
} from "./firebaseClient";
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  CuratedPyqLabRecord,
  DsaSubmissionRecord,
  MentorRoleRequestRecord,
  PrivateAccountInfo,
  UserProfile,
  UserPyqHistoryRecord,
  UserRole,
} from "../types/auth";
import { NexusProgress, SavedProjectBlueprint } from "../types/nexus";
import { PyqLabConfig } from "../types/pyqLab";

export function sanitizeId(raw: string, fallback = "item"): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 120);
  return cleaned.length > 0 ? cleaned : fallback;
}

function clampStr(val: unknown, maxLen: number, fallback = "", minLen = 0): string {
  const s = typeof val === "string" ? val.trim() : "";
  const clipped = s.slice(0, maxLen);
  if (clipped.length < minLen) return fallback.slice(0, maxLen);
  return clipped;
}

function clampNumber(val: unknown, min: number, max: number, fallback = 0): number {
  const n = typeof val === "number" && Number.isFinite(val) ? val : fallback;
  return Math.min(max, Math.max(min, n));
}

function clampStringArray(val: unknown, maxItems: number, maxItemLen = 220): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, maxItems)
    .map((item) => item.trim().slice(0, maxItemLen));
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((v) => stripUndefined(v)) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefined(v);
      }
    }
    return out as T;
  }
  return value;
}

export function isBootstrappedAdminEmail(email?: string | null): boolean {
  return Boolean(email && email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase());
}

// -----------------------------------------------------------------------------
// Authentication Actions
// -----------------------------------------------------------------------------
export async function signInWithGooglePopup(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function createEmailPasswordAccount(params: {
  email: string;
  password: string;
  displayName: string;
}): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, params.email.trim(), params.password);
  const safeName = clampStr(params.displayName, 60, "MAKAUT Student", 2);
  await updateProfile(cred.user, { displayName: safeName });
  try {
    await sendEmailVerification(cred.user);
  } catch {
    // Non-fatal if rate-limited
  }
  return cred.user;
}

export async function signInWithEmailPasswordAccount(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function resendVerificationForCurrentUser(): Promise<void> {
  if (!auth.currentUser) throw new Error("No signed-in user.");
  await sendEmailVerification(auth.currentUser);
}

export async function signOutCurrentUser(): Promise<void> {
  await signOut(auth);
}

// -----------------------------------------------------------------------------
// Profile & Private PII & RBAC Provisioning
// -----------------------------------------------------------------------------
export interface OnboardingInput {
  displayName: string;
  department: string;
  semester: string;
  rollNumber: string;
  requestedRole: "student" | "mentor";
  facultyCode?: string;
  justification?: string;
  isCohortVisible?: boolean;
  xp?: number;
  level?: number;
  streak?: number;
  simulatedCgpa?: number;
  totalLevelsCompleted?: number;
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const path = `user_profiles/${uid}`;
  try {
    const snap = await getDoc(doc(db, "user_profiles", uid));
    return snap.exists() ? (snap.data() as UserProfile) : null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function fetchPrivateAccount(uid: string): Promise<PrivateAccountInfo | null> {
  const path = `users/${uid}/private/account`;
  try {
    const snap = await getDoc(doc(db, "users", uid, "private", "account"));
    return snap.exists() ? (snap.data() as PrivateAccountInfo) : null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function fetchOwnMentorRequest(uid: string): Promise<MentorRoleRequestRecord | null> {
  const path = `mentor_requests/${uid}`;
  try {
    const snap = await getDoc(doc(db, "mentor_requests", uid));
    return snap.exists() ? (snap.data() as MentorRoleRequestRecord) : null;
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function createOrSyncAccountRecords(
  user: User,
  input: OnboardingInput
): Promise<{ profile: UserProfile; privateInfo: PrivateAccountInfo; mentorRequest: MentorRoleRequestRecord | null }> {
  const uid = sanitizeId(user.uid, "user");
  const isAdminEmail = Boolean(user.emailVerified && isBootstrappedAdminEmail(user.email));
  const authProvider: "google" | "password" = user.providerData.some(
    (p) => p.providerId === "google.com"
  )
    ? "google"
    : "password";

  const existingProfile = await fetchUserProfile(uid);
  const safeName = clampStr(input.displayName || user.displayName || "MAKAUT Learner", 60, "MAKAUT Learner", 2);
  const safeDept = clampStr(input.department, 40, "B.Tech IT", 2);
  const safeSem = clampStr(input.semester, 20, "Semester 03", 1);
  const safeRoll = clampStr(input.rollNumber, 40, "", 0);
  const safeEmail = clampStr(user.email || `${uid}@nexus.local`, 120, "student@nexus.local", 3);

  const profilePath = `user_profiles/${uid}`;
  let finalRole: UserRole = existingProfile?.role ?? "student";
  if (isAdminEmail) {
    finalRole = "admin";
    try {
      await setDoc(doc(db, "admins", uid), {
        uid,
        email: safeEmail,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `admins/${uid}`);
    }
  }

  const profilePayload = {
    uid,
    displayName: safeName,
    role: finalRole,
    department: safeDept,
    semester: safeSem,
    xp: clampNumber(input.xp ?? existingProfile?.xp, 0, 10000000, 1250),
    level: clampNumber(input.level ?? existingProfile?.level, 1, 500, 2),
    streak: clampNumber(input.streak ?? existingProfile?.streak, 0, 3650, 5),
    simulatedCgpa: clampNumber(input.simulatedCgpa ?? existingProfile?.simulatedCgpa, 0, 10, 8.45),
    totalLevelsCompleted: clampNumber(input.totalLevelsCompleted ?? existingProfile?.totalLevelsCompleted, 0, 500, 0),
    isCohortVisible: input.isCohortVisible ?? existingProfile?.isCohortVisible ?? true,
    updatedAt: serverTimestamp(),
  };

  try {
    if (!existingProfile) {
      await setDoc(doc(db, "user_profiles", uid), {
        ...profilePayload,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, "user_profiles", uid), profilePayload);
    }
  } catch (err) {
    handleFirestoreError(err, existingProfile ? OperationType.UPDATE : OperationType.CREATE, profilePath);
  }

  const privatePath = `users/${uid}/private/account`;
  const existingPrivate = await fetchPrivateAccount(uid);
  try {
    if (!existingPrivate) {
      await setDoc(doc(db, "users", uid, "private", "account"), {
        uid,
        email: safeEmail,
        rollNumber: safeRoll,
        authProvider,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, "users", uid, "private", "account"), {
        email: safeEmail,
        rollNumber: safeRoll,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, existingPrivate ? OperationType.UPDATE : OperationType.CREATE, privatePath);
  }

  let mentorRequest: MentorRoleRequestRecord | null = await fetchOwnMentorRequest(uid);
  if (input.requestedRole === "mentor" && finalRole === "student" && !mentorRequest) {
    const reqPath = `mentor_requests/${uid}`;
    const reqDoc = {
      uid,
      displayName: safeName,
      department: safeDept,
      facultyCode: clampStr(input.facultyCode || "FAC-MAKAUT", 40, "FAC-MAKAUT", 2),
      justification: clampStr(
        input.justification || "Faculty / Mentor requesting access to curate MAKAUT PYQ 3D labs and monitor cohort readiness.",
        400,
        "Mentor verification request",
        4
      ),
      status: "pending" as const,
      reviewedBy: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(doc(db, "mentor_requests", uid), reqDoc);
      mentorRequest = reqDoc;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, reqPath);
    }
  }

  const freshProfile = (await fetchUserProfile(uid)) ?? {
    ...profilePayload,
    role: finalRole,
  };
  const freshPrivate = (await fetchPrivateAccount(uid)) ?? {
    uid,
    email: safeEmail,
    rollNumber: safeRoll,
    authProvider,
  };

  return { profile: freshProfile, privateInfo: freshPrivate, mentorRequest };
}

export async function submitMentorRoleRequest(params: {
  uid: string;
  displayName: string;
  department: string;
  facultyCode: string;
  justification: string;
}): Promise<MentorRoleRequestRecord> {
  const uid = sanitizeId(params.uid, "user");
  const path = `mentor_requests/${uid}`;
  const existing = await fetchOwnMentorRequest(uid);
  const payload = {
    uid,
    displayName: clampStr(params.displayName, 60, "Faculty Member", 2),
    department: clampStr(params.department, 40, "B.Tech IT", 2),
    facultyCode: clampStr(params.facultyCode, 40, "FAC-IT", 2),
    justification: clampStr(params.justification, 400, "Mentor access request", 4),
    status: "pending" as const,
    reviewedBy: "",
    updatedAt: serverTimestamp(),
  };

  try {
    if (!existing) {
      await setDoc(doc(db, "mentor_requests", uid), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, "mentor_requests", uid), {
        displayName: payload.displayName,
        department: payload.department,
        facultyCode: payload.facultyCode,
        justification: payload.justification,
        updatedAt: serverTimestamp(),
      });
    }
    return (await fetchOwnMentorRequest(uid)) ?? payload;
  } catch (err) {
    handleFirestoreError(err, existing ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

// -----------------------------------------------------------------------------
// Cloud Progression Sync
// -----------------------------------------------------------------------------
export async function loadNexusProgressFromCloud(uid: string): Promise<Partial<NexusProgress> | null> {
  const path = `users/${uid}/progress/nexus`;
  try {
    const snap = await getDoc(doc(db, "users", uid, "progress", "nexus"));
    if (!snap.exists()) return null;
    const data = snap.data();
    return {
      xp: typeof data.xp === "number" ? data.xp : 1250,
      streak: typeof data.streak === "number" ? data.streak : 5,
      lastActiveDate: typeof data.lastActiveDate === "string" ? data.lastActiveDate : new Date().toISOString().slice(0, 10),
      completedLevels: data.completedLevels || {},
      bestScores: data.bestScores || {},
      aptitudeBestScore: typeof data.aptitudeBestScore === "number" ? data.aptitudeBestScore : 0,
      aptitudeAttempts: typeof data.aptitudeAttempts === "number" ? data.aptitudeAttempts : 0,
      interviewShieldsCleared: Array.isArray(data.interviewShieldsCleared) ? data.interviewShieldsCleared : [],
      activityLog: Array.isArray(data.activityLog) ? data.activityLog : [],
    };
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, path);
  }
}

export async function syncNexusProgressToCloud(
  uid: string,
  progress: NexusProgress,
  stats: { level: number; simulatedCgpa: number; totalLevelsCompleted: number }
): Promise<void> {
  const safeUid = sanitizeId(uid, "user");
  const progressPath = `users/${safeUid}/progress/nexus`;
  const payload = stripUndefined({
    uid: safeUid,
    xp: clampNumber(progress.xp, 0, 10000000, 0),
    streak: clampNumber(progress.streak, 0, 3650, 0),
    lastActiveDate: clampStr(progress.lastActiveDate, 20, new Date().toISOString().slice(0, 10), 4),
    completedLevels: progress.completedLevels,
    bestScores: progress.bestScores,
    aptitudeBestScore: clampNumber(progress.aptitudeBestScore, 0, 100, 0),
    aptitudeAttempts: clampNumber(progress.aptitudeAttempts, 0, 100000, 0),
    interviewShieldsCleared: progress.interviewShieldsCleared.slice(0, 10),
    activityLog: progress.activityLog.slice(0, 12),
    updatedAt: serverTimestamp(),
  });

  try {
    await setDoc(doc(db, "users", safeUid, "progress", "nexus"), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, progressPath);
  }

  // Keep cohort-safe user_profiles telemetry aligned
  const profilePath = `user_profiles/${safeUid}`;
  try {
    const profileSnap = await getDoc(doc(db, "user_profiles", safeUid));
    if (profileSnap.exists()) {
      await updateDoc(doc(db, "user_profiles", safeUid), {
        xp: clampNumber(progress.xp, 0, 10000000, 0),
        level: clampNumber(stats.level, 1, 500, 1),
        streak: clampNumber(progress.streak, 0, 3650, 0),
        simulatedCgpa: clampNumber(stats.simulatedCgpa, 0, 10, 8.45),
        totalLevelsCompleted: clampNumber(stats.totalLevelsCompleted, 0, 500, 0),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, profilePath);
  }
}

// -----------------------------------------------------------------------------
// Capstone Projects Cloud CRUD
// -----------------------------------------------------------------------------
export async function loadProjectsFromCloud(uid: string): Promise<SavedProjectBlueprint[]> {
  const safeUid = sanitizeId(uid, "user");
  const path = `users/${safeUid}/projects`;
  try {
    const q = query(collection(db, "users", safeUid, "projects"), where("uid", "==", safeUid));
    const snaps = await getDocs(q);
    return snaps.docs.map((d) => {
      const data = d.data();
      return {
        id: data.id,
        title: data.title,
        domain: data.domain,
        difficulty: data.difficulty,
        problemStatement: data.problemStatement,
        proposedSolution: data.proposedSolution,
        coreFeatures: data.coreFeatures || [],
        techStack: data.techStack || [],
        roadmap: data.roadmap || [],
        extensions: data.extensions || [],
        createdAt: typeof data.createdAt === "string" ? data.createdAt : new Date().toISOString(),
        source: data.source === "gemini" ? "gemini" : "local",
      } as SavedProjectBlueprint;
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function saveProjectToCloud(uid: string, blueprint: SavedProjectBlueprint): Promise<void> {
  const safeUid = sanitizeId(uid, "user");
  const safeId = sanitizeId(blueprint.id, `proj-${Date.now()}`);
  const path = `users/${safeUid}/projects/${safeId}`;
  try {
    const existing = await getDoc(doc(db, "users", safeUid, "projects", safeId));
    const payload = {
      id: safeId,
      uid: safeUid,
      title: clampStr(blueprint.title, 140, "Capstone Project", 2),
      domain: clampStr(blueprint.domain, 80, "Engineering", 2),
      difficulty: clampStr(blueprint.difficulty, 40, "Intermediate", 2),
      problemStatement: clampStr(blueprint.problemStatement, 1200, "Problem statement", 4),
      proposedSolution: clampStr(blueprint.proposedSolution, 1500, "Proposed solution", 4),
      coreFeatures: clampStringArray(blueprint.coreFeatures, 12, 220),
      techStack: clampStringArray(blueprint.techStack, 15, 100),
      roadmap: clampStringArray(blueprint.roadmap, 12, 220),
      extensions: clampStringArray(blueprint.extensions, 10, 220),
      source: blueprint.source === "gemini" ? "gemini" : "local",
      updatedAt: serverTimestamp(),
    };
    if (!existing.exists()) {
      await setDoc(doc(db, "users", safeUid, "projects", safeId), {
        ...payload,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(doc(db, "users", safeUid, "projects", safeId), payload);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteProjectFromCloud(uid: string, projectId: string): Promise<void> {
  const safeUid = sanitizeId(uid, "user");
  const safeId = sanitizeId(projectId, "proj");
  const path = `users/${safeUid}/projects/${safeId}`;
  try {
    await deleteDoc(doc(db, "users", safeUid, "projects", safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

// -----------------------------------------------------------------------------
// Firebase Storage + PYQ Cloud Vault
// -----------------------------------------------------------------------------
export interface StorageUploadResult {
  storagePath: string;
  imageUrl: string;
  storedInCloud: boolean;
  warning?: string;
}

export async function uploadPyqImageToStorage(
  uid: string,
  file: File,
  folder: "pyq-uploads" | "curated-pyqs" = "pyq-uploads"
): Promise<StorageUploadResult> {
  const safeUid = sanitizeId(uid, "user");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64) || "pyq.png";
  const storagePath = `${folder}/${safeUid}/${Date.now()}_${safeName}`;
  const fileRef = ref(storage, storagePath);

  try {
    const uploadPromise = uploadBytes(fileRef, file, { contentType: file.type || "image/png" });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Storage upload timed out")), 10000)
    );
    await Promise.race([uploadPromise, timeoutPromise]);
    const imageUrl = await getDownloadURL(fileRef);
    return { storagePath, imageUrl, storedInCloud: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Firebase Storage upload unavailable";
    return {
      storagePath: "",
      imageUrl: "",
      storedInCloud: false,
      warning: msg,
    };
  }
}

export async function savePyqHistoryToCloud(
  uid: string,
  config: PyqLabConfig,
  storageMeta?: { storagePath?: string; imageUrl?: string }
): Promise<void> {
  const safeUid = sanitizeId(uid, "user");
  const safeLabId = sanitizeId(config.id || `pyq-${Date.now()}`, `pyq-${Date.now()}`);
  const path = `users/${safeUid}/pyq_history/${safeLabId}`;
  const cleanConfig = stripUndefined(config);
  try {
    await setDoc(doc(db, "users", safeUid, "pyq_history", safeLabId), {
      id: safeLabId,
      uid: safeUid,
      title: clampStr(config.labTitle, 140, "Custom PYQ 3D Lab", 2),
      subjectCode: clampStr(config.detectedSubjectCode, 40, "MAKAUT-IT", 2),
      questionText: clampStr(config.originalQuery, 1500, "MAKAUT Question", 2),
      templateType: clampStr(config.archetype, 60, "custom-lab", 2),
      storagePath: clampStr(storageMeta?.storagePath || "", 300, "", 0),
      imageUrl: clampStr(storageMeta?.imageUrl || "", 600, "", 0),
      config: cleanConfig,
      completed: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function loadPyqHistoryFromCloud(uid: string): Promise<UserPyqHistoryRecord[]> {
  const safeUid = sanitizeId(uid, "user");
  const path = `users/${safeUid}/pyq_history`;
  try {
    const q = query(collection(db, "users", safeUid, "pyq_history"), where("uid", "==", safeUid));
    const snaps = await getDocs(q);
    return snaps.docs.map((d) => d.data() as UserPyqHistoryRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

// -----------------------------------------------------------------------------
// DSA Logic-to-Code Submissions Cloud Sync
// -----------------------------------------------------------------------------
export async function saveDsaSubmissionToCloud(
  uid: string,
  submission: Omit<DsaSubmissionRecord, "id" | "uid" | "updatedAt">
): Promise<void> {
  const safeUid = sanitizeId(uid, "user");
  const subId = sanitizeId(`${submission.problemId}_${submission.language}`, "dsa-sub");
  const path = `users/${safeUid}/dsa_submissions/${subId}`;
  try {
    const existing = await getDoc(doc(db, "users", safeUid, "dsa_submissions", subId));
    const payload = {
      id: subId,
      uid: safeUid,
      problemId: sanitizeId(submission.problemId, "problem"),
      language: submission.language,
      code: clampStr(submission.code, 8000, "// code", 1),
      matchScore: clampNumber(submission.matchScore, 0, 100, 0),
      verdict: submission.verdict,
      summary: clampStr(submission.summary, 500, "", 0),
      updatedAt: serverTimestamp(),
    };
    if (!existing.exists()) {
      await setDoc(doc(db, "users", safeUid, "dsa_submissions", subId), payload);
    } else {
      await updateDoc(doc(db, "users", safeUid, "dsa_submissions", subId), {
        code: payload.code,
        matchScore: payload.matchScore,
        verdict: payload.verdict,
        summary: payload.summary,
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function loadDsaSubmissionsFromCloud(uid: string): Promise<DsaSubmissionRecord[]> {
  const safeUid = sanitizeId(uid, "user");
  const path = `users/${safeUid}/dsa_submissions`;
  try {
    const q = query(collection(db, "users", safeUid, "dsa_submissions"), where("uid", "==", safeUid));
    const snaps = await getDocs(q);
    return snaps.docs.map((d) => d.data() as DsaSubmissionRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

// -----------------------------------------------------------------------------
// Mentor & Admin RBAC Portal Queries & Mutations
// -----------------------------------------------------------------------------
export async function fetchCohortProfiles(): Promise<UserProfile[]> {
  const path = "user_profiles";
  try {
    const q = query(collection(db, "user_profiles"), where("isCohortVisible", "==", true));
    const snaps = await getDocs(q);
    return snaps.docs
      .map((d) => d.data() as UserProfile)
      .sort((a, b) => (b.xp || 0) - (a.xp || 0));
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function fetchPublishedCuratedPyqs(): Promise<CuratedPyqLabRecord[]> {
  const path = "curated_pyqs";
  try {
    const q = query(collection(db, "curated_pyqs"), where("status", "==", "published"));
    const snaps = await getDocs(q);
    return snaps.docs.map((d) => d.data() as CuratedPyqLabRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function publishCuratedPyqLab(params: {
  authorId: string;
  authorName: string;
  config: PyqLabConfig;
  storageMeta?: { storagePath?: string; imageUrl?: string };
}): Promise<CuratedPyqLabRecord> {
  const safeAuthorId = sanitizeId(params.authorId, "mentor");
  const pyqId = sanitizeId(`curated-${Date.now()}`, `curated-${Date.now()}`);
  const path = `curated_pyqs/${pyqId}`;
  const cleanConfig = stripUndefined(params.config);
  const payload = {
    id: pyqId,
    authorId: safeAuthorId,
    authorName: clampStr(params.authorName, 60, "MAKAUT Mentor", 2),
    title: clampStr(params.config.labTitle, 140, "Curated PYQ 3D Lab", 2),
    subjectCode: clampStr(params.config.detectedSubjectCode, 40, "PCC-CS301", 2),
    questionText: clampStr(params.config.originalQuery, 1500, "Official MAKAUT PYQ", 4),
    storagePath: clampStr(params.storageMeta?.storagePath || "", 300, "", 0),
    imageUrl: clampStr(params.storageMeta?.imageUrl || "", 600, "", 0),
    config: cleanConfig,
    status: "published" as const,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, "curated_pyqs", pyqId), payload);
    return payload as CuratedPyqLabRecord;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function deleteCuratedPyqLab(pyqId: string): Promise<void> {
  const safeId = sanitizeId(pyqId, "curated");
  const path = `curated_pyqs/${safeId}`;
  try {
    await deleteDoc(doc(db, "curated_pyqs", safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function fetchAllMentorRequestsForAdmin(): Promise<MentorRoleRequestRecord[]> {
  const path = "mentor_requests";
  try {
    const snaps = await getDocs(collection(db, "mentor_requests"));
    return snaps.docs.map((d) => d.data() as MentorRoleRequestRecord);
  } catch (err) {
    handleFirestoreError(err, OperationType.LIST, path);
  }
}

export async function reviewMentorRoleRequest(params: {
  targetUid: string;
  decision: "approved" | "rejected";
  reviewerUid: string;
}): Promise<void> {
  const safeTarget = sanitizeId(params.targetUid, "user");
  const reqPath = `mentor_requests/${safeTarget}`;
  try {
    await updateDoc(doc(db, "mentor_requests", safeTarget), {
      status: params.decision,
      reviewedBy: sanitizeId(params.reviewerUid, "admin"),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, reqPath);
  }

  if (params.decision === "approved") {
    const profilePath = `user_profiles/${safeTarget}`;
    try {
      await updateDoc(doc(db, "user_profiles", safeTarget), {
        role: "mentor",
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, profilePath);
    }
  }
}
