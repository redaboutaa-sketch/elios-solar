/**
 * Géométrie procédurale du store banne (coffre, toile, barre de charge, bras articulés, supports).
 * Unités : mètres ; x = largeur, z = avancée depuis le mur (z = 0), y = hauteur.
 * Hauteur de pose, inclinaison et géométrie des bras : indicatives.
 */
import * as THREE from "three";
import type { AwningSceneModel } from "@/domain/scene-model";
import { DAY, NIGHT, disposeTree, type BuiltScene } from "./scene-engine";

const M = 1 / 1000;
const PITCH = THREE.MathUtils.degToRad(14); // inclinaison indicative de la toile
const WARM = 0xffcf8a;

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Barre orientée entre deux points (bras). */
function bar(a: THREE.Vector3, b: THREE.Vector3, thickness: number, mat: THREE.Material): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(thickness, thickness, 1), mat);
  mesh.castShadow = true;
  mesh.userData.update = (p: THREE.Vector3, q: THREE.Vector3) => {
    const l = Math.max(0.001, p.distanceTo(q));
    mesh.scale.set(1, 1, l);
    mesh.position.copy(p).add(q).multiplyScalar(0.5);
    mesh.lookAt(q);
  };
  (mesh.userData.update as (p: THREE.Vector3, q: THREE.Vector3) => void)(a, b);
  return mesh;
}

export function buildAwningScene(model: AwningSceneModel): BuiltScene {
  const Wd = model.widthMm * M;
  const P = model.projectionMm * M;
  const H = model.heightMm * M;
  const cabH = model.cabinet.heightMm * M;
  const cabD = model.cabinet.depthMm * M;
  const group = new THREE.Group();
  group.name = "store-banne";

  const cabinetMat = new THREE.MeshStandardMaterial({ color: model.cabinet.color, roughness: 0.5, metalness: 0.35 });
  const fabricMat = new THREE.MeshStandardMaterial({ color: model.fabric.color, roughness: 0.95, side: THREE.DoubleSide });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe6dfd2, roughness: 0.9 });
  const groundMat = new THREE.MeshStandardMaterial({ color: DAY.ground, roughness: 0.95 });
  const terraceMat = new THREE.MeshStandardMaterial({ color: 0xc9bca6, roughness: 0.85 });
  const windowMat = new THREE.MeshStandardMaterial({ color: 0xcfd8dc, roughness: 0.2, metalness: 0.2 });
  const ledMat = new THREE.MeshBasicMaterial({ color: 0x9a948a });

  /* Sol, terrasse, façade, fenêtres */
  const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 64), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(Wd / 2, -0.001, P / 2);
  ground.receiveShadow = true;
  group.add(ground);
  const terrace = box(Wd + 1.5, 0.05, P + 1, terraceMat, Wd / 2, -0.024, (P + 1) / 2);
  terrace.castShadow = false;
  group.add(terrace);
  const facadeH = H + (model.bracketMount === "ceiling" ? 0.4 : 0.9);
  group.add(box(Wd + 3, facadeH, 0.3, wallMat, Wd / 2, facadeH / 2, -0.15));
  group.add(box(Math.min(1.6, Wd * 0.35), 2.1, 0.02, windowMat, Wd * 0.3, 1.05, 0.005));
  group.add(box(Math.min(1.2, Wd * 0.25), 1.2, 0.02, windowMat, Wd * 0.75, 1.4, 0.005));
  if (model.bracketMount === "ceiling") {
    // avancée de toiture / plafond indicatif
    group.add(box(Wd + 1, 0.12, cabD + 0.5, wallMat, Wd / 2, H + cabH / 2 + 0.06 + 0.02, (cabD + 0.5) / 2));
  }

  /* Coffre + LED + supports */
  const cabY = H;
  group.add(box(Wd, cabH, cabD, cabinetMat, Wd / 2, cabY, cabD / 2));
  const led = new THREE.Mesh(new THREE.BoxGeometry(Wd - 0.2, 0.01, 0.02), ledMat);
  led.position.set(Wd / 2, cabY - cabH / 2 - 0.006, cabD * 0.6);
  group.add(led);
  for (let i = 0; i < model.bracketCount; i += 1) {
    const x = model.bracketCount === 1 ? Wd / 2 : 0.25 + ((Wd - 0.5) * i) / (model.bracketCount - 1);
    if (model.bracketMount === "wall") group.add(box(0.12, cabH + 0.12, 0.06, cabinetMat, x, cabY, 0.03));
    else group.add(box(0.12, 0.06, cabD, cabinetMat, x, cabY + cabH / 2 + 0.03, cabD / 2));
  }
  if (model.anemometer) {
    group.add(box(0.05, 0.25, 0.05, cabinetMat, Wd + 0.3, cabY + 0.2, 0.08));
    group.add(box(0.22, 0.02, 0.22, cabinetMat, Wd + 0.3, cabY + 0.33, 0.08));
  }

  /* Toile, barre de charge, bras — mis à jour selon le déploiement */
  const shoulderZ = cabD * 0.85;
  const shoulderY = cabY - cabH * 0.25;
  const fabric = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fabricMat);
  fabric.castShadow = true;
  fabric.receiveShadow = true;
  group.add(fabric);
  const valance = new THREE.Mesh(new THREE.PlaneGeometry(Wd - 0.04, 0.22), fabricMat);
  valance.castShadow = true;
  group.add(valance);
  const loadBar = box(Wd - 0.02, 0.08, 0.1, cabinetMat, Wd / 2, shoulderY, shoulderZ);
  group.add(loadBar);
  const armMat = cabinetMat;
  const armX = [0.2, Wd - 0.2];
  const arms = armX.map((x) => {
    const s = new THREE.Vector3(x, shoulderY, shoulderZ);
    const upper = bar(s, s.clone(), 0.05, armMat);
    const lower = bar(s, s.clone(), 0.045, armMat);
    group.add(upper, lower);
    return { x, upper, lower };
  });
  const armSegment = (P * 0.98) / 2;

  const setDeployment = (ratio: number) => {
    const r = THREE.MathUtils.clamp(ratio, 0, 1);
    const reach = Math.max(0.02, P * r);
    const end = new THREE.Vector3(0, shoulderY - Math.sin(PITCH) * reach, shoulderZ + Math.cos(PITCH) * reach);
    // toile : du coffre à la barre de charge
    const span = Math.hypot(end.z - shoulderZ, end.y - shoulderY);
    fabric.visible = r > 0.01;
    valance.visible = r > 0.01;
    fabric.scale.set(Wd - 0.06, span, 1);
    fabric.position.set(Wd / 2, (shoulderY + end.y) / 2 + 0.02, (shoulderZ + end.z) / 2);
    fabric.rotation.set(-Math.PI / 2 + PITCH, 0, 0);
    loadBar.position.set(Wd / 2, end.y, end.z);
    valance.position.set(Wd / 2, end.y - 0.15, end.z + 0.05);
    for (const [i, arm] of arms.entries()) {
      const s = new THREE.Vector3(arm.x, shoulderY - 0.06, shoulderZ);
      const e = new THREE.Vector3(arm.x, end.y - 0.06, end.z);
      const half = s.distanceTo(e) / 2;
      const lateral = Math.sqrt(Math.max(0, armSegment * armSegment - half * half));
      const dir = i === 0 ? 1 : -1; // le coude se replie vers le centre
      const elbow = s.clone().add(e).multiplyScalar(0.5).add(new THREE.Vector3(dir * Math.min(lateral, Wd / 2 - 0.25), 0, 0));
      (arm.upper.userData.update as (p: THREE.Vector3, q: THREE.Vector3) => void)(s, elbow);
      (arm.lower.userData.update as (p: THREE.Vector3, q: THREE.Vector3) => void)(elbow, e);
      arm.upper.visible = r > 0.01;
      arm.lower.visible = r > 0.01;
    }
  };
  setDeployment(1);

  const nightLight = new THREE.PointLight(WARM, 0, Math.max(Wd, P) * 2.5, 2);
  nightLight.position.set(Wd / 2, cabY - 0.4, cabD + 0.6);
  group.add(nightLight);

  const setNight = (night: boolean) => {
    groundMat.color.set(night ? NIGHT.ground : DAY.ground);
    ledMat.color.set(night ? WARM : 0x9a948a);
    nightLight.intensity = night && model.led ? 3 + Wd : 0;
  };

  const d = Math.max(Wd, P);
  return {
    group,
    bounds: { center: new THREE.Vector3(Wd / 2, H / 2, P / 2), size: new THREE.Vector3(Wd, H, P) },
    poses: {
      front: { position: [Wd / 2, 1.7, P + d * 0.95 + 2], target: [Wd / 2, H * 0.6, P / 3] },
      three_quarter: { position: [Wd + d * 0.4 + 1, H + 0.9, P + d * 0.65 + 1.8], target: [Wd / 2, H * 0.55, P / 3] },
      top: { position: [Wd / 2, d * 2 + 4, P / 2 + 0.01], target: [Wd / 2, 0, P / 2] },
      interior: { position: [Wd / 2, 1.6, P * 0.7], target: [Wd / 2, H, 0.3] },
    },
    pickables: [],
    setNight,
    setDeployment,
    dispose: () => disposeTree(group),
  };
}
