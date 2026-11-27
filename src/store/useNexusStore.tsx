import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { GameId, NexusProgress, SavedProjectBlueprint, SEMESTER_3_SUBJECTS } from "../types/nexus";
import { tutorVoice } from "../services/tutorVoice";
import { useAuth } from "./useAuthStore";
import {
  deleteProjectFromCloud,
  loadNexusProgressFromCloud,
  loadProjectsFromCloud,
  saveProjectToCloud,
  syncNexusProgressToCloud,
} from "../services/firebaseDataService";

const STORAGE_KEY = "makaut_nexus_3d_progress_v1";
const VOICE_STORAGE_KEY = "makaut_nexus_3d_voice_enabled_v1";

function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

const DEFAULT_PROGRESS: NexusProgress = {
  xp: 1250,
  streak: 5,
  lastActiveDate: getTodayIso(),
  completedLevels: {
    "pointer-3d": [],
    "fetch-cycle": [],
    "laser-prism": [],
    "bridge-kings": [],
    "break-even": [],
    "stack-surgeon": [],
  },
  bestScores: {
    "pointer-3d": 0,
    "fetch-cycle": 0,
    "laser-prism": 0,
    "bridge-kings": 0,
    "break-even": 0,
    "stack-surgeon": 0,
  },
  aptitudeBestScore: 0,
  aptitudeAttempts: 0,
  interviewShieldsCleared: [],
  savedProjects: [],
  activityLog: [
    {
      id: "init-1",
      text: "Semester 3 MAKAUT B.Tech IT syllabus synchronized",
      timestamp: "Today",
    },
    {
      id: "init-2",
      text: "Six interactive 3D engineering lab modules unlocked",
      timestamp: "Today",
    },
  ],
};

function loadProgress(): NexusProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROGRESS;
    const parsed = JSON.parse(raw) as Partial<NexusProgress>;
    const today = getTodayIso();
    let streak = parsed.streak ?? DEFAULT_PROGRESS.streak;
    if (parsed.lastActiveDate && parsed.lastActiveDate !== today) {
      const prev = new Date(parsed.lastActiveDate);
      const curr = new Date(today);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) streak += 1;
      else if (diffDays > 1) streak = 1;
    }
    return {
      ...DEFAULT_PROGRESS,
      ...parsed,
      streak,
      lastActiveDate: today,
      completedLevels: {
        ...DEFAULT_PROGRESS.completedLevels,
        ...(parsed.completedLevels || {}),
      },
      bestScores: {
        ...DEFAULT_PROGRESS.bestScores,
        ...(parsed.bestScores || {}),
      },
      savedProjects: parsed.savedProjects ?? [],
      activityLog: parsed.activityLog ?? DEFAULT_PROGRESS.activityLog,
    };
  } catch {
    return DEFAULT_PROGRESS;
  }
}

export interface NexusContextValue {
  progress: NexusProgress;
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  simulatedCgpa: number;
  totalLevelsCompleted: number;
  getSubjectMastery: (gameId: GameId) => number;
  recordLevelComplete: (gameId: GameId, levelNum: number, score: number, xpEarned: number) => void;
  recordAptitudeResult: (scorePercent: number, xpEarned: number) => void;
  recordInterviewShield: (shieldNum: number, score: number, xpEarned: number) => void;
  saveProjectBlueprint: (blueprint: SavedProjectBlueprint) => void;
  deleteProjectBlueprint: (id: string) => void;
  recordCustomLabComplete: (labTitle: string, subjectCode: string, xpEarned: number) => void;
  voiceEnabled: boolean;
  voiceSupported: boolean;
  toggleVoice: () => void;
  resetProgress: () => void;
}

const NexusContext = createContext<NexusContextValue | null>(null);

export function NexusProvider({ children }: { children: React.ReactNode }) {
  const { authReady, user, isVerified, profile } = useAuth();
  const [progress, setProgress] = useState<NexusProgress>(() => loadProgress());
  const cloudHydratedUidRef = useRef<string | null>(null);
  const voiceSupported = tutorVoice.isSupported();
  const [voiceEnabled, setVoiceEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(VOICE_STORAGE_KEY);
      return saved === null ? true : saved === "true";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // ignore quota errors
    }
  }, [progress]);

  useEffect(() => {
    try {
      localStorage.setItem(VOICE_STORAGE_KEY, String(voiceEnabled));
    } catch {
      // ignore
    }
    if (!voiceEnabled) {
      tutorVoice.cancel();
    }
  }, [voiceEnabled]);

  // Hydrate & merge progress + projects from Firestore when a verified user signs in
  useEffect(() => {
    if (!authReady || !user || !isVerified || !profile) {
      if (!user) cloudHydratedUidRef.current = null;
      return;
    }
    if (cloudHydratedUidRef.current === user.uid) return;
    cloudHydratedUidRef.current = user.uid;

    let cancelled = false;
    void (async () => {
      try {
        const [cloudProg, cloudProjects] = await Promise.all([
          loadNexusProgressFromCloud(user.uid),
          loadProjectsFromCloud(user.uid),
        ]);
        if (cancelled) return;

        setProgress((local) => {
          const mergedLevels: Record<GameId, number[]> = { ...local.completedLevels };
          const mergedBest: Record<GameId, number> = { ...local.bestScores };
          (Object.keys(DEFAULT_PROGRESS.completedLevels) as GameId[]).forEach((gid) => {
            const cLvls = cloudProg?.completedLevels?.[gid] ?? [];
            const lLvls = local.completedLevels[gid] ?? [];
            mergedLevels[gid] = Array.from(new Set([...lLvls, ...cLvls])).sort((a, b) => a - b);
            mergedBest[gid] = Math.max(local.bestScores[gid] ?? 0, cloudProg?.bestScores?.[gid] ?? 0);
          });

          const byId = new Map<string, SavedProjectBlueprint>();
          [...cloudProjects, ...local.savedProjects].forEach((p) => byId.set(p.id, p));

          return {
            ...local,
            xp: Math.max(local.xp, cloudProg?.xp ?? 0),
            streak: Math.max(local.streak, cloudProg?.streak ?? 0),
            aptitudeBestScore: Math.max(local.aptitudeBestScore, cloudProg?.aptitudeBestScore ?? 0),
            aptitudeAttempts: Math.max(local.aptitudeAttempts, cloudProg?.aptitudeAttempts ?? 0),
            interviewShieldsCleared: Array.from(
              new Set([
                ...local.interviewShieldsCleared,
                ...(cloudProg?.interviewShieldsCleared ?? []),
              ])
            ).sort((a, b) => a - b),
            completedLevels: mergedLevels,
            bestScores: mergedBest,
            savedProjects: Array.from(byId.values()),
            activityLog:
              (cloudProg?.activityLog?.length ?? 0) > local.activityLog.length
                ? (cloudProg?.activityLog ?? local.activityLog)
                : local.activityLog,
          };
        });
      } catch (err) {
        console.error("Cloud progress hydration failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, user, isVerified, profile]);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled((prev) => {
      const next = !prev;
      if (!next) tutorVoice.cancel();
      return next;
    });
  }, []);

  const xpPerLevel = 1000;
  const level = Math.floor(progress.xp / xpPerLevel) + 1;
  const xpIntoLevel = progress.xp % xpPerLevel;
  const xpForNextLevel = xpPerLevel;

  const getSubjectMastery = useCallback(
    (gameId: GameId) => {
      const done = progress.completedLevels[gameId]?.length ?? 0;
      const meta = SEMESTER_3_SUBJECTS.find((s) => s.id === gameId);
      const total = meta?.totalLevels ?? 3;
      return Math.min(100, Math.round((done / total) * 100));
    },
    [progress.completedLevels]
  );

  const totalLevelsCompleted = Object.values(progress.completedLevels).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  // Dynamic CGPA simulator: baseline 8.45, scales up to 9.85 with mastery & placement progress
  const totalPossible = SEMESTER_3_SUBJECTS.length * 3;
  const academicRatio = totalPossible > 0 ? totalLevelsCompleted / totalPossible : 0;
  const placementBonus =
    (progress.interviewShieldsCleared.length / 3) * 0.25 +
    (progress.aptitudeBestScore / 100) * 0.15;
  const simulatedCgpa = Math.min(9.95, Number((8.45 + academicRatio * 1.15 + placementBonus).toFixed(2)));

  // Debounced cloud sync whenever a verified user with an onboarded profile updates progress
  useEffect(() => {
    if (!authReady || !user || !isVerified || !profile) return;
    const timer = setTimeout(() => {
      void syncNexusProgressToCloud(user.uid, progress, {
        level,
        simulatedCgpa,
        totalLevelsCompleted,
      }).catch((err) => {
        console.error("Failed to sync progress to Firestore:", err);
      });
    }, 900);
    return () => clearTimeout(timer);
  }, [authReady, user, isVerified, profile, progress, level, simulatedCgpa, totalLevelsCompleted]);

  const recordLevelComplete = useCallback(
    (gameId: GameId, levelNum: number, score: number, xpEarned: number) => {
      const meta = SEMESTER_3_SUBJECTS.find((s) => s.id === gameId);
      setProgress((prev) => {
        const existing = prev.completedLevels[gameId] || [];
        const isFirstClear = !existing.includes(levelNum);
        const updatedLevels = isFirstClear ? [...existing, levelNum].sort((a, b) => a - b) : existing;
        const awardXp = isFirstClear ? xpEarned : Math.round(xpEarned * 0.25);
        return {
          ...prev,
          xp: prev.xp + awardXp,
          completedLevels: {
            ...prev.completedLevels,
            [gameId]: updatedLevels,
          },
          bestScores: {
            ...prev.bestScores,
            [gameId]: Math.max(prev.bestScores[gameId] || 0, score),
          },
          activityLog: [
            {
              id: `lvl-${Date.now()}`,
              text: `Cleared ${meta?.gameTitle ?? gameId} — Level ${levelNum}`,
              xpDelta: awardXp,
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
            ...prev.activityLog.slice(0, 9),
          ],
        };
      });
    },
    []
  );

  const recordAptitudeResult = useCallback((scorePercent: number, xpEarned: number) => {
    setProgress((prev) => ({
      ...prev,
      xp: prev.xp + xpEarned,
      aptitudeBestScore: Math.max(prev.aptitudeBestScore, scorePercent),
      aptitudeAttempts: prev.aptitudeAttempts + 1,
      activityLog: [
        {
          id: `apt-${Date.now()}`,
          text: `TSA Aptitude Gauntlet completed (${scorePercent}%)`,
          xpDelta: xpEarned,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
        ...prev.activityLog.slice(0, 9),
      ],
    }));
  }, []);

  const recordInterviewShield = useCallback((shieldNum: number, score: number, xpEarned: number) => {
    setProgress((prev) => {
      const cleared = prev.interviewShieldsCleared.includes(shieldNum)
        ? prev.interviewShieldsCleared
        : [...prev.interviewShieldsCleared, shieldNum].sort((a, b) => a - b);
      return {
        ...prev,
        xp: prev.xp + xpEarned,
        interviewShieldsCleared: cleared,
        activityLog: [
          {
            id: `int-${Date.now()}`,
            text: `Interview Boss Shield ${shieldNum} evaluated (${score}/100)`,
            xpDelta: xpEarned,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
          ...prev.activityLog.slice(0, 9),
        ],
      };
    });
  }, []);

  const saveProjectBlueprint = useCallback(
    (blueprint: SavedProjectBlueprint) => {
      setProgress((prev) => ({
        ...prev,
        xp: prev.xp + 120,
        savedProjects: [blueprint, ...prev.savedProjects.filter((p) => p.id !== blueprint.id)],
        activityLog: [
          {
            id: `prj-${Date.now()}`,
            text: `Forged Capstone Blueprint: ${blueprint.title}`,
            xpDelta: 120,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
          ...prev.activityLog.slice(0, 9),
        ],
      }));
      if (user && isVerified && profile) {
        void saveProjectToCloud(user.uid, blueprint).catch((err) => {
          console.error("Cloud project save failed:", err);
        });
      }
    },
    [user, isVerified, profile]
  );

  const deleteProjectBlueprint = useCallback(
    (id: string) => {
      setProgress((prev) => ({
        ...prev,
        savedProjects: prev.savedProjects.filter((p) => p.id !== id),
      }));
      if (user && isVerified && profile) {
        void deleteProjectFromCloud(user.uid, id).catch((err) => {
          console.error("Cloud project delete failed:", err);
        });
      }
    },
    [user, isVerified, profile]
  );

  const recordCustomLabComplete = useCallback(
    (labTitle: string, subjectCode: string, xpEarned: number) => {
      setProgress((prev) => ({
        ...prev,
        xp: prev.xp + xpEarned,
        activityLog: [
          {
            id: `pyq-${Date.now()}`,
            text: `Cleared Custom AI Lab (${subjectCode}): ${labTitle}`,
            xpDelta: xpEarned,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
          ...prev.activityLog.slice(0, 9),
        ],
      }));
    },
    []
  );

  const resetProgress = useCallback(() => {
    setProgress(DEFAULT_PROGRESS);
  }, []);

  return (
    <NexusContext.Provider
      value={{
        progress,
        level,
        xpIntoLevel,
        xpForNextLevel,
        simulatedCgpa,
        totalLevelsCompleted,
        getSubjectMastery,
        recordLevelComplete,
        recordAptitudeResult,
        recordInterviewShield,
        saveProjectBlueprint,
        deleteProjectBlueprint,
        recordCustomLabComplete,
        voiceEnabled,
        voiceSupported,
        toggleVoice,
        resetProgress,
      }}
    >
      {children}
    </NexusContext.Provider>
  );
}

export function useNexus() {
  const ctx = useContext(NexusContext);
  if (!ctx) throw new Error("useNexus must be used within NexusProvider");
  return ctx;
}
