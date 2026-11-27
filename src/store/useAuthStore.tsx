import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
} from "../services/firebaseClient";
import {
  createOrSyncAccountRecords,
  fetchOwnMentorRequest,
  fetchPrivateAccount,
  fetchPublishedCuratedPyqs,
  fetchUserProfile,
  loadPyqHistoryFromCloud,
  OnboardingInput,
  signOutCurrentUser,
} from "../services/firebaseDataService";
import {
  CuratedPyqLabRecord,
  MentorRoleRequestRecord,
  PrivateAccountInfo,
  UserProfile,
  UserPyqHistoryRecord,
  UserRole,
} from "../types/auth";

export type CloudSyncStatus = "guest" | "unverified" | "onboarding" | "syncing" | "synced" | "error";

export interface AuthContextValue {
  authReady: boolean;
  user: User | null;
  profile: UserProfile | null;
  privateAccount: PrivateAccountInfo | null;
  mentorRequest: MentorRoleRequestRecord | null;
  role: UserRole | "guest";
  isVerified: boolean;
  isMentor: boolean;
  isAdmin: boolean;
  needsOnboarding: boolean;
  cloudStatus: CloudSyncStatus;
  pyqHistory: UserPyqHistoryRecord[];
  curatedPyqs: CuratedPyqLabRecord[];
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  portalModalOpen: boolean;
  setPortalModalOpen: (open: boolean) => void;
  completeOnboarding: (input: OnboardingInput) => Promise<void>;
  refreshUserSession: () => Promise<void>;
  refreshCloudVault: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [privateAccount, setPrivateAccount] = useState<PrivateAccountInfo | null>(null);
  const [mentorRequest, setMentorRequest] = useState<MentorRoleRequestRecord | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<CloudSyncStatus>("guest");
  const [pyqHistory, setPyqHistory] = useState<UserPyqHistoryRecord[]>([]);
  const [curatedPyqs, setCuratedPyqs] = useState<CuratedPyqLabRecord[]>([]);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [portalModalOpen, setPortalModalOpen] = useState(false);

  const loadAccountBundle = useCallback(async (currentUser: User) => {
    if (!currentUser.emailVerified) {
      setCloudStatus("unverified");
      setProfile(null);
      setPrivateAccount(null);
      setMentorRequest(null);
      setNeedsOnboarding(false);
      return;
    }

    setCloudStatus("syncing");
    try {
      const [prof, priv, req, history, curated] = await Promise.all([
        fetchUserProfile(currentUser.uid),
        fetchPrivateAccount(currentUser.uid),
        fetchOwnMentorRequest(currentUser.uid),
        loadPyqHistoryFromCloud(currentUser.uid),
        fetchPublishedCuratedPyqs(),
      ]);

      setPrivateAccount(priv);
      setMentorRequest(req);
      setPyqHistory(history);
      setCuratedPyqs(curated);

      if (!prof) {
        setProfile(null);
        setNeedsOnboarding(true);
        setCloudStatus("onboarding");
        setAuthModalOpen(true);
      } else {
        setProfile(prof);
        setNeedsOnboarding(false);
        setCloudStatus("synced");
      }
    } catch (err) {
      console.error("Failed to load account bundle:", err);
      setCloudStatus("error");
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        setProfile(null);
        setPrivateAccount(null);
        setMentorRequest(null);
        setPyqHistory([]);
        setCuratedPyqs([]);
        setNeedsOnboarding(false);
        setCloudStatus("guest");
        return;
      }
      void loadAccountBundle(nextUser);
    });
    return () => unsub();
  }, [loadAccountBundle]);

  // Real-time Firestore listeners once authenticated & verified
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) return;

    const profilePath = `user_profiles/${user.uid}`;
    const unsubProfile = onSnapshot(
      doc(db, "user_profiles", user.uid),
      (snap) => {
        if (snap.exists()) {
          setProfile(snap.data() as UserProfile);
          setNeedsOnboarding(false);
          setCloudStatus("synced");
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, profilePath);
      }
    );

    const curatedQuery = query(collection(db, "curated_pyqs"), where("status", "==", "published"));
    const unsubCurated = onSnapshot(
      curatedQuery,
      (snap) => {
        setCuratedPyqs(snap.docs.map((d) => d.data() as CuratedPyqLabRecord));
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, "curated_pyqs");
      }
    );

    const reqPath = `mentor_requests/${user.uid}`;
    const unsubReq = onSnapshot(
      doc(db, "mentor_requests", user.uid),
      (snap) => {
        setMentorRequest(snap.exists() ? (snap.data() as MentorRoleRequestRecord) : null);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, reqPath);
      }
    );

    return () => {
      unsubProfile();
      unsubCurated();
      unsubReq();
    };
  }, [authReady, user]);

  const completeOnboarding = useCallback(
    async (input: OnboardingInput) => {
      if (!user) throw new Error("Sign in first to complete profile.");
      if (!user.emailVerified) {
        throw new Error("Verify your email before saving your profile to Firestore.");
      }
      setCloudStatus("syncing");
      const res = await createOrSyncAccountRecords(user, input);
      setProfile(res.profile);
      setPrivateAccount(res.privateInfo);
      setMentorRequest(res.mentorRequest);
      setNeedsOnboarding(false);
      setCloudStatus("synced");
    },
    [user]
  );

  const refreshUserSession = useCallback(async () => {
    if (!auth.currentUser) return;
    await auth.currentUser.reload();
    const reloaded = auth.currentUser;
    setUser(reloaded);
    if (reloaded) {
      await loadAccountBundle(reloaded);
    }
  }, [loadAccountBundle]);

  const refreshCloudVault = useCallback(async () => {
    if (!user || !user.emailVerified) return;
    const [history, curated] = await Promise.all([
      loadPyqHistoryFromCloud(user.uid),
      fetchPublishedCuratedPyqs(),
    ]);
    setPyqHistory(history);
    setCuratedPyqs(curated);
  }, [user]);

  const signOut = useCallback(async () => {
    await signOutCurrentUser();
    setPortalModalOpen(false);
  }, []);

  const isVerified = Boolean(user?.emailVerified);
  const role: UserRole | "guest" = profile?.role ?? (user ? "student" : "guest");
  const isAdmin = Boolean(isVerified && profile?.role === "admin");
  const isMentor = Boolean(isVerified && (profile?.role === "mentor" || profile?.role === "admin"));

  return (
    <AuthContext.Provider
      value={{
        authReady,
        user,
        profile,
        privateAccount,
        mentorRequest,
        role,
        isVerified,
        isMentor,
        isAdmin,
        needsOnboarding,
        cloudStatus,
        pyqHistory,
        curatedPyqs,
        authModalOpen,
        setAuthModalOpen,
        portalModalOpen,
        setPortalModalOpen,
        completeOnboarding,
        refreshUserSession,
        refreshCloudVault,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
