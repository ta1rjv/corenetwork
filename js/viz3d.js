// Shared 3D visualizations (Three.js): network topology (full and mini) and the
// power and cooling cutaway. Renderers are created lazily when a container becomes
// visible and fully disposed when it leaves the viewport, so at most two WebGL
// contexts exist at once. Falls back to the existing SVG/HTML diagram on failure.

import * as THREE from 'three';
import { LED_VERT, LED_FRAG } from './shaders.js';

const MAX_CONTEXTS = 2;
const active = [];

const COL = {
  cyan: new THREE.Color(0x19e0ff),
  amber: new THREE.Color(0xffb340),
  violet: new THREE.Color(0x8a5cff),
  blue: new THREE.Color(0x4aa8ff),
  orange: new THREE.Color(0xff8a3a),
  steel: new THREE.Color(0x8fa0b0),
};
const LED_CYAN = [0.1, 0.8, 1.0];
const LED_AMBER = [1.0, 0.55, 0.1];
const LED_GREEN = [0.2, 1.0, 0.5];

function mulberry32(a) {
  return function rnd() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch (_) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------
const darkMat = () => new THREE.MeshStandardMaterial({ color: 0x2a3642, metalness: 0.5, roughness: 0.5, emissive: 0x0a141c });

function glowTube(group, curve, radius, color, opacity, segs, closed) {
  const core = new THREE.Mesh(
    new THREE.TubeGeometry(curve, segs, radius, 8, !!closed),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 * opacity, toneMapped: false }),
  );
  const halo = new THREE.Mesh(
    new THREE.TubeGeometry(curve, segs, radius * 3.4, 8, !!closed),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.15 * opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  );
  group.add(core, halo);
}

function edgeBox(w, h, d, color, opacity) {
  const e = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(w, h, d)),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: Math.min(1, opacity * 1.4) }),
  );
  return e;
}

function gridGround(size) {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uColor: { value: new THREE.Color(0x3aa8d0) }, uFade: { value: size * 0.5 } },
    vertexShader: 'varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uColor; uniform float uFade; varying vec2 vP;'
      + 'void main() {'
      + '  vec2 gr = abs(fract(vP - 0.5) - 0.5) / max(fwidth(vP), vec2(1e-4));'
      + '  float line = 1.0 - min(min(gr.x, gr.y), 1.0);'
      + '  float fade = 1.0 - smoothstep(uFade * 0.25, uFade, length(vP));'
      + '  float pool = (1.0 - smoothstep(0.0, uFade * 0.7, length(vP))) * 0.07;'
      + '  gl_FragColor = vec4(uColor, max(line * 0.24 * fade, pool));'
      + '}',
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.y = -0.01;
  m.renderOrder = -1;
  return m;
}

function ledSet(entries, ledMat) {
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const n = entries.length;
  const mesh = new THREE.InstancedMesh(geo, ledMat, Math.max(1, n));
  mesh.count = n;
  const col = new Float32Array(n * 3);
  const ph = new Float32Array(n);
  const rate = new Float32Array(n);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  entries.forEach((e, i) => {
    m.compose(new THREE.Vector3(e.x, e.y, e.z), q, new THREE.Vector3(e.sx, e.sy, e.sz));
    mesh.setMatrixAt(i, m);
    col.set(e.c, i * 3);
    ph[i] = e.ph;
    rate[i] = e.rate;
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  geo.setAttribute('aColor', new THREE.InstancedBufferAttribute(col, 3));
  geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(ph, 1));
  geo.setAttribute('aRate', new THREE.InstancedBufferAttribute(rate, 1));
  return mesh;
}

class CircleCurve extends THREE.Curve {
  constructor(cx, cy, cz, r) {
    super();
    this.c = new THREE.Vector3(cx, cy, cz);
    this.r = r;
  }

  getPoint(t, target = new THREE.Vector3()) {
    const a = t * Math.PI * 2;
    return target.set(this.c.x + this.r * Math.cos(a), this.c.y, this.c.z + this.r * Math.sin(a));
  }
}

function bezier(a, b, lift) {
  const dx = (b.x - a.x) * 0.5;
  return new THREE.CubicBezierCurve3(
    a.clone(), a.clone().add(new THREE.Vector3(dx, lift || 0, 0)),
    b.clone().sub(new THREE.Vector3(dx, -(lift || 0), 0)), b.clone(),
  );
}

function lattice(H, base, top, levels, color) {
  const pos = [];
  const at = (h, i) => {
    const s = base + (top - base) * (h / H);
    const sx = i === 0 || i === 3 ? -s : s;
    const sz = i < 2 ? -s : s;
    return [sx, h, sz];
  };
  const seg = (a, b) => { pos.push(a[0], a[1], a[2], b[0], b[1], b[2]); };
  for (let k = 0; k <= levels; k++) {
    const h = (k / levels) * H;
    for (let i = 0; i < 4; i++) seg(at(h, i), at(h, (i + 1) % 4));
    if (k < levels) {
      const h2 = ((k + 1) / levels) * H;
      for (let i = 0; i < 4; i++) {
        seg(at(h, i), at(h2, i));
        seg(at(h, i), at(h2, (i + 1) % 4));
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 }));
}

// Moving emissive dots along curves
function makePackets(flows, size) {
  const total = flows.reduce((s, f) => s + f.n, 0);
  const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(size, 8, 8), new THREE.MeshBasicMaterial({ toneMapped: false }), Math.max(1, total));
  mesh.count = total;
  mesh.frustumCulled = false;
  const items = [];
  flows.forEach((f) => {
    const len = f.curve.getLength();
    for (let i = 0; i < f.n; i++) {
      items.push({ f, len, t: i / f.n, k: items.length });
      mesh.setColorAt(items.length - 1, f.color);
    }
  });
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  const m = new THREE.Matrix4();
  const p = new THREE.Vector3();
  function update(dt) {
    items.forEach((it) => {
      it.t += (it.f.speed * dt) / it.len;
      const t = ((it.t % 1) + 1) % 1;
      it.f.curve.getPointAt(it.f.dir < 0 ? 1 - t : t, p);
      m.setPosition(p);
      mesh.setMatrixAt(it.k, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }
  update(0);
  return { mesh, update };
}

// ---------------------------------------------------------------------------
// HTML labels projected from 3D positions
// ---------------------------------------------------------------------------
class Labels {
  constructor(layer, mini) {
    this.layer = layer;
    this.mini = mini;
    this.items = [];
  }

  add(pos, text, sub, prio) {
    const el = document.createElement('div');
    el.className = 'viz-label' + (this.mini ? ' is-mini' : '');
    const b = document.createElement('span');
    b.textContent = text;
    el.appendChild(b);
    if (sub) {
      const s = document.createElement('small');
      s.textContent = sub;
      el.appendChild(s);
    }
    this.layer.appendChild(el);
    this.items.push({ el, pos, prio: prio || 0, w: 0, h: 0 });
    this.items.sort((a, c) => a.prio - c.prio);
  }

  measure() {
    this.items.forEach((it) => { it.w = it.el.offsetWidth; it.h = it.el.offsetHeight; });
  }

  update(camera, w, h) {
    const placed = [];
    const v = new THREE.Vector3();
    const hit = (r) => placed.some((o) => r.x < o.x + o.w && r.x + r.w > o.x && r.y < o.y + o.h && r.y + r.h > o.y);
    this.items.forEach((it) => {
      if (!it.w) { it.w = it.el.offsetWidth; it.h = it.el.offsetHeight; }
      v.copy(it.pos).project(camera);
      const sx = (v.x * 0.5 + 0.5) * w;
      const sy = (-v.y * 0.5 + 0.5) * h;
      let chosen = null;
      let cy = sy;
      if (v.z < 1) {
        // try the default anchor, then nudge down and up before hiding the label
        const offs = [0, it.h + 8, -(it.h + 8) * 1.4];
        for (let i = 0; i < offs.length && !chosen; i++) {
          const r = { x: sx - it.w / 2 - 3, y: sy + offs[i] - 3, w: it.w + 6, h: it.h + 6 };
          if (r.x >= 0 && r.y >= 0 && r.x + r.w <= w && r.y + r.h <= h && !hit(r)) { chosen = r; cy = sy + offs[i]; }
        }
      }
      if (chosen) placed.push(chosen);
      it.el.style.visibility = chosen ? 'visible' : 'hidden';
      it.el.style.transform = 'translate(' + sx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px) translate(-50%,0)';
    });
  }
}

// ---------------------------------------------------------------------------
// Scene: network topology
// ---------------------------------------------------------------------------
function buildNetwork(ctx) {
  const { scene, ledMat, mini, labels } = ctx;
  const rnd = mulberry32(11);
  const root = new THREE.Group();
  scene.add(root);
  const upd = [];
  const flows = [];
  const Y = 0.12;
  const L = mini
    ? { ax: -6.4, az: 3.6, rx: -3.0, dx: 0.4, cx: 5.6, tx: 9.0, tz: 4.2, bx: 10.7, bz: 2.0 }
    : { ax: -9.4, az: 3.1, rx: -5.6, dx: -1.2, cx: 3.8, tx: 8.4, tz: 3.3, bx: 11.3, bz: 1.6 };
  const nm = (full, short) => (mini ? short : full);

  // Globes (upstream providers)
  function globe(x, z, name) {
    const g = new THREE.Group();
    g.position.set(x, 1.5, z);
    const wire = new THREE.Mesh(new THREE.SphereGeometry(0.85, 18, 12), new THREE.MeshBasicMaterial({ color: COL.cyan, wireframe: true, transparent: true, opacity: 0.55, toneMapped: false }));
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 12), new THREE.MeshBasicMaterial({ color: COL.cyan, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false }));
    g.add(wire, halo);
    root.add(g);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 0.86, 40), new THREE.MeshBasicMaterial({ color: COL.cyan, transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.02, z);
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 6), new THREE.MeshBasicMaterial({ color: COL.cyan, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.position.set(x, 0.7, z);
    root.add(ring, beam);
    upd.push((t) => { wire.rotation.y = t * 0.25; g.position.y = 1.5 + Math.sin(t * 0.8 + x) * 0.08; });
    labels.add(new THREE.Vector3(x, 0, z + 1.1), name, null, 3);
  }
  globe(L.ax, -L.az, nm('Üst Sağlayıcı A', 'Sağlayıcı A'));
  globe(L.ax, L.az, nm('Üst Sağlayıcı B', 'Sağlayıcı B'));

  // Core router: 1U chassis with port LEDs
  const RX = L.rx;
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 1.5), darkMat());
  plinth.position.set(RX, 0.05, 0);
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.4, 1.15), darkMat());
  chassis.position.set(RX, 0.3, 0);
  root.add(plinth, chassis);
  const rEdge = edgeBox(2.6, 0.4, 1.15, COL.cyan, 0.6);
  rEdge.position.copy(chassis.position);
  root.add(rEdge);
  const rLeds = [];
  for (let i = 0; i < 14; i++) {
    rLeds.push({ x: RX - 1.1 + i * 0.17, y: 0.32, z: 0.585, sx: 0.1, sy: 0.07, sz: 0.03, c: rnd() < 0.15 ? LED_AMBER : LED_CYAN, ph: rnd(), rate: rnd() < 0.4 ? 0 : 1.5 + rnd() * 5 });
  }
  root.add(ledSet(rLeds, ledMat));
  labels.add(new THREE.Vector3(RX, 0, 1.05), nm('Çekirdek Yönlendirici', 'Çekirdek'), null, 1);

  // Data center: a row of racks
  const DX = L.dx;
  const racks = mini ? 3 : 4;
  const dLeds = [];
  for (let i = 0; i < racks; i++) {
    const x = DX + (i - (racks - 1) / 2) * 0.95;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.0, 0.9), darkMat());
    body.position.set(x, 1.0, 0);
    root.add(body);
    const e = edgeBox(0.8, 2.0, 0.9, COL.cyan, 0.4);
    e.position.copy(body.position);
    root.add(e);
    const rows = mini ? 7 : 11;
    for (let r = 0; r < rows; r++) {
      const y = 0.25 + r * (1.6 / rows);
      dLeds.push({ x: x - 0.18, y, z: 0.455, sx: 0.07, sy: 0.04, sz: 0.02, c: LED_CYAN, ph: rnd(), rate: rnd() < 0.5 ? 0 : 3 + rnd() * 9 });
      dLeds.push({ x: x + 0.18, y, z: 0.455, sx: 0.07, sy: 0.04, sz: 0.02, c: rnd() < 0.25 ? LED_AMBER : LED_GREEN, ph: rnd(), rate: rnd() < 0.5 ? 0 : 3 + rnd() * 9 });
    }
  }
  root.add(ledSet(dLeds, ledMat));
  labels.add(new THREE.Vector3(DX, 0, 0.9), 'Veri Merkezi', null, 0);

  // Fiber ring (true circle) with access pylons
  const RC = new THREE.Vector3(L.cx, Y, 0);
  const RR = 2.4;
  const ringCurve = new CircleCurve(RC.x, Y, RC.z, RR);
  glowTube(root, ringCurve, 0.07, COL.cyan, 1, 160, true);
  const pylons = mini ? 4 : 6;
  const pylonAngles = [];
  for (let i = 0; i < pylons; i++) pylonAngles.push(Math.PI + (i * Math.PI * 2) / pylons);
  const pylonPos = pylonAngles.map((a) => new THREE.Vector3(RC.x + RR * Math.cos(a), 0, RC.z + RR * Math.sin(a)));
  pylonPos.forEach((p) => {
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.55, 10), darkMat());
    cyl.position.set(p.x, 0.275, p.z);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), new THREE.MeshBasicMaterial({ color: COL.cyan, toneMapped: false }));
    cap.position.set(p.x, 0.62, p.z);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), new THREE.MeshBasicMaterial({ color: COL.cyan, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.position.copy(cap.position);
    root.add(cyl, cap, halo);
  });
  labels.add(new THREE.Vector3(RC.x, 0, RR + 0.55), 'Fiber Halka', null, 2);

  // Links
  const A = new THREE.Vector3(L.ax, Y, -L.az);
  const B = new THREE.Vector3(L.ax, Y, L.az);
  const rL = new THREE.Vector3(RX - 1.35, Y, 0);
  const lA = bezier(A, rL, 0);
  const lB = bezier(B, rL, 0);
  glowTube(root, lA, 0.05, COL.cyan, 1, 48);
  glowTube(root, lB, 0.05, COL.cyan, 0.4, 48);
  const rR = new THREE.Vector3(RX + 1.35, Y, 0);
  const dL = new THREE.Vector3(DX - racks * 0.475 - 0.05, Y, 0);
  const lRD = new THREE.LineCurve3(rR, dL);
  glowTube(root, lRD, 0.06, COL.cyan, 1, 8);
  const dR = new THREE.Vector3(DX + racks * 0.475 + 0.05, Y, 0);
  const lDR = new THREE.LineCurve3(dR, new THREE.Vector3(RC.x - RR, Y, 0));
  glowTube(root, lDR, 0.06, COL.cyan, 1, 8);

  // Radiolink towers
  const towers = [];
  [-1, 1].forEach((s) => {
    const tp = new THREE.Vector3(L.tx, 0, s * L.tz);
    const tower = lattice(4.0, 0.6, 0.12, mini ? 4 : 6, COL.steel);
    tower.position.copy(tp);
    root.add(tower);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), new THREE.MeshBasicMaterial({ color: COL.amber, toneMapped: false }));
    beacon.position.set(tp.x, 4.05, tp.z);
    const bh = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), new THREE.MeshBasicMaterial({ color: COL.amber, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }));
    bh.position.copy(beacon.position);
    root.add(beacon, bh);
    // remote building
    const bp = new THREE.Vector3(L.bx, 0.35, s * L.bz);
    const blk = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 1.0), darkMat());
    blk.position.copy(bp);
    const be = edgeBox(1.0, 0.7, 1.0, COL.amber, 0.7);
    be.position.copy(bp);
    root.add(blk, be);
    // fiber from the ring to the tower base
    const pylon = pylonPos.reduce((best, p) => (p.distanceTo(tp) < best.distanceTo(tp) ? p : best), pylonPos[0]);
    const link = bezier(new THREE.Vector3(pylon.x, Y, pylon.z), new THREE.Vector3(tp.x, Y, tp.z), 0);
    glowTube(root, link, 0.05, COL.cyan, 0.9, 32);
    flows.push({ curve: link, n: 1, speed: 1.5, color: COL.cyan, dir: s });
    // expanding wave rings from the tower top toward the building
    const from = new THREE.Vector3(tp.x, 4.0, tp.z);
    const to = new THREE.Vector3(bp.x, 0.8, bp.z);
    const dir = to.clone().sub(from).normalize();
    const rings = [];
    const count = mini ? 2 : 3;
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 32), new THREE.MeshBasicMaterial({ color: COL.amber, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      root.add(m);
      rings.push(m);
    }
    upd.push((t) => {
      rings.forEach((m, i) => {
        const k = (t * 0.35 + i / rings.length) % 1;
        m.position.lerpVectors(from, to, k);
        m.scale.setScalar(0.5 + k * 1.5);
        m.material.opacity = (1 - k) * 0.8;
      });
      beacon.material.opacity = 1;
    });
    towers.push(tp);
    labels.add(new THREE.Vector3(tp.x, 0, tp.z + 0.9), nm('Radyolink Kulesi', 'Radyolink'), null, 4);
  });

  // Packets
  flows.push({ curve: lA, n: mini ? 2 : 3, speed: 1.7, color: COL.cyan, dir: 1 });
  flows.push({ curve: lB, n: 2, speed: 1.4, color: COL.blue, dir: 1 });
  flows.push({ curve: lRD, n: 3, speed: 1.6, color: COL.cyan, dir: 1 });
  flows.push({ curve: lDR, n: 2, speed: 1.4, color: COL.cyan, dir: 1 });
  flows.push({ curve: ringCurve, n: mini ? 3 : 5, speed: 1.6, color: COL.cyan, dir: 1 });
  const packets = makePackets(flows, mini ? 0.13 : 0.11);
  root.add(packets.mesh);
  upd.push((t, dt) => packets.update(dt));

  // Bounds used to fit the camera (front margin leaves room for labels)
  const box = mini
    ? new THREE.Box3(new THREE.Vector3(-7.4, 0, -5.0), new THREE.Vector3(11.5, 4.2, 5.6))
    : new THREE.Box3(new THREE.Vector3(-10.4, 0, -4.4), new THREE.Vector3(11.9, 4.4, 5.0));
  return { update: (t, dt) => upd.forEach((f) => f(t, dt)), box, groundSize: mini ? 36 : 44 };
}

// ---------------------------------------------------------------------------
// Scene: power and cooling cutaway
// ---------------------------------------------------------------------------
function buildEnergy(ctx) {
  const { scene, ledMat, labels } = ctx;
  const rnd = mulberry32(5);
  const root = new THREE.Group();
  scene.add(root);
  const upd = [];
  const flows = [];

  // Cabinet cutaway
  const cab = new THREE.Group();
  root.add(cab);
  const frame = edgeBox(0.9, 2.2, 1.1, COL.cyan, 0.7);
  frame.position.set(0, 1.1, 0);
  cab.add(frame);
  const panelMat = new THREE.MeshBasicMaterial({ color: COL.cyan, transparent: true, opacity: 0.05, side: THREE.DoubleSide, depthWrite: false });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.2), panelMat);
  back.position.set(0, 1.1, -0.55);
  const right = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.2), panelMat);
  right.rotation.y = Math.PI / 2;
  right.position.set(0.45, 1.1, 0);
  cab.add(back, right);
  const plate = new THREE.BoxGeometry(0.78, 0.18, 0.9);
  const cLeds = [];
  for (let i = 0; i < 9; i++) {
    const y = 0.22 + i * 0.22;
    const m = new THREE.Mesh(plate, darkMat());
    m.position.set(0, y, 0.02);
    cab.add(m);
    cLeds.push({ x: -0.28, y, z: 0.485, sx: 0.07, sy: 0.04, sz: 0.02, c: LED_CYAN, ph: rnd(), rate: rnd() < 0.5 ? 0 : 3 + rnd() * 8 });
    cLeds.push({ x: 0.28, y, z: 0.485, sx: 0.07, sy: 0.04, sz: 0.02, c: rnd() < 0.2 ? LED_AMBER : LED_GREEN, ph: rnd(), rate: rnd() < 0.5 ? 0 : 3 + rnd() * 8 });
  }
  cab.add(ledSet(cLeds, ledMat));
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.08, 1.3), darkMat());
  base.position.set(0, 0.04, 0);
  cab.add(base);
  labels.add(new THREE.Vector3(0, 0, 0.95), 'Kabin', 'A + B beslemeli', 0);

  // Power chains A (z < 0) and B (z > 0)
  [[-1, 'Besleme A'], [1, 'Besleme B']].forEach(([s, name]) => {
    const ups = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.3, 1.0), darkMat());
    ups.position.set(-5.4, 0.65, s * 1.8);
    const ue = edgeBox(1.5, 1.3, 1.0, COL.amber, 0.7);
    ue.position.copy(ups.position);
    root.add(ups, ue);
    const strip = [];
    for (let i = 0; i < 6; i++) strip.push({ x: -5.4 - 0.5 + i * 0.2, y: 0.9, z: s * 1.8 + 0.505, sx: 0.12, sy: 0.05, sz: 0.02, c: LED_AMBER, ph: i / 6, rate: 1.2 });
    root.add(ledSet(strip, ledMat));
    const pdu = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.6, 0.35), darkMat());
    pdu.position.set(-3.1, 0.8, s * 1.15);
    const pe = edgeBox(0.35, 1.6, 0.35, COL.amber, 0.7);
    pe.position.copy(pdu.position);
    const pcap = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: COL.amber, toneMapped: false }));
    pcap.position.set(-3.1, 1.65, s * 1.15);
    root.add(pdu, pe, pcap);
    const c1 = new THREE.CubicBezierCurve3(new THREE.Vector3(-4.65, 1.3, s * 1.8), new THREE.Vector3(-4.2, 1.9, s * 1.6), new THREE.Vector3(-3.7, 1.9, s * 1.3), new THREE.Vector3(-3.1, 1.65, s * 1.15));
    const inPort = new THREE.Vector3(-0.45, 1.95, s * 0.3);
    const c2 = new THREE.CubicBezierCurve3(new THREE.Vector3(-3.1, 1.65, s * 1.15), new THREE.Vector3(-2.2, 2.3, s * 1.0), new THREE.Vector3(-1.2, 2.3, s * 0.5), inPort);
    glowTube(root, c1, 0.045, COL.amber, 1, 32);
    glowTube(root, c2, 0.045, COL.amber, 1, 40);
    const port = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshBasicMaterial({ color: COL.amber, toneMapped: false }));
    port.position.copy(inPort);
    root.add(port);
    flows.push({ curve: c1, n: 3, speed: 1.6, color: COL.amber, dir: 1 });
    flows.push({ curve: c2, n: 4, speed: 1.8, color: COL.amber, dir: 1 });
    labels.add(new THREE.Vector3(-5.4, 0, s * 1.8 + 0.85), name, null, s < 0 ? 1 : 2);
  });

  // Cooling units with spinning fans
  const fans = [];
  [[-1, 'Soğutma 1'], [1, 'Soğutma 2']].forEach(([s, name]) => {
    const unit = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.7, 1.1), darkMat());
    unit.position.set(5.2, 0.85, s * 1.8);
    const ue = edgeBox(1.5, 1.7, 1.1, COL.blue, 0.7);
    ue.position.copy(unit.position);
    root.add(unit, ue);
    [0.4, 1.2].forEach((y) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 28), new THREE.MeshBasicMaterial({ color: COL.blue, toneMapped: false }));
      ring.rotation.y = Math.PI / 2;
      ring.position.set(4.45, y, s * 1.8);
      const rotor = new THREE.Group();
      for (let i = 0; i < 5; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.26, 0.07), new THREE.MeshBasicMaterial({ color: COL.blue, transparent: true, opacity: 0.8 }));
        b.position.y = 0.15;
        const hold = new THREE.Group();
        hold.rotation.x = (i * Math.PI * 2) / 5;
        hold.add(b);
        rotor.add(hold);
      }
      rotor.position.copy(ring.position);
      root.add(ring, rotor);
      fans.push(rotor);
    });
    labels.add(new THREE.Vector3(5.2, 0, s * 1.8 + 0.85), name, null, s < 0 ? 3 : 4);
  });
  upd.push((t) => fans.forEach((f, i) => { f.rotation.x = t * (i % 2 ? 6 : -6); }));

  // Airflow: cold air from the units to the cabinet front, warm air out of the back and
  // back to the units. Particles change color from blue to orange along the loop.
  const loops = [-1, 1].map((s) => new THREE.CatmullRomCurve3([
    new THREE.Vector3(5.4, 0.6, s * 1.8),
    new THREE.Vector3(3.6, 0.14, s * 1.4),
    new THREE.Vector3(1.6, 0.16, s * 0.9),
    new THREE.Vector3(0.3, 0.9, 0.75),
    new THREE.Vector3(0.0, 1.1, 0.0),
    new THREE.Vector3(-0.1, 1.2, -0.75),
    new THREE.Vector3(0.4, 2.2, -1.3 * s * 0.4 - 0.9),
    new THREE.Vector3(2.4, 2.9, s * 1.0),
    new THREE.Vector3(4.6, 2.3, s * 1.8),
    new THREE.Vector3(5.2, 1.0, s * 1.8),
  ], false, 'catmullrom', 0.3));
  const per = 16;
  const air = new THREE.InstancedMesh(new THREE.SphereGeometry(0.085, 8, 8), new THREE.MeshBasicMaterial({ toneMapped: false }), per * 2);
  air.frustumCulled = false;
  const am = new THREE.Matrix4();
  const ap = new THREE.Vector3();
  const ac = new THREE.Color();
  upd.push((t) => {
    for (let l = 0; l < 2; l++) {
      for (let i = 0; i < per; i++) {
        const u = (t * 0.07 + i / per + l * 0.03) % 1;
        loops[l].getPoint(u, ap);
        am.setPosition(ap);
        air.setMatrixAt(l * per + i, am);
        const w = THREE.MathUtils.smoothstep(u, 0.38, 0.58);
        ac.copy(COL.blue).lerp(COL.orange, w);
        air.setColorAt(l * per + i, ac);
      }
    }
    air.instanceMatrix.needsUpdate = true;
    if (air.instanceColor) air.instanceColor.needsUpdate = true;
  });
  root.add(air);

  const packets = makePackets(flows, 0.14);
  root.add(packets.mesh);
  upd.push((t, dt) => packets.update(dt));

  const box = new THREE.Box3(new THREE.Vector3(-6.25, 0, -2.5), new THREE.Vector3(6.25, 2.6, 2.8));
  return { update: (t, dt) => upd.forEach((f) => f(t, dt)), box, groundSize: 30 };
}

// ---------------------------------------------------------------------------
// Camera fit: distance such that the bounding box fits inside the view
// ---------------------------------------------------------------------------
function fitDistance(camera, box, dir, aspect, margin) {
  const center = box.getCenter(new THREE.Vector3());
  const corners = [];
  [box.min.x, box.max.x].forEach((x) => [box.min.y, box.max.y].forEach((y) => [box.min.z, box.max.z].forEach((z) => corners.push(new THREE.Vector3(x, y, z)))));
  camera.aspect = aspect;
  camera.updateProjectionMatrix();
  let lo = 2;
  let hi = 140;
  const v = new THREE.Vector3();
  for (let i = 0; i < 26; i++) {
    const d = (lo + hi) / 2;
    camera.position.copy(center).addScaledVector(dir, d);
    camera.lookAt(center);
    camera.updateMatrixWorld(true);
    let ok = true;
    for (let k = 0; k < corners.length; k++) {
      v.copy(corners[k]).project(camera);
      if (Math.abs(v.x) > margin || Math.abs(v.y) > margin) { ok = false; break; }
    }
    if (ok) hi = d; else lo = d;
  }
  return hi;
}

// ---------------------------------------------------------------------------
// Instance (renderer lifecycle)
// ---------------------------------------------------------------------------
function createInstance(container, opts) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lowEnd = window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768 || (navigator.hardwareConcurrency || 8) <= 2;

  const stage = document.createElement('div');
  stage.className = 'viz-stage';
  stage.setAttribute('aria-hidden', 'true');
  const canvas = document.createElement('canvas');
  const layer = document.createElement('div');
  layer.className = 'viz-labels';
  stage.appendChild(canvas);
  stage.appendChild(layer);
  container.appendChild(stage);
  container.classList.add('viz-on');

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  } catch (err) {
    stage.remove();
    container.classList.remove('viz-on');
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = opts.kind === 'energy' ? 1.3 : 1.15;
  const dprCap = lowEnd ? 1 : 1.5;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  scene.add(new THREE.HemisphereLight(0x7aa4c8, 0x0a0e13, 1.6));
  const key = new THREE.DirectionalLight(0xcfeaff, 2.0);
  key.position.set(4, 9, 7);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffb070, 0.9);
  rim.position.set(-6, 4, -5);
  scene.add(rim);

  const ledMat = new THREE.ShaderMaterial({
    vertexShader: LED_VERT,
    fragmentShader: LED_FRAG,
    uniforms: { uTime: { value: 0 }, uGain: { value: 1.3 } },
  });
  const labels = new Labels(layer, !!opts.mini);
  const built = opts.kind === 'energy'
    ? buildEnergy({ scene, ledMat, labels, mini: false })
    : buildNetwork({ scene, ledMat, labels, mini: !!opts.mini });
  scene.add(gridGround(built.groundSize));

  const dir = (opts.kind === 'energy' ? new THREE.Vector3(0, 0.78, 0.62) : opts.mini ? new THREE.Vector3(0, 0.82, 0.57) : new THREE.Vector3(0, 0.62, 0.78)).normalize();
  const center = built.box.getCenter(new THREE.Vector3());
  let dist = 30;
  let width = 1;
  let height = 1;
  const mouse = { x: 0, y: 0 };
  const smooth = { x: 0, y: 0 };

  function resize() {
    width = Math.max(1, container.clientWidth);
    const narrow = width < 560;
    const ar = opts.kind === 'energy' ? (narrow ? 1.35 : 1.6) : (opts.mini ? (narrow ? 1.3 : 1.75) : (narrow ? 1.2 : 2.0));
    container.style.aspectRatio = String(ar);
    height = Math.max(1, container.clientHeight);
    const pr = Math.min(window.devicePixelRatio || 1, dprCap);
    renderer.setPixelRatio(pr);
    renderer.setSize(width, height, false);
    dist = fitDistance(camera, built.box, dir, width / height, opts.kind === 'energy' ? 0.95 : 0.93);
    labels.measure();
  }

  let running = false;
  let raf = 0;
  let last = 0;
  let time = 0;
  const base = new THREE.Vector3();

  function draw(dt) {
    time += dt;
    smooth.x += (mouse.x - smooth.x) * 0.05;
    smooth.y += (mouse.y - smooth.y) * 0.05;
    const az = (reduced ? 0 : Math.sin(time * 0.18) * 0.06) + smooth.x * 0.04;
    const el = smooth.y * 0.03;
    base.copy(dir).applyAxisAngle(THREE.Object3D.DEFAULT_UP, az);
    base.y += el;
    base.normalize();
    camera.position.copy(center).addScaledVector(base, dist);
    camera.lookAt(center);
    camera.updateMatrixWorld(true);
    ledMat.uniforms.uTime.value = time;
    built.update(time, dt);
    renderer.render(scene, camera);
    labels.update(camera, width, height);
  }

  function tick(now) {
    raf = 0;
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    draw(dt);
    raf = requestAnimationFrame(tick);
  }

  const ro = new ResizeObserver(() => { resize(); if (!running || reduced) draw(0); });
  ro.observe(container);
  const onMove = (e) => {
    const r = container.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
  };
  if (!reduced) container.addEventListener('pointermove', onMove, { passive: true });

  const onLost = (e) => { e.preventDefault(); inst.lost = true; };
  canvas.addEventListener('webglcontextlost', onLost);

  resize();
  draw(0);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { labels.measure(); if (!running) draw(0); }).catch(() => {});

  const inst = {
    lost: false,
    resume() {
      if (reduced || running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    },
    pause() { running = false; },
    dispose() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
      container.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('webglcontextlost', onLost);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
      renderer.dispose();
      renderer.forceContextLoss();
      stage.remove();
    },
  };
  return inst;
}

/**
 * Mounts a lazily created 3D visualization into a container.
 * @param {HTMLElement} container
 * @param {{kind: 'network'|'energy', mini?: boolean, onFail?: Function}} opts
 */
export function initViz(container, opts) {
  const fail = () => { if (opts.onFail) opts.onFail(); };
  if (!hasWebGL() || typeof IntersectionObserver === 'undefined' || typeof ResizeObserver === 'undefined') { fail(); return; }
  let inst = null;
  let broken = false;

  function start() {
    if (broken) return;
    if (!inst) {
      while (active.length >= MAX_CONTEXTS) active[0].stop();
      try {
        inst = createInstance(container, opts);
      } catch (err) {
        inst = null;
        container.classList.remove('viz-on');
        const st = container.querySelector('.viz-stage');
        if (st) st.remove();
      }
      if (!inst) {
        broken = true;
        fail();
        return;
      }
      active.push(handle);
    }
    inst.resume();
  }

  const handle = {
    stop() {
      const i = active.indexOf(handle);
      if (i >= 0) active.splice(i, 1);
      if (inst) { inst.dispose(); inst = null; }
    },
  };

  new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) start(); else handle.stop();
  }, { rootMargin: '150px' }).observe(container);

  document.addEventListener('visibilitychange', () => {
    if (!inst) return;
    if (document.hidden) inst.pause(); else inst.resume();
  });
}
