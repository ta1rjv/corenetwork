// Shared scroll-path helpers (pure functions, no dependencies).
// "p" is the scene progress in 0..1:
//   cabinet 0-0.2, server 0.2-0.4, cpu 0.4-0.6, silicon 0.6-0.8, core 0.8-1.0

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;

export const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// Scene progress values assigned to the DOM section boundaries:
// [cabinet top, server top, cpu top, silicon top, core top, end of descent]
export const SCENE_MARKS = [0, 0.2, 0.4, 0.6, 0.8, 1];

const LAYERS = [
  [0.2, 'KABİN'],
  [0.4, 'SUNUCU'],
  [0.6, 'CPU'],
  [0.8, 'SİLİSYUM'],
  [Infinity, 'ÇEKİRDEK'],
];

export function layerName(p) {
  for (let i = 0; i < LAYERS.length; i++) if (p < LAYERS[i][0]) return LAYERS[i][1];
  return LAYERS[LAYERS.length - 1][1];
}

// Decorative scale readout: base-10 exponent of a length in meters per progress key.
// This is NOT a physical measurement; it only conveys the idea of going from meters to nanometers.
const SCALE_KEYS = [[0, 0], [0.2, -1], [0.4, -2], [0.6, -3], [0.8, -5.2], [0.86, -7], [0.9, -7], [1, -5]];

export function scaleExponent(p) {
  for (let i = 0; i < SCALE_KEYS.length - 1; i++) {
    const a = SCALE_KEYS[i];
    const b = SCALE_KEYS[i + 1];
    if (p <= b[0]) return lerp(a[1], b[1], clamp((p - a[0]) / (b[0] - a[0]), 0, 1));
  }
  return SCALE_KEYS[SCALE_KEYS.length - 1][1];
}

function fmt(v) {
  return String(Number(v.toPrecision(2)));
}

export function scaleLabel(p) {
  const m = Math.pow(10, scaleExponent(p));
  if (m >= 0.9999) return fmt(m) + ' m';
  if (m >= 0.9999e-2) return fmt(m * 100) + ' cm';
  if (m >= 0.9999e-3) return fmt(m * 1e3) + ' mm';
  if (m >= 0.9999e-6) return fmt(m * 1e6) + ' µm';
  return fmt(m * 1e9) + ' nm';
}
