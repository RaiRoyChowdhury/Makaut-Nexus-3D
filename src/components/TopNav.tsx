import { Flame, Lock, Play, ShieldCheck, Trophy, Volume2, VolumeX } from "lucide-react";
import { AppView } from "../types/nexus";
import { useNexus } from "../store/useNexusStore";

interface TopNavProps {
  view: AppView;
  onNavigate: (view: AppView) => void;
  demoOpen: boolean;
  onToggleDemo: () => void;
}

export function TopNav({ view, onNavigate, demoOpen, onToggleDemo }: TopNavProps) {
  const { level, xpIntoLevel, xpForNextLevel, progress, voiceEnabled, voiceSupported, toggleVoice } =
    useNexus();
  const xpPct = Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100));

  return (
    <header className="sticky top-0 z-40 h-16 w-full border-b border-white/[0.08] bg-[#06080E]/92 px-4 lg:px-8 flex items-center justify-between gap-6">
      {/* Zone 1: Brand */}
      <button
        onClick={() => onNavigate({ screen: "hub" })}
        className="flex items-center gap-3 text-left whitespace-nowrap shrink-0 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00F5D4] rounded"
      >
        <span className="h-8 w-8 rounded-md bg-[#00F5D4]/15 border border-[#00F5D4]/40 flex items-center justify-center text-[#00F5D4] font-mono text-xs font-bold">
          MN
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-bold tracking-tight text-[#F4F7FB] group-hover:text-[#00F5D4] transition-colors">
            MAKAUT NEXUS <span className="text-[#94A3B8] font-normal">B.TECH IT</span>
          </span>
          <span className="text-[11px] font-mono text-[#94A3B8]">
            MAKAUT SYLLABUS · SEM 03
          </span>
        </span>
      </button>

      {/* Zone 2: Academic Year Navigation (Year 1, 3, 4 strictly locked) */}
      <nav
        aria-label="Academic Years"
        className="hidden xl:flex items-center gap-5 text-xs font-medium"
      >
        <span
          aria-disabled="true"
          title="Year 1 curriculum is upcoming"
          className="inline-flex items-center gap-1.5 text-[#64748B] opacity-60 cursor-not-allowed select-none whitespace-nowrap shrink-0"
        >
          <Lock className="w-3.5 h-3.5" />
          Year 1 · Upcoming
        </span>

        <button
          onClick={() => onNavigate({ screen: "hub" })}
          className={`inline-flex items-center gap-1.5 pb-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
            view.screen === "hub" ||
            view.screen === "exam-season" ||
            view.screen === "game" ||
            view.screen === "custom-lab"
              ? "border-[#00F5D4] text-[#00F5D4]"
              : "border-transparent text-[#F4F7FB] hover:text-[#00F5D4]"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          Year 2 Active
        </button>

        <button
          onClick={() => onNavigate({ screen: "exam-season" })}
          className={`pb-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
            view.screen === "exam-season"
              ? "border-[#00F5D4] text-[#F4F7FB]"
              : "border-transparent text-[#94A3B8] hover:text-[#F4F7FB]"
          }`}
        >
          Sem 3 Labs
        </button>

        <button
          onClick={() => onNavigate({ screen: "placement-season", tab: "aptitude" })}
          className={`pb-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
            view.screen === "placement-season"
              ? "border-[#8B5CF6] text-[#F4F7FB]"
              : "border-transparent text-[#94A3B8] hover:text-[#F4F7FB]"
          }`}
        >
          Placement Season
        </button>

        <span
          aria-disabled="true"
          title="Year 3 curriculum is upcoming"
          className="inline-flex items-center gap-1.5 text-[#64748B] opacity-60 cursor-not-allowed select-none whitespace-nowrap shrink-0"
        >
          <Lock className="w-3.5 h-3.5" />
          Year 3 · Upcoming
        </span>

        <span
          aria-disabled="true"
          title="Year 4 curriculum is upcoming"
          className="inline-flex items-center gap-1.5 text-[#64748B] opacity-60 cursor-not-allowed select-none whitespace-nowrap shrink-0"
        >
          <Lock className="w-3.5 h-3.5" />
          Year 4 · Upcoming
        </span>
      </nav>

      {/* Zone 3: Progression Telemetry & Judge Demo CTA */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="hidden md:flex items-center gap-4 text-xs font-mono tabular-nums">
          <div className="flex items-center gap-2">
            <Trophy className="w-3.5 h-3.5 text-[#00F5D4]" />
            <span className="text-[#F4F7FB] font-semibold">LVL {level}</span>
            <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-[#00F5D4] transition-all duration-300"
                style={{ width: `${xpPct}%` }}
              />
            </div>
            <span className="text-[#94A3B8]">{progress.xp} XP</span>
          </div>

          <span className="text-white/15" aria-hidden="true">
            |
          </span>

          <div className="flex items-center gap-1.5 text-[#F59E0B]">
            <Flame className="w-3.5 h-3.5" />
            <span>{progress.streak}d</span>
          </div>
        </div>

        <button
          type="button"
          onClick={toggleVoice}
          disabled={!voiceSupported}
          title={
            !voiceSupported
              ? "Speech synthesis unavailable"
              : voiceEnabled
              ? "TUTOR VOICE ON — Click to mute"
              : "TUTOR VOICE MUTED — Click to unmute"
          }
          className={`inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg border text-[11px] font-mono font-semibold transition-colors whitespace-nowrap shrink-0 ${
            !voiceSupported
              ? "bg-white/[0.04] border-white/10 text-[#64748B] cursor-not-allowed"
              : voiceEnabled
              ? "bg-[#00F5D4]/12 border-[#00F5D4]/40 text-[#00F5D4] hover:bg-[#00F5D4]/22 cursor-pointer"
              : "bg-white/[0.05] border-white/15 text-[#94A3B8] hover:text-[#F4F7FB] cursor-pointer"
          }`}
        >
          {voiceEnabled && voiceSupported ? (
            <Volume2 className="w-3.5 h-3.5" />
          ) : (
            <VolumeX className="w-3.5 h-3.5" />
          )}
          <span className="hidden lg:inline">
            {!voiceSupported ? "VOICE N/A" : voiceEnabled ? "TUTOR VOICE ON" : "TUTOR VOICE MUTED"}
          </span>
        </button>

        <button
          onClick={onToggleDemo}
          className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            demoOpen
              ? "bg-[#00F5D4] text-[#06080E]"
              : "bg-[#00F5D4]/15 text-[#00F5D4] border border-[#00F5D4]/40 hover:bg-[#00F5D4] hover:text-[#06080E]"
          }`}
        >
          <Play className="w-3.5 h-3.5" />
          Judge Demo
        </button>
      </div>
    </header>
  );
}
