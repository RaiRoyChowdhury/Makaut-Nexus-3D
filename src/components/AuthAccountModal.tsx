import { FormEvent, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Cloud,
  GraduationCap,
  KeyRound,
  Loader2,
  LogOut,
  MailCheck,
  RefreshCw,
  Shield,
  ShieldCheck,
  UserCheck,
  UserPlus,
  X,
} from "lucide-react";
import { useAuth } from "../store/useAuthStore";
import { useNexus } from "../store/useNexusStore";
import {
  createEmailPasswordAccount,
  isBootstrappedAdminEmail,
  resendVerificationForCurrentUser,
  signInWithEmailPasswordAccount,
  signInWithGooglePopup,
  submitMentorRoleRequest,
} from "../services/firebaseDataService";
import { FIREBASE_PROJECT_ID } from "../services/firebaseClient";

export function AuthAccountModal() {
  const {
    user,
    profile,
    privateAccount,
    mentorRequest,
    isVerified,
    needsOnboarding,
    cloudStatus,
    authModalOpen,
    setAuthModalOpen,
    setPortalModalOpen,
    completeOnboarding,
    refreshUserSession,
    signOut,
  } = useAuth();
  const { progress, level, simulatedCgpa, totalLevelsCompleted } = useNexus();

  const [authTab, setAuthTab] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [department, setDepartment] = useState("B.Tech IT");
  const [semester, setSemester] = useState("Semester 03");
  const [rollNumber, setRollNumber] = useState("");
  const [requestedRole, setRequestedRole] = useState<"student" | "mentor">("student");
  const [facultyCode, setFacultyCode] = useState("");
  const [justification, setJustification] = useState("");
  const [isCohortVisible, setIsCohortVisible] = useState(true);

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [showConsoleHelp, setShowConsoleHelp] = useState(false);

  // Sync form fields when profile/user loads
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName);
      setDepartment(profile.department);
      setSemester(profile.semester);
      setIsCohortVisible(profile.isCohortVisible);
    } else if (user) {
      setDisplayName(user.displayName || user.email?.split("@")[0] || "");
    }
    if (privateAccount) {
      setRollNumber(privateAccount.rollNumber || "");
    }
  }, [profile, privateAccount, user]);

  if (!authModalOpen) return null;

  const mapAuthError = (err: unknown): string => {
    const msg = err instanceof Error ? err.message : String(err ?? "Authentication failed");
    if (msg.includes("auth/operation-not-allowed")) {
      setShowConsoleHelp(true);
      return "Email/Password sign-in is not yet enabled in Firebase Console. Enable it under Authentication > Sign-in method, or use instant Google Sign-In above.";
    }
    if (msg.includes("auth/email-already-in-use")) {
      return "An account with this email already exists. Switch to Sign In instead.";
    }
    if (msg.includes("auth/invalid-credential") || msg.includes("auth/wrong-password")) {
      return "Invalid email or password. Please double-check your credentials.";
    }
    if (msg.includes("auth/weak-password")) {
      return "Password must be at least 6 characters.";
    }
    if (msg.includes("auth/popup-closed-by-user")) {
      return "Google sign-in popup was closed before finishing.";
    }
    return msg;
  };

  const handleGoogleAuth = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setShowConsoleHelp(false);
    setBusy(true);
    try {
      await signInWithGooglePopup();
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleEmailAuth = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setShowConsoleHelp(false);

    if (!email.trim() || password.length < 6) {
      setErrorMsg("Enter a valid email and a password of at least 6 characters.");
      return;
    }

    setBusy(true);
    try {
      if (authTab === "signup") {
        if (displayName.trim().length < 2) {
          setErrorMsg("Please enter your full name (at least 2 characters).");
          setBusy(false);
          return;
        }
        await createEmailPasswordAccount({ email, password, displayName });
        setInfoMsg(
          "Account created! A verification link was sent to your inbox. Verify your email, then click 'Refresh Status' below (or use Google Sign-In for instant verified access)."
        );
      } else {
        await signInWithEmailPasswordAccount(email, password);
      }
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    if (displayName.trim().length < 2) {
      setErrorMsg("Display name must be at least 2 characters.");
      return;
    }
    setBusy(true);
    try {
      await completeOnboarding({
        displayName,
        department,
        semester,
        rollNumber,
        requestedRole,
        facultyCode,
        justification,
        isCohortVisible,
        xp: progress.xp,
        level,
        streak: progress.streak,
        simulatedCgpa,
        totalLevelsCompleted,
      });
      setInfoMsg(
        requestedRole === "mentor" && profile?.role !== "mentor" && !isBootstrappedAdminEmail(user?.email)
          ? "Profile synced to Firestore! Your Mentor role request is now pending Admin approval."
          : "Cloud profile & Firestore sync active!"
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setBusy(false);
    }
  };

  const handleRequestMentorUpgrade = async () => {
    if (!user) return;
    setErrorMsg(null);
    setInfoMsg(null);
    setBusy(true);
    try {
      await submitMentorRoleRequest({
        uid: user.uid,
        displayName: displayName || profile?.displayName || "Faculty",
        department,
        facultyCode: facultyCode || "FAC-MAKAUT",
        justification: justification || "Faculty/Mentor requesting curated PYQ publishing rights.",
      });
      setInfoMsg("Mentor verification request submitted to Admin.");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to submit Mentor request.");
    } finally {
      setBusy(false);
    }
  };

  const roleBadgeColor =
    profile?.role === "admin"
      ? "bg-[#F59E0B]/15 border-[#F59E0B]/50 text-[#FCD34D]"
      : profile?.role === "mentor"
      ? "bg-[#8B5CF6]/20 border-[#8B5CF6]/55 text-[#DDD6FE]"
      : "bg-[#00F5D4]/15 border-[#00F5D4]/45 text-[#00F5D4]";

  return (
    <div
      className="fixed inset-0 z-50 bg-[#06080E]/82 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="nexus-panel-solid rounded-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 border border-[#00F5D4]/35 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-mono text-[#00F5D4]">
              <Cloud className="w-4 h-4" />
              <span>FIREBASE AUTH · FIRESTORE · CLOUD STORAGE</span>
            </div>
            <h2 id="auth-modal-title" className="text-xl font-bold text-[#F4F7FB]">
              {!user
                ? "Account Creation & Role Sign-In"
                : !isVerified
                ? "Verify Your Email Address"
                : needsOnboarding
                ? "Complete Your Academic Profile"
                : "Cloud Account & Role Settings"}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setAuthModalOpen(false)}
            className="text-[#94A3B8] hover:text-[#F4F7FB] p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
            aria-label="Close account modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Unauthenticated View */}
        {!user && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={busy}
              className="w-full py-3 px-4 rounded-xl bg-[#00F5D4] hover:bg-[#00DFC0] text-[#06080E] text-xs font-bold flex items-center justify-center gap-2.5 transition-colors cursor-pointer disabled:opacity-60"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              CONTINUE WITH GOOGLE (INSTANT VERIFIED CLOUD SYNC)
            </button>

            <div className="flex items-center gap-3 text-[11px] font-mono text-[#64748B]">
              <span className="flex-1 h-px bg-white/10" />
              <span>OR EMAIL & PASSWORD ACCOUNT</span>
              <span className="flex-1 h-px bg-white/10" />
            </div>

            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#090C14] border border-white/10">
              <button
                type="button"
                onClick={() => {
                  setAuthTab("signup");
                  setErrorMsg(null);
                }}
                className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  authTab === "signup"
                    ? "bg-[#8B5CF6]/25 text-[#DDD6FE] border border-[#8B5CF6]/45"
                    : "text-[#94A3B8] hover:text-[#F4F7FB]"
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                Create Account
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthTab("signin");
                  setErrorMsg(null);
                }}
                className={`py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  authTab === "signin"
                    ? "bg-[#00F5D4]/15 text-[#00F5D4] border border-[#00F5D4]/40"
                    : "text-[#94A3B8] hover:text-[#F4F7FB]"
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                Sign In
              </button>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-3">
              {authTab === "signup" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">Full Name</label>
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Ananya Sen"
                      className="w-full rounded-lg bg-[#090C14] border border-white/15 focus:border-[#00F5D4] focus:outline-none px-3 py-2 text-xs text-[#F4F7FB]"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">Account Role</label>
                    <select
                      value={requestedRole}
                      onChange={(e) => setRequestedRole(e.target.value as "student" | "mentor")}
                      className="w-full rounded-lg bg-[#090C14] border border-white/15 focus:border-[#00F5D4] focus:outline-none px-3 py-2 text-xs text-[#F4F7FB]"
                    >
                      <option value="student">Student (Immediate Access)</option>
                      <option value="mentor">Faculty / Mentor (Request Role)</option>
                    </select>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@makautwb.ac.in"
                    className="w-full rounded-lg bg-[#090C14] border border-white/15 focus:border-[#00F5D4] focus:outline-none px-3 py-2 text-xs text-[#F4F7FB]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full rounded-lg bg-[#090C14] border border-white/15 focus:border-[#00F5D4] focus:outline-none px-3 py-2 text-xs text-[#F4F7FB]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 text-xs font-bold text-[#F4F7FB] flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {authTab === "signup" ? "Create Account & Send Verification" : "Sign In with Email"}
              </button>
            </form>
          </div>
        )}

        {/* Signed in but Unverified Email */}
        {user && !isVerified && (
          <div className="space-y-4 rounded-xl bg-[#090C14] border border-[#F59E0B]/40 p-4">
            <div className="flex items-start gap-3">
              <MailCheck className="w-5 h-5 text-[#F59E0B] shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <p className="font-semibold text-[#F4F7FB]">
                  Signed in as {user.email} (Pending Verification)
                </p>
                <p className="text-[#94A3B8]">
                  Cloud Firestore and Storage writes enforce verified email identity. Click the link sent to your inbox, then refresh below.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  setBusy(true);
                  setErrorMsg(null);
                  try {
                    await refreshUserSession();
                  } catch (err) {
                    setErrorMsg(mapAuthError(err));
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy}
                className="px-3.5 py-2 rounded-lg bg-[#00F5D4] text-[#06080E] text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                I&apos;ve Verified — Refresh
              </button>
              <button
                type="button"
                onClick={async () => {
                  setBusy(true);
                  try {
                    await resendVerificationForCurrentUser();
                    setInfoMsg("Verification email re-sent.");
                  } catch (err) {
                    setErrorMsg(mapAuthError(err));
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy}
                className="px-3.5 py-2 rounded-lg bg-white/[0.06] border border-white/15 text-xs text-[#CBD5E1] cursor-pointer"
              >
                Resend Link
              </button>
              <button
                type="button"
                onClick={() => void signOut()}
                className="px-3.5 py-2 rounded-lg bg-[#EF4444]/15 text-[#FCA5A5] text-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        )}

        {/* Signed in & Verified: Onboarding or Profile Management */}
        {user && isVerified && (
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="rounded-xl bg-[#090C14] border border-white/10 p-3.5 flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-[#F4F7FB] truncate">
                    {profile?.displayName || user.displayName || "MAKAUT User"}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded border text-[10px] font-mono font-bold uppercase ${roleBadgeColor}`}
                  >
                    {profile?.role || (isBootstrappedAdminEmail(user.email) ? "admin" : "student")}
                  </span>
                </div>
                <p className="text-[11px] font-mono text-[#94A3B8] truncate">{user.email}</p>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-mono text-[#10B981]">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{cloudStatus === "synced" ? "Cloud Synced" : "Ready to Sync"}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your Name"
                  className="w-full rounded-lg bg-[#090C14] border border-white/15 focus:border-[#00F5D4] focus:outline-none px-3 py-2 text-xs text-[#F4F7FB]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">Department</label>
                <select
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  className="w-full rounded-lg bg-[#090C14] border border-white/15 focus:border-[#00F5D4] focus:outline-none px-3 py-2 text-xs text-[#F4F7FB]"
                >
                  <option value="B.Tech IT">B.Tech IT</option>
                  <option value="B.Tech CSE">B.Tech CSE</option>
                  <option value="B.Tech ECE">B.Tech ECE</option>
                  <option value="B.Tech AIML">B.Tech AIML</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">Semester</label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full rounded-lg bg-[#090C14] border border-white/15 focus:border-[#00F5D4] focus:outline-none px-3 py-2 text-xs text-[#F4F7FB]"
                >
                  <option value="Semester 03">Semester 03 (Active)</option>
                  <option value="Semester 04">Semester 04</option>
                  <option value="Faculty / Mentor">Faculty / Mentor</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-mono text-[#94A3B8] mb-1">
                  MAKAUT Roll No. (Private PII)
                </label>
                <input
                  type="text"
                  value={rollNumber}
                  onChange={(e) => setRollNumber(e.target.value)}
                  placeholder="Optional · isolated privately"
                  className="w-full rounded-lg bg-[#090C14] border border-white/15 focus:border-[#00F5D4] focus:outline-none px-3 py-2 text-xs text-[#F4F7FB]"
                />
              </div>
            </div>

            {/* Role Selection during Onboarding OR Mentor Upgrade Request */}
            {(needsOnboarding || profile?.role === "student") && !isBootstrappedAdminEmail(user.email) && (
              <div className="rounded-xl bg-[#090C14] border border-[#8B5CF6]/30 p-3.5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#DDD6FE]">
                    <Shield className="w-4 h-4 text-[#8B5CF6]" />
                    <span>Role-Based Access Control (RBAC)</span>
                  </div>
                  {mentorRequest && (
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-[#F59E0B]/15 text-[#FCD34D] border border-[#F59E0B]/35">
                      Mentor Request: {mentorRequest.status.toUpperCase()}
                    </span>
                  )}
                </div>

                {needsOnboarding && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRequestedRole("student")}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                        requestedRole === "student"
                          ? "bg-[#00F5D4]/12 border-[#00F5D4]/55 text-[#F4F7FB]"
                          : "bg-white/[0.03] border-white/10 text-[#94A3B8]"
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5">
                        <GraduationCap className="w-3.5 h-3.5 text-[#00F5D4]" />
                        Student
                      </div>
                      <div className="text-[11px] text-[#94A3B8] mt-0.5">3D Labs, PYQ Vault & DSA</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRequestedRole("mentor")}
                      className={`p-2.5 rounded-lg border text-left text-xs transition-colors cursor-pointer ${
                        requestedRole === "mentor"
                          ? "bg-[#8B5CF6]/18 border-[#8B5CF6]/60 text-[#F4F7FB]"
                          : "bg-white/[0.03] border-white/10 text-[#94A3B8]"
                      }`}
                    >
                      <div className="font-bold flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-[#A78BFA]" />
                        Faculty / Mentor
                      </div>
                      <div className="text-[11px] text-[#94A3B8] mt-0.5">Publish PYQs & View Cohort</div>
                    </button>
                  </div>
                )}

                {(requestedRole === "mentor" || (!needsOnboarding && !mentorRequest)) && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={facultyCode}
                        onChange={(e) => setFacultyCode(e.target.value)}
                        placeholder="Faculty / Mentor ID (e.g. FAC-IT-04)"
                        className="rounded-lg bg-[#0B101B] border border-white/15 px-3 py-2 text-xs text-[#F4F7FB]"
                      />
                      <input
                        type="text"
                        value={justification}
                        onChange={(e) => setJustification(e.target.value)}
                        placeholder="Reason (e.g. Sem 3 DSA Lab Mentor)"
                        className="rounded-lg bg-[#0B101B] border border-white/15 px-3 py-2 text-xs text-[#F4F7FB]"
                      />
                    </div>
                    {!needsOnboarding && !mentorRequest && (
                      <button
                        type="button"
                        onClick={handleRequestMentorUpgrade}
                        disabled={busy}
                        className="px-3 py-1.5 rounded-lg bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/30 border border-[#8B5CF6]/50 text-[11px] font-semibold text-[#DDD6FE] cursor-pointer"
                      >
                        Request Mentor Role Upgrade
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <label className="flex items-center gap-2.5 text-xs text-[#CBD5E1] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isCohortVisible}
                onChange={(e) => setIsCohortVisible(e.target.checked)}
                className="accent-[#00F5D4]"
              />
              <span>Show my XP & Simulated CGPA on Cohort Leaderboard (no email/roll no. shared)</span>
            </label>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
              <div className="flex items-center gap-2">
                {!needsOnboarding && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthModalOpen(false);
                      setPortalModalOpen(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/30 border border-[#8B5CF6]/45 text-xs font-semibold text-[#DDD6FE] cursor-pointer"
                  >
                    Open Cloud Vault & RBAC
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-[#EF4444]/15 text-xs font-semibold text-[#CBD5E1] hover:text-[#FCA5A5] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="px-5 py-2.5 rounded-xl bg-[#00F5D4] hover:bg-[#00DFC0] text-[#06080E] text-xs font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {needsOnboarding ? "Save & Activate Cloud Sync" : "Update Profile"}
              </button>
            </div>
          </form>
        )}

        {errorMsg && (
          <div className="rounded-lg px-3.5 py-2.5 bg-[#2A1215] border border-[#EF4444]/45 text-xs text-[#FCA5A5] space-y-1.5">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
            {showConsoleHelp && (
              <p className="text-[11px] font-mono text-[#CBD5E1] pl-6">
                Firebase Console → Project <span className="text-[#00F5D4]">{FIREBASE_PROJECT_ID}</span> → Authentication → Sign-in method → Enable Email/Password.
              </p>
            )}
          </div>
        )}

        {infoMsg && (
          <div className="rounded-lg px-3.5 py-2.5 bg-[#062C22] border border-[#10B981]/45 text-xs text-[#6EE7B7]">
            {infoMsg}
          </div>
        )}
      </div>
    </div>
  );
}
