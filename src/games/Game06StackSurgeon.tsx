import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { GameHudLayout, LevelCompletePayload } from "../components/GameHudLayout";
import {
  addNexusLighting,
  attachStudioEnvironment,
  createLoopScheduler,
  createNexusRenderer,
  createTextSprite,
  disposeScene,
} from "../three/threeUtils";
import {
  CelebrationBurstHandle,
  OrbitRigHandle,
  createBloomComposer,
  createCelebrationBurst,
  createOrbitRig,
} from "../three/sceneEnhancements";
import { requestAiHint, requestAiIntuition } from "../services/aiService";
import { tutorVoice } from "../services/tutorVoice";
import { useNexus } from "../store/useNexusStore";

interface StackFrameDef {
  id: string;
  fnName: string;
  locals: string;
  status: "normal" | "bug" | "base";
}

interface PythonLevel {
  level: number;
  title: string;
  codeSnippet: string;
  objective: string;
  frames: StackFrameDef[];
  options: { id: string; label: string }[];
  correctOptionId: string;
  hint: string;
  conceptTitle: string;
  conceptExplanation: string;
}

const LEVELS: PythonLevel[] = [
  {
    level: 1,
    title: "Trace Recursive Call-Stack Unwind",
    codeSnippet: "def fact(n): return 1 if n<=1 else n*fact(n-1)",
    objective:
      "Inspect the 3D Call-Stack Tower for fact(4). Click frames in 3D to check locals, then select the exact return value emitted by frame fact(3) during unwind.",
    frames: [
      { id: "f1", fnName: "fact(4)", locals: "n=4 · awaits fact(3)", status: "normal" },
      { id: "f2", fnName: "fact(3)", locals: "n=3 · awaits fact(2)", status: "normal" },
      { id: "f3", fnName: "fact(2)", locals: "n=2 · awaits fact(1)", status: "normal" },
      { id: "f4", fnName: "fact(1)", locals: "n=1 · BASE → returns 1", status: "base" },
    ],
    options: [
      { id: "2", label: "Returns 2" },
      { id: "6", label: "Returns 6" },
      { id: "12", label: "Returns 12" },
      { id: "24", label: "Returns 24" },
    ],
    correctOptionId: "6",
    hint: "Unwind from the top of the tower: fact(1)=1 → fact(2)=2*1=2 → fact(3)=3*2=6.",
    conceptTitle: "LIFO Call-Stack Execution & Recursive Unwinding",
    conceptExplanation:
      "Python pushes a new stack frame per recursive call in Last-In-First-Out (LIFO) order. Once fact(1) hits the base case, frames pop sequentially: 1 → 2 → 6 → 24.",
  },
  {
    level: 2,
    title: "Halt Infinite RecursionError",
    codeSnippet: "def countdown(n): return n + countdown(n-1)",
    objective:
      "The 3D Call-Stack Tower is overflowing past n=0 into negative frames! Select the surgical base-case patch to terminate recursion safely.",
    frames: [
      { id: "f1", fnName: "countdown(2)", locals: "n=2", status: "normal" },
      { id: "f2", fnName: "countdown(1)", locals: "n=1", status: "normal" },
      { id: "f3", fnName: "countdown(0)", locals: "n=0 · NO BASE CASE!", status: "bug" },
      { id: "f4", fnName: "countdown(-1)", locals: "n=-1 · OVERFLOW!", status: "bug" },
    ],
    options: [
      { id: "base0", label: "if n <= 0: return 0" },
      { id: "inc", label: "return n + countdown(n+1)" },
      { id: "pass", label: "if n == 0: pass" },
      { id: "none", label: "return None" },
    ],
    correctOptionId: "base0",
    hint: "To stop recursion at n=0 while keeping integer addition valid, return 0 when n <= 0.",
    conceptTitle: "Base Cases & Python RecursionError Prevention",
    conceptExplanation:
      "CPython enforces a recursion depth limit (default 1000). Without a terminating base case like `if n <= 0: return 0`, frames accumulate until RecursionError is raised.",
  },
  {
    level: 3,
    title: "Patch Mutable Default Argument Bug",
    codeSnippet: "def push_item(x, buf=[]): buf.append(x); return buf",
    objective:
      "Two separate calls push_item(1) and push_item(2) unexpectedly share the SAME heap list [1, 2]. Choose the Pythonic fix to isolate each stack frame.",
    frames: [
      { id: "f1", fnName: "push_item(1)", locals: "buf → heap@0x9A [1]", status: "normal" },
      { id: "f2", fnName: "push_item(2)", locals: "buf → heap@0x9A [1,2] BUG", status: "bug" },
    ],
    options: [
      { id: "none_init", label: "def push_item(x, buf=None): buf = [] if buf is None else buf" },
      { id: "tuple_mut", label: "def push_item(x, buf=()): buf.append(x)" },
      { id: "global_buf", label: "global buf; buf = []" },
      { id: "copy_later", label: "return buf" },
    ],
    correctOptionId: "none_init",
    hint: "Python evaluates default arguments once at function definition time. Use buf=None as the default and allocate a fresh [] inside the function.",
    conceptTitle: "Python Mutable Default Argument Trap",
    conceptExplanation:
      "Default parameter objects are bound once when `def` executes, not per call. Using `buf=None` and initializing `buf = []` inside the body guarantees a fresh list per stack frame.",
  },
];

interface Game06StackSurgeonProps {
  onExit: () => void;
}

export function Game06StackSurgeon({ onExit }: Game06StackSurgeonProps) {
  const { recordLevelComplete, voiceEnabled } = useNexus();
  const voiceRef = useRef(voiceEnabled);
  voiceRef.current = voiceEnabled;

  const mountRef = useRef<HTMLDivElement>(null);
  const orbitRigRef = useRef<OrbitRigHandle | null>(null);
  const burstRef = useRef<CelebrationBurstHandle | null>(null);

  const [levelIdx, setLevelIdx] = useState(0);
  const currentLevel = LEVELS[levelIdx];

  const [selectedOpt, setSelectedOpt] = useState<string | null>(null);
  const [inspectedFrame, setInspectedFrame] = useState<string>(LEVELS[0].frames[0].id);

  const [elapsed, setElapsed] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [hintText, setHintText] = useState<string | null>(null);
  const [hintSource, setHintSource] = useState<"gemini" | "local">("local");
  const [hintLoading, setHintLoading] = useState(false);
  const [intuition, setIntuition] = useState(
    "Click any floating 3D stack frame slab to inspect its local scope, then apply your diagnostic patch."
  );
  const [feedback, setFeedback] = useState<{ type: "error" | "info" | "success"; text: string } | null>(
    null
  );
  const [completion, setCompletion] = useState<LevelCompletePayload | null>(null);

  const stateRef = useRef({ levelIdx, inspectedFrame, patched: Boolean(completion) });
  stateRef.current = { levelIdx, inspectedFrame, patched: Boolean(completion) };

  const loadLevel = useCallback((idx: number) => {
    tutorVoice.cancel();
    const lvl = LEVELS[idx];
    setLevelIdx(idx);
    setSelectedOpt(null);
    setInspectedFrame(lvl.frames[0].id);
    setElapsed(0);
    setHintText(null);
    setFeedback(null);
    setCompletion(null);
    setIntuition(`Loaded Level ${lvl.level}: ${lvl.codeSnippet}`);
  }, []);

  useEffect(() => {
    if (completion) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [completion]);

  const inspectFrame = useCallback(
    (frameId: string) => {
      setInspectedFrame(frameId);
      const fr = currentLevel.frames.find((f) => f.id === frameId);
      if (fr) {
        const msg = `Inspected ${fr.fnName} — locals: ${fr.locals}`;
        setIntuition(msg);
        requestAiIntuition({
          gameTitle: "Stack-Frame Surgeon 3D",
          subject: "PCC-CS393 Python / IT Workshop Lab",
          action: `Inspected stack frame ${fr.fnName} (${fr.locals})`,
          stateSummary: currentLevel.codeSnippet,
          fallbackIntuition: msg,
        }).then((r) => setIntuition(r.text));
      }
    },
    [currentLevel]
  );

  const inspectRef = useRef(inspectFrame);
  inspectRef.current = inspectFrame;

  // Dedicated 3D Python Call-Stack Tower Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06080e);
    scene.fog = new THREE.FogExp2(0x06080e, 0.022);

    const camera = new THREE.PerspectiveCamera(
      46,
      Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1),
      0.1,
      200
    );
    camera.position.set(6.5, 6.2, 13.5);

    const { renderer, isSoftwareGl } = createNexusRenderer(container);
    const envTex = attachStudioEnvironment(renderer, scene);
    addNexusLighting(scene);

    const orbitRig = createOrbitRig(camera, renderer.domElement, {
      initialPosition: new THREE.Vector3(6.5, 6.2, 13.5),
      initialTarget: new THREE.Vector3(0, 2.2, 0),
      minDistance: 6,
      maxDistance: 28,
    });
    orbitRigRef.current = orbitRig;

    const composer = createBloomComposer(renderer, scene, camera, isSoftwareGl, container);
    const burst = createCelebrationBurst(scene);
    burstRef.current = burst;

    const grid = new THREE.GridHelper(32, 32, 0xec4899, 0x162033);
    grid.position.y = -1.2;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.25;
    scene.add(grid);

    // Central call-stack spine rod
    const spine = new THREE.Mesh(
      new THREE.CylinderGeometry(0.14, 0.14, 10, 12),
      new THREE.MeshStandardMaterial({
        color: 0xec4899,
        emissive: 0xec4899,
        emissiveIntensity: 0.45,
      })
    );
    spine.position.set(0, 3.6, 0);
    scene.add(spine);

    const dynamicGroup = new THREE.Group();
    scene.add(dynamicGroup);
    const clickables: THREE.Object3D[] = [];
    const slabGroups: THREE.Group[] = [];
    let lastKey = "";

    function rebuildTower() {
      while (dynamicGroup.children.length > 0) dynamicGroup.remove(dynamicGroup.children[0]);
      clickables.length = 0;
      slabGroups.length = 0;

      const lvl = LEVELS[stateRef.current.levelIdx];
      const activeId = stateRef.current.inspectedFrame;
      const isPatched = stateRef.current.patched;

      lvl.frames.forEach((fr, idx) => {
        const g = new THREE.Group();
        const yPos = 0.2 + idx * 1.95;
        g.position.set(0, yPos, 0);

        const isSelected = fr.id === activeId;
        const baseColor = isPatched
          ? 0x00f5d4
          : fr.status === "bug"
          ? 0xef4444
          : fr.status === "base"
          ? 0x10b981
          : 0xec4899;

        const slab = new THREE.Mesh(
          new THREE.BoxGeometry(6.2, 0.9, 3.2),
          new THREE.MeshStandardMaterial({
            color: isSelected ? 0x1e293b : 0x121726,
            metalness: 0.72,
            roughness: 0.22,
            emissive: baseColor,
            emissiveIntensity: isSelected ? 0.45 : 0.18,
          })
        );
        slab.userData = { frameId: fr.id };
        g.add(slab);
        clickables.push(slab);

        const wire = new THREE.LineSegments(
          new THREE.WireframeGeometry(new THREE.BoxGeometry(6.35, 1.0, 3.35)),
          new THREE.LineBasicMaterial({ color: baseColor, transparent: true, opacity: isSelected ? 0.9 : 0.45 })
        );
        g.add(wire);

        const lbl = createTextSprite(`${fr.fnName}  |  ${fr.locals}`, {
          border: isSelected ? "#00F5D4" : fr.status === "bug" ? "#EF4444" : "#EC4899",
          color: "#F4F7FB",
          width: 520,
          height: 76,
          fontSize: 22,
        });
        lbl.position.set(0, 0.05, 2.25);
        lbl.scale.set(6.2, 0.92, 1);
        g.add(lbl);

        dynamicGroup.add(g);
        slabGroups.push(g);
      });
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downPos = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => (downPos = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickables, false);
      if (hits.length > 0 && hits[0].object.userData?.frameId) {
        inspectRef.current(hits[0].object.userData.frameId);
      }
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    const onResize = () => {
      if (!container) return;
      const w = Math.max(container.clientWidth, 1);
      const h = Math.max(container.clientHeight, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.resize(w, h);
    };
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    const loop = createLoopScheduler(renderer, isSoftwareGl, () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.getElapsedTime();
      const key = JSON.stringify(stateRef.current);
      if (key !== lastKey) {
        lastKey = key;
        rebuildTower();
      }

      slabGroups.forEach((g, idx) => {
        g.rotation.y = Math.sin(t * 0.7 + idx * 0.6) * 0.08;
      });

      burst.update(dt);
      orbitRig.update(dt);
      composer.render();
    });
    loop.start();

    return () => {
      loop.stop();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      window.removeEventListener("resize", onResize);
      orbitRigRef.current = null;
      burstRef.current = null;
      burst.dispose();
      composer.dispose();
      orbitRig.dispose();
      envTex.dispose();
      disposeScene(scene, renderer);
    };
  }, []);

  const handleValidate = () => {
    if (selectedOpt === currentLevel.correctOptionId) {
      const earnedScore = Math.max(250, 500 - elapsed * 2) * combo;
      const xpEarned = 230 + currentLevel.level * 50;
      setScore((s) => s + earnedScore);
      setCombo((c) => c + 1);
      const successMsg = "Stack frame surgery verified! Execution trace is clean.";
      setFeedback({ type: "success", text: successMsg });
      setIntuition(currentLevel.conceptExplanation);
      burstRef.current?.trigger(new THREE.Vector3(0, 3.0, 0), 0xec4899);
      tutorVoice.speak(successMsg, voiceRef.current);
      recordLevelComplete("stack-surgeon", currentLevel.level, earnedScore, xpEarned);
      setCompletion({
        level: currentLevel.level,
        score: earnedScore,
        xpEarned,
        conceptTitle: currentLevel.conceptTitle,
        conceptExplanation: currentLevel.conceptExplanation,
        hasNextLevel: levelIdx < LEVELS.length - 1,
      });
    } else {
      setCombo(1);
      const errMsg = selectedOpt
        ? "That patch does not resolve the stack frame trace. Inspect the frames or trigger 3D Hint Beam."
        : "Select a diagnostic patch from the dock first.";
      setFeedback({
        type: "error",
        text: errMsg,
      });
      tutorVoice.speak(errMsg, voiceRef.current);
    }
  };

  const handleHint = async () => {
    setHintLoading(true);
    const res = await requestAiHint({
      gameTitle: "Stack-Frame Surgeon 3D",
      subject: "PCC-CS393 Python / IT Workshop Lab",
      level: currentLevel.level,
      objective: currentLevel.objective,
      gameState: { code: currentLevel.codeSnippet, selectedOpt },
      fallbackHint: currentLevel.hint,
    });
    setHintText(res.text);
    setHintSource(res.source);
    setHintLoading(false);
    tutorVoice.speak(res.text, voiceRef.current);
  };

  return (
    <GameHudLayout
      title="Stack-Frame Surgeon 3D"
      paperCode="PCC-CS393"
      subjectName="Python / IT Workshop Lab"
      accentColor="#EC4899"
      level={currentLevel.level}
      totalLevels={LEVELS.length}
      objective={currentLevel.objective}
      elapsedSeconds={elapsed}
      score={score}
      combo={combo}
      hintText={hintText}
      hintSource={hintSource}
      hintLoading={hintLoading}
      intuitionText={intuition}
      feedbackBanner={feedback}
      completion={completion}
      onSelectLevel={(lvl) => loadLevel(lvl - 1)}
      onRequestHint={handleHint}
      onReset={() => loadLevel(levelIdx)}
      onValidate={handleValidate}
      onExit={onExit}
      onNextLevel={() => loadLevel(Math.min(LEVELS.length - 1, levelIdx + 1))}
      onResetCamera={() => orbitRigRef.current?.resetCamera()}
      validateLabel="Apply Stack Patch"
      controlsSlot={
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          {currentLevel.options.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setSelectedOpt(opt.id)}
              className={`px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                selectedOpt === opt.id
                  ? "bg-[#EC4899] text-white border-[#EC4899] font-bold"
                  : "bg-[#111624] text-[#E2E8F0] border-white/10 hover:border-[#EC4899]/60"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      }
    >
      <div ref={mountRef} className="w-full h-full cursor-pointer" />
    </GameHudLayout>
  );
}
