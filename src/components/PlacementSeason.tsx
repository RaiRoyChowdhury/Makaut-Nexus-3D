import { ArrowLeft, GitBranch, Layers, ShieldAlert, Terminal } from "lucide-react";
import { AppView } from "../types/nexus";
import { AptitudeGauntlet } from "./placement/AptitudeGauntlet";
import { InterviewBossDuel } from "./placement/InterviewBossDuel";
import { ProjectForge } from "./placement/ProjectForge";
import { LogicToCodeSimulator } from "./placement/dsa/LogicToCodeSimulator";

interface PlacementSeasonProps {
  activeTab: "aptitude" | "interview" | "project-forge" | "dsa-session";
  onNavigate: (view: AppView) => void;
}

export function PlacementSeason({ activeTab, onNavigate }: PlacementSeasonProps) {
  return (
    <main className="relative z-10 mx-auto max-w-[1360px] px-4 lg:px-8 py-8 space-y-6">
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
            Placement Season — Career Protocol Arena
          </h1>
          <p className="text-sm text-[#94A3B8]">
            Four dedicated modules for campus placement mastery: timed aptitude, interactive DSA
            logic morphing, AI technical interviews, and capstone forging.
          </p>
        </div>

        {/* Segmented Module Tabs */}
        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#0D111A] border border-white/[0.08] shrink-0">
          <button
            onClick={() => onNavigate({ screen: "placement-season", tab: "aptitude" })}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === "aptitude"
                ? "bg-[#00F5D4] text-[#06080E]"
                : "text-[#94A3B8] hover:text-[#F4F7FB]"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            TSA Gauntlet
          </button>
          <button
            onClick={() => onNavigate({ screen: "placement-season", tab: "dsa-session" })}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === "dsa-session"
                ? "bg-[#00F5D4] text-[#06080E]"
                : "text-[#94A3B8] hover:text-[#F4F7FB]"
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            DSA Session
          </button>
          <button
            onClick={() => onNavigate({ screen: "placement-season", tab: "interview" })}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === "interview"
                ? "bg-[#8B5CF6] text-white"
                : "text-[#94A3B8] hover:text-[#F4F7FB]"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            Interview Boss
          </button>
          <button
            onClick={() => onNavigate({ screen: "placement-season", tab: "project-forge" })}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
              activeTab === "project-forge"
                ? "bg-[#00F5D4] text-[#06080E]"
                : "text-[#94A3B8] hover:text-[#F4F7FB]"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Project Forge
          </button>
        </div>
      </section>

      {activeTab === "aptitude" && <AptitudeGauntlet />}
      {activeTab === "dsa-session" && (
        <LogicToCodeSimulator
          onExit={() => onNavigate({ screen: "placement-season", tab: "aptitude" })}
        />
      )}
      {activeTab === "interview" && <InterviewBossDuel />}
      {activeTab === "project-forge" && <ProjectForge />}
    </main>
  );
}
