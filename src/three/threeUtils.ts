import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

let cachedIsSoftwareGl: boolean | null = null;

export function detectSoftwareGl(): boolean {
  if (cachedIsSoftwareGl !== null) return cachedIsSoftwareGl;
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) {
      cachedIsSoftwareGl = true;
      return true;
    }
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    cachedIsSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    return cachedIsSoftwareGl;
  } catch {
    cachedIsSoftwareGl = true;
    return true;
  }
}

export function createNexusRenderer(container: HTMLElement): {
  renderer: THREE.WebGLRenderer;
  isSoftwareGl: boolean;
} {
  const isSoftwareGl = detectSoftwareGl();
  const width = Math.max(container.clientWidth, 1);
  const height = Math.max(container.clientHeight, 1);

  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = !isSoftwareGl;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x06080e, 1);

  container.appendChild(renderer.domElement);
  return { renderer, isSoftwareGl };
}

export function attachStudioEnvironment(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene
): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  pmrem.dispose();
  return envTex;
}

export function addNexusLighting(scene: THREE.Scene): void {
  // Warm key light + cool hemisphere fill + rim light
  const hemi = new THREE.HemisphereLight(0x88ccff, 0x090b10, 0.75);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff1dc, 1.5);
  key.position.set(12, 18, 12);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0x00f5d4, 1.0);
  rim.position.set(-14, 8, -12);
  scene.add(rim);

  const fill = new THREE.DirectionalLight(0x8b5cf6, 0.7);
  fill.position.set(0, -6, 10);
  scene.add(fill);
}

export function createTextSprite(
  text: string,
  opts?: {
    bg?: string;
    border?: string;
    color?: string;
    fontSize?: number;
    width?: number;
    height?: number;
  }
): THREE.Sprite {
  const canvas = document.createElement("canvas");
  const w = opts?.width ?? 320;
  const h = opts?.height ?? 96;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = opts?.bg ?? "rgba(9, 11, 18, 0.88)";
  ctx.strokeStyle = opts?.border ?? "rgba(0, 245, 212, 0.65)";
  ctx.lineWidth = 3;

  const r = 14;
  ctx.beginPath();
  ctx.roundRect(6, 6, w - 12, h - 12, r);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = opts?.color ?? "#F4F7FB";
  ctx.font = `700 ${opts?.fontSize ?? 30}px "JetBrains Mono", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, h / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set((w / 100) * 1.15, (h / 100) * 1.15, 1);
  return sprite;
}

export function createLoopScheduler(
  renderer: THREE.WebGLRenderer,
  isSoftwareGl: boolean,
  tick: () => void
): { start: () => void; stop: () => void } {
  let frameId = 0;
  let running = false;

  const afterDraw = (cb: () => void) => {
    if (!running) return;
    const gl = renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== "function") {
      frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (!running) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        frameId = window.setTimeout(cb, 80);
      }
    };
    frameId = window.setTimeout(poll, 5);
  };

  const loop = () => {
    if (!running) return;
    tick();
    if (isSoftwareGl) {
      afterDraw(loop);
    } else {
      frameId = requestAnimationFrame(loop);
    }
  };

  return {
    start: () => {
      if (running) return;
      running = true;
      loop();
    },
    stop: () => {
      running = false;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
    },
  };
}

export function disposeScene(scene: THREE.Scene, renderer: THREE.WebGLRenderer): void {
  scene.traverse((obj) => {
    if (obj instanceof THREE.Mesh || obj instanceof THREE.Line || obj instanceof THREE.Points || obj instanceof THREE.Sprite) {
      obj.geometry?.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => {
        if (!m) return;
        for (const val of Object.values(m)) {
          if (val && typeof val === "object" && "dispose" in val && typeof (val as THREE.Texture).dispose === "function") {
            (val as THREE.Texture).dispose();
          }
        }
        m.dispose();
      });
    }
  });
  renderer.dispose();
  if (renderer.domElement.parentElement) {
    renderer.domElement.parentElement.removeChild(renderer.domElement);
  }
}
