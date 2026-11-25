import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { GameHudLayout, LevelCompletePayload } from "../components/GameHudLayout";
import { PyqLabConfig, LabArchetype } from "../types/pyqLab";
import { SEMESTER_3_SUBJECTS } from "../types/nexus";
import {
  addNexusLighting,
  attachStudioEnvironment,
  createLoopScheduler,
  createNexusRenderer,
  createTextSprite,
  disposeScene,
} from "../three/threeUtils";
import {
  BloomComposerHandle,
  CelebrationBurstHandle,
  OrbitRigHandle,
  createBloomComposer,
  createCelebrationBurst,
  createOrbitRig,
} from "../three/sceneEnhancements";
import { requestAiHint, requestAiIntuition } from "../services/aiService";
import { tutorVoice } from "../services/tutorVoice";
import { useNexus } from "../store/useNexusStore";

interface CustomPyqLabProps {
  config: PyqLabConfig;
  onExit: () => void;
  onGenerateAnother: () => void;
}

const ARCHETYPE_ACCENTS: Record<LabArchetype, string> = {
  graph_pointer: "#00F5D4",
  circuit_prism: "#8B5CF6",
  pipeline_sequence: "#38BDF8",
  equilibrium_slider: "#F59E0B",
  stack_inspector: "#EC4899",
};

const ARCHETYPE_CAMERA: Record<
  LabArchetype,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  graph_pointer: { pos: [0, 6.8, 15.0], target: [0, 1.0, 0] },
  circuit_prism: { pos: [0, 9.0, 15.0], target: [0, 0.5, 0] },
  pipeline_sequence: { pos: [0, 8.2, 16.0], target: [0, 0.8, 0] },
  equilibrium_slider: { pos: [0, 8.0, 16.5], target: [0, 1.4, 0] },
  stack_inspector: { pos: [6.8, 6.5, 13.8], target: [0, 2.4, 0] },
};

function shortenLabel(text: string, maxLen = 22): string {
  const clean = text.trim();
  if (clean.length <= maxLen) return clean;
  return `${clean.slice(0, maxLen - 1)}…`;
}

export function CustomPyqLab({ config, onExit, onGenerateAnother }: CustomPyqLabProps) {
  const { recordCustomLabComplete, voiceEnabled } = useNexus();
  const voiceRef = useRef(voiceEnabled);
  voiceRef.current = voiceEnabled;

  const mountRef = useRef<HTMLDivElement>(null);
  const orbitRigRef = useRef<OrbitRigHandle | null>(null);
  const burstRef = useRef<CelebrationBurstHandle | null>(null);
  const itemPosMapRef = useRef<Record<number, THREE.Vector3>>({});

  const steps = config.nodesOrControls;
  const isEquilibrium = config.archetype === "equilibrium_slider";
  const COUNTDOWN_START = 180;

  const subjectMeta = useMemo(
    () =>
      SEMESTER_3_SUBJECTS.find(
        (s) => s.code.toUpperCase() === config.detectedSubjectCode.toUpperCase()
      ),
    [config.detectedSubjectCode]
  );

  const accentColor = subjectMeta?.accent ?? ARCHETYPE_ACCENTS[config.archetype] ?? "#00F5D4";
  const subjectName = subjectMeta?.subjectName ?? "MAKAUT Custom Simulation";

  const [calibratedSteps, setCalibratedSteps] = useState<number[]>([]);
  const [sliderValue, setSliderValue] = useState<number>(isEquilibrium ? 25 : 100);
  const [hintHighlightedIdx, setHintHighlightedIdx] = useState<number | null>(null);

  const [remainingSeconds, setRemainingSeconds] = useState(COUNTDOWN_START);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [hintText, setHintText] = useState<string | null>(null);
  const [hintSource, setHintSource] = useState<"gemini" | "local">(config.source);
  const [hintLoading, setHintLoading] = useState(false);
  const [intuition, setIntuition] = useState<string>(
    `Calibrate each 3D stage in sequence (1 → ${steps.length}) to solve ${config.labTitle}.`
  );
  const [feedback, setFeedback] = useState<{
    type: "error" | "info" | "success";
    text: string;
  } | null>(null);
  const [completion, setCompletion] = useState<LevelCompletePayload | null>(null);

  const stateRef = useRef({
    calibratedSteps,
    sliderValue,
    hintHighlightedIdx,
    completed: Boolean(completion),
  });
  stateRef.current = {
    calibratedSteps,
    sliderValue,
    hintHighlightedIdx,
    completed: Boolean(completion),
  };

  // Reset cleanly if config changes
  useEffect(() => {
    setCalibratedSteps([]);
    setSliderValue(config.archetype === "equilibrium_slider" ? 25 : 100);
    setHintHighlightedIdx(null);
    setRemainingSeconds(COUNTDOWN_START);
    setScore(0);
    setCombo(1);
    setHintText(null);
    setFeedback(null);
    setCompletion(null);
    setIntuition(
      `Calibrate each 3D stage in sequence (1 → ${config.nodesOrControls.length}) to solve ${config.labTitle}.`
    );
    tutorVoice.cancel();
  }, [config]);

  // Countdown timer
  useEffect(() => {
    if (completion) return;
    const t = window.setInterval(() => {
      setRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(t);
  }, [completion]);

  const handleReset = useCallback(() => {
    tutorVoice.cancel();
    setCalibratedSteps([]);
    setSliderValue(isEquilibrium ? 25 : 100);
    setHintHighlightedIdx(null);
    setRemainingSeconds(COUNTDOWN_START);
    setScore(0);
    setCombo(1);
    setHintText(null);
    setFeedback(null);
    setCompletion(null);
    setIntuition(`Simulation reset. Start by calibrating step 1: "${steps[0]}".`);
  }, [isEquilibrium, steps]);

  const handleStepActivate = useCallback(
    (idx: number) => {
      if (completion) return;
      if (calibratedSteps.includes(idx)) {
        setFeedback({
          type: "info",
          text: `Stage ${idx + 1} (${steps[idx]}) is already calibrated.`,
        });
        return;
      }

      const expectedIdx = calibratedSteps.length;
      if (idx !== expectedIdx) {
        setCombo(1);
        const errMsg = `Order mismatch: calibrate "${steps[expectedIdx]}" before "${steps[idx]}".`;
        setFeedback({ type: "error", text: errMsg });
        setHintHighlightedIdx(expectedIdx);
        tutorVoice.speak(
          `Calibrate ${steps[expectedIdx]} first to preserve the correct execution sequence.`,
          voiceRef.current
        );
        return;
      }

      const nextCalibrated = [...calibratedSteps, idx];
      setCalibratedSteps(nextCalibrated);
      setHintHighlightedIdx(null);
      setScore((s) => s + 120 * combo);
      setCombo((c) => c + 1);

      const burstPos = itemPosMapRef.current[idx] ?? new THREE.Vector3(0, 1.0, 0);
      burstRef.current?.trigger(burstPos, Number(accentColor.replace("#", "0x")) || 0x00f5d4);

      const isMidpoint = nextCalibrated.length === Math.ceil(steps.length / 2);
      const allDone = nextCalibrated.length === steps.length;

      const stepMsg = allDone
        ? `All ${steps.length} stages calibrated! ${isEquilibrium && sliderValue < 85 ? "Set equilibrium slider to 100%, then validate." : "Click Validate Mission to lock your solution."}`
        : `Calibrated Stage ${idx + 1}/${steps.length}: ${steps[idx]}. Next: ${steps[idx + 1]}.`;

      setFeedback({ type: "success", text: stepMsg });

      const fallbackIntuition = allDone
        ? config.ahaIntuition
        : `Stage "${steps[idx]}" verified in ${config.detectedSubjectCode} simulation; proceed to "${steps[idx + 1]}".`;
      setIntuition(fallbackIntuition);

      if (isMidpoint) {
        tutorVoice.speak(
          `Halfway calibrated. ${config.hintBeamTarget}`,
          voiceRef.current
        );
      } else if (allDone) {
        tutorVoice.speak(config.ahaIntuition, voiceRef.current);
      }

      requestAiIntuition({
        gameTitle: config.labTitle,
        subject: `${config.detectedSubjectCode} ${subjectName}`,
        action: `Calibrated step ${idx + 1}: ${steps[idx]}`,
        stateSummary: JSON.stringify({
          completedSteps: nextCalibrated.map((i) => steps[i]),
          remaining: steps.slice(nextCalibrated.length),
        }),
        fallbackIntuition,
      }).then((res) => setIntuition(res.text));
    },
    [accentColor, calibratedSteps, combo, completion, config, isEquilibrium, sliderValue, steps, subjectName]
  );

  const stepActivateRef = useRef(handleStepActivate);
  stepActivateRef.current = handleStepActivate;

  // Dedicated 3D Archetype Renderer
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06080e);
    scene.fog = new THREE.FogExp2(0x06080e, 0.02);

    const camPreset = ARCHETYPE_CAMERA[config.archetype];
    const camera = new THREE.PerspectiveCamera(
      46,
      Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1),
      0.1,
      200
    );
    camera.position.set(...camPreset.pos);

    const { renderer, isSoftwareGl } = createNexusRenderer(container);
    const envTex = attachStudioEnvironment(renderer, scene);
    addNexusLighting(scene);

    const orbitRig = createOrbitRig(camera, renderer.domElement, {
      initialPosition: new THREE.Vector3(...camPreset.pos),
      initialTarget: new THREE.Vector3(...camPreset.target),
      minDistance: 6,
      maxDistance: 30,
    });
    orbitRigRef.current = orbitRig;

    const composer: BloomComposerHandle = createBloomComposer(
      renderer,
      scene,
      camera,
      isSoftwareGl,
      container
    );

    const burst = createCelebrationBurst(scene);
    burstRef.current = burst;

    const accentHex = Number(accentColor.replace("#", "0x")) || 0x00f5d4;
    const grid = new THREE.GridHelper(36, 36, accentHex, 0x162033);
    grid.position.y = -1.6;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.28;
    scene.add(grid);

    const dynamicGroup = new THREE.Group();
    scene.add(dynamicGroup);
    const clickables: THREE.Object3D[] = [];
    const animatedMeshes: { mesh: THREE.Object3D; baseY: number; idx: number }[] = [];
    const packets: { mesh: THREE.Mesh; curve: THREE.QuadraticBezierCurve3; t: number }[] = [];
    let lastKey = "";

    function computePositions(count: number, archetype: LabArchetype): THREE.Vector3[] {
      const positions: THREE.Vector3[] = [];
      for (let i = 0; i < count; i++) {
        const norm = count > 1 ? i / (count - 1) - 0.5 : 0;
        if (archetype === "stack_inspector") {
          positions.push(new THREE.Vector3(0, 0.2 + i * 1.45, 0));
        } else if (archetype === "circuit_prism") {
          const x = norm * 11.5;
          const z = i % 2 === 0 ? -1.4 : 1.4;
          positions.push(new THREE.Vector3(x, 0.4, z));
        } else if (archetype === "graph_pointer") {
          const x = norm * 12.2;
          const z = Math.sin(i * 1.35) * 1.6;
          positions.push(new THREE.Vector3(x, 0.8 + (i % 2) * 0.45, z));
        } else if (archetype === "equilibrium_slider") {
          const x = norm * 11.0;
          positions.push(new THREE.Vector3(x, 0.4, 0));
        } else {
          // pipeline_sequence
          const x = norm * 12.0;
          positions.push(new THREE.Vector3(x, 0.35, 0));
        }
      }
      return positions;
    }

    function rebuildScene() {
      while (dynamicGroup.children.length > 0) {
        dynamicGroup.remove(dynamicGroup.children[0]);
      }
      clickables.length = 0;
      animatedMeshes.length = 0;
      packets.length = 0;
      itemPosMapRef.current = {};

      const cur = stateRef.current;
      const calSet = new Set(cur.calibratedSteps);
      const nextExpected = cur.calibratedSteps.length;
      const positions = computePositions(steps.length, config.archetype);

      // Archetype structural backdrop elements
      if (config.archetype === "stack_inspector") {
        const spine = new THREE.Mesh(
          new THREE.CylinderGeometry(0.14, 0.14, Math.max(6, steps.length * 1.6), 12),
          new THREE.MeshStandardMaterial({
            color: 0xec4899,
            emissive: 0xec4899,
            emissiveIntensity: 0.45,
          })
        );
        spine.position.set(0, (steps.length * 1.45) / 2, 0);
        dynamicGroup.add(spine);
      } else if (config.archetype === "pipeline_sequence") {
        const bus = new THREE.Mesh(
          new THREE.BoxGeometry(15.5, 0.12, 2.2),
          new THREE.MeshStandardMaterial({
            color: 0x0f172a,
            metalness: 0.8,
            roughness: 0.3,
            emissive: 0x38bdf8,
            emissiveIntensity: 0.18,
          })
        );
        bus.position.set(0, -1.1, 0);
        dynamicGroup.add(bus);
      } else if (config.archetype === "circuit_prism") {
        const bench = new THREE.Mesh(
          new THREE.BoxGeometry(16, 0.35, 7.5),
          new THREE.MeshStandardMaterial({ color: 0x0f1422, metalness: 0.75, roughness: 0.35 })
        );
        bench.position.set(0, -1.25, 0);
        dynamicGroup.add(bench);
      } else if (config.archetype === "equilibrium_slider") {
        const horizon = new THREE.Mesh(
          new THREE.PlaneGeometry(14.5, 4.2),
          new THREE.MeshBasicMaterial({
            color: cur.sliderValue >= 85 ? 0x00f5d4 : 0xf59e0b,
            transparent: true,
            opacity: 0.16,
            side: THREE.DoubleSide,
          })
        );
        horizon.rotation.x = Math.PI / 2;
        horizon.position.y = (cur.sliderValue / 100) * 2.4 - 0.6;
        dynamicGroup.add(horizon);
      }

      // Render 4-6 generated nodes/controls
      positions.forEach((pos, idx) => {
        itemPosMapRef.current[idx] = pos.clone();
        const isDone = calSet.has(idx);
        const isNext = idx === nextExpected;
        const isHint = cur.hintHighlightedIdx === idx;

        const g = new THREE.Group();
        g.position.copy(pos);

        const nodeColor = isDone
          ? 0x00f5d4
          : isHint
          ? 0xf59e0b
          : isNext
          ? accentHex
          : 0x334155;

        let mainMesh: THREE.Mesh;
        if (config.archetype === "circuit_prism") {
          mainMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(1.05, 1.05, 1.5, 3),
            new THREE.MeshStandardMaterial({
              color: isDone ? 0x00f5d4 : 0x1a2236,
              emissive: nodeColor,
              emissiveIntensity: isDone || isHint ? 0.65 : isNext ? 0.42 : 0.15,
              metalness: 0.45,
              roughness: 0.2,
            })
          );
        } else if (config.archetype === "stack_inspector") {
          mainMesh = new THREE.Mesh(
            new THREE.BoxGeometry(5.2, 0.72, 2.5),
            new THREE.MeshStandardMaterial({
              color: isDone ? 0x0c2b2a : 0x151c2c,
              emissive: nodeColor,
              emissiveIntensity: isDone || isHint ? 0.55 : isNext ? 0.35 : 0.14,
              metalness: 0.7,
              roughness: 0.25,
            })
          );
        } else if (config.archetype === "equilibrium_slider") {
          const h = isDone ? 2.6 : Math.max(0.8, (cur.sliderValue / 100) * 2.4);
          mainMesh = new THREE.Mesh(
            new THREE.BoxGeometry(1.75, h, 1.75),
            new THREE.MeshStandardMaterial({
              color: isDone ? 0x10b981 : 0x1e293b,
              emissive: nodeColor,
              emissiveIntensity: isDone || isHint ? 0.55 : isNext ? 0.35 : 0.15,
              metalness: 0.65,
              roughness: 0.25,
            })
          );
          mainMesh.position.y = h * 0.5 - 1.2;
        } else {
          // graph_pointer or pipeline_sequence
          mainMesh = new THREE.Mesh(
            new THREE.BoxGeometry(1.9, 1.35, 1.5),
            new THREE.MeshStandardMaterial({
              color: isDone ? 0x0f2d2e : 0x162033,
              emissive: nodeColor,
              emissiveIntensity: isDone || isHint ? 0.6 : isNext ? 0.36 : 0.14,
              metalness: 0.76,
              roughness: 0.24,
            })
          );
        }

        mainMesh.userData = { stepIdx: idx };
        g.add(mainMesh);
        clickables.push(mainMesh);

        // Status beacon crystal above each non-stack node
        if (config.archetype !== "stack_inspector") {
          const beacon = new THREE.Mesh(
            new THREE.OctahedronGeometry(0.32, 0),
            new THREE.MeshStandardMaterial({
              color: nodeColor,
              emissive: nodeColor,
              emissiveIntensity: isDone || isHint ? 0.85 : 0.3,
            })
          );
          beacon.position.y = 1.25;
          beacon.userData = { stepIdx: idx };
          g.add(beacon);
          clickables.push(beacon);
        }

        // Wireframe halo for next target or hint
        if (isNext || isHint) {
          const halo = new THREE.Mesh(
            new THREE.TorusGeometry(
              config.archetype === "stack_inspector" ? 2.9 : 1.25,
              0.05,
              10,
              32
            ),
            new THREE.MeshBasicMaterial({
              color: isHint ? 0xf59e0b : 0x00f5d4,
            })
          );
          halo.rotation.x = Math.PI / 2;
          halo.position.y = config.archetype === "stack_inspector" ? 0 : -0.85;
          g.add(halo);
        }

        const labelText = `${idx + 1}. ${shortenLabel(steps[idx], 20)}`;
        const sprite = createTextSprite(labelText, {
          border: isDone ? "#00F5D4" : isHint ? "#F59E0B" : isNext ? accentColor : "#475569",
          color: isDone ? "#00F5D4" : "#F4F7FB",
          width: 340,
          height: 74,
          fontSize: 22,
        });
        if (config.archetype === "stack_inspector") {
          sprite.position.set(0, 0.05, 1.85);
          sprite.scale.set(4.5, 0.9, 1);
        } else {
          sprite.position.set(0, 2.05, 0);
        }
        g.add(sprite);

        dynamicGroup.add(g);
        animatedMeshes.push({ mesh: g, baseY: pos.y, idx });
      });

      // Connect consecutive stages with tubes/laser beams
      for (let i = 0; i < positions.length - 1; i++) {
        const p1 = positions[i];
        const p2 = positions[i + 1];
        const active = calSet.has(i);
        const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
        if (config.archetype === "graph_pointer") mid.y += 1.05;

        const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
        const tube = new THREE.Mesh(
          new THREE.TubeGeometry(curve, 20, active ? 0.075 : 0.035, 8, false),
          new THREE.MeshStandardMaterial({
            color: active ? 0x00f5d4 : 0x334155,
            emissive: active ? 0x00f5d4 : 0x000000,
            emissiveIntensity: active ? 0.7 : 0,
            transparent: true,
            opacity: active ? 0.95 : 0.45,
          })
        );
        dynamicGroup.add(tube);

        if (active) {
          const pkt = new THREE.Mesh(
            new THREE.SphereGeometry(0.16, 10, 10),
            new THREE.MeshBasicMaterial({ color: 0xffffff })
          );
          dynamicGroup.add(pkt);
          packets.push({ mesh: pkt, curve, t: Math.random() });
        }
      }
    }

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downPos = { x: 0, y: 0 };

    const onPointerDown = (e: PointerEvent) => {
      downPos = { x: e.clientX, y: e.clientY };
    };
    const onPointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickables, false);
      if (hits.length > 0) {
        const idx = hits[0].object.userData?.stepIdx;
        if (typeof idx === "number") stepActivateRef.current(idx);
      }
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);

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
        rebuildScene();
      }

      if (config.archetype === "graph_pointer") {
        animatedMeshes.forEach((item) => {
          item.mesh.position.y = item.baseY + Math.sin(t * 1.8 + item.idx) * 0.12;
        });
      } else if (config.archetype === "stack_inspector") {
        animatedMeshes.forEach((item) => {
          item.mesh.rotation.y = Math.sin(t * 0.7 + item.idx * 0.5) * 0.08;
        });
      }

      packets.forEach((p) => {
        p.t = (p.t + dt * 0.45) % 1;
        p.mesh.position.copy(p.curve.getPoint(p.t));
      });

      burst.update(dt);
      orbitRig.update(dt);
      composer.render();
    });
    loop.start();

    return () => {
      loop.stop();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("resize", onResize);
      orbitRigRef.current = null;
      burstRef.current = null;
      burst.dispose();
      composer.dispose();
      orbitRig.dispose();
      envTex.dispose();
      disposeScene(scene, renderer);
    };
  }, [accentColor, config.archetype, steps]);

  const handleValidate = () => {
    if (calibratedSteps.length < steps.length) {
      setCombo(1);
      const nextStep = steps[calibratedSteps.length];
      const msg = `Incomplete calibration (${calibratedSteps.length}/${steps.length}). Next required stage: "${nextStep}".`;
      setFeedback({ type: "error", text: msg });
      setHintHighlightedIdx(calibratedSteps.length);
      tutorVoice.speak(
        `Complete the remaining stages, starting with ${nextStep}.`,
        voiceRef.current
      );
      return;
    }

    if (isEquilibrium && sliderValue < 85) {
      setCombo(1);
      const msg = `Equilibrium slider is at ${sliderValue}%. Tune the parameter slider to 85%–100% to stabilize the system.`;
      setFeedback({ type: "error", text: msg });
      tutorVoice.speak(
        "Adjust the equilibrium parameter slider toward 100 percent before validating.",
        voiceRef.current
      );
      return;
    }

    const earnedScore = Math.max(300, score + remainingSeconds * 3);
    const xpEarned = 280;
    setScore(earnedScore);
    setFeedback({
      type: "success",
      text: `Custom AI Lab verified! ${config.correctSequenceOrTarget}`,
    });
    setIntuition(config.ahaIntuition);
    burstRef.current?.trigger(new THREE.Vector3(0, 1.2, 0), 0x00f5d4);
    tutorVoice.speak(config.ahaIntuition, voiceRef.current);

    recordCustomLabComplete(config.labTitle, config.detectedSubjectCode, xpEarned);
    setCompletion({
      level: 1,
      score: earnedScore,
      xpEarned,
      conceptTitle: `${config.detectedSubjectCode} · ${config.labTitle}`,
      conceptExplanation: `${config.correctSequenceOrTarget} — ${config.ahaIntuition}`,
      hasNextLevel: false,
    });
  };

  const handleHint = async () => {
    const nextIdx = Math.min(calibratedSteps.length, steps.length - 1);
    setHintHighlightedIdx(nextIdx);
    setHintLoading(true);
    const res = await requestAiHint({
      gameTitle: config.labTitle,
      subject: `${config.detectedSubjectCode} ${subjectName}`,
      level: 1,
      objective: config.missionObjective,
      gameState: {
        calibratedSteps: calibratedSteps.map((i) => steps[i]),
        nextExpected: steps[nextIdx],
        sliderValue,
      },
      fallbackHint: `${config.hintBeamTarget} Focus on stage ${nextIdx + 1}: "${steps[nextIdx]}".`,
    });
    setHintText(res.text);
    setHintSource(res.source);
    setHintLoading(false);
    tutorVoice.speak(res.text, voiceRef.current);
  };

  return (
    <GameHudLayout
      title={config.labTitle}
      paperCode={config.detectedSubjectCode}
      subjectName={subjectName}
      accentColor={accentColor}
      level={1}
      totalLevels={1}
      objective={config.missionObjective}
      elapsedSeconds={remainingSeconds}
      score={score}
      combo={combo}
      hintText={hintText}
      hintSource={hintSource}
      hintLoading={hintLoading}
      intuitionText={intuition}
      feedbackBanner={feedback}
      completion={completion}
      onSelectLevel={() => {}}
      onRequestHint={handleHint}
      onReset={handleReset}
      onValidate={handleValidate}
      onExit={onExit}
      onNextLevel={() => {}}
      onResetCamera={() => orbitRigRef.current?.resetCamera()}
      isCustomLab
      customProgressText={`${calibratedSteps.length} / ${steps.length} calibrated`}
      onGenerateAnother={onGenerateAnother}
      validateLabel="Validate Custom Lab"
      controlsSlot={
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          {steps.map((label, idx) => {
            const done = calibratedSteps.includes(idx);
            const isNext = idx === calibratedSteps.length;
            return (
              <button
                key={`${idx}-${label}`}
                type="button"
                onClick={() => handleStepActivate(idx)}
                className={`px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                  done
                    ? "bg-[#00F5D4]/20 border-[#00F5D4] text-[#00F5D4] font-semibold"
                    : isNext
                    ? "bg-[#8B5CF6]/20 border-[#8B5CF6]/70 text-[#F4F7FB] hover:bg-[#8B5CF6]/35"
                    : "bg-[#111624] border-white/10 text-[#94A3B8] hover:border-white/25"
                }`}
              >
                {idx + 1}. {shortenLabel(label, 24)}
              </button>
            );
          })}

          {isEquilibrium && (
            <label className="flex items-center gap-2 ml-1 px-2.5 py-1 rounded-lg bg-[#090C14] border border-white/10">
              <span className="text-[#F59E0B]">Equilibrium:</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={sliderValue}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setSliderValue(val);
                  if (val >= 85) {
                    setIntuition(
                      `Equilibrium aligned at ${val}%. Finish calibrating stages and validate.`
                    );
                  }
                }}
                className="w-24 accent-[#F59E0B]"
              />
              <span className="text-[#F4F7FB] font-bold">{sliderValue}%</span>
            </label>
          )}
        </div>
      }
    >
      <div ref={mountRef} className="w-full h-full cursor-pointer" />
    </GameHudLayout>
  );
}
