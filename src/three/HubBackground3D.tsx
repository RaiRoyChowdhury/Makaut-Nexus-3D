import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  addNexusLighting,
  attachStudioEnvironment,
  createLoopScheduler,
  createNexusRenderer,
  disposeScene,
} from "./threeUtils";

export function HubBackground3D() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x06080e);
    scene.fog = new THREE.FogExp2(0x06080e, 0.022);

    const camera = new THREE.PerspectiveCamera(
      50,
      Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1),
      0.1,
      180
    );
    camera.position.set(0, 8, 22);
    camera.lookAt(0, 1, 0);

    const { renderer, isSoftwareGl } = createNexusRenderer(container);
    const envTex = attachStudioEnvironment(renderer, scene);
    addNexusLighting(scene);

    // Subtle cybernetic horizon grid
    const grid = new THREE.GridHelper(90, 45, 0x00f5d4, 0x162033);
    grid.position.y = -4;
    const gridMat = grid.material as THREE.Material;
    gridMat.transparent = true;
    gridMat.opacity = 0.22;
    scene.add(grid);

    // Composite central geometric nexus core (multi-part group)
    const nexusGroup = new THREE.Group();
    nexusGroup.position.set(0, 2.2, -5);
    scene.add(nexusGroup);

    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x101828,
      metalness: 0.85,
      roughness: 0.2,
      emissive: 0x00f5d4,
      emissiveIntensity: 0.12,
    });
    const core = new THREE.Mesh(new THREE.OctahedronGeometry(2.6, 0), coreMat);
    nexusGroup.add(core);

    const cageMat = new THREE.LineBasicMaterial({
      color: 0x00f5d4,
      transparent: true,
      opacity: 0.45,
    });
    const cage = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.OctahedronGeometry(3.2, 0)), cageMat);
    nexusGroup.add(cage);

    const ring1 = new THREE.Mesh(
      new THREE.TorusGeometry(5.2, 0.045, 12, 72),
      new THREE.MeshBasicMaterial({ color: 0x00f5d4, transparent: true, opacity: 0.35 })
    );
    ring1.rotation.x = Math.PI / 2.6;
    nexusGroup.add(ring1);

    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(7.0, 0.04, 12, 72),
      new THREE.MeshBasicMaterial({ color: 0x8b5cf6, transparent: true, opacity: 0.3 })
    );
    ring2.rotation.x = -Math.PI / 3;
    ring2.rotation.y = Math.PI / 5;
    nexusGroup.add(ring2);

    // Instanced floating obsidian data monoliths around the perimeter
    const count = 28;
    const monoGeo = new THREE.BoxGeometry(0.65, 2.2, 0.65);
    const monoMat = new THREE.MeshStandardMaterial({
      color: 0x151c2c,
      metalness: 0.75,
      roughness: 0.35,
    });
    const instanced = new THREE.InstancedMesh(monoGeo, monoMat, count);
    const dummy = new THREE.Object3D();
    const baseData: { angle: number; radius: number; y: number; speed: number; scaleY: number }[] = [];

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 12 + (i % 4) * 3.8;
      const y = -1.5 + (i % 5) * 1.4;
      const scaleY = 0.6 + (i % 3) * 0.55;
      baseData.push({ angle, radius, y, speed: 0.05 + (i % 3) * 0.02, scaleY });
      dummy.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius - 5);
      dummy.scale.set(1, scaleY, 1);
      dummy.updateMatrix();
      instanced.setMatrixAt(i, dummy.matrix);
    }
    instanced.instanceMatrix.needsUpdate = true;
    instanced.frustumCulled = false;
    scene.add(instanced);

    // Mouse parallax
    const targetMouse = { x: 0, y: 0 };
    const currentMouse = { x: 0, y: 0 };
    const onPointerMove = (e: PointerEvent) => {
      targetMouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
      targetMouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    const onResize = () => {
      if (!container) return;
      const w = Math.max(container.clientWidth, 1);
      const h = Math.max(container.clientHeight, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    const clock = new THREE.Clock();
    const loop = createLoopScheduler(renderer, isSoftwareGl, () => {
      const t = clock.getElapsedTime();
      currentMouse.x += (targetMouse.x - currentMouse.x) * 0.04;
      currentMouse.y += (targetMouse.y - currentMouse.y) * 0.04;

      camera.position.x = currentMouse.x * 2.2;
      camera.position.y = 8 - currentMouse.y * 1.1;
      camera.lookAt(0, 1.2, -4);

      core.rotation.y = t * 0.22;
      core.rotation.x = Math.sin(t * 0.3) * 0.2;
      cage.rotation.y = -t * 0.14;
      ring1.rotation.z = t * 0.18;
      ring2.rotation.z = -t * 0.12;

      for (let i = 0; i < count; i++) {
        const d = baseData[i];
        const a = d.angle + t * d.speed;
        dummy.position.set(
          Math.cos(a) * d.radius,
          d.y + Math.sin(t * 0.8 + i) * 0.45,
          Math.sin(a) * d.radius - 5
        );
        dummy.rotation.y = a;
        dummy.scale.set(1, d.scaleY, 1);
        dummy.updateMatrix();
        instanced.setMatrixAt(i, dummy.matrix);
      }
      instanced.instanceMatrix.needsUpdate = true;

      renderer.render(scene, camera);
    });
    loop.start();

    return () => {
      loop.stop();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResize);
      envTex.dispose();
      disposeScene(scene, renderer);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="fixed inset-0 z-0 pointer-events-none"
      aria-hidden="true"
    />
  );
}
