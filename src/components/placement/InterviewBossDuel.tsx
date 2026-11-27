import { useRef, useState } from "react";
import { CheckCircle2, RefreshCw, Send, Shield, ShieldAlert, Sparkles } from "lucide-react";
import {
  evaluateInterviewAnswer,
  generateInterviewQuestion,
  InterviewEvalResult,
} from "../../services/aiService";
import { useNexus } from "../../store/useNexusStore";
import { VoiceTextControls } from "../VoiceTextControls";

interface BossShield {
  id: number;
  stage: string;
  difficulty: string;
  question: string;
  expectedConcepts: string[];
  sampleStarter: string;
}

const SHIELDS: BossShield[] = [
  {
    id: 1,
    stage: "Shield 1 · Fundamentals",
    difficulty: "Core DSA & Memory",
    question:
      "Compare a Singly Linked List and a Dynamic Array (Vector) in terms of memory layout, random access, cache locality, and mid-sequence insertion.",
    expectedConcepts: [
      "contiguous memory",
      "O(1) random access",
      "CPU cache locality",
      "O(1) pointer insertion",
      "O(n) shifting",
    ],
    sampleStarter:
      "Dynamic arrays store elements in contiguous memory, giving O(1) random access and strong CPU cache locality, but mid-array insertion takes O(n) due to shifting. Linked lists use non-contiguous heap nodes connected by pointers, allowing O(1) insertion once positioned but O(n) traversal and poorer cache locality.",
  },
  {
    id: 2,
    stage: "Shield 2 · Technical Depth",
    difficulty: "Computer Architecture & OS",
    question:
      "Explain what causes a Read-After-Write (RAW) data hazard in a pipelined CPU and how ALU data forwarding mitigates pipeline stalls.",
    expectedConcepts: [
      "instruction dependency",
      "stale register value",
      "pipeline stall or NOP bubble",
      "EX-to-EX forwarding bypass",
      "throughput CPI",
    ],
    sampleStarter:
      "A RAW hazard occurs when an instruction tries to read a register in ID/EX before a preceding instruction finishes writing back to the register file in WB. Instead of inserting NOP stall bubbles that degrade CPI, ALU forwarding routes the computed result directly from the EX/MEM latch to the next instruction's ALU input.",
  },
  {
    id: 3,
    stage: "Shield 3 · Problem Solving",
    difficulty: "System Design & Concurrency",
    question:
      "Design a rate limiter for an API gateway handling 100k requests/sec. Which algorithm would you pick (Token Bucket vs Sliding Window) and how do you handle distributed consistency?",
    expectedConcepts: [
      "token bucket burst handling",
      "Redis atomic Lua script",
      "race condition prevention",
      "low latency P99",
      "horizontal sharding",
    ],
    sampleStarter:
      "I would use a Token Bucket algorithm to allow controlled short bursts while enforcing a steady refill rate. In a distributed API gateway, counters live in sharded Redis clusters updated via atomic Lua scripts to eliminate race conditions while keeping P99 latency under 2ms.",
  },
];

export function InterviewBossDuel() {
  const { progress, recordInterviewShield } = useNexus();
  const [shieldsState, setShieldsState] = useState<BossShield[]>(SHIELDS);
  const [activeShieldIdx, setActiveShieldIdx] = useState(0);
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatingQuestion, setGeneratingQuestion] = useState(false);
  const [questionSources, setQuestionSources] = useState<Record<number, "default" | "gemini" | "local">>({});
  const [result, setResult] = useState<InterviewEvalResult | null>(null);
  const seenQuestionsRef = useRef<Record<number, string[]>>({
    1: [SHIELDS[0].question],
    2: [SHIELDS[1].question],
    3: [SHIELDS[2].question],
  });

  const shield = shieldsState[activeShieldIdx];
  const clearedIds = progress.interviewShieldsCleared;

  const handleNewQuestion = async () => {
    if (generatingQuestion || loading) return;
    setGeneratingQuestion(true);
    try {
      const prevList = seenQuestionsRef.current[shield.id] ?? [shield.question];
      const fresh = await generateInterviewQuestion({
        shieldId: shield.id,
        stage: shield.stage,
        difficulty: shield.difficulty,
        previousQuestions: prevList,
      });

      seenQuestionsRef.current[shield.id] = [...prevList, fresh.question].slice(-12);
      setShieldsState((prev) =>
        prev.map((s) =>
          s.id === shield.id
            ? {
                ...s,
                question: fresh.question,
                expectedConcepts: fresh.expectedConcepts,
                sampleStarter: fresh.sampleStarter,
              }
            : s
        )
      );
      setQuestionSources((prev) => ({ ...prev, [shield.id]: fresh.source }));
      setAnswer("");
      setResult(null);
    } finally {
      setGeneratingQuestion(false);
    }
  };

  const handleEvaluate = async () => {
    if (!answer.trim() || loading) return;
    setLoading(true);
    try {
      const evalRes = await evaluateInterviewAnswer({
        shield: shield.stage,
        question: shield.question,
        expectedConcepts: shield.expectedConcepts,
        userAnswer: answer,
      });
      setResult(evalRes);

      const xpEarned = Math.round(evalRes.overallScore * 2.5);
      if (evalRes.overallScore >= 60) {
        recordInterviewShield(shield.id, evalRes.overallScore, xpEarned);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Boss Header & 3-Shield Selector */}
      <div className="nexus-panel rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/40 text-[#EF4444] flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-mono text-[#EF4444]">BOSS ENCOUNTER · STAFF INTERVIEWER</p>
            <h2 className="text-xl font-bold text-[#F4F7FB]">TITAN-SYS ARCHITECT</h2>
            <p className="text-xs text-[#94A3B8]">
              Break all 3 technical shields (Score ≥ 60/100 per shield) evaluated by Gemini AI.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {SHIELDS.map((s, idx) => {
            const cleared = clearedIds.includes(s.id);
            const active = idx === activeShieldIdx;
            return (
              <button
                key={s.id}
                onClick={() => {
                  setActiveShieldIdx(idx);
                  setAnswer("");
                  setResult(null);
                }}
                className={`px-3.5 py-2 rounded-xl border text-xs font-mono transition-colors inline-flex items-center gap-2 cursor-pointer ${
                  active
                    ? "bg-[#8B5CF6] text-white border-[#8B5CF6] font-bold"
                    : cleared
                    ? "bg-[#10B981]/15 border-[#10B981]/45 text-[#6EE7B7]"
                    : "bg-[#0B0F18] border-white/10 text-[#94A3B8] hover:text-white"
                }`}
              >
                {cleared ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                Shield {s.id}
              </button>
            );
          })}
        </div>
      </div>

      {/* Arena Split: Prompt + Input on Left, Rubric Evaluation on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <div className="nexus-panel rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="text-[#8B5CF6] font-semibold">{shield.stage}</span>
              <span className="text-[#94A3B8]">· {shield.difficulty}</span>
            </div>
            <div className="flex items-center gap-2">
              {questionSources[shield.id] && (
                <span className="text-[11px] text-[#00F5D4]">
                  {questionSources[shield.id] === "gemini" ? "Gemini AI" : "Fresh Prompt"}
                </span>
              )}
              <button
                type="button"
                onClick={handleNewQuestion}
                disabled={generatingQuestion || loading}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-[#CBD5E1] hover:text-[#00F5D4] transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${generatingQuestion ? "animate-spin" : ""}`} />
                {generatingQuestion ? "Generating..." : "New Question"}
              </button>
            </div>
          </div>

          <p className="text-base font-medium text-[#F4F7FB] leading-relaxed">{shield.question}</p>

          <textarea
            rows={7}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Write your structured technical defense here (include mechanisms, complexity bounds, and trade-offs)..."
            className="w-full rounded-xl bg-[#090C14] border border-white/10 focus:border-[#00F5D4] focus:outline-none p-4 text-sm text-[#F4F7FB] placeholder:text-[#64748B] resize-y"
          />

          <VoiceTextControls
            value={answer}
            onChange={setAnswer}
            contextHint={`Technical interview answer for ${shield.difficulty}`}
            speakLabel="Speak Defense"
            uploadLabel="Upload Voice Answer"
            disabled={loading || generatingQuestion}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setAnswer(shield.sampleStarter)}
              className="text-xs font-mono text-[#94A3B8] hover:text-[#00F5D4] underline underline-offset-4 cursor-pointer"
            >
              Load Sample Strong Defense (Demo)
            </button>

            <button
              onClick={handleEvaluate}
              disabled={loading || !answer.trim()}
              className="px-5 py-2.5 rounded-xl bg-[#00F5D4] hover:bg-[#00DFC0] text-[#06080E] text-xs font-bold inline-flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              {loading ? "Evaluating Defense..." : "Submit to TITAN-SYS"}
            </button>
          </div>
        </div>

        {/* Evaluation Output Panel */}
        <div className="nexus-panel rounded-2xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#F4F7FB] inline-flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#00F5D4]" />
              Interviewer Rubric Report
            </h3>
            {result && (
              <span className="text-[11px] font-mono text-[#94A3B8]">
                Engine: {result.source === "gemini" ? "Gemini AI" : "Local Rubric"}
              </span>
            )}
          </div>

          {!result ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-sm text-[#94A3B8]">
                Submit your technical response to receive structured scoring on Correctness,
                Technical Depth, Clarity, and Missing Concepts.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2.5 font-mono tabular-nums">
                <div className="rounded-xl bg-[#090C14] border border-white/[0.07] p-3 text-center">
                  <span className="text-[10px] text-[#94A3B8] block">OVERALL</span>
                  <span
                    className={`text-xl font-bold ${
                      result.overallScore >= 60 ? "text-[#00F5D4]" : "text-[#EF4444]"
                    }`}
                  >
                    {result.overallScore}
                  </span>
                </div>
                <div className="rounded-xl bg-[#090C14] border border-white/[0.07] p-3 text-center">
                  <span className="text-[10px] text-[#94A3B8] block">CORRECT</span>
                  <span className="text-base font-bold text-[#F4F7FB]">{result.correctness}%</span>
                </div>
                <div className="rounded-xl bg-[#090C14] border border-white/[0.07] p-3 text-center">
                  <span className="text-[10px] text-[#94A3B8] block">DEPTH</span>
                  <span className="text-base font-bold text-[#F4F7FB]">
                    {result.technicalDepth}%
                  </span>
                </div>
                <div className="rounded-xl bg-[#090C14] border border-white/[0.07] p-3 text-center">
                  <span className="text-[10px] text-[#94A3B8] block">CLARITY</span>
                  <span className="text-base font-bold text-[#F4F7FB]">{result.clarity}%</span>
                </div>
              </div>

              <div className="rounded-xl bg-[#111624] border border-white/[0.08] p-4 space-y-1.5">
                <p className="text-xs font-mono text-[#00F5D4]">
                  {result.overallScore >= 60 ? "SHIELD SHATTERED · PASS" : "SHIELD HELD · RETRY"}
                </p>
                <p className="text-xs text-[#CBD5E1] leading-relaxed">{result.explanation}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-mono text-[#F59E0B]">MISSING OR UNDER-DEVELOPED CONCEPTS</p>
                <ul className="space-y-1 text-xs text-[#CBD5E1] list-disc list-inside">
                  {result.missingConcepts.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-mono text-[#8B5CF6]">IMPROVEMENT SUGGESTIONS</p>
                <ul className="space-y-1 text-xs text-[#CBD5E1] list-disc list-inside">
                  {result.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>

              {result.overallScore >= 60 && activeShieldIdx < SHIELDS.length - 1 && (
                <button
                  onClick={() => {
                    setActiveShieldIdx((i) => i + 1);
                    setAnswer("");
                    setResult(null);
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-bold cursor-pointer"
                >
                  Advance to Shield {activeShieldIdx + 2} →
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
