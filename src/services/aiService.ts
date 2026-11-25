export interface HintRequest {
  gameTitle: string;
  subject: string;
  level: number;
  objective: string;
  gameState: unknown;
  fallbackHint: string;
}

export interface IntuitionRequest {
  gameTitle: string;
  subject: string;
  action: string;
  stateSummary: string;
  fallbackIntuition: string;
}

export interface InterviewEvalRequest {
  shield: string;
  question: string;
  expectedConcepts: string[];
  userAnswer: string;
}

export interface InterviewEvalResult {
  correctness: number;
  technicalDepth: number;
  clarity: number;
  overallScore: number;
  explanation: string;
  missingConcepts: string[];
  suggestions: string[];
  source: "gemini" | "local";
}

export interface ProjectForgeRequest {
  domain: string;
  difficulty: string;
  stack: string;
  projectType: string;
}

export interface ProjectForgeResult {
  title: string;
  problemStatement: string;
  proposedSolution: string;
  coreFeatures: string[];
  techStack: string[];
  roadmap: string[];
  extensions: string[];
  source: "gemini" | "local";
}

let activeIntuitionController: AbortController | null = null;
let clientRateLimitedUntil = 0;
let lastIntuitionCallAt = 0;
const INTUITION_MIN_INTERVAL_MS = 20000;

const intuitionCache = new Map<string, string>();
const hintCache = new Map<string, string>();

export function markClientRateLimited(retryAfterSeconds = 15): void {
  const safeSec = Math.min(60, Math.max(5, Number(retryAfterSeconds) || 15));
  clientRateLimitedUntil = Math.max(clientRateLimitedUntil, Date.now() + safeSec * 1000);
}

export function isClientRateLimited(): boolean {
  return Date.now() < clientRateLimitedUntil;
}

async function handleRateLimitResponse(res: Response): Promise<void> {
  if (res.status !== 429) return;
  try {
    const data = await res.clone().json();
    markClientRateLimited(data?.retryAfterSeconds ?? 15);
  } catch {
    markClientRateLimited(15);
  }
}

async function fetchWithTimeout(
  url: string,
  body: unknown,
  timeoutMs = 20000,
  externalController?: AbortController
): Promise<Response> {
  const controller = externalController ?? new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    await handleRateLimitResponse(res);
    return res;
  } finally {
    clearTimeout(timer);
  }
}

export async function requestAiHint(req: HintRequest): Promise<{ text: string; source: "gemini" | "local" }> {
  const cacheKey = `${req.gameTitle}|${req.level}|${JSON.stringify(req.gameState)}`;
  const cached = hintCache.get(cacheKey);
  if (cached) return { text: cached, source: "gemini" };

  if (isClientRateLimited()) {
    return { text: req.fallbackHint, source: "local" };
  }

  try {
    const res = await fetchWithTimeout("/api/ai/hint", req, 22000);
    if (!res.ok) throw new Error("API unavailable");
    const data = await res.json();
    if (data?.hint) {
      hintCache.set(cacheKey, data.hint);
      return { text: data.hint, source: "gemini" };
    }
    throw new Error("Empty hint");
  } catch {
    return { text: req.fallbackHint, source: "local" };
  }
}

export async function requestAiIntuition(
  req: IntuitionRequest
): Promise<{ text: string; source: "gemini" | "local" }> {
  const cacheKey = `${req.gameTitle}|${req.action}`;
  const cached = intuitionCache.get(cacheKey);
  if (cached) {
    return { text: cached, source: "gemini" };
  }

  const now = Date.now();
  // Protect Free Tier 5 RPM quota: throttle automatic background intuition calls
  // and skip immediately when rate-limit cooldown is active
  if (isClientRateLimited() || now - lastIntuitionCallAt < INTUITION_MIN_INTERVAL_MS) {
    return { text: req.fallbackIntuition, source: "local" };
  }

  if (activeIntuitionController) {
    activeIntuitionController.abort();
  }
  const controller = new AbortController();
  activeIntuitionController = controller;
  lastIntuitionCallAt = now;

  try {
    const res = await fetchWithTimeout("/api/ai/intuition", req, 18000, controller);
    if (!res.ok) throw new Error("API unavailable");
    const data = await res.json();
    if (data?.intuition) {
      intuitionCache.set(cacheKey, data.intuition);
      return { text: data.intuition, source: "gemini" };
    }
    throw new Error("Empty intuition");
  } catch {
    return { text: req.fallbackIntuition, source: "local" };
  } finally {
    if (activeIntuitionController === controller) {
      activeIntuitionController = null;
    }
  }
}

export async function evaluateInterviewAnswer(req: InterviewEvalRequest): Promise<InterviewEvalResult> {
  if (!isClientRateLimited()) {
    try {
      const res = await fetchWithTimeout("/api/ai/interview-eval", req, 22000);
      if (!res.ok) throw new Error("API unavailable");
      const data = await res.json();
      if (typeof data?.overallScore === "number") {
        return { ...data, source: "gemini" };
      }
      throw new Error("Malformed evaluation");
    } catch {
      // fall through to deterministic rubric fallback
    }
  }

  {
    // Deterministic rubric-based local fallback
    const lower = req.userAnswer.toLowerCase();
    const matched = req.expectedConcepts.filter((c) => {
      const tokens = c.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
      return tokens.some((t) => lower.includes(t));
    });
    const missing = req.expectedConcepts.filter((c) => !matched.includes(c));
    const ratio = req.expectedConcepts.length > 0 ? matched.length / req.expectedConcepts.length : 0.5;
    const wordCount = req.userAnswer.trim().split(/\s+/).filter(Boolean).length;
    const lengthBonus = Math.min(20, Math.floor(wordCount / 3));

    const correctness = Math.min(96, Math.max(35, Math.round(ratio * 78 + lengthBonus)));
    const technicalDepth = Math.min(95, Math.max(30, Math.round(ratio * 72 + Math.min(22, wordCount / 2.5))));
    const clarity = Math.min(94, Math.max(45, wordCount >= 18 ? 82 : 58));
    const overallScore = Math.round(correctness * 0.45 + technicalDepth * 0.35 + clarity * 0.2);

    return {
      correctness,
      technicalDepth,
      clarity,
      overallScore,
      explanation:
        overallScore >= 70
          ? `Solid technical defense covering ${matched.length}/${req.expectedConcepts.length} core rubric concepts. Your reasoning demonstrates practical engineering clarity.`
          : `Partial coverage (${matched.length}/${req.expectedConcepts.length} concepts). Anchor your explanation directly to time/space trade-offs and concrete mechanisms.`,
      missingConcepts: missing.length > 0 ? missing : ["Edge-case failure mode analysis"],
      suggestions: [
        missing.length > 0
          ? `Explicitly connect your answer to: ${missing.slice(0, 2).join(" and ")}.`
          : "Quantify complexity bounds (Big-O) or latency budgets to make your answer interview-ready.",
        "Structure responses as Definition → Core Mechanism → Real-World Trade-off.",
      ],
      source: "local",
    };
  }
}

const LOCAL_PROJECTS: Record<string, ProjectForgeResult> = {
  "Distributed Systems": {
    title: "AegisGrid: Raft-Backed Distributed Key-Value Store",
    problemStatement:
      "Single-node storage engines suffer from downtime during network partitions and lack strong linearizable read guarantees under heavy concurrent write bursts.",
    proposedSolution:
      "Build a fault-tolerant 3-node Raft consensus cluster with an LSM-tree storage backend, write-ahead logging (WAL), and consistent hash sharding with live cluster visualization.",
    coreFeatures: [
      "Leader election & heartbeat failure detection using Raft protocol",
      "Append-only Write-Ahead Log (WAL) with crash recovery snapshots",
      "Consistent hash ring with virtual nodes for dynamic shard rebalancing",
      "Real-time WebGL topology telemetry dashboard with chaos failover switches",
    ],
    techStack: ["Go / TypeScript", "gRPC", "Three.js", "Docker", "Prometheus"],
    roadmap: [
      "Week 1: Implement Raft state machine (Follower, Candidate, Leader) and RPC transport",
      "Week 2: Add Log Replication, Quorum Commit index, and disk-backed WAL",
      "Week 3: Build HTTP/gRPC gateway with linearizable ReadIndex leases",
      "Week 4: Deploy 3-node cluster with chaos fault injection and 3D metrics UI",
    ],
    extensions: [
      "Add Multi-Raft shard splitting for hot key ranges",
      "Integrate eBPF packet-level latency tracing",
      "Benchmark throughput against Redis using YCSB workloads",
    ],
    source: "local",
  },
  "AI & Machine Learning": {
    title: "PulseRAG: Real-Time Academic Viva & Codebase Intelligence Engine",
    problemStatement:
      "Students and junior engineers struggle to navigate large technical syllabi and codebases without hallucinated answers or missing citations.",
    proposedSolution:
      "Engineer a hybrid semantic + BM25 retrieval pipeline with AST-aware code chunking, grounded citation verification, and rubric-driven interactive oral examination.",
    coreFeatures: [
      "AST-aware source code & PDF syllabus chunker with vector indexing",
      "Hybrid dense + lexical search with reciprocal rank fusion",
      "Grounded citation highlighter linking every answer back to source lines",
      "Adaptive viva rubric scorer tracking mastery across MAKAUT modules",
    ],
    techStack: ["TypeScript", "React", "Python FastAPI", "Gemini API", "pgvector"],
    roadmap: [
      "Week 1: Build document & code ingestion pipeline with structured chunking",
      "Week 2: Implement hybrid vector + keyword retrieval API",
      "Week 3: Integrate structured JSON rubric grading with Gemini",
      "Week 4: Build evaluation harness measuring faithfulness & latency",
    ],
    extensions: [
      "Add voice-based live viva defense mode",
      "Support multi-repo cross-file dependency graphs",
      "Export personalized revision flashcards for weak topics",
    ],
    source: "local",
  },
  "Full-Stack Web": {
    title: "ChronosSync: Conflict-Free Collaborative Code & Whiteboard OS",
    problemStatement:
      "Remote engineering teams face state divergence, high latency, and merge conflicts when collaborating simultaneously on architecture diagrams and code.",
    proposedSolution:
      "Create a local-first collaborative workspace powered by CRDTs (Conflict-Free Replicated Data Types), WebSocket delta sync, and live presence cursors.",
    coreFeatures: [
      "Offline-first CRDT document state with automatic conflict resolution",
      "Low-latency WebSocket broadcast hub with room sharding",
      "Interactive canvas for system architecture blocks + live code snippets",
      "Time-travel revision history with snapshot diffing",
    ],
    techStack: ["React", "TypeScript", "Node.js", "WebSockets", "SQLite / Postgres"],
    roadmap: [
      "Week 1: Design CRDT operation log and local IndexedDB persistence",
      "Week 2: Build WebSocket sync server with room auth and presence",
      "Week 3: Implement interactive vector canvas and code editor blocks",
      "Week 4: Stress test with 50+ concurrent simulated clients and offline reconnects",
    ],
    extensions: [
      "Add end-to-end encryption for private team workspaces",
      "Integrate sandboxed code execution runner",
      "Export diagrams directly to Mermaid and Terraform stubs",
    ],
    source: "local",
  },
  "Cybersecurity & Networks": {
    title: "SentinelPacket: Zero-Trust Micro-Firewall & Anomaly Radar",
    problemStatement:
      "Modern microservice networks are vulnerable to lateral movement, credential stuffing, and subtle API rate-limit abuse that static firewalls miss.",
    proposedSolution:
      "Develop an intelligent reverse-proxy gateway with token-bucket rate limiting, sliding-window anomaly detection, and live 3D packet flow inspection.",
    coreFeatures: [
      "Configurable L7 reverse proxy with JWT & mTLS verification",
      "Per-IP sliding-window & token-bucket DDoS mitigation engine",
      "Real-time threat scoring for SQLi, XSS, and unusual burst patterns",
      "Interactive network topology map with one-click IP quarantine",
    ],
    techStack: ["Node.js / Rust", "TypeScript", "React", "Three.js", "Redis"],
    roadmap: [
      "Week 1: Build HTTP reverse proxy with request inspection middleware",
      "Week 2: Implement Redis-backed token-bucket rate limiter",
      "Week 3: Add heuristic anomaly detector and audit log pipeline",
      "Week 4: Build live dashboard with simulated attack traffic replay",
    ],
    extensions: [
      "Export OpenTelemetry security spans to Grafana",
      "Add automated honeypot endpoint traps",
      "Support geo-fencing and ASN reputation rules",
    ],
    source: "local",
  },
};

export async function generateProjectBlueprint(req: ProjectForgeRequest): Promise<ProjectForgeResult> {
  if (!isClientRateLimited()) {
    try {
      const res = await fetchWithTimeout("/api/ai/project-forge", req, 15000);
      if (!res.ok) throw new Error("API unavailable");
      const data = await res.json();
      if (data?.title && Array.isArray(data?.coreFeatures)) {
        return { ...data, source: "gemini" };
      }
      throw new Error("Malformed blueprint");
    } catch {
      // fall through to local blueprint
    }
  }

  const base = LOCAL_PROJECTS[req.domain] || LOCAL_PROJECTS["Distributed Systems"];
  return {
    ...base,
    techStack: req.stack
      ? Array.from(new Set([...req.stack.split(",").map((s) => s.trim()).filter(Boolean), ...base.techStack])).slice(0, 5)
      : base.techStack,
    source: "local",
  };
}
