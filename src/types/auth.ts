import { PyqLabConfig } from "./pyqLab";

export type UserRole = "student" | "mentor" | "admin";

export const BOOTSTRAPPED_ADMIN_EMAIL = "RAIROYCHOWDHURY@gmail.com";

export interface UserProfile {
  uid: string;
  displayName: string;
  role: UserRole;
  department: string;
  semester: string;
  xp: number;
  level: number;
  streak: number;
  simulatedCgpa: number;
  totalLevelsCompleted: number;
  isCohortVisible: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PrivateAccountInfo {
  uid: string;
  email: string;
  rollNumber: string;
  authProvider: "google" | "password";
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface MentorRoleRequestRecord {
  uid: string;
  displayName: string;
  department: string;
  facultyCode: string;
  justification: string;
  status: "pending" | "approved" | "rejected";
  reviewedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserPyqHistoryRecord {
  id: string;
  uid: string;
  title: string;
  subjectCode: string;
  questionText: string;
  templateType: string;
  storagePath: string;
  imageUrl: string;
  config: PyqLabConfig;
  completed: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CuratedPyqLabRecord {
  id: string;
  authorId: string;
  authorName: string;
  title: string;
  subjectCode: string;
  questionText: string;
  storagePath: string;
  imageUrl: string;
  config: PyqLabConfig;
  status: "published" | "archived";
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DsaSubmissionRecord {
  id: string;
  uid: string;
  problemId: string;
  language: "python" | "cpp" | "java" | "c";
  code: string;
  matchScore: number;
  verdict: "aligned" | "matched" | "partial" | "needs-work" | "draft";
  summary: string;
  updatedAt?: unknown;
}
