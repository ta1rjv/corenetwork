// Three.js scene for the home page descent:
// data hall cabinet -> server -> CPU package -> silicon die (GLSL) -> core.
// Loaded lazily from home.js so a CDN failure never breaks the page content.
// World units are meters for the hall and server; the die shader uses 1 unit = 1 mm of die space.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  POST_VERT, POST_FRAG, LED_VERT, LED_FRAG, SHAFT_VERT, SHAFT_FRAG, DUST_VERT, DUST_FRAG,
  DIE_VERT, DIE_FRAG,
} from './shaders.js';
import { clamp, lerp, smooth } from './path.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const U = 0.04445;          // one rack unit (m)
const U_BASE = 0.09;        // height of the bottom of U0 above the floor (m)
const PLATE_W = 0.4826;     // 19 inch face plate width (m)
const PX_PER_M = 2000;      // canvas pixels per meter for face plate textures
const FRONT_Z = 0.475;      // front surface of face plates inside a cabinet
const CAB_PITCH = 0.62;
const CAB_COUNT_HALF = 5;   // cabinets from -5 to +5
const HERO_Y = U_BASE + (22 + 1) * U; // center height of the hero 2U server
const SRV = new THREE.Vector3(0, -20, 0);   // server stage origin
const CPU1 = new THREE.Vector3(-0.08, 0, -0.06);
const DIE_Y = 0.0203;
const LN_ZMAX = Math.log(1800);

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function mulberry32(a) {
  return function rnd() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function mkCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function canvasTex(canvas, maxAniso, opts = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = Math.min(4, maxAniso);
  if (opts.repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(opts.repeat[0], opts.repeat[1]);
  }
  t.needsUpdate = true;
  return t;
}

function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }

function setMatrices(mesh, list) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  list.forEach((it, i) => {
    p.set(it.x, it.y, it.z);
    s.set(it.sx === undefined ? 1 : it.sx, it.sy === undefined ? 1 : it.sy, it.sz === undefined ? 1 : it.sz);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
}

function makeInstanced(geo, mat, list) {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
  mesh.count = list.length;
  setMatrices(mesh, list);
  return mesh;
}

// ---------------------------------------------------------------------------
// Face plate textures (drawn with canvas, shared by all instances)
// ---------------------------------------------------------------------------
function plateCanvas(kind, hU) {
  const w = Math.round(PLATE_W * PX_PER_M);
  const h = Math.round(hU * U * PX_PER_M);
  const c = mkCanvas(w, h);
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, '#222932');
  grd.addColorStop(0.5, '#161b21');
  grd.addColorStop(1, '#0f1317');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  g.fillStyle = 'rgba(160,205,235,0.12)';
  g.fillRect(0, 0, w, 2);
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.fillRect(0, h - 2, w, 2);
  // rack ears
  g.fillStyle = '#262e38';
  g.fillRect(0, 0, 40, h);
  g.fillRect(w - 40, 0, 40, h);
  g.fillStyle = '#05070a';
  [0.28, 0.72].forEach((k) => {
    g.beginPath(); g.arc(20, h * k, 5, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(w - 20, h * k, 5, 0, Math.PI * 2); g.fill();
  });

  if (kind === 'server') {
    const rows = hU === 1 ? 1 : 2;
    const bh = hU === 1 ? 56 : 70;
    const gap = 8;
    const total = rows * bh + (rows - 1) * gap;
    const y0 = (h - total) / 2;
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < 4; i++) {
        const bx = 70 + i * 108;
        const by = y0 + r * (bh + gap);
        g.fillStyle = '#0a0d11';
        g.fillRect(bx, by, 100, bh);
        g.strokeStyle = '#2b343f';
        g.lineWidth = 1.5;
        g.strokeRect(bx + 0.5, by + 0.5, 99, bh - 1);
        g.fillStyle = '#1f2832';
        g.fillRect(bx + 8, by + bh - 12, 84, 5);
        g.fillStyle = '#05070a';
        g.beginPath(); g.arc(bx + 90, by + 9, 3.2, 0, Math.PI * 2); g.fill();
      }
    }
    g.fillStyle = '#04060a';
    for (let x = 530; x < 780; x += 8) {
      for (let y = 10; y < h - 8; y += 8) {
        g.beginPath(); g.arc(x, y, 1.7, 0, Math.PI * 2); g.fill();
      }
    }
    g.strokeStyle = '#3a4654';
    g.lineWidth = 2;
    g.fillStyle = '#10151b';
    g.beginPath(); g.arc(815, h / 2, 10, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = '#05070a';
    g.beginPath(); g.arc(880, h / 2 - 14, 4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(880, h / 2 + 14, 4, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(25,200,230,0.55)';
    g.fillRect(522, 8, 2, h - 16);
  } else if (kind === 'switch') {
    for (let r = 0; r < 2; r++) {
      for (let i = 0; i < 24; i++) {
        const x = 70 + i * 29;
        const y = 24 + r * 26;
        g.fillStyle = '#04060a';
        g.fillRect(x, y, 22, 16);
        g.fillStyle = '#a98a45';
        g.fillRect(x + 4, y + 11, 14, 2);
      }
    }
    for (let i = 0; i < 4; i++) {
      g.fillStyle = '#04060a';
      g.fillRect(800 + i * 32, 30, 26, 22);
      g.strokeStyle = '#2f3945';
      g.strokeRect(800.5 + i * 32, 30.5, 25, 21);
    }
  } else if (kind === 'patch') {
    for (let i = 0; i < 24; i++) {
      const x = 70 + i * 32;
      g.fillStyle = '#6f5a2b';
      g.fillRect(x - 2, h / 2 - 16, 30, 32);
      g.fillStyle = '#04060a';
      g.fillRect(x, h / 2 - 12, 26, 24);
      g.fillStyle = '#a98a45';
      g.fillRect(x + 5, h / 2 + 5, 16, 2);
    }
  }
  return c;
}

function makePerfAlphaCanvas() {
  const c = mkCanvas(64, 64);
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#000';
  [[16, 16], [48, 48], [-16, 48], [80, 48], [16, 80], [48, -16], [16, -16], [-16, 16], [80, 16]].forEach((p) => {
    g.beginPath(); g.arc(p[0], p[1], 9, 0, Math.PI * 2); g.fill();
  });
  return c;
}

function makeFloorCanvas() {
  const c = mkCanvas(512, 512);
  const g = c.getContext('2d');
  g.fillStyle = '#0a0e13';
  g.fillRect(0, 0, 512, 512);
  for (let ty = 0; ty < 2; ty++) {
    for (let tx = 0; tx < 2; tx++) {
      const x = tx * 256;
      const y = ty * 256;
      g.fillStyle = (tx + ty) % 2 ? '#0c1118' : '#0a0e13';
      g.fillRect(x, y, 256, 256);
      g.strokeStyle = '#1b242e';
      g.lineWidth = 4;
      g.strokeRect(x + 2, y + 2, 252, 252);
      g.strokeStyle = 'rgba(80,140,180,0.08)';
      g.lineWidth = 1;
      g.strokeRect(x + 12, y + 12, 232, 232);
      if ((tx + ty) % 2) {
        g.fillStyle = '#04070a';
        for (let i = 0; i < 12; i++) {
          for (let j = 0; j < 12; j++) {
            g.beginPath(); g.arc(x + 28 + i * 18, y + 28 + j * 18, 3.2, 0, Math.PI * 2); g.fill();
          }
        }
      }
    }
  }
  return c;
}

function makePcbCanvas() {
  const c = mkCanvas(1024, 800);
  const g = c.getContext('2d');
  g.fillStyle = '#071417';
  g.fillRect(0, 0, 1024, 800);
  const rnd = mulberry32(77);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (let i = 0; i < 520; i++) {
    let x = Math.floor(rnd() * 64) * 16;
    let y = Math.floor(rnd() * 50) * 16;
    g.beginPath();
    g.moveTo(x, y);
    const segs = 2 + Math.floor(rnd() * 4);
    let horiz = rnd() < 0.5;
    for (let s = 0; s < segs; s++) {
      const len = (1 + Math.floor(rnd() * 8)) * 16;
      const dir = rnd() < 0.5 ? -1 : 1;
      if (horiz) x += len * dir; else y += len * dir;
      g.lineTo(x, y);
      horiz = !horiz;
    }
    g.strokeStyle = rnd() < 0.15 ? 'rgba(210,170,80,0.35)' : 'rgba(40,150,160,0.30)';
    g.lineWidth = rnd() < 0.2 ? 3 : 1.5;
    g.stroke();
    g.fillStyle = 'rgba(210,170,80,0.5)';
    g.beginPath(); g.arc(x, y, 2.4, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = 'rgba(230,240,250,0.16)';
  g.lineWidth = 1.5;
  for (let i = 0; i < 18; i++) {
    g.strokeRect(rnd() * 900, rnd() * 700, 40 + rnd() * 90, 30 + rnd() * 60);
  }
  g.fillStyle = '#c9a24a';
  [[30, 30], [994, 30], [30, 770], [994, 770]].forEach((p) => {
    g.beginPath(); g.arc(p[0], p[1], 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#04080a';
    g.beginPath(); g.arc(p[0], p[1], 5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c9a24a';
  });
  return c;
}

function drawWordmark(g, cx, cy, size, color, shadow) {
  g.save();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '700 ' + size + 'px "Space Grotesk", "Segoe UI", Arial, sans-serif';
  if (shadow) {
    g.fillStyle = shadow;
    g.fillText('CORENETWORK', cx + 1.5, cy + 1.5);
  }
  g.fillStyle = color;
  g.fillText('CORENETWORK', cx, cy);
  g.restore();
}

function makeIhsCanvas() {
  const w = 900;
  const h = 1030;
  const c = mkCanvas(w, h);
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, w, h);
  grd.addColorStop(0, '#c4cbd3');
  grd.addColorStop(0.5, '#9aa3ad');
  grd.addColorStop(1, '#b4bcc5');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  const rnd = mulberry32(5);
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = 'rgba(' + (rnd() < 0.5 ? '255,255,255' : '40,50,60') + ',' + (0.02 + rnd() * 0.05).toFixed(3) + ')';
    g.fillRect(0, rnd() * h, w, 1 + rnd() * 2);
  }
  g.strokeStyle = 'rgba(30,38,48,0.55)';
  g.lineWidth = 3;
  g.strokeRect(40, 40, w - 80, h - 80);
  // pin-1 marker
  g.fillStyle = 'rgba(30,38,48,0.75)';
  g.beginPath(); g.moveTo(40, 40); g.lineTo(130, 40); g.lineTo(40, 130); g.closePath(); g.fill();
  // etched core ring mark
  g.strokeStyle = 'rgba(30,38,48,0.8)';
  g.lineWidth = 10;
  g.beginPath(); g.arc(w / 2, 360, 92, 0, Math.PI * 2); g.stroke();
  g.fillStyle = 'rgba(30,38,48,0.8)';
  g.beginPath(); g.arc(w / 2, 360, 34, 0, Math.PI * 2); g.fill();
  g.lineWidth = 6;
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    g.beginPath();
    g.moveTo(w / 2 + Math.cos(a) * 92, 360 + Math.sin(a) * 92);
    g.lineTo(w / 2 + Math.cos(a) * 150, 360 + Math.sin(a) * 150);
    g.stroke();
  }
  drawWordmark(g, w / 2, 620, 96, 'rgba(26,32,40,0.88)', 'rgba(255,255,255,0.35)');
  g.fillStyle = 'rgba(26,32,40,0.55)';
  for (let i = 0; i < 24; i++) g.fillRect(150 + i * 25, 720, 3, i % 4 === 0 ? 34 : 18);
  return c;
}

function makeLidCanvas() {
  const w = 900;
  const h = 1400;
  const c = mkCanvas(w, h);
  const g = c.getContext('2d');
  const grd = g.createLinearGradient(0, 0, w, 0);
  grd.addColorStop(0, '#222a33');
  grd.addColorStop(0.5, '#2b343e');
  grd.addColorStop(1, '#202830');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
  const rnd = mulberry32(9);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = 'rgba(255,255,255,' + (0.01 + rnd() * 0.03).toFixed(3) + ')';
    g.fillRect(0, rnd() * h, w, 1 + rnd() * 1.5);
  }
  // vent slots on the rear half
  g.fillStyle = '#080b0f';
  for (let r = 0; r < 14; r++) {
    for (let k = 0; k < 6; k++) g.fillRect(90 + k * 130, 880 + r * 34, 100, 10);
  }
  // sticker
  g.fillStyle = '#10151b';
  g.fillRect(160, 250, 580, 300);
  g.strokeStyle = 'rgba(25,200,230,0.8)';
  g.lineWidth = 4;
  g.strokeRect(160, 250, 580, 300);
  drawWordmark(g, w / 2, 380, 78, '#e8f4fb', null);
  g.fillStyle = 'rgba(25,200,230,0.9)';
  g.fillRect(250, 450, 400, 4);
  g.fillStyle = 'rgba(140,160,180,0.8)';
  for (let i = 0; i < 20; i++) g.fillRect(250 + i * 20, 480, 3, i % 5 === 0 ? 30 : 16);
  return c;
}

// ---------------------------------------------------------------------------
// Scene factory
// ---------------------------------------------------------------------------
/**
 * @param {{canvas: HTMLCanvasElement, quality: object, onLost?: Function}} opts
 */
export function createScene({ canvas, quality, onLost }) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x03050a, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const lowK = quality.low ? 0.75 : 1;

  let pr = Math.min(window.devicePixelRatio || 1, quality.dprCap);
  let width = window.innerWidth;
  let height = window.innerHeight;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03050a);
  scene.fog = new THREE.FogExp2(0x04070c, 0.07);
  const camera = new THREE.PerspectiveCamera(40, width / height, 0.05, 80);

  // Environment reflections for metals (generated once)
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.3;
  pmrem.dispose();

  // Lights (count is fixed; position and intensity change per stage)
  const hemi = new THREE.HemisphereLight(0x3d6a8f, 0x07090c, 0.6);
  const dirL = new THREE.DirectionalLight(0xa8d8ff, 0.5);
  dirL.position.set(1.5, 3, 4);
  const cyanL = new THREE.PointLight(0x2ad4ff, 6, 0, 2);
  const amberL = new THREE.PointLight(0xffa640, 2.5, 0, 2);
  scene.add(hemi, dirL, cyanL, amberL);

  const ledMat = new THREE.ShaderMaterial({
    vertexShader: LED_VERT,
    fragmentShader: LED_FRAG,
    uniforms: { uTime: { value: 0 }, uGain: { value: 1.6 } },
  });
  const ledGeo = box(0.0055, 0.003, 0.002);

  function ledSet(entries) {
    const n = entries.length;
    const mesh = new THREE.InstancedMesh(ledGeo.clone(), ledMat, Math.max(1, n));
    mesh.count = n;
    const col = new Float32Array(n * 3);
    const ph = new Float32Array(n);
    const rate = new Float32Array(n);
    const list = [];
    entries.forEach((e, i) => {
      list.push({ x: e.x, y: e.y, z: e.z, sx: e.s || 1, sy: e.s || 1, sz: 1 });
      col.set(e.c, i * 3);
      ph[i] = e.ph;
      rate[i] = e.rate;
    });
    setMatrices(mesh, list);
    mesh.geometry.setAttribute('aColor', new THREE.InstancedBufferAttribute(col, 3));
    mesh.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1));
    mesh.geometry.setAttribute('aRate', new THREE.InstancedBufferAttribute(rate, 1));
    return mesh;
  }

  const CYAN = [0.1, 0.8, 1.0];
  const AMBER = [1.0, 0.55, 0.1];
  const GREEN = [0.2, 1.0, 0.5];

  // =========================================================================
  // HALL (cabinet stage)
  // =========================================================================
  const hall = new THREE.Group();
  scene.add(hall);
  const rng = mulberry32(2024);

  const matPlateBase = {
    metalness: 0.5, roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0.38,
  };
  function plateMaterial(kind, hU) {
    const t = canvasTex(plateCanvas(kind, hU), maxAniso);
    return new THREE.MeshStandardMaterial({ ...matPlateBase, map: t, emissiveMap: t });
  }
  const mat1U = plateMaterial('server', 1);
  const mat2U = plateMaterial('server', 2);
  const matSw = plateMaterial('switch', 1);
  const matPp = plateMaterial('patch', 1);
  const matBlank = new THREE.MeshStandardMaterial({ color: 0x0c1014, metalness: 0.6, roughness: 0.5 });
  const matShell = new THREE.MeshStandardMaterial({ color: 0x10151a, metalness: 0.7, roughness: 0.45 });

  // Layout
  const slots = [];
  function fillRange(cab, hi, lo, isTop) {
    let u = hi;
    let first = true;
    while (u >= lo) {
      let size = (rng() < 0.42 && u - 1 >= lo) ? 2 : 1;
      let kind = 'server';
      if (isTop && first) { kind = 'patch'; size = 1; } else if (isTop && u === hi - 1) { kind = 'switch'; size = 1; } else if (rng() < 0.1) kind = 'blank';
      slots.push({ cab, u0: u - size + 1, h: size, kind });
      u -= size;
      first = false;
    }
  }
  for (let cab = -CAB_COUNT_HALF; cab <= CAB_COUNT_HALF; cab++) {
    if (cab === 0) {
      fillRange(cab, 41, 26, true);
      slots.push({ cab, u0: 24, h: 1, kind: 'blank' });
      slots.push({ cab, u0: 25, h: 1, kind: 'blank' });
      slots.push({ cab, u0: 22, h: 2, kind: 'server', hero: true });
      fillRange(cab, 21, 2, false);
    } else {
      fillRange(cab, 41, 2, true);
    }
  }

  const lists = { s1: [], s2: [], sw: [], pp: [], blank: [] };
  const ledsHall = [];
  slots.forEach((s) => {
    const cx = s.cab * CAB_PITCH;
    const cy = U_BASE + (s.u0 + s.h / 2) * U;
    if (s.kind === 'blank') {
      lists.blank.push({ x: cx, y: cy, z: FRONT_Z - 0.01, sx: PLATE_W, sy: s.h * U - 0.002, sz: 0.02 });
      return;
    }
    const entry = { x: cx, y: cy, z: FRONT_Z - 0.0225 };
    if (s.kind === 'patch') { lists.pp.push(entry); return; }
    if (s.kind === 'switch') {
      lists.sw.push(entry);
      for (let i = 0; i < 24; i++) {
        const px = 70 + i * 29 + 11;
        ledsHall.push({
          x: cx - PLATE_W / 2 + px / PX_PER_M,
          y: cy + (44.5 - 14) / PX_PER_M,
          z: FRONT_Z + 0.0005,
          c: rng() < 0.12 ? AMBER : CYAN,
          ph: rng(),
          rate: rng() < 0.5 ? 0 : 1.5 + rng() * 5,
          s: 0.8,
        });
      }
      return;
    }
    (s.h === 1 ? lists.s1 : lists.s2).push(entry);
    const hpx = Math.round(s.h * U * PX_PER_M);
    const toX = (px) => cx - PLATE_W / 2 + px / PX_PER_M;
    const toY = (py) => cy + (hpx / 2 - py) / PX_PER_M;
    ledsHall.push({ x: toX(880), y: toY(hpx / 2 - 14), z: FRONT_Z + 0.0005, c: CYAN, ph: rng(), rate: rng() < 0.6 ? 0 : 0.8 + rng(), s: 1 });
    ledsHall.push({ x: toX(880), y: toY(hpx / 2 + 14), z: FRONT_Z + 0.0005, c: rng() < 0.3 ? AMBER : GREEN, ph: rng(), rate: rng() < 0.5 ? 0 : 0.5 + rng() * 2, s: 1 });
    const rows = s.h === 1 ? 1 : 2;
    const bh = s.h === 1 ? 56 : 70;
    const total = rows * bh + (rows - 1) * 8;
    const y0 = (hpx - total) / 2;
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < 4; i++) {
        ledsHall.push({
          x: toX(70 + i * 108 + 90),
          y: toY(y0 + r * (bh + 8) + 9),
          z: FRONT_Z + 0.0005,
          c: rng() < 0.2 ? AMBER : CYAN,
          ph: rng(),
          rate: 7 + rng() * 6,
          s: 0.7,
        });
      }
    }
  });

  const plateGeo = (hU) => box(PLATE_W, hU * U - 0.002, 0.045);
  const geo1 = plateGeo(1);
  const geo2 = plateGeo(2);
  hall.add(makeInstanced(geo1, mat1U, lists.s1));
  hall.add(makeInstanced(geo2, mat2U, lists.s2));
  hall.add(makeInstanced(geo1, matSw, lists.sw));
  hall.add(makeInstanced(geo1, matPp, lists.pp));
  hall.add(makeInstanced(box(1, 1, 1), matBlank, lists.blank));
  hall.add(ledSet(ledsHall));

  // Cabinet shells
  const shell = [];
  const rails = [];
  const doorsClosed = [];
  const strips = [];
  const CH = 2.05;
  for (let cab = -CAB_COUNT_HALF; cab <= CAB_COUNT_HALF; cab++) {
    const x = cab * CAB_PITCH;
    shell.push({ x: x - 0.294, y: CH / 2, z: 0, sx: 0.012, sy: CH, sz: 1.0 });
    shell.push({ x: x + 0.294, y: CH / 2, z: 0, sx: 0.012, sy: CH, sz: 1.0 });
    shell.push({ x, y: CH, z: 0, sx: 0.6, sy: 0.02, sz: 1.0 });
    shell.push({ x, y: 0.04, z: 0.02, sx: 0.58, sy: 0.08, sz: 0.96 });
    shell.push({ x, y: CH / 2, z: -0.494, sx: 0.6, sy: CH, sz: 0.012 });
    rails.push({ x: x - 0.262, y: CH / 2 - 0.02, z: 0.47, sx: 0.022, sy: 1.95, sz: 0.022 });
    rails.push({ x: x + 0.262, y: CH / 2 - 0.02, z: 0.47, sx: 0.022, sy: 1.95, sz: 0.022 });
    strips.push({ x, y: 0.012, z: 0.53, sx: 0.5, sy: 0.012, sz: 0.012 });
    if (cab !== 0) doorsClosed.push({ x, y: 1.07, z: 0.515 });
  }
  hall.add(makeInstanced(box(1, 1, 1), matShell, shell));
  hall.add(makeInstanced(box(1, 1, 1), new THREE.MeshStandardMaterial({ color: 0x1a2128, metalness: 0.8, roughness: 0.4 }), rails));
  const stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.08, 0.6, 1.0).multiplyScalar(1.4) });
  hall.add(makeInstanced(box(1, 1, 1), stripMat, strips));

  // Perforated doors
  const perfTex = canvasTex(makePerfAlphaCanvas(), maxAniso, { linear: true, repeat: [18, 62] });
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0x1a2027, metalness: 0.75, roughness: 0.45, alphaMap: perfTex, alphaTest: 0.5, side: THREE.DoubleSide,
  });
  const doorGeo = new THREE.PlaneGeometry(0.58, 1.98);
  hall.add(makeInstanced(doorGeo, doorMat, doorsClosed));

  // Main cabinet door on a hinge
  const hinge = new THREE.Group();
  hinge.position.set(-0.3, 1.07, 0.515);
  const doorMesh = new THREE.Mesh(doorGeo, doorMat);
  doorMesh.position.x = 0.29;
  hinge.add(doorMesh);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x151b21, metalness: 0.8, roughness: 0.4 });
  [[0.29, 0.99, 0.6, 0.03], [0.29, -0.99, 0.6, 0.03]].forEach((f) => {
    const m = new THREE.Mesh(box(f[2], f[3], 0.025), frameMat);
    m.position.set(f[0], f[1], 0);
    hinge.add(m);
  });
  [0.005, 0.575].forEach((x) => {
    const m = new THREE.Mesh(box(0.03, 1.98, 0.025), frameMat);
    m.position.set(x, 0, 0);
    hinge.add(m);
  });
  const edgeGlow = new THREE.Mesh(box(0.006, 1.7, 0.006), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.4, 1.8) }));
  edgeGlow.position.set(0.545, 0, 0.016);
  hinge.add(edgeGlow);
  hall.add(hinge);

  // Patch cables on the hero cabinet (merged per color)
  (function buildCables() {
    const colors = [0x1ec8ff, 0xffb347, 0xcdd6e0, 0x7cf0c0];
    const groups = [[], [], [], []];
    const switchY = U_BASE + (40 + 0.5) * U;
    const ends = [];
    slots.forEach((s) => { if (s.cab === 0 && s.kind === 'server' && s.u0 < 21 && s.u0 > 3) ends.push(U_BASE + (s.u0 + s.h / 2) * U); });
    for (let i = 0; i < 16; i++) {
      const portX = -0.2413 + (70 + (2 + i) * 29 + 11) / PX_PER_M;
      const yEnd = ends[(i * 3 + 1) % ends.length];
      const xl = -0.249 - (i % 4) * 0.0045;
      const pts = [
        new THREE.Vector3(portX, switchY - 0.008, 0.478),
        new THREE.Vector3(portX - 0.01, switchY - 0.03, 0.492),
        new THREE.Vector3(lerp(portX, xl, 0.7), switchY - 0.075, 0.495),
        new THREE.Vector3(xl, switchY - 0.14, 0.494),
        new THREE.Vector3(xl, (switchY + yEnd) / 2, 0.494),
        new THREE.Vector3(xl, yEnd + 0.03, 0.494),
        new THREE.Vector3(-0.232, yEnd + 0.004, 0.482),
      ];
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      groups[i % 4].push(new THREE.TubeGeometry(curve, 48, 0.0026, 6, false));
    }
    groups.forEach((arr, i) => {
      if (!arr.length) return;
      const geo = mergeGeometries(arr, false);
      arr.forEach((a) => a.dispose());
      hall.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colors[i], roughness: 0.55, metalness: 0.1 })));
    });
  }());

  // Floor, ceiling, fixtures
  const floorTex = canvasTex(makeFloorCanvas(), maxAniso, { repeat: [40, 40] });
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(48, 48),
    new THREE.MeshStandardMaterial({ map: floorTex, metalness: 0.5, roughness: 0.35 }),
  );
  floor.rotation.x = -Math.PI / 2;
  hall.add(floor);
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(48, 48),
    new THREE.MeshStandardMaterial({ color: 0x070a0e, roughness: 0.9, metalness: 0.2 }),
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 3.3;
  hall.add(ceil);
  const fixtureMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.8, 1.0).multiplyScalar(2.2) });
  const fixtures = [];
  [-1.6, 0.0, 1.6].forEach((x) => [1.0, 2.6].forEach((z) => fixtures.push({ x, y: 3.28, z, sx: 1.2, sy: 0.03, sz: 0.08 })));
  hall.add(makeInstanced(box(1, 1, 1), fixtureMat, fixtures));
  const trays = [];
  for (let i = -3; i <= 3; i++) trays.push({ x: i * 1.2, y: 2.7, z: -0.1, sx: 0.02, sy: 0.02, sz: 1.2 });
  trays.push({ x: 0, y: 2.7, z: -0.1, sx: 8, sy: 0.04, sz: 0.4 });
  hall.add(makeInstanced(box(1, 1, 1), matShell, trays));

  // Light shafts
  const shaftGeo = new THREE.CylinderGeometry(0.06, 1.0, 3.2, 28, 1, true);
  const shaftMat = new THREE.ShaderMaterial({
    vertexShader: SHAFT_VERT,
    fragmentShader: SHAFT_FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(0.35, 0.65, 0.85) }, uAmt: { value: 0.07 }, uTime: { value: 0 } },
  });
  [[-1.6, 1.0], [0.0, 2.6], [1.6, 1.0]].forEach((p) => {
    const m = new THREE.Mesh(shaftGeo, shaftMat);
    m.position.set(p[0], 1.65, p[1]);
    m.renderOrder = 5;
    hall.add(m);
  });

  // Dust
  const dustN = quality.dust;
  const dustPos = new Float32Array(dustN * 3);
  const dustSeed = new Float32Array(dustN);
  for (let i = 0; i < dustN; i++) {
    dustPos[i * 3] = (rng() - 0.5) * 6;
    dustPos[i * 3 + 1] = rng() * 3;
    dustPos[i * 3 + 2] = (rng() - 0.2) * 5;
    dustSeed[i] = rng();
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dustSeed, 1));
  const dustMat = new THREE.ShaderMaterial({
    vertexShader: DUST_VERT,
    fragmentShader: DUST_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: 800 },
      uSize: { value: 0.006 },
      uBox: { value: new THREE.Vector3(6, 3, 5) },
      uCenter: { value: new THREE.Vector3(0, 1.5, 1.8) },
      uColor: { value: new THREE.Color(0.55, 0.8, 1.0) },
      uAlpha: { value: 0.6 },
    },
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  dust.renderOrder = 6;
  hall.add(dust);

  // =========================================================================
  // SERVER STAGE (chassis, board, CPU package, die)
  // =========================================================================
  const srv = new THREE.Group();
  srv.position.copy(SRV);
  scene.add(srv);

  const metalDark = new THREE.MeshStandardMaterial({ color: 0x1b2128, metalness: 0.85, roughness: 0.5 });
  const metalMid = new THREE.MeshStandardMaterial({ color: 0x2a323b, metalness: 0.85, roughness: 0.4 });
  const alu = new THREE.MeshStandardMaterial({ color: 0xaab4bf, metalness: 0.95, roughness: 0.32 });
  const copper = new THREE.MeshStandardMaterial({ color: 0xc27a4a, metalness: 1.0, roughness: 0.3 });
  const plastic = new THREE.MeshStandardMaterial({ color: 0x07090c, metalness: 0.1, roughness: 0.6 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe0a93f, metalness: 1.0, roughness: 0.28 });

  // Chassis
  const chFloor = new THREE.Mesh(box(0.46, 0.002, 0.72), metalDark);
  chFloor.position.set(0, 0.001, 0);
  srv.add(chFloor);
  [-0.229, 0.229].forEach((x) => {
    const w = new THREE.Mesh(box(0.004, 0.089, 0.72), metalMid);
    w.position.set(x, 0.0445, 0);
    srv.add(w);
  });
  const bezelTex = plateMaterial('server', 2);
  const bezel = new THREE.Mesh(box(PLATE_W, 0.0889, 0.02), bezelTex);
  bezel.position.set(0, 0.0445, 0.37);
  srv.add(bezel);
  const rear = new THREE.Mesh(box(0.46, 0.089, 0.004), metalMid);
  rear.position.set(0, 0.0445, -0.358);
  srv.add(rear);

  // Drive cage
  const cage = new THREE.Mesh(box(0.42, 0.07, 0.1), metalDark);
  cage.position.set(0, 0.037, 0.3);
  srv.add(cage);
  for (let i = 0; i <= 4; i++) {
    const sep = new THREE.Mesh(box(0.003, 0.072, 0.102), plastic);
    sep.position.set(-0.21 + i * 0.105, 0.037, 0.3);
    srv.add(sep);
  }

  // Fans
  const fanFrameShape = new THREE.Shape();
  fanFrameShape.moveTo(-0.03, -0.03);
  fanFrameShape.lineTo(0.03, -0.03);
  fanFrameShape.lineTo(0.03, 0.03);
  fanFrameShape.lineTo(-0.03, 0.03);
  fanFrameShape.lineTo(-0.03, -0.03);
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.0275, 0, Math.PI * 2, true);
  fanFrameShape.holes.push(hole);
  const fanFrameGeo = new THREE.ExtrudeGeometry(fanFrameShape, { depth: 0.038, bevelEnabled: false, curveSegments: 20 });
  const bladeParts = [];
  for (let i = 0; i < 7; i++) {
    const b = box(0.019, 0.011, 0.0015);
    b.rotateX(0.55);
    b.translate(0.0165, 0, 0);
    b.rotateZ((i * Math.PI * 2) / 7);
    bladeParts.push(b);
  }
  const hubGeo = new THREE.CylinderGeometry(0.0095, 0.0095, 0.016, 24);
  hubGeo.rotateX(Math.PI / 2);
  bladeParts.push(hubGeo);
  const rotorGeo = mergeGeometries(bladeParts, false);
  const rotorMat = new THREE.MeshStandardMaterial({ color: 0x20262d, metalness: 0.4, roughness: 0.45, emissive: 0x0a2a36, emissiveIntensity: 0.5 });
  const fans = [];
  for (let i = 0; i < 6; i++) {
    const x = (i - 2.5) * 0.0745;
    const f = new THREE.Mesh(fanFrameGeo, plastic);
    f.position.set(x, 0.034, 0.171);
    srv.add(f);
    const r = new THREE.Mesh(rotorGeo, rotorMat);
    r.position.set(x, 0.034, 0.19);
    r.userData.dir = i % 2 ? 1 : -1;
    srv.add(r);
    fans.push(r);
  }

  // Motherboard
  const pcbBase = new THREE.Mesh(box(0.41, 0.0016, 0.33), plastic);
  pcbBase.position.set(0, 0.0117, -0.005);
  srv.add(pcbBase);
  const pcbTex = canvasTex(makePcbCanvas(), maxAniso);
  const pcbTop = new THREE.Mesh(
    new THREE.PlaneGeometry(0.41, 0.33),
    new THREE.MeshStandardMaterial({ map: pcbTex, metalness: 0.3, roughness: 0.55, emissive: 0xffffff, emissiveMap: pcbTex, emissiveIntensity: 0.25 }),
  );
  pcbTop.rotation.x = -Math.PI / 2;
  pcbTop.position.set(0, 0.0126, -0.005);
  srv.add(pcbTop);

  // DIMMs (merged geometry with vertex colors, instanced)
  const dimmParts = [];
  function colored(geo, r, gcol, b) {
    const n = geo.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = r; arr[i * 3 + 1] = gcol; arr[i * 3 + 2] = b; }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo;
  }
  dimmParts.push(colored(box(0.0014, 0.031, 0.133), 0.03, 0.16, 0.16));
  for (let s = -1; s <= 1; s += 2) {
    for (let k = 0; k < 8; k++) {
      const chip = colored(box(0.0009, 0.011, 0.012), 0.015, 0.016, 0.02);
      chip.translate(s * 0.0011, 0.003, -0.056 + k * 0.016);
      dimmParts.push(chip);
    }
  }
  const edge = colored(box(0.0014, 0.003, 0.133), 0.85, 0.65, 0.25);
  edge.translate(0, -0.014, 0);
  dimmParts.push(edge);
  const dimmGeo = mergeGeometries(dimmParts, false);
  dimmParts.forEach((d) => d.dispose());
  const dimmMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.3, roughness: 0.5 });
  const dimmX = [-0.185, -0.172, -0.159, -0.146, -0.0195, -0.0065, 0.0065, 0.0195, 0.146, 0.159, 0.172, 0.185];
  const dimmList = dimmX.map((x) => ({ x, y: 0.0302, z: -0.06 }));
  const slotList = dimmX.map((x) => ({ x, y: 0.0157, z: -0.06 }));
  srv.add(makeInstanced(dimmGeo, dimmMat, dimmList));
  srv.add(makeInstanced(box(0.0065, 0.006, 0.139), plastic, slotList));

  // VRM inductors, capacitors, chipset
  const indList = [];
  const capList = [];
  [-0.08, 0.08].forEach((cx) => {
    for (let i = 0; i < 8; i++) {
      indList.push({ x: cx - 0.028 + i * 0.008, y: 0.0127 + 0.003, z: -0.127 });
      capList.push({ x: cx - 0.028 + i * 0.008, y: 0.0127 + 0.0045, z: -0.142 });
    }
  });
  srv.add(makeInstanced(box(0.0065, 0.006, 0.0065), metalMid, indList));
  srv.add(makeInstanced(new THREE.CylinderGeometry(0.0028, 0.0028, 0.009, 14), gold, capList));
  const pch = new THREE.Mesh(box(0.034, 0.008, 0.034), alu);
  pch.position.set(0, 0.0127 + 0.004, -0.15);
  srv.add(pch);

  // Power supplies
  [-0.115, 0.115].forEach((x) => {
    const psu = new THREE.Mesh(box(0.1, 0.08, 0.17), metalDark);
    psu.position.set(x, 0.041, -0.265);
    srv.add(psu);
  });

  // Sockets, packages, heatsinks
  const sockGeo = box(0.064, 0.0048, 0.074);
  const subGeo = box(0.056, 0.0016, 0.066);
  const subMat = new THREE.MeshStandardMaterial({ color: 0x0f2a2e, metalness: 0.35, roughness: 0.5 });

  // Heatsink geometry (shared by both CPUs)
  const finParts = [];
  const base = box(0.07, 0.004, 0.08);
  base.translate(0, 0.002, 0);
  finParts.push(base);
  for (let i = 0; i < 36; i++) {
    const fin = box(0.0009, 0.05, 0.074);
    fin.translate(-0.0315 + i * 0.0018, 0.004 + 0.025, 0);
    finParts.push(fin);
  }
  const hsGeo = mergeGeometries(finParts, false);
  finParts.forEach((f) => f.dispose());
  const pipeParts = [-0.02, 0, 0.02].map((z) => {
    const p = new THREE.CylinderGeometry(0.003, 0.003, 0.082, 12);
    p.rotateZ(Math.PI / 2);
    p.translate(0, 0.0075, z);
    return p;
  });
  const pipeGeo = mergeGeometries(pipeParts, false);
  pipeParts.forEach((p) => p.dispose());

  function makeHeatsink() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(hsGeo, alu));
    g.add(new THREE.Mesh(pipeGeo, copper));
    return g;
  }

  [CPU1.x, 0.08].forEach((cx) => {
    const sock = new THREE.Mesh(sockGeo, plastic);
    sock.position.set(cx, 0.0127 + 0.0024, CPU1.z);
    srv.add(sock);
    const sub = new THREE.Mesh(subGeo, subMat);
    sub.position.set(cx, 0.0187, CPU1.z);
    srv.add(sub);
  });
  const hs2 = makeHeatsink();
  hs2.position.set(0.08, 0.025, CPU1.z);
  srv.add(hs2);
  const hs1 = makeHeatsink();
  const hs1Base = new THREE.Vector3(CPU1.x, 0.025, CPU1.z);
  hs1.position.copy(hs1Base);
  srv.add(hs1);

  // CPU1 package details: gold pads, die, IHS
  const padList = [];
  for (let ix = -13; ix <= 13; ix++) {
    for (let iz = -16; iz <= 16; iz++) {
      const px = ix * 0.002;
      const pz = iz * 0.002;
      if (Math.abs(px) < 0.0225 && Math.abs(pz) < 0.0255) continue;
      padList.push({ x: CPU1.x + px, y: 0.0195 + 0.00004, z: CPU1.z + pz });
    }
  }
  srv.add(makeInstanced(box(0.0011, 0.00008, 0.0011), gold, padList));
  const smd = [];
  for (let i = 0; i < 10; i++) {
    smd.push({ x: CPU1.x - 0.0225 + (i % 5) * 0.0105 + 0.002, y: 0.0197, z: CPU1.z + (i < 5 ? -0.0295 : 0.0295) });
  }
  srv.add(makeInstanced(box(0.0035, 0.0009, 0.0018), plastic, smd));

  const dieBody = new THREE.Mesh(box(0.02, 0.0008, 0.026), new THREE.MeshStandardMaterial({ color: 0x0a0e14, metalness: 0.6, roughness: 0.4 }));
  dieBody.position.set(CPU1.x, 0.0195 + 0.0004, CPU1.z);
  srv.add(dieBody);

  const dieMat = new THREE.ShaderMaterial({
    vertexShader: DIE_VERT,
    fragmentShader: DIE_FRAG,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uZoom: { value: 1 },
      uTilt: { value: 0 },
      uGlow: { value: 0 },
      uDim: { value: 1 },
    },
  });
  const dieGeo = new THREE.PlaneGeometry(0.02, 0.026);
  dieGeo.rotateX(-Math.PI / 2);
  const die = new THREE.Mesh(dieGeo, dieMat);
  die.position.set(CPU1.x, DIE_Y + 0.00002, CPU1.z);
  srv.add(die);

  // Dark curtain just below the die plane: hides the package and board around the die
  // so no rectangle edge or side band is ever visible when the die does not fill the view.
  const curtain = new THREE.Mesh(
    new THREE.PlaneGeometry(0.6, 0.6),
    new THREE.MeshBasicMaterial({ color: 0x03050a, transparent: true, opacity: 0, depthWrite: false, fog: false }),
  );
  curtain.rotation.x = -Math.PI / 2;
  curtain.position.set(CPU1.x, DIE_Y - 0.00004, CPU1.z);
  curtain.visible = false;
  srv.add(curtain);

  // IHS (lifts away and fades)
  const ihsGroup = new THREE.Group();
  ihsGroup.position.set(CPU1.x, 0, CPU1.z);
  const ihsTex = canvasTex(makeIhsCanvas(), maxAniso);
  const ihsSideMat = new THREE.MeshStandardMaterial({ color: 0xa6aeb7, metalness: 0.95, roughness: 0.3, transparent: true });
  const ihsTopMat = new THREE.MeshStandardMaterial({ map: ihsTex, metalness: 0.9, roughness: 0.32, transparent: true });
  const ihsBox = new THREE.Mesh(box(0.042, 0.0035, 0.048), ihsSideMat);
  ihsBox.position.y = 0.0212 + 0.00175;
  const ihsTop = new THREE.Mesh(new THREE.PlaneGeometry(0.042, 0.048), ihsTopMat);
  ihsTop.rotation.x = -Math.PI / 2;
  ihsTop.position.y = 0.0212 + 0.0035 + 0.00008;
  ihsGroup.add(ihsBox, ihsTop);
  srv.add(ihsGroup);

  // Lid
  const lid = new THREE.Group();
  const lidBody = new THREE.Mesh(box(0.464, 0.002, 0.724), metalDark);
  const lidTex = canvasTex(makeLidCanvas(), maxAniso);
  const lidTop = new THREE.Mesh(
    new THREE.PlaneGeometry(0.46, 0.72),
    new THREE.MeshStandardMaterial({ map: lidTex, metalness: 0.7, roughness: 0.45 }),
  );
  lidTop.rotation.x = -Math.PI / 2;
  lidTop.position.y = 0.0011;
  lid.add(lidBody, lidTop);
  lid.position.set(0, 0.0905, 0);
  srv.add(lid);

  // Server stage LEDs
  const ledsSrv = [];
  for (let i = 0; i < 4; i++) {
    ledsSrv.push({ x: -0.21 + (i + 0.5) * 0.105, y: 0.0735, z: 0.351, c: CYAN, ph: rng(), rate: 8 + rng() * 5, s: 1.2 });
  }
  dimmX.forEach((x, i) => {
    ledsSrv.push({ x, y: 0.0462, z: -0.12, c: i % 3 ? CYAN : AMBER, ph: rng(), rate: 1 + rng() * 3, s: 0.6 });
  });
  [-0.115, 0.115].forEach((x) => {
    ledsSrv.push({ x, y: 0.07, z: -0.18, c: AMBER, ph: 0, rate: 0, s: 1.4 });
    ledsSrv.push({ x: x + 0.012, y: 0.07, z: -0.18, c: GREEN, ph: 0, rate: 0, s: 1.4 });
  });
  srv.add(ledSet(ledsSrv));
  srv.visible = false;

  // =========================================================================
  // Camera paths
  // =========================================================================
  function makePath(keys) {
    const pos = new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k.pos)), false, 'centripetal');
    const look = new THREE.CatmullRomCurve3(keys.map((k) => new THREE.Vector3(...k.look)), false, 'centripetal');
    return {
      at(p, outPos, outLook) {
        let i = 0;
        while (i < keys.length - 2 && p > keys[i + 1].p) i++;
        const f = clamp((p - keys[i].p) / (keys[i + 1].p - keys[i].p), 0, 1);
        const t = (i + f) / (keys.length - 1);
        pos.getPoint(t, outPos);
        look.getPoint(t, outLook);
      },
    };
  }

  const hallPath = makePath([
    { p: 0.0, pos: [0.0, 1.15, 3.3], look: [0.0, 1.0, 0.0] },
    { p: 0.05, pos: [0.3, 1.2, 3.0], look: [0.0, 1.02, 0.2] },
    { p: 0.12, pos: [0.25, 1.18, 2.1], look: [0.0, 1.1, 0.3] },
    { p: 0.17, pos: [0.05, 1.13, 1.1], look: [0.0, 1.11, 0.4] },
    { p: 0.2, pos: [0.0, HERO_Y, 0.62], look: [0.0, HERO_Y, 0.3] },
  ]);
  const s3 = (x, y, z) => [SRV.x + x, SRV.y + y, SRV.z + z];
  const srvPath = makePath([
    { p: 0.2, pos: s3(0.0, 0.36, 0.62), look: s3(0.0, 0.05, 0.05) },
    { p: 0.29, pos: s3(0.02, 0.3, 0.42), look: s3(0.0, 0.01, -0.02) },
    { p: 0.34, pos: s3(0.14, 0.17, 0.22), look: s3(0.04, 0.02, -0.06) },
    { p: 0.4, pos: s3(-0.02, 0.24, 0.1), look: s3(-0.08, 0.03, -0.06) },
    { p: 0.48, pos: s3(-0.08, 0.2, -0.02), look: s3(-0.08, 0.02, -0.06) },
    { p: 0.56, pos: s3(-0.08, 0.085, -0.02), look: s3(-0.08, 0.02, -0.06) },
    { p: 0.6, pos: s3(-0.08, 0.061, -0.059), look: s3(-0.08, DIE_Y, -0.06) },
    { p: 0.66, pos: s3(-0.08, 0.0338, -0.06), look: s3(-0.08, DIE_Y, -0.06) },
  ]);

  // =========================================================================
  // Post processing
  // =========================================================================
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.45, 0.55, 0.9);
  bloom.enabled = quality.bloom;
  composer.addPass(bloom);
  const post = new ShaderPass(new THREE.ShaderMaterial({
    vertexShader: POST_VERT,
    fragmentShader: POST_FRAG,
    uniforms: {
      tDiffuse: { value: null },
      uCA: { value: 0.002 },
      uVig: { value: 0.5 },
      uFade: { value: 0 },
      uFlash: { value: 0 },
      uTime: { value: 0 },
      uGrain: { value: 0.025 },
    },
  }));
  composer.addPass(post);
  composer.addPass(new OutputPass());

  let viewShift = 0;
  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    renderer.setPixelRatio(pr);
    renderer.setSize(width, height, false);
    composer.setPixelRatio(pr);
    composer.setSize(width, height);
    camera.aspect = width / height;
    viewShift = -1;
    camera.updateProjectionMatrix();
    dustMat.uniforms.uScale.value = (height * pr) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  }
  resize();

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    if (onLost) onLost();
  });

  // Adaptive quality: lower pixel ratio, then drop bloom, if frames stay slow.
  let ema = 16.7;
  let slow = 0;
  let lastTime = null;
  function adapt(time) {
    if (lastTime === null) { lastTime = time; return; }
    const dtMs = (time - lastTime) * 1000;
    lastTime = time;
    if (dtMs <= 0 || dtMs > 100) return;
    ema = ema * 0.95 + dtMs * 0.05;
    slow = ema > 30 ? slow + 1 : Math.max(0, slow - 1);
    if (slow > 120) {
      slow = 0;
      ema = 16.7;
      if (pr > 0.65) {
        pr = Math.max(0.6, pr * 0.8);
        resize();
      } else if (bloom.enabled) {
        bloom.enabled = false;
      }
    }
  }

  // Redraw wordmark textures once fonts are available
  if (document.fonts && document.fonts.load) {
    document.fonts.load('700 40px "Space Grotesk"').then(() => {
      ihsTopMat.map.image = makeIhsCanvas();
      ihsTopMat.map.needsUpdate = true;
      lidTop.material.map.image = makeLidCanvas();
      lidTop.material.map.needsUpdate = true;
    }).catch(() => {});
  }

  const mouse = new THREE.Vector2();
  const camPos = new THREE.Vector3();
  const camLook = new THREE.Vector3();
  const upA = new THREE.Vector3(0, 1, 0);
  const upB = new THREE.Vector3(0, 0, -1);

  function dieZoomLn(p) {
    if (p < 0.64) return 0;
    if (p < 0.84) {
      const t = (p - 0.64) / 0.2;
      return LN_ZMAX * lerp(t, t * t * (3 - 2 * t), 0.35);
    }
    if (p < 0.9) return LN_ZMAX;
    return lerp(LN_ZMAX, Math.log(1.25), smooth(0.9, 1.0, p));
  }

  /**
   * Render one frame.
   * @param {number} time seconds (0 for static mode)
   * @param {number} p scene progress 0..1
   * @param {{x:number,y:number}} mouseTarget normalized -1..1
   * @param {boolean} animated enables adaptive quality tracking
   */
  function frame(time, p, mouseTarget, animated = true) {
    if (animated) adapt(time);
    mouse.x += (mouseTarget.x - mouse.x) * 0.06;
    mouse.y += (mouseTarget.y - mouse.y) * 0.06;

    const inHall = p < 0.2;
    hall.visible = inHall;
    srv.visible = !inHall;

    // Fade to black around the cut between the cabinet and the server stage
    const dip = Math.abs(p - 0.2);
    post.uniforms.uFade.value = 1 - smooth(0.006, 0.022, dip);
    post.uniforms.uFlash.value = 0.25 * Math.exp(-Math.pow((p - 0.2) / 0.02, 2)) * (1 - post.uniforms.uFade.value);
    post.uniforms.uTime.value = time;
    post.uniforms.uCA.value = 0.0015 + 0.01 * smooth(0.17, 0.2, p) * inHall + 0.006 * smooth(0.6, 0.84, p) * (1 - smooth(0.9, 1.0, p));
    post.uniforms.uVig.value = lerp(0.5, 0.65, smooth(0.6, 0.85, p));
    // bloom is reduced from the CPU stage on so the die detail stays readable
    bloom.strength = lerp(0.4, 0.14, smooth(0.42, 0.58, p));
    bloom.threshold = lerp(0.9, 1.3, smooth(0.42, 0.58, p));
    renderer.toneMappingExposure = lerp(1.15, 0.85 * lowK, smooth(0.45, 0.62, p));

    ledMat.uniforms.uTime.value = time;
    shaftMat.uniforms.uTime.value = time;
    dustMat.uniforms.uTime.value = time;

    let near = 0.05;
    if (inHall) {
      hallPath.at(p, camPos, camLook);
      // portrait screens: pull back and lower the rack in frame so it clears the header
      if (width / height < 1) {
        const k = 1 - smooth(0.04, 0.15, p);
        camPos.z += 1.7 * k;
        camPos.y += 0.3 * k;
        camLook.y += 0.3 * k;
      }
      camera.up.set(0, 1, 0);
      scene.fog.density = 0.07;
      scene.environmentIntensity = 0.3;
      hemi.intensity = 1.2;
      dirL.position.set(1.2, 2.2, 4);
      dirL.intensity = 1.4;
      cyanL.position.set(0.7, 1.5, 1.9);
      cyanL.intensity = 12;
      amberL.position.set(-1.2, 0.7, 1.6);
      amberL.intensity = 5;
      // door swing: hinge on the left, opens toward the viewer
      hinge.rotation.y = -1.85 * smooth(0.035, 0.125, p);
      edgeGlow.visible = true;
    } else {
      srvPath.at(Math.min(p, 0.66), camPos, camLook);
      near = p < 0.5 ? 0.004 : 0.0006;
      scene.fog.density = 0.0;
      scene.environmentIntensity = lerp(0.55, 0.3 * lowK, smooth(0.45, 0.58, p));
      hemi.intensity = lerp(0.9, 0.6, smooth(0.45, 0.58, p));
      dirL.intensity = lerp(1.1, 0.6, smooth(0.45, 0.58, p));
      dirL.position.set(SRV.x + 0.5, SRV.y + 2, SRV.z + 1);
      cyanL.position.set(SRV.x + 0.0, SRV.y + 0.3, SRV.z + 0.12);
      cyanL.intensity = 0.07;
      amberL.position.set(SRV.x - 0.15, SRV.y + 0.12, SRV.z - 0.2);
      amberL.intensity = 0.03;

      // lid slides off toward the back
      const lidT = smooth(0.22, 0.30, p);
      lid.position.z = -0.9 * lidT;
      lid.position.y = 0.0905 + 0.03 * lidT;
      lid.visible = p < 0.31;
      // heatsink lifts up and away
      const up1 = smooth(0.40, 0.445, p);
      const side1 = smooth(0.43, 0.48, p);
      hs1.position.set(hs1Base.x + 0.24 * side1, hs1Base.y + 0.16 * up1, hs1Base.z + 0.04 * side1);
      hs1.rotation.z = -0.6 * side1;
      hs1.visible = p < 0.5;
      // IHS lifts away and fades
      const ihsT = smooth(0.575, 0.625, p);
      ihsGroup.position.y = 0.05 * ihsT;
      ihsSideMat.opacity = 1 - smooth(0.585, 0.63, p);
      ihsTopMat.opacity = ihsSideMat.opacity;
      ihsGroup.visible = p < 0.64;
      // fans
      for (let i = 0; i < fans.length; i++) fans[i].rotation.z = time * 14 * fans[i].userData.dir;
    }

    // Die shader uniforms
    const du = dieMat.uniforms;
    du.uTime.value = time;
    du.uZoom.value = Math.exp(dieZoomLn(p));
    du.uTilt.value = mouse.x * 0.2 + p * 1.2 + time * 0.02;
    du.uGlow.value = smooth(0.78, 0.84, p) * (1 - 0.5 * smooth(0.9, 1.0, p));
    // final CTA stage: the die fades to a calm, near-black background
    du.uDim.value = lowK * (1 - 0.9 * smooth(0.9, 1.0, p));
    curtain.material.opacity = smooth(0.6, 0.7, p);
    curtain.visible = !inHall && curtain.material.opacity > 0.001;

    // Camera
    if (camera.near !== near) { camera.near = near; camera.updateProjectionMatrix(); }
    const upBlend = smooth(0.5, 0.575, p);
    if (!inHall) camera.up.copy(upA).lerp(upB, upBlend).normalize();
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    const mk = inHall ? 0.02 : 0.012;
    camera.rotateX(mouse.y * mk);
    camera.rotateY(-mouse.x * mk);

    // Off-center composition for the hero on wide screens
    const aspect = width / height;
    const shift = (inHall && aspect > 1.15) ? 0.17 * (1 - smooth(0.0, 0.1, p)) : 0;
    if (Math.abs(shift - viewShift) > 1e-4) {
      viewShift = shift;
      if (shift === 0) camera.clearViewOffset();
      else camera.setViewOffset(width, height, -shift * width, 0, width, height);
    }

    composer.render();
  }

  return { frame, resize };
}
