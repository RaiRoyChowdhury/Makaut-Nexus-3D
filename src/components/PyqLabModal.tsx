import { useState } from "react";
import { Eraser, Loader2, Sparkles, Wand2, X } from "lucide-react";
import { PyqLabConfig, SAMPLE_PYQ_CHIPS } from "../types/pyqLab";
import { generatePyqLab } from "../services/pyqLabService";

interface PyqLabModalProps {
  open: boolean;
  onClose: () => void;
  onLaunchLab: (config: PyqLabConfig) => void;
}

export function PyqLabModal({ open, onClose, onLaunchLab }: PyqLabModalProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!open) return null;

  const handleGenerate = async () => {
    const trimmed = query.trim();
    if (trimmed.length < 4) {
      setErrorMsg("Please enter a MAKAUT question, paper code, or technical topic (at least 4 characters).");
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      const config = await generatePyqLab(trimmed);
      onLaunchLab(config);
      onClose();
    } catch {
      setErrorMsg("Unable to parse question. Try one of the sample MAKAUT PYQ chips below.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#06080E]/82 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pyq-modal-title"
    >
      <div className="nexus-panel-solid rounded-2xl max-w-2xl w-full p-6 lg:p-7 border border-[#00F5D4]/35 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-mono text-[#00F5D4]">
              <Wand2 className="w-4 h-4" />
              <span>AI ENGINE ROUTER · GEMINI + LOCAL FALLBACK</span>
            </div>
            <h2 id="pyq-modal-title" className="text-xl lg:text-2xl font-bold text-[#F4F7FB]">
              INSTANT 3D LAB GENERATOR
            </h2>
            <p className="text-sm text-[#94A3B8]">
              Transform any MAKAUT question into an interactive learning simulation.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-[#94A3B8] hover:text-[#F4F7FB] p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
            aria-label="Close generator modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Multiline Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-[#94A3B8]">
            <span>MAKAUT PYQ / Syllabus Topic Input</span>
            {query.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setErrorMsg(null);
                }}
                className="inline-flex items-center gap-1 text-[#94A3B8] hover:text-[#00F5D4] transition-colors cursor-pointer"
              >
                <Eraser className="w-3.5 h-3.5" />
                Clear Input
              </button>
            )}
          </div>

          <textarea
            rows={4}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            placeholder="Paste any MAKAUT PYQ, syllabus topic, or technical problem..."
            className="w-full rounded-xl bg-[#090C14] border border-white/15 focus:border-[#00F5D4] focus:outline-none p-4 text-sm text-[#F4F7FB] placeholder:text-[#64748B] resize-y"
          />
        </div>

        {/* Sample PYQ Chips */}
        <div className="space-y-2">
          <p className="text-xs font-mono text-[#8B5CF6]">ONE-CLICK SAMPLE MAKAUT PYQS</p>
          <div className="flex flex-col gap-2">
            {SAMPLE_PYQ_CHIPS.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => {
                  setQuery(sample);
                  setErrorMsg(null);
                }}
                className={`text-left px-3.5 py-2.5 rounded-xl border text-xs transition-colors cursor-pointer ${
                  query.trim() === sample
                    ? "bg-[#00F5D4]/12 border-[#00F5D4]/60 text-[#00F5D4]"
                    : "bg-[#0B0F18] border-white/[0.08] text-[#CBD5E1] hover:border-[#00F5D4]/45 hover:text-[#F4F7FB]"
                }`}
              >
                {sample}
              </button>
            ))}
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-lg px-3.5 py-2 bg-[#2A1215] border border-[#EF4444]/45 text-xs text-[#FCA5A5]">
            {errorMsg}
          </div>
        )}

        {/* Primary Action */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-[#CBD5E1] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl bg-[#00F5D4] hover:bg-[#00DFC0] text-[#06080E] text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analyzing & Building 3D Scene...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                GENERATE PLAYABLE 3D LAB
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
