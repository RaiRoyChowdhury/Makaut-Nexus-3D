import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

export interface OrbitRigOptions {
  initialPosition: THREE.Vector3;
  initialTarget: THREE.Vector3;
  minDistance?: number;
  maxDistance?: number;
  maxPolarAngle?: number;
}

export interface OrbitRigHandle {
  controls: OrbitControls;
  resetCamera: () => void;
  update: (dt: number) => void;
  dispose: () => void;
}

export function createOrbitRig(
  camera: THREE.PerspectiveCamera,
  domElement: HTMLElement,
  opts: OrbitRigOptions
): OrbitRigHandle {
  const controls = new OrbitControls(camera, domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = opts.minDistance ?? 5;
  controls.maxDistance = opts.maxDistance ?? 30;
  controls.maxPolarAngle = opts.maxPolarAngle ?? Math.PI * 0.49;
  controls.target.copy(opts.initialTarget);
  controls.update();

  let resetting = false;
  const resetPos = opts.initialPosition.clone();
  const resetTarget = opts.initialTarget.clone();

  const onStart = () => {
    // Cancel camera reset immediately if user drags/zooms
    resetting = false;
  };
  controls.addEventListener("start", onStart);

  return {
    controls,
    resetCamera: () => {
      resetting = true;
    },
    update: (dt: number) => {
      if (resetting) {
        const lambda = 7.5;
        camera.position.x = THREE.MathUtils.damp(camera.position.x, resetPos.x, lambda, dt);
        camera.position.y = THREE.MathUtils.damp(camera.position.y, resetPos.y, lambda, dt);
        camera.position.z = THREE.MathUtils.damp(camera.position.z, resetPos.z, lambda, dt);
        controls.target.x = THREE.MathUtils.damp(controls.target.x, resetTarget.x, lambda, dt);
        controls.target.y = THREE.MathUtils.damp(controls.target.y, resetTarget.y, lambda, dt);
        controls.target.z = THREE.MathUtils.damp(controls.target.z, resetTarget.z, lambda, dt);

        if (
          camera.position.distanceTo(resetPos) < 0.05 &&
          controls.target.distanceTo(resetTarget) < 0.05
        ) {
          camera.position.copy(resetPos);
          controls.target.copy(resetTarget);
          resetting = false;
        }
      }
      controls.update();
    },
    dispose: () => {
      controls.removeEventListener("start", onStart);
      controls.dispose();
    },
  };
}

export interface BloomComposerHandle {
  render: () => void;
  resize: (width: number, height: number) => void;
  dispose: () => void;
}

export function createBloomComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  isSoftwareGl: boolean,
  container: HTMLElement
): BloomComposerHandle {
  // Keep multi-pass bloom on GPU devices; bypass on software WebGL for responsive frame pacing
  if (isSoftwareGl) {
    return {
      render: () => renderer.render(scene, camera),
      resize: () => {},
      dispose: () => {},
    };
  }

  const w = Math.max(container.clientWidth, 1);
  const h = Math.max(container.clientHeight, 1);
  const isMobile = typeof navigator !== "undefined" && /iPhone|iPad|Android/i.test(navigator.userAgent);

  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bloomRes = new THREE.Vector2(isMobile ? Math.floor(w * 0.5) : w, isMobile ? Math.floor(h * 0.5) : h);
  const bloomPass = new UnrealBloomPass(
    bloomRes,
    isMobile ? 0.32 : 0.44, // subtle strength: accentuates cyan/violet without washing out text
    0.35, // radius
    0.76 // high threshold so dark backgrounds remain deep obsidian
  );
  composer.addPass(bloomPass);

  return {
    render: () => composer.render(),
    resize: (width: number, height: number) => {
      const safeW = Math.max(width, 1);
      const safeH = Math.max(height, 1);
      composer.setSize(safeW, safeH);
      bloomPass.resolution.set(isMobile ? Math.floor(safeW * 0.5) : safeW, isMobile ? Math.floor(safeH * 0.5) : safeH);
    },
    dispose: () => {
      bloomPass.dispose();
      composer.dispose();
    },
  };
}

export interface CelebrationBurstHandle {
  trigger: (origin?: THREE.Vector3, accentHex?: number) => void;
  update: (dt: number) => void;
  dispose: () => void;
}

export function createCelebrationBurst(scene: THREE.Scene): CelebrationBurstHandle {
  const COUNT = 56;
  const positions = new Float32Array(COUNT * 3);
  const velocities = new Float32Array(COUNT * 3);
  const colors = new Float32Array(COUNT * 3);

  const cTeal = new THREE.Color(0x00f5d4);
  const cViolet = new THREE.Color(0x8b5cf6);
  const cCustom = new THREE.Color();

  for (let i = 0; i < COUNT; i++) {
    const col = i % 2 === 0 ? cTeal : cViolet;
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.28,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.visible = false;
  points.frustumCulled = false;
  scene.add(points);

  // Subtle vertical pulse beam & expanding shockwave ring
  const beamGeo = new THREE.CylinderGeometry(0.18, 0.55, 9, 16, 1, true);
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0x00f5d4,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.visible = false;
  scene.add(beam);

  const ringGeo = new THREE.RingGeometry(0.6, 0.9, 32);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x8b5cf6,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  scene.add(ring);

  let active = false;
  let elapsed = 0;
  let lastTriggerAt = 0;
  const DURATION = 1.15;

  return {
    trigger: (origin?: THREE.Vector3, accentHex?: number) => {
      const now = performance.now();
      // Guard against duplicate bursts from rapid state updates
      if (now - lastTriggerAt < 350) return;
      lastTriggerAt = now;

      const ox = origin?.x ?? 0;
      const oy = origin?.y ?? 0.6;
      const oz = origin?.z ?? 0;

      if (accentHex !== undefined) {
        cCustom.setHex(accentHex);
        beamMat.color.copy(cCustom);
      } else {
        beamMat.color.setHex(0x00f5d4);
      }

      for (let i = 0; i < COUNT; i++) {
        positions[i * 3] = ox;
        positions[i * 3 + 1] = oy;
        positions[i * 3 + 2] = oz;

        const theta = Math.random() * Math.PI * 2;
        const speed = 2.6 + Math.random() * 4.2;
        velocities[i * 3] = Math.cos(theta) * speed;
        velocities[i * 3 + 1] = 2.4 + Math.random() * 4.5;
        velocities[i * 3 + 2] = Math.sin(theta) * speed;
      }
      geo.attributes.position.needsUpdate = true;

      beam.position.set(ox, oy + 3.5, oz);
      ring.position.set(ox, oy - 0.5, oz);
      ring.scale.setScalar(1);

      points.visible = true;
      beam.visible = true;
      ring.visible = true;
      elapsed = 0;
      active = true;
    },
    update: (dt: number) => {
      if (!active) return;
      elapsed += dt;
      const progress = Math.min(1, elapsed / DURATION);
      const fade = 1 - progress;

      for (let i = 0; i < COUNT; i++) {
        positions[i * 3] += velocities[i * 3] * dt;
        positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
        positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;
        velocities[i * 3 + 1] -= 5.8 * dt;
      }
      geo.attributes.position.needsUpdate = true;

      mat.opacity = fade * 0.95;
      beamMat.opacity = fade * 0.32;
      beam.scale.set(1 + progress * 1.4, 1, 1 + progress * 1.4);

      ringMat.opacity = fade * 0.65;
      ring.scale.setScalar(1 + progress * 5.2);

      if (progress >= 1) {
        active = false;
        points.visible = false;
        beam.visible = false;
        ring.visible = false;
      }
    },
    dispose: () => {
      scene.remove(points);
      scene.remove(beam);
      scene.remove(ring);
      geo.dispose();
      mat.dispose();
      beamGeo.dispose();
      beamMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
    },
  };
}
