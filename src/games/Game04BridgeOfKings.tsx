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

interface MathBridgeLevel {
  level: number;
  title: string;
  formulaPrompt: string;
  objective: string;
  inputLabel: string;
  options: { label: string; value: number }[];
  correctValue: number;
  numericMode?: boolean;
  hint: string;
  conceptTitle: string;
  conceptExplanation: string;
}

const LEVELS: MathBridgeLevel[] = [
  {
    level: 1,
    title: "Laplace Transform Pole Lock",
    formulaPrompt: "L{ e^(3t) } = 1 / (s - a)   for s > a",
    objective:
      "The floating harmonic bridge oscillates out of phase. Find the Laplace pole constant 'a' for f(t) = e^(3t) to lock the span across the chasm.",
    inputLabel: "Pole Constant a",
    options: [
      { label: "a = 1", value: 1 },
      { label: "a = 3", value: 3 },
      { label: "a = -3", value: -3 },
      { label: "a = 9", value: 9 },
    ],
    correctValue: 3,
    hint: "Recall the standard Laplace transform identity: L{ e^(at) } = 1 / (s - a). Match the exponent 3t.",
    conceptTitle: "Laplace Transform of Exponential Functions",
    conceptExplanation:
      "For any real constant a, L{ e^(at) } = ∫₀^∞ e^(-(s-a)t) dt = 1 / (s - a) with Region of Convergence s > a.",
  },
  {
    level: 2,
    title: "2nd-Order ODE Characteristic Roots",
    formulaPrompt: "y'' - 5y' + 6y = 0  →  r² - 5r + 6 = 0",
    objective:
      "Stabilize the twin suspension arches by finding the SUM of the characteristic roots (r₁ + r₂) for y'' - 5y' + 6y = 0.",
    inputLabel: "Sum of Roots (r₁ + r₂)",
    options: [
      { label: "r₁ + r₂ = 5  (roots 2, 3)", value: 5 },
      { label: "r₁ + r₂ = 6  (roots 1, 5)", value: 6 },
      { label: "r₁ + r₂ = -5 (roots -2, -3)", value: -5 },
      { label: "r₁ + r₂ = 1  (roots 3, -2)", value: 1 },
    ],
    correctValue: 5,
    hint: "Factor r² - 5r + 6 = (r - 2)(r - 3) = 0, so the roots are r₁ = 2 and r₂ = 3. Add them together.",
    conceptTitle: "Homogeneous 2nd-Order Linear ODEs",
    conceptExplanation:
      "The auxiliary equation r² - 5r + 6 = 0 yields distinct real roots r₁ = 2, r₂ = 3, giving the general solution y(x) = C₁e^(2x) + C₂e^(3x).",
  },
  {
    level: 3,
    title: "Dominant Eigenvalue Resonance",
    formulaPrompt: "A = [[4, 1], [2, 3]]   |   det(A - λI) = 0",
    objective:
      "Compute the dominant (largest) eigenvalue λ_max of matrix A = [[4, 1], [2, 3]] to finalize the keystone bridge lock.",
    inputLabel: "Dominant Eigenvalue λ_max",
    options: [
      { label: "λ_max = 2", value: 2 },
      { label: "λ_max = 4", value: 4 },
      { label: "λ_max = 5", value: 5 },
      { label: "λ_max = 7", value: 7 },
    ],
    correctValue: 5,
    hint: "Trace(A) = 4 + 3 = 7 and det(A) = 12 - 2 = 10. Solve λ² - 7λ + 10 = (λ - 5)(λ - 2) = 0.",
    conceptTitle: "Characteristic Polynomial & Eigenvalues",
    conceptExplanation:
      "For a 2×2 matrix A, λ² - tr(A)λ + det(A) = 0. Here λ² - 7λ + 10 = 0 gives eigenvalues λ = 5 and λ = 2; the dominant resonant mode is λ_max = 5.",
  },
];

interface Game04BridgeOfKingsProps {
  onExit: () => void;
}

export function Game04BridgeOfKings({ onExit }: Game04BridgeOfKingsProps) {
  const { recordLevelComplete, voiceEnabled } = useNexus();
  const voiceRef = useRef(voiceEnabled);
  voiceRef.current = voiceEnabled;

  const mountRef = useRef<HTMLDivElement>(null);
  const orbitRigRef = useRef<OrbitRigHandle | null>(null);
  const burstRef = useRef<CelebrationBurstHandle | null>(null);

  const [levelIdx, setLevelIdx] = useState(0);
  const currentLevel = LEVELS[levelIdx];

  const [selectedVal, setSelectedVal] = useState<number | null>(null);
  const [bridgeLocked, setBridgeLocked] = useState(false);

  const [elapsed, setElapsed] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [hintText, setHintText] = useState<string | null>(null);
  const [hintSource, setHintSource] = useState<"gemini" | "local">("local");
  const [hintLoading, setHintLoading] = useState(false);
  const [intuition, setIntuition] = useState(
    "Select a candidate mathematical parameter below to test the 3D bridge harmonic stability."
  );
  const [feedback, setFeedback] = useState<{ type: "error" | "info" | "success"; text: string } | null>(
    null
  );
  const [completion, setCompletion] = useState<LevelCompletePayload | null>(null);

  const stabilityRef = useRef({ locked: false, proximity: 0.25, formula: LEVELS[0].formulaPrompt });
  const proximity =
    selectedVal === null
      ? 0.2
      : selectedVal === currentLevel.correctValue
      ? 1.0
      : Math.max(0.25, 1 - Math.abs(selectedVal - currentLevel.correctValue) * 0.22);
  stabilityRef.current = {
    locked: bridgeLocked,
    proximity,
    formula: currentLevel.formulaPrompt,
  };

  const loadLevel = useCallback((idx: number) => {
    tutorVoice.cancel();
    const lvl = LEVELS[idx];
    setLevelIdx(idx);
    setSelectedVal(null);
    setBridgeLocked(false);
    setElapsed(0);
    setHintText(null);
    setFeedback(null);
    setCompletion(null);
    setIntuition(`Loaded Level ${lvl.level}: ${lvl.title}. Tune the mathematical constant to calm the harmonic span.`);
  }, []);

  useEffect(() => {
    if (completion) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [completion]);

  // Dedicated 3D Floating Archipelago & Harmonic Bridge Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06080e);
    scene.fog = new THREE.FogExp2(0x06080e, 0.018);

    const camera = new THREE.PerspectiveCamera(
      48,
      Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1),
      0.1,
      200
    );
    camera.position.set(0, 7.5, 17);

    const { renderer, isSoftwareGl } = createNexusRenderer(container);
    const envTex = attachStudioEnvironment(renderer, scene);
    addNexusLighting(scene);

    const orbitRig = createOrbitRig(camera, renderer.domElement, {
      initialPosition: new THREE.Vector3(0, 7.5, 17),
      initialTarget: new THREE.Vector3(0, 0.8, 0),
      minDistance: 7,
      maxDistance: 32,
    });
    orbitRigRef.current = orbitRig;

    const composer = createBloomComposer(renderer, scene, camera, isSoftwareGl, container);
    const burst = createCelebrationBurst(scene);
    burstRef.current = burst;

    // Two floating obsidian islands (composite groups: rocky cone + flat platform + pylon tower)
    [-8.5, 8.5].forEach((xPos, idx) => {
      const island = new THREE.Group();
      island.position.set(xPos, -1.2, 0);

      const base = new THREE.Mesh(
        new THREE.ConeGeometry(3.4, 4.5, 7),
        new THREE.MeshStandardMaterial({ color: 0x131a29, metalness: 0.4, roughness: 0.75 })
      );
      base.rotation.x = Math.PI;
      base.position.y = -2.25;
      island.add(base);

      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(3.5, 3.3, 0.6, 7),
        new THREE.MeshStandardMaterial({ color: 0x1d273b, metalness: 0.7, roughness: 0.3 })
      );
      island.add(cap);

      const pylon = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.9, 0),
        new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          emissive: 0xf59e0b,
          emissiveIntensity: 0.5,
          metalness: 0.8,
          roughness: 0.2,
        })
      );
      pylon.position.set(idx === 0 ? 1.8 : -1.8, 2.2, 0);
      island.add(pylon);

      const lbl = createTextSprite(idx === 0 ? "ORIGIN CITADEL" : "TARGET CITADEL", {
        border: "#F59E0B",
        color: "#FDE68A",
        width: 260,
        height: 68,
        fontSize: 22,
      });
      lbl.position.set(0, 3.6, 0);
      island.add(lbl);

      scene.add(island);
    });

    // 14 luminous harmonic bridge planks spanning from x = -5.2 to x = +5.2
    const plankCount = 14;
    const planks: THREE.Mesh[] = [];
    const plankGeo = new THREE.BoxGeometry(0.68, 0.22, 2.8);
    for (let i = 0; i < plankCount; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.45,
        metalness: 0.65,
        roughness: 0.25,
      });
      const plank = new THREE.Mesh(plankGeo, mat);
      const t = i / (plankCount - 1);
      plank.position.set(-5.2 + t * 10.4, -0.8, 0);
      scene.add(plank);
      planks.push(plank);
    }

    // Floating holographic equation banner in 3D space
    let eqSprite = createTextSprite(LEVELS[0].formulaPrompt, {
      border: "#F59E0B",
      color: "#F4F7FB",
      width: 560,
      height: 86,
      fontSize: 24,
    });
    eqSprite.position.set(0, 4.4, 0);
    eqSprite.scale.set(7.2, 1.15, 1);
    scene.add(eqSprite);
    let lastFormula = LEVELS[0].formulaPrompt;

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
      const { locked, proximity: prox, formula } = stabilityRef.current;

      if (formula !== lastFormula) {
        lastFormula = formula;
        scene.remove(eqSprite);
        eqSprite.material.map?.dispose();
        eqSprite.material.dispose();
        eqSprite = createTextSprite(formula, {
          border: "#F59E0B",
          color: "#F4F7FB",
          width: 560,
          height: 86,
          fontSize: 24,
        });
        eqSprite.position.set(0, 4.4, 0);
        eqSprite.scale.set(7.2, 1.15, 1);
        scene.add(eqSprite);
      }

      const amp = locked ? 0.03 : (1.15 - prox) * 1.45;
      planks.forEach((p, idx) => {
        const phase = idx * 0.55;
        p.position.y = -0.85 + Math.sin(t * 3.2 + phase) * amp;
        p.rotation.z = Math.cos(t * 2.5 + phase) * amp * 0.25;
        const m = p.material as THREE.MeshStandardMaterial;
        const targetColor = locked ? 0x00f5d4 : prox > 0.8 ? 0xf59e0b : 0xef4444;
        m.color.setHex(targetColor);
        m.emissive.setHex(targetColor);
      });

      burst.update(dt);
      orbitRig.update(dt);
      composer.render();
    });
    loop.start();

    return () => {
      loop.stop();
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

  const handleSelectOption = (val: number) => {
    setSelectedVal(val);
    const isExact = val === currentLevel.correctValue;
    if (isExact) {
      burstRef.current?.trigger(new THREE.Vector3(0, 0.2, 0), 0xf59e0b);
    }
    const msg = isExact
      ? "Harmonic resonance stabilized! Bridge phase drift dropped to zero — press Construct Bridge."
      : "Bridge still oscillating — this constant leaves residual phase error in the equation.";
    setIntuition(msg);
    requestAiIntuition({
      gameTitle: "Bridge of Kings",
      subject: "BSC-301 Mathematics-III",
      action: `Tested parameter value ${val} for ${currentLevel.formulaPrompt}`,
      stateSummary: JSON.stringify({ selectedVal: val, targetFormula: currentLevel.formulaPrompt }),
      fallbackIntuition: msg,
    }).then((r) => setIntuition(r.text));
  };

  const handleValidate = () => {
    if (selectedVal === currentLevel.correctValue) {
      setBridgeLocked(true);
      const earnedScore = Math.max(250, 500 - elapsed * 2) * combo;
      const xpEarned = 230 + currentLevel.level * 50;
      setScore((s) => s + earnedScore);
      setCombo((c) => c + 1);
      const successMsg = "Harmonic bridge locked! Structural resonance verified.";
      setFeedback({ type: "success", text: successMsg });
      setIntuition(currentLevel.conceptExplanation);
      burstRef.current?.trigger(new THREE.Vector3(0, 0.8, 0), 0x00f5d4);
      tutorVoice.speak(successMsg, voiceRef.current);
      recordLevelComplete("bridge-kings", currentLevel.level, earnedScore, xpEarned);
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
      const errMsg =
        selectedVal === null
          ? "Select a parameter value first to stabilize the harmonic bridge."
          : "Unstable bridge harmonics! Re-check the mathematical identity or use 3D Hint Beam.";
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
      gameTitle: "Bridge of Kings",
      subject: "BSC-301 Mathematics-III",
      level: currentLevel.level,
      objective: currentLevel.objective,
      gameState: { formula: currentLevel.formulaPrompt, selectedVal },
      fallbackHint: currentLevel.hint,
    });
    setHintText(res.text);
    setHintSource(res.source);
    setHintLoading(false);
    tutorVoice.speak(res.text, voiceRef.current);
  };

  return (
    <GameHudLayout
      title="Bridge of Kings"
      paperCode="BSC-301"
      subjectName="Mathematics-III"
      accentColor="#F59E0B"
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
      validateLabel="Construct Bridge"
      controlsSlot={
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="text-[#FDE68A]">{currentLevel.inputLabel}:</span>
          {currentLevel.options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleSelectOption(opt.value)}
              className={`px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                selectedVal === opt.value
                  ? "bg-[#F59E0B] text-[#06080E] border-[#F59E0B] font-bold"
                  : "bg-[#111624] text-[#E2E8F0] border-white/10 hover:border-[#F59E0B]/60"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      }
    >
      <div ref={mountRef} className="w-full h-full" />
    </GameHudLayout>
  );
}
