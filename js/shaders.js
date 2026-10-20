// GLSL sources as template strings (GLSL ES 1.00 style, converted by three.js for WebGL2).
// Units for the die shader: 1 shader unit = 1 mm of die space (decorative scale).

// ---------------------------------------------------------------------------
// Post processing: chromatic aberration, vignette, fade, flash, grain
// ---------------------------------------------------------------------------
export const POST_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const POST_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float uCA;
uniform float uVig;
uniform float uFade;
uniform float uFlash;
uniform float uTime;
uniform float uGrain;
varying vec2 vUv;

float h21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec2 c = vUv - 0.5;
  float r2 = dot(c, c);
  vec2 off = c * uCA * (0.4 + r2 * 2.0);
  vec3 col;
  col.r = texture2D(tDiffuse, vUv + off).r;
  col.g = texture2D(tDiffuse, vUv).g;
  col.b = texture2D(tDiffuse, vUv - off).b;
  col *= 1.0 - uVig * smoothstep(0.1, 0.75, r2 * 1.8);
  col += vec3(0.35, 0.85, 1.0) * uFlash * (1.0 - clamp(r2 * 1.6, 0.0, 1.0));
  col += (h21(vUv * vec2(1920.0, 1080.0) + fract(uTime) * 37.0) - 0.5) * uGrain;
  col *= 1.0 - uFade;
  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
}
`;

// ---------------------------------------------------------------------------
// Instanced status LEDs (blinking computed on the GPU, HDR colors for bloom)
// ---------------------------------------------------------------------------
export const LED_VERT = /* glsl */ `
attribute vec3 aColor;
attribute float aPhase;
attribute float aRate;
uniform float uTime;
uniform float uGain;
varying vec3 vCol;

float h11(float n) { return fract(sin(n * 127.1) * 43758.5453); }

void main() {
  float on = 1.0;
  if (aRate > 0.001) {
    float s = sin(uTime * aRate + aPhase * 6.2831853);
    on = smoothstep(-0.15, 0.25, s);
    // drive activity style flicker for fast LEDs
    if (aRate > 6.0) {
      on = step(0.45, h11(floor(uTime * aRate * 0.6 + aPhase * 97.0)));
    }
  }
  vCol = aColor * (0.12 + 2.4 * on) * uGain;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const LED_FRAG = /* glsl */ `
varying vec3 vCol;
void main() {
  gl_FragColor = vec4(vCol, 1.0);
}
`;

// ---------------------------------------------------------------------------
// Light shafts (additive soft cones) in the cold aisle
// ---------------------------------------------------------------------------
export const SHAFT_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
varying float vY;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  vY = uv.y;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

export const SHAFT_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAmt;
uniform float uTime;
varying vec3 vN;
varying vec3 vV;
varying float vY;
void main() {
  float f = abs(dot(normalize(vN), normalize(vV)));
  float edge = pow(f, 1.8);
  float grad = pow(clamp(vY, 0.0, 1.0), 1.3) * smoothstep(0.0, 0.12, vY);
  float flick = 0.88 + 0.12 * sin(uTime * 0.35 + vY * 7.0);
  float a = edge * grad * uAmt * flick;
  gl_FragColor = vec4(uColor, a);
}
`;

// ---------------------------------------------------------------------------
// Floating dust (additive points)
// ---------------------------------------------------------------------------
export const DUST_VERT = /* glsl */ `
attribute float aSeed;
uniform float uTime;
uniform float uScale;
uniform float uSize;
uniform vec3 uBox;
uniform vec3 uCenter;
varying float vA;
void main() {
  vec3 p = position;
  p.y += uTime * 0.02 * (0.5 + aSeed);
  p.x += sin(uTime * 0.2 + aSeed * 20.0) * 0.15;
  p.z += cos(uTime * 0.17 + aSeed * 31.0) * 0.15;
  p = uCenter + mod(p - uCenter + uBox * 0.5, uBox) - uBox * 0.5;
  vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float d = max(-mv.z, 0.2);
  gl_PointSize = clamp(uSize * uScale * (0.4 + aSeed) / d, 1.0, 14.0);
  vA = (0.25 + 0.75 * aSeed) * smoothstep(0.3, 1.2, d);
}
`;

export const DUST_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(uColor, a * a * uAlpha * vA);
}
`;

// ---------------------------------------------------------------------------
// Procedural silicon die. Hierarchical floorplan with level-of-detail driven by
// the screen-space pixel size (fwidth), so any zoom level stays crisp.
// ---------------------------------------------------------------------------
export const DIE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const DIE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;

uniform float uTime;
uniform float uZoom;
uniform float uTilt;
uniform float uGlow;
uniform float uDim;

#define DIE vec2(20.0, 26.0)

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Violet / green / cyan interference palette ("thin film" look)
vec3 iri(float t) {
  float s = 0.5 + 0.5 * sin(6.2831853 * t);
  vec3 violet = vec3(0.55, 0.25, 1.0);
  vec3 green = vec3(0.15, 1.0, 0.6);
  vec3 cyan = vec3(0.1, 0.7, 1.0);
  vec3 c = mix(violet, green, s);
  return mix(c, cyan, 0.35 * (0.5 + 0.5 * cos(12.566371 * t + 1.0)));
}

float wIn(float size, float pix, float a, float b) {
  return smoothstep(a, b, size / pix);
}
float wOut(float size, float pix) {
  return 1.0 - smoothstep(250.0, 1000.0, size / pix);
}

// Grid of rectangular blocks with gaps, rims and optional SRAM-like dots.
vec3 blocks(vec2 p, float pitch, float seed, float pix, float sramAmt) {
  vec2 g = p / pitch;
  vec2 id = floor(g);
  vec2 f = fract(g);
  float h = hash12(id + seed);
  float gap = 0.07;
  vec2 dd = min(f, 1.0 - f);
  float e = min(dd.x, dd.y);
  float aa = pix / pitch;
  float body = smoothstep(gap, gap + aa * 1.5, e);
  float rimW = gap + max(aa * 2.5, 0.015);
  float rim = body * (1.0 - smoothstep(rimW, rimW + aa * 1.5, e));
  vec3 base = iri(h * 1.7 + seed * 0.13 + uTilt * 0.6 + dot(id, vec2(0.07, 0.05)));
  float fill = 0.10 + 0.20 * h;
  float sr = 0.0;
  if (h < 0.3) {
    vec2 s = fract(g * vec2(10.0, 14.0));
    float srW = smoothstep(2.0, 5.0, pitch / (14.0 * pix));
    sr = step(0.35, s.x) * step(0.35, s.y) * srW * sramAmt;
  }
  return base * (fill + 0.16 * sr) * body + base * rim * 0.85;
}

// Routing grid with data pulses flowing along randomly chosen wires.
vec3 traces(vec2 p, float pitch, float width, float seed, float speed, float pix) {
  vec2 g = p / pitch;
  vec2 id = floor(g + 0.5);
  vec2 d = abs(g - id) * pitch;
  float lx = 1.0 - smoothstep(width * 0.5, width * 0.5 + pix, d.x);
  float ly = 1.0 - smoothstep(width * 0.5, width * 0.5 + pix, d.y);
  float hx = hash12(vec2(id.x, seed));
  float hy = hash12(vec2(id.y, seed + 19.0));
  float sx = hash12(vec2(id.x + seed * 3.0, floor(p.y / (pitch * 5.0))));
  float sy = hash12(vec2(id.y + seed * 5.0, floor(p.x / (pitch * 5.0))));
  lx *= step(0.35, hx) * step(0.25, sx);
  ly *= step(0.35, hy) * step(0.25, sy);
  float L = pitch * 5.0;
  float phx = fract(p.y / L - uTime * speed * (0.5 + hx) + hx * 17.0);
  float phy = fract(p.x / L - uTime * speed * (0.5 + hy) + hy * 13.0);
  float px = pow(1.0 - phx, 14.0) * smoothstep(0.0, 0.04, phx) * step(0.5, fract(hx * 7.3));
  float py = pow(1.0 - phy, 14.0) * smoothstep(0.0, 0.04, phy) * step(0.5, fract(hy * 5.7));
  vec3 metal = vec3(0.22, 0.32, 0.55);
  vec3 pulse = vec3(0.2, 0.95, 1.0);
  return metal * 0.5 * (lx + ly) + pulse * 1.6 * (lx * px + ly * py);
}

// Standard-cell rows
vec3 stdcells(vec2 p, float pix) {
  float rowH = 0.0036;
  vec2 g = vec2(p.x / 0.0018, p.y / rowH);
  vec2 id = floor(g);
  vec2 f = fract(g);
  float h = hash12(id);
  vec2 dd = min(f, 1.0 - f);
  float body = smoothstep(0.04, 0.04 + pix / rowH * 1.5, dd.y) * smoothstep(0.03, 0.03 + pix / 0.0018 * 1.5, dd.x);
  vec3 base = iri(h * 2.3 + floor(p.y / rowH) * 0.03 + uTilt * 0.5);
  return base * body * (0.05 + 0.18 * h);
}

// Transistor level: fins, gates and contacts
vec3 transistors(vec2 p, float pix) {
  float gp = 0.00017;
  float fp = 0.00009;
  vec2 g = vec2(p.x / gp, p.y / fp);
  vec2 f = fract(g);
  float gate = 1.0 - smoothstep(0.14, 0.14 + pix / gp, abs(f.x - 0.5));
  float fi = mod(floor(g.y), 5.0);
  float finOn = step(fi, 2.5);
  float finLine = (1.0 - smoothstep(0.2, 0.2 + pix / fp, abs(f.y - 0.5))) * finOn;
  float contact = (1.0 - smoothstep(0.09, 0.09 + pix / gp, min(f.x, 1.0 - f.x))) * finLine;
  vec2 cell = vec2(floor(g.x), floor(g.y / 5.0));
  float on = step(0.78, hash12(cell + floor(uTime * 2.0 + hash12(cell) * 5.0)));
  vec3 fin = iri(hash12(cell) + uTilt * 0.4) * finLine * 0.45;
  vec3 gt = vec3(0.12, 0.30, 0.55) * gate * 0.7;
  vec3 channel = vec3(0.3, 1.0, 0.9) * gate * finLine * (0.35 + 0.9 * on);
  vec3 ct = vec3(1.0, 0.7, 0.25) * contact * 1.1;
  return fin + gt + channel + ct;
}

// Zone test: 1.0 inside the core / cache / memory controller area
float coreMask(vec2 q) {
  vec2 a = abs(q);
  float m = step(a.x, 9.3) * step(a.y, 12.3);
  return m;
}

vec3 floorplan(vec2 q, float pix) {
  vec3 c = vec3(0.0);
  vec2 a = abs(q);
  if (a.x > 9.5 || a.y > 12.5) {
    // IO pad ring in the margin
    vec2 pg = fract(q / 0.5);
    float pad = step(0.2, pg.x) * step(pg.x, 0.8) * step(0.2, pg.y) * step(pg.y, 0.8);
    c += vec3(0.9, 0.65, 0.25) * pad * 0.22;
    return c;
  }
  if (a.x < 6.9 && a.y < 11.5) {
    vec2 g = vec2(q.x + 6.9, q.y + 11.5) / 4.6;
    vec2 id = floor(g);
    vec2 f = fract(g);
    bool cache = mod(id.y, 2.0) > 0.5;
    vec2 dd = min(f, 1.0 - f);
    float e = min(dd.x, dd.y);
    float aa = pix / 4.6;
    float body = smoothstep(0.045, 0.045 + aa * 1.5, e);
    float rimW = 0.045 + max(aa * 2.5, 0.01);
    float rim = body * (1.0 - smoothstep(rimW, rimW + aa * 1.5, e));
    float h = hash12(id);
    vec3 base = cache ? iri(0.42 + h * 0.1 + uTilt * 0.5) : iri(0.08 + h * 0.12 + uTilt * 0.5);
    float fill = cache ? 0.16 : 0.20;
    float sr = 0.0;
    if (cache) {
      vec2 s = fract(q * vec2(4.0, 6.0));
      float srW = smoothstep(2.0, 5.0, 4.6 / (24.0 * pix));
      sr = step(0.3, s.x) * step(0.3, s.y) * srW;
    }
    c += base * (fill + 0.12 * sr) * body + base * rim * 0.9;
  } else {
    // memory controllers on the left and right
    vec2 g = vec2(a.x - 6.9, q.y + 11.5) / 2.3;
    vec2 id = floor(g);
    vec2 f = fract(g);
    vec2 dd = min(f, 1.0 - f);
    float e = min(dd.x, dd.y);
    float aa = pix / 2.3;
    float body = smoothstep(0.06, 0.06 + aa * 1.5, e);
    float rimW = 0.06 + max(aa * 2.5, 0.01);
    float rim = body * (1.0 - smoothstep(rimW, rimW + aa * 1.5, e));
    float h = hash12(id + 7.0);
    vec3 base = iri(0.65 + h * 0.15 + uTilt * 0.4);
    c += base * 0.15 * body + base * rim * 0.8;
  }
  return c;
}

void main() {
  vec2 q0 = (vUv - 0.5) * DIE / uZoom;
  float pix = max(max(fwidth(q0.x), fwidth(q0.y)), 1e-9);

  vec3 col = vec3(0.012, 0.017, 0.030);
  col += iri(q0.x * 0.04 + q0.y * 0.025 + uTilt) * 0.03;

  // Level 0: floorplan and global buses
  col += floorplan(q0, pix);
  float cm = coreMask(q0);
  col += traces(q0 + vec2(2.3), 4.6, 0.05, 1.0, 0.5, pix) * cm * wIn(0.05, pix, 0.6, 2.5) * 0.7;

  // Level 1: macro blocks inside cores
  float w1 = wIn(0.77, pix, 8.0, 22.0) * wOut(0.77, pix);
  if (w1 > 0.001) {
    col += blocks(q0, 0.77, 3.0, pix, 1.0) * w1 * cm * mix(0.35, 0.8, smoothstep(1.0, 4.0, uZoom));
    col += traces(q0, 0.77, 0.03, 5.0, 0.35, pix) * w1 * wIn(0.03, pix, 0.6, 2.5) * cm;
  }
  // Level 2: sub blocks
  float w2 = wIn(0.128, pix, 8.0, 22.0) * wOut(0.128, pix);
  if (w2 > 0.001) {
    col += blocks(q0, 0.128, 11.0, pix, 1.0) * w2 * cm * 0.9;
    col += traces(q0, 0.128, 0.006, 9.0, 0.25, pix) * w2 * wIn(0.006, pix, 0.6, 2.5) * cm;
  }
  // Level 3: logic clusters
  float w3 = wIn(0.0214, pix, 8.0, 22.0) * wOut(0.0214, pix);
  if (w3 > 0.001) {
    col += blocks(q0, 0.0214, 23.0, pix, 0.0) * w3 * 0.9;
    col += traces(q0, 0.0214, 0.0010, 13.0, 0.2, pix) * w3 * wIn(0.0010, pix, 0.6, 2.5);
  }
  // Level 4: standard-cell rows
  float w4 = wIn(0.0036, pix, 6.0, 16.0) * wOut(0.0036, pix);
  if (w4 > 0.001) {
    col += stdcells(q0, pix) * w4;
  }
  // Level 5: metal wires with pulses
  float w5 = wIn(0.0006, pix, 5.0, 14.0) * wOut(0.0006, pix);
  if (w5 > 0.001) {
    col += traces(q0, 0.0006, 0.00022, 31.0, 0.12, pix) * w5 * 1.2;
  }
  // Level 6: transistors
  float w6 = wIn(0.00017, pix, 6.0, 16.0);
  if (w6 > 0.001) {
    col += transistors(q0, pix) * w6;
  }

  // Glowing point at the center of the deepest level
  vec2 gc = (vUv - 0.5) * vec2(DIE.x / DIE.y, 1.0);
  float r = length(gc);
  float pulse = 0.85 + 0.15 * sin(uTime * 2.2);
  // darken and cap the die as we dive so the core point stands on a dark background
  float deep = smoothstep(1.5, 50.0, uZoom);
  col = min(col, vec3(0.9));
  col *= mix(1.0, 0.22, deep);
  col *= 1.0 - 0.7 * deep * smoothstep(0.1, 0.6, r);
  float glow = exp(-r * r * 3500.0) * 1.6 + exp(-r * r * 300.0) * 0.18;
  col *= uDim;
  col *= 1.0 - 0.5 * (1.0 - uDim) * smoothstep(0.1, 0.6, r);
  col += vec3(0.25, 0.9, 1.0) * glow * uGlow * pulse;
  col += vec3(1.0, 0.97, 0.9) * exp(-r * r * 20000.0) * 2.5 * uGlow;

  // fade the die edges into the dark background so no hard rectangle edge shows
  float edge = smoothstep(0.0, 0.05, min(vUv.x, 1.0 - vUv.x)) * smoothstep(0.0, 0.04, min(vUv.y, 1.0 - vUv.y));
  gl_FragColor = vec4(col * edge, 1.0);
}
`;
