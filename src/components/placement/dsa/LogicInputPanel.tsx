import { useRef, useState } from "react";
import { Loader2, RefreshCw, ScanText, Sparkles } from "lucide-react";
import { PRESET_PROBLEMS } from "../../../data/localDsaPresets";
import { ExtractedClause, LogicMorphAnalysis } from "../../../types/logicMorph";
import { ClauseHighlighterPanel } from "./ClauseHighlighterPanel";
import { FileUploadController } from "./FileUploadController";
import { SpeechInputController } from "./SpeechInputController";
import { VoiceTextControls } from "../../VoiceTextControls";

interface LogicInputPanelProps {
  mode: "binary-search" | "two-sum-ii" | "custom";
  onSelectMode: (mode: "binary-search" | "two-sum-ii" | "custom") => void;
  problemStatement: string;
  onProblemStatementChange: (val: string) => void;
  logicText: string;
  onLogicTextChange: (val: string) => void;
  pseudocode: string;
  onPseudocodeChange: (val: string) => void;
  exampleInput: string;
  onExampleInputChange: (val: string) => void;
  expectedOutput: string;
  onExpectedOutputChange: (val: string) => void;
  analysis: LogicMorphAnalysis;
  activeStepIdx: number;
  onSelectClause: (idx: number) => void;
  onApplyFix: (clause: ExtractedClause) => void;
  scanning: boolean;
  scanNotice: string | null;
  onScanEntire: (forceGemini?: boolean) => void;
  onScanSelected: (selectedText: string) => void;
}

export function LogicInputPanel({
  mode,
  onSelectMode,
  problemStatement,
  onProblemStatementChange,
  logicText,
  onLogicTextChange,
  pseudocode,
  onPseudocodeChange,
  exampleInput,
  onExampleInputChange,
  expectedOutput,
  onExpectedOutputChange,
  analysis,
  activeStepIdx,
  onSelectClause,
  onApplyFix,
  scanning,
  scanNotice,
  onScanEntire,
  onScanSelected,
}: LogicInputPanelProps) {
  const logicTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectionHint, setSelectionHint] = useState<string | null>(null);
  const [showOptionalFields, setShowOptionalFields] = useState(false);

  const handleScanSelectionClick = () => {
    const el = logicTextareaRef.current;
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selected = logicText.slice(start, end).trim();
    if (!selected) {
      setSelectionHint(
        "Highlight a specific sentence or paragraph inside the logic box first, then click Scan Selected Logic."
      );
      return;
    }
    setSelectionHint(null);
    onScanSelected(selected);
    // Restore selection visually after scan trigger so user doesn't lose highlight
    window.requestAnimationFrame(() => {
      if (logicTextareaRef.current) {
        logicTextareaRef.current.focus();
        logicTextareaRef.current.setSelectionRange(start, end);
      }
    });
  };

  return (
    <section
      aria-label="Logic Input and Scanner"
      className="nexus-panel rounded-2xl p-4 lg:p-5 space-y-4 flex flex-col"
    >
      {/* Panel Header */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-[#F4F7FB]">Logic Input & Scanner</h2>
          <p className="text-xs text-[#94A3B8]">
            Choose an offline demo or enter any DSA problem
          </p>
        </div>
        <span className="text-[11px] font-mono text-[#00F5D4] whitespace-nowrap">
          {analysis.source === "preset"
            ? "Offline Preset"
            : analysis.source === "gemini"
            ? "Gemini AI"
            : analysis.source === "local-template"
            ? "Local Template"
            : "Offline Scan"}
        </span>
      </div>

      {/* Three-Way Problem Selector */}
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-[#090C14] border border-white/[0.08]">
        {PRESET_PROBLEMS.map((p) => {
          const active = mode === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                setSelectionHint(null);
                onSelectMode(p.id);
              }}
              className={`px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer truncate ${
                active
                  ? "bg-[#00F5D4] text-[#06080E] font-bold"
                  : "text-[#94A3B8] hover:text-[#F4F7FB]"
              }`}
              title={p.title}
            >
              {p.id === "binary-search" ? "Binary Search" : "Two Sum II"}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setSelectionHint(null);
            onSelectMode("custom");
          }}
          className={`px-2.5 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer truncate ${
            mode === "custom"
              ? "bg-[#8B5CF6] text-white font-bold"
              : "text-[#94A3B8] hover:text-[#F4F7FB]"
          }`}
          title="Write My Own DSA Logic"
        >
          Write My Own
        </button>
      </div>

      {/* Problem Statement Summary / Input */}
      {mode === "custom" ? (
        <div className="space-y-3">
          <div>
            <label
              htmlFor="dsa-problem-statement"
              className="block text-xs font-mono text-[#94A3B8] mb-1.5"
            >
              Problem Statement
            </label>
            <textarea
              id="dsa-problem-statement"
              rows={2}
              value={problemStatement}
              onChange={(e) => onProblemStatementChange(e.target.value)}
              placeholder="e.g., Find maximum sum contiguous subarray of size k, or Reverse a singly linked list..."
              className="w-full rounded-xl bg-[#090C14] border border-white/10 focus:border-[#00F5D4] focus:outline-none p-3 text-xs text-[#F4F7FB] placeholder:text-[#64748B] resize-y"
            />
            <div className="mt-1.5">
              <VoiceTextControls
                value={problemStatement}
                onChange={onProblemStatementChange}
                contextHint="DSA problem statement"
                speakLabel="Speak Problem"
                uploadLabel="Upload Voice"
                compact
                separator="space"
                disabled={scanning}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowOptionalFields((s) => !s)}
            className="text-[11px] font-mono text-[#94A3B8] hover:text-[#00F5D4] underline underline-offset-4 cursor-pointer"
          >
            {showOptionalFields
              ? "Hide Optional Pseudocode & I/O"
              : "+ Add Optional Pseudocode / Example I/O"}
          </button>

          {showOptionalFields && (
            <div className="space-y-2.5 rounded-xl bg-[#090C14]/70 border border-white/[0.07] p-3">
              <div>
                <label
                  htmlFor="dsa-pseudocode"
                  className="block text-[11px] font-mono text-[#94A3B8] mb-1"
                >
                  Optional Pseudocode
                </label>
                <textarea
                  id="dsa-pseudocode"
                  rows={2}
                  value={pseudocode}
                  onChange={(e) => onPseudocodeChange(e.target.value)}
                  placeholder="Optional pseudocode lines..."
                  className="w-full rounded-lg bg-[#06080E] border border-white/10 focus:border-[#00F5D4] focus:outline-none p-2 text-xs font-mono text-[#CBD5E1]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="dsa-example-in"
                    className="block text-[11px] font-mono text-[#94A3B8] mb-1"
                  >
                    Example Input
                  </label>
                  <input
                    id="dsa-example-in"
                    type="text"
                    value={exampleInput}
                    onChange={(e) => onExampleInputChange(e.target.value)}
                    placeholder="arr = [2, 1, 5], k = 2"
                    className="w-full rounded-lg bg-[#06080E] border border-white/10 focus:border-[#00F5D4] focus:outline-none px-2.5 py-1.5 text-xs font-mono text-[#CBD5E1]"
                  />
                </div>
                <div>
                  <label
                    htmlFor="dsa-expected-out"
                    className="block text-[11px] font-mono text-[#94A3B8] mb-1"
                  >
                    Expected Output
                  </label>
                  <input
                    id="dsa-expected-out"
                    type="text"
                    value={expectedOutput}
                    onChange={(e) => onExpectedOutputChange(e.target.value)}
                    placeholder="6"
                    className="w-full rounded-lg bg-[#06080E] border border-white/10 focus:border-[#00F5D4] focus:outline-none px-2.5 py-1.5 text-xs font-mono text-[#CBD5E1]"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl bg-[#090C14] border border-white/[0.08] p-3.5 space-y-2">
          <div className="flex items-center justify-between gap-2 text-[11px] font-mono text-[#94A3B8]">
            <span className="text-[#00F5D4]">{analysis.problemCategory}</span>
            <span>Works 100% Offline</span>
          </div>
          <p className="text-xs text-[#CBD5E1] leading-relaxed">{problemStatement}</p>
          <div className="pt-1.5 border-t border-white/[0.06] grid grid-cols-1 gap-1 text-[11px] font-mono">
            <div>
              <span className="text-[#94A3B8]">Input: </span>
              <span className="text-[#F4F7FB]">{exampleInput}</span>
            </div>
            <div>
              <span className="text-[#94A3B8]">Output: </span>
              <span className="text-[#00F5D4]">{expectedOutput}</span>
            </div>
          </div>
        </div>
      )}

      {/* Plain-English Logic Textarea */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="dsa-english-logic" className="text-xs font-mono text-[#94A3B8]">
            Plain-English Logic (highlight any sentence for selective scan)
          </label>
        </div>
        <textarea
          id="dsa-english-logic"
          ref={logicTextareaRef}
          rows={6}
          value={logicText}
          onChange={(e) => {
            setSelectionHint(null);
            onLogicTextChange(e.target.value);
          }}
          placeholder="Describe your algorithm step by step in plain English or pseudocode..."
          className="w-full rounded-xl bg-[#090C14] border border-white/10 focus:border-[#00F5D4] focus:outline-none p-3 text-xs text-[#F4F7FB] placeholder:text-[#64748B] leading-relaxed resize-y"
        />

        {/* Voice Dictation + File Upload Controls */}
        <SpeechInputController currentText={logicText} onTextChange={onLogicTextChange} />
        <FileUploadController
          onPopulateLogic={(payload) => {
            onSelectMode("custom");
            onLogicTextChange(payload.logicText);
            if (payload.problemStatement) onProblemStatementChange(payload.problemStatement);
            if (payload.exampleInput) onExampleInputChange(payload.exampleInput);
            if (payload.expectedOutput) onExpectedOutputChange(payload.expectedOutput);
          }}
        />
      </div>

      {/* Scan & Translate Action Bar */}
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectionHint(null);
              onScanEntire(false);
            }}
            disabled={scanning || !logicText.trim()}
            className="flex-1 min-w-[170px] px-4 py-2.5 rounded-xl bg-[#00F5D4] hover:bg-[#00DFC0] text-[#06080E] text-xs font-bold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            {scanning ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {scanning ? "Scanning Logic..." : "SCAN & TRANSLATE LOGIC"}
          </button>

          <button
            type="button"
            onClick={handleScanSelectionClick}
            disabled={scanning || !logicText.trim()}
            className="px-3.5 py-2.5 rounded-xl bg-[#141926] border border-white/15 hover:border-[#8B5CF6]/70 text-[#F4F7FB] text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            <ScanText className="w-3.5 h-3.5 text-[#8B5CF6]" />
            SCAN SELECTED LOGIC
          </button>
        </div>

        {selectionHint && (
          <p className="text-xs text-[#F59E0B]">{selectionHint}</p>
        )}

        {analysis.analyzedScope === "selection" && analysis.analyzedText && (
          <div className="rounded-lg bg-[#8B5CF6]/12 border border-[#8B5CF6]/40 px-3 py-2 text-[11px] text-[#DDD6FE]">
            <span className="font-mono font-semibold">Analyzed Selection: </span>
            <span className="italic">"{analysis.analyzedText.slice(0, 140)}{analysis.analyzedText.length > 140 ? "..." : ""}"</span>
          </div>
        )}

        {(scanNotice ||
          analysis.source === "local-template" ||
          analysis.source === "unverified-offline") && (
          <div className="rounded-xl bg-[#271C0B]/50 border border-[#F59E0B]/35 p-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#FDE68A]">
            <span className="leading-relaxed">
              {scanNotice ||
                "Running in offline fallback mode. Retry Gemini when connection/quota is available."}
            </span>
            <button
              type="button"
              onClick={() => onScanEntire(true)}
              disabled={scanning}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#F59E0B] text-[#06080E] text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className={`w-3 h-3 ${scanning ? "animate-spin" : ""}`} />
              Retry Gemini
            </button>
          </div>
        )}
      </div>

      {/* Extracted Clause Highlighter + Gentle Bug Detector */}
      <ClauseHighlighterPanel
        clauses={analysis.extractedClauses}
        activeStepIdx={activeStepIdx}
        onSelectClause={onSelectClause}
        onApplyFix={onApplyFix}
      />
    </section>
  );
}
