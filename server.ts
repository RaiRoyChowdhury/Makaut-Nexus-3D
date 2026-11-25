import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "6mb" }));

const PORT = Number(process.env.PORT) || 3000;
const MODEL_NAME = "gemini-4-hydrogen";

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function withTimeout<T>(promise: Promise<T>, ms = 25000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("AI request timed out")), ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

let rateLimitCooldownUntil = 0;

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}
const aiCache = new Map<string, CacheEntry>();

function getCached<T>(key: string): T | null {
  const entry = aiCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    aiCache.delete(key);
    return null;
  }
  return entry.value as T;
}

function setCached(key: string, value: unknown, ttlMs = 5 * 60 * 1000): void {
  if (aiCache.size >= 150) {
    const firstKey = aiCache.keys().next().value;
    if (firstKey !== undefined) aiCache.delete(firstKey);
  }
  aiCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function parseRateLimitError(err: unknown): { isRateLimit: boolean; retryAfterSeconds: number } {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const isRateLimit =
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.toLowerCase().includes("quota") ||
    msg.toLowerCase().includes("rate limit");

  if (!isRateLimit) {
    return { isRateLimit: false, retryAfterSeconds: 0 };
  }

  let retryAfterSeconds = 15;
  const retryMatch = msg.match(/retry in\s+([0-9.]+)s/i) || msg.match(/retryDelay["']?\s*:\s*["']?([0-9]+)s/i);
  if (retryMatch) {
    const parsed = Math.ceil(Number(retryMatch[1]));
    if (Number.isFinite(parsed) && parsed > 0) {
      retryAfterSeconds = Math.min(60, Math.max(5, parsed));
    }
  }
  rateLimitCooldownUntil = Math.max(rateLimitCooldownUntil, Date.now() + retryAfterSeconds * 1000);
  return { isRateLimit: true, retryAfterSeconds };
}

function getCooldownRemainingSeconds(): number {
  const diff = rateLimitCooldownUntil - Date.now();
  return diff > 0 ? Math.ceil(diff / 1000) : 0;
}

function sendAiError(res: express.Response, err: unknown, fallbackStatus = 502, fallbackMsg = "AI request failed") {
  const rl = parseRateLimitError(err);
  if (rl.isRateLimit) {
    return res.status(429).json({
      error: `Gemini API rate limit reached. Retry in ${rl.retryAfterSeconds}s or select a billing-enabled key in Settings > Secrets.`,
      retryAfterSeconds: rl.retryAfterSeconds,
      code: 429,
    });
  }
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (msg.toLowerCase().includes("timed out")) {
    return res.status(504).json({ error: "AI request timed out", code: 504 });
  }
  const safeDetail = msg.replace(/AIza[0-9A-Za-z_-]{20,}/g, "[REDACTED]").slice(0, 220);
  return res.status(fallbackStatus).json({ error: fallbackMsg, detail: safeDetail, code: fallbackStatus });
}

// 1. 3D Hint Beam Endpoint
app.post("/api/ai/hint", async (req, res) => {
  const { gameTitle, subject, level, objective, gameState } = req.body ?? {};
  const cacheKey = `hint:${gameTitle}:${level}:${JSON.stringify(gameState)}`;
  const cached = getCached<{ hint: string; source: "gemini" }>(cacheKey);
  if (cached) return res.json(cached);

  const cooldownSec = getCooldownRemainingSeconds();
  if (cooldownSec > 0) {
    return res.status(429).json({
      error: `Gemini API rate limit active. Retry in ${cooldownSec}s.`,
      retryAfterSeconds: cooldownSec,
      code: 429,
    });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({ error: "Gemini API key not configured" });
  }
  try {
    const prompt = `You are an expert MAKAUT B.Tech IT professor tutoring a student inside a 3D engineering simulation.
Game: ${gameTitle}
Subject: ${subject}
Level: ${level}
Objective: ${objective}
Current State: ${JSON.stringify(gameState)}

Provide ONE concise, actionable hint (max 2 sentences, under 45 words) that guides the student toward the solution without giving away the exact final click or answer. Be technically accurate.`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      })
    );
    const text = (response.text ?? "").trim();
    if (!text) throw new Error("Empty response from Gemini");
    const payload = { hint: text, source: "gemini" as const };
    setCached(cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    return sendAiError(res, err, 502, "Failed to generate AI hint");
  }
});

// 2. AI Intuition Endpoint
app.post("/api/ai/intuition", async (req, res) => {
  const { gameTitle, subject, action, stateSummary } = req.body ?? {};
  const cacheKey = `intuition:${gameTitle}:${action}`;
  const cached = getCached<{ intuition: string; source: "gemini" }>(cacheKey);
  if (cached) return res.json(cached);

  const cooldownSec = getCooldownRemainingSeconds();
  if (cooldownSec > 0) {
    return res.status(429).json({
      error: `Gemini API rate limit active. Retry in ${cooldownSec}s.`,
      retryAfterSeconds: cooldownSec,
      code: 429,
    });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({ error: "Gemini API key not configured" });
  }
  try {
    const prompt = `You are the AI Intuition engine in MAKAUT NEXUS 3D.
Game: ${gameTitle} (${subject})
Player Action: ${action}
State Summary: ${stateSummary}

Write a crisp 1-sentence technical intuition note (under 30 words) explaining the underlying computer science or engineering principle triggered by this action.`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      })
    );
    const text = (response.text ?? "").trim();
    if (!text) throw new Error("Empty response from Gemini");
    const payload = { intuition: text, source: "gemini" as const };
    setCached(cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    return sendAiError(res, err, 502, "Failed to generate AI intuition");
  }
});

// 3. Interview Boss Duel Evaluation Endpoint
app.post("/api/ai/interview-eval", async (req, res) => {
  const { shield, question, expectedConcepts, userAnswer } = req.body ?? {};
  const cooldownSec = getCooldownRemainingSeconds();
  if (cooldownSec > 0) {
    return res.status(429).json({
      error: `Gemini API rate limit active. Retry in ${cooldownSec}s.`,
      retryAfterSeconds: cooldownSec,
      code: 429,
    });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({ error: "Gemini API key not configured" });
  }
  try {
    const prompt = `Evaluate this B.Tech IT placement interview answer for MAKAUT NEXUS 3D.
Stage: ${shield}
Question: ${question}
Key Concepts Expected: ${(expectedConcepts || []).join(", ")}
Candidate Answer: "${userAnswer}"

Grade rigorously but fairly as a senior Staff Engineer interviewer. Score each dimension 0-100 and compute overallScore 0-100.`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              correctness: { type: Type.INTEGER },
              technicalDepth: { type: Type.INTEGER },
              clarity: { type: Type.INTEGER },
              overallScore: { type: Type.INTEGER },
              explanation: { type: Type.STRING },
              missingConcepts: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              suggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
            required: [
              "correctness",
              "technicalDepth",
              "clarity",
              "overallScore",
              "explanation",
              "missingConcepts",
              "suggestions",
            ],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text ?? "{}").trim());
    return res.json({ ...parsed, source: "gemini" });
  } catch (err) {
    return sendAiError(res, err, 502, "Failed to evaluate interview response");
  }
});

// 4. Project Forge Idea Generator Endpoint
app.post("/api/ai/project-forge", async (req, res) => {
  const { domain, difficulty, stack, projectType } = req.body ?? {};
  const cooldownSec = getCooldownRemainingSeconds();
  if (cooldownSec > 0) {
    return res.status(429).json({
      error: `Gemini API rate limit active. Retry in ${cooldownSec}s.`,
      retryAfterSeconds: cooldownSec,
      code: 429,
    });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({ error: "Gemini API key not configured" });
  }
  try {
    const prompt = `Generate a standout, portfolio-grade B.Tech IT capstone or placement project blueprint for a MAKAUT engineering student.
Domain: ${domain}
Difficulty: ${difficulty}
Preferred Stack: ${stack}
Project Type: ${projectType}

Return a structured technical blueprint with a strong title, problem statement, proposed solution, 4-5 core features, concrete tech stack list, 4-step implementation roadmap, and 3 potential extensions.`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              problemStatement: { type: Type.STRING },
              proposedSolution: { type: Type.STRING },
              coreFeatures: { type: Type.ARRAY, items: { type: Type.STRING } },
              techStack: { type: Type.ARRAY, items: { type: Type.STRING } },
              roadmap: { type: Type.ARRAY, items: { type: Type.STRING } },
              extensions: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: [
              "title",
              "problemStatement",
              "proposedSolution",
              "coreFeatures",
              "techStack",
              "roadmap",
              "extensions",
            ],
          },
        },
      })
    );

    const parsed = JSON.parse((response.text ?? "{}").trim());
    return res.json({ ...parsed, source: "gemini" });
  } catch (err) {
    return sendAiError(res, err, 502, "Failed to generate project blueprint");
  }
});

// 5. PYQ / Topic -> Instant 3D Lab Generator Endpoint
app.post("/api/ai/pyq-lab", async (req, res) => {
  const { query } = req.body ?? {};
  if (!query || typeof query !== "string" || query.trim().length < 4) {
    return res.status(400).json({ error: "Please enter a valid MAKAUT question or syllabus topic." });
  }

  const normalizedQuery = query.trim();
  const cacheKey = `pyq:${normalizedQuery.toLowerCase()}`;
  const cached = getCached<Record<string, unknown>>(cacheKey);
  if (cached) return res.json(cached);

  const cooldownSec = getCooldownRemainingSeconds();
  if (cooldownSec > 0) {
    return res.status(429).json({
      error: `Gemini API rate limit active. Retry in ${cooldownSec}s.`,
      retryAfterSeconds: cooldownSec,
      code: 429,
    });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({ error: "Gemini API key not configured" });
  }

  try {
    const prompt = `You are the MAKAUT NEXUS 3D Mission Architect for B.Tech IT Semester 3.
Analyze the following MAKAUT previous-year question, syllabus topic, or technical problem:
"${normalizedQuery}"

Map it to one of the five allowed 3D engine archetypes:
- "graph_pointer" (for PCC-CS301 Data Structures & Algorithms: linked lists, pointers, trees, graphs, cycles)
- "pipeline_sequence" (for PCC-CS302 Computer Organization & Architecture: fetch-decode-execute, addressing modes, memory cycles, hazards)
- "circuit_prism" (for ESC-301 Analog & Digital Electronics: logic gates, Boolean simplification, K-Maps, NAND/NOR/XOR circuits)
- "equilibrium_slider" (for BSC-301 Mathematics-III OR HSMC-301 Economics: Laplace, ODEs, eigenvalues, break-even, cost-volume-profit)
- "stack_inspector" (for PCC-CS393 Python / IT Workshop Lab: recursion, call stack frames, scope, debugging)

Requirements:
1. Generate a clear, solvable interactive mission matching the chosen archetype.
2. Provide 4 to 6 concise interactive nodesOrControls steps/elements.
3. Provide an exact, technically sound correctSequenceOrTarget, a guiding hintBeamTarget, and a single-sentence ahaIntuition.
4. Note: NAND and NOR are universal gates; XOR alone is NOT universal.`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              labTitle: { type: Type.STRING },
              detectedSubjectCode: { type: Type.STRING },
              archetype: {
                type: Type.STRING,
                enum: [
                  "graph_pointer",
                  "circuit_prism",
                  "pipeline_sequence",
                  "equilibrium_slider",
                  "stack_inspector",
                ],
              },
              missionObjective: { type: Type.STRING },
              nodesOrControls: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              correctSequenceOrTarget: { type: Type.STRING },
              hintBeamTarget: { type: Type.STRING },
              ahaIntuition: { type: Type.STRING },
            },
            required: [
              "labTitle",
              "detectedSubjectCode",
              "archetype",
              "missionObjective",
              "nodesOrControls",
              "correctSequenceOrTarget",
              "hintBeamTarget",
              "ahaIntuition",
            ],
          },
        },
      }),
      3900
    );

    const parsed = JSON.parse((response.text ?? "{}").trim());
    const payload = { ...parsed, source: "gemini" };
    setCached(cacheKey, payload);
    return res.json(payload);
  } catch (err) {
    return sendAiError(res, err, 504, "PYQ Lab generation timed out or failed");
  }
});

// 6. Placement Aptitude Question Generator Endpoint
app.post("/api/ai/aptitude-generate", async (req, res) => {
  const { difficulty = "All", count = 6, avoidQuestions = [] } = req.body ?? {};

  const cooldownSec = getCooldownRemainingSeconds();
  if (cooldownSec > 0) {
    return res.status(429).json({
      error: `Gemini API rate limit active. Retry in ${cooldownSec}s.`,
      retryAfterSeconds: cooldownSec,
      code: 429,
    });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({ error: "GEMINI_API_KEY not configured on server" });
  }

  const safeCount = Math.min(9, Math.max(3, Number(count) || 6));
  const safeDifficulty =
    difficulty === "Easy" || difficulty === "Medium" || difficulty === "Hard" ? difficulty : "All";
  const avoidList = Array.isArray(avoidQuestions)
    ? avoidQuestions.slice(-16).map((q) => String(q).slice(0, 140))
    : [];

  try {
    const prompt = `Generate ${safeCount} brand-new, non-repeating B.Tech IT campus placement MCQs (TCS NQT, Infosys SP, and product engineering interviews).
Difficulty target: ${safeDifficulty === "All" ? "Balanced mix of Easy, Medium, and Hard" : safeDifficulty}.
Categories: Mix across Quantitative, Logical, and Technical (DSA, Computer Architecture, Operating Systems, DBMS, Networking).
Randomization seed: ${Date.now()}-${Math.floor(Math.random() * 100000)}.
${avoidList.length > 0 ? `Do NOT repeat or closely paraphrase these previous questions:\n- ${avoidList.join("\n- ")}` : ""}
Rules:
- Every question must have exactly 4 distinct options.
- correctIdx must be an integer 0, 1, 2, or 3 matching the exact correct option.
- Double-check all math and complexity answers before responding.
- Keep explanation concise (1-2 sentences).`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: {
                      type: Type.STRING,
                      enum: ["Quantitative", "Logical", "Technical"],
                    },
                    difficulty: {
                      type: Type.STRING,
                      enum: ["Easy", "Medium", "Hard"],
                    },
                    question: { type: Type.STRING },
                    options: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    correctIdx: { type: Type.INTEGER },
                    explanation: { type: Type.STRING },
                  },
                  required: [
                    "category",
                    "difficulty",
                    "question",
                    "options",
                    "correctIdx",
                    "explanation",
                  ],
                },
              },
            },
            required: ["questions"],
          },
        },
      }),
      18000
    );

    const parsed = JSON.parse((response.text ?? "{}").trim());
    const rawList = Array.isArray(parsed?.questions) ? parsed.questions : [];
    const batchTs = Date.now();
    const sanitized = rawList
      .filter(
        (item: any) =>
          item &&
          typeof item.question === "string" &&
          item.question.trim().length > 8 &&
          Array.isArray(item.options) &&
          item.options.length === 4 &&
          item.options.every((opt: unknown) => typeof opt === "string" && opt.trim().length > 0) &&
          Number.isInteger(item.correctIdx) &&
          item.correctIdx >= 0 &&
          item.correctIdx <= 3 &&
          typeof item.explanation === "string" &&
          item.explanation.trim().length > 4
      )
      .map((item: any, idx: number) => ({
        id: `gen-${batchTs}-${idx}`,
        category:
          item.category === "Quantitative" || item.category === "Logical" || item.category === "Technical"
            ? item.category
            : "Technical",
        difficulty:
          safeDifficulty !== "All"
            ? safeDifficulty
            : item.difficulty === "Easy" || item.difficulty === "Medium" || item.difficulty === "Hard"
            ? item.difficulty
            : "Medium",
        question: item.question.trim(),
        options: item.options.map((o: string) => o.trim()),
        correctIdx: item.correctIdx,
        explanation: item.explanation.trim(),
      }));

    if (sanitized.length === 0) {
      return res.status(502).json({ error: "Generated aptitude batch was empty or invalid" });
    }

    return res.json({ questions: sanitized, source: "gemini" });
  } catch (err) {
    return sendAiError(res, err, 502, "Failed to generate aptitude questions");
  }
});

// 7. Placement Interview Boss Question Generator Endpoint
app.post("/api/ai/interview-question", async (req, res) => {
  const {
    shieldId = 1,
    stage = "Shield 1 · Fundamentals",
    difficulty = "Core DSA & Memory",
    previousQuestions = [],
  } = req.body ?? {};

  const cooldownSec = getCooldownRemainingSeconds();
  if (cooldownSec > 0) {
    return res.status(429).json({
      error: `Gemini API rate limit active. Retry in ${cooldownSec}s.`,
      retryAfterSeconds: cooldownSec,
      code: 429,
    });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({ error: "GEMINI_API_KEY not configured on server" });
  }

  const prevList = Array.isArray(previousQuestions)
    ? previousQuestions.slice(-10).map((q) => String(q).slice(0, 180))
    : [];

  try {
    const prompt = `You are TITAN-SYS ARCHITECT, a Staff Software Engineer conducting a B.Tech IT placement interview.
Generate ONE fresh, sharp technical interview question for:
Stage: ${stage} (Shield ${shieldId})
Focus Area: ${difficulty}
Randomization seed: ${Date.now()}-${Math.floor(Math.random() * 100000)}
${prevList.length > 0 ? `Do NOT repeat or closely paraphrase these previous questions:\n- ${prevList.join("\n- ")}` : ""}
Return JSON with:
- question: clear, challenging interview prompt (1-3 sentences)
- expectedConcepts: array of 4-5 concise key technical phrases a strong candidate should mention
- sampleStarter: a concise 2-3 sentence model strong defense answer covering those concepts.`;

    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              expectedConcepts: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              sampleStarter: { type: Type.STRING },
            },
            required: ["question", "expectedConcepts", "sampleStarter"],
          },
        },
      }),
      15000
    );

    const parsed = JSON.parse((response.text ?? "{}").trim());
    if (
      typeof parsed?.question !== "string" ||
      parsed.question.trim().length < 12 ||
      !Array.isArray(parsed?.expectedConcepts) ||
      parsed.expectedConcepts.length === 0 ||
      typeof parsed?.sampleStarter !== "string"
    ) {
      return res.status(502).json({ error: "Generated interview question was invalid" });
    }

    return res.json({
      question: parsed.question.trim(),
      expectedConcepts: parsed.expectedConcepts
        .map((c: unknown) => String(c).trim())
        .filter(Boolean)
        .slice(0, 6),
      sampleStarter: parsed.sampleStarter.trim(),
      source: "gemini",
    });
  } catch (err) {
    return sendAiError(res, err, 502, "Failed to generate interview question");
  }
});

// 8. Logic-to-Code Morph Simulator Structured Analysis Endpoint
app.post("/api/ai/logic-morph", async (req, res) => {
  const {
    problemStatement = "",
    logicText = "",
    selectedText = "",
    pseudocode = "",
    exampleInput = "",
    expectedOutput = "",
  } = req.body ?? {};

  const targetText = String(selectedText || logicText || "").trim();
  if (targetText.length < 4) {
    return res.status(400).json({ error: "Please provide algorithmic logic text to scan." });
  }

  const cooldownSec = getCooldownRemainingSeconds();
  if (cooldownSec > 0) {
    return res.status(429).json({
      error: `Gemini API rate limit active. Retry in ${cooldownSec}s.`,
      retryAfterSeconds: cooldownSec,
      code: 429,
    });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({ error: "GEMINI_API_KEY not configured on server" });
  }

  try {
    const prompt = `You are an expert DSA educator and compiler architect for MAKAUT NEXUS 3D.
Analyze the student's problem and plain-English/pseudocode algorithm, detect any logical or off-by-one/overflow bugs gently, break it into 3-6 ordered clauses, and translate the EXACT SAME normalized algorithm into C, Python, C++, and Java.

Problem Statement: ${String(problemStatement).slice(0, 1200) || "Infer from student logic"}
Full Logic Context: ${String(logicText).slice(0, 2200)}
${selectedText ? `Focused Selection To Analyze: ${String(selectedText).slice(0, 1500)}` : ""}
${pseudocode ? `Optional Pseudocode: ${String(pseudocode).slice(0, 1000)}` : ""}
${exampleInput ? `Example Input: ${String(exampleInput).slice(0, 300)}` : ""}
${expectedOutput ? `Expected Output: ${String(expectedOutput).slice(0, 300)}` : ""}

CRITICAL RULES:
1. fullCode.c, fullCode.python, fullCode.cpp, and fullCode.java MUST be arrays of code lines (e.g. line 1 is L1, line 2 is L2, etc.).
2. Each extracted clause MUST list valid 1-based line IDs in codeLineIds (e.g. ["L2", "L3"]) pointing into the fullCode line arrays, plus matching codeLines for all 4 languages.
3. Detect gentle bugs if present (status = "warning" with warningMessage, whyItCanFail, suggestedFix, fixCertainty = "confirmed" | "suggestion"); otherwise status = "valid". Do not mark valid alternative approaches as warnings.
4. practiceBlank for each language must hide ONE meaningful syntax token using "____" inside a real line from that language, with 4 plausible chip options in tokens[] and exact correctToken.
5. mathXRay must explain WHY the clause works with concrete numerical/example substitution steps matching this specific problem (never hardcode Binary Search X-Ray for non-binary-search problems!).
6. visualState must match the detected algorithm category:
   - Use mode: "array" | "two_pointers" | "sliding_window" | "string" | "linked_list" | "recursion" | "tree" | "graph" | "dp" | "stack" | "variables".
   - Provide arrayElements (as string array), pointerEntries (key/value pairs), variableEntries (key/value pairs), stackFrames (if recursion/stack), dpCells (if dp), nodes (if linked_list/tree/graph), and callOrStateNote.`;

    const langLinesSchema = {
      type: Type.OBJECT,
      properties: {
        c: { type: Type.ARRAY, items: { type: Type.STRING } },
        python: { type: Type.ARRAY, items: { type: Type.STRING } },
        cpp: { type: Type.ARRAY, items: { type: Type.STRING } },
        java: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ["c", "python", "cpp", "java"],
    };

    const langStringsSchema = {
      type: Type.OBJECT,
      properties: {
        c: { type: Type.STRING },
        python: { type: Type.STRING },
        cpp: { type: Type.STRING },
        java: { type: Type.STRING },
      },
      required: ["c", "python", "cpp", "java"],
    };

    const blankItemSchema = {
      type: Type.OBJECT,
      properties: {
        prompt: { type: Type.STRING },
        tokens: { type: Type.ARRAY, items: { type: Type.STRING } },
        correctToken: { type: Type.STRING },
        hint: { type: Type.STRING },
        explanation: { type: Type.STRING },
      },
      required: ["prompt", "tokens", "correctToken", "hint", "explanation"],
    };

    const kvPairSchema = {
      type: Type.OBJECT,
      properties: {
        key: { type: Type.STRING },
        value: { type: Type.STRING },
      },
      required: ["key", "value"],
    };

    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              problemTitle: { type: Type.STRING },
              problemCategory: { type: Type.STRING },
              algorithmName: { type: Type.STRING },
              detectedLanguage: { type: Type.STRING },
              problemSummary: { type: Type.STRING },
              exampleInput: { type: Type.STRING },
              expectedOutput: { type: Type.STRING },
              fullCode: langLinesSchema,
              extractedClauses: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    clauseId: { type: Type.STRING },
                    englishSpan: { type: Type.STRING },
                    logicRole: {
                      type: Type.STRING,
                      enum: [
                        "initialization",
                        "condition",
                        "iteration",
                        "comparison",
                        "update",
                        "termination",
                        "return",
                        "other",
                      ],
                    },
                    status: { type: Type.STRING, enum: ["valid", "warning"] },
                    warningMessage: { type: Type.STRING },
                    whyItCanFail: { type: Type.STRING },
                    suggestedFix: { type: Type.STRING },
                    fixCertainty: { type: Type.STRING, enum: ["confirmed", "suggestion"] },
                    codeLineIds: { type: Type.ARRAY, items: { type: Type.STRING } },
                    codeLines: langLinesSchema,
                    syntaxTip: langStringsSchema,
                    practiceBlank: {
                      type: Type.OBJECT,
                      properties: {
                        c: blankItemSchema,
                        python: blankItemSchema,
                        cpp: blankItemSchema,
                        java: blankItemSchema,
                      },
                      required: ["c", "python", "cpp", "java"],
                    },
                    mathXRay: {
                      type: Type.OBJECT,
                      properties: {
                        formulaTitle: { type: Type.STRING },
                        whyItWorks: { type: Type.STRING },
                        substitutionSteps: { type: Type.ARRAY, items: { type: Type.STRING } },
                        boundaryIntuition: { type: Type.STRING },
                        intuition: { type: Type.STRING },
                      },
                      required: [
                        "formulaTitle",
                        "whyItWorks",
                        "substitutionSteps",
                        "boundaryIntuition",
                        "intuition",
                      ],
                    },
                    visualState: {
                      type: Type.OBJECT,
                      properties: {
                        mode: {
                          type: Type.STRING,
                          enum: [
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
                          ],
                        },
                        arrayElements: { type: Type.ARRAY, items: { type: Type.STRING } },
                        target: { type: Type.STRING },
                        pointerEntries: { type: Type.ARRAY, items: kvPairSchema },
                        variableEntries: { type: Type.ARRAY, items: kvPairSchema },
                        highlightIndices: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                        eliminatedIndices: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                        windowStart: { type: Type.INTEGER },
                        windowEnd: { type: Type.INTEGER },
                        nodes: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              id: { type: Type.STRING },
                              label: { type: Type.STRING },
                              next: { type: Type.STRING },
                              active: { type: Type.BOOLEAN },
                              visited: { type: Type.BOOLEAN },
                            },
                            required: ["id", "label"],
                          },
                        },
                        edges: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              from: { type: Type.STRING },
                              to: { type: Type.STRING },
                              active: { type: Type.BOOLEAN },
                            },
                            required: ["from", "to"],
                          },
                        },
                        stackFrames: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              fn: { type: Type.STRING },
                              params: { type: Type.STRING },
                              state: {
                                type: Type.STRING,
                                enum: ["active", "waiting", "returning", "base"],
                              },
                              returnVal: { type: Type.STRING },
                            },
                            required: ["fn", "params", "state"],
                          },
                        },
                        dpCells: {
                          type: Type.ARRAY,
                          items: {
                            type: Type.OBJECT,
                            properties: {
                              label: { type: Type.STRING },
                              value: { type: Type.STRING },
                              active: { type: Type.BOOLEAN },
                              isSource: { type: Type.BOOLEAN },
                            },
                            required: ["label", "value"],
                          },
                        },
                        frontier: { type: Type.ARRAY, items: { type: Type.STRING } },
                        callOrStateNote: { type: Type.STRING },
                      },
                      required: ["mode", "callOrStateNote"],
                    },
                  },
                  required: [
                    "clauseId",
                    "englishSpan",
                    "logicRole",
                    "status",
                    "codeLineIds",
                    "codeLines",
                    "syntaxTip",
                    "practiceBlank",
                    "mathXRay",
                    "visualState",
                  ],
                },
              },
              edgeCases: { type: Type.ARRAY, items: { type: Type.STRING } },
              complexity: {
                type: Type.OBJECT,
                properties: {
                  time: { type: Type.STRING },
                  space: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                },
                required: ["time", "space", "explanation"],
              },
            },
            required: [
              "problemTitle",
              "problemCategory",
              "algorithmName",
              "problemSummary",
              "fullCode",
              "extractedClauses",
              "edgeCases",
              "complexity",
            ],
          },
        },
      }),
      22000
    );

    const parsed = JSON.parse((response.text ?? "{}").trim());
    if (!parsed || !Array.isArray(parsed.extractedClauses) || parsed.extractedClauses.length === 0) {
      return res.status(502).json({ error: "Gemini returned an incomplete logic analysis" });
    }

    return res.json({ ...parsed, source: "gemini" });
  } catch (err) {
    return sendAiError(res, err, 502, "Failed to translate logic with Gemini");
  }
});

// 9. Flowchart / Handwritten Algorithm / Code Image OCR Endpoint
app.post("/api/ai/logic-ocr", async (req, res) => {
  const { mimeType = "", base64Data = "", fileName = "upload" } = req.body ?? {};
  const allowedMimes = new Set(["image/png", "image/jpeg", "image/webp"]);

  if (!allowedMimes.has(String(mimeType))) {
    return res.status(400).json({ error: "Unsupported image type. Use PNG, JPG, JPEG, or WEBP." });
  }
  const cleanB64 = String(base64Data).trim();
  if (!cleanB64 || cleanB64.length > 5_600_000) {
    return res.status(400).json({ error: "Image missing or exceeds maximum 4 MB upload limit." });
  }

  const cooldownSec = getCooldownRemainingSeconds();
  if (cooldownSec > 0) {
    return res.status(429).json({
      error: `Gemini API rate limit active. Retry in ${cooldownSec}s.`,
      retryAfterSeconds: cooldownSec,
      code: 429,
    });
  }

  const ai = getGeminiClient();
  if (!ai) {
    return res.status(503).json({ error: "GEMINI_API_KEY not configured on server" });
  }

  try {
    const imagePart = {
      inlineData: {
        mimeType: String(mimeType),
        data: cleanB64,
      },
    };
    const textPart = {
      text: `Inspect this uploaded image (${String(fileName).slice(0, 80)}). It contains handwritten algorithm notes, a flowchart, pseudocode, or code.
Extract the visible algorithmic steps into clean, clear plain-English clauses (one step per line) that a student can review and translate into code.
If the image has no readable algorithm/flowchart/code, set readable=false and explain in summary.`,
    };

    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: { parts: [imagePart, textPart] },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              readable: { type: Type.BOOLEAN },
              problemStatement: { type: Type.STRING },
              plainEnglishLogic: { type: Type.STRING },
              exampleInput: { type: Type.STRING },
              expectedOutput: { type: Type.STRING },
              summary: { type: Type.STRING },
            },
            required: ["readable", "plainEnglishLogic", "summary"],
          },
        },
      }),
      20000
    );

    const parsed = JSON.parse((response.text ?? "{}").trim());
    if (!parsed?.readable || !String(parsed?.plainEnglishLogic ?? "").trim()) {
      return res.status(422).json({
        error: parsed?.summary || "Could not extract clear algorithm steps from this image.",
      });
    }

    return res.json({
      problemStatement: String(parsed.problemStatement ?? "").trim(),
      plainEnglishLogic: String(parsed.plainEnglishLogic).trim(),
      exampleInput: String(parsed.exampleInput ?? "").trim(),
      expectedOutput: String(parsed.expectedOutput ?? "").trim(),
      summary: String(parsed.summary ?? "Extracted algorithm steps").trim(),
      source: "gemini",
    });
  } catch (err) {
    return sendAiError(res, err, 502, "Image extraction failed");
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`MAKAUT NEXUS 3D server listening on http://localhost:${PORT}`);
  });
}

startServer();
