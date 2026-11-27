import { Check, ChevronRight, FileDown, Sparkles, Wand2, X } from "lucide-react";
import { AppView } from "../types/nexus";

interface JudgeDemoDrawerProps {
  open: boolean;
  onClose: () => void;
  view: AppView;
  onNavigate: (view: AppView) => void;
  onOpenPyqGenerator: () => void;
}

interface DemoStep {
  id: string;
  label: string;
  sub: string;
  target: AppView;
  isActive: (v: AppView) => boolean;
}

const DEMO_STEPS: DemoStep[] = [
  {
    id: "hub",
    label: "1. Year 2 Command Hub",
    sub: "Locked Year 1/3/4 · Live CGPA & 3D backdrop",
    target: { screen: "hub" },
    isActive: (v) => v.screen === "hub",
  },
  {
    id: "sem3",
    label: "2. Exam Season (6 Subjects)",
    sub: "MAKAUT Sem 3 paper codes & mastery",
    target: { screen: "exam-season" },
    isActive: (v) => v.screen === "exam-season",
  },
  {
    id: "game1",
    label: "3. Unknot the Pointer 3D",
    sub: "Interactive 3D DSA pointer rewiring + AI Hint",
    target: { screen: "game", gameId: "pointer-3d" },
    isActive: (v) => v.screen === "game" && v.gameId === "pointer-3d",
  },
  {
    id: "game3",
    label: "4. Laser Prism Logic 3D",
    sub: "Live 3D optics, rotating mirrors & logic gates",
    target: { screen: "game", gameId: "laser-prism" },
    isActive: (v) => v.screen === "game" && v.gameId === "laser-prism",
  },
  {
    id: "dsa-session",
    label: "5. DSA Logic → Code Morph",
    sub: "English/Voice/OCR to C/Python/C++/Java + 2D X-Ray",
    target: { screen: "placement-season", tab: "dsa-session" },
    isActive: (v) => v.screen === "placement-season" && v.tab === "dsa-session",
  },
  {
    id: "boss",
    label: "6. Interview Boss Duel",
    sub: "3-Shield Gemini-graded technical interview",
    target: { screen: "placement-season", tab: "interview" },
    isActive: (v) => v.screen === "placement-season" && v.tab === "interview",
  },
  {
    id: "forge",
    label: "7. Project Forge & AegisGrid 3D",
    sub: "AI Capstone generator + 3D Raft cluster mesh",
    target: { screen: "placement-season", tab: "project-forge" },
    isActive: (v) => v.screen === "placement-season" && v.tab === "project-forge",
  },
];

export function JudgeDemoDrawer({
  open,
  onClose,
  view,
  onNavigate,
  onOpenPyqGenerator,
}: JudgeDemoDrawerProps) {
  if (!open) return null;

  return (
    <aside className="fixed right-4 top-20 z-50 w-80 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-5.5rem)] overflow-y-auto nexus-panel-solid rounded-2xl border border-[#00F5D4]/40 p-4 space-y-3 shadow-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#00F5D4]" />
          <span className="text-xs font-mono font-bold text-[#F4F7FB]">
            JUDGE DEMO QUICK-LAUNCH
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-[#94A3B8] hover:text-[#F4F7FB] p-1 cursor-pointer"
          aria-label="Close Judge Demo"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <p className="text-[11px] text-[#94A3B8] leading-relaxed">
        Jump directly to any live interactive subsystem. All 3D scenes, AI hints, and XP rewards are
        fully playable.
      </p>

      <button
        type="button"
        onClick={() => {
          onClose();
          onOpenPyqGenerator();
        }}
        className="w-full py-2.5 px-3 rounded-xl bg-[#00F5D4]/15 border border-[#00F5D4]/60 text-[#00F5D4] hover:bg-[#00F5D4] hover:text-[#06080E] text-xs font-mono font-bold inline-flex items-center justify-center gap-2 shadow-[0_0_18px_rgba(0,245,212,0.2)] transition-all cursor-pointer"
      >
        <Wand2 className="w-3.5 h-3.5" />
        PYQ / TOPIC → 3D LAB
      </button>

      <a
        href="/MAKAUT_NEXUS_3D_Technical_Guidebook.pdf"
        download="MAKAUT_NEXUS_3D_Technical_Guidebook.pdf"
        className="w-full py-2 px-3 rounded-xl bg-[#8B5CF6]/15 border border-[#8B5CF6]/50 text-[#DDD6FE] hover:bg-[#8B5CF6] hover:text-white text-xs font-mono font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
      >
        <FileDown className="w-3.5 h-3.5" />
        DOWNLOAD GUIDEBOOK (PDF)
      </a>

      <div className="space-y-1.5">
        {DEMO_STEPS.map((step) => {
          const active = step.isActive(view);
          return (
            <button
              key={step.id}
              onClick={() => onNavigate(step.target)}
              className={`w-full text-left px-3 py-2 rounded-xl border transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                active
                  ? "bg-[#00F5D4]/15 border-[#00F5D4]/60 text-[#F4F7FB]"
                  : "bg-[#0A0D16] border-white/[0.06] text-[#CBD5E1] hover:border-white/20"
              }`}
            >
              <div className="min-w-0">
                <div className="text-xs font-semibold truncate">{step.label}</div>
                <div className="text-[10px] text-[#94A3B8] truncate">{step.sub}</div>
              </div>
              {active ? (
                <Check className="w-3.5 h-3.5 text-[#00F5D4] shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-[#64748B] shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
