import { Fragment, KeyboardEvent, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  Eraser,
  Eye,
  EyeOff,
  HelpCircle,
  Loader2,
  Pause,
  PenLine,
  Play,
  RotateCcw,
  Sparkles,
  Wand2,
  XCircle,
} from "lucide-react";
import { buildStarterSkeleton } from "../../../services/logicMorphService";
import {
  CodeReviewResult,
  CodeViewMode,
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
  viewMode: CodeViewMode;
  onViewModeChange: (mode: CodeViewMode) => void;
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
  studentCode: string;
  onStudentCodeChange: (code: string) => void;
  codeReview: CodeReviewResult | null;
  reviewingCode: boolean;
  onCheckStudentCode: () => void;
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
  viewMode,
  onViewModeChange,
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
  studentCode,
  onStudentCodeChange,
  codeReview,
  reviewingCode,
  onCheckStudentCode,
}: CodeMorphWindowProps) {
  const [hideReference, setHideReference] = useState(false);

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
  const activeLangLabel =
    PROGRAMMING_LANGUAGES.find((l) => l.id === language)?.label ?? "Python";

  // Gather all blanks across clauses for the active language so user sees full practice coverage
  const clausesWithBlanks = clauses.filter((c) => Boolean(c.practiceBlank?.[language]));

  const studentLineCount = studentCode ? studentCode.split(/\r?\n/).length : 0;

  const handleEditorKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const target = e.currentTarget;
    const indent = language === "python" ? "    " : "  ";
    const start = target.selectionStart;
    const end = target.selectionEnd;
    const nextValue =
      studentCode.slice(0, start) + indent + studentCode.slice(end);
    onStudentCodeChange(nextValue);
    window.requestAnimationFrame(() => {
      target.selectionStart = start + indent.length;
      target.selectionEnd = start + indent.length;
    });
  };

  const handleInsertSkeleton = () => {
    const skeleton = buildStarterSkeleton(language, fullLines);
    onStudentCodeChange(skeleton);
  };

  return (
    <section
      aria-label="Code Morph Window and Step Controls"
      className="nexus-panel rounded-2xl p-4 lg:p-5 space-y-4 flex flex-col"
    >
      {/* Top Bar: Four-Language Switcher + Mode Switch */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
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
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer whitespace-nowrap ${
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

        <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#090C14] border border-white/[0.08]">
          <button
            type="button"
            onClick={() => onViewModeChange("full")}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
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
            onClick={() => onViewModeChange("practice")}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              viewMode === "practice"
                ? "bg-[#8B5CF6] text-white"
                : "text-[#94A3B8] hover:text-[#F4F7FB]"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            PRACTICE BLANKS
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("write")}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              viewMode === "write"
                ? "bg-[#00F5D4] text-[#06080E]"
                : "text-[#94A3B8] hover:text-[#F4F7FB]"
            }`}
          >
            <PenLine className="w-3.5 h-3.5" />
            WRITE CODE
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
              {analysis.algorithmName} · {activeLangLabel}
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
      ) : viewMode === "write" ? (
        /* Side-by-Side Write Code Mode: LEFT = Correct Code | RIGHT = Student's Own Code */
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-stretch">
            {/* LEFT PANE: Correct Reference Code */}
            <div className="rounded-xl bg-[#070A11] border border-[#00F5D4]/25 overflow-hidden flex flex-col">
              <div className="px-3.5 py-2.5 border-b border-white/[0.08] bg-[#0B101B] flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono font-bold text-[#00F5D4] tracking-wide">
                  CORRECT CODE · {activeLangLabel.toUpperCase()}
                </span>
                <button
                  type="button"
                  onClick={() => setHideReference((v) => !v)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-[10px] font-mono text-[#CBD5E1] cursor-pointer whitespace-nowrap"
                >
                  {hideReference ? (
                    <>
                      <Eye className="w-3 h-3" />
                      Show
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-3 h-3" />
                      Hide
                    </>
                  )}
                </button>
              </div>

              <div
                className={`overflow-x-auto max-h-[340px] min-h-[260px] overflow-y-auto p-2 font-mono text-xs flex-1 transition-all ${
                  hideReference ? "blur-sm select-none opacity-45" : ""
                }`}
              >
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
                      className={`w-full text-left px-2 py-1 rounded-md flex items-start gap-2.5 transition-colors cursor-pointer ${
                        isMapped
                          ? "bg-[#00F5D4]/15 ring-1 ring-[#00F5D4]/50"
                          : "hover:bg-white/[0.04]"
                      }`}
                    >
                      <span
                        className={`w-6 shrink-0 select-none tabular-nums ${
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

              {activeClause && (
                <div className="px-3 py-2 border-t border-white/[0.07] bg-[#090D16] text-[11px] text-[#CBD5E1] leading-snug">
                  <span className="font-mono text-[#00F5D4] mr-1.5">Why:</span>
                  {activeClause.mathXRay.whyItWorks}
                </div>
              )}
            </div>

            {/* RIGHT PANE: Student's Own Code Editor */}
            <div className="rounded-xl bg-[#070A11] border border-[#8B5CF6]/35 overflow-hidden flex flex-col">
              <div className="px-3.5 py-2.5 border-b border-white/[0.08] bg-[#0B101B] flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-mono font-bold text-[#DDD6FE] tracking-wide">
                  YOUR CODE · {activeLangLabel.toUpperCase()}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleInsertSkeleton}
                    title="Insert starter function signature without spoiling logic"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-[10px] font-mono text-[#CBD5E1] cursor-pointer whitespace-nowrap"
                  >
                    <Wand2 className="w-3 h-3 text-[#00F5D4]" />
                    Skeleton
                  </button>
                  <button
                    type="button"
                    onClick={() => onStudentCodeChange("")}
                    disabled={!studentCode}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-40 text-[10px] font-mono text-[#CBD5E1] cursor-pointer whitespace-nowrap"
                  >
                    <Eraser className="w-3 h-3" />
                    Clear
                  </button>
                </div>
              </div>

              <textarea
                value={studentCode}
                onChange={(e) => onStudentCodeChange(e.target.value)}
                onKeyDown={handleEditorKeyDown}
                spellCheck={false}
                aria-label={`Write your ${activeLangLabel} implementation`}
                placeholder={`Write your ${activeLangLabel} code here by translating each logic step from the left.\n\nTip: Use Tab to indent, or click Skeleton for the function signature.`}
                className="flex-1 w-full min-h-[260px] max-h-[340px] bg-[#070A11] text-[#F4F7FB] placeholder:text-[#64748B] font-mono text-xs leading-relaxed p-3.5 resize-y focus:outline-none"
              />

              <div className="px-3 py-2 border-t border-white/[0.07] bg-[#090D16] flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-[#94A3B8] tabular-nums">
                  {studentLineCount} {studentLineCount === 1 ? "line" : "lines"} · saved per language
                </span>
                <button
                  type="button"
                  onClick={onCheckStudentCode}
                  disabled={reviewingCode || studentCode.trim().length < 10}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00F5D4] hover:bg-[#00DFC0] disabled:opacity-45 text-[#06080E] text-xs font-bold cursor-pointer whitespace-nowrap"
                >
                  {reviewingCode ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Check Logic &amp; Reasons
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Logic-to-Code Review Reasons Output */}
          {codeReview && (
            <div className="rounded-xl bg-[#090C14] border border-white/[0.1] p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {codeReview.verdict === "aligned" ? (
                    <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                  ) : codeReview.verdict === "partial" ? (
                    <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                  ) : (
                    <XCircle className="w-4 h-4 text-[#F43F5E]" />
                  )}
                  <span className="text-xs font-mono font-bold text-[#F4F7FB] uppercase">
                    {codeReview.verdict === "aligned"
                      ? "Logic Aligned"
                      : codeReview.verdict === "partial"
                      ? "Partial Match"
                      : "Needs Refinement"}
                  </span>
                  <span className="text-xs font-mono font-bold text-[#00F5D4] tabular-nums">
                    {codeReview.matchScore}%
                  </span>
                </div>
                <span className="text-[11px] font-mono text-[#94A3B8]">
                  {codeReview.source === "gemini" ? "Gemini Code Mentor" : "Local Clause Diff"}
                </span>
              </div>

              <p className="text-xs text-[#E2E8F0] leading-relaxed">{codeReview.summary}</p>

              {codeReview.clauseChecks.length > 0 && (
                <div className="space-y-2 pt-1">
                  {codeReview.clauseChecks.map((check, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg border p-2.5 text-xs flex items-start gap-2.5 ${
                        check.status === "matched"
                          ? "bg-[#0D281E]/40 border-[#10B981]/35"
                          : check.status === "issue"
                          ? "bg-[#271C0B]/45 border-[#F59E0B]/40"
                          : "bg-[#161924] border-white/[0.08]"
                      }`}
                    >
                      {check.status === "matched" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
                      ) : check.status === "issue" ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-[#F59E0B] shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-[#94A3B8] shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-0.5 min-w-0">
                        <p className="font-medium text-[#F4F7FB]">{check.clauseTitle}</p>
                        <p className="text-[#CBD5E1] leading-relaxed">{check.reason}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {codeReview.nextHint && (
                <p className="text-xs text-[#A5F3FC] bg-[#00F5D4]/10 border border-[#00F5D4]/25 rounded-lg px-3 py-2 leading-relaxed">
                  <span className="font-mono font-bold text-[#00F5D4] mr-1.5">Next Step:</span>
                  {codeReview.nextHint}
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Practice Blanks Mode */
        <div className="rounded-xl bg-[#070A11] border border-white/[0.08] p-4 space-y-4">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-[#8B5CF6] font-semibold">
              Practice Blank · {activeLangLabel}
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
              Syntax Tip · {activeLangLabel}
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
