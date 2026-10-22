/**
 * Géométrie procédurale du screen (coffre, coulisses zip, toile, barre de charge) devant une baie.
 * Unités : mètres ; x = largeur de la baie, y = hauteur, z = 0 sur le nu de la façade (z > 0 vers l'extérieur).
 * Coffre et coulisses : sections du catalogue quand elles existent ; teinte de toile indicative.
 */
import * as THREE from "three";
import type { ScreenSceneModel } from "@/domain/scene-model";
import { DAY, NIGHT, disposeTree, type BuiltScene } from "./scene-engine";

const M = 1 / 1000;
const RAIL = 0.045; // section indicative d'une coulisse

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function buildScreenScene(model: ScreenSceneModel): BuiltScene {
  const W = model.widthMm * M;
  const H = model.heightMm * M;
  const cw = model.cassette.widthMm * M;
  const ch = model.cassette.heightMm * M;
  const group = new THREE.Group();
  group.name = "screen";

  const frameMat = new THREE.MeshStandardMaterial({ color: model.cassette.color, roughness: 0.5, metalness: 0.35 });
  const fabricMat = new THREE.MeshStandardMaterial({ color: model.fabric.color, roughness: 0.95, transparent: true, opacity: 0.9, side: THREE.DoubleSide });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe6dfd2, roughness: 0.9 });
  const revealMat = new THREE.MeshStandardMaterial({ color: 0xd9d1c3, roughness: 0.9 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xbcd6e0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35 });
  const groundMat = new THREE.MeshStandardMaterial({ color: DAY.ground, roughness: 0.95 });

  const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(W / 2, -0.001, 1);
  ground.receiveShadow = true;
  group.add(ground);

  /* Façade percée d'une baie (niche : le screen est posé dans le tableau ; façade : en applique devant) */
  const niche = model.mounting === "niche";
  const openW = niche ? W : Math.max(0.4, W - 2 * RAIL - 0.04);
  const openH = niche ? H + ch : Math.max(0.4, H - 0.02);
  const wallW = W + 2.4;
  const wallH = openH + 1.2;
  const depth = 0.3;
  const x0 = (W - openW) / 2;
  group.add(box(x0 + 1.2, wallH, depth, wallMat, -1.2 / 2 + x0 / 2, wallH / 2, -depth / 2));
  group.add(box(wallW - (x0 + 1.2) - openW, wallH, depth, wallMat, x0 + openW + (wallW - (x0 + 1.2) - openW) / 2, wallH / 2, -depth / 2));
  group.add(box(openW, wallH - openH, depth, wallMat, x0 + openW / 2, openH + (wallH - openH) / 2, -depth / 2));
  group.add(box(openW, 0.02, depth, revealMat, x0 + openW / 2, 0.01, -depth / 2));
  group.add(box(openW, openH, 0.02, glassMat, x0 + openW / 2, openH / 2, -depth + 0.02));

  /* Coffre, coulisses */
  const zFront = niche ? -0.06 : 0.04 + cw / 2;
  const topY = niche ? openH - ch / 2 : H + ch / 2;
  group.add(box(W, ch, cw, frameMat, W / 2, topY, zFront));
  const railH = topY - ch / 2;
  for (const x of [RAIL / 2, W - RAIL / 2]) group.add(box(RAIL, railH, RAIL, frameMat, x, railH / 2, zFront));

  /* Toile + barre de charge (déploiement) */
  const fabric = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fabricMat);
  fabric.castShadow = true;
  group.add(fabric);
  const bar = box(W - RAIL * 2, 0.05, 0.05, frameMat, W / 2, 0, zFront);
  group.add(bar);
  const setDeployment = (ratio: number) => {
    const r = THREE.MathUtils.clamp(ratio, 0, 1);
    const drop = Math.max(0.01, railH * r);
    fabric.visible = r > 0.01;
    fabric.scale.set(W - RAIL * 2, drop, 1);
    fabric.position.set(W / 2, railH - drop / 2, zFront);
    bar.position.set(W / 2, railH - drop, zFront);
  };
  setDeployment(1);

  const setNight = (night: boolean) => {
    groundMat.color.set(night ? NIGHT.ground : DAY.ground);
  };
  const d = Math.max(W, H);
  return {
    group,
    bounds: { center: new THREE.Vector3(W / 2, H / 2, 0), size: new THREE.Vector3(W + 1, H + 0.5, 1.2) },
    poses: {
      front: { position: [W / 2, H / 2 + 0.2, d * 1.5 + 2], target: [W / 2, H / 2, 0] },
      three_quarter: { position: [W + d * 0.7 + 1, H * 0.7 + 0.6, d * 1.2 + 1.5], target: [W / 2, H / 2, 0] },
      top: { position: [W / 2, d * 2 + 3, 1.5], target: [W / 2, 0, 0] },
      interior: { position: [W / 2, 1.5, -2.5], target: [W / 2, H / 2, 0] },
    },
    pickables: [],
    setNight,
    setDeployment,
    dispose: () => disposeTree(group),
  };
}
