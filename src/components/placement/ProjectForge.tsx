import { useState } from "react";
import { Bookmark, Check, Copy, Cpu, Layers, Sparkles, Trash2 } from "lucide-react";
import { generateProjectBlueprint, ProjectForgeResult } from "../../services/aiService";
import { useNexus } from "../../store/useNexusStore";
import { AegisGrid3D } from "./AegisGrid3D";
import { VoiceTextControls } from "../VoiceTextControls";

const DOMAINS = [
  "Distributed Systems",
  "AI & Machine Learning",
  "Full-Stack Web",
  "Cybersecurity & Networks",
];

const DIFFICULTIES = ["Intermediate (Sem 3-4)", "Advanced (Placement Portfolio)", "Research Capstone"];
const PROJECT_TYPES = ["Web Application", "Systems / CLI Engine", "Interactive 3D Tool", "Developer Platform"];

export function ProjectForge() {
  const { progress, saveProjectBlueprint, deleteProjectBlueprint } = useNexus();
  const [subTab, setSubTab] = useState<"generator" | "aegis3d">("generator");

  const [domain, setDomain] = useState(DOMAINS[0]);
  const [difficulty, setDifficulty] = useState(DIFFICULTIES[1]);
  const [stack, setStack] = useState("TypeScript, React, Node.js, Three.js");
  const [projectType, setProjectType] = useState(PROJECT_TYPES[0]);

  const [loading, setLoading] = useState(false);
  const [blueprint, setBlueprint] = useState<ProjectForgeResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    setSavedNotice(false);
    try {
      const res = await generateProjectBlueprint({ domain, difficulty, stack, projectType });
      setBlueprint(res);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!blueprint) return;
    const text = `# ${blueprint.title}\n\nProblem: ${blueprint.problemStatement}\n\nSolution: ${blueprint.proposedSolution}\n\nFeatures:\n- ${blueprint.coreFeatures.join("\n- ")}\n\nStack: ${blueprint.techStack.join(", ")}\n\nRoadmap:\n- ${blueprint.roadmap.join("\n- ")}`;
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleSave = () => {
    if (!blueprint) return;
    saveProjectBlueprint({
      id: `bp-${Date.now()}`,
      domain,
      difficulty,
      createdAt: new Date().toLocaleDateString(),
      ...blueprint,
    });
    setSavedNotice(true);
  };

  return (
    <div className="space-y-6">
      {/* Sub-mode switcher: AI Blueprint Generator vs AegisGrid 3D Capstone */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#0D111A] border border-white/[0.08]">
          <button
            onClick={() => setSubTab("generator")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer ${
              subTab === "generator"
                ? "bg-[#00F5D4] text-[#06080E]"
                : "text-[#94A3B8] hover:text-[#F4F7FB]"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI Project Blueprint Forge
          </button>
          <button
            onClick={() => setSubTab("aegis3d")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer ${
              subTab === "aegis3d"
                ? "bg-[#8B5CF6] text-white"
                : "text-[#94A3B8] hover:text-[#F4F7FB]"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            AegisGrid 3D Capstone Viewer
          </button>
        </div>

        <span className="text-xs font-mono text-[#94A3B8]">
          Saved Blueprints: {progress.savedProjects.length}
        </span>
      </div>

      {subTab === "aegis3d" ? (
        <AegisGrid3D />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left Form */}
          <div className="nexus-panel rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono text-[#00F5D4]">
              <Cpu className="w-4 h-4" />
              CONFIGURE CAPSTONE PARAMETERS
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-[#94A3B8] block">Domain</label>
              <select
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full rounded-xl bg-[#090C14] border border-white/10 px-3 py-2.5 text-sm text-[#F4F7FB] focus:border-[#00F5D4] focus:outline-none"
              >
                {DOMAINS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-[#94A3B8] block">Difficulty Level</label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full rounded-xl bg-[#090C14] border border-white/10 px-3 py-2.5 text-sm text-[#F4F7FB] focus:border-[#00F5D4] focus:outline-none"
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-[#94A3B8] block">Project Type</label>
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                className="w-full rounded-xl bg-[#090C14] border border-white/10 px-3 py-2.5 text-sm text-[#F4F7FB] focus:border-[#00F5D4] focus:outline-none"
              >
                {PROJECT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-[#94A3B8] block">Preferred Technology Stack</label>
              <input
                type="text"
                value={stack}
                onChange={(e) => setStack(e.target.value)}
                placeholder="e.g., React, Go, Postgres, Docker"
                className="w-full rounded-xl bg-[#090C14] border border-white/10 px-3 py-2.5 text-sm text-[#F4F7FB] focus:border-[#00F5D4] focus:outline-none"
              />
              <VoiceTextControls
                value={stack}
                onChange={setStack}
                contextHint="Software engineering tech stack list"
                speakLabel="Speak Stack"
                uploadLabel="Upload Voice"
                compact
                separator="comma"
                disabled={loading}
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full py-3 rounded-xl bg-[#00F5D4] hover:bg-[#00DFC0] text-[#06080E] text-sm font-bold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {loading ? "Forging Blueprint..." : "Generate Project Blueprint"}
            </button>
          </div>

          {/* Right Output & Saved List */}
          <div className="lg:col-span-2 space-y-6">
            {blueprint ? (
              <div className="nexus-panel rounded-2xl p-6 space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-mono text-[#00F5D4]">
                      GENERATED BLUEPRINT · {blueprint.source === "gemini" ? "GEMINI AI" : "LOCAL ARCHITECT"}
                    </p>
                    <h3 className="mt-1 text-xl font-bold text-[#F4F7FB]">{blueprint.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopy}
                      className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-medium text-[#CBD5E1] inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                    <button
                      onClick={handleSave}
                      className="px-3 py-1.5 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      {savedNotice ? "Saved (+120 XP)" : "Save Blueprint"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs leading-relaxed">
                  <div className="rounded-xl bg-[#090C14] border border-white/[0.07] p-4 space-y-1.5">
                    <p className="font-mono text-[#F59E0B]">PROBLEM STATEMENT</p>
                    <p className="text-[#CBD5E1]">{blueprint.problemStatement}</p>
                  </div>
                  <div className="rounded-xl bg-[#090C14] border border-white/[0.07] p-4 space-y-1.5">
                    <p className="font-mono text-[#00F5D4]">PROPOSED SOLUTION</p>
                    <p className="text-[#CBD5E1]">{blueprint.proposedSolution}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-2">
                    <p className="font-mono text-[#8B5CF6]">CORE FEATURES</p>
                    <ul className="space-y-1.5 text-[#CBD5E1] list-disc list-inside">
                      {blueprint.coreFeatures.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <p className="font-mono text-[#10B981]">IMPLEMENTATION ROADMAP</p>
                    <ul className="space-y-1.5 text-[#CBD5E1] list-disc list-inside">
                      {blueprint.roadmap.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/[0.07] text-xs font-mono">
                  <span className="text-[#94A3B8]">
                    Stack: <span className="text-[#F4F7FB]">{blueprint.techStack.join(" · ")}</span>
                  </span>
                </div>
              </div>
            ) : (
              <div className="nexus-panel rounded-2xl p-10 text-center space-y-2">
                <p className="text-sm font-medium text-[#F4F7FB]">
                  Ready to Forge Your Placement Capstone
                </p>
                <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
                  Select a domain, difficulty, and stack on the left to generate a resume-ready
                  MAKAUT engineering project blueprint with roadmap and extensions.
                </p>
              </div>
            )}

            {/* Saved Blueprints Library */}
            {progress.savedProjects.length > 0 && (
              <div className="nexus-panel rounded-2xl p-6 space-y-3">
                <h4 className="text-sm font-semibold text-[#F4F7FB]">Saved Project Blueprints</h4>
                <div className="divide-y divide-white/[0.06]">
                  {progress.savedProjects.map((p) => (
                    <div key={p.id} className="py-3 flex items-center justify-between gap-4">
                      <button
                        onClick={() => setBlueprint(p)}
                        className="text-left min-w-0 cursor-pointer group"
                      >
                        <p className="text-sm font-semibold text-[#F4F7FB] group-hover:text-[#00F5D4] truncate">
                          {p.title}
                        </p>
                        <p className="text-xs font-mono text-[#94A3B8]">
                          {p.domain} · {p.createdAt}
                        </p>
                      </button>
                      <button
                        onClick={() => deleteProjectBlueprint(p.id)}
                        className="text-[#64748B] hover:text-[#EF4444] p-1.5 cursor-pointer"
                        aria-label="Delete saved project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
