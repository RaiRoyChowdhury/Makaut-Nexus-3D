import {
  ArrowRight,
  BookOpen,
  Briefcase,
  CalendarClock,
  Cpu,
  GitBranch,
  GraduationCap,
  Layers,
  Lock,
  RotateCcw,
  ShieldAlert,
  Sparkles,
  Terminal,
} from "lucide-react";
import { AppView, SEMESTER_3_SUBJECTS } from "../types/nexus";
import { useNexus } from "../store/useNexusStore";

interface Year2HubProps {
  onNavigate: (view: AppView) => void;
}

export function Year2Hub({ onNavigate }: Year2HubProps) {
  const { progress, simulatedCgpa, totalLevelsCompleted, getSubjectMastery, resetProgress } =
    useNexus();

  const totalPossibleLevels = SEMESTER_3_SUBJECTS.length * 3;
  const overallMastery = Math.round((totalLevelsCompleted / totalPossibleLevels) * 100);

  return (
    <main className="relative z-10 mx-auto max-w-[1360px] px-4 lg:px-8 py-8 space-y-8">
      {/* Hero Header */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div className="space-y-2 max-w-2xl">
          <p className="text-xs font-mono text-[#00F5D4] tracking-wider">
            YEAR 2 ACADEMIC COMMAND CENTER · B.TECH INFORMATION TECHNOLOGY
          </p>
          <h1
            className="text-3xl lg:text-4xl font-bold tracking-tight text-[#F4F7FB]"
            style={{ textWrap: "balance" }}
          >
            Master MAKAUT Semester 3 in Interactive 3D
          </h1>
          <p className="text-sm text-[#94A3B8] leading-relaxed">
            Six subject-specific 3D engineering laboratories paired with Gemini AI guidance and
            placement-grade aptitude, interview, and architecture simulations.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-[#94A3B8]">
          <span>Year 1: Locked</span>
          <span aria-hidden="true">·</span>
          <span className="text-[#00F5D4] font-semibold">Year 2: Active</span>
          <span aria-hidden="true">·</span>
          <span>Year 3–4: Upcoming</span>
        </div>
      </section>

      {/* Top Metrics Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="nexus-panel rounded-xl p-5">
          <p className="text-xs font-mono text-[#94A3B8]">Active Term</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#F4F7FB] font-mono tabular-nums">
              SEM 03
            </span>
            <span className="text-xs font-mono text-[#00F5D4]">Unlocked</span>
          </div>
          <p className="mt-1 text-xs text-[#64748B]">Sem 04 locked until next cycle</p>
        </div>

        <div className="nexus-panel rounded-xl p-5">
          <p className="text-xs font-mono text-[#94A3B8]">Credits at Stake</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#F4F7FB] font-mono tabular-nums">
              24.5
            </span>
            <span className="text-xs font-mono text-[#94A3B8]">MAKAUT R23</span>
          </div>
          <p className="mt-1 text-xs text-[#64748B]">6 core theory & lab papers</p>
        </div>

        <div className="nexus-panel rounded-xl p-5">
          <p className="text-xs font-mono text-[#94A3B8]">Simulated CGPA</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#00F5D4] font-mono tabular-nums">
              {simulatedCgpa.toFixed(2)}
            </span>
            <span className="text-xs font-mono text-[#10B981]">+{overallMastery}% mastery</span>
          </div>
          <p className="mt-1 text-xs text-[#64748B]">Updates live as missions clear</p>
        </div>

        <div className="nexus-panel rounded-xl p-5">
          <p className="text-xs font-mono text-[#94A3B8]">3D Missions Cleared</p>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#F4F7FB] font-mono tabular-nums">
              {totalLevelsCompleted} / {totalPossibleLevels}
            </span>
            <span className="text-xs font-mono text-[#8B5CF6]">6 Labs Live</span>
          </div>
          <p className="mt-1 text-xs text-[#64748B]">3 progressive levels per subject</p>
        </div>
      </section>

      {/* Dual Major Gateways: Exam Season & Placement Season */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Gateway A: EXAM SEASON */}
        <div className="nexus-panel rounded-2xl p-6 lg:p-7 flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-mono text-[#00F5D4]">GATEWAY 01 · ACADEMIC PROTOCOL</p>
                <h2 className="mt-1 text-2xl font-bold text-[#F4F7FB]">Exam Season</h2>
              </div>
              <div className="h-11 w-11 rounded-xl bg-[#00F5D4]/12 border border-[#00F5D4]/30 flex items-center justify-center text-[#00F5D4] shrink-0">
                <GraduationCap className="w-5 h-5" />
              </div>
            </div>

            <p className="text-sm text-[#94A3B8] leading-relaxed">
              MAKAUT academic preparation through six distinct interactive 3D subject laboratories,
              each aligned to official Semester 3 paper codes with Gemini 3D Hint Beam support.
            </p>

            {/* Semester 3 Available vs Semester 4 Locked */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                onClick={() => onNavigate({ screen: "exam-season" })}
                className="text-left rounded-xl p-4 bg-[#141926] border border-[#00F5D4]/35 hover:border-[#00F5D4] transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[#00F5D4] font-semibold">SEMESTER 3</span>
                  <span className="text-[#10B981]">AVAILABLE</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-[#F4F7FB] group-hover:text-[#00F5D4] transition-colors">
                  6 Playable 3D Labs
                </p>
                <p className="mt-1 text-xs text-[#94A3B8] font-mono tabular-nums">
                  Overall Mastery: {overallMastery}%
                </p>
              </button>

              <div
                aria-disabled="true"
                className="rounded-xl p-4 bg-[#0B0F17] border border-white/[0.06] opacity-60 cursor-not-allowed select-none"
              >
                <div className="flex items-center justify-between text-xs font-mono text-[#64748B]">
                  <span className="inline-flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    SEMESTER 4
                  </span>
                  <span>UPCOMING</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-[#94A3B8]">
                  OS, DBMS & Algorithms II
                </p>
                <p className="mt-1 text-xs text-[#64748B]">Locked until Sem 4 release</p>
              </div>
            </div>

            {/* Quick Subject Preview List */}
            <div className="space-y-2 pt-2 border-t border-white/[0.07]">
              <div className="flex items-center justify-between text-xs font-mono text-[#94A3B8]">
                <span>Semester 3 Subject Matrix</span>
                <span>Click any lab to launch</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SEMESTER_3_SUBJECTS.map((subj) => {
                  const mastery = getSubjectMastery(subj.id);
                  return (
                    <button
                      key={subj.id}
                      onClick={() => onNavigate({ screen: "game", gameId: subj.id })}
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#0B0F18] hover:bg-[#141B2B] border border-white/[0.06] text-left transition-colors cursor-pointer"
                    >
                      <div className="min-w-0">
                        <span className="block text-[11px] font-mono text-[#94A3B8]">
                          {subj.code}
                        </span>
                        <span className="block text-xs font-medium text-[#F4F7FB] truncate">
                          {subj.gameTitle}
                        </span>
                      </div>
                      <span className="text-xs font-mono tabular-nums text-[#00F5D4] shrink-0">
                        {mastery}%
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigate({ screen: "exam-season" })}
            className="w-full py-3 px-4 rounded-xl bg-[#00F5D4] hover:bg-[#00DFC0] text-[#06080E] font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <BookOpen className="w-4 h-4" />
            Enter Semester 3 Dashboard
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Gateway B: PLACEMENT SEASON */}
        <div className="nexus-panel rounded-2xl p-6 lg:p-7 flex flex-col justify-between gap-6">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-mono text-[#8B5CF6]">GATEWAY 02 · CAREER PROTOCOL</p>
                <h2 className="mt-1 text-2xl font-bold text-[#F4F7FB]">Placement Season</h2>
              </div>
              <div className="h-11 w-11 rounded-xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/35 flex items-center justify-center text-[#8B5CF6] shrink-0">
                <Briefcase className="w-5 h-5" />
              </div>
            </div>

            <p className="text-sm text-[#94A3B8] leading-relaxed">
              Gamified technical placement readiness featuring timed aptitude screening, a
              3-shield AI Interview Boss Duel, and Project Forge with 3D distributed architecture.
            </p>

            {/* Three Placement Modules */}
            <div className="space-y-3">
              <button
                onClick={() => onNavigate({ screen: "placement-season", tab: "aptitude" })}
                className="w-full text-left rounded-xl p-4 bg-[#141926] border border-white/[0.08] hover:border-[#8B5CF6]/60 transition-colors flex items-center justify-between gap-4 cursor-pointer group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-[#8B5CF6]/15 text-[#8B5CF6] flex items-center justify-center shrink-0">
                    <Terminal className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#F4F7FB] group-hover:text-[#00F5D4] transition-colors">
                      TSA & Aptitude Gauntlet
                    </p>
                    <p className="text-xs text-[#94A3B8] truncate">
                      Quantitative, Logical & Technical MCQ sprint with countdown timer
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono tabular-nums text-[#94A3B8] shrink-0">
                  Best: {progress.aptitudeBestScore}%
                </span>
              </button>

              <button
                onClick={() => onNavigate({ screen: "placement-season", tab: "interview" })}
                className="w-full text-left rounded-xl p-4 bg-[#141926] border border-white/[0.08] hover:border-[#8B5CF6]/60 transition-colors flex items-center justify-between gap-4 cursor-pointer group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-[#EF4444]/15 text-[#EF4444] flex items-center justify-center shrink-0">
                    <ShieldAlert className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#F4F7FB] group-hover:text-[#00F5D4] transition-colors">
                      Interview Boss Duel
                    </p>
                    <p className="text-xs text-[#94A3B8] truncate">
                      3-Shield technical defense vs TITAN-SYS ARCHITECT with Gemini grading
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono tabular-nums text-[#00F5D4] shrink-0">
                  {progress.interviewShieldsCleared.length}/3 Shields
                </span>
              </button>

              <button
                onClick={() => onNavigate({ screen: "placement-season", tab: "project-forge" })}
                className="w-full text-left rounded-xl p-4 bg-[#141926] border border-white/[0.08] hover:border-[#8B5CF6]/60 transition-colors flex items-center justify-between gap-4 cursor-pointer group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-[#00F5D4]/15 text-[#00F5D4] flex items-center justify-center shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#F4F7FB] group-hover:text-[#00F5D4] transition-colors">
                      Project Forge & AegisGrid 3D
                    </p>
                    <p className="text-xs text-[#94A3B8] truncate">
                      AI capstone blueprint generator + interactive 3D Raft topology viewer
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono tabular-nums text-[#94A3B8] shrink-0">
                  {progress.savedProjects.length} Saved
                </span>
              </button>

              <button
                onClick={() => onNavigate({ screen: "placement-season", tab: "dsa-session" })}
                className="w-full text-left rounded-xl p-4 bg-[#141926] border border-white/[0.08] hover:border-[#00F5D4]/60 transition-colors flex items-center justify-between gap-4 cursor-pointer group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="h-9 w-9 rounded-lg bg-[#00F5D4]/15 text-[#00F5D4] flex items-center justify-center shrink-0">
                    <GitBranch className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#F4F7FB] group-hover:text-[#00F5D4] transition-colors">
                      DSA Session · Logic → Code Morph
                    </p>
                    <p className="text-xs text-[#94A3B8] truncate">
                      Turn plain English, voice, or flowcharts into C/Python/C++/Java step-by-step
                    </p>
                  </div>
                </div>
                <span className="text-xs font-mono text-[#00F5D4] shrink-0">
                  4 Langs
                </span>
              </button>
            </div>
          </div>

          <button
            onClick={() => onNavigate({ screen: "placement-season", tab: "aptitude" })}
            className="w-full py-3 px-4 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            Launch Placement Arena
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Bottom Row: MAKAUT Exam Countdown & Activity Audit Feed */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="nexus-panel rounded-2xl p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center gap-2.5 text-[#F59E0B] text-xs font-mono">
            <CalendarClock className="w-4 h-4" />
            MAKAUT TEE COUNTDOWN
          </div>
          <div>
            <p className="text-4xl font-bold font-mono tabular-nums text-[#F4F7FB]">42 Days</p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              Odd Semester End-Term Examination · B.Tech IT Year 2
            </p>
          </div>
          <div className="pt-3 border-t border-white/[0.07] flex items-center justify-between text-xs text-[#94A3B8]">
            <span className="inline-flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-[#00F5D4]" />
              Local progress auto-saved
            </span>
            <button
              onClick={resetProgress}
              className="inline-flex items-center gap-1 text-[#94A3B8] hover:text-[#EF4444] transition-colors cursor-pointer"
              title="Reset local demo progress"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>
        </div>

        <div className="nexus-panel rounded-2xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[#F4F7FB]">Recent Progression Activity</h3>
            <span className="text-xs font-mono text-[#94A3B8]">Auto-Synced to Local Storage</span>
          </div>
          <div className="divide-y divide-white/[0.06]">
            {progress.activityLog.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="py-2.5 flex items-center justify-between gap-4 text-xs"
              >
                <span className="text-[#F4F7FB] truncate">{item.text}</span>
                <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums">
                  {item.xpDelta ? (
                    <span className="text-[#00F5D4]">+{item.xpDelta} XP</span>
                  ) : null}
                  <span className="text-[#64748B]">{item.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
