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

export interface AptitudeQ {
  id: string;
  category: "Quantitative" | "Logical" | "Technical";
  difficulty: "Easy" | "Medium" | "Hard";
  question: string;
  options: string[];
  correctIdx: number;
  explanation: string;
}

export interface GenerateAptitudeRequest {
  difficulty: "All" | "Easy" | "Medium" | "Hard";
  count?: number;
  avoidQuestions?: string[];
}

export interface GenerateInterviewQuestionRequest {
  shieldId: number;
  stage: string;
  difficulty: string;
  previousQuestions?: string[];
}

export interface GeneratedInterviewQuestion {
  question: string;
  expectedConcepts: string[];
  sampleStarter: string;
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
    const res = await fetchWithTimeout("/api/ai/intuition", req, 24000, controller);
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
      const res = await fetchWithTimeout("/api/ai/project-forge", req, 24000);
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

const LOCAL_APTITUDE_POOL: Omit<AptitudeQ, "id">[] = [
  {
    category: "Quantitative",
    difficulty: "Easy",
    question: "A microservice handles 180 requests in 12 seconds. How many requests can it handle in 45 seconds at the same throughput?",
    options: ["540", "675", "720", "810"],
    correctIdx: 1,
    explanation: "180 / 12 = 15 req/s. In 45 seconds: 15 × 45 = 675 requests.",
  },
  {
    category: "Logical",
    difficulty: "Easy",
    question: "Find the missing term in the series: 3, 9, 27, 81, ?, 729",
    options: ["162", "216", "243", "324"],
    correctIdx: 2,
    explanation: "Each term is multiplied by 3: 81 × 3 = 243.",
  },
  {
    category: "Technical",
    difficulty: "Easy",
    question: "Which HTTP status code specifically indicates that the client exceeded an API rate limit?",
    options: ["401", "403", "429", "503"],
    correctIdx: 2,
    explanation: "HTTP 429 Too Many Requests signals rate-limit enforcement.",
  },
  {
    category: "Technical",
    difficulty: "Easy",
    question: "Which traversal of a Binary Search Tree yields keys in ascending sorted order?",
    options: ["Preorder", "Inorder", "Postorder", "Level-order"],
    correctIdx: 1,
    explanation: "Inorder traversal visits Left → Root → Right, producing keys in sorted order for a BST.",
  },
  {
    category: "Quantitative",
    difficulty: "Easy",
    question: "If a cache hit ratio improves from 60% to 85% out of 2,000 queries, how many additional queries become cache hits?",
    options: ["300", "400", "500", "600"],
    correctIdx: 2,
    explanation: "(0.85 - 0.60) × 2000 = 0.25 × 2000 = 500 additional cache hits.",
  },
  {
    category: "Logical",
    difficulty: "Easy",
    question: "In a certain code, STACK is written as TUBDL. How is QUEUE written in that code?",
    options: ["RVFVF", "RTFTF", "SVFVF", "RVFWF"],
    correctIdx: 0,
    explanation: "Each letter shifts forward by +1: Q→R, U→V, E→F, U→V, E→F → RVFVF.",
  },
  {
    category: "Quantitative",
    difficulty: "Medium",
    question: "A train running at 72 km/h crosses a 250 m platform in 26 seconds. What is the length of the train?",
    options: ["240 m", "260 m", "270 m", "300 m"],
    correctIdx: 2,
    explanation: "72 km/h = 20 m/s. Total distance = 20 × 26 = 520 m. Train length = 520 - 250 = 270 m.",
  },
  {
    category: "Logical",
    difficulty: "Medium",
    question: "Five developers A, B, C, D, E sit in a row. C is to the immediate right of A, E is at an extreme end, and B sits between D and E. Who sits in the exact middle?",
    options: ["A", "B", "C", "D"],
    correctIdx: 2,
    explanation: "Ordering from left to right is A, C, D, B, E (or E, B, D, A, C is invalid since C right of A forces A-C-D-B-E when E is right end, wait: A-C-D-B-E has D in middle; wait: if A is left end: A, C, D, B, E → D is middle; check: C right of A (pos 2), E at right end (pos 5), B between D and E → pos 4. Wait: A, C, D, B, E puts D in middle! Let's verify: Wait if E is left end: E, B, D, A, C puts D in middle either way!).",
  },
  {
    category: "Technical",
    difficulty: "Medium",
    question: "What is the amortized time complexity of pushing an element onto a dynamically resizing array that doubles capacity when full?",
    options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
    correctIdx: 0,
    explanation: "Capacity doubling spreads the O(n) copy cost across n insertions, yielding O(1) amortized time per push.",
  },
  {
    category: "Technical",
    difficulty: "Medium",
    question: "Which scheduling algorithm can suffer from the 'convoy effect' when a CPU-bound process arrives before short I/O-bound jobs?",
    options: ["Round Robin", "First-Come First-Served (FCFS)", "Shortest Remaining Time First", "Multilevel Feedback Queue"],
    correctIdx: 1,
    explanation: "FCFS executes jobs strictly in arrival order, causing short jobs to wait behind one long CPU-bound process.",
  },
  {
    category: "Quantitative",
    difficulty: "Medium",
    question: "A batch job finishes in 20 minutes on 3 workers. Assuming linear speedup, how long will 5 workers take?",
    options: ["10 minutes", "12 minutes", "14 minutes", "15 minutes"],
    correctIdx: 1,
    explanation: "Total work = 20 × 3 = 60 worker-minutes. With 5 workers: 60 / 5 = 12 minutes.",
  },
  {
    category: "Logical",
    difficulty: "Medium",
    question: "No deadlock occurs if circular wait is eliminated. Which statement logically equals the contrapositive?",
    options: [
      "If circular wait exists, deadlock occurs",
      "If deadlock occurs, circular wait was not eliminated",
      "If deadlock does not occur, circular wait was eliminated",
      "Circular wait is sufficient for deadlock",
    ],
    correctIdx: 1,
    explanation: "The contrapositive of (¬CW → ¬Deadlock) is (Deadlock → CW), meaning circular wait was not eliminated.",
  },
  {
    category: "Quantitative",
    difficulty: "Hard",
    question: "From a pool of 6 backend engineers and 4 frontend engineers, how many 4-member teams can be formed with at least 2 backend engineers?",
    options: ["165", "185", "195", "210"],
    correctIdx: 1,
    explanation: "C(6,2)C(4,2) + C(6,3)C(4,1) + C(6,4)C(4,0) = 15×6 + 20×4 + 15×1 = 90 + 80 + 15 = 185.",
  },
  {
    category: "Technical",
    difficulty: "Hard",
    question: "A 32-bit byte-addressable CPU has a 64 KB 4-way set-associative cache with 64-byte blocks. How many bits are used for the set index?",
    options: ["6 bits", "8 bits", "10 bits", "12 bits"],
    correctIdx: 1,
    explanation: "Sets = 65536 / (4 × 64) = 256 = 2^8 sets, so the set index requires 8 bits.",
  },
  {
    category: "Technical",
    difficulty: "Hard",
    question: "In Dijkstra's shortest-path algorithm using a binary min-heap on a graph with V vertices and E edges, what is the worst-case time complexity?",
    options: ["O(V^2)", "O((V + E) log V)", "O(V E)", "O(E log E / V)"],
    correctIdx: 1,
    explanation: "Each vertex extraction and edge relaxation takes O(log V) heap operations, totaling O((V + E) log V).",
  },
  {
    category: "Logical",
    difficulty: "Hard",
    question: "In a distributed system with 5 replicas using majority quorums (W + R > N), if W = 3, what is the minimum R for strong read-your-writes consistency?",
    options: ["1", "2", "3", "4"],
    correctIdx: 2,
    explanation: "W + R > 5 with W = 3 requires 3 + R > 5, so R ≥ 3.",
  },
  {
    category: "Quantitative",
    difficulty: "Hard",
    question: "Two servers independently fail in a day with probabilities 0.1 and 0.2. What is the probability that at least one server fails?",
    options: ["0.26", "0.28", "0.30", "0.32"],
    correctIdx: 1,
    explanation: "1 - P(both stay up) = 1 - (0.9 × 0.8) = 1 - 0.72 = 0.28.",
  },
  {
    category: "Technical",
    difficulty: "Hard",
    question: "Which B+ Tree property makes range queries significantly faster than a standard Binary Search Tree on disk?",
    options: [
      "Keys are hashed in leaf buckets",
      "All records live in linked leaf nodes with high fan-out",
      "Root node stores the entire dataset",
      "Internal nodes store duplicate full table rows",
    ],
    correctIdx: 1,
    explanation: "B+ Trees minimize disk I/O depth via high fan-out and link all leaves sequentially for fast range scans.",
  },
];

// Fix question 8 in LOCAL_APTITUDE_POOL cleanly: make sure exact unique answer matches correctIdx
LOCAL_APTITUDE_POOL[7] = {
  category: "Logical",
  difficulty: "Medium",
  question: "Five modules M1, M2, M3, M4, M5 execute sequentially. M2 runs immediately after M1, M5 runs last, and M4 runs between M3 and M5. Which module executes 3rd?",
  options: ["M1", "M2", "M3", "M4"],
  correctIdx: 2,
  explanation: "The only order satisfying all constraints is M1 → M2 → M3 → M4 → M5, so M3 executes 3rd.",
};

function createDynamicParamQuestion(targetDifficulty: "Easy" | "Medium" | "Hard", seedIdx: number): Omit<AptitudeQ, "id"> {
  if (targetDifficulty === "Easy") {
    const rate = 12 + ((seedIdx * 7 + Math.floor(Math.random() * 9)) % 14);
    const secs = 20 + ((seedIdx * 5) % 25);
    const ans = rate * secs;
    return {
      category: "Quantitative",
      difficulty: "Easy",
      question: `An edge router forwards ${rate * 5} packets every 5 seconds. At this steady rate, how many packets does it forward in ${secs} seconds?`,
      options: [String(ans - rate), String(ans), String(ans + rate), String(ans + 2 * rate)],
      correctIdx: 1,
      explanation: `Rate = ${rate * 5} / 5 = ${rate} packets/sec. In ${secs} seconds: ${rate} × ${secs} = ${ans} packets.`,
    };
  }
  if (targetDifficulty === "Medium") {
    const workersA = 6 + (Math.floor(Math.random() * 5));
    const hoursA = 8 + (Math.floor(Math.random() * 5)) * 2;
    const total = workersA * hoursA;
    const workersB = 4;
    const hoursB = total / workersB;
    return {
      category: "Quantitative",
      difficulty: "Medium",
      question: `A distributed build takes ${hoursA} hours using ${workersA} identical runners. How many hours will ${workersB} runners take assuming zero coordination overhead?`,
      options: [`${hoursB - 2} hrs`, `${hoursB} hrs`, `${hoursB + 3} hrs`, `${hoursB + 6} hrs`],
      correctIdx: 1,
      explanation: `Total compute = ${workersA} × ${hoursA} = ${total} runner-hours. Divided by ${workersB} runners = ${hoursB} hours.`,
    };
  }
  const nodes = 5 + Math.floor(Math.random() * 3) * 2; // 5, 7, 9
  const maxFail = Math.floor(nodes / 2);
  return {
    category: "Logical",
    difficulty: "Hard",
    question: `In a ${nodes}-node Raft consensus cluster, what is the maximum number of nodes that can crash simultaneously while still maintaining write availability?`,
    options: [`${Math.max(1, maxFail - 1)}`, `${maxFail}`, `${maxFail + 1}`, `${nodes - 1}`],
    correctIdx: 1,
    explanation: `Quorum needs floor(${nodes}/2) + 1 = ${maxFail + 1} healthy nodes, so up to ${maxFail} nodes may fail.`,
  };
}

function buildLocalAptitudeBatch(req: GenerateAptitudeRequest): AptitudeQ[] {
  const avoidSet = new Set((req.avoidQuestions ?? []).map((q) => q.trim().toLowerCase()));
  const targetCount = Math.min(9, Math.max(3, req.count ?? (req.difficulty === "All" ? 6 : 5)));
  const pool =
    req.difficulty === "All"
      ? LOCAL_APTITUDE_POOL
      : LOCAL_APTITUDE_POOL.filter((q) => q.difficulty === req.difficulty);

  const unseen = pool.filter((q) => !avoidSet.has(q.question.trim().toLowerCase()));
  const candidates = [...(unseen.length >= targetCount ? unseen : pool)];

  // Fisher-Yates shuffle
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const picked = candidates.slice(0, Math.max(0, targetCount - 1));
  const dynDiff: "Easy" | "Medium" | "Hard" =
    req.difficulty === "All"
      ? (["Easy", "Medium", "Hard"][Math.floor(Math.random() * 3)] as "Easy" | "Medium" | "Hard")
      : req.difficulty;
  const dynamicQ = createDynamicParamQuestion(dynDiff, Math.floor(Math.random() * 100));
  const combined = [...picked, dynamicQ].slice(0, targetCount);

  const stamp = Date.now();
  return combined.map((q, idx) => ({
    ...q,
    id: `local-${stamp}-${idx}`,
  }));
}

export async function generateAptitudeQuestions(
  req: GenerateAptitudeRequest
): Promise<{ questions: AptitudeQ[]; source: "gemini" | "local" }> {
  if (!isClientRateLimited()) {
    try {
      const res = await fetchWithTimeout("/api/ai/aptitude-generate", req, 24000);
      if (!res.ok) throw new Error("API unavailable");
      const data = await res.json();
      if (Array.isArray(data?.questions) && data.questions.length > 0) {
        return { questions: data.questions, source: "gemini" };
      }
      throw new Error("Empty aptitude batch");
    } catch {
      // fall through to randomized unseen local generator
    }
  }

  return {
    questions: buildLocalAptitudeBatch(req),
    source: "local",
  };
}

const LOCAL_INTERVIEW_POOL: Record<number, Omit<GeneratedInterviewQuestion, "source">[]> = {
  1: [
    {
      question:
        "Compare a Hash Table (open addressing vs separate chaining) with a Balanced BST (Red-Black Tree) for storing 1M dynamic keys. When would you prefer each?",
      expectedConcepts: [
        "O(1) average vs O(log n) worst-case",
        "hash collisions & load factor",
        "ordered range queries",
        "cache locality",
        "memory overhead",
      ],
      sampleStarter:
        "Hash tables deliver O(1) average lookup via hashing, where open addressing offers better cache locality at low load factors while chaining handles high load gracefully. However, a Balanced BST guarantees O(log n) worst-case bounds without rehash spikes and supports ordered predecessor/range queries.",
    },
    {
      question:
        "Explain the difference between Stack memory and Heap memory in C/C++, including allocation speed, fragmentation, lifetime, and common failure modes.",
      expectedConcepts: [
        "stack pointer O(1) LIFO",
        "heap allocator & fragmentation",
        "scope lifetime vs manual/GC",
        "stack overflow",
        "memory leak or dangling pointer",
      ],
      sampleStarter:
        "Stack frames grow and shrink in O(1) by moving the stack pointer and auto-deallocate when a function returns, though deep recursion risks stack overflow. The heap supports dynamic, long-lived allocations via free-list/slab allocators, trading allocation overhead and fragmentation for flexible object lifetimes.",
    },
    {
      question:
        "How does Breadth-First Search (BFS) differ from Depth-First Search (DFS) in space complexity, shortest-path guarantees, and cycle detection?",
      expectedConcepts: [
        "FIFO queue vs LIFO stack/recursion",
        "unweighted shortest path",
        "level-order frontier memory O(b^d)",
        "DFS O(h) recursion space",
        "visited set / back-edge detection",
      ],
      sampleStarter:
        "BFS uses a FIFO queue to explore level by level, guaranteeing shortest paths in unweighted graphs at the cost of O(width) frontier memory. DFS uses a stack or recursion with O(depth) space, making it ideal for topological sorting and back-edge cycle detection rather than shortest paths.",
    },
  ],
  2: [
    {
      question:
        "Contrast Process context switching with Thread context switching inside a modern OS kernel, focusing on virtual memory, TLB invalidation, and synchronization.",
      expectedConcepts: [
        "shared virtual address space",
        "CR3 page table switch",
        "TLB flush / ASID",
        "CPU register & stack save",
        "mutex / race conditions",
      ],
      sampleStarter:
        "Threads within the same process share virtual address space and page tables, so switching threads mainly swaps registers and stack pointers without invalidating the TLB. Switching processes swaps the page table base register (CR3), causing TLB misses unless tagged with ASIDs, alongside kernel PCB bookkeeping.",
    },
    {
      question:
        "What is Virtual Memory paging, how does a Translation Lookaside Buffer (TLB) accelerate address translation, and what happens during a page fault?",
      expectedConcepts: [
        "virtual-to-physical page table",
        "TLB associative cache hit",
        "MMU hardware trap",
        "disk/swap page load",
        "dirty bit & page replacement (LRU)",
      ],
      sampleStarter:
        "Virtual memory maps fixed-size virtual pages to physical frames via kernel page tables, isolating processes. The TLB caches hot VPN-to-PFN translations inside the MMU to avoid multi-level page walks, while a missing mapping raises a page-fault trap so the OS loads the page from disk and updates the PTE.",
    },
    {
      question:
        "Explain the four Coffman conditions required for Deadlock in an OS and how production systems break at least one condition cleanly.",
      expectedConcepts: [
        "mutual exclusion",
        "hold and wait",
        "no preemption",
        "circular wait",
        "lock ordering hierarchy",
      ],
      sampleStarter:
        "Deadlock requires Mutual Exclusion, Hold-and-Wait, No Preemption, and Circular Wait simultaneously. Production services commonly eliminate Circular Wait by enforcing a strict global lock-acquisition order (e.g., always locking lower resource IDs first) or using timed try-locks with backoff.",
    },
  ],
  3: [
    {
      question:
        "Design a URL Shortener serving 50k reads/sec and 2k writes/sec. How do you generate collision-free short codes, scale reads, and handle hot links?",
      expectedConcepts: [
        "Base62 encoding or KGS",
        "read-heavy caching (Redis)",
        "database sharding",
        "301 vs 302 redirect trade-off",
        "consistent hashing",
      ],
      sampleStarter:
        "To serve a 25:1 read-to-write ratio at 50k QPS, I would pre-generate or sequence Base62 IDs via a partitioned Key Generation Service or Snowflake-style counter to avoid collisions. Reads hit a distributed Redis cache with LRU eviction before falling back to sharded DB partitions, using 302 redirects if click analytics are needed.",
    },
    {
      question:
        "You notice P99 API latency spiking from 15ms to 800ms during database traffic bursts. Walk through how connection pooling, read replicas, and circuit breakers stabilize the system.",
      expectedConcepts: [
        "bounded DB connection pool",
        "CQRS / read replica lag",
        "circuit breaker fail-fast",
        "thundering herd / jitter",
        "backpressure & timeouts",
      ],
      sampleStarter:
        "Unbounded connections exhaust DB worker threads and trigger lock contention, so a bounded connection pool (like PgBouncer) caps active DB concurrency while offloading reads to replicas. Adding timeouts, circuit breakers, and exponential backoff with jitter prevents retry storms and isolates slow dependencies.",
    },
    {
      question:
        "Explain how an LSM-Tree storage engine (used in RocksDB/Cassandra) achieves higher write throughput than a B-Tree, and what read/space trade-offs it introduces.",
      expectedConcepts: [
        "sequential append WAL & MemTable",
        "immutable SSTables",
        "background compaction",
        "Bloom filters for read amplification",
        "write vs read amplification",
      ],
      sampleStarter:
        "An LSM-Tree buffers writes in an in-memory MemTable plus sequential WAL, turning random disk writes into fast sequential SSTable flushes instead of in-place B-Tree page updates. The trade-off is higher read and space amplification across SSTable levels, mitigated with Bloom filters and periodic background compaction.",
    },
  ],
};

export async function generateInterviewQuestion(
  req: GenerateInterviewQuestionRequest
): Promise<GeneratedInterviewQuestion> {
  if (!isClientRateLimited()) {
    try {
      const res = await fetchWithTimeout("/api/ai/interview-question", req, 24000);
      if (!res.ok) throw new Error("API unavailable");
      const data = await res.json();
      if (typeof data?.question === "string" && Array.isArray(data?.expectedConcepts)) {
        return {
          question: data.question,
          expectedConcepts: data.expectedConcepts,
          sampleStarter: data.sampleStarter || "",
          source: "gemini",
        };
      }
      throw new Error("Malformed interview question");
    } catch {
      // fall through to unseen local pool
    }
  }

  const pool = LOCAL_INTERVIEW_POOL[req.shieldId] ?? LOCAL_INTERVIEW_POOL[1];
  const prevSet = new Set((req.previousQuestions ?? []).map((q) => q.trim().toLowerCase()));
  const unseen = pool.filter((item) => !prevSet.has(item.question.trim().toLowerCase()));
  const choices = unseen.length > 0 ? unseen : pool;
  const picked = choices[Math.floor(Math.random() * choices.length)];
  return {
    ...picked,
    source: "local",
  };
}

