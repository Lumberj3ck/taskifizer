// Procedural pixel landscapes. Each day gets a deterministic picture from its seed.
// No Obsidian imports, so it can be unit tested with plain Node.

export function rng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return (
    "#" +
    A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, "0")).join("")
  );
}

interface Palette {
  top: string;
  bot: string;
  sun: string;
  far: string;
  near: string;
  water: string;
  stars?: boolean;
}

const PALETTES: Palette[] = [
  { top: "#2b2f6b", bot: "#f08a5d", sun: "#ffd36e", far: "#7a4270", near: "#2e2440", water: "#3b4a7e" }, // dusk
  { top: "#0b1330", bot: "#2b4778", sun: "#e9eef7", far: "#1e2c4e", near: "#0f1a30", water: "#1a2b52", stars: true }, // night
  { top: "#9fc3e8", bot: "#fbd3b0", sun: "#fff1c9", far: "#8ea3c2", near: "#4f6b86", water: "#7fa6c9" }, // dawn
  { top: "#f2c46d", bot: "#e36c3b", sun: "#fff0b3", far: "#a0472c", near: "#5a2a1e", water: "#b0563a" }, // autumn
  { top: "#bfe8dc", bot: "#f5f1d6", sun: "#ffffff", far: "#6fb59b", near: "#2f6f5c", water: "#5aa595" }, // mint
  { top: "#4b5563", bot: "#a2abb4", sun: "#dde1e5", far: "#5b6570", near: "#2f363d", water: "#4d5b69" }, // overcast
  { top: "#f6c1cc", bot: "#fde2c4", sun: "#ffffff", far: "#c07a93", near: "#7d4766", water: "#d49aa9" }, // rose
  { top: "#1a1033", bot: "#6b2d6b", sun: "#ffb3d9", far: "#3d1f4f", near: "#170d24", water: "#2a1a45", stars: true }, // violet night
];

export interface Scene {
  /** One hex color per cell, row-major. */
  colors: string[];
  /** Indices of golden cells. */
  gold: number[];
}

/**
 * Builds a sunset-style landscape: sky gradient, sun or moon, two mountain ridges and water
 * with a reflection. The shapes are designed on a 20 x 12 grid and scaled to any size.
 */
export function makeScene(seed: number, cols: number, rows: number, goldCount: number): Scene {
  const r = rng(seed);
  const p = PALETTES[Math.floor(r() * PALETTES.length)];
  const sx = 3 + r() * 14;
  const sy = 2 + r() * 4;
  const sr = 1.4 + r() * 1.2;
  const ph = r() * Math.PI * 2;

  const colors: string[] = [];
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const u = ((x + 0.5) / cols) * 20 - 0.5;
      const v = ((y + 0.5) / rows) * 12 - 0.5;

      let c = mix(p.top, p.bot, Math.min(1, Math.max(0, v / 8)));
      if (p.stars && v < 6 && r() < 0.07) c = mix(c, "#ffffff", 0.75);

      const d = Math.hypot(u - sx, v - sy);
      if (d <= sr) c = p.sun;
      else if (d <= sr + 1.3) c = mix(c, p.sun, 0.35);

      const far = 6.3 + 1.6 * Math.sin(u * 0.55 + ph) + 0.8 * Math.sin(u * 1.3 + ph * 2);
      if (v >= far) c = v - far < 1 ? mix(p.far, p.bot, 0.18) : p.far;

      const near = 8.5 + 1.1 * Math.sin(u * 0.8 + ph + 2) + 0.6 * Math.sin(u * 1.9 + ph);
      if (v >= near) c = p.near;

      if (v >= 9.5) {
        const surface = v < 10.5;
        c = surface ? mix(p.water, p.bot, 0.3) : p.water;
        if (Math.abs(u - sx) <= (surface ? 1.5 : 1) && (x + y) % 2 === 0) c = mix(p.water, p.sun, 0.65);
      }
      colors.push(c);
    }
  }

  const total = cols * rows;
  const gold = new Set<number>();
  const want = Math.max(0, Math.min(goldCount, total));
  while (gold.size < want) gold.add(Math.floor(r() * total));

  return { colors, gold: [...gold] };
}
