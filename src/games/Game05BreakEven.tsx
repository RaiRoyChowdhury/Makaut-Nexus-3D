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

interface EconLevel {
  level: number;
  title: string;
  objective: string;
  fixedCost: number;
  variableCost: number;
  initialPrice: number;
  initialQty: number;
  lockPrice?: boolean;
  validate: (p: number, v: number, f: number, q: number) => { ok: boolean; message: string };
  hint: string;
  conceptTitle: string;
  conceptExplanation: string;
}

const LEVELS: EconLevel[] = [
  {
    level: 1,
    title: "Exact Break-Even Horizon",
    objective:
      "Fixed Cost F = ₹60,000, Variable Cost V = ₹200/unit, Selling Price P = ₹500/unit. Adjust Production Quantity Q to hit exact Break-Even (Profit = ₹0).",
    fixedCost: 60000,
    variableCost: 200,
    initialPrice: 500,
    initialQty: 80,
    lockPrice: true,
    validate: (p, v, f, q) => {
      const profit = (p - v) * q - f;
      if (Math.abs(profit) <= 500) {
        return { ok: true, message: `Break-Even Horizon reached at Q = ${q} units (Profit = ₹${profit})!` };
      }
      return {
        ok: false,
        message: `Current Profit is ₹${profit.toLocaleString()}. Tune Q so Total Revenue equals Total Cost.`,
      };
    },
    hint: "Use Q_BE = Fixed Cost / (Selling Price - Variable Cost) = 60,000 / (500 - 200).",
    conceptTitle: "Break-Even Quantity & Contribution Margin",
    conceptExplanation:
      "Break-Even occurs where Total Revenue (P·Q) equals Total Cost (F + V·Q), giving Q_BE = F / (P - V). Here contribution margin is ₹300/unit, so Q_BE = 200 units.",
  },
  {
    level: 2,
    title: "Target Profit Expansion",
    objective:
      "Fixed Cost F = ₹80,000, Variable Cost V = ₹300/unit, Selling Price P = ₹700/unit. Scale Quantity Q to achieve an exact Net Profit of ₹40,000.",
    fixedCost: 80000,
    variableCost: 300,
    initialPrice: 700,
    initialQty: 150,
    lockPrice: true,
    validate: (p, v, f, q) => {
      const profit = (p - v) * q - f;
      if (Math.abs(profit - 40000) <= 1000) {
        return { ok: true, message: `Target Profit ₹${profit.toLocaleString()} achieved at Q = ${q} units!` };
      }
      return {
        ok: false,
        message: `Current Profit is ₹${profit.toLocaleString()} (Target: ₹40,000). Adjust Production Quantity Q.`,
      };
    },
    hint: "Target Quantity = (Fixed Cost + Target Profit) / (P - V) = (80,000 + 40,000) / (700 - 300).",
    conceptTitle: "Cost-Volume-Profit (CVP) Target Planning",
    conceptExplanation:
      "To earn a target profit Π, required volume is Q = (F + Π) / (P - V). With ₹400 contribution per unit, covering ₹120,000 total requires Q = 300 units.",
  },
  {
    level: 3,
    title: "Inflation Shock Margin Defense",
    objective:
      "Raw material inflation raised Variable Cost V to ₹450/unit (F = ₹50,000). Tune Selling Price P (≤ ₹800) and Quantity Q (≤ 400) so Net Profit ≥ ₹55,000 AND Profit Margin ≥ 25%.",
    fixedCost: 50000,
    variableCost: 450,
    initialPrice: 600,
    initialQty: 200,
    lockPrice: false,
    validate: (p, v, f, q) => {
      const rev = p * q;
      const profit = rev - (f + v * q);
      const margin = rev > 0 ? (profit / rev) * 100 : 0;
      if (profit >= 55000 && margin >= 25) {
        return {
          ok: true,
          message: `Inflation defense succeeded! Profit ₹${profit.toLocaleString()} at ${margin.toFixed(1)}% margin.`,
        };
      }
      return {
        ok: false,
        message: `Profit ₹${profit.toLocaleString()} (${margin.toFixed(1)}% margin). Need Profit ≥ ₹55,000 and Margin ≥ 25%.`,
      };
    },
    hint: "Raise Selling Price P toward ₹750–₹800 to widen contribution margin, then scale Q above 320 units.",
    conceptTitle: "Operating Leverage & Marginal Pricing Under Inflation",
    conceptExplanation:
      "When variable costs spike, unit contribution shrinks rapidly. Raising price expands margin per unit while scaling output spreads fixed costs across more units.",
  },
];

interface Game05BreakEvenProps {
  onExit: () => void;
}

export function Game05BreakEven({ onExit }: Game05BreakEvenProps) {
  const { recordLevelComplete, voiceEnabled } = useNexus();
  const voiceRef = useRef(voiceEnabled);
  voiceRef.current = voiceEnabled;

  const mountRef = useRef<HTMLDivElement>(null);
  const orbitRigRef = useRef<OrbitRigHandle | null>(null);
  const burstRef = useRef<CelebrationBurstHandle | null>(null);

  const [levelIdx, setLevelIdx] = useState(0);
  const currentLevel = LEVELS[levelIdx];

  const [price, setPrice] = useState(LEVELS[0].initialPrice);
  const [qty, setQty] = useState(LEVELS[0].initialQty);

  const [elapsed, setElapsed] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [hintText, setHintText] = useState<string | null>(null);
  const [hintSource, setHintSource] = useState<"gemini" | "local">("local");
  const [hintLoading, setHintLoading] = useState(false);
  const [intuition, setIntuition] = useState(
    "Adjust the production sliders below to watch the 3D Revenue vs. Cost towers cross the Break-Even Horizon."
  );
  const [feedback, setFeedback] = useState<{ type: "error" | "info" | "success"; text: string } | null>(
    null
  );
  const [completion, setCompletion] = useState<LevelCompletePayload | null>(null);

  const F = currentLevel.fixedCost;
  const V = currentLevel.variableCost;
  const totalRevenue = price * qty;
  const totalCost = F + V * qty;
  const profit = totalRevenue - totalCost;
  const breakEvenQty = price > V ? Math.round(F / (price - V)) : 0;

  const econRef = useRef({ totalRevenue, totalCost, profit, qty, breakEvenQty, F });
  econRef.current = { totalRevenue, totalCost, profit, qty, breakEvenQty, F };

  const loadLevel = useCallback((idx: number) => {
    tutorVoice.cancel();
    const lvl = LEVELS[idx];
    setLevelIdx(idx);
    setPrice(lvl.initialPrice);
    setQty(lvl.initialQty);
    setElapsed(0);
    setHintText(null);
    setFeedback(null);
    setCompletion(null);
    setIntuition(`Loaded Level ${lvl.level}: ${lvl.title}. Balance Revenue and Total Cost in 3D.`);
  }, []);

  useEffect(() => {
    if (completion) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [completion]);

  // Dedicated 3D Cyber-Factory & Volumetric Cost-Revenue Chart Scene
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
    camera.position.set(0, 8.5, 16.5);

    const { renderer, isSoftwareGl } = createNexusRenderer(container);
    const envTex = attachStudioEnvironment(renderer, scene);
    addNexusLighting(scene);

    const orbitRig = createOrbitRig(camera, renderer.domElement, {
      initialPosition: new THREE.Vector3(0, 8.5, 16.5),
      initialTarget: new THREE.Vector3(0, 2.2, 0),
      minDistance: 7,
      maxDistance: 32,
    });
    orbitRigRef.current = orbitRig;

    const composer = createBloomComposer(renderer, scene, camera, isSoftwareGl, container);
    const burst = createCelebrationBurst(scene);
    burstRef.current = burst;

    // Industrial floor & grid
    const grid = new THREE.GridHelper(34, 34, 0x10b981, 0x162033);
    grid.position.y = -1.5;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.28;
    scene.add(grid);

    // Three 3D Volumetric Financial Towers: Fixed Cost, Total Cost, Total Revenue
    const towerGroup = new THREE.Group();
    scene.add(towerGroup);

    const makeTower = (x: number, color: number) => {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 1, 2.4),
        new THREE.MeshStandardMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.32,
          metalness: 0.65,
          roughness: 0.25,
        })
      );
      mesh.position.set(x, -1.0, 0);
      towerGroup.add(mesh);
      return mesh;
    };

    const fixedBar = makeTower(-4.5, 0x64748b);
    const costBar = makeTower(0, 0xf59e0b);
    const revBar = makeTower(4.5, 0x10b981);

    // Break-Even Horizon glowing ring plane
    const horizonPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 5),
      new THREE.MeshBasicMaterial({
        color: 0x00f5d4,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.14,
      })
    );
    horizonPlane.rotation.x = Math.PI / 2;
    scene.add(horizonPlane);

    // Static column labels
    const lblF = createTextSprite("FIXED COST (F)", { border: "#64748B", width: 250, height: 64, fontSize: 21 });
    lblF.position.set(-4.5, -1.2, 2.2);
    scene.add(lblF);
    const lblC = createTextSprite("TOTAL COST (TC)", { border: "#F59E0B", width: 260, height: 64, fontSize: 21 });
    lblC.position.set(0, -1.2, 2.2);
    scene.add(lblC);
    const lblR = createTextSprite("REVENUE (TR)", { border: "#10B981", width: 250, height: 64, fontSize: 21 });
    lblR.position.set(4.5, -1.2, 2.2);
    scene.add(lblR);

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
      const { totalRevenue: tr, totalCost: tc, profit: pr, F: fixed } = econRef.current;
      const scaleDiv = 36000;

      const hF = Math.max(0.4, Math.min(8.5, fixed / scaleDiv));
      const hC = Math.max(0.4, Math.min(8.5, tc / scaleDiv));
      const hR = Math.max(0.4, Math.min(8.5, tr / scaleDiv));

      fixedBar.scale.y += (hF - fixedBar.scale.y) * 0.12;
      fixedBar.position.y = -1.5 + fixedBar.scale.y * 0.5;

      costBar.scale.y += (hC - costBar.scale.y) * 0.12;
      costBar.position.y = -1.5 + costBar.scale.y * 0.5;

      revBar.scale.y += (hR - revBar.scale.y) * 0.12;
      revBar.position.y = -1.5 + revBar.scale.y * 0.5;

      const revMat = revBar.material as THREE.MeshStandardMaterial;
      revMat.color.setHex(pr >= 0 ? 0x10b981 : 0xef4444);
      revMat.emissive.setHex(pr >= 0 ? 0x10b981 : 0xef4444);

      horizonPlane.position.y = -1.5 + costBar.scale.y;

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

  const handleValidate = () => {
    const res = currentLevel.validate(price, V, F, qty);
    if (res.ok) {
      const earnedScore = Math.max(250, 500 - elapsed * 2) * combo;
      const xpEarned = 230 + currentLevel.level * 50;
      setScore((s) => s + earnedScore);
      setCombo((c) => c + 1);
      setFeedback({ type: "success", text: res.message });
      setIntuition(currentLevel.conceptExplanation);
      burstRef.current?.trigger(new THREE.Vector3(4.5, 2.2, 0), 0x10b981);
      tutorVoice.speak(res.message, voiceRef.current);
      recordLevelComplete("break-even", currentLevel.level, earnedScore, xpEarned);
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
      gameTitle: "Break-Even Horizon",
      subject: "HSMC-301 Economics for Engineers",
      level: currentLevel.level,
      objective: currentLevel.objective,
      gameState: { F, V, price, qty, profit, breakEvenQty },
      fallbackHint: currentLevel.hint,
    });
    setHintText(res.text);
    setHintSource(res.source);
    setHintLoading(false);
    tutorVoice.speak(res.text, voiceRef.current);
  };

  const handleQtyChange = (val: number) => {
    setQty(val);
    const newProfit = (price - V) * val - F;
    const msg =
      Math.abs(newProfit) <= 500
        ? `Exact Break-Even equilibrium at Q=${val}: Total Revenue matches Total Cost.`
        : newProfit > 0
        ? `Operating in Profit Zone (+₹${newProfit.toLocaleString()}) above Break-Even (${breakEvenQty} units).`
        : `Operating in Loss Zone (₹${newProfit.toLocaleString()}) below Break-Even (${breakEvenQty} units).`;
    setIntuition(msg);
  };

  return (
    <GameHudLayout
      title="Break-Even Horizon"
      paperCode="HSMC-301"
      subjectName="Economics for Engineers"
      accentColor="#10B981"
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
      validateLabel="Lock Production Plan"
      controlsSlot={
        <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
          <label className="flex items-center gap-2">
            <span className="text-[#94A3B8]">Qty Q:</span>
            <input
              type="range"
              min={50}
              max={400}
              step={10}
              value={qty}
              onChange={(e) => handleQtyChange(Number(e.target.value))}
              className="w-28 accent-[#10B981]"
            />
            <span className="text-[#F4F7FB] font-bold w-12">{qty} u</span>
          </label>

          {!currentLevel.lockPrice && (
            <label className="flex items-center gap-2">
              <span className="text-[#94A3B8]">Price P:</span>
              <input
                type="range"
                min={500}
                max={800}
                step={25}
                value={price}
                onChange={(e) => {
                  const p = Number(e.target.value);
                  setPrice(p);
                  requestAiIntuition({
                    gameTitle: "Break-Even Horizon",
                    subject: "HSMC-301 Economics for Engineers",
                    action: `Adjusted selling price to ₹${p}`,
                    stateSummary: JSON.stringify({ p, V, F, qty }),
                    fallbackIntuition: `Unit contribution margin is now ₹${p - V}/unit.`,
                  }).then((r) => setIntuition(r.text));
                }}
                className="w-24 accent-[#00F5D4]"
              />
              <span className="text-[#00F5D4] font-bold">₹{price}</span>
            </label>
          )}

          <div className="flex items-center gap-3 text-[11px]">
            <span className="text-[#F59E0B]">TC: ₹{totalCost.toLocaleString()}</span>
            <span className="text-[#10B981]">TR: ₹{totalRevenue.toLocaleString()}</span>
            <span className={profit >= 0 ? "text-[#00F5D4] font-bold" : "text-[#EF4444] font-bold"}>
              Profit: ₹{profit.toLocaleString()}
            </span>
          </div>
        </div>
      }
    >
      <div ref={mountRef} className="w-full h-full" />
    </GameHudLayout>
  );
}
