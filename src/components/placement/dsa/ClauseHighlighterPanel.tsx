import { AlertTriangle, CheckCircle2, Wrench } from "lucide-react";
import { ExtractedClause } from "../../../types/logicMorph";

interface ClauseHighlighterPanelProps {
  clauses: ExtractedClause[];
  activeStepIdx: number;
  onSelectClause: (idx: number) => void;
  onApplyFix: (clause: ExtractedClause) => void;
}

export function ClauseHighlighterPanel({
  clauses,
  activeStepIdx,
  onSelectClause,
  onApplyFix,
}: ClauseHighlighterPanelProps) {
  const warnings = clauses.filter((c) => c.status === "warning");

  return (
    <div className="space-y-4 pt-3 border-t border-white/[0.08]">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-[#F4F7FB]">Extracted Logic Clauses</span>
        <span className="font-mono text-[#94A3B8] tabular-nums">
          {clauses.length} clauses · {warnings.length} warning{warnings.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Clause list with valid / warning / filler treatments */}
      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {clauses.map((clause, idx) => {
          const isActive = idx === activeStepIdx;
          const isWarning = clause.status === "warning";
          const isFiller = Boolean(clause.isFiller);

          return (
            <button
              key={clause.clauseId}
              type="button"
              onClick={() => onSelectClause(idx)}
              className={`w-full text-left rounded-xl p-3 border transition-colors cursor-pointer ${
                isActive
                  ? isWarning
                    ? "bg-[#F59E0B]/15 border-[#F59E0B]/70"
                    : "bg-[#00F5D4]/12 border-[#00F5D4]/70"
                  : isWarning
                  ? "bg-[#F59E0B]/[0.06] border-[#F59E0B]/30 hover:border-[#F59E0B]/60"
                  : isFiller
                  ? "bg-[#090C14]/60 border-white/[0.05] opacity-60 hover:opacity-90"
                  : "bg-[#090C14] border-white/[0.08] hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between gap-2 text-[11px] font-mono mb-1">
                <span className={isWarning ? "text-[#F59E0B]" : "text-[#00F5D4]"}>
                  Step {idx + 1} · {clause.logicRole}
                </span>
                <span className="inline-flex items-center gap-1 text-[#94A3B8]">
                  {isWarning ? (
                    <>
                      <AlertTriangle className="w-3 h-3 text-[#F59E0B]" />
                      <span className="text-[#F59E0B]">Warning</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-[#10B981]" />
                      <span>Valid</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>{clause.codeLineIds.join(", ")}</span>
                </span>
              </div>
              <p
                className={`text-xs leading-relaxed ${
                  isFiller ? "text-[#64748B]" : "text-[#E2E8F0]"
                }`}
              >
                {clause.englishSpan}
              </p>
            </button>
          );
        })}
      </div>

      {/* Gentle Bug Detector Cards */}
      {warnings.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-xs font-mono text-[#F59E0B] inline-flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Gentle Bug Detector
          </p>
          {warnings.map((w) => (
            <div
              key={`warn-${w.clauseId}`}
              className="rounded-xl bg-[#271C0B]/55 border border-[#F59E0B]/40 p-3.5 space-y-2"
            >
              <p className="text-xs font-semibold text-[#FDE68A]">
                {w.warningMessage || "Potential algorithmic boundary or logic issue"}
              </p>
              <p className="text-xs text-[#CBD5E1] leading-relaxed">
                <span className="text-[#94A3B8]">Clause: </span>"{w.englishSpan}"
              </p>
              {w.whyItCanFail && (
                <p className="text-xs text-[#CBD5E1] leading-relaxed">
                  <span className="text-[#F59E0B] font-medium">Why it can fail: </span>
                  {w.whyItCanFail}
                </p>
              )}
              {w.suggestedFix && (
                <div className="rounded-lg bg-[#090C14]/80 border border-white/[0.08] p-2.5 space-y-2">
                  <p className="text-[11px] font-mono text-[#00F5D4]">
                    {w.fixCertainty === "confirmed"
                      ? "Suggested Fix"
                      : "Suggestion (Review Recommended)"}
                  </p>
                  <p className="text-xs font-mono text-[#F4F7FB]">{w.suggestedFix}</p>
                  <button
                    type="button"
                    onClick={() => onApplyFix(w)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00F5D4] hover:bg-[#00DFC0] text-[#06080E] text-xs font-bold cursor-pointer"
                  >
                    <Wrench className="w-3.5 h-3.5" />
                    Apply Fix
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
