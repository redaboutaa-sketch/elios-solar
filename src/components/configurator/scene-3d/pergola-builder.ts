/**
 * Géométrie procédurale de la pergola à partir du modèle de scène pur (`PergolaSceneModel`).
 * Unités three.js : mètres. Repère identique au modèle (x = longueur, z = largeur, y = hauteur ;
 * z = 0 côté arrière / mur). Sections et nombre de lames : indicatifs.
 */
import * as THREE from "three";
import type { PergolaSceneModel, SceneClosure, SceneOpening } from "@/domain/scene-model";
import { INDICATIVE_BEAM_HEIGHT_MM, INDICATIVE_POST_SECTION_MM } from "@/domain/scene-model";
import { DAY, NIGHT, disposeTree, type BuiltScene } from "./scene-engine";

const M = 1 / 1000;
const WARM = 0xffcf8a;
const SELECT = 0xb5693c;

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number, shadows = true): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  return mesh;
}

/** Frame local d'un segment : origine au départ, axe `u` le long du côté, `n` normal vers l'extérieur. */
function segmentFrame(o: SceneOpening | SceneClosure, L: number, W: number) {
  const a = new THREE.Vector3(o.from.xMm * M, 0, o.from.zMm * M);
  const b = new THREE.Vector3(o.to.xMm * M, 0, o.to.zMm * M);
  const len = a.distanceTo(b);
  const u = b.clone().sub(a).normalize();
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const centre = new THREE.Vector3(L / 2, 0, W / 2);
  const n = new THREE.Vector3(-u.z, 0, u.x);
  if (n.dot(mid.clone().sub(centre)) < 0) n.negate();
  // rotation : l'axe x local suit `u`
  const rotY = Math.atan2(-u.z, u.x);
  return { a, b, len, u, n, mid, rotY };
}

function rgbStripGeometry(length: number, along: "x" | "z"): THREE.BufferGeometry {
  const g = along === "x" ? new THREE.BoxGeometry(length, 0.012, 0.02, 32, 1, 1) : new THREE.BoxGeometry(0.02, 0.012, length, 1, 1, 32);
  const pos = g.attributes.position!;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i += 1) {
    const t = (along === "x" ? pos.getX(i) : pos.getZ(i)) / length + 0.5;
    c.setHSL(t * 0.85, 1, 0.55);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

export function buildPergolaScene(model: PergolaSceneModel): BuiltScene {
  const L = model.lengthMm * M;
  const W = model.widthMm * M;
  const H = model.heightMm * M;
  // sections du catalogue quand le modèle les fournit (systèmes HELIOSTORES), sinon valeurs indicatives
  const sec = model.sections;
  const POST = (sec ? Math.max(sec.postAcrossMm, sec.postAlongMm) : INDICATIVE_POST_SECTION_MM) * M;
  const BEAM_H = (sec?.beamHeightMm ?? INDICATIVE_BEAM_HEIGHT_MM) * M;
  const along = model.blades.orientation === "along_length";
  const group = new THREE.Group();
  group.name = "pergola";
  const pickables: THREE.Object3D[] = [];

  const structure = new THREE.MeshStandardMaterial({ color: model.colors.structure, roughness: 0.55, metalness: 0.35 });
  const bladeMat = new THREE.MeshStandardMaterial({ color: model.colors.blades, roughness: 0.5, metalness: 0.3 });
  const groundMat = new THREE.MeshStandardMaterial({ color: DAY.ground, roughness: 0.95 });
  const terraceMat = new THREE.MeshStandardMaterial({ color: 0xc9bca6, roughness: 0.85 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe6dfd2, roughness: 0.9 });
  const ledMat = model.lighting.color === "rgb" ? new THREE.MeshBasicMaterial({ vertexColors: true, color: 0x777777 }) : new THREE.MeshBasicMaterial({ color: 0x9a948a });
  const bladeLedMat = new THREE.MeshBasicMaterial({ color: 0x9a948a });
  const heaterGlowMat = new THREE.MeshStandardMaterial({ color: 0x4a2a1c, emissive: 0xff6a2a, emissiveIntensity: 0.15, roughness: 0.6 });
  const lanternGlowMat = new THREE.MeshStandardMaterial({ color: 0xf4e7cf, emissive: WARM, emissiveIntensity: 0.1, roughness: 0.4, transparent: true, opacity: 0.9 });

  /* Sol, terrasse, mur */
  const ground = new THREE.Mesh(new THREE.CircleGeometry(90, 64), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(L / 2, -0.001, W / 2);
  ground.receiveShadow = true;
  group.add(ground);
  const terrace = box(L + 1.2, 0.05, W + (model.wall ? 0.6 : 1.2), terraceMat, L / 2, -0.024, W / 2 + (model.wall ? 0.3 : 0));
  terrace.castShadow = false;
  group.add(terrace);
  if (model.wall) {
    const wall = box(L + 3, H + 1, 0.3, wallMat, L / 2, (H + 1) / 2, -0.15);
    group.add(wall);
  }

  /* Poteaux (angles + intermédiaires) */
  for (const p of model.posts) {
    const x = THREE.MathUtils.clamp(p.xMm * M, POST / 2, L - POST / 2);
    const z = THREE.MathUtils.clamp(p.zMm * M, POST / 2, W - POST / 2);
    const post = box(POST, H, POST, structure, x, H / 2, z);
    post.name = p.id;
    group.add(post);
  }

  /* Poutres périphériques (avec gouttière) + LED de gouttière */
  const beamY = H - BEAM_H / 2;
  const ledY = H - BEAM_H + 0.012;
  const ledStrips: THREE.Mesh[] = [];
  for (const beam of model.beams) {
    const horizontal = beam.side === "front" || beam.side === "back";
    const z = beam.side === "back" ? POST / 2 : beam.side === "front" ? W - POST / 2 : W / 2;
    const x = beam.side === "left" ? POST / 2 : beam.side === "right" ? L - POST / 2 : L / 2;
    group.add(horizontal ? box(L, BEAM_H, POST, structure, L / 2, beamY, z) : box(POST, BEAM_H, W, structure, x, beamY, W / 2));
    if (beam.led) {
      const len = (horizontal ? L : W) - POST * 2;
      const geo = model.lighting.color === "rgb" ? rgbStripGeometry(len, horizontal ? "x" : "z") : horizontal ? new THREE.BoxGeometry(len, 0.012, 0.02) : new THREE.BoxGeometry(0.02, 0.012, len);
      const strip = new THREE.Mesh(geo, ledMat);
      const inset = POST / 2 + 0.03;
      strip.position.set(
        beam.side === "left" ? x + inset : beam.side === "right" ? x - inset : L / 2,
        ledY,
        beam.side === "back" ? z + inset : beam.side === "front" ? z - inset : W / 2,
      );
      ledStrips.push(strip);
      group.add(strip);
    }
  }

  /* Lames orientables (instanciées) : réparties sur la longueur, ou parallèles au mur et réparties sur la projection */
  const innerL = (along ? W : L) - POST * 2;
  const span = (along ? L : W) - POST * 2;
  const pitch = innerL / model.blades.count;
  const bladeT = Math.max(0.018, (sec?.bladeThicknessMm ?? 22) * M * 0.6);
  const bladeGeo = along ? new THREE.BoxGeometry(span, bladeT, pitch * 0.98) : new THREE.BoxGeometry(pitch * 0.98, bladeT, span);
  const blades = new THREE.InstancedMesh(bladeGeo, bladeMat, model.blades.count);
  blades.castShadow = true;
  blades.receiveShadow = false; // évite l'acné d'ombre sur les lames fines
  group.add(blades);
  // toiture toile (HelioLux) : pas de lames, une toile tendue inclinée du mur vers la poutre avant (pente indicative)
  if (model.roof === "fabric") {
    blades.visible = false;
    const fabricMat = new THREE.MeshStandardMaterial({ color: model.roofFabricColor ?? "#8d8f8c", roughness: 0.95, side: THREE.DoubleSide });
    const rise = W * Math.tan(THREE.MathUtils.degToRad(10));
    const len = Math.hypot(W - POST * 2, rise);
    const roofMesh = new THREE.Mesh(new THREE.PlaneGeometry(L - POST * 2, len), fabricMat);
    roofMesh.rotation.x = -Math.PI / 2 + Math.atan2(rise, W - POST * 2);
    roofMesh.position.set(L / 2, H + rise / 2 + 0.02, W / 2);
    roofMesh.castShadow = true;
    group.add(roofMesh);
  }
  let bladeLeds: THREE.InstancedMesh | null = null;
  if (model.lighting.blades) {
    const g = new THREE.BoxGeometry(0.018, 0.006, span * 0.94);
    g.translate(0, -0.015, 0);
    bladeLeds = new THREE.InstancedMesh(g, bladeLedMat, model.blades.count);
    group.add(bladeLeds);
  }
  const bladeY = H - BEAM_H * 0.4;
  const tmp = new THREE.Object3D();
  const setBladeAngle = (deg: number) => {
    const a = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(deg, 0, model.blades.maxAngleDeg ?? 90));
    for (let i = 0; i < model.blades.count; i += 1) {
      if (along) {
        tmp.position.set(L / 2, bladeY, POST + pitch * (i + 0.5));
        tmp.rotation.set(a, 0, 0);
      } else {
        tmp.position.set(POST + pitch * (i + 0.5), bladeY, W / 2);
        tmp.rotation.set(0, 0, a);
      }
      tmp.updateMatrix();
      blades.setMatrixAt(i, tmp.matrix);
      bladeLeds?.setMatrixAt(i, tmp.matrix);
    }
    blades.instanceMatrix.needsUpdate = true;
    blades.computeBoundingSphere();
    if (bladeLeds) {
      bladeLeds.instanceMatrix.needsUpdate = true;
      bladeLeds.computeBoundingSphere();
    }
  };
  setBladeAngle(0);

  /* Ouvertures : zones cliquables + fermetures */
  const hitMats = new Map<string, THREE.MeshBasicMaterial>();
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xbcd6e0, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x5c6166, roughness: 0.95, transparent: true, opacity: 0.88, side: THREE.DoubleSide });
  const closureH = H - BEAM_H;
  for (const o of model.openings) {
    const f = segmentFrame(o, L, W);
    const seg = new THREE.Group();
    seg.position.copy(f.mid);
    seg.rotation.y = f.rotY;
    // décalage vers l'intérieur de la ligne des poteaux
    const inward = f.n.clone().multiplyScalar(-POST / 2);
    seg.position.add(inward);
    const usable = Math.max(0.2, f.len - POST);
    const hitMat = new THREE.MeshBasicMaterial({ color: SELECT, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    hitMats.set(o.id, hitMat);
    const hit = new THREE.Mesh(new THREE.PlaneGeometry(usable, closureH), hitMat);
    hit.position.y = closureH / 2;
    hit.userData.segmentId = o.id;
    seg.add(hit);
    pickables.push(hit);
    if (o.closure) seg.add(buildClosure(o.closure, usable, closureH, structure, glassMat, screenMat));
    group.add(seg);
  }

  /* Lampes chauffantes : sous la poutre avant, réparties sur la longueur */
  const heaterGroup = new THREE.Group();
  for (let i = 0; i < model.heaters.count; i += 1) {
    const x = (L * (i + 1)) / (model.heaters.count + 1);
    const z = W - POST - 0.25;
    heaterGroup.add(box(0.62, 0.07, 0.14, structure, x, H - BEAM_H - 0.06, z));
    heaterGroup.add(box(0.56, 0.012, 0.09, heaterGlowMat, x, H - BEAM_H - 0.1, z, false));
  }
  group.add(heaterGroup);

  /* Lanternes : posées au sol, à l'intérieur, près des poteaux avant */
  const lanternSpots: Array<[number, number]> = [[0.45, W - 0.45], [L - 0.45, W - 0.45], [0.45, 0.6], [L - 0.45, 0.6]];
  for (let i = 0; i < model.lanterns.count; i += 1) {
    const [x, z] = lanternSpots[i % lanternSpots.length]!;
    const s = model.lanterns.option === "large" ? 1.3 : 1;
    group.add(box(0.2 * s, 0.03, 0.2 * s, structure, x, 0.015, z));
    group.add(box(0.16 * s, 0.3 * s, 0.16 * s, lanternGlowMat, x, 0.03 + 0.15 * s, z));
    group.add(box(0.22 * s, 0.03, 0.22 * s, structure, x, 0.03 + 0.3 * s + 0.015, z));
  }

  /* Spots LED dans les lames : nombre documenté, répartition indicative en grille */
  const spotMat = new THREE.MeshBasicMaterial({ color: 0x9a948a });
  if (model.lighting.spots) {
    const n = model.lighting.spots;
    const cols = n <= 4 ? 2 : 3;
    const rows = Math.ceil(n / cols);
    for (let k = 0; k < n; k += 1) {
      const c = k % cols;
      const r = Math.floor(k / cols);
      const spot = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 16), spotMat);
      spot.position.set(POST + ((L - 2 * POST) * (c + 0.5)) / cols, bladeY - bladeT, POST + ((W - 2 * POST) * (r + 0.5)) / rows);
      group.add(spot);
    }
  }

  /* Lumières ponctuelles nocturnes (nombre fixe pour éviter les recompilations de shaders) */
  const nightLights: Array<{ light: THREE.PointLight; night: number }> = [];
  if (model.lighting.gutter || model.lighting.blades || model.lighting.spots) {
    const rgb = model.lighting.color === "rgb";
    for (const [i, fx] of [0.3, 0.7].entries()) {
      const light = new THREE.PointLight(rgb ? (i === 0 ? 0xff5fd2 : 0x55d6ff) : WARM, 0, Math.max(L, W) * 2.5, 2);
      light.position.set(L * fx, H - 0.35, W / 2);
      nightLights.push({ light, night: 4 + (L * W) / 6 });
      group.add(light);
    }
  }
  if (model.heaters.count > 0) {
    const light = new THREE.PointLight(0xff7a3a, 0, 6, 2);
    light.position.set(L / 2, H - BEAM_H - 0.4, W - POST - 0.4);
    nightLights.push({ light, night: 1.5 * model.heaters.count });
    group.add(light);
  }
  if (model.lanterns.count > 0) {
    const [x, z] = lanternSpots[0]!;
    const light = new THREE.PointLight(WARM, 0, 4, 2);
    light.position.set(x, 0.35, z);
    nightLights.push({ light, night: 1.2 });
    group.add(light);
  }

  const setNight = (night: boolean) => {
    groundMat.color.set(night ? NIGHT.ground : DAY.ground);
    const rgb = model.lighting.color === "rgb";
    ledMat.color.set(rgb ? 0xffffff : WARM); // éclairages choisis représentés allumés (pas d'ambiance nuit)
    bladeLedMat.color.set(WARM);
    spotMat.color.set(WARM);
    heaterGlowMat.emissiveIntensity = night ? 1.6 : 0.15;
    lanternGlowMat.emissiveIntensity = night ? 1.8 : 0.1;
    for (const { light, night: intensity } of nightLights) light.intensity = night ? intensity : 0;
  };

  const setSelected = (id: string | null) => {
    for (const [segId, mat] of hitMats) mat.opacity = segId === id ? 0.22 : 0;
  };

  const d = Math.max(L, W);
  const center = new THREE.Vector3(L / 2, H / 2, W / 2);
  return {
    group,
    bounds: { center, size: new THREE.Vector3(L, H, W) },
    poses: {
      front: { position: [L / 2, 1.7, W + d * 0.95 + 1.5], target: [L / 2, H * 0.55, W / 2] },
      three_quarter: { position: [L + d * 0.45 + 1, H + 1.3, W + d * 0.65 + 1.5], target: [L / 2, H * 0.45, W / 2] },
      top: { position: [L / 2, d * 1.6 + 3, W / 2 + 0.01], target: [L / 2, 0, W / 2] },
    },
    pickables,
    setNight,
    setBladeAngle,
    setSelected,
    dispose: () => disposeTree(group),
  };
}

/** Fermeture dans le repère local du segment : x le long du segment (centré), y vers le haut, z normal. */
function buildClosure(c: SceneClosure, width: number, height: number, structure: THREE.Material, glassMat: THREE.Material, screenMat: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  g.name = `closure-${c.id}`;
  const rail = 0.045;
  if (c.type === "glass") {
    const panels = c.option === "fixed" ? Math.max(1, Math.round(width / 1.5)) : Math.max(2, Math.round(width / 1));
    const framed = c.option !== "sliding_frameless";
    const pw = width / panels;
    for (let i = 0; i < panels; i += 1) {
      const x = -width / 2 + pw * (i + 0.5);
      const zOff = c.option === "fixed" ? 0 : (i % 2 === 0 ? -0.02 : 0.02);
      const glass = new THREE.Mesh(new THREE.BoxGeometry(pw - (framed ? 0.02 : 0.006), height - rail * 2, 0.01), glassMat);
      glass.position.set(x, height / 2, zOff);
      g.add(glass);
      if (framed) {
        g.add(box(0.03, height - rail * 2, 0.03, structure, x - pw / 2 + 0.015, height / 2, zOff));
        g.add(box(0.03, height - rail * 2, 0.03, structure, x + pw / 2 - 0.015, height / 2, zOff));
      }
    }
    g.add(box(width, rail, 0.08, structure, 0, rail / 2, 0));
    g.add(box(width, rail, 0.08, structure, 0, height - rail / 2, 0));
    return g;
  }
  if (c.type === "slats") {
    const modules = c.assembly.modules;
    const midPosts = c.assembly.intermediatePosts;
    const moduleW = width / modules;
    const slatCount = Math.floor((height - 0.1) / 0.11);
    const slatGeo = new THREE.BoxGeometry(moduleW - (modules > 1 ? 0.08 : 0.02), 0.07, 0.02);
    const slats = new THREE.InstancedMesh(slatGeo, structure, slatCount * modules);
    const tmp = new THREE.Object3D();
    let k = 0;
    for (let m = 0; m < modules; m += 1) {
      for (let i = 0; i < slatCount; i += 1) {
        tmp.position.set(-width / 2 + moduleW * (m + 0.5), 0.1 + i * 0.11, 0);
        tmp.rotation.set(-0.5, 0, 0);
        tmp.updateMatrix();
        slats.setMatrixAt(k, tmp.matrix);
        k += 1;
      }
    }
    slats.castShadow = true;
    g.add(slats);
    // cadre + poteau(x) intermédiaire(s) de l'assemblage modulaire (indicatif, à confirmer fournisseur)
    g.add(box(0.04, height, 0.05, structure, -width / 2 + 0.02, height / 2, 0));
    g.add(box(0.04, height, 0.05, structure, width / 2 - 0.02, height / 2, 0));
    for (let p = 1; p <= midPosts; p += 1) g.add(box(0.08, height, 0.08, structure, -width / 2 + (width * p) / (midPosts + 1), height / 2, 0));
    return g;
  }
  // store vertical ZIP : coffre en haut, coulisses latérales, toile
  const fabric = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.08, height - 0.16), screenMat);
  fabric.position.set(0, (height - 0.16) / 2, 0);
  fabric.castShadow = true;
  g.add(fabric);
  g.add(box(width, 0.13, 0.12, structure, 0, height - 0.065, 0));
  g.add(box(0.04, height, 0.05, structure, -width / 2 + 0.02, height / 2, 0));
  g.add(box(0.04, height, 0.05, structure, width / 2 - 0.02, height / 2, 0));
  g.add(box(width - 0.08, 0.035, 0.04, structure, 0, 0.02, 0));
  return g;
}
