import {
  detectGentleBugsInLogic,
  matchLocalDsaFallback,
} from "../data/localDsaPresets";
import { isClientRateLimited, markClientRateLimited } from "./aiService";
import {
  ExtractedClause,
  LogicMorphAnalysis,
  LogicRole,
  PracticeBlank,
  ProgrammingLanguage,
  VisualMode,
  VisualState,
} from "../types/logicMorph";

export interface LogicScanRequest {
  problemStatement: string;
  logicText: string;
  selectedText?: string;
  pseudocode?: string;
  exampleInput?: string;
  expectedOutput?: string;
  analyzedScope: "full" | "selection";
  forceGemini?: boolean;
}

export interface ImageOcrResult {
  problemStatement: string;
  plainEnglishLogic: string;
  exampleInput: string;
  expectedOutput: string;
  summary: string;
}

const VALID_ROLES = new Set<LogicRole>([
  "initialization",
  "condition",
  "iteration",
  "comparison",
  "update",
  "termination",
  "return",
  "other",
]);

const VALID_MODES = new Set<VisualMode>([
  "array",
  "two_pointers",
  "sliding_window",
  "string",
  "linked_list",
  "recursion",
  "tree",
  "graph",
  "dp",
  "stack",
  "variables",
]);

function normalizeLines(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item ?? ""));
  }
  if (typeof raw === "string") {
    return raw.split(/\r?\n/);
  }
  return ["// Code unavailable"];
}

function kvArrayToRecord(entries: unknown): Record<string, string | number> | undefined {
  if (!Array.isArray(entries) || entries.length === 0) return undefined;
  const out: Record<string, string | number> = {};
  for (const entry of entries) {
    if (entry && typeof entry === "object" && "key" in entry && "value" in entry) {
      const k = String((entry as { key: unknown }).key ?? "").trim();
      const rawV = (entry as { value: unknown }).value;
      if (!k) continue;
      const numV = Number(rawV);
      out[k] = rawV !== "" && !Number.isNaN(numV) && String(numV) === String(rawV).trim() ? numV : String(rawV ?? "");
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function normalizeBlank(raw: unknown, fallbackPrompt: string): PracticeBlank {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const prompt =
    typeof obj.prompt === "string" && obj.prompt.includes("____")
      ? obj.prompt
      : fallbackPrompt;
  const correctToken =
    typeof obj.correctToken === "string" && obj.correctToken.trim()
      ? obj.correctToken.trim()
      : "mid";
  const rawTokens = Array.isArray(obj.tokens)
    ? obj.tokens.map((t) => String(t ?? "").trim()).filter(Boolean)
    : [];
  const tokenSet = new Set([correctToken, ...rawTokens]);
  const tokens = Array.from(tokenSet).slice(0, 4);

  return {
    prompt,
    tokens: tokens.length >= 2 ? tokens : [correctToken, "0", "1", "n"],
    correctToken,
    hint:
      typeof obj.hint === "string" && obj.hint.trim()
        ? obj.hint.trim()
        : "Focus on the exact variable, operator, or boundary condition required here.",
    explanation:
      typeof obj.explanation === "string" && obj.explanation.trim()
        ? obj.explanation.trim()
        : `Using "${correctToken}" preserves the algorithm invariant.`,
  };
}

function normalizeVisualState(raw: unknown): VisualState {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const mode: VisualMode =
    typeof obj.mode === "string" && VALID_MODES.has(obj.mode as VisualMode)
      ? (obj.mode as VisualMode)
      : "variables";

  const arraySource = Array.isArray(obj.arrayElements)
    ? obj.arrayElements
    : Array.isArray(obj.array)
    ? obj.array
    : undefined;

  const array = arraySource?.map((el) => {
    const n = Number(el);
    return el !== "" && !Number.isNaN(n) && String(n) === String(el).trim() ? n : String(el ?? "");
  });

  const pointers =
    kvArrayToRecord(obj.pointerEntries) ??
    (obj.pointers && typeof obj.pointers === "object" && !Array.isArray(obj.pointers)
      ? (obj.pointers as Record<string, string | number>)
      : undefined);

  const variables =
    kvArrayToRecord(obj.variableEntries) ??
    (obj.variables && typeof obj.variables === "object" && !Array.isArray(obj.variables)
      ? (obj.variables as Record<string, string | number>)
      : undefined);

  const windowStart = typeof obj.windowStart === "number" ? obj.windowStart : undefined;
  const windowEnd = typeof obj.windowEnd === "number" ? obj.windowEnd : undefined;

  return {
    mode,
    array,
    target: obj.target !== undefined ? String(obj.target) : undefined,
    pointers,
    highlightIndices: Array.isArray(obj.highlightIndices)
      ? obj.highlightIndices.filter((n): n is number => Number.isInteger(n))
      : undefined,
    eliminatedIndices: Array.isArray(obj.eliminatedIndices)
      ? obj.eliminatedIndices.filter((n): n is number => Number.isInteger(n))
      : undefined,
    windowRange:
      windowStart !== undefined && windowEnd !== undefined
        ? [windowStart, windowEnd]
        : Array.isArray(obj.windowRange) && obj.windowRange.length === 2
        ? [Number(obj.windowRange[0]) || 0, Number(obj.windowRange[1]) || 0]
        : undefined,
    nodes: Array.isArray(obj.nodes) ? obj.nodes : undefined,
    edges: Array.isArray(obj.edges) ? obj.edges : undefined,
    stackFrames: Array.isArray(obj.stackFrames) ? obj.stackFrames : undefined,
    dpCells: Array.isArray(obj.dpCells) ? obj.dpCells : undefined,
    variables,
    frontier: Array.isArray(obj.frontier) ? obj.frontier.map(String) : undefined,
    callOrStateNote:
      typeof obj.callOrStateNote === "string" && obj.callOrStateNote.trim()
        ? obj.callOrStateNote.trim()
        : "Inspecting active execution state.",
  };
}

export function repairAndValidateAnalysis(
  raw: unknown,
  meta: {
    analyzedScope: "full" | "selection";
    analyzedText: string;
    exampleInput?: string;
    expectedOutput?: string;
  }
): LogicMorphAnalysis | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.extractedClauses) || obj.extractedClauses.length === 0) {
    return null;
  }

  const rawFull = (obj.fullCode && typeof obj.fullCode === "object"
    ? obj.fullCode
    : {}) as Record<string, unknown>;

  const fullCode: Record<ProgrammingLanguage, string[]> = {
    c: normalizeLines(rawFull.c),
    python: normalizeLines(rawFull.python),
    cpp: normalizeLines(rawFull.cpp),
    java: normalizeLines(rawFull.java),
  };

  const maxLineCount = Math.max(
    fullCode.c.length,
    fullCode.python.length,
    fullCode.cpp.length,
    fullCode.java.length,
    1
  );

  const localBugs = detectGentleBugsInLogic(meta.analyzedText);

  const extractedClauses: ExtractedClause[] = obj.extractedClauses.map((rawClause, idx) => {
    const c = (rawClause && typeof rawClause === "object"
      ? rawClause
      : {}) as Record<string, unknown>;

    const englishSpan =
      typeof c.englishSpan === "string" && c.englishSpan.trim()
        ? c.englishSpan.trim()
        : `Clause ${idx + 1}`;

    const logicRole: LogicRole =
      typeof c.logicRole === "string" && VALID_ROLES.has(c.logicRole as LogicRole)
        ? (c.logicRole as LogicRole)
        : "other";

    const rawLineIds = Array.isArray(c.codeLineIds)
      ? c.codeLineIds
          .map((id) => String(id ?? "").trim().toUpperCase())
          .filter((id) => /^L\d+$/.test(id))
          .filter((id) => {
            const num = Number(id.slice(1));
            return num >= 1 && num <= maxLineCount;
          })
      : [];

    const codeLineIds =
      rawLineIds.length > 0 ? rawLineIds : [`L${Math.min(idx + 2, maxLineCount)}`];

    const rawCodeLines = (c.codeLines && typeof c.codeLines === "object"
      ? c.codeLines
      : {}) as Record<string, unknown>;

    const codeLines: Record<ProgrammingLanguage, string[]> = {
      c: normalizeLines(rawCodeLines.c),
      python: normalizeLines(rawCodeLines.python),
      cpp: normalizeLines(rawCodeLines.cpp),
      java: normalizeLines(rawCodeLines.java),
    };

    const rawTips = (c.syntaxTip && typeof c.syntaxTip === "object"
      ? c.syntaxTip
      : {}) as Record<string, unknown>;
    const syntaxTip: Record<ProgrammingLanguage, string> = {
      c: typeof rawTips.c === "string" && rawTips.c ? rawTips.c : "Maintain explicit types and loop bounds in C.",
      python: typeof rawTips.python === "string" && rawTips.python ? rawTips.python : "Keep consistent 4-space indentation in Python.",
      cpp: typeof rawTips.cpp === "string" && rawTips.cpp ? rawTips.cpp : "Use const references where appropriate in C++.",
      java: typeof rawTips.java === "string" && rawTips.java ? rawTips.java : "Respect array bounds and strong typing in Java.",
    };

    const rawBlank = (c.practiceBlank && typeof c.practiceBlank === "object"
      ? c.practiceBlank
      : {}) as Record<string, unknown>;

    const practiceBlank: Record<ProgrammingLanguage, PracticeBlank> = {
      c: normalizeBlank(rawBlank.c, "/* Complete ____ step in C */"),
      python: normalizeBlank(rawBlank.python, "# Complete ____ step in Python"),
      cpp: normalizeBlank(rawBlank.cpp, "// Complete ____ step in C++"),
      java: normalizeBlank(rawBlank.java, "// Complete ____ step in Java"),
    };

    const rawXray = (c.mathXRay && typeof c.mathXRay === "object"
      ? c.mathXRay
      : {}) as Record<string, unknown>;

    const localBug = localBugs.find((b) =>
      englishSpan.toLowerCase().includes(b.snippet.toLowerCase().slice(0, 20))
    );

    const status: "valid" | "warning" =
      c.status === "warning" || localBug ? "warning" : "valid";

    return {
      clauseId:
        typeof c.clauseId === "string" && c.clauseId.trim()
          ? c.clauseId.trim()
          : `clause-${idx + 1}`,
      englishSpan,
      logicRole,
      status,
      warningMessage:
        typeof c.warningMessage === "string" && c.warningMessage.trim()
          ? c.warningMessage.trim()
          : localBug?.warningMessage,
      whyItCanFail:
        typeof c.whyItCanFail === "string" && c.whyItCanFail.trim()
          ? c.whyItCanFail.trim()
          : localBug?.whyItCanFail,
      suggestedFix:
        typeof c.suggestedFix === "string" && c.suggestedFix.trim()
          ? c.suggestedFix.trim()
          : localBug?.suggestedFix,
      fixCertainty:
        c.fixCertainty === "confirmed" || c.fixCertainty === "suggestion"
          ? c.fixCertainty
          : localBug?.certainty ?? "suggestion",
      codeLineIds,
      codeLines,
      syntaxTip,
      practiceBlank,
      mathXRay: {
        formulaTitle:
          typeof rawXray.formulaTitle === "string" && rawXray.formulaTitle.trim()
            ? rawXray.formulaTitle.trim()
            : englishSpan,
        whyItWorks:
          typeof rawXray.whyItWorks === "string" && rawXray.whyItWorks.trim()
            ? rawXray.whyItWorks.trim()
            : "Advances the algorithm invariant one step closer to termination.",
        substitutionSteps: Array.isArray(rawXray.substitutionSteps)
          ? rawXray.substitutionSteps.map(String).filter(Boolean)
          : ["Step traced on example input."],
        boundaryIntuition:
          typeof rawXray.boundaryIntuition === "string" && rawXray.boundaryIntuition.trim()
            ? rawXray.boundaryIntuition.trim()
            : "Verify empty and single-element edge boundaries.",
        intuition:
          typeof rawXray.intuition === "string" && rawXray.intuition.trim()
            ? rawXray.intuition.trim()
            : "Maintains time/space efficiency across iterations.",
      },
      visualState: normalizeVisualState(c.visualState),
    };
  });

  const rawComplexity = (obj.complexity && typeof obj.complexity === "object"
    ? obj.complexity
    : {}) as Record<string, unknown>;

  return {
    problemTitle:
      typeof obj.problemTitle === "string" && obj.problemTitle.trim()
        ? obj.problemTitle.trim()
        : "Custom DSA Algorithm",
    problemCategory:
      typeof obj.problemCategory === "string" && obj.problemCategory.trim()
        ? obj.problemCategory.trim()
        : "Algorithm Design",
    algorithmName:
      typeof obj.algorithmName === "string" && obj.algorithmName.trim()
        ? obj.algorithmName.trim()
        : "Structured Stepwise Solution",
    detectedLanguage:
      typeof obj.detectedLanguage === "string" && obj.detectedLanguage.trim()
        ? obj.detectedLanguage.trim()
        : "Plain English",
    problemSummary:
      typeof obj.problemSummary === "string" && obj.problemSummary.trim()
        ? obj.problemSummary.trim()
        : "Structured multi-language translation of student algorithm logic.",
    exampleInput:
      typeof obj.exampleInput === "string" && obj.exampleInput.trim()
        ? obj.exampleInput.trim()
        : meta.exampleInput || "Sample input",
    expectedOutput:
      typeof obj.expectedOutput === "string" && obj.expectedOutput.trim()
        ? obj.expectedOutput.trim()
        : meta.expectedOutput || "Expected result",
    extractedClauses,
    fullCode,
    edgeCases: Array.isArray(obj.edgeCases)
      ? obj.edgeCases.map(String).filter(Boolean).slice(0, 6)
      : ["Empty input", "Single-element boundary"],
    complexity: {
      time: typeof rawComplexity.time === "string" ? rawComplexity.time : "O(n)",
      space: typeof rawComplexity.space === "string" ? rawComplexity.space : "O(1)",
      explanation:
        typeof rawComplexity.explanation === "string"
          ? rawComplexity.explanation
          : "Derived from loop depth and auxiliary data structures.",
    },
    source: "gemini",
    analyzedScope: meta.analyzedScope,
    analyzedText: meta.analyzedText,
  };
}

let activeMorphController: AbortController | null = null;
let latestScanSeq = 0;

export function cancelPendingLogicScan(): void {
  latestScanSeq += 1;
  if (activeMorphController) {
    activeMorphController.abort();
    activeMorphController = null;
  }
}

export async function scanAndMorphLogic(
  req: LogicScanRequest
): Promise<{ analysis: LogicMorphAnalysis; stale: boolean; notice?: string }> {
  const seq = ++latestScanSeq;
  if (activeMorphController) {
    activeMorphController.abort();
  }
  const controller = new AbortController();
  activeMorphController = controller;

  const analyzedText = (req.selectedText || req.logicText).trim();

  if (isClientRateLimited() && !req.forceGemini) {
    const fallback = matchLocalDsaFallback({
      problemStatement: req.problemStatement,
      logicText: req.logicText,
      analyzedText,
      analyzedScope: req.analyzedScope,
    });
    return {
      analysis: fallback,
      stale: false,
      notice: "Gemini quota cooldown active — showing local analysis. Click Retry Gemini shortly.",
    };
  }

  const timer = window.setTimeout(() => controller.abort(), 21000);

  try {
    const res = await fetch("/api/ai/logic-morph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        problemStatement: req.problemStatement,
        logicText: req.logicText,
        selectedText: req.selectedText,
        pseudocode: req.pseudocode,
        exampleInput: req.exampleInput,
        expectedOutput: req.expectedOutput,
      }),
    });

    if (res.status === 429) {
      const errData = await res.clone().json().catch(() => ({}));
      markClientRateLimited(errData?.retryAfterSeconds ?? 15);
    }

    if (seq !== latestScanSeq) {
      return {
        analysis: matchLocalDsaFallback({
          problemStatement: req.problemStatement,
          logicText: req.logicText,
          analyzedText,
          analyzedScope: req.analyzedScope,
        }),
        stale: true,
      };
    }

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson?.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const validated = repairAndValidateAnalysis(data, {
      analyzedScope: req.analyzedScope,
      analyzedText,
      exampleInput: req.exampleInput,
      expectedOutput: req.expectedOutput,
    });

    if (!validated) {
      throw new Error("Gemini returned an invalid or empty structure.");
    }

    return { analysis: validated, stale: false };
  } catch (err) {
    if (seq !== latestScanSeq) {
      return {
        analysis: matchLocalDsaFallback({
          problemStatement: req.problemStatement,
          logicText: req.logicText,
          analyzedText,
          analyzedScope: req.analyzedScope,
        }),
        stale: true,
      };
    }

    const fallback = matchLocalDsaFallback({
      problemStatement: req.problemStatement,
      logicText: req.logicText,
      analyzedText,
      analyzedScope: req.analyzedScope,
    });
    const reason = err instanceof Error ? err.message : "Network unavailable";
    return {
      analysis: fallback,
      stale: false,
      notice:
        fallback.source === "local-template"
          ? `Gemini unavailable (${reason}) — loaded matching local algorithm template.`
          : `Gemini unavailable (${reason}) — local clause scan completed. Click Retry Gemini for full 4-language synthesis.`,
    };
  } finally {
    clearTimeout(timer);
    if (activeMorphController === controller) {
      activeMorphController = null;
    }
  }
}

export const SUPPORTED_TEXT_EXTENSIONS = [".txt", ".md", ".c", ".cpp", ".py", ".java"];
export const SUPPORTED_IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

export function readTextLogicFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > 512 * 1024) {
      reject(new Error("Text/code file exceeds 512 KB limit."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read file locally."));
    reader.readAsText(file);
  });
}

export async function extractLogicFromImageFile(file: File): Promise<ImageOcrResult> {
  const allowedMimes = new Set(["image/png", "image/jpeg", "image/webp"]);
  const mime = file.type || (file.name.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg");

  if (!allowedMimes.has(mime)) {
    throw new Error("Unsupported image format. Please upload .png, .jpg, .jpeg, or .webp.");
  }
  if (file.size > 4 * 1024 * 1024) {
    throw new Error("Image exceeds the 4 MB size limit.");
  }

  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const idx = dataUrl.indexOf(",");
      if (idx === -1) {
        reject(new Error("Could not encode image data."));
        return;
      }
      resolve(dataUrl.slice(idx + 1));
    };
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 22000);
  try {
    const res = await fetch("/api/ai/logic-ocr", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        mimeType: mime,
        base64Data,
        fileName: file.name,
      }),
    });

    if (res.status === 429) {
      const errData = await res.clone().json().catch(() => ({}));
      markClientRateLimited(errData?.retryAfterSeconds ?? 15);
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.plainEnglishLogic) {
      throw new Error(data?.error || "Gemini image extraction failed. Please try again or type your logic.");
    }

    return {
      problemStatement: String(data.problemStatement ?? ""),
      plainEnglishLogic: String(data.plainEnglishLogic),
      exampleInput: String(data.exampleInput ?? ""),
      expectedOutput: String(data.expectedOutput ?? ""),
      summary: String(data.summary ?? "Extracted algorithm steps"),
    };
  } finally {
    clearTimeout(timer);
  }
}
