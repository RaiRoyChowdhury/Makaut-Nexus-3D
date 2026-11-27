import { ChangeEvent, useEffect, useRef, useState } from "react";
import {
  Award,
  Camera,
  Check,
  Cloud,
  Database,
  ExternalLink,
  HardDrive,
  Loader2,
  Lock,
  Play,
  ShieldAlert,
  Sparkles,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../store/useAuthStore";
import {
  deleteCuratedPyqLab,
  fetchAllMentorRequestsForAdmin,
  fetchCohortProfiles,
  publishCuratedPyqLab,
  reviewMentorRoleRequest,
  uploadPyqImageToStorage,
} from "../services/firebaseDataService";
import { generatePyqLab, generatePyqLabFromImage } from "../services/pyqLabService";
import { MentorRoleRequestRecord, UserProfile } from "../types/auth";
import { PyqLabConfig } from "../types/pyqLab";

interface RolePortalModalProps {
  onLaunchLab: (config: PyqLabConfig) => void;
}

export function RolePortalModal({ onLaunchLab }: RolePortalModalProps) {
  const {
    user,
    profile,
    isVerified,
    isMentor,
    isAdmin,
    pyqHistory,
    curatedPyqs,
    portalModalOpen,
    setPortalModalOpen,
    setAuthModalOpen,
    refreshCloudVault,
  } = useAuth();

  const [tab, setTab] = useState<"vault" | "cohort" | "mentor" | "admin">("vault");
  const [cohort, setCohort] = useState<UserProfile[]>([]);
  const [mentorRequests, setMentorRequests] = useState<MentorRoleRequestRecord[]>([]);
  const [loadingTab, setLoadingTab] = useState(false);

  // Mentor Publisher state
  const [pubQuestion, setPubQuestion] = useState("");
  const [pubFile, setPubFile] = useState<File | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!portalModalOpen || !user || !isVerified) return;
    setErrorMsg(null);

    if (tab === "vault") {
      setLoadingTab(true);
      void refreshCloudVault().finally(() => setLoadingTab(false));
    } else if (tab === "cohort") {
      setLoadingTab(true);
      void fetchCohortProfiles()
        .then(setCohort)
        .catch((err) => setErrorMsg(err instanceof Error ? err.message : "Failed to load cohort."))
        .finally(() => setLoadingTab(false));
    } else if (tab === "admin" && isAdmin) {
      setLoadingTab(true);
      void fetchAllMentorRequestsForAdmin()
        .then(setMentorRequests)
        .catch((err) => setErrorMsg(err instanceof Error ? err.message : "Failed to load requests."))
        .finally(() => setLoadingTab(false));
    }
  }, [portalModalOpen, tab, user, isVerified, isAdmin, refreshCloudVault]);

  if (!portalModalOpen) return null;

  const handleFilePick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setErrorMsg("Image exceeds 4 MB.");
      return;
    }
    setPubFile(file);
    setErrorMsg(null);
  };

  const handlePublishCurated = async () => {
    if (!user || !profile || !isMentor) return;
    if (!pubFile && pubQuestion.trim().length < 6) {
      setErrorMsg("Upload a PYQ photo or enter a question (min 6 characters).");
      return;
    }
    setPublishing(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const storageMeta = pubFile
        ? await uploadPyqImageToStorage(user.uid, pubFile, "curated-pyqs")
        : { storagePath: "", imageUrl: "", storedInCloud: false };

      const config = pubFile
        ? await generatePyqLabFromImage(pubFile, pubQuestion.trim())
        : await generatePyqLab(pubQuestion.trim());

      await publishCuratedPyqLab({
        authorId: user.uid,
        authorName: profile.displayName,
        config,
        storageMeta,
      });

      setPubQuestion("");
      setPubFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await refreshCloudVault();
      setStatusMsg(
        storageMeta.storedInCloud
          ? "Published official PYQ 3D Lab + image attachment to Firebase Storage & Firestore!"
          : "Published official PYQ 3D Lab to Firestore! (Note: Storage bucket skipped or unavailable.)"
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to publish curated PYQ.");
    } finally {
      setPublishing(false);
    }
  };

  const handleReviewRequest = async (targetUid: string, decision: "approved" | "rejected") => {
    if (!user || !isAdmin) return;
    setErrorMsg(null);
    try {
      await reviewMentorRoleRequest({ targetUid, decision, reviewerUid: user.uid });
      const updated = await fetchAllMentorRequestsForAdmin();
      setMentorRequests(updated);
      setStatusMsg(`Updated request for ${targetUid} to ${decision}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to review request.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#06080E]/82 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="portal-modal-title"
    >
      <div className="nexus-panel-solid rounded-2xl max-w-4xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 border border-[#8B5CF6]/40 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-mono text-[#A78BFA]">
              <Database className="w-4 h-4" />
              <span>FULL-STACK CLOUD VAULT & ROLE-BASED PORTAL</span>
            </div>
            <h2 id="portal-modal-title" className="text-xl font-bold text-[#F4F7FB]">
              Firestore Vault, Storage & RBAC Console
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setPortalModalOpen(false)}
            className="text-[#94A3B8] hover:text-[#F4F7FB] p-1.5 rounded-lg hover:bg-white/[0.06] cursor-pointer"
            aria-label="Close cloud portal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!user || !isVerified ? (
          <div className="rounded-xl bg-[#090C14] border border-white/10 p-6 text-center space-y-3">
            <Cloud className="w-8 h-8 text-[#00F5D4] mx-auto" />
            <h3 className="text-sm font-bold text-[#F4F7FB]">Sign In to Unlock Cloud Vault & RBAC</h3>
            <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
              Guest mode stays open for instant 3D demos. Sign in with Google or an email account to store PYQ photos in Firebase Storage, sync progress to Firestore, and access Mentor/Admin controls.
            </p>
            <button
              type="button"
              onClick={() => {
                setPortalModalOpen(false);
                setAuthModalOpen(true);
              }}
              className="px-5 py-2.5 rounded-xl bg-[#00F5D4] text-[#06080E] text-xs font-bold cursor-pointer"
            >
              Sign In / Create Account
            </button>
          </div>
        ) : (
          <>
            {/* Navigation Tabs */}
            <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
              <button
                type="button"
                onClick={() => setTab("vault")}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                  tab === "vault"
                    ? "bg-[#00F5D4]/15 text-[#00F5D4] border border-[#00F5D4]/45"
                    : "bg-white/[0.04] text-[#94A3B8] hover:text-[#F4F7FB]"
                }`}
              >
                <HardDrive className="w-3.5 h-3.5" />
                PYQ Cloud Vault ({pyqHistory.length + curatedPyqs.length})
              </button>
              <button
                type="button"
                onClick={() => setTab("cohort")}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                  tab === "cohort"
                    ? "bg-[#00F5D4]/15 text-[#00F5D4] border border-[#00F5D4]/45"
                    : "bg-white/[0.04] text-[#94A3B8] hover:text-[#F4F7FB]"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Cohort Readiness
              </button>
              <button
                type="button"
                onClick={() => setTab("mentor")}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                  tab === "mentor"
                    ? "bg-[#8B5CF6]/20 text-[#DDD6FE] border border-[#8B5CF6]/50"
                    : "bg-white/[0.04] text-[#94A3B8] hover:text-[#F4F7FB]"
                }`}
              >
                {!isMentor && <Lock className="w-3 h-3" />}
                <Sparkles className="w-3.5 h-3.5" />
                Mentor Publisher
              </button>
              <button
                type="button"
                onClick={() => setTab("admin")}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                  tab === "admin"
                    ? "bg-[#F59E0B]/20 text-[#FCD34D] border border-[#F59E0B]/50"
                    : "bg-white/[0.04] text-[#94A3B8] hover:text-[#F4F7FB]"
                }`}
              >
                {!isAdmin && <Lock className="w-3 h-3" />}
                <ShieldAlert className="w-3.5 h-3.5" />
                Admin Role Approvals
              </button>
            </div>

            {errorMsg && (
              <div className="rounded-lg px-3.5 py-2 bg-[#2A1215] border border-[#EF4444]/45 text-xs text-[#FCA5A5]">
                {errorMsg}
              </div>
            )}
            {statusMsg && (
              <div className="rounded-lg px-3.5 py-2 bg-[#062C22] border border-[#10B981]/45 text-xs text-[#6EE7B7]">
                {statusMsg}
              </div>
            )}

            {/* TAB 1: Cloud PYQ Vault (Storage + Firestore) */}
            {tab === "vault" && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <h3 className="text-xs font-mono text-[#00F5D4] uppercase">
                    Official Mentor-Curated PYQ 3D Labs ({curatedPyqs.length})
                  </h3>
                  {curatedPyqs.length === 0 ? (
                    <p className="text-xs text-[#94A3B8] bg-[#090C14] border border-white/10 rounded-xl p-4">
                      No mentor-curated labs published yet. Mentors and Admins can publish official PYQ labs from the Mentor Publisher tab.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {curatedPyqs.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl bg-[#090C14] border border-[#8B5CF6]/35 p-3.5 flex gap-3 items-start"
                        >
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.title}
                              className="w-16 h-16 rounded-lg object-cover border border-white/10 shrink-0"
                            />
                          ) : null}
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[10px] font-mono text-[#A78BFA]">
                                {item.subjectCode} · BY {item.authorName}
                              </span>
                              {(isAdmin || item.authorId === user.uid) && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void deleteCuratedPyqLab(item.id).then(() => refreshCloudVault())
                                  }
                                  className="text-[#94A3B8] hover:text-[#FCA5A5] cursor-pointer"
                                  title="Delete curated lab"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                            <div className="text-xs font-bold text-[#F4F7FB] truncate">{item.title}</div>
                            <p className="text-[11px] text-[#94A3B8] line-clamp-2">{item.questionText}</p>
                            <button
                              type="button"
                              onClick={() => {
                                setPortalModalOpen(false);
                                onLaunchLab(item.config);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#8B5CF6] text-white text-[11px] font-semibold cursor-pointer"
                            >
                              <Play className="w-3 h-3" />
                              Launch 3D Lab
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-xs font-mono text-[#94A3B8] uppercase">
                    Your Uploaded PYQ 3D Lab History ({pyqHistory.length})
                  </h3>
                  {loadingTab ? (
                    <div className="text-xs text-[#94A3B8] flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Loading cloud history...
                    </div>
                  ) : pyqHistory.length === 0 ? (
                    <p className="text-xs text-[#94A3B8] bg-[#090C14] border border-white/10 rounded-xl p-4">
                      Generate any custom PYQ lab (by photo or text) while signed in to save it automatically to Firestore & Firebase Storage.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {pyqHistory.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl bg-[#090C14] border border-white/10 p-3.5 flex gap-3 items-start"
                        >
                          {item.imageUrl ? (
                            <a
                              href={item.imageUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="shrink-0 group relative"
                              title="Open original photo in Firebase Storage"
                            >
                              <img
                                src={item.imageUrl}
                                alt={item.title}
                                className="w-16 h-16 rounded-lg object-cover border border-white/10"
                              />
                              <ExternalLink className="w-3 h-3 text-white absolute bottom-1 right-1 opacity-75" />
                            </a>
                          ) : null}
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <span className="text-[10px] font-mono text-[#00F5D4]">
                              {item.subjectCode} · {item.storagePath ? "PHOTO IN STORAGE" : "CLOUD LAB"}
                            </span>
                            <div className="text-xs font-bold text-[#F4F7FB] truncate">{item.title}</div>
                            <p className="text-[11px] text-[#94A3B8] line-clamp-2">{item.questionText}</p>
                            <button
                              type="button"
                              onClick={() => {
                                setPortalModalOpen(false);
                                onLaunchLab(item.config);
                              }}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#00F5D4]/15 border border-[#00F5D4]/45 text-[#00F5D4] text-[11px] font-semibold cursor-pointer"
                            >
                              <Play className="w-3 h-3" />
                              Relaunch 3D Lab
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Cohort Readiness */}
            {tab === "cohort" && (
              <div className="space-y-3">
                <p className="text-xs text-[#94A3B8]">
                  Real-time Firestore leaderboard (PII-isolated: emails and roll numbers are never exposed).
                </p>
                {loadingTab ? (
                  <div className="text-xs text-[#94A3B8] flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Querying Firestore cohort...
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#090C14]">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-white/10 text-[11px] font-mono text-[#94A3B8]">
                        <tr>
                          <th className="px-3.5 py-2.5">Learner</th>
                          <th className="px-3.5 py-2.5">Role</th>
                          <th className="px-3.5 py-2.5">Dept</th>
                          <th className="px-3.5 py-2.5">XP / Lvl</th>
                          <th className="px-3.5 py-2.5">Sim CGPA</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.06]">
                        {cohort.map((row) => (
                          <tr key={row.uid} className={row.uid === user.uid ? "bg-[#00F5D4]/[0.06]" : ""}>
                            <td className="px-3.5 py-2.5 font-semibold text-[#F4F7FB]">
                              {row.displayName} {row.uid === user.uid ? "(You)" : ""}
                            </td>
                            <td className="px-3.5 py-2.5 font-mono uppercase text-[11px] text-[#A78BFA]">
                              {row.role}
                            </td>
                            <td className="px-3.5 py-2.5 text-[#CBD5E1]">{row.department}</td>
                            <td className="px-3.5 py-2.5 font-mono text-[#00F5D4]">
                              {row.xp} XP · L{row.level}
                            </td>
                            <td className="px-3.5 py-2.5 font-mono text-[#10B981]">
                              {row.simulatedCgpa.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Mentor Publisher */}
            {tab === "mentor" && (
              <div className="space-y-4">
                {!isMentor ? (
                  <div className="rounded-xl bg-[#090C14] border border-[#8B5CF6]/35 p-5 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#DDD6FE]">
                      <Lock className="w-4 h-4 text-[#8B5CF6]" />
                      <span>Mentor or Admin Role Required</span>
                    </div>
                    <p className="text-xs text-[#94A3B8]">
                      Publishing official PYQ 3D labs to the shared MAKAUT database is protected by Firestore RBAC rules. Request a Mentor role upgrade from Account Settings.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setPortalModalOpen(false);
                        setAuthModalOpen(true);
                      }}
                      className="px-4 py-2 rounded-lg bg-[#8B5CF6] text-white text-xs font-semibold cursor-pointer"
                    >
                      Request Mentor Access
                    </button>
                  </div>
                ) : (
                  <div className="rounded-xl bg-[#090C14] border border-[#8B5CF6]/35 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-mono text-[#A78BFA]">
                      <Award className="w-4 h-4" />
                      <span>PUBLISH OFFICIAL MAKAUT PYQ 3D LAB TO ALL STUDENTS</span>
                    </div>
                    <textarea
                      rows={3}
                      value={pubQuestion}
                      onChange={(e) => setPubQuestion(e.target.value)}
                      placeholder="Enter official MAKAUT PYQ (e.g. 'PCC-CS301: Detect and remove loop in singly linked list using Floyd cycle algorithm')..."
                      className="w-full rounded-lg bg-[#0B101B] border border-white/15 p-3 text-xs text-[#F4F7FB]"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleFilePick}
                          className="hidden"
                        />
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          className="px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/15 text-xs text-[#CBD5E1] inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5 text-[#00F5D4]" />
                          {pubFile ? pubFile.name : "Attach PYQ Photo (Firebase Storage)"}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={handlePublishCurated}
                        disabled={publishing}
                        className="px-4 py-2 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
                      >
                        {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {publishing ? "Building & Publishing..." : "Publish Curated Lab"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: Admin Role Approvals */}
            {tab === "admin" && (
              <div className="space-y-3">
                {!isAdmin ? (
                  <div className="rounded-xl bg-[#090C14] border border-[#F59E0B]/35 p-5 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#FCD34D]">
                      <Lock className="w-4 h-4" />
                      <span>Admin Privileges Required</span>
                    </div>
                    <p className="text-xs text-[#94A3B8]">
                      Only verified Admins can approve or reject Mentor role escalations in Firestore.
                    </p>
                  </div>
                ) : loadingTab ? (
                  <div className="text-xs text-[#94A3B8] flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading Mentor requests...
                  </div>
                ) : mentorRequests.length === 0 ? (
                  <p className="text-xs text-[#94A3B8] bg-[#090C14] border border-white/10 rounded-xl p-4">
                    No Mentor role requests submitted yet.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {mentorRequests.map((req) => (
                      <div
                        key={req.uid}
                        className="rounded-xl bg-[#090C14] border border-white/10 p-3.5 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[#F4F7FB]">{req.displayName}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 text-[#CBD5E1]">
                              {req.department} · {req.facultyCode}
                            </span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#F59E0B]/15 text-[#FCD34D] uppercase">
                              {req.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#94A3B8]">{req.justification}</p>
                        </div>
                        {req.status === "pending" && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => void handleReviewRequest(req.uid, "approved")}
                              className="px-3 py-1.5 rounded-lg bg-[#10B981] text-[#06080E] text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Approve Mentor
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleReviewRequest(req.uid, "rejected")}
                              className="px-3 py-1.5 rounded-lg bg-[#EF4444]/20 text-[#FCA5A5] text-xs font-semibold cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
