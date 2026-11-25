import { ArrowLeft, CheckCircle2, Lock, Play, Wand2 } from "lucide-react";
import { AppView, SEMESTER_3_SUBJECTS } from "../types/nexus";
import { useNexus } from "../store/useNexusStore";

interface Semester3DashboardProps {
  onNavigate: (view: AppView) => void;
  onOpenPyqGenerator: () => void;
}

export function Semester3Dashboard({ onNavigate, onOpenPyqGenerator }: Semester3DashboardProps) {
  const { progress, getSubjectMastery } = useNexus();

  return (
    <main className="relative z-10 mx-auto max-w-[1360px] px-4 lg:px-8 py-8 space-y-8">
      {/* Header & Breadcrumb */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <button
            onClick={() => onNavigate({ screen: "hub" })}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-[#94A3B8] hover:text-[#00F5D4] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Year 2 Hub
          </button>
          <h1 className="text-3xl font-bold tracking-tight text-[#F4F7FB]">
            MAKAUT Semester 3 — Interactive 3D Laboratories
          </h1>
          <p className="text-sm text-[#94A3B8] max-w-2xl">
            Six independently engineered 3D simulations covering every core B.Tech IT Semester 3
            paper. Clear all 3 levels per subject to reach 100% syllabus mastery.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
          <button
            type="button"
            onClick={onOpenPyqGenerator}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00F5D4]/15 border border-[#00F5D4]/60 text-[#00F5D4] hover:bg-[#00F5D4] hover:text-[#06080E] font-bold shadow-[0_0_22px_rgba(0,245,212,0.22)] transition-all cursor-pointer whitespace-nowrap"
          >
            <Wand2 className="w-4 h-4" />
            PYQ / TOPIC → 3D LAB
          </button>
          <span className="text-[#00F5D4]">Sem 3 · Active</span>
          <span className="text-white/20">/</span>
          <span className="inline-flex items-center gap-1.5 text-[#64748B] opacity-70 cursor-not-allowed">
            <Lock className="w-3.5 h-3.5" />
            Sem 4 · Upcoming
          </span>
        </div>
      </section>

      {/* Six Subject Cards */}
      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {SEMESTER_3_SUBJECTS.map((subj, idx) => {
          const mastery = getSubjectMastery(subj.id);
          const clearedCount = progress.completedLevels[subj.id]?.length ?? 0;
          const bestScore = progress.bestScores[subj.id] ?? 0;

          return (
            <article
              key={subj.id}
              className="nexus-panel rounded-2xl p-6 flex flex-col justify-between gap-6 hover:border-white/20 transition-colors"
            >
              <div className="space-y-4">
                {/* Quiet Unboxed Metadata Header */}
                <div className="flex items-center justify-between text-xs font-mono">
                  <span style={{ color: subj.accent }} className="font-semibold">
                    {subj.code}
                  </span>
                  <span className="text-[#94A3B8]">
                    Game 0{idx + 1} · {subj.credits} Cr
                  </span>
                </div>

                <div>
                  <h2 className="text-lg font-bold text-[#F4F7FB]">{subj.subjectName}</h2>
                  <p className="mt-1 text-sm font-medium" style={{ color: subj.accent }}>
                    {subj.gameTitle}
                  </p>
                </div>

                <p className="text-xs text-[#94A3B8] leading-relaxed">{subj.description}</p>

                {/* Mastery Bar */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                    <span className="text-[#94A3B8]">Syllabus Mastery</span>
                    <span className="text-[#F4F7FB] font-semibold">
                      {mastery}% ({clearedCount}/{subj.totalLevels} levels)
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${mastery}%`,
                        backgroundColor: subj.accent,
                      }}
                    />
                  </div>
                  {bestScore > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#10B981]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Best Score: {bestScore} pts
                    </div>
                  )}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="space-y-2.5 pt-3 border-t border-white/[0.07]">
                <button
                  onClick={() => onNavigate({ screen: "game", gameId: subj.id })}
                  className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer text-[#06080E]"
                  style={{ backgroundColor: subj.accent }}
                >
                  <Play className="w-4 h-4 fill-current" />
                  Play Mission
                </button>
                <div className="flex items-center justify-between text-[11px] font-mono text-[#64748B]">
                  <span>{subj.shortTag}</span>
                  <span>More Games Upcoming</span>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
