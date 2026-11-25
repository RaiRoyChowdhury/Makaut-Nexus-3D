import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, Loader2, RotateCcw, Sparkles, Trophy, XCircle } from "lucide-react";
import { AptitudeQ, generateAptitudeQuestions } from "../../services/aiService";
import { useNexus } from "../../store/useNexusStore";

const QUESTION_BANK: AptitudeQ[] = [
  {
    id: "q1",
    category: "Quantitative",
    difficulty: "Easy",
    question: "A server processes 240 requests in 15 seconds. At the same rate, how many requests does it process in 1 minute?",
    options: ["720", "840", "960", "1080"],
    correctIdx: 2,
    explanation: "240 / 15 = 16 req/s. In 60 seconds: 16 × 60 = 960 requests.",
  },
  {
    id: "q2",
    category: "Logical",
    difficulty: "Easy",
    question: "Find the next number in the sequence: 2, 6, 12, 20, 30, ?",
    options: ["40", "42", "44", "48"],
    correctIdx: 1,
    explanation: "Differences increase by 2 each step: +4, +6, +8, +10, +12 → 30 + 12 = 42 (n(n+1)).",
  },
  {
    id: "q3",
    category: "Technical",
    difficulty: "Easy",
    question: "What is the worst-case time complexity of searching for an element in a balanced Binary Search Tree (AVL)?",
    options: ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
    correctIdx: 1,
    explanation: "AVL trees maintain height O(log n), guaranteeing O(log n) worst-case lookup.",
  },
  {
    id: "q4",
    category: "Quantitative",
    difficulty: "Medium",
    question: "Two pipes A and B can fill a tank in 12 hours and 18 hours respectively. If both are opened together, how long will they take?",
    options: ["6.8 hours", "7.2 hours", "7.5 hours", "8.0 hours"],
    correctIdx: 1,
    explanation: "Combined rate = 1/12 + 1/18 = 5/36 tank/hr. Time = 36/5 = 7.2 hours.",
  },
  {
    id: "q5",
    category: "Logical",
    difficulty: "Medium",
    question: "If all Compilers are Translators, and some Translators are Interpreters, which conclusion MUST follow?",
    options: [
      "All Compilers are Interpreters",
      "Some Compilers are Interpreters",
      "Some Translators are Compilers",
      "No Compiler is an Interpreter",
    ],
    correctIdx: 2,
    explanation: "From 'All Compilers are Translators', its valid conversion is 'Some Translators are Compilers'.",
  },
  {
    id: "q6",
    category: "Technical",
    difficulty: "Medium",
    question: "Which data structure is optimal for implementing Breadth-First Search (BFS) on an unweighted graph?",
    options: ["Stack", "Queue", "Min-Heap", "Hash Set only"],
    correctIdx: 1,
    explanation: "BFS explores vertices level by level using a FIFO Queue.",
  },
  {
    id: "q7",
    category: "Quantitative",
    difficulty: "Hard",
    question: "In how many distinct ways can the letters of the word 'ALGORITHM' be arranged if the vowels (A, O, I) must always stay together?",
    options: ["30,240", "43,200", "15,120", "120,960"],
    correctIdx: 0,
    explanation: "Treat (A,O,I) as 1 block + 6 consonants = 7! = 5040. Vowels permute in 3! = 6 ways. Total = 5040 × 6 = 30,240.",
  },
  {
    id: "q8",
    category: "Technical",
    difficulty: "Hard",
    question: "In a 5-stage pipelined CPU without forwarding, how many stall cycles occur for a back-to-back RAW hazard between ADD R1,R2,R3 and SUB R4,R1,R5?",
    options: ["0 cycles", "1 cycle", "2 cycles", "4 cycles"],
    correctIdx: 2,
    explanation: "Without forwarding, the consumer must stall in ID until the producer completes WB (2 stall bubbles in classic 5-stage MIPS with half-cycle regfile).",
  },
  {
    id: "q9",
    category: "Logical",
    difficulty: "Hard",
    question: "A 3-node Raft cluster tolerates how many simultaneous node failures while still committing writes?",
    options: ["0 failures", "1 failure", "2 failures", "3 failures"],
    correctIdx: 1,
    explanation: "Quorum requires floor(N/2) + 1 = 2 nodes alive, so a 3-node Raft cluster tolerates at most 1 failure.",
  },
];

export function AptitudeGauntlet() {
  const { recordAptitudeResult } = useNexus();
  const [difficulty, setDifficulty] = useState<"All" | "Easy" | "Medium" | "Hard">("All");
  const [questionBank, setQuestionBank] = useState<AptitudeQ[]>(QUESTION_BANK);
  const [questionSource, setQuestionSource] = useState<"default" | "gemini" | "local">("default");
  const [generating, setGenerating] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(300);
  const seenQuestionsRef = useRef<Set<string>>(new Set(QUESTION_BANK.map((q) => q.question)));

  const questions =
    difficulty === "All"
      ? questionBank
      : questionBank.filter((q) => q.difficulty === difficulty);

  const currentQ = questions[activeIdx] || questions[0];

  useEffect(() => {
    if (submitted) return;
    if (secondsLeft <= 0) {
      handleFinish();
      return;
    }
    const timer = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [submitted, secondsLeft]);

  const handleDifficultyChange = (d: "All" | "Easy" | "Medium" | "Hard") => {
    setDifficulty(d);
    setActiveIdx(0);
    setAnswers({});
    setSubmitted(false);
    setSecondsLeft(d === "All" ? 300 : 180);
  };

  const handleGenerateNew = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      const targetCount = difficulty === "All" ? 6 : 5;
      const res = await generateAptitudeQuestions({
        difficulty,
        count: targetCount,
        avoidQuestions: Array.from(seenQuestionsRef.current).slice(-24),
      });

      res.questions.forEach((q) => seenQuestionsRef.current.add(q.question));

      setQuestionBank((prev) => {
        if (difficulty === "All") {
          return res.questions;
        }
        const remaining = prev.filter((q) => q.difficulty !== difficulty);
        return [...remaining, ...res.questions];
      });
      setQuestionSource(res.source);
      setActiveIdx(0);
      setAnswers({});
      setSubmitted(false);
      setSecondsLeft(difficulty === "All" ? 300 : 180);
    } finally {
      setGenerating(false);
    }
  };

  const handleFinish = () => {
    if (submitted) return;
    setSubmitted(true);
    const correctCount = questions.reduce(
      (acc, q) => acc + (answers[q.id] === q.correctIdx ? 1 : 0),
      0
    );
    const pct = Math.round((correctCount / Math.max(1, questions.length)) * 100);
    const xp = 100 + correctCount * 35;
    recordAptitudeResult(pct, xp);
  };

  const correctCount = questions.reduce(
    (acc, q) => acc + (answers[q.id] === q.correctIdx ? 1 : 0),
    0
  );
  const scorePct = Math.round((correctCount / Math.max(1, questions.length)) * 100);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div className="space-y-6">
      {/* Controls & Timer Bar */}
      <div className="nexus-panel rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-[#94A3B8]">Difficulty:</span>
          {(["All", "Easy", "Medium", "Hard"] as const).map((d) => (
            <button
              key={d}
              onClick={() => handleDifficultyChange(d)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                difficulty === d
                  ? "bg-[#00F5D4] text-[#06080E] font-bold"
                  : "bg-[#111624] text-[#CBD5E1] hover:text-white"
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono text-xs tabular-nums">
          <button
            onClick={handleGenerateNew}
            disabled={generating}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8B5CF6]/20 border border-[#8B5CF6]/50 text-[#DDD6FE] hover:bg-[#8B5CF6]/35 hover:text-white transition-colors disabled:opacity-60 cursor-pointer"
          >
            {generating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-[#00F5D4]" />
            )}
            {generating ? "Generating..." : "Generate New Questions"}
          </button>
          <span className="inline-flex items-center gap-1.5 text-[#F59E0B]">
            <Clock className="w-4 h-4" />
            {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
          </span>
          <span className="text-[#94A3B8]">
            Answered: {Object.keys(answers).length}/{questions.length}
          </span>
          <button
            onClick={() => handleDifficultyChange(difficulty)}
            className="inline-flex items-center gap-1 text-[#94A3B8] hover:text-[#00F5D4] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Restart
          </button>
        </div>
      </div>

      {/* Main Split: Question Card + Question Navigator */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="nexus-panel rounded-2xl p-6 lg:col-span-2 space-y-6">
          {submitted ? (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-[#00F5D4]/15 text-[#00F5D4] flex items-center justify-center">
                  <Trophy className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-mono text-[#00F5D4]">GAUNTLET COMPLETED</p>
                  <h3 className="text-2xl font-bold text-[#F4F7FB] font-mono tabular-nums">
                    {correctCount} / {questions.length} Correct ({scorePct}%)
                  </h3>
                </div>
              </div>

              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {questions.map((q, i) => {
                  const picked = answers[q.id];
                  const ok = picked === q.correctIdx;
                  return (
                    <div
                      key={q.id}
                      className={`rounded-xl p-4 border ${
                        ok
                          ? "bg-[#0D281E]/40 border-[#10B981]/40"
                          : "bg-[#2A1215]/40 border-[#EF4444]/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-[#F4F7FB]">
                          Q{i + 1}. {q.question}
                        </p>
                        {ok ? (
                          <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-[#EF4444] shrink-0" />
                        )}
                      </div>
                      <p className="mt-1.5 text-xs text-[#94A3B8]">
                        Correct: <span className="text-[#00F5D4]">{q.options[q.correctIdx]}</span> —{" "}
                        {q.explanation}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => handleDifficultyChange(difficulty)}
                  className="px-5 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-[#F4F7FB] text-xs font-semibold cursor-pointer"
                >
                  Retake Current Set
                </button>
                <button
                  onClick={handleGenerateNew}
                  disabled={generating}
                  className="px-5 py-2.5 rounded-xl bg-[#00F5D4] hover:bg-[#00DFC0] text-[#06080E] text-xs font-bold inline-flex items-center gap-2 disabled:opacity-60 cursor-pointer"
                >
                  {generating ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {generating ? "Generating Fresh Set..." : "Generate New Questions"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-[#00F5D4]">
                  {currentQ.category} · {currentQ.difficulty}
                </span>
                <span className="text-[#94A3B8]">
                  Question {activeIdx + 1} of {questions.length}
                </span>
              </div>

              <h3 className="text-lg font-semibold text-[#F4F7FB] leading-relaxed">
                {currentQ.question}
              </h3>

              <div className="space-y-2.5">
                {currentQ.options.map((opt, idx) => {
                  const selected = answers[currentQ.id] === idx;
                  return (
                    <button
                      key={opt}
                      onClick={() => setAnswers((prev) => ({ ...prev, [currentQ.id]: idx }))}
                      className={`w-full text-left px-4 py-3.5 rounded-xl border text-sm transition-colors cursor-pointer flex items-center gap-3 ${
                        selected
                          ? "bg-[#00F5D4]/15 border-[#00F5D4] text-[#F4F7FB] font-medium"
                          : "bg-[#0B0F18] border-white/[0.08] text-[#CBD5E1] hover:border-white/25"
                      }`}
                    >
                      <span className="font-mono text-xs text-[#94A3B8]">
                        {String.fromCharCode(65 + idx)}.
                      </span>
                      <span>{opt}</span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-white/[0.07]">
                <button
                  disabled={activeIdx === 0}
                  onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
                  className="px-4 py-2 rounded-lg bg-white/[0.06] text-xs font-medium text-[#CBD5E1] disabled:opacity-40 cursor-pointer"
                >
                  ← Previous
                </button>
                <div className="flex items-center gap-2">
                  {activeIdx < questions.length - 1 ? (
                    <button
                      onClick={() => setActiveIdx((i) => Math.min(questions.length - 1, i + 1))}
                      className="px-4 py-2 rounded-lg bg-[#8B5CF6] text-white text-xs font-semibold cursor-pointer"
                    >
                      Next →
                    </button>
                  ) : null}
                  <button
                    onClick={handleFinish}
                    className="px-4 py-2 rounded-lg bg-[#00F5D4] text-[#06080E] text-xs font-bold cursor-pointer"
                  >
                    Submit Assessment
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Question Palette */}
        <div className="nexus-panel rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-[#F4F7FB]">Question Navigator</h4>
            <span className="text-[11px] font-mono text-[#94A3B8]">
              {questionSource === "gemini"
                ? "Gemini AI Set"
                : questionSource === "local"
                ? "Adaptive Set"
                : "Core Bank"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 font-mono text-xs">
            {questions.map((q, idx) => {
              const answered = answers[q.id] !== undefined;
              const isCurrent = idx === activeIdx && !submitted;
              return (
                <button
                  key={q.id}
                  onClick={() => {
                    if (!submitted) setActiveIdx(idx);
                  }}
                  className={`py-2.5 rounded-lg border transition-colors cursor-pointer ${
                    isCurrent
                      ? "bg-[#00F5D4] text-[#06080E] border-[#00F5D4] font-bold"
                      : answered
                      ? "bg-[#8B5CF6]/25 border-[#8B5CF6]/50 text-[#DDD6FE]"
                      : "bg-[#0B0F18] border-white/[0.08] text-[#94A3B8]"
                  }`}
                >
                  Q{idx + 1}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            Covers TCS NQT, Infosys SP, and product-company technical screening topics aligned with
            MAKAUT B.Tech IT fundamentals.
          </p>
        </div>
      </div>
    </div>
  );
}
