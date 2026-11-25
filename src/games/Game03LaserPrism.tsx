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

type GateType = "AND" | "OR" | "XOR" | "NAND";

interface LaserLevel {
  level: number;
  title: string;
  objective: string;
  initialA: number;
  initialB: number;
  lockInputs?: boolean;
  initialMirrorAligned: boolean;
  initialGate: GateType;
  initialInvertOut: boolean;
  targetOutput: number;
  requiredGate?: GateType;
  requiredInvert?: boolean;
  expressionFn: (gate: GateType, inv: boolean) => string;
  hint: string;
  conceptTitle: string;
  conceptExplanation: string;
}

const LEVELS: LaserLevel[] = [
  {
    level: 1,
    title: "Optical Mirror Alignment & AND Prism",
    objective:
      "Align the 3D dielectric mirror (click it in 3D or toggle below) so Laser Beam A reaches the AND prism alongside Beam B=1, producing Output Y = 1.",
    initialA: 1,
    initialB: 1,
    lockInputs: true,
    initialMirrorAligned: false,
    initialGate: "AND",
    initialInvertOut: false,
    targetOutput: 1,
    requiredGate: "AND",
    requiredInvert: false,
    expressionFn: (g, inv) => (inv ? `Y = NOT(A ${g} B)` : `Y = A ${g} B`),
    hint: "The mirror on Rail A is misaligned by 45°. Click the rotating mirror prism in 3D (or press Rotate Mirror) so both beams enter the AND gate.",
    conceptTitle: "AND Logic Gate & Coincident Signal Path",
    conceptExplanation:
      "An AND gate outputs HIGH (1) strictly when all input lines are HIGH simultaneously (Y = A · B). Misaligned optical paths break the input signal to 0.",
  },
  {
    level: 2,
    title: "Synthesize XNOR Equivalence Gate",
    objective:
      "Given fixed inputs A=1 and B=1, align the mirror and configure the crystal prism + NOT inverter to realize XNOR: Y = (A ⊕ B)' = 1.",
    initialA: 1,
    initialB: 1,
    lockInputs: true,
    initialMirrorAligned: false,
    initialGate: "OR",
    initialInvertOut: false,
    targetOutput: 1,
    requiredGate: "XOR",
    requiredInvert: true,
    expressionFn: (g, inv) => (inv ? `Y = (A ${g} B)'` : `Y = A ${g} B`),
    hint: "Align the mirror, switch the primary crystal prism to XOR, and enable the Output NOT Inverter to form XNOR.",
    conceptTitle: "XOR & XNOR Digital Equivalence",
    conceptExplanation:
      "XOR outputs 1 when inputs differ (1 ⊕ 1 = 0). Cascading a NOT inverter creates XNOR, which outputs 1 whenever both inputs match.",
  },
  {
    level: 3,
    title: "Universal NAND Gate Synthesis",
    objective:
      "Inputs are A=0, B=1. Align the mirror and configure the prism as a Universal NAND gate (no extra inverter) so Output Y = (0 · 1)' = 1.",
    initialA: 0,
    initialB: 1,
    lockInputs: false,
    initialMirrorAligned: false,
    initialGate: "AND",
    initialInvertOut: true,
    targetOutput: 1,
    requiredGate: "NAND",
    requiredInvert: false,
    expressionFn: (g, inv) => (inv ? `Y = NOT(A ${g} B)` : `Y = A ${g} B`),
    hint: "Align the mirror, set Gate Prism to NAND, turn OFF the extra NOT inverter, and keep A=0, B=1.",
    conceptTitle: "NAND Gate Functional Completeness",
    conceptExplanation:
      "NAND is a universal gate: any Boolean function (AND, OR, NOT, XOR) can be constructed solely from NAND gates. For A=0, B=1, (A·B)' = 1.",
  },
];

function evalGate(gate: GateType, a: number, b: number, inv: boolean): number {
  let raw = 0;
  if (gate === "AND") raw = a & b;
  else if (gate === "OR") raw = a | b;
  else if (gate === "XOR") raw = a ^ b;
  else if (gate === "NAND") raw = (a & b) === 1 ? 0 : 1;
  return inv ? (raw === 1 ? 0 : 1) : raw;
}

interface Game03LaserPrismProps {
  onExit: () => void;
}

export function Game03LaserPrism({ onExit }: Game03LaserPrismProps) {
  const { recordLevelComplete, voiceEnabled } = useNexus();
  const voiceRef = useRef(voiceEnabled);
  voiceRef.current = voiceEnabled;

  const mountRef = useRef<HTMLDivElement>(null);
  const orbitRigRef = useRef<OrbitRigHandle | null>(null);
  const burstRef = useRef<CelebrationBurstHandle | null>(null);

  const [levelIdx, setLevelIdx] = useState(0);
  const currentLevel = LEVELS[levelIdx];

  const [inputA, setInputA] = useState(LEVELS[0].initialA);
  const [inputB, setInputB] = useState(LEVELS[0].initialB);
  const [mirrorAligned, setMirrorAligned] = useState(LEVELS[0].initialMirrorAligned);
  const [gate, setGate] = useState<GateType>(LEVELS[0].initialGate);
  const [invertOut, setInvertOut] = useState(LEVELS[0].initialInvertOut);

  const [elapsed, setElapsed] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [hintText, setHintText] = useState<string | null>(null);
  const [hintSource, setHintSource] = useState<"gemini" | "local">("local");
  const [hintLoading, setHintLoading] = useState(false);
  const [intuition, setIntuition] = useState(
    "Click the 3D mirror to rotate it into alignment, or configure the crystal logic prism below."
  );
  const [feedback, setFeedback] = useState<{ type: "error" | "info" | "success"; text: string } | null>(
    null
  );
  const [completion, setCompletion] = useState<LevelCompletePayload | null>(null);

  const effectiveA = mirrorAligned ? inputA : 0;
  const outputY = evalGate(gate, effectiveA, inputB, invertOut);

  const stateRef = useRef({ inputA, inputB, mirrorAligned, gate, invertOut, effectiveA, outputY });
  stateRef.current = { inputA, inputB, mirrorAligned, gate, invertOut, effectiveA, outputY };

  const loadLevel = useCallback((idx: number) => {
    tutorVoice.cancel();
    const lvl = LEVELS[idx];
    setLevelIdx(idx);
    setInputA(lvl.initialA);
    setInputB(lvl.initialB);
    setMirrorAligned(lvl.initialMirrorAligned);
    setGate(lvl.initialGate);
    setInvertOut(lvl.initialInvertOut);
    setElapsed(0);
    setHintText(null);
    setFeedback(null);
    setCompletion(null);
    setIntuition(`Loaded Level ${lvl.level}: ${lvl.title}. Align the mirror and tune the prism.`);
  }, []);

  useEffect(() => {
    if (completion) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [completion]);

  const toggleMirror = useCallback(() => {
    setMirrorAligned((prev) => {
      const next = !prev;
      if (next) {
        burstRef.current?.trigger(new THREE.Vector3(-3.2, 0.8, -2.8), 0x00f5d4);
      }
      const msg = next
        ? "Dielectric mirror locked at 45° — Laser A now couples directly into the logic prism."
        : "Mirror rotated off-axis — Laser A deflects away from the prism (input drops to 0).";
      setIntuition(msg);
      requestAiIntuition({
        gameTitle: "Laser Prism Logic",
        subject: "ESC-301 Analog & Digital Electronics",
        action: next ? "Aligned optical mirror" : "Misaligned optical mirror",
        stateSummary: JSON.stringify({ inputA, inputB, mirrorAligned: next, gate, invertOut }),
        fallbackIntuition: msg,
      }).then((r) => setIntuition(r.text));
      return next;
    });
  }, [inputA, inputB, gate, invertOut]);

  const mirrorToggleRef = useRef(toggleMirror);
  mirrorToggleRef.current = toggleMirror;

  // Dedicated 3D Optical & Digital Logic Bench
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
    camera.position.set(0, 9.2, 14.5);

    const { renderer, isSoftwareGl } = createNexusRenderer(container);
    const envTex = attachStudioEnvironment(renderer, scene);
    addNexusLighting(scene);

    const orbitRig = createOrbitRig(camera, renderer.domElement, {
      initialPosition: new THREE.Vector3(0, 9.2, 14.5),
      initialTarget: new THREE.Vector3(0, 0.5, 0),
      minDistance: 6,
      maxDistance: 28,
    });
    orbitRigRef.current = orbitRig;

    const composer = createBloomComposer(renderer, scene, camera, isSoftwareGl, container);
    const burst = createCelebrationBurst(scene);
    burstRef.current = burst;

    // Optical bench slab
    const bench = new THREE.Mesh(
      new THREE.BoxGeometry(20, 0.5, 11),
      new THREE.MeshStandardMaterial({ color: 0x0f1422, metalness: 0.75, roughness: 0.35 })
    );
    bench.position.y = -1.2;
    scene.add(bench);

    const grid = new THREE.GridHelper(32, 32, 0x8b5cf6, 0x162033);
    grid.position.y = -0.94;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.25;
    scene.add(grid);

    const dynamicGroup = new THREE.Group();
    scene.add(dynamicGroup);
    const clickables: THREE.Object3D[] = [];
    let mirrorMesh: THREE.Group | null = null;
    let lastKey = "";

    function addBeam(p1: THREE.Vector3, p2: THREE.Vector3, color: number, active: boolean) {
      const dist = p1.distanceTo(p2);
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      const geo = new THREE.CylinderGeometry(active ? 0.11 : 0.04, active ? 0.11 : 0.04, dist, 10);
      const mat = new THREE.MeshBasicMaterial({
        color: active ? color : 0x334155,
        transparent: true,
        opacity: active ? 0.95 : 0.35,
      });
      const beam = new THREE.Mesh(geo, mat);
      beam.position.copy(mid);
      beam.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3().subVectors(p2, p1).normalize()
      );
      dynamicGroup.add(beam);
    }

    function rebuildOptics() {
      while (dynamicGroup.children.length > 0) dynamicGroup.remove(dynamicGroup.children[0]);
      clickables.length = 0;

      const s = stateRef.current;

      const emitAPos = new THREE.Vector3(-7.2, 0.4, -2.8);
      const mirrorPos = new THREE.Vector3(-3.2, 0.4, -2.8);
      const emitBPos = new THREE.Vector3(-7.2, 0.4, 2.4);
      const gatePos = new THREE.Vector3(0.4, 0.4, 0);
      const notPos = new THREE.Vector3(4.0, 0.4, 0);
      const targetPos = new THREE.Vector3(7.4, 0.4, 0);

      // Emitter A & B
      [
        { pos: emitAPos, lbl: `IN A = ${s.inputA}`, active: s.inputA === 1 },
        { pos: emitBPos, lbl: `IN B = ${s.inputB}`, active: s.inputB === 1 },
      ].forEach((em) => {
        const g = new THREE.Group();
        g.position.copy(em.pos);
        const body = new THREE.Mesh(
          new THREE.CylinderGeometry(0.5, 0.65, 1.5, 16),
          new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            metalness: 0.85,
            roughness: 0.2,
            emissive: em.active ? 0x00f5d4 : 0x000000,
            emissiveIntensity: 0.35,
          })
        );
        body.rotation.z = Math.PI / 2;
        g.add(body);
        const lbl = createTextSprite(em.lbl, {
          border: em.active ? "#00F5D4" : "#475569",
          width: 210,
          height: 70,
          fontSize: 24,
        });
        lbl.position.set(0, 1.4, 0);
        g.add(lbl);
        dynamicGroup.add(g);
      });

      // Rotatable Dielectric Mirror (clickable in 3D!)
      mirrorMesh = new THREE.Group();
      mirrorMesh.position.copy(mirrorPos);
      const mirrorFrame = new THREE.Mesh(
        new THREE.BoxGeometry(0.25, 1.8, 2.1),
        new THREE.MeshStandardMaterial({
          color: s.mirrorAligned ? 0x00f5d4 : 0xf59e0b,
          metalness: 0.92,
          roughness: 0.1,
          emissive: s.mirrorAligned ? 0x00f5d4 : 0xf59e0b,
          emissiveIntensity: 0.4,
        })
      );
      mirrorFrame.userData = { action: "mirror" };
      mirrorMesh.add(mirrorFrame);
      mirrorMesh.rotation.y = s.mirrorAligned ? -Math.PI / 4 : Math.PI / 8;
      clickables.push(mirrorFrame);

      const mLbl = createTextSprite(s.mirrorAligned ? "MIRROR 45° OK" : "CLICK MIRROR", {
        border: s.mirrorAligned ? "#00F5D4" : "#F59E0B",
        color: s.mirrorAligned ? "#00F5D4" : "#FDE68A",
        width: 260,
        height: 70,
        fontSize: 22,
      });
      mLbl.position.set(0, 1.7, 0);
      mirrorMesh.add(mLbl);
      dynamicGroup.add(mirrorMesh);

      // Logic Gate Crystal Prism
      const prismGroup = new THREE.Group();
      prismGroup.position.copy(gatePos);
      const prism = new THREE.Mesh(
        new THREE.CylinderGeometry(1.4, 1.4, 1.9, 3),
        new THREE.MeshStandardMaterial({
          color: 0x8b5cf6,
          metalness: 0.35,
          roughness: 0.15,
          transparent: true,
          opacity: 0.85,
          emissive: 0x8b5cf6,
          emissiveIntensity: 0.4,
        })
      );
      prismGroup.add(prism);
      const pLbl = createTextSprite(`GATE: ${s.gate}`, {
        border: "#8B5CF6",
        color: "#F4F7FB",
        width: 240,
        height: 76,
        fontSize: 26,
      });
      pLbl.position.set(0, 1.9, 0);
      prismGroup.add(pLbl);
      dynamicGroup.add(prismGroup);

      // Optional NOT Inverter Crystal
      const notGroup = new THREE.Group();
      notGroup.position.copy(notPos);
      const notCone = new THREE.Mesh(
        new THREE.ConeGeometry(0.85, 1.6, 16),
        new THREE.MeshStandardMaterial({
          color: s.invertOut ? 0xec4899 : 0x334155,
          metalness: 0.6,
          roughness: 0.25,
          emissive: s.invertOut ? 0xec4899 : 0x000000,
          emissiveIntensity: 0.45,
        })
      );
      notCone.rotation.z = -Math.PI / 2;
      notGroup.add(notCone);
      const nLbl = createTextSprite(s.invertOut ? "NOT: ON" : "BYPASS", {
        border: s.invertOut ? "#EC4899" : "#475569",
        width: 200,
        height: 66,
        fontSize: 22,
      });
      nLbl.position.set(0, 1.45, 0);
      notGroup.add(nLbl);
      dynamicGroup.add(notGroup);

      // Output Target Photovolt Sensor
      const targetGroup = new THREE.Group();
      targetGroup.position.copy(targetPos);
      const sensor = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.15, 0),
        new THREE.MeshStandardMaterial({
          color: s.outputY === 1 ? 0x00f5d4 : 0x334155,
          emissive: s.outputY === 1 ? 0x00f5d4 : 0xef4444,
          emissiveIntensity: s.outputY === 1 ? 0.85 : 0.2,
          metalness: 0.7,
          roughness: 0.2,
        })
      );
      targetGroup.add(sensor);
      const tLbl = createTextSprite(`OUT Y = ${s.outputY}`, {
        border: s.outputY === 1 ? "#00F5D4" : "#EF4444",
        color: s.outputY === 1 ? "#00F5D4" : "#FCA5A5",
        width: 240,
        height: 76,
        fontSize: 26,
      });
      tLbl.position.set(0, 1.8, 0);
      targetGroup.add(tLbl);
      dynamicGroup.add(targetGroup);

      // Beams
      addBeam(emitAPos, mirrorPos, 0x00f5d4, s.inputA === 1);
      if (s.mirrorAligned) {
        addBeam(mirrorPos, gatePos, 0x00f5d4, s.inputA === 1);
      } else {
        addBeam(mirrorPos, new THREE.Vector3(-1.0, 0.4, -6.2), 0xf59e0b, s.inputA === 1);
      }
      addBeam(emitBPos, gatePos, 0x38bdf8, s.inputB === 1);

      const preNot = evalGate(s.gate, s.effectiveA, s.inputB, false);
      addBeam(gatePos, notPos, 0x8b5cf6, preNot === 1);
      addBeam(notPos, targetPos, 0x00f5d4, s.outputY === 1);
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
      if (hits.length > 0 && hits[0].object.userData?.action === "mirror") {
        mirrorToggleRef.current();
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
        rebuildOptics();
      }
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
    const gateMatch = !currentLevel.requiredGate || gate === currentLevel.requiredGate;
    const invMatch =
      currentLevel.requiredInvert === undefined || invertOut === currentLevel.requiredInvert;
    if (mirrorAligned && outputY === currentLevel.targetOutput && gateMatch && invMatch) {
      const earnedScore = Math.max(250, 500 - elapsed * 2) * combo;
      const xpEarned = 230 + currentLevel.level * 50;
      setScore((s) => s + earnedScore);
      setCombo((c) => c + 1);
      const expr = currentLevel.expressionFn(gate, invertOut);
      const successMsg = `Optical circuit verified! ${expr} produces output ${outputY}.`;
      setFeedback({ type: "success", text: `Optical circuit verified! ${expr} → Y = ${outputY}` });
      setIntuition(currentLevel.conceptExplanation);
      burstRef.current?.trigger(new THREE.Vector3(7.4, 1.0, 0), 0x8b5cf6);
      tutorVoice.speak(successMsg, voiceRef.current);
      recordLevelComplete("laser-prism", currentLevel.level, earnedScore, xpEarned);
      setCompletion({
        level: currentLevel.level,
        score: earnedScore,
        xpEarned,
        conceptTitle: `${currentLevel.conceptTitle} (${expr})`,
        conceptExplanation: currentLevel.conceptExplanation,
        hasNextLevel: levelIdx < LEVELS.length - 1,
      });
    } else {
      setCombo(1);
      const errMsg = !mirrorAligned
        ? "Beam A is deflected! Rotate the 3D mirror into 45° alignment."
        : `Output Y=${outputY}, gate=${gate}. Check the required Boolean gate & inverter.`;
      setFeedback({ type: "error", text: errMsg });
      tutorVoice.speak(errMsg, voiceRef.current);
    }
  };

  const handleHint = async () => {
    setHintLoading(true);
    const res = await requestAiHint({
      gameTitle: "Laser Prism Logic",
      subject: "ESC-301 Analog & Digital Electronics",
      level: currentLevel.level,
      objective: currentLevel.objective,
      gameState: { inputA, inputB, mirrorAligned, gate, invertOut, outputY },
      fallbackHint: currentLevel.hint,
    });
    setHintText(res.text);
    setHintSource(res.source);
    setHintLoading(false);
    tutorVoice.speak(res.text, voiceRef.current);
  };

  return (
    <GameHudLayout
      title="Laser Prism Logic"
      paperCode="ESC-301"
      subjectName="Analog & Digital Electronics"
      accentColor="#8B5CF6"
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
      validateLabel="Test Optical Output"
      controlsSlot={
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <button
            onClick={toggleMirror}
            className={`px-2.5 py-1.5 rounded-lg border cursor-pointer ${
              mirrorAligned
                ? "bg-[#00F5D4]/20 border-[#00F5D4] text-[#00F5D4] font-semibold"
                : "bg-[#F59E0B]/20 border-[#F59E0B] text-[#FDE68A]"
            }`}
          >
            Mirror: {mirrorAligned ? "45° Aligned" : "Rotate Mirror"}
          </button>

          <span className="text-white/20">|</span>
          {(["AND", "OR", "XOR", "NAND"] as GateType[]).map((g) => (
            <button
              key={g}
              onClick={() => {
                setGate(g);
                setIntuition(`Prism switched to ${g} gate. Current expression: ${currentLevel.expressionFn(g, invertOut)}.`);
              }}
              className={`px-2.5 py-1.5 rounded-lg border cursor-pointer ${
                gate === g
                  ? "bg-[#8B5CF6] text-white border-[#8B5CF6] font-bold"
                  : "bg-[#111624] text-[#CBD5E1] border-white/10 hover:border-[#8B5CF6]/60"
              }`}
            >
              {g}
            </button>
          ))}

          <button
            onClick={() => setInvertOut((v) => !v)}
            className={`px-2.5 py-1.5 rounded-lg border cursor-pointer ${
              invertOut
                ? "bg-[#EC4899]/25 border-[#EC4899] text-[#FBCFE8] font-semibold"
                : "bg-[#111624] border-white/10 text-[#94A3B8]"
            }`}
          >
            NOT Inverter: {invertOut ? "ON" : "OFF"}
          </button>

          {!currentLevel.lockInputs && (
            <>
              <button
                onClick={() => setInputA((a) => (a === 1 ? 0 : 1))}
                className="px-2 py-1.5 rounded-lg bg-[#0B101C] border border-white/10 text-[#00F5D4] cursor-pointer"
              >
                A={inputA}
              </button>
              <button
                onClick={() => setInputB((b) => (b === 1 ? 0 : 1))}
                className="px-2 py-1.5 rounded-lg bg-[#0B101C] border border-white/10 text-[#38BDF8] cursor-pointer"
              >
                B={inputB}
              </button>
            </>
          )}
        </div>
      }
    >
      <div ref={mountRef} className="w-full h-full cursor-pointer" />
    </GameHudLayout>
  );
}
