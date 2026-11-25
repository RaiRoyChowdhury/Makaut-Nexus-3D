import { Calculator, Cpu, ShieldCheck } from "lucide-react";
import { ExtractedClause, LogicMorphAnalysis } from "../../../types/logicMorph";

interface MathLogicXRayProps {
  clause: ExtractedClause | undefined;
  analysis: LogicMorphAnalysis;
}

export function MathLogicXRay({ clause, analysis }: MathLogicXRayProps) {
  if (!clause) return null;

  const { mathXRay } = clause;

  return (
    <div className="nexus-panel rounded-2xl p-4 lg:p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[#F4F7FB] inline-flex items-center gap-2">
          <Calculator className="w-4 h-4 text-[#00F5D4]" />
          Math & Logic X-Ray
        </h3>
        <span className="text-[11px] font-mono text-[#8B5CF6]">{analysis.problemCategory}</span>
      </div>

      {/* Formula Title */}
      <div className="rounded-xl bg-[#090C14] border border-[#00F5D4]/25 p-3.5 space-y-2">
        <p className="text-xs font-mono font-bold text-[#00F5D4]">{mathXRay.formulaTitle}</p>
        <p className="text-xs text-[#E2E8F0] leading-relaxed">{mathXRay.whyItWorks}</p>
      </div>

      {/* Step-by-Step Numerical Substitution */}
      {mathXRay.substitutionSteps.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-mono text-[#94A3B8]">Step-by-Step Substitution</p>
          <div className="rounded-xl bg-[#070A11] border border-white/[0.07] p-3 space-y-1 font-mono text-xs tabular-nums">
            {mathXRay.substitutionSteps.map((step, i) => (
              <div key={i} className="text-[#CBD5E1] flex items-start gap-2">
                <span className="text-[#00F5D4] select-none">{i + 1}.</span>
                <span>{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Boundary & Memory Intuition */}
      <div className="grid grid-cols-1 gap-2.5 text-xs">
        <div className="rounded-xl bg-[#090C14] border border-white/[0.07] p-3 space-y-1">
          <p className="text-[11px] font-mono text-[#F59E0B] inline-flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Boundary Intuition
          </p>
          <p className="text-[#CBD5E1] leading-relaxed">{mathXRay.boundaryIntuition}</p>
        </div>

        <div className="rounded-xl bg-[#090C14] border border-white/[0.07] p-3 space-y-1">
          <p className="text-[11px] font-mono text-[#8B5CF6] inline-flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5" />
            Complexity & Data Intuition
          </p>
          <p className="text-[#CBD5E1] leading-relaxed">{mathXRay.intuition}</p>
        </div>
      </div>

      {/* Compact Complexity & Edge Cases Footer */}
      <div className="pt-2 border-t border-white/[0.07] space-y-2 text-xs">
        <div className="flex items-center justify-between font-mono tabular-nums">
          <span className="text-[#94A3B8]">Time: <strong className="text-[#00F5D4]">{analysis.complexity.time}</strong></span>
          <span className="text-[#94A3B8]">Space: <strong className="text-[#8B5CF6]">{analysis.complexity.space}</strong></span>
        </div>
        {analysis.edgeCases.length > 0 && (
          <div className="text-[11px] text-[#94A3B8] space-y-1">
            <span className="font-mono text-[#CBD5E1]">Key Edge Cases:</span>
            <ul className="list-disc list-inside space-y-0.5">
              {analysis.edgeCases.slice(0, 3).map((ec, i) => (
                <li key={i}>{ec}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
