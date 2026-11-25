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

interface PointerNodeDef {
  id: string;
  label: string;
  value: number;
  pos: [number, number, number];
  initialNext: string | null;
}

interface PointerLevel {
  level: number;
  title: string;
  objective: string;
  headId: string;
  nodes: PointerNodeDef[];
  validate: (pointers: Record<string, string | null>, headId: string) => {
    ok: boolean;
    message: string;
  };
  hint: string;
  conceptTitle: string;
  conceptExplanation: string;
  allowHeadChange?: boolean;
}

const LEVELS: PointerLevel[] = [
  {
    level: 1,
    title: "Break Floyd's Pointer Cycle",
    objective:
      "Node 0x30 currently loops back to 0x20, causing an infinite memory cycle. Click 0x30 in 3D and connect its next pointer to NULL.",
    headId: "0x10",
    nodes: [
      { id: "0x10", label: "0x10 [12]", value: 12, pos: [-5.5, 0.8, 0], initialNext: "0x20" },
      { id: "0x20", label: "0x20 [24]", value: 24, pos: [-1.2, 1.2, -1.5], initialNext: "0x30" },
      { id: "0x30", label: "0x30 [36]", value: 36, pos: [3.2, 0.9, 1.2], initialNext: "0x20" },
    ],
    validate: (p) => {
      if (p["0x10"] === "0x20" && p["0x20"] === "0x30" && p["0x30"] === null) {
        return { ok: true, message: "Cycle broken! List terminates cleanly at NULL." };
      }
      return {
        ok: false,
        message: "Expected chain: 0x10 → 0x20 → 0x30 → NULL. Select 0x30 and route to NULL.",
      };
    },
    hint: "In Floyd's cycle detection, the tail node points back to an earlier node instead of NULL. Click node 0x30, then click NULL.",
    conceptTitle: "Cycle Detection & Termination in Singly Linked Lists",
    conceptExplanation:
      "A valid singly linked list must terminate with a NULL next pointer. A back-edge creates a cycle detectable in O(n) time and O(1) space via Floyd's Tortoise and Hare pointers.",
  },
  {
    level: 2,
    title: "Mid-List O(1) Node Insertion",
    objective:
      "Floating node 0x25 [25] is detached in heap memory. Splice 0x25 between 0x20 and 0x30 to produce sorted order: 0x10 → 0x20 → 0x25 → 0x30 → NULL.",
    headId: "0x10",
    nodes: [
      { id: "0x10", label: "0x10 [10]", value: 10, pos: [-6, 0.8, 0], initialNext: "0x20" },
      { id: "0x20", label: "0x20 [20]", value: 20, pos: [-2, 0.8, 0.8], initialNext: "0x30" },
      { id: "0x25", label: "0x25 [25]", value: 25, pos: [0.5, 3.2, -1.8], initialNext: null },
      { id: "0x30", label: "0x30 [30]", value: 30, pos: [4.2, 0.8, 0.4], initialNext: null },
    ],
    validate: (p) => {
      if (
        p["0x10"] === "0x20" &&
        p["0x20"] === "0x25" &&
        p["0x25"] === "0x30" &&
        p["0x30"] === null
      ) {
        return { ok: true, message: "Sorted O(1) pointer splice verified!" };
      }
      return {
        ok: false,
        message: "Required chain: 0x10 → 0x20 → 0x25 → 0x30 → NULL. Wire 0x25 → 0x30 and 0x20 → 0x25.",
      };
    },
    hint: "To avoid losing the rest of the list, first point 0x25.next to 0x30, then redirect 0x20.next to 0x25.",
    conceptTitle: "O(1) Pointer Rewiring for Linked List Insertion",
    conceptExplanation:
      "Unlike contiguous arrays that require O(n) element shifting, inserting a node into a linked list after a known predecessor takes O(1) pointer updates: newNode.next = prev.next; prev.next = newNode.",
  },
  {
    level: 3,
    title: "In-Place Linked List Reversal",
    objective:
      "Reverse the entire 3-node list in-place! Rewire pointers so HEAD starts at 0x30 and traverses 0x30 → 0x20 → 0x10 → NULL.",
    headId: "0x10",
    allowHeadChange: true,
    nodes: [
      { id: "0x10", label: "0x10 [A]", value: 1, pos: [-4.5, 1.0, 0], initialNext: "0x20" },
      { id: "0x20", label: "0x20 [B]", value: 2, pos: [0, 1.5, -1.2], initialNext: "0x30" },
      { id: "0x30", label: "0x30 [C]", value: 3, pos: [4.5, 1.0, 0], initialNext: null },
    ],
    validate: (p, headId) => {
      if (
        headId === "0x30" &&
        p["0x30"] === "0x20" &&
        p["0x20"] === "0x10" &&
        p["0x10"] === null
      ) {
        return { ok: true, message: "In-place O(n) reversal complete with HEAD at 0x30!" };
      }
      return {
        ok: false,
        message: "Set HEAD to 0x30 and rewire: 0x30 → 0x20 → 0x10 → NULL.",
      };
    },
    hint: "Point 0x30 to 0x20, 0x20 to 0x10, 0x10 to NULL, and update the HEAD pointer to 0x30 using the dock control.",
    conceptTitle: "Iterative In-Place List Reversal (Three-Pointer Pattern)",
    conceptExplanation:
      "Reversing a singly linked list in O(n) time and O(1) auxiliary space tracks prev, curr, and nextTemp pointers so each node's next edge flips without dropping references.",
  },
];

interface Game01PointerProps {
  onExit: () => void;
}

export function Game01Pointer({ onExit }: Game01PointerProps) {
  const { recordLevelComplete, voiceEnabled } = useNexus();
  const voiceRef = useRef(voiceEnabled);
  voiceRef.current = voiceEnabled;

  const mountRef = useRef<HTMLDivElement>(null);
  const orbitRigRef = useRef<OrbitRigHandle | null>(null);
  const burstRef = useRef<CelebrationBurstHandle | null>(null);

  const [levelIdx, setLevelIdx] = useState(0);
  const currentLevel = LEVELS[levelIdx];

  const [pointers, setPointers] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(LEVELS[0].nodes.map((n) => [n.id, n.initialNext]))
  );
  const [headId, setHeadId] = useState<string>(LEVELS[0].headId);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(1);
  const [hintText, setHintText] = useState<string | null>(null);
  const [hintSource, setHintSource] = useState<"gemini" | "local">("local");
  const [hintLoading, setHintLoading] = useState(false);
  const [intuition, setIntuition] = useState(
    "Click any 3D memory node to select it, then click a target node (or NULL) to rewire its next pointer."
  );
  const [feedback, setFeedback] = useState<{ type: "error" | "info" | "success"; text: string } | null>(
    null
  );
  const [completion, setCompletion] = useState<LevelCompletePayload | null>(null);

  // Refs synced to Three.js render loop without remounting WebGL
  const stateRef = useRef({
    levelIdx,
    pointers,
    headId,
    selectedNodeId,
  });
  stateRef.current = { levelIdx, pointers, headId, selectedNodeId };

  const loadLevel = useCallback((idx: number) => {
    tutorVoice.cancel();
    const lvl = LEVELS[idx];
    setLevelIdx(idx);
    setPointers(Object.fromEntries(lvl.nodes.map((n) => [n.id, n.initialNext])));
    setHeadId(lvl.headId);
    setSelectedNodeId(null);
    setElapsed(0);
    setHintText(null);
    setFeedback(null);
    setCompletion(null);
    setIntuition(`Loaded Level ${lvl.level}: ${lvl.title}. Click a 3D node to begin rewiring.`);
  }, []);

  // Timer
  useEffect(() => {
    if (completion) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [completion]);

  const handleNodeInteraction = useCallback(
    async (clickedId: string) => {
      if (completion) return;
      if (!selectedNodeId) {
        if (clickedId === "NULL") {
          setFeedback({ type: "info", text: "Select a memory node first before targeting NULL." });
          return;
        }
        setSelectedNodeId(clickedId);
        setFeedback({
          type: "info",
          text: `Selected ${clickedId}. Now click another node or NULL to assign ${clickedId}.next.`,
        });
        return;
      }

      if (selectedNodeId === clickedId) {
        setSelectedNodeId(null);
        setFeedback(null);
        return;
      }

      const targetNext = clickedId === "NULL" ? null : clickedId;
      const fromId = selectedNodeId;
      setPointers((prev) => ({ ...prev, [fromId]: targetNext }));
      setSelectedNodeId(null);
      burstRef.current?.trigger(new THREE.Vector3(0, 1.0, 0), 0x00f5d4);
      setFeedback({
        type: "info",
        text: `Rewired ${fromId}.next → ${targetNext ?? "NULL"}`,
      });

      const fallbackMsg =
        targetNext === null
          ? `Pointer ${fromId}.next now terminates at NULL, preventing dangling traversal past this node.`
          : `Pointer ${fromId}.next now references ${targetNext} in O(1) time without reallocating memory.`;
      setIntuition(fallbackMsg);

      // Fire non-blocking Gemini AI Intuition
      requestAiIntuition({
        gameTitle: "Unknot the Pointer 3D",
        subject: "PCC-CS301 Data Structures & Algorithms",
        action: `Set ${fromId}.next = ${targetNext ?? "NULL"}`,
        stateSummary: JSON.stringify({ ...pointers, [fromId]: targetNext }),
        fallbackIntuition: fallbackMsg,
      }).then((res) => setIntuition(res.text));
    },
    [completion, selectedNodeId, pointers]
  );

  const interactionRef = useRef(handleNodeInteraction);
  interactionRef.current = handleNodeInteraction;

  // Dedicated Three.js 3D Memory Heap Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06080e);
    scene.fog = new THREE.FogExp2(0x06080e, 0.025);

    const camera = new THREE.PerspectiveCamera(
      48,
      Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1),
      0.1,
      200
    );
    camera.position.set(0, 6.5, 14.5);

    const { renderer, isSoftwareGl } = createNexusRenderer(container);
    const envTex = attachStudioEnvironment(renderer, scene);
    addNexusLighting(scene);

    const orbitRig = createOrbitRig(camera, renderer.domElement, {
      initialPosition: new THREE.Vector3(0, 6.5, 14.5),
      initialTarget: new THREE.Vector3(0, 1.0, 0),
      minDistance: 6,
      maxDistance: 28,
    });
    orbitRigRef.current = orbitRig;

    const composer = createBloomComposer(renderer, scene, camera, isSoftwareGl, container);
    const burst = createCelebrationBurst(scene);
    burstRef.current = burst;

    // Memory floor grid
    const grid = new THREE.GridHelper(36, 36, 0x00f5d4, 0x182235);
    grid.position.y = -2.2;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.28;
    scene.add(grid);

    const dynamicGroup = new THREE.Group();
    scene.add(dynamicGroup);

    const clickables: THREE.Object3D[] = [];
    const packets: { mesh: THREE.Mesh; curve: THREE.QuadraticBezierCurve3; t: number; speed: number }[] = [];
    const nodeGroups: Record<string, THREE.Group> = {};
    let lastRenderedKey = "";

    const nullPos = new THREE.Vector3(7.2, 0.8, 0);

    function rebuildGraph() {
      while (dynamicGroup.children.length > 0) {
        const c = dynamicGroup.children[0];
        dynamicGroup.remove(c);
      }
      clickables.length = 0;
      packets.length = 0;
      Object.keys(nodeGroups).forEach((k) => delete nodeGroups[k]);

      const lvl = LEVELS[stateRef.current.levelIdx];
      const curPointers = stateRef.current.pointers;
      const curHead = stateRef.current.headId;
      const curSel = stateRef.current.selectedNodeId;

      const posMap: Record<string, THREE.Vector3> = {};

      // Detect if a cycle exists for visual distortion/warning
      const visited = new Set<string>();
      let hasCycle = false;
      let walk: string | null = curHead;
      while (walk) {
        if (visited.has(walk)) {
          hasCycle = true;
          break;
        }
        visited.add(walk);
        walk = curPointers[walk] ?? null;
      }

      lvl.nodes.forEach((n) => {
        const g = new THREE.Group();
        const pos = new THREE.Vector3(...n.pos);
        posMap[n.id] = pos;
        g.position.copy(pos);

        const isSelected = curSel === n.id;
        const isHead = curHead === n.id;

        // Composite 3D Memory Node: outer titanium housing + glowing core + base ring
        const housing = new THREE.Mesh(
          new THREE.BoxGeometry(2.1, 1.35, 1.35),
          new THREE.MeshStandardMaterial({
            color: isSelected ? 0x00f5d4 : 0x162033,
            metalness: 0.78,
            roughness: 0.25,
            emissive: isSelected ? 0x00f5d4 : isHead ? 0x8b5cf6 : 0x0a1322,
            emissiveIntensity: isSelected ? 0.5 : 0.22,
          })
        );
        housing.userData = { nodeId: n.id };
        g.add(housing);
        clickables.push(housing);

        const core = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.42, 0),
          new THREE.MeshStandardMaterial({
            color: hasCycle ? 0xef4444 : 0x00f5d4,
            emissive: hasCycle ? 0xef4444 : 0x00f5d4,
            emissiveIntensity: 0.7,
            metalness: 0.3,
            roughness: 0.2,
          })
        );
        core.position.set(0, 1.05, 0);
        g.add(core);

        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(1.35, 0.045, 12, 36),
          new THREE.MeshBasicMaterial({
            color: isSelected ? 0x00f5d4 : isHead ? 0x8b5cf6 : 0x334155,
          })
        );
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -0.85;
        g.add(ring);

        const label = createTextSprite(isHead ? `HEAD · ${n.label}` : n.label, {
          border: isSelected ? "#00F5D4" : isHead ? "#8B5CF6" : "rgba(148,163,184,0.45)",
          color: isSelected ? "#00F5D4" : "#F4F7FB",
        });
        label.position.set(0, 1.85, 0);
        g.add(label);

        dynamicGroup.add(g);
        nodeGroups[n.id] = g;
      });

      // NULL Terminal Crystal
      const nullGroup = new THREE.Group();
      nullGroup.position.copy(nullPos);
      const nullMesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.95, 0),
        new THREE.MeshStandardMaterial({
          color: 0x334155,
          emissive: 0x8b5cf6,
          emissiveIntensity: 0.35,
          metalness: 0.8,
          roughness: 0.2,
        })
      );
      nullMesh.userData = { nodeId: "NULL" };
      nullGroup.add(nullMesh);
      clickables.push(nullMesh);

      const nullWire = new THREE.LineSegments(
        new THREE.WireframeGeometry(new THREE.OctahedronGeometry(1.25, 0)),
        new THREE.LineBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.6 })
      );
      nullGroup.add(nullWire);

      const nullLbl = createTextSprite("NULL (0x00)", {
        border: "#8B5CF6",
        color: "#DDD6FE",
        width: 240,
      });
      nullLbl.position.set(0, 1.65, 0);
      nullGroup.add(nullLbl);
      dynamicGroup.add(nullGroup);

      // Pointer Bezier Tubes + Animated Packets
      lvl.nodes.forEach((n) => {
        const dstId = curPointers[n.id];
        const start = posMap[n.id];
        const end = dstId ? posMap[dstId] : nullPos;
        if (!start || !end) return;

        const isBackEdge =
          dstId !== null &&
          lvl.nodes.findIndex((x) => x.id === dstId) <= lvl.nodes.findIndex((x) => x.id === n.id);
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        mid.y += isBackEdge ? 2.6 : 1.15;
        if (isBackEdge) mid.z += 1.8;

        const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
        const tubeGeo = new THREE.TubeGeometry(curve, 28, 0.065, 8, false);
        const edgeColor = hasCycle && isBackEdge ? 0xef4444 : dstId === null ? 0x8b5cf6 : 0x00f5d4;
        const tubeMat = new THREE.MeshStandardMaterial({
          color: edgeColor,
          emissive: edgeColor,
          emissiveIntensity: 0.55,
          roughness: 0.3,
        });
        dynamicGroup.add(new THREE.Mesh(tubeGeo, tubeMat));

        const pkt = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 10, 10),
          new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        dynamicGroup.add(pkt);
        packets.push({ mesh: pkt, curve, t: Math.random(), speed: 0.38 });
      });
    }

    // Raycasting on click
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
        const nodeId = hits[0].object.userData?.nodeId;
        if (nodeId) interactionRef.current(nodeId);
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
      if (key !== lastRenderedKey) {
        lastRenderedKey = key;
        rebuildGraph();
      }

      Object.values(nodeGroups).forEach((g, idx) => {
        g.position.y = LEVELS[stateRef.current.levelIdx].nodes[idx].pos[1] + Math.sin(t * 1.8 + idx) * 0.14;
      });

      packets.forEach((p) => {
        p.t = (p.t + dt * p.speed) % 1;
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
  }, []);

  const handleValidate = () => {
    const res = currentLevel.validate(pointers, headId);
    if (res.ok) {
      const earnedScore = Math.max(250, 500 - elapsed * 2) * combo;
      const xpEarned = 220 + currentLevel.level * 50;
      setScore((s) => s + earnedScore);
      setCombo((c) => c + 1);
      setFeedback({ type: "success", text: res.message });
      setIntuition(currentLevel.conceptExplanation);
      burstRef.current?.trigger(new THREE.Vector3(0, 1.2, 0), 0x00f5d4);
      tutorVoice.speak(res.message, voiceRef.current);
      recordLevelComplete("pointer-3d", currentLevel.level, earnedScore, xpEarned);
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
      gameTitle: "Unknot the Pointer 3D",
      subject: "PCC-CS301 Data Structures & Algorithms",
      level: currentLevel.level,
      objective: currentLevel.objective,
      gameState: { headId, pointers },
      fallbackHint: currentLevel.hint,
    });
    setHintText(res.text);
    setHintSource(res.source);
    setHintLoading(false);
    tutorVoice.speak(res.text, voiceRef.current);
  };

  return (
    <GameHudLayout
      title="Unknot the Pointer 3D"
      paperCode="PCC-CS301"
      subjectName="Data Structures & Algorithms"
      accentColor="#00F5D4"
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
      validateLabel="Commit Pointer Patch"
      controlsSlot={
        <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
          <span className="text-[#94A3B8]">
            {selectedNodeId ? `Wire ${selectedNodeId}.next →` : "Click 3D node or pick:"}
          </span>
          {currentLevel.nodes.map((n) => (
            <button
              key={n.id}
              onClick={() => handleNodeInteraction(n.id)}
              className={`px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                selectedNodeId === n.id
                  ? "bg-[#00F5D4] text-[#06080E] border-[#00F5D4] font-bold"
                  : "bg-[#111624] text-[#E2E8F0] border-white/10 hover:border-[#00F5D4]/60"
              }`}
            >
              {n.id} → {pointers[n.id] ?? "NULL"}
            </button>
          ))}
          <button
            onClick={() => handleNodeInteraction("NULL")}
            className="px-2.5 py-1.5 rounded-lg bg-[#8B5CF6]/20 border border-[#8B5CF6]/45 text-[#DDD6FE] hover:bg-[#8B5CF6]/35 cursor-pointer"
          >
            NULL
          </button>
          {currentLevel.allowHeadChange && (
            <button
              onClick={() => {
                const ids = currentLevel.nodes.map((n) => n.id);
                const next = ids[(ids.indexOf(headId) + 1) % ids.length];
                setHeadId(next);
                setIntuition(`HEAD pointer reassigned to ${next}.`);
              }}
              className="px-2.5 py-1.5 rounded-lg bg-[#F59E0B]/20 border border-[#F59E0B]/45 text-[#FDE68A] hover:bg-[#F59E0B]/30 cursor-pointer"
            >
              HEAD: {headId}
            </button>
          )}
        </div>
      }
    >
      <div ref={mountRef} className="w-full h-full cursor-pointer" />
    </GameHudLayout>
  );
}
