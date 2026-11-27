import { useEffect, useState } from "react";
import { ArrowLeft, GitBranch, RotateCcw } from "lucide-react";
import { PRESET_PROBLEMS } from "../../../data/localDsaPresets";
import {
  cancelPendingLogicScan,
  reviewStudentCode,
  scanAndMorphLogic,
} from "../../../services/logicMorphService";
import {
  CodeViewMode,
  ExtractedClause,
  LogicMorphAnalysis,
  PerLanguageCodeReview,
  PerLanguagePracticeState,
  PerLanguageStudentCode,
  PROGRAMMING_LANGUAGES,
  ProgrammingLanguage,
} from "../../../types/logicMorph";
import { AlgorithmVisualizer2D } from "./AlgorithmVisualizer2D";
import { CodeMorphWindow } from "./CodeMorphWindow";
import { LogicInputPanel } from "./LogicInputPanel";
import { MathLogicXRay } from "./MathLogicXRay";

const STORAGE_KEY = "makaut_nexus_logic_morph_session_v1";

const EMPTY_PRACTICE: PerLanguagePracticeState = {
  c: {},
  python: {},
  cpp: {},
  java: {},
};

const EMPTY_STUDENT_CODE: PerLanguageStudentCode = {
  c: "",
  python: "",
  cpp: "",
  java: "",
};

const EMPTY_CODE_REVIEW: PerLanguageCodeReview = {
  c: null,
  python: null,
  cpp: null,
  java: null,
};

interface PersistedSimulatorState {
  mode: "binary-search" | "two-sum-ii" | "custom";
  language: ProgrammingLanguage;
  codeViewMode: CodeViewMode;
  problemStatement: string;
  logicText: string;
  pseudocode: string;
  exampleInput: string;
  expectedOutput: string;
  activeStepIdx: number;
  practiceState: PerLanguagePracticeState;
  studentCodeByLang: PerLanguageStudentCode;
  analysis: LogicMorphAnalysis;
}

function getDefaultSession(): PersistedSimulatorState {
  const bs = PRESET_PROBLEMS[0];
  return {
    mode: "binary-search",
    language: "python",
    codeViewMode: "full",
    problemStatement: bs.problemStatement,
    logicText: bs.defaultEnglishLogic,
    pseudocode: "",
    exampleInput: bs.exampleInput,
    expectedOutput: bs.expectedOutput,
    activeStepIdx: 0,
    practiceState: structuredClone(EMPTY_PRACTICE),
    studentCodeByLang: { ...EMPTY_STUDENT_CODE },
    analysis: structuredClone(bs.analysis),
  };
}

function loadSession(): PersistedSimulatorState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultSession();
    const parsed = JSON.parse(raw) as Partial<PersistedSimulatorState>;
    if (!parsed?.analysis?.extractedClauses?.length) return getDefaultSession();
    const def = getDefaultSession();
    return {
      mode:
        parsed.mode === "binary-search" ||
        parsed.mode === "two-sum-ii" ||
        parsed.mode === "custom"
          ? parsed.mode
          : def.mode,
      language:
        parsed.language === "c" ||
        parsed.language === "python" ||
        parsed.language === "cpp" ||
        parsed.language === "java"
          ? parsed.language
          : def.language,
      codeViewMode:
        parsed.codeViewMode === "full" ||
        parsed.codeViewMode === "practice" ||
        parsed.codeViewMode === "write"
          ? parsed.codeViewMode
          : "full",
      problemStatement: parsed.problemStatement ?? def.problemStatement,
      logicText: parsed.logicText ?? def.logicText,
      pseudocode: parsed.pseudocode ?? "",
      exampleInput: parsed.exampleInput ?? def.exampleInput,
      expectedOutput: parsed.expectedOutput ?? def.expectedOutput,
      activeStepIdx: Number.isInteger(parsed.activeStepIdx)
        ? Math.max(0, parsed.activeStepIdx!)
        : 0,
      practiceState: {
        c: parsed.practiceState?.c ?? {},
        python: parsed.practiceState?.python ?? {},
        cpp: parsed.practiceState?.cpp ?? {},
        java: parsed.practiceState?.java ?? {},
      },
      studentCodeByLang: {
        c: parsed.studentCodeByLang?.c ?? "",
        python: parsed.studentCodeByLang?.python ?? "",
        cpp: parsed.studentCodeByLang?.cpp ?? "",
        java: parsed.studentCodeByLang?.java ?? "",
      },
      analysis: parsed.analysis,
    };
  } catch {
    return getDefaultSession();
  }
}

interface LogicToCodeSimulatorProps {
  onExit: () => void;
}

export function LogicToCodeSimulator({ onExit }: LogicToCodeSimulatorProps) {
  const initial = loadSession();
  const [mode, setMode] = useState<"binary-search" | "two-sum-ii" | "custom">(
    initial.mode
  );
  const [language, setLanguage] = useState<ProgrammingLanguage>(initial.language);
  const [codeViewMode, setCodeViewMode] = useState<CodeViewMode>(
    initial.codeViewMode
  );
  const [problemStatement, setProblemStatement] = useState(
    initial.problemStatement
  );
  const [logicText, setLogicText] = useState(initial.logicText);
  const [pseudocode, setPseudocode] = useState(initial.pseudocode);
  const [exampleInput, setExampleInput] = useState(initial.exampleInput);
  const [expectedOutput, setExpectedOutput] = useState(initial.expectedOutput);
  const [analysis, setAnalysis] = useState<LogicMorphAnalysis>(initial.analysis);
  const [activeStepIdx, setActiveStepIdx] = useState(initial.activeStepIdx);
  const [practiceState, setPracticeState] = useState<PerLanguagePracticeState>(
    initial.practiceState
  );
  const [studentCodeByLang, setStudentCodeByLang] = useState<PerLanguageStudentCode>(
    initial.studentCodeByLang
  );
  const [codeReviewByLang, setCodeReviewByLang] = useState<PerLanguageCodeReview>({
    ...EMPTY_CODE_REVIEW,
  });
  const [reviewingLang, setReviewingLang] = useState<ProgrammingLanguage | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1900);
  const [scanning, setScanning] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [hoveredLineNum, setHoveredLineNum] = useState<number | null>(null);

  // Persist simulator session cleanly without storing mic streams or temp files
  useEffect(() => {
    try {
      const payload: PersistedSimulatorState = {
        mode,
        language,
        codeViewMode,
        problemStatement,
        logicText,
        pseudocode,
        exampleInput,
        expectedOutput,
        activeStepIdx,
        practiceState,
        studentCodeByLang,
        analysis,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore storage quota errors
    }
  }, [
    mode,
    language,
    codeViewMode,
    problemStatement,
    logicText,
    pseudocode,
    exampleInput,
    expectedOutput,
    activeStepIdx,
    practiceState,
    studentCodeByLang,
    analysis,
  ]);

  // Step playback timer — preserves language switches without resetting step
  useEffect(() => {
    if (!isPlaying) return;
    const total = analysis.extractedClauses.length;
    if (total <= 1) {
      setIsPlaying(false);
      return;
    }
    const timer = window.setInterval(() => {
      setActiveStepIdx((prev) => {
        if (prev >= total - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, playbackSpeed);
    return () => clearInterval(timer);
  }, [isPlaying, playbackSpeed, analysis.extractedClauses.length]);

  const handleSelectMode = (nextMode: "binary-search" | "two-sum-ii" | "custom") => {
    cancelPendingLogicScan();
    setIsPlaying(false);
    setScanNotice(null);
    setMode(nextMode);

    if (nextMode === "custom") {
      return;
    }

    const preset = PRESET_PROBLEMS.find((p) => p.id === nextMode) ?? PRESET_PROBLEMS[0];
    setProblemStatement(preset.problemStatement);
    setLogicText(preset.defaultEnglishLogic);
    setPseudocode("");
    setExampleInput(preset.exampleInput);
    setExpectedOutput(preset.expectedOutput);
    setAnalysis(structuredClone(preset.analysis));
    setActiveStepIdx(0);
    setPracticeState(structuredClone(EMPTY_PRACTICE));
    setStudentCodeByLang({ ...EMPTY_STUDENT_CODE });
    setCodeReviewByLang({ ...EMPTY_CODE_REVIEW });
  };

  const runScan = async (opts: {
    selectedText?: string;
    analyzedScope: "full" | "selection";
    forceGemini?: boolean;
    overrideLogicText?: string;
  }) => {
    const effectiveLogic = opts.overrideLogicText ?? logicText;
    if (!effectiveLogic.trim()) return;

    setIsPlaying(false);
    setScanning(true);
    setScanNotice(null);

    try {
      const res = await scanAndMorphLogic({
        problemStatement,
        logicText: effectiveLogic,
        selectedText: opts.selectedText,
        pseudocode,
        exampleInput,
        expectedOutput,
        analyzedScope: opts.analyzedScope,
        forceGemini: opts.forceGemini,
      });

      if (res.stale) return;

      setAnalysis(res.analysis);
      setActiveStepIdx(0);
      setPracticeState(structuredClone(EMPTY_PRACTICE));
      setCodeReviewByLang({ ...EMPTY_CODE_REVIEW });
      if (res.notice) {
        setScanNotice(res.notice);
      }
    } finally {
      setScanning(false);
    }
  };

  const handleApplyFix = async (clause: ExtractedClause) => {
    if (!clause.suggestedFix) return;
    // Update only the affected sentence/clause inside logicText
    let updatedLogic = logicText;
    if (logicText.includes(clause.englishSpan)) {
      updatedLogic = logicText.replace(clause.englishSpan, clause.suggestedFix);
    } else {
      updatedLogic = `${logicText.trimEnd()}\n${clause.suggestedFix}`;
    }
    setLogicText(updatedLogic);

    // Clear the warning on that clause immediately and refresh scan
    setAnalysis((prev) => ({
      ...prev,
      extractedClauses: prev.extractedClauses.map((c) =>
        c.clauseId === clause.clauseId
          ? {
              ...c,
              englishSpan: clause.suggestedFix!,
              status: "valid",
              warningMessage: undefined,
              whyItCanFail: undefined,
              suggestedFix: undefined,
            }
          : c
      ),
    }));
  };

  const handlePracticeAttempt = (
    lang: ProgrammingLanguage,
    clauseId: string,
    token: string,
    correctToken: string
  ) => {
    setPracticeState((prev) => {
      const prevEntry = prev[lang][clauseId];
      const isCorrect = token === correctToken;
      return {
        ...prev,
        [lang]: {
          ...prev[lang],
          [clauseId]: {
            selectedToken: token,
            status: isCorrect ? "correct" : "incorrect",
            attempts: (prevEntry?.attempts ?? 0) + 1,
          },
        },
      };
    });
  };

  const handleSelectOrHoverLine = (lineNum: number | null, commitSelection: boolean) => {
    setHoveredLineNum(lineNum);
    if (lineNum === null) return;
    const targetId = `L${lineNum}`;
    const matchIdx = analysis.extractedClauses.findIndex((c) =>
      c.codeLineIds.includes(targetId)
    );
    if (matchIdx !== -1 && (commitSelection || !isPlaying)) {
      setActiveStepIdx(matchIdx);
    }
  };

  const handleStudentCodeChange = (nextCode: string) => {
    setStudentCodeByLang((prev) => ({
      ...prev,
      [language]: nextCode,
    }));
  };

  const handleCheckStudentCode = async () => {
    const targetLang = language;
    const code = studentCodeByLang[targetLang] ?? "";
    setReviewingLang(targetLang);
    try {
      const result = await reviewStudentCode({
        language: targetLang,
        analysis,
        studentCode: code,
      });
      setCodeReviewByLang((prev) => ({
        ...prev,
        [targetLang]: result,
      }));
    } finally {
      setReviewingLang(null);
    }
  };

  const handleResetSession = () => {
    cancelPendingLogicScan();
    setIsPlaying(false);
    setScanNotice(null);
    const def = getDefaultSession();
    setMode(def.mode);
    setLanguage(def.language);
    setCodeViewMode(def.codeViewMode);
    setProblemStatement(def.problemStatement);
    setLogicText(def.logicText);
    setPseudocode(def.pseudocode);
    setExampleInput(def.exampleInput);
    setExpectedOutput(def.expectedOutput);
    setAnalysis(def.analysis);
    setActiveStepIdx(0);
    setPracticeState(def.practiceState);
    setStudentCodeByLang({ ...EMPTY_STUDENT_CODE });
    setCodeReviewByLang({ ...EMPTY_CODE_REVIEW });
  };

  const clauses = analysis.extractedClauses;
  const safeStepIdx = Math.min(Math.max(0, activeStepIdx), Math.max(0, clauses.length - 1));
  const activeClause = clauses[safeStepIdx];
  const progressPct =
    clauses.length > 0 ? Math.round(((safeStepIdx + 1) / clauses.length) * 100) : 0;
  const activeLangLabel =
    PROGRAMMING_LANGUAGES.find((l) => l.id === language)?.label ?? "Python";
  const isWriteMode = codeViewMode === "write";

  // Keep lint happy if hoveredLineNum is used as subtle tooltip/state
  void hoveredLineNum;

  return (
    <div className="space-y-5">
      {/* Compact Top Simulator Header */}
      <header className="nexus-panel rounded-2xl p-4 lg:px-6 lg:py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-[#00F5D4]/15 border border-[#00F5D4]/40 text-[#00F5D4] flex items-center justify-center shrink-0">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-[#F4F7FB]">
              LOGIC → CODE MORPH SIMULATOR
            </h2>
            <p className="text-xs text-[#94A3B8]">
              Think in logic. Watch it become code.
            </p>
          </div>
        </div>

        {/* Status Metadata (clean unboxed text with · separators) + Session Actions */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums text-[#94A3B8]">
            <span className="text-[#F4F7FB] font-semibold">{analysis.problemTitle}</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#00F5D4]">{activeLangLabel}</span>
            <span aria-hidden="true">·</span>
            <span>
              Step {safeStepIdx + 1}/{clauses.length} ({progressPct}%)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetSession}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-mono text-[#CBD5E1] hover:text-white cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Session
            </button>
            <button
              type="button"
              onClick={onExit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8B5CF6]/20 hover:bg-[#8B5CF6]/35 border border-[#8B5CF6]/45 text-xs font-mono text-[#DDD6FE] hover:text-white cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Exit Simulator
            </button>
          </div>
        </div>
      </header>

      {/* Three-Panel Desktop Workspace (Stacks cleanly on tablet/mobile; widens center for side-by-side Write Code) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* LEFT: Logic Input & Scanner */}
        <div className={isWriteMode ? "lg:col-span-3" : "lg:col-span-4"}>
          <LogicInputPanel
            mode={mode}
            onSelectMode={handleSelectMode}
            problemStatement={problemStatement}
            onProblemStatementChange={setProblemStatement}
            logicText={logicText}
            onLogicTextChange={setLogicText}
            pseudocode={pseudocode}
            onPseudocodeChange={setPseudocode}
            exampleInput={exampleInput}
            onExampleInputChange={setExampleInput}
            expectedOutput={expectedOutput}
            onExpectedOutputChange={setExpectedOutput}
            analysis={analysis}
            activeStepIdx={safeStepIdx}
            onSelectClause={(idx) => {
              setIsPlaying(false);
              setActiveStepIdx(idx);
            }}
            onApplyFix={handleApplyFix}
            scanning={scanning}
            scanNotice={scanNotice}
            onScanEntire={(force) =>
              runScan({ analyzedScope: "full", forceGemini: force })
            }
            onScanSelected={(selected) =>
              runScan({ selectedText: selected, analyzedScope: "selection" })
            }
          />
        </div>

        {/* CENTER: Code Morph Window & Step Controls */}
        <div className={isWriteMode ? "lg:col-span-6" : "lg:col-span-4"}>
          <CodeMorphWindow
            analysis={analysis}
            language={language}
            onLanguageChange={setLanguage}
            viewMode={codeViewMode}
            onViewModeChange={setCodeViewMode}
            activeStepIdx={safeStepIdx}
            onStepChange={(idx) => {
              setIsPlaying(false);
              setActiveStepIdx(idx);
            }}
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying((p) => !p)}
            playbackSpeed={playbackSpeed}
            onPlaybackSpeedChange={setPlaybackSpeed}
            onHoverCodeLine={(line) => handleSelectOrHoverLine(line, false)}
            onSelectCodeLine={(line) => {
              setIsPlaying(false);
              handleSelectOrHoverLine(line, true);
            }}
            practiceState={practiceState}
            onPracticeAttempt={handlePracticeAttempt}
            studentCode={studentCodeByLang[language] ?? ""}
            onStudentCodeChange={handleStudentCodeChange}
            codeReview={codeReviewByLang[language] ?? null}
            reviewingCode={reviewingLang === language}
            onCheckStudentCode={handleCheckStudentCode}
          />
        </div>

        {/* RIGHT: Math & Logic X-Ray + Visual State */}
        <div className={`${isWriteMode ? "lg:col-span-3" : "lg:col-span-4"} space-y-5`}>
          <AlgorithmVisualizer2D
            visualState={activeClause?.visualState}
            algorithmName={analysis.algorithmName}
          />
          <MathLogicXRay clause={activeClause} analysis={analysis} />
        </div>
      </div>
    </div>
  );
}
