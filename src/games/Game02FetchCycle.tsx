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

interface CpuLevel {
  level: number;
  title: string;
  objective: string;
  availableTokens: string[];
  slots: string[];
  initialSlots: (string | null)[];
  forwardingAvailable?: boolean;
  validate: (slots: (string | null)[], forwarding: boolean) => {
    ok: boolean;
    message: string;
    registers: { PC: string; R1: number; R2: number; R3: number };
  };
  hint: string;
  conceptTitle: string;
  conceptExplanation: string;
}

const LEVELS: CpuLevel[] = [
  {
    level: 1,
    title: "Basic Fetch-Decode-Execute Cycle",
    objective:
      "Route the instruction micro-operations into the 3 CPU chambers in strict architectural order: Stage 1 (IF) → Stage 2 (ID) → Stage 3 (EX).",
    availableTokens: ["FETCH [PC→IR]", "DECODE [OPCODE]", "EXECUTE [ALU]"],
    slots: ["Stage 1 · IF", "Stage 2 · ID", "Stage 3 · EX"],
    initialSlots: ["EXECUTE [ALU]", null, "FETCH [PC→IR]"],
    validate: (slots) => {
      if (
        slots[0] === "FETCH [PC→IR]" &&
        slots[1] === "DECODE [OPCODE]" &&
        slots[2] === "EXECUTE [ALU]"
      ) {
        return {
          ok: true,
          message: "Instruction cycle executed cleanly! PC incremented and ALU output latched.",
          registers: { PC: "0x04", R1: 14, R2: 0, R3: 14 },
        };
      }
      return {
        ok: false,
        message: "Pipeline violation! A CPU must Fetch from memory, Decode the opcode, then Execute in ALU.",
        registers: { PC: "0x00", R1: 0, R2: 0, R3: 0 },
      };
    },
    hint: "Place FETCH [PC→IR] in Stage 1 (IF), DECODE [OPCODE] in Stage 2 (ID), and EXECUTE [ALU] in Stage 3 (EX).",
    conceptTitle: "Von Neumann Instruction Cycle (IF → ID → EX)",
    conceptExplanation:
      "Every CPU instruction begins by fetching the binary word at the Program Counter (PC) into the Instruction Register (IR), decoding its control signals, and executing inside the ALU.",
  },
  {
    level: 2,
    title: "Resolve RAW Data Hazard (Stall or Forward)",
    objective:
      "I1: ADD R1, R2, R3 writes R1; I2: SUB R4, R1, R5 reads R1 immediately. Prevent a Read-After-Write (RAW) hazard by inserting a NOP bubble between I1 and I2 (or enable ALU Forwarding).",
    availableTokens: ["I1: ADD R1,R2,R3", "NOP (Stall)", "I2: SUB R4,R1,R5"],
    slots: ["Cycle T1", "Cycle T2", "Cycle T3"],
    initialSlots: ["I1: ADD R1,R2,R3", "I2: SUB R4,R1,R5", null],
    forwardingAvailable: true,
    validate: (slots, forwarding) => {
      const hasI1 = slots[0] === "I1: ADD R1,R2,R3";
      const safeStall =
        hasI1 && slots[1] === "NOP (Stall)" && slots[2] === "I2: SUB R4,R1,R5";
      const safeForward =
        hasI1 && forwarding && slots[1] === "I2: SUB R4,R1,R5";
      if (safeStall || safeForward) {
        return {
          ok: true,
          message: safeForward
            ? "ALU Forwarding bypassed the writeback stage with zero stall cycles!"
            : "NOP bubble resolved the RAW hazard safely!",
          registers: { PC: "0x08", R1: 12, R2: 7, R3: 5 },
        };
      }
      return {
        ok: false,
        message:
          "RAW Hazard detected! I2 is reading stale R1 before I1 writes back. Insert NOP in T2 or toggle ALU Forwarding.",
        registers: { PC: "0x04", R1: 0, R2: 7, R3: 5 },
      };
    },
    hint: "Either place NOP (Stall) in Cycle T2 and I2 in Cycle T3, OR toggle ALU Forwarding ON so I1's result feeds directly into I2.",
    conceptTitle: "Read-After-Write (RAW) Data Hazards & Forwarding",
    conceptExplanation:
      "A RAW hazard occurs when a dependent instruction reads a register before a prior instruction writes its result. Pipelines resolve this via NOP stall bubbles or EX-to-EX data forwarding paths.",
  },
  {
    level: 3,
    title: "Superscalar Register Arithmetic Pipeline",
    objective:
      "Order the 3 assembly instructions so R1 and R2 are loaded BEFORE computing ADD R3, R1, R2 (target R3 = 8).",
    availableTokens: ["MOV R1, 5", "MOV R2, 3", "ADD R3, R1, R2"],
    slots: ["Slot 1 (PC 0x00)", "Slot 2 (PC 0x04)", "Slot 3 (PC 0x08)"],
    initialSlots: ["ADD R3, R1, R2", "MOV R1, 5", "MOV R2, 3"],
    validate: (slots) => {
      const loadsFirst =
        (slots[0] === "MOV R1, 5" && slots[1] === "MOV R2, 3") ||
        (slots[0] === "MOV R2, 3" && slots[1] === "MOV R1, 5");
      if (loadsFirst && slots[2] === "ADD R3, R1, R2") {
        return {
          ok: true,
          message: "Pipeline committed! R1=5, R2=3, R3=8 verified in Register File.",
          registers: { PC: "0x0C", R1: 5, R2: 3, R3: 8 },
        };
      }
      return {
        ok: false,
        message: "Dependency error: ADD R3, R1, R2 must execute AFTER both MOV R1 and MOV R2.",
        registers: { PC: "0x00", R1: 0, R2: 0, R3: 0 },
      };
    },
    hint: "Place MOV R1, 5 and MOV R2, 3 in Slots 1 and 2 (either order), and ADD R3, R1, R2 in Slot 3.",
    conceptTitle: "Instruction Dependency Ordering & Register File Integrity",
    conceptExplanation:
      "Correct program semantics require producer instructions (MOV loads) to commit before consumer ALU instructions (ADD) read the target architectural registers.",
  },
];

interface Game02FetchCycleProps {
  onExit: () => void;
}

export function Game02FetchCycle({ onExit }: Game02FetchCycleProps) {
  const { recordLevelComplete, voiceEnabled } = useNexus();
  const voiceRef = useRef(voiceEnabled);
  voiceRef.current = voiceEnabled;

  const mountRef = useRef<HTMLDivElement>(null);
  const orbitRigRef = useRef<OrbitRigHandle | null>(null);
  const burstRef = useRef<CelebrationBurstHandle | null>(null);

  const [levelIdx, setLevelIdx] = useState(0);
  const currentLevel = LEVELS[levelIdx];

  const [slots, setSlots] = useState<(string | null)[]>([...LEVELS[0].initialSlots]);
  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [forwarding, setForwarding] = useState(false);
  const [registers, setRegisters] = useState({ PC: "0x00", R1: 0, R2: 7, R3: 5 });
  const [pulseWave, setPulseWave] = useState(false);

  const [elapsed, setElapsed] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [hintText, setHintText] = useState<string | null>(null);
  const [hintSource, setHintSource] = useState<"gemini" | "local">("local");
  const [hintLoading, setHintLoading] = useState(false);
  const [intuition, setIntuition] = useState(
    "Select an instruction token below, then click a 3D CPU chamber or slot button to assign it."
  );
  const [feedback, setFeedback] = useState<{ type: "error" | "info" | "success"; text: string } | null>(
    null
  );
  const [completion, setCompletion] = useState<LevelCompletePayload | null>(null);

  const stateRef = useRef({ levelIdx, slots, forwarding, pulseWave, registers });
  stateRef.current = { levelIdx, slots, forwarding, pulseWave, registers };

  const loadLevel = useCallback((idx: number) => {
    tutorVoice.cancel();
    const lvl = LEVELS[idx];
    setLevelIdx(idx);
    setSlots([...lvl.initialSlots]);
    setSelectedToken(null);
    setForwarding(false);
    setPulseWave(false);
    setRegisters({ PC: "0x00", R1: 0, R2: 7, R3: 5 });
    setElapsed(0);
    setHintText(null);
    setFeedback(null);
    setCompletion(null);
    setIntuition(`Loaded Level ${lvl.level}: ${lvl.title}. Click a token and place it in a CPU stage.`);
  }, []);

  useEffect(() => {
    if (completion) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [completion]);

  const assignSlot = useCallback(
    (slotIdx: number, token?: string) => {
      const tok = token ?? selectedToken;
      if (!tok) {
        setFeedback({ type: "info", text: "Pick an instruction token from the dock first." });
        return;
      }
      setSlots((prev) => {
        const next = [...prev];
        // Clear duplicate if present unless NOP
        if (!tok.startsWith("NOP")) {
          const existingIdx = next.indexOf(tok);
          if (existingIdx !== -1) next[existingIdx] = null;
        }
        next[slotIdx] = tok;
        return next;
      });
      setSelectedToken(null);
      const stageX = [-6.2, -1.5, 3.2][slotIdx] ?? 0;
      burstRef.current?.trigger(new THREE.Vector3(stageX, 0.8, 0), 0x38bdf8);
      setFeedback({ type: "info", text: `Loaded "${tok}" into ${currentLevel.slots[slotIdx]}.` });

      const fallbackMsg = `Assigned ${tok} to ${currentLevel.slots[slotIdx]}; clock edge will latch this micro-op into the pipeline register.`;
      setIntuition(fallbackMsg);
      requestAiIntuition({
        gameTitle: "Ghost in the Fetch Cycle",
        subject: "PCC-CS302 Computer Organization & Architecture",
        action: `Placed ${tok} into ${currentLevel.slots[slotIdx]}`,
        stateSummary: JSON.stringify({ slots, forwarding }),
        fallbackIntuition: fallbackMsg,
      }).then((res) => setIntuition(res.text));
    },
    [selectedToken, currentLevel.slots, slots, forwarding]
  );

  const assignRef = useRef(assignSlot);
  assignRef.current = assignSlot;

  // Dedicated 3D Superscalar CPU Processor Chamber Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06080e);
    scene.fog = new THREE.FogExp2(0x06080e, 0.02);

    const camera = new THREE.PerspectiveCamera(
      46,
      Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1),
      0.1,
      200
    );
    camera.position.set(0, 8.2, 15.5);

    const { renderer, isSoftwareGl } = createNexusRenderer(container);
    const envTex = attachStudioEnvironment(renderer, scene);
    addNexusLighting(scene);

    const orbitRig = createOrbitRig(camera, renderer.domElement, {
      initialPosition: new THREE.Vector3(0, 8.2, 15.5),
      initialTarget: new THREE.Vector3(0, 0.8, 0),
      minDistance: 6,
      maxDistance: 30,
    });
    orbitRigRef.current = orbitRig;

    const composer = createBloomComposer(renderer, scene, camera, isSoftwareGl, container);
    const burst = createCelebrationBurst(scene);
    burstRef.current = burst;

    // Motherboard substrate plane
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(22, 0.4, 12),
      new THREE.MeshStandardMaterial({ color: 0x0d1320, metalness: 0.7, roughness: 0.4 })
    );
    board.position.y = -1.6;
    scene.add(board);

    const grid = new THREE.GridHelper(32, 32, 0x38bdf8, 0x162033);
    grid.position.y = -1.38;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.25;
    scene.add(grid);

    // Bus rails connecting chambers
    [-1.2, 0, 1.2].forEach((z) => {
      const rail = new THREE.Mesh(
        new THREE.BoxGeometry(14, 0.08, 0.14),
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x38bdf8,
          emissiveIntensity: 0.45,
        })
      );
      rail.position.set(-1.5, -1.32, z);
      scene.add(rail);
    });

    const dynamicGroup = new THREE.Group();
    scene.add(dynamicGroup);
    const clickables: THREE.Object3D[] = [];
    const pulseSpheres: THREE.Mesh[] = [];
    let lastKey = "";

    function rebuildCpu() {
      while (dynamicGroup.children.length > 0) dynamicGroup.remove(dynamicGroup.children[0]);
      clickables.length = 0;
      pulseSpheres.length = 0;

      const lvl = LEVELS[stateRef.current.levelIdx];
      const curSlots = stateRef.current.slots;
      const isFwd = stateRef.current.forwarding;
      const regs = stateRef.current.registers;

      const stageX = [-6.2, -1.5, 3.2];
      const stageColors = [0x38bdf8, 0x8b5cf6, 0x00f5d4];

      stageX.forEach((x, idx) => {
        const g = new THREE.Group();
        g.position.set(x, 0, 0);

        const occupied = Boolean(curSlots[idx]);
        const isNop = curSlots[idx]?.startsWith("NOP");

        // Composite CPU Chamber: base pedestal + glowing frame + floating core
        const pedestal = new THREE.Mesh(
          new THREE.BoxGeometry(3.4, 0.5, 3.4),
          new THREE.MeshStandardMaterial({
            color: 0x182235,
            metalness: 0.85,
            roughness: 0.25,
          })
        );
        pedestal.position.y = -1.1;
        pedestal.userData = { slotIdx: idx };
        g.add(pedestal);
        clickables.push(pedestal);

        const chamber = new THREE.Mesh(
          new THREE.BoxGeometry(2.8, 2.2, 2.6),
          new THREE.MeshStandardMaterial({
            color: occupied ? (isNop ? 0x334155 : stageColors[idx]) : 0x111827,
            metalness: 0.6,
            roughness: 0.22,
            transparent: true,
            opacity: occupied ? 0.85 : 0.42,
            emissive: occupied ? (isNop ? 0xf59e0b : stageColors[idx]) : 0x000000,
            emissiveIntensity: occupied ? 0.35 : 0,
          })
        );
        chamber.position.y = 0.25;
        chamber.userData = { slotIdx: idx };
        g.add(chamber);
        clickables.push(chamber);

        const wire = new THREE.LineSegments(
          new THREE.WireframeGeometry(new THREE.BoxGeometry(3.0, 2.4, 2.8)),
          new THREE.LineBasicMaterial({ color: stageColors[idx], transparent: true, opacity: 0.6 })
        );
        wire.position.y = 0.25;
        g.add(wire);

        const stageLbl = createTextSprite(lvl.slots[idx], {
          border: "#38BDF8",
          width: 260,
          height: 76,
          fontSize: 24,
        });
        stageLbl.position.set(0, -1.2, 2.2);
        g.add(stageLbl);

        const tokLbl = createTextSprite(curSlots[idx] ?? "[ EMPTY ]", {
          border: occupied ? "#00F5D4" : "rgba(148,163,184,0.35)",
          color: occupied ? "#F4F7FB" : "#64748B",
          width: 340,
          height: 84,
          fontSize: 24,
        });
        tokLbl.position.set(0, 2.15, 0);
        g.add(tokLbl);

        dynamicGroup.add(g);
      });

      // Forwarding Bypass Arch (when toggled ON)
      if (isFwd) {
        const fwdCurve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(3.2, 1.8, -1.2),
          new THREE.Vector3(-1.5, 4.4, -2.5),
          new THREE.Vector3(-1.5, 1.8, -1.2)
        );
        const fwdTube = new THREE.Mesh(
          new THREE.TubeGeometry(fwdCurve, 24, 0.1, 8, false),
          new THREE.MeshStandardMaterial({
            color: 0x00f5d4,
            emissive: 0x00f5d4,
            emissiveIntensity: 0.9,
          })
        );
        dynamicGroup.add(fwdTube);
      }

      // Register File Monolith on right flank
      const regGroup = new THREE.Group();
      regGroup.position.set(7.8, 0.2, 0);
      const regTower = new THREE.Mesh(
        new THREE.BoxGeometry(2.6, 3.4, 2.6),
        new THREE.MeshStandardMaterial({
          color: 0x161f33,
          metalness: 0.85,
          roughness: 0.2,
          emissive: 0x8b5cf6,
          emissiveIntensity: 0.2,
        })
      );
      regGroup.add(regTower);
      const regLbl = createTextSprite(`PC:${regs.PC} R1:${regs.R1} R3:${regs.R3}`, {
        border: "#8B5CF6",
        color: "#DDD6FE",
        width: 380,
        height: 82,
        fontSize: 22,
      });
      regLbl.position.set(0, 2.5, 0);
      regGroup.add(regLbl);
      dynamicGroup.add(regGroup);

      // Animated bus pulses
      for (let i = 0; i < 4; i++) {
        const s = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 10, 10),
          new THREE.MeshBasicMaterial({ color: 0x00f5d4 })
        );
        s.position.set(-7 + i * 4, -1.2, (i % 3 - 1) * 1.2);
        dynamicGroup.add(s);
        pulseSpheres.push(s);
      }
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
      if (hits.length > 0) {
        const slotIdx = hits[0].object.userData?.slotIdx;
        if (typeof slotIdx === "number") assignRef.current(slotIdx);
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
      const key = JSON.stringify(stateRef.current);
      if (key !== lastKey) {
        lastKey = key;
        rebuildCpu();
      }

      const speed = stateRef.current.pulseWave ? 10 : 4.2;
      pulseSpheres.forEach((s) => {
        s.position.x += dt * speed;
        if (s.position.x > 6.2) s.position.x = -7.5;
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
    const res = currentLevel.validate(slots, forwarding);
    setRegisters(res.registers);
    setPulseWave(true);
    setTimeout(() => setPulseWave(false), 1200);

    if (res.ok) {
      const earnedScore = Math.max(260, 520 - elapsed * 2) * combo;
      const xpEarned = 230 + currentLevel.level * 50;
      setScore((s) => s + earnedScore);
      setCombo((c) => c + 1);
      setFeedback({ type: "success", text: res.message });
      setIntuition(currentLevel.conceptExplanation);
      burstRef.current?.trigger(new THREE.Vector3(-1.5, 1.4, 0), 0x38bdf8);
      tutorVoice.speak(res.message, voiceRef.current);
      recordLevelComplete("fetch-cycle", currentLevel.level, earnedScore, xpEarned);
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
      setFeedback({ type: "error", text: res.message });
      tutorVoice.speak(res.message, voiceRef.current);
    }
  };

  const handleHint = async () => {
    setHintLoading(true);
    const res = await requestAiHint({
      gameTitle: "Ghost in the Fetch Cycle",
      subject: "PCC-CS302 Computer Organization & Architecture",
      level: currentLevel.level,
      objective: currentLevel.objective,
      gameState: { slots, forwarding },
      fallbackHint: currentLevel.hint,
    });
    setHintText(res.text);
    setHintSource(res.source);
    setHintLoading(false);
    tutorVoice.speak(res.text, voiceRef.current);
  };

  return (
    <GameHudLayout
      title="Ghost in the Fetch Cycle"
      paperCode="PCC-CS302"
      subjectName="Computer Organization & Architecture"
      accentColor="#38BDF8"
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
      validateLabel="Execute Clock Cycle"
      controlsSlot={
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="text-[#94A3B8]">Tokens:</span>
          {currentLevel.availableTokens.map((tok) => (
            <button
              key={tok}
              onClick={() => setSelectedToken(tok)}
              className={`px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                selectedToken === tok
                  ? "bg-[#38BDF8] text-[#06080E] border-[#38BDF8] font-bold"
                  : "bg-[#111624] text-[#E2E8F0] border-white/10 hover:border-[#38BDF8]/60"
              }`}
            >
              {tok}
            </button>
          ))}
          <span className="text-white/20">|</span>
          {currentLevel.slots.map((sLabel, i) => (
            <button
              key={sLabel}
              onClick={() => assignSlot(i)}
              className="px-2 py-1.5 rounded-lg bg-[#0B101C] border border-white/10 hover:border-[#00F5D4] text-[11px] text-[#CBD5E1] cursor-pointer"
            >
              {sLabel}: {slots[i] ? slots[i]?.split(" ")[0] : "—"}
            </button>
          ))}
          {currentLevel.forwardingAvailable && (
            <button
              onClick={() => {
                setForwarding((f) => !f);
                setIntuition(
                  !forwarding
                    ? "ALU Forwarding enabled: EX-stage output bypasses WB directly into the next EX input."
                    : "ALU Forwarding disabled: dependent instructions require a NOP stall bubble."
                );
              }}
              className={`px-2.5 py-1.5 rounded-lg border cursor-pointer ${
                forwarding
                  ? "bg-[#00F5D4]/20 border-[#00F5D4] text-[#00F5D4] font-semibold"
                  : "bg-white/[0.05] border-white/10 text-[#94A3B8]"
              }`}
            >
              ALU Forwarding: {forwarding ? "ON" : "OFF"}
            </button>
          )}
        </div>
      }
    >
      <div ref={mountRef} className="w-full h-full cursor-pointer" />
    </GameHudLayout>
  );
}
