import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, ThinkingLevel, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "1mb" }));

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
  return res.status(fallbackStatus).json({ error: fallbackMsg, code: fallbackStatus });
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

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
