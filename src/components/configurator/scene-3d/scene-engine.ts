/**
 * Moteur de rendu partagé (three.js) : création du renderer avec détection WebGL, caméra,
 * OrbitControls, éclairage jour/nuit, rendu à la demande (aucune boucle permanente),
 * pause quand l'onglet est caché, capture d'image et libération des ressources.
 *
 * Ce module n'est importé que par des composants client chargés dynamiquement.
 */
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type ViewPreset = "front" | "three_quarter" | "top";

export const VIEW_PRESETS: Array<{ id: ViewPreset; label: string }> = [
  { id: "front", label: "Face" },
  { id: "three_quarter", label: "Trois quarts" },
  { id: "top", label: "Dessus" },
];

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

/** Scène construite par un « builder » (pergola ou store) et pilotable sans React. */
export interface BuiltScene {
  group: THREE.Group;
  /** emprise approximative (mètres) pour cadrer la caméra et les ombres */
  bounds: { center: THREE.Vector3; size: THREE.Vector3 };
  poses: Record<ViewPreset, CameraPose>;
  /** objets cliquables ; `userData.segmentId` identifie l'ouverture */
  pickables: THREE.Object3D[];
  setNight(night: boolean): void;
  setBladeAngle?(deg: number): void;
  setDeployment?(ratio: number): void;
  setSelected?(segmentId: string | null): void;
  dispose(): void;
}

export function supportsWebGL(): boolean {
  try {
    if (typeof window === "undefined" || !("WebGLRenderingContext" in window)) return false;
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    return false;
  }
}

export const DAY = { background: 0xe9eef5, ground: 0xd9cfbf, hemiSky: 0xdfe9f5, hemiGround: 0xb8a98c, hemi: 1.1, sun: 0xfff4e0, sunIntensity: 2.6 };
export const NIGHT = { background: 0x141a26, ground: 0x4a4740, hemiSky: 0x2e3a55, hemiGround: 0x1c1a18, hemi: 0.45, sun: 0x8aa0c8, sunIntensity: 0.35 };

export class SceneEngine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly controls: OrbitControls;
  private readonly hemi: THREE.HemisphereLight;
  private readonly fog = new THREE.Fog(DAY.background, 20, 45);
  private readonly sun: THREE.DirectionalLight;
  private built: BuiltScene | null = null;
  private frame: number | null = null;
  private paused = false;
  private disposed = false;
  private night = false;
  private tween: number | null = null;
  private readonly onVisibility = () => {
    this.paused = document.visibilityState === "hidden";
    if (!this.paused) this.invalidate();
  };

  /** Lève une erreur si le contexte WebGL ne peut pas être créé. */
  constructor(private readonly canvas: HTMLCanvasElement, private readonly container: HTMLElement) {
    if (!supportsWebGL()) throw new Error("WebGL indisponible");
    const antialias = window.innerWidth >= 768;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias, alpha: false, powerPreference: "default" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;

    this.camera = new THREE.PerspectiveCamera(45, 1.6, 0.1, 120);
    this.camera.position.set(6, 3, 8);

    this.hemi = new THREE.HemisphereLight(DAY.hemiSky, DAY.hemiGround, DAY.hemi);
    this.sun = new THREE.DirectionalLight(DAY.sun, DAY.sunIntensity);
    this.sun.castShadow = true;
    const mapSize = antialias ? 2048 : 1024;
    this.sun.shadow.mapSize.set(mapSize, mapSize);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.scene.fog = this.fog;

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = false;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.5;
    this.controls.maxDistance = 40;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.02;
    this.controls.addEventListener("change", this.invalidate);

    document.addEventListener("visibilitychange", this.onVisibility);
    this.applyAmbiance();
    this.resize();
  }

  /** Demande un rendu au prochain frame (déduplique les demandes). */
  readonly invalidate = () => {
    if (this.disposed || this.paused || this.frame !== null) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = null;
      if (this.disposed) return;
      this.renderer.render(this.scene, this.camera);
    });
  };

  resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.invalidate();
  }

  setBuilt(built: BuiltScene | null) {
    if (this.built) {
      this.scene.remove(this.built.group);
      this.built.dispose();
    }
    this.built = built;
    if (built) {
      this.scene.add(built.group);
      built.setNight(this.night);
      const { center, size } = built.bounds;
      const radius = Math.max(size.x, size.y, size.z) * 0.9 + 1;
      this.sun.position.set(center.x - radius * 0.8, radius * 1.6, center.z + radius * 0.9);
      this.sun.target.position.copy(center);
      const cam = this.sun.shadow.camera;
      cam.left = -radius; cam.right = radius; cam.top = radius; cam.bottom = -radius;
      cam.near = 0.5; cam.far = radius * 5;
      cam.updateProjectionMatrix();
      this.controls.target.copy(center);
      this.fog.near = radius * 2.5 + 6;
      this.fog.far = Math.min(70, radius * 6 + 18);
    }
    this.invalidate();
  }

  get current(): BuiltScene | null {
    return this.built;
  }

  setNight(night: boolean) {
    this.night = night;
    this.applyAmbiance();
    this.built?.setNight(night);
    this.invalidate();
  }

  private applyAmbiance() {
    const p = this.night ? NIGHT : DAY;
    this.scene.background = new THREE.Color(p.background);
    this.fog.color.set(p.background);
    this.hemi.color.set(p.hemiSky);
    this.hemi.groundColor.set(p.hemiGround);
    this.hemi.intensity = p.hemi;
    this.sun.color.set(p.sun);
    this.sun.intensity = p.sunIntensity;
    this.renderer.toneMappingExposure = this.night ? 0.9 : 1.0;
  }

  /** Place la caméra sur une vue prédéfinie, avec une courte transition (sauf si l'utilisateur préfère réduire les animations). */
  setView(preset: ViewPreset, animate = true) {
    const pose = this.built?.poses[preset];
    if (!pose) return;
    const to = new THREE.Vector3(...pose.position);
    const target = new THREE.Vector3(...pose.target);
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (this.tween !== null) cancelAnimationFrame(this.tween);
    if (!animate || reduce) {
      this.camera.position.copy(to);
      this.controls.target.copy(target);
      this.controls.update();
      this.invalidate();
      return;
    }
    const from = this.camera.position.clone();
    const fromTarget = this.controls.target.clone();
    const duration = 350;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      this.camera.position.lerpVectors(from, to, e);
      this.controls.target.lerpVectors(fromTarget, target, e);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
      this.tween = t < 1 ? requestAnimationFrame(step) : null;
    };
    this.tween = requestAnimationFrame(step);
  }

  /** Objet cliqué (le premier portant un `segmentId`) aux coordonnées écran données. */
  pick(clientX: number, clientY: number): string | null {
    if (!this.built?.pickables.length) return null;
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hits = ray.intersectObjects(this.built.pickables, true);
    for (const hit of hits) {
      let o: THREE.Object3D | null = hit.object;
      while (o) {
        const id = o.userData.segmentId as string | undefined;
        if (id) return id;
        o = o.parent;
      }
    }
    return null;
  }

  /** Rendu synchrone puis lecture du canvas (sans `preserveDrawingBuffer`, la lecture doit suivre immédiatement le rendu). */
  capture(): string {
    this.renderer.render(this.scene, this.camera);
    return this.canvas.toDataURL("image/png");
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    if (this.tween !== null) cancelAnimationFrame(this.tween);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.controls.removeEventListener("change", this.invalidate);
    this.controls.dispose();
    this.setBuilt(null);
    this.hemi.dispose();
    this.sun.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}

/** Libère géométries et matériaux d'un sous-arbre. */
export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mat = (mesh as THREE.Mesh).material;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else if (mat) mat.dispose();
    const light = o as THREE.Light;
    if (light.isLight) light.dispose();
  });
}
