import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { AlertTriangle, CheckCircle2, Cpu } from "lucide-react";
import {
  addNexusLighting,
  attachStudioEnvironment,
  createLoopScheduler,
  createNexusRenderer,
  createTextSprite,
  disposeScene,
} from "../../three/threeUtils";

interface NodeSpec {
  id: string;
  name: string;
  role: string;
  metrics: string;
  color: number;
  pos: [number, number, number];
  size: number;
  shape: "octahedron" | "sphere" | "box" | "dodecahedron";
}

const NODES: NodeSpec[] = [
  { id: "EDGE_ENVOY", name: "EDGE ENVOY PROXY", role: "Ingress Gateway", metrics: "1.42M QPS · Token Bucket", color: 0x94a3b8, pos: [0, 4.8, -1.5], size: 0.9, shape: "octahedron" },
  { id: "RAFT_LEADER", name: "LEADER: NODE-A", role: "Raft Quorum Master", metrics: "48.2k ops/s · Term 42", color: 0x00f5d4, pos: [-4.8, 1.4, 1.2], size: 1.15, shape: "sphere" },
  { id: "RAFT_FOLLOWER_B", name: "FOLLOWER: NODE-B", role: "Quorum Follower", metrics: "Lag: 0 frames · Synced", color: 0x38bdf8, pos: [0, 1.4, 1.2], size: 0.92, shape: "sphere" },
  { id: "RAFT_FOLLOWER_C", name: "FOLLOWER: NODE-C", role: "Quorum Follower", metrics: "WAL Active · 50ms HB", color: 0x38bdf8, pos: [4.8, 1.4, 1.2], size: 0.92, shape: "sphere" },
  { id: "SHARD_01", name: "SHARD 01 [A–G]", role: "Hash-Ring Shard", metrics: "32% Load · Balanced", color: 0x8b5cf6, pos: [-4.2, -1.6, 3.2], size: 0.85, shape: "box" },
  { id: "SHARD_02", name: "SHARD 02 [H–P]", role: "Hotspot Shard", metrics: "84% Load · Auto-Split", color: 0xf59e0b, pos: [0, -1.6, 3.2], size: 0.9, shape: "box" },
  { id: "SHARD_03", name: "SHARD 03 [Q–Z]", role: "Hash-Ring Shard", metrics: "31% Load · Balanced", color: 0x8b5cf6, pos: [4.2, -1.6, 3.2], size: 0.85, shape: "box" },
  { id: "LSM_STORAGE", name: "LSM STORAGE ENGINE", role: "MemTable + SSTables", metrics: "io_uring Kernel Bypass", color: 0x00f5d4, pos: [0, -3.4, 5.2], size: 1.05, shape: "dodecahedron" },
];

const LINKS: [string, string, number][] = [
  ["EDGE_ENVOY", "RAFT_LEADER", 0x00f5d4],
  ["EDGE_ENVOY", "RAFT_FOLLOWER_B", 0x475569],
  ["EDGE_ENVOY", "RAFT_FOLLOWER_C", 0x475569],
  ["RAFT_LEADER", "RAFT_FOLLOWER_B", 0x00f5d4],
  ["RAFT_LEADER", "RAFT_FOLLOWER_C", 0x00f5d4],
  ["RAFT_LEADER", "SHARD_01", 0x00f5d4],
  ["RAFT_LEADER", "SHARD_02", 0xf59e0b],
  ["RAFT_FOLLOWER_C", "SHARD_03", 0x8b5cf6],
  ["SHARD_01", "LSM_STORAGE", 0x8b5cf6],
  ["SHARD_02", "LSM_STORAGE", 0xf59e0b],
  ["SHARD_03", "LSM_STORAGE", 0x8b5cf6],
];

export function AegisGrid3D() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<NodeSpec>(NODES[1]);
  const [chaosFailover, setChaosFailover] = useState(false);

  const chaosRef = useRef(chaosFailover);
  chaosRef.current = chaosFailover;

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
    camera.position.set(0, 7.5, 17.5);

    const { renderer, isSoftwareGl } = createNexusRenderer(container);
    const envTex = attachStudioEnvironment(renderer, scene);
    addNexusLighting(scene);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.target.set(0, 0.2, 1.5);

    const grid = new THREE.GridHelper(32, 32, 0x00f5d4, 0x162033);
    grid.position.y = -4.6;
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.24;
    scene.add(grid);

    const nodeMeshes: Record<string, THREE.Mesh> = {};
    const clickables: THREE.Object3D[] = [];

    NODES.forEach((n) => {
      let geo: THREE.BufferGeometry;
      if (n.shape === "octahedron") geo = new THREE.OctahedronGeometry(n.size);
      else if (n.shape === "box") geo = new THREE.BoxGeometry(n.size * 1.4, n.size * 1.4, n.size * 1.4);
      else if (n.shape === "dodecahedron") geo = new THREE.DodecahedronGeometry(n.size);
      else geo = new THREE.SphereGeometry(n.size, 22, 22);

      const mat = new THREE.MeshStandardMaterial({
        color: n.color,
        emissive: n.color,
        emissiveIntensity: n.id === "RAFT_LEADER" ? 0.55 : 0.25,
        metalness: 0.72,
        roughness: 0.22,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(...n.pos);
      mesh.userData = { spec: n };

      const wire = new THREE.LineSegments(
        new THREE.WireframeGeometry(geo),
        new THREE.LineBasicMaterial({ color: n.color, transparent: true, opacity: 0.6 })
      );
      wire.scale.setScalar(1.2);
      mesh.add(wire);

      const lbl = createTextSprite(n.name, {
        border: "#00F5D4",
        width: 280,
        height: 64,
        fontSize: 20,
      });
      lbl.position.set(0, n.size + 0.9, 0);
      lbl.scale.set(2.9, 0.68, 1);
      mesh.add(lbl);

      scene.add(mesh);
      nodeMeshes[n.id] = mesh;
      clickables.push(mesh);
    });

    const packets: { mesh: THREE.Mesh; curve: THREE.QuadraticBezierCurve3; t: number; speed: number }[] = [];
    LINKS.forEach(([src, dst, col]) => {
      const p1 = nodeMeshes[src].position;
      const p2 = nodeMeshes[dst].position;
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      mid.y += 0.9;
      const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(28));
      scene.add(
        new THREE.Line(
          lineGeo,
          new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.45 })
        )
      );
      const pkt = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 8, 8),
        new THREE.MeshBasicMaterial({ color: col })
      );
      scene.add(pkt);
      packets.push({ mesh: pkt, curve, t: Math.random(), speed: 0.32 + Math.random() * 0.22 });
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickables, false);
      if (hits.length > 0 && hits[0].object.userData?.spec) {
        setSelectedNode(hits[0].object.userData.spec);
      }
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    const onResize = () => {
      if (!container) return;
      camera.aspect = Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1));
    };
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    const loop = createLoopScheduler(renderer, isSoftwareGl, () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const isChaos = chaosRef.current;

      // Update Raft Leader vs Follower B colors on Chaos Failover
      const leaderMat = nodeMeshes["RAFT_LEADER"].material as THREE.MeshStandardMaterial;
      const followerBMat = nodeMeshes["RAFT_FOLLOWER_B"].material as THREE.MeshStandardMaterial;
      if (isChaos) {
        leaderMat.color.setHex(0xef4444);
        leaderMat.emissive.setHex(0xef4444);
        followerBMat.color.setHex(0x00f5d4);
        followerBMat.emissive.setHex(0x00f5d4);
      } else {
        leaderMat.color.setHex(0x00f5d4);
        leaderMat.emissive.setHex(0x00f5d4);
        followerBMat.color.setHex(0x38bdf8);
        followerBMat.emissive.setHex(0x38bdf8);
      }

      Object.values(nodeMeshes).forEach((m) => {
        m.rotation.y += dt * 0.55;
      });

      packets.forEach((p) => {
        p.t = (p.t + dt * p.speed) % 1;
        p.mesh.position.copy(p.curve.getPoint(p.t));
      });

      controls.update();
      renderer.render(scene, camera);
    });
    loop.start();

    return () => {
      loop.stop();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      window.removeEventListener("resize", onResize);
      controls.dispose();
      envTex.dispose();
      disposeScene(scene, renderer);
    };
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Interactive 3D Topology Viewport */}
      <div className="nexus-panel rounded-2xl overflow-hidden lg:col-span-2 relative h-[480px]">
        <div ref={mountRef} className="w-full h-full cursor-pointer" />
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <div className="pointer-events-auto nexus-panel-solid rounded-lg px-3 py-1.5 text-xs font-mono text-[#00F5D4]">
            AEGISGRID · SYS-ARCH-399 · 1.42M QPS · 2.4ms P99
          </div>
          <button
            onClick={() => setChaosFailover((c) => !c)}
            className={`pointer-events-auto px-3 py-1.5 rounded-lg text-xs font-mono font-semibold inline-flex items-center gap-1.5 cursor-pointer border ${
              chaosFailover
                ? "bg-[#EF4444]/20 border-[#EF4444] text-[#FCA5A5]"
                : "bg-[#111624] border-white/15 text-[#CBD5E1] hover:border-[#F59E0B]"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            {chaosFailover ? "Chaos Active: Node-A Down (Node-B Elected)" : "Simulate Leader Failover"}
          </button>
        </div>
      </div>

      {/* Node Inspection & Viva Defensibility Panel */}
      <div className="nexus-panel rounded-2xl p-6 space-y-5">
        <div className="space-y-1">
          <p className="text-xs font-mono text-[#00F5D4]">RAYCASTER NODE INSPECTOR</p>
          <h3 className="text-lg font-bold text-[#F4F7FB]">{selectedNode.name}</h3>
          <p className="text-xs text-[#94A3B8]">
            {selectedNode.role} · <span className="font-mono text-[#CBD5E1]">{selectedNode.metrics}</span>
          </p>
        </div>

        <div className="rounded-xl bg-[#090C14] border border-white/[0.07] p-4 space-y-2 text-xs">
          <div className="flex items-center gap-2 font-mono text-[#8B5CF6]">
            <Cpu className="w-4 h-4" />
            QUORUM & CONSENSUS STATUS
          </div>
          <p className="text-[#CBD5E1] leading-relaxed">
            {chaosFailover
              ? "Node-A partitioned. Follower Node-B won Term 43 election in 180ms with 2/3 majority quorum. Linearizable ReadLeases preserved."
              : "All 3 Raft nodes healthy (Term 42). Consistent hash ring routes keys across Shards 01–03 into tiered LSM SSTables."}
          </p>
        </div>

        <div className="space-y-2 pt-2 border-t border-white/[0.07]">
          <p className="text-xs font-mono text-[#94A3B8]">MAKAUT CAPSTONE VIVA PANEL</p>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between text-[#CBD5E1]">
              <span>Prof. S. Banerjee (Distributed Systems)</span>
              <span className="text-[#10B981] font-mono inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Ready
              </span>
            </div>
            <div className="flex items-center justify-between text-[#CBD5E1]">
              <span>Dr. A. Roy (Storage Engines)</span>
              <span className="text-[#10B981] font-mono inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Ready
              </span>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-[#64748B]">
          Click any 3D node in the AegisGrid topology to inspect its real-time role and throughput
          profile. Drag to orbit.
        </p>
      </div>
    </div>
  );
}
