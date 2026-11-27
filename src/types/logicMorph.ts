export type ProgrammingLanguage = "c" | "python" | "cpp" | "java";

export const PROGRAMMING_LANGUAGES: { id: ProgrammingLanguage; label: string; ext: string }[] = [
  { id: "c", label: "C", ext: "c" },
  { id: "python", label: "Python", ext: "py" },
  { id: "cpp", label: "C++", ext: "cpp" },
  { id: "java", label: "Java", ext: "java" },
];

export type LogicRole =
  | "initialization"
  | "condition"
  | "iteration"
  | "comparison"
  | "update"
  | "termination"
  | "return"
  | "other";

export type ClauseStatus = "valid" | "warning";

export type VisualMode =
  | "array"
  | "two_pointers"
  | "sliding_window"
  | "string"
  | "linked_list"
  | "recursion"
  | "tree"
  | "graph"
  | "dp"
  | "stack"
  | "variables";

export interface VisualNodeItem {
  id: string;
  label: string;
  next?: string | null;
  active?: boolean;
  visited?: boolean;
  x?: number;
  y?: number;
}

export interface VisualEdgeItem {
  from: string;
  to: string;
  active?: boolean;
}

export interface VisualStackFrame {
  fn: string;
  params: string;
  state: "active" | "waiting" | "returning" | "base";
  returnVal?: string;
}

export interface VisualDpCell {
  label: string;
  value: string | number;
  active?: boolean;
  isSource?: boolean;
}

export interface VisualState {
  mode: VisualMode;
  array?: (string | number)[];
  target?: string | number;
  pointers?: Record<string, number | string>;
  eliminatedIndices?: number[];
  highlightIndices?: number[];
  windowRange?: [number, number];
  nodes?: VisualNodeItem[];
  edges?: VisualEdgeItem[];
  stackFrames?: VisualStackFrame[];
  dpCells?: VisualDpCell[];
  variables?: Record<string, string | number>;
  frontier?: string[];
  callOrStateNote: string;
}

export interface PracticeBlank {
  prompt: string;
  tokens: string[];
  correctToken: string;
  hint: string;
  explanation: string;
}

export interface MathXRay {
  formulaTitle: string;
  whyItWorks: string;
  substitutionSteps: string[];
  boundaryIntuition: string;
  intuition: string;
}

export interface ExtractedClause {
  clauseId: string;
  englishSpan: string;
  logicRole: LogicRole;
  status: ClauseStatus;
  isFiller?: boolean;
  warningMessage?: string;
  whyItCanFail?: string;
  suggestedFix?: string;
  fixCertainty?: "confirmed" | "suggestion";
  codeLineIds: string[];
  codeLines: Record<ProgrammingLanguage, string[]>;
  syntaxTip: Record<ProgrammingLanguage, string>;
  practiceBlank?: Record<ProgrammingLanguage, PracticeBlank>;
  mathXRay: MathXRay;
  visualState: VisualState;
}

export interface LogicMorphAnalysis {
  problemTitle: string;
  problemCategory: string;
  algorithmName: string;
  detectedLanguage: string;
  problemSummary: string;
  exampleInput: string;
  expectedOutput: string;
  extractedClauses: ExtractedClause[];
  fullCode: Record<ProgrammingLanguage, string[]>;
  edgeCases: string[];
  complexity: {
    time: string;
    space: string;
    explanation: string;
  };
  source: "preset" | "gemini" | "local-template" | "unverified-offline";
  analyzedScope: "full" | "selection";
  analyzedText: string;
}

export interface PracticeAttemptState {
  selectedToken?: string;
  status?: "correct" | "incorrect";
  attempts: number;
}

export type PerLanguagePracticeState = Record<
  ProgrammingLanguage,
  Record<string, PracticeAttemptState>
>;

export type CodeViewMode = "full" | "practice" | "write";

export type PerLanguageStudentCode = Record<ProgrammingLanguage, string>;

export interface CodeReviewClauseCheck {
  clauseTitle: string;
  status: "matched" | "missing" | "issue";
  reason: string;
}

export interface CodeReviewResult {
  verdict: "aligned" | "partial" | "needs-work";
  matchScore: number;
  summary: string;
  clauseChecks: CodeReviewClauseCheck[];
  nextHint: string;
  source: "gemini" | "local";
}

export type PerLanguageCodeReview = Record<
  ProgrammingLanguage,
  CodeReviewResult | null
>;

export interface PresetProblemDefinition {
  id: "binary-search" | "two-sum-ii";
  title: string;
  category: string;
  problemStatement: string;
  exampleInput: string;
  expectedOutput: string;
  defaultEnglishLogic: string;
  analysis: LogicMorphAnalysis;
}
