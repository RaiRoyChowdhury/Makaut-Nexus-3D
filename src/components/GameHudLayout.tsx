import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  RotateCcw,
  Sparkles,
  Trophy,
  Wand2,
  Zap,
} from "lucide-react";
import { useNexus } from "../store/useNexusStore";
import { tutorVoice } from "../services/tutorVoice";
import { TutorWaveform } from "./TutorWaveform";

export interface LevelCompletePayload {
  level: number;
  score: number;
  xpEarned: number;
  conceptTitle: string;
  conceptExplanation: string;
  hasNextLevel: boolean;
}

interface GameHudLayoutProps {
  title: string;
  paperCode: string;
  subjectName: string;
  accentColor: string;
  level: number;
  totalLevels: number;
  objective: string;
  elapsedSeconds: number;
  score: number;
  combo: number;
  hintText: string | null;
  hintSource?: "gemini" | "local";
  hintLoading: boolean;
  intuitionText: string;
  feedbackBanner?: { type: "error" | "info" | "success"; text: string } | null;
  completion: LevelCompletePayload | null;
  onSelectLevel: (lvl: number) => void;
  onRequestHint: () => void;
  onReset: () => void;
  onValidate: () => void;
  onExit: () => void;
  onNextLevel: () => void;
  onResetCamera?: () => void;
  isCustomLab?: boolean;
  customProgressText?: string;
  onGenerateAnother?: () => void;
  validateLabel?: string;
  children: React.ReactNode;
  controlsSlot: React.ReactNode;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function GameHudLayout({
  title,
  paperCode,
  subjectName,
  accentColor,
  level,
  totalLevels,
  objective,
  elapsedSeconds,
  score,
  combo,
  hintText,
  hintSource,
  hintLoading,
  intuitionText,
  feedbackBanner,
  completion,
  onSelectLevel,
  onRequestHint,
  onReset,
  onValidate,
  onExit,
  onNextLevel,
  onResetCamera,
  isCustomLab = false,
  customProgressText,
  onGenerateAnother,
  validateLabel = "Validate Mission",
  children,
  controlsSlot,
}: GameHudLayoutProps) {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const { voiceEnabled, voiceSupported, toggleVoice } = useNexus();
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    const unsub = tutorVoice.subscribe(setIsSpeaking);
    return () => {
      unsub();
      tutorVoice.cancel();
    };
  }, []);

  return (
    <div className="relative w-full h-[calc(100dvh-4rem)] min-h-[420px] overflow-hidden bg-[#06080E]">
      {/* Full-bleed 3D Viewport */}
      <div className="absolute inset-0 z-0">{children}</div>

      {/* Top HUD Bar: Mission Panel (left) + Performance Panel (right) */}
      <div className="pointer-events-none absolute top-4 left-4 right-4 z-20 flex flex-col md:flex-row items-start justify-between gap-3">
        {/* Mission Panel */}
        <div className="pointer-events-auto nexus-panel rounded-xl px-4 py-3 max-w-xl">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
            <button
              onClick={() => {
                tutorVoice.cancel();
                onExit();
              }}
              className="inline-flex items-center gap-1 text-[#94A3B8] hover:text-[#00F5D4] transition-colors cursor-pointer mr-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Subjects
            </button>
            <span className="text-white/20">|</span>
            <span style={{ color: accentColor }} className="font-semibold">
              {paperCode}
            </span>
            <span className="text-[#94A3B8]">{subjectName}</span>
            {isCustomLab && (
              <span className="px-2 py-0.5 rounded bg-[#00F5D4]/15 border border-[#00F5D4]/50 text-[#00F5D4] font-bold text-[10px]">
                CUSTOM AI LAB
              </span>
            )}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="text-base font-bold text-[#F4F7FB]">{title}</h1>
            {!isCustomLab ? (
              <div className="flex items-center gap-1">
                {Array.from({ length: totalLevels }, (_, i) => i + 1).map((lvl) => (
                  <button
                    key={lvl}
                    onClick={() => onSelectLevel(lvl)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                      lvl === level
                        ? "bg-[#00F5D4] text-[#06080E] font-bold"
                        : "bg-white/[0.06] text-[#94A3B8] hover:text-[#F4F7FB]"
                    }`}
                  >
                    L{lvl}
                  </button>
                ))}
              </div>
            ) : (
              customProgressText && (
                <span className="text-[11px] font-mono text-[#8B5CF6]">
                  {customProgressText}
                </span>
              )
            )}
          </div>

          <p className="mt-1.5 text-xs text-[#CBD5E1] leading-relaxed">{objective}</p>
        </div>

        {/* Performance Panel + Camera Reset */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 shrink-0">
          <div className="nexus-panel rounded-xl px-4 py-2.5 flex items-center gap-4 font-mono text-xs tabular-nums">
            <div className="flex items-center gap-1.5 text-[#94A3B8]">
              <Clock className="w-3.5 h-3.5 text-[#00F5D4]" />
              <span className="text-[#F4F7FB]">{formatTime(elapsedSeconds)}</span>
            </div>
            <span className="text-white/15">|</span>
            <div className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-[#F59E0B]" />
              <span className="text-[#F4F7FB] font-semibold">{score}</span>
            </div>
            <span className="text-white/15">|</span>
            <div className="flex items-center gap-1 text-[#8B5CF6]">
              <Zap className="w-3.5 h-3.5" />
              <span>{combo}x</span>
            </div>
          </div>

          {onResetCamera && (
            <button
              type="button"
              onClick={onResetCamera}
              className="nexus-panel rounded-xl px-3 py-2.5 text-[11px] font-mono font-semibold text-[#CBD5E1] hover:text-[#00F5D4] hover:border-[#00F5D4]/50 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Reset 3D camera to original view"
            >
              <Camera className="w-3.5 h-3.5 text-[#00F5D4]" />
              RESET CAMERA
            </button>
          )}

          {isCustomLab && onGenerateAnother && (
            <button
              type="button"
              onClick={() => {
                tutorVoice.cancel();
                onGenerateAnother();
              }}
              className="nexus-panel rounded-xl px-3 py-2.5 text-[11px] font-mono font-semibold text-[#00F5D4] border-[#00F5D4]/40 hover:bg-[#00F5D4]/15 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" />
              GENERATE ANOTHER PYQ
            </button>
          )}
        </div>
      </div>

      {/* Unified Bottom Dock Stack (Toasts + Persistent AI Intuition + Collapsible Controls) */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-20 w-[min(980px,95vw)] flex flex-col items-center gap-2">
        {/* Feedback / Hint Toast Strip — stacked cleanly inside bottom column so it never overlaps AI Intuition */}
        {(hintText || feedbackBanner) && (
          <div className="w-full flex flex-col gap-2">
            {feedbackBanner && (
              <div
                className={`pointer-events-auto rounded-lg px-4 py-2 text-xs font-medium border ${
                  feedbackBanner.type === "error"
                    ? "bg-[#2A1215]/95 border-[#EF4444]/50 text-[#FCA5A5]"
                    : feedbackBanner.type === "success"
                    ? "bg-[#0D281E]/95 border-[#10B981]/50 text-[#6EE7B7]"
                    : "bg-[#0F172A]/95 border-[#00F5D4]/40 text-[#E2E8F0]"
                }`}
              >
                {feedbackBanner.text}
              </div>
            )}
            {hintText && (
              <div className="pointer-events-auto rounded-lg px-4 py-2.5 bg-[#12162A]/95 border border-[#8B5CF6]/50 text-xs text-[#E2E8F0] flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-[#00F5D4] shrink-0 mt-0.5" />
                <div className="min-w-0 leading-relaxed">
                  <span className="font-mono text-[10px] text-[#00F5D4] mr-2">
                    3D HINT BEAM ({hintSource === "gemini" ? "GEMINI AI" : "LOCAL TUTOR"}):
                  </span>
                  <span>{hintText}</span>
                </div>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setDockCollapsed((c) => !c)}
          className="pointer-events-auto px-3 py-1 rounded-lg bg-[#0D111A]/95 border border-white/10 text-[11px] font-mono text-[#94A3B8] hover:text-[#F4F7FB] inline-flex items-center gap-1.5 cursor-pointer"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5" />
              Show Controls
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5" />
              Hide Controls
            </>
          )}
        </button>

        <div className="pointer-events-auto w-full nexus-panel rounded-2xl p-3.5 space-y-3 max-h-[46vh] overflow-y-auto">
          {/* AI Tutor Intuition Strip + Waveform + Voice Toggle + 3D Hint Beam (always visible & never truncated) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-3 py-2 rounded-lg bg-[#090C14] border border-[#00F5D4]/20 text-xs">
            <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
              <span className="font-mono text-[10px] font-semibold text-[#00F5D4] shrink-0 mt-0.5 sm:mt-0">
                AI INTUITION
              </span>
              <p className="text-[#E2E8F0] leading-relaxed break-words">
                {intuitionText}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
              <TutorWaveform
                supported={voiceSupported}
                enabled={voiceEnabled}
                speaking={isSpeaking}
                onToggle={toggleVoice}
              />

              <button
                type="button"
                onClick={onRequestHint}
                disabled={hintLoading}
                className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#8B5CF6]/20 border border-[#8B5CF6]/45 text-[#DDD6FE] hover:bg-[#8B5CF6]/35 text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
              >
                <Sparkles className="w-3 h-3 text-[#00F5D4]" />
                {hintLoading ? "Scanning..." : "3D Hint Beam"}
              </button>
            </div>
          </div>

          {/* Game-specific Controls + Primary Actions */}
          {!dockCollapsed && (
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-1 border-t border-white/[0.06]">
              <div className="flex-1 min-w-0">{controlsSlot}</div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={onReset}
                  className="px-3 py-2 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-[#CBD5E1] text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset
                </button>
                <button
                  type="button"
                  onClick={onValidate}
                  className="px-4 py-2 rounded-lg text-[#06080E] text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                  style={{ backgroundColor: accentColor }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {validateLabel}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mission Completion Modal */}
      {completion && (
        <div className="absolute inset-0 z-30 bg-[#06080E]/82 flex items-center justify-center p-4">
          <div className="nexus-panel-solid rounded-2xl max-w-lg w-full p-6 space-y-5 border border-[#00F5D4]/40">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-[#00F5D4]/15 text-[#00F5D4] flex items-center justify-center">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <p className="text-xs font-mono text-[#00F5D4]">
                  {isCustomLab
                    ? "CUSTOM AI LAB COMPLETED"
                    : `MISSION LEVEL ${completion.level} CLEARED`}
                </p>
                <h2 className="text-xl font-bold text-[#F4F7FB]">{title}</h2>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 font-mono tabular-nums">
              <div className="rounded-xl bg-[#090C14] border border-white/[0.07] p-3.5">
                <span className="text-[11px] text-[#94A3B8] block">Mission Score</span>
                <span className="text-xl font-bold text-[#F4F7FB]">{completion.score} pts</span>
              </div>
              <div className="rounded-xl bg-[#090C14] border border-white/[0.07] p-3.5">
                <span className="text-[11px] text-[#94A3B8] block">XP Rewarded</span>
                <span className="text-xl font-bold text-[#00F5D4]">+{completion.xpEarned} XP</span>
              </div>
            </div>

            <div className="rounded-xl bg-[#111624] border border-white/[0.08] p-4 space-y-1.5">
              <p className="text-xs font-mono text-[#8B5CF6]">
                CONCEPT MASTERED · {completion.conceptTitle}
              </p>
              <p className="text-xs text-[#CBD5E1] leading-relaxed">
                {completion.conceptExplanation}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
              <button
                onClick={() => {
                  tutorVoice.cancel();
                  onExit();
                }}
                className="px-4 py-2.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] text-xs font-semibold text-[#F4F7FB] transition-colors cursor-pointer"
              >
                Return to Subjects
              </button>
              {isCustomLab && onGenerateAnother && (
                <button
                  onClick={() => {
                    tutorVoice.cancel();
                    onGenerateAnother();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#00F5D4] hover:bg-[#00DFC0] text-[#06080E] text-xs font-bold transition-colors cursor-pointer"
                >
                  GENERATE ANOTHER PYQ
                </button>
              )}
              {!isCustomLab && completion.hasNextLevel && (
                <button
                  onClick={onNextLevel}
                  className="px-5 py-2.5 rounded-xl bg-[#00F5D4] hover:bg-[#00DFC0] text-[#06080E] text-xs font-bold transition-colors cursor-pointer"
                >
                  Next Level →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
