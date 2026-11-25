import { Fragment, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  HelpCircle,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  XCircle,
} from "lucide-react";
import {
  ExtractedClause,
  LogicMorphAnalysis,
  PerLanguagePracticeState,
  PROGRAMMING_LANGUAGES,
  ProgrammingLanguage,
} from "../../../types/logicMorph";

interface CodeMorphWindowProps {
  analysis: LogicMorphAnalysis;
  language: ProgrammingLanguage;
  onLanguageChange: (lang: ProgrammingLanguage) => void;
  activeStepIdx: number;
  onStepChange: (idx: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  playbackSpeed: number;
  onPlaybackSpeedChange: (speed: number) => void;
  onHoverCodeLine: (lineNum: number | null) => void;
  onSelectCodeLine: (lineNum: number) => void;
  practiceState: PerLanguagePracticeState;
  onPracticeAttempt: (
    lang: ProgrammingLanguage,
    clauseId: string,
    token: string,
    correctToken: string
  ) => void;
}

const KEYWORDS = new Set([
  "int",
  "long",
  "void",
  "return",
  "if",
  "else",
  "elif",
  "while",
  "for",
  "def",
  "in",
  "range",
  "public",
  "new",
  "const",
  "vector",
  "struct",
  "static_cast",
  "list",
  "is",
  "not",
  "None",
  "null",
  "NULL",
  "nullptr",
  "len",
]);

function renderHighlightedLine(line: string) {
  const commentIdx =
    line.indexOf("//") !== -1 ? line.indexOf("//") : line.indexOf("#");
  const codePart = commentIdx !== -1 ? line.slice(0, commentIdx) : line;
  const commentPart = commentIdx !== -1 ? line.slice(commentIdx) : "";

  const tokens = codePart.split(/(\b[A-Za-z_]\w*\b|\b\d+\b)/g);

  return (
    <>
      {tokens.map((tok, i) => {
        if (!tok) return null;
        if (KEYWORDS.has(tok)) {
          return (
            <span key={i} className="text-[#C084FC] font-semibold">
              {tok}
            </span>
          );
        }
        if (/^\d+$/.test(tok)) {
          return (
            <span key={i} className="text-[#F59E0B]">
              {tok}
            </span>
          );
        }
        return (
          <Fragment key={i}>
            <span className="text-[#E2E8F0]">{tok}</span>
          </Fragment>
        );
      })}
      {commentPart && <span className="text-[#64748B] italic">{commentPart}</span>}
    </>
  );
}

export function CodeMorphWindow({
  analysis,
  language,
  onLanguageChange,
  activeStepIdx,
  onStepChange,
  isPlaying,
  onTogglePlay,
  playbackSpeed,
  onPlaybackSpeedChange,
  onHoverCodeLine,
  onSelectCodeLine,
  practiceState,
  onPracticeAttempt,
}: CodeMorphWindowProps) {
  const [viewMode, setViewMode] = useState<"full" | "practice">("full");

  const clauses = analysis.extractedClauses;
  const safeIdx = Math.min(Math.max(0, activeStepIdx), Math.max(0, clauses.length - 1));
  const activeClause: ExtractedClause | undefined = clauses[safeIdx];
  const fullLines = analysis.fullCode[language] ?? [];
  const activeLineSet = new Set(activeClause?.codeLineIds ?? []);
  const progressPct =
    clauses.length > 0 ? Math.round(((safeIdx + 1) / clauses.length) * 100) : 0;

  const activeBlank = activeClause?.practiceBlank?.[language];
  const langPracticeMap = practiceState[language] ?? {};
  const attempt = activeClause ? langPracticeMap[activeClause.clauseId] : undefined;

  // Gather all blanks across clauses for the active language so user sees full practice coverage
  const clausesWithBlanks = clauses.filter((c) => Boolean(c.practiceBlank?.[language]));

  return (
    <section
      aria-label="Code Morph Window and Step Controls"
      className="nexus-panel rounded-2xl p-4 lg:p-5 space-y-4 flex flex-col"
    >
      {/* Top Bar: Four-Language Switcher + Mode Switch */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Programming Language Switcher"
          className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#090C14] border border-white/[0.08]"
        >
          {PROGRAMMING_LANGUAGES.map((lang) => {
            const active = language === lang.id;
            return (
              <button
                key={lang.id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => onLanguageChange(lang.id)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? "bg-[#00F5D4] text-[#06080E]"
                    : "text-[#94A3B8] hover:text-[#F4F7FB]"
                }`}
              >
                {lang.label}
              </button>
            );
          })}
        </div>

        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#090C14] border border-white/[0.08]">
          <button
            type="button"
            onClick={() => setViewMode("full")}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              viewMode === "full"
                ? "bg-[#8B5CF6] text-white"
                : "text-[#94A3B8] hover:text-[#F4F7FB]"
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            FULL CODE
          </button>
          <button
            type="button"
            onClick={() => setViewMode("practice")}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              viewMode === "practice"
                ? "bg-[#8B5CF6] text-white"
                : "text-[#94A3B8] hover:text-[#F4F7FB]"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            PRACTICE BLANKS
          </button>
        </div>
      </div>

      {/* Clause-by-Clause Execution Controls */}
      <div className="rounded-xl bg-[#090C14] border border-white/[0.08] p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onStepChange(Math.max(0, safeIdx - 1))}
              disabled={safeIdx === 0}
              className="px-3 py-1.5 rounded-lg bg-[#141926] border border-white/10 text-xs font-medium text-[#CBD5E1] hover:text-white disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Previous
            </button>

            <button
              type="button"
              onClick={onTogglePlay}
              disabled={clauses.length <= 1}
              className="px-3.5 py-1.5 rounded-lg bg-[#00F5D4] hover:bg-[#00DFC0] text-[#06080E] text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-40 cursor-pointer whitespace-nowrap"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isPlaying ? "Pause" : "Play"}
            </button>

            <button
              type="button"
              onClick={() => onStepChange(Math.min(clauses.length - 1, safeIdx + 1))}
              disabled={safeIdx >= clauses.length - 1}
              className="px-3 py-1.5 rounded-lg bg-[#141926] border border-white/10 text-xs font-medium text-[#CBD5E1] hover:text-white disabled:opacity-40 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onStepChange(0)}
              title="Reset to first step"
              className="p-1.5 rounded-lg bg-white/[0.05] text-[#94A3B8] hover:text-[#00F5D4] cursor-pointer"
              aria-label="Reset to first step"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
            <label className="inline-flex items-center gap-1.5 text-[#94A3B8]">
              <span>Speed</span>
              <select
                value={playbackSpeed}
                onChange={(e) => onPlaybackSpeedChange(Number(e.target.value))}
                className="rounded-md bg-[#141926] border border-white/10 px-1.5 py-1 text-[11px] text-[#F4F7FB] focus:outline-none"
              >
                <option value={2600}>0.8x</option>
                <option value={1900}>1.0x</option>
                <option value={1200}>1.5x</option>
              </select>
            </label>
            <span className="text-[#00F5D4] font-semibold">
              Step {safeIdx + 1} / {clauses.length}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 rounded-full bg-white/[0.07] overflow-hidden">
          <div
            className="h-full bg-[#00F5D4] transition-all duration-200"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Active Clause Summary */}
        {activeClause && (
          <p className="text-xs text-[#E2E8F0] leading-relaxed">
            <span className="font-mono text-[#8B5CF6] mr-2">Active Clause:</span>
            {activeClause.englishSpan}
          </p>
        )}
      </div>

      {/* Main Coding Surface */}
      {viewMode === "full" ? (
        <div className="rounded-xl bg-[#070A11] border border-white/[0.08] overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/[0.07] flex items-center justify-between text-[11px] font-mono text-[#94A3B8]">
            <span>
              {analysis.algorithmName} ·{" "}
              {PROGRAMMING_LANGUAGES.find((l) => l.id === language)?.label}
            </span>
            <span>Hover or click any line to sync</span>
          </div>
          <div className="overflow-x-auto max-h-[380px] overflow-y-auto p-2 font-mono text-xs">
            {fullLines.map((line, idx) => {
              const lineId = `L${idx + 1}`;
              const isMapped = activeLineSet.has(lineId);
              return (
                <button
                  key={lineId}
                  type="button"
                  onMouseEnter={() => onHoverCodeLine(idx + 1)}
                  onMouseLeave={() => onHoverCodeLine(null)}
                  onClick={() => onSelectCodeLine(idx + 1)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md flex items-start gap-3 transition-colors cursor-pointer ${
                    isMapped
                      ? "bg-[#00F5D4]/15 ring-1 ring-[#00F5D4]/50"
                      : "hover:bg-white/[0.04]"
                  }`}
                >
                  <span
                    className={`w-7 shrink-0 select-none tabular-nums ${
                      isMapped ? "text-[#00F5D4] font-bold" : "text-[#475569]"
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <pre className="whitespace-pre font-mono leading-relaxed">
                    {renderHighlightedLine(line)}
                  </pre>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        /* Practice Blanks Mode */
        <div className="rounded-xl bg-[#070A11] border border-white/[0.08] p-4 space-y-4">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-[#8B5CF6] font-semibold">
              Practice Blank · {PROGRAMMING_LANGUAGES.find((l) => l.id === language)?.label}
            </span>
            <span className="text-[#94A3B8] tabular-nums">
              {Object.values(langPracticeMap).filter((a) => a.status === "correct").length} /{" "}
              {clausesWithBlanks.length} Solved
            </span>
          </div>

          {activeBlank && activeClause ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-[#0B101C] border border-white/[0.08] p-4 font-mono text-sm text-[#F4F7FB] whitespace-pre-wrap leading-relaxed">
                {activeBlank.prompt.split("____").map((part, idx, arr) => (
                  <Fragment key={idx}>
                    <span>{part}</span>
                    {idx < arr.length - 1 && (
                      <span
                        className={`inline-block min-w-[64px] text-center px-2.5 py-0.5 mx-1 rounded-md border font-bold ${
                          attempt?.status === "correct"
                            ? "bg-[#00F5D4]/20 border-[#00F5D4] text-[#00F5D4]"
                            : attempt?.status === "incorrect"
                            ? "bg-[#F59E0B]/20 border-[#F59E0B] text-[#FDE68A]"
                            : "bg-[#8B5CF6]/20 border-[#8B5CF6]/60 text-[#DDD6FE]"
                        }`}
                      >
                        {attempt?.status === "correct" ? attempt.selectedToken : "____"}
                      </span>
                    )}
                  </Fragment>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-xs text-[#94A3B8]">Select the missing syntax token:</p>
                <div className="flex flex-wrap gap-2">
                  {activeBlank.tokens.map((tok) => {
                    const isPicked = attempt?.selectedToken === tok;
                    const isCorrectPick = isPicked && attempt?.status === "correct";
                    const isWrongPick = isPicked && attempt?.status === "incorrect";
                    return (
                      <button
                        key={tok}
                        type="button"
                        onClick={() =>
                          onPracticeAttempt(
                            language,
                            activeClause.clauseId,
                            tok,
                            activeBlank.correctToken
                          )
                        }
                        className={`px-3.5 py-2 rounded-lg border font-mono text-xs font-semibold transition-all cursor-pointer ${
                          isCorrectPick
                            ? "bg-[#00F5D4]/20 border-[#00F5D4] text-[#00F5D4]"
                            : isWrongPick
                            ? "bg-[#F59E0B]/15 border-[#F59E0B] text-[#FDE68A]"
                            : "bg-[#111624] border-white/10 text-[#E2E8F0] hover:border-[#00F5D4]/60"
                        }`}
                      >
                        {tok}
                      </button>
                    );
                  })}
                </div>
              </div>

              {attempt?.status === "correct" && (
                <div className="rounded-xl bg-[#0D281E]/55 border border-[#10B981]/50 p-3 flex items-start gap-2.5 text-xs text-[#A7F3D0]">
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Correct!</p>
                    <p className="text-[#CBD5E1] mt-0.5">{activeBlank.explanation}</p>
                  </div>
                </div>
              )}

              {attempt?.status === "incorrect" && (
                <div className="rounded-xl bg-[#271C0B]/60 border border-[#F59E0B]/45 p-3 flex items-start gap-2.5 text-xs text-[#FDE68A]">
                  <XCircle className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Not quite — try another token.</p>
                    <p className="text-[#CBD5E1] mt-0.5">Hint: {activeBlank.hint}</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-[#94A3B8] py-6 text-center">
              Practice blanks for this step are available once online Gemini synthesis completes or
              in the preloaded Binary Search / Two Sum II labs.
            </p>
          )}
        </div>
      )}

      {/* Language-Specific Syntax Tip Panel */}
      {activeClause && (
        <div className="rounded-xl bg-[#090C14] border border-white/[0.08] p-3.5 flex items-start gap-2.5">
          <HelpCircle className="w-4 h-4 text-[#00F5D4] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-[11px] font-mono text-[#00F5D4]">
              Syntax Tip · {PROGRAMMING_LANGUAGES.find((l) => l.id === language)?.label}
            </p>
            <p className="text-xs text-[#CBD5E1] leading-relaxed">
              {activeClause.syntaxTip[language]}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
