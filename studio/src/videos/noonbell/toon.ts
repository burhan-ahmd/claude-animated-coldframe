// "Pip and the Noon Bell" — our own flat 2D cartoon cast + 2D effect drawings, drawn with Canvas2D. NO IMPORTS.
//
// Construction v2 of references/reports/characters.md (our own cast — no reference character is copied):
//   heads   superellipse "bean": H/W ~0.93, pointed crown (nTop 1.75) + fuller jaw (nBot 2.3), -0.12 chin taper,
//           ~10 % one-sided bulge toward the facing side, +-4 deg tilt, 0.8 % contour noise, per-character seed;
//   ink     one thick-thin dark-plum ring: w(t) = w0 * (1 + 0.45 cos(t - thickAngle(light))), so the outline is ~3x
//           heavier on the bottom / away-from-light side (measured 64 deg for upper-left light);
//   bodies  bean torso (widest low, round bottom, no neck) + single-stroke limbs: legs 5.8u, arms 5.2u, ink-dot hands
//           5.5u, feet short 7.5u/13u strokes; adults 3.5 head-heights (torso 1.10, legs 1.40);
//   shade   flat fill + soft crescent (shadedFill) on the head, broad gradient (gradFill) on the torso;
//   faces   lidded deadpan eyes 0.26 W apart on the centre line, tapered brows at -0.20 W, small mouths at +0.20 W,
//           everything slid ~0.07-0.08 W toward the facing side; no blush, no catchlights.
//
// Design space: every figure is drawn in a 600 x 1000 unit card with the soles at y = 975 and the body centred on
// x = 300 (cast.ts scales it with the canvas transform). Critters (geese, dog), the boat and the cake reuse the same
// card. u = 1 % of the head path width W, the unit used throughout characters.md.

export const INK = "#241726"; // dark plum; reference ink core #201628..#2f1d28
export const SKIN = "#ffe2c2";
export const SKINS = [SKIN, "#f5c9a0", "#ecd0b6", "#c99067"];
const WHITE = "#ffffff";
const MOUTH = "#5a1e28";
const TONGUE = "#e86e78";
const TEETH = "#fdfbf6";
type C3 = [number, number, number];
const SH_SKIN: C3 = [0.96, 0.86, 0.84]; // measured shadow/lit ratio on skin heads
const SH_WHITE: C3 = [0.92, 0.9, 0.96]; // white heads: lavender shadow
const SH_CLOTH: C3 = [0.64, 0.66, 0.74]; // torsos: lit side -> far side ~0.65
const SH_FELT: C3 = [0.62, 0.62, 0.7];
type P2 = [number, number];

const rad = (d: number) => (d * Math.PI) / 180;
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
const clamp01 = (x: number) => clamp(x, 0, 1);
export const mul = (c: string, m: C3) => {
  const n = parseInt(c.slice(1), 16);
  const ch = (v: number, k: number) => Math.min(255, Math.round(v * k)).toString(16).padStart(2, "0");
  return `#${ch((n >> 16) & 255, m[0])}${ch((n >> 8) & 255, m[1])}${ch(n & 255, m[2])}`;
};
export const shade = (c: string, k: number) => mul(c, [k, k, k]);
export const mix = (a: string, b: string, t: number) => {
  const A = parseInt(a.slice(1), 16), B = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t).toString(16).padStart(2, "0");
  return `#${ch(16)}${ch(8)}${ch(0)}`;
};
export const rgba = (c: string, a: number) => {
  const n = parseInt(c.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
/** deterministic per-character random in [0, 1) */
const rnd = (seed: number, k: number) => { const x = Math.sin(seed * 127.1 + k * 311.7) * 43758.5453; return x - Math.floor(x); };
const rotPts = (pts: P2[], a: number, cx: number, cy: number): P2[] =>
  pts.map(([x, y]) => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)]);
const rotAbout = (q: P2, a: number, c: P2): P2 => rotPts([q], a, c[0], c[1])[0];
const lerp2 = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** smooth curve from a through (near) k to b, as a polyline */
const curve = (a: P2, k: P2, b: P2, n = 10): P2[] => {
  const c: P2 = [2 * k[0] - (a[0] + b[0]) / 2, 2 * k[1] - (a[1] + b[1]) / 2], out: P2[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, s = 1 - t;
    out.push([s * s * a[0] + 2 * s * t * c[0] + t * t * b[0], s * s * a[1] + 2 * s * t * c[1] + t * t * b[1]]);
  }
  return out;
};

// ===================================================================================================================
// the pen
// ===================================================================================================================
export class Pen {
  g: CanvasRenderingContext2D;
  ol = 12;
  /** [angle, cx, cy] rotation about (cx, cy), optional post-translation [.., dx, dy] */
  rot: number[] | null = null;
  constructor(g: CanvasRenderingContext2D) { this.g = g; }
  P(x: number, y: number): P2 {
    if (!this.rot) return [x, y];
    const r = this.rot, a = r[0], cx = r[1], cy = r[2], dx = r.length > 3 ? r[3] : 0, dy = r.length > 4 ? r[4] : 0, c = Math.cos(a), s = Math.sin(a);
    return [cx + (x - cx) * c - (y - cy) * s + dx, cy + (x - cx) * s + (y - cy) * c + dy];
  }
  path(pts: P2[], close: boolean) {
    const g = this.g;
    g.beginPath();
    pts.forEach((p, i) => { const [x, y] = this.P(p[0], p[1]); if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    if (close) g.closePath();
  }
  /** filled shape with an ink outline; fill=null draws the outline only */
  poly(pts: P2[], fill: string | null, ol?: number) {
    const g = this.g, w = ol ?? this.ol;
    this.path(pts, true);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (w) { g.lineWidth = w; g.strokeStyle = INK; g.lineJoin = "round"; g.stroke(); }
  }
  ell(cx: number, cy: number, rx: number, ry: number, fill: string | null, ol?: number, a0 = 0, a1 = 360, rot = 0) {
    this.poly(ellPts(cx, cy, rx, ry, a0, a1, rot), fill, ol);
  }
  /** thick round-capped limb with an ink rim (rope, oar, critter legs) */
  line(pts: P2[], fill: string, w: number, ink = true) {
    const g = this.g;
    g.lineCap = "round"; g.lineJoin = "round";
    if (ink) { this.path(pts, false); g.strokeStyle = INK; g.lineWidth = w + 2 * this.ol * 0.9; g.stroke(); }
    this.path(pts, false); g.strokeStyle = fill; g.lineWidth = w; g.stroke();
  }
  stroke(pts: P2[], w: number, fill = INK) {
    const g = this.g;
    g.lineCap = "round"; g.lineJoin = "round";
    this.path(pts, false); g.strokeStyle = fill; g.lineWidth = w; g.stroke();
  }
  arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, w: number, fill = INK) {
    const pts: P2[] = [];
    for (let i = 0; i <= 24; i++) pts.push([cx + rx * Math.cos(rad(a0 + ((a1 - a0) * i) / 24)), cy + ry * Math.sin(rad(a0 + ((a1 - a0) * i) / 24))]);
    this.stroke(pts, w, fill);
  }
  dot(cx: number, cy: number, r: number, fill = INK) {
    const [x, y] = this.P(cx, cy);
    this.g.beginPath(); this.g.arc(x, y, r, 0, Math.PI * 2); this.g.fillStyle = fill; this.g.fill();
  }
  /** draw with a closed shape as clip */
  clip(pts: P2[], fn: () => void) { const g = this.g; g.save(); this.path(pts, true); g.clip(); fn(); g.restore(); }
  /** flat fill + soft crescent on the side away from the light (light = canvas angle the light comes FROM).
   *  Radial ramp centred `shift` R toward the light: flat out to ~0.6 R on the far side, full shadow by ~0.8 R. */
  shadedFill(pts: P2[], base: string, shadow: string, light: number, R: number, shift = 0.45, r0 = 1.05, r1 = 1.25) {
    const g = this.g, n = pts.length;
    let cx = 0, cy = 0;
    for (const [x, y] of pts) { cx += x / n; cy += y / n; }
    const [gx, gy] = this.P(cx + Math.cos(light) * shift * R, cy + Math.sin(light) * shift * R);
    const gr = g.createRadialGradient(gx, gy, 0, gx, gy, r1 * R);
    gr.addColorStop(0, base); gr.addColorStop(clamp01(r0 / r1), base); gr.addColorStop(1, shadow);
    this.path(pts, true); g.fillStyle = gr; g.fill();
  }
  /** broad gradient across a shape along the light: lit edge = base, far edge = shadow (torsos, coats, boat, cake) */
  gradFill(pts: P2[], base: string, shadow: string, light: number, flat = 0.22) {
    const g = this.g, dx = Math.cos(light), dy = Math.sin(light), n = pts.length;
    let cx = 0, cy = 0, lo = Infinity, hi = -Infinity;
    for (const [x, y] of pts) { cx += x / n; cy += y / n; const d = x * dx + y * dy; lo = Math.min(lo, d); hi = Math.max(hi, d); }
    const dc = cx * dx + cy * dy;
    const [ax, ay] = this.P(cx + dx * (hi - dc), cy + dy * (hi - dc)), [bx, by] = this.P(cx + dx * (lo - dc), cy + dy * (lo - dc));
    const gr = g.createLinearGradient(ax, ay, bx, by);
    gr.addColorStop(0, base); gr.addColorStop(flat, base); gr.addColorStop(1, shadow);
    this.path(pts, true); g.fillStyle = gr; g.fill();
  }
  /** thick-thin ink ring: w(t) = w0 (1 + k cos(t - thick)), t from the contour centroid (canvas angles) */
  inkRing(pts: P2[], w0: number, thick: number, k = 0.45, col = INK) {
    const n = pts.length;
    let cx = 0, cy = 0;
    for (const [x, y] of pts) { cx += x / n; cy += y / n; }
    const out: P2[] = [], inn: P2[] = [];
    pts.forEach((q, i) => {
      const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
      let nx = b[1] - a[1], ny = a[0] - b[0]; // outward normal for clockwise-on-screen contours
      const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      const h = 0.5 * w0 * (1 + k * Math.cos(Math.atan2(q[1] - cy, q[0] - cx) - thick));
      out.push([q[0] + nx * h, q[1] + ny * h]); inn.push([q[0] - nx * h, q[1] - ny * h]);
    });
    const g = this.g;
    const trace = (r: P2[]) => { r.forEach(([x0, y0], i) => { const [x, y] = this.P(x0, y0); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath(); };
    g.beginPath(); trace(out); trace(inn.reverse());
    g.fillStyle = col; g.fill("evenodd");
  }
  /** flat strap with a thin ink rim (belts, cravat, rope, oar) */
  band(pts: P2[], fill: string, w: number, rim: number, cap: CanvasLineCap = "butt") {
    const g = this.g; g.lineCap = cap; g.lineJoin = "round";
    this.path(pts, false); g.strokeStyle = INK; g.lineWidth = w + 2 * rim; g.stroke();
    this.path(pts, false); g.strokeStyle = fill; g.lineWidth = w; g.stroke();
    g.lineCap = "round";
  }
  /** thin light sliver just inside the shadow-side edge (about half the reference torsos have one) */
  rimLight(pts: P2[], col: string, light: number, w: number, alpha = 0.55) {
    const g = this.g, dx = Math.cos(light) * w, dy = Math.sin(light) * w;
    this.clip(pts, () => {
      g.beginPath(); g.rect(-5000, -5000, 10000, 10000);
      pts.map(([x, y]) => this.P(x + dx, y + dy)).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath(); g.globalAlpha = alpha; g.fillStyle = col; g.fill("evenodd"); g.globalAlpha = 1;
    });
  }
}

const ellPts = (cx: number, cy: number, rx: number, ry: number, a0 = 0, a1 = 360, rot = 0, n = 48): P2[] => {
  const r = rad(rot), pts: P2[] = [];
  for (let i = 0; i <= n; i++) {
    const a = rad(a0 + ((a1 - a0) * i) / n), x = rx * Math.cos(a), y = ry * Math.sin(a);
    pts.push([cx + x * Math.cos(r) - y * Math.sin(r), cy + x * Math.sin(r) + y * Math.cos(r)]);
  }
  return pts;
};

const rrect = (x0: number, y0: number, x1: number, y1: number, r: number, n = 8): P2[] => {
  const pts: P2[] = [];
  for (const [cx, cy, a] of [[x1 - r, y0 + r, -90], [x1 - r, y1 - r, 0], [x0 + r, y1 - r, 90], [x0 + r, y0 + r, 180]])
    for (let i = 0; i <= n; i++) pts.push([cx + r * Math.cos(rad(a + (90 * i) / n)), cy + r * Math.sin(rad(a + (90 * i) / n))]);
  return pts;
};

/** tapered stroke, thick end at a: brows, moustache halves, hair strands */
const taper = (p: Pen, a: P2, b: P2, wa: number, wb: number, col = INK) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
  p.poly([[a[0] + nx * wa / 2, a[1] + ny * wa / 2], [b[0] + nx * wb / 2, b[1] + ny * wb / 2],
    [b[0] - nx * wb / 2, b[1] - ny * wb / 2], [a[0] - nx * wa / 2, a[1] - ny * wa / 2]], col, 0);
  p.dot(a[0], a[1], wa / 2, col); p.dot(b[0], b[1], wb / 2, col);
};

// ===================================================================================================================
// contours
// ===================================================================================================================
export type Blob = { a: number; b: number; nTop: number; nBot: number; egg: number; asym: number; rot: number; noise: number; seed: number };

/** superellipse "bean": separate crown / jaw exponents, egg taper (neg = narrower chin), one-side bulge, soft noise.
 *  Points run right -> down -> left -> up (clockwise on screen). */
export const blobPts = (cx: number, cy: number, B: Blob, n = 72): P2[] => {
  const ph = [rnd(B.seed, 11), rnd(B.seed, 12), rnd(B.seed, 13)].map((v) => v * Math.PI * 2);
  const pts: P2[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2, c = Math.cos(t), s = Math.sin(t), e = 2 / (s < 0 ? B.nTop : B.nBot);
    let X = Math.sign(c) * Math.abs(c) ** e;
    const Y = Math.sign(s) * Math.abs(s) ** e;
    X *= (1 + B.egg * Y) * (1 + B.asym * Math.sign(X));
    const r = 1 + B.noise * (Math.cos(2 * t + ph[0]) + 0.7 * Math.cos(3 * t + ph[1]) + 0.5 * Math.cos(4 * t + ph[2]));
    const x = B.a * X * r, y = B.b * Y * r;
    pts.push([cx + x * Math.cos(B.rot) - y * Math.sin(B.rot), cy + x * Math.sin(B.rot) + y * Math.cos(B.rot)]);
  }
  return pts;
};

/** measured head: H/W 0.94, slightly pointed crown (1.75), fuller jaw (2.3), chin taper -0.12, 8-10 % bulge to the face side */
export const headBlob = (seed: number, a = 118, facing = 0): Blob => ({
  a, b: a * (0.94 + 0.08 * (rnd(seed, 1) - 0.5)),
  nTop: 1.75 + 0.3 * (rnd(seed, 2) - 0.5), nBot: 2.3 + 0.3 * (rnd(seed, 3) - 0.5),
  egg: -0.12 + 0.06 * (rnd(seed, 4) - 0.5),
  asym: (0.06 + 0.04 * rnd(seed, 5)) * (facing || (rnd(seed, 6) < 0.5 ? -1 : 1)),
  rot: rad(8 * (rnd(seed, 7) - 0.5)), noise: 0.008, seed,
});

/** thickest outline direction: away from the light, pulled toward the ground (64 deg measured for upper-left light) */
export const thickAngle = (light: number) => Math.atan2(-Math.sin(light) + 0.8, -Math.cos(light));
const DEF_LIGHT = rad(-120);

// ===================================================================================================================
// the wardrobe
// ===================================================================================================================
export type Build = "adult" | "stout" | "old" | "pip" | "kid";
export type Hat = "cap" | "baker" | "straw" | "topper" | "bonnet" | "hair" | "veil" | "wreath" | "kerchief" | null;
export type Hair = "short" | "fringe" | "bun" | "bald" | "long";
export type Sleeves = "long" | "rolled" | "short";
/** what the arms are doing (a pose, not a prop — the prop is drawn with them) */
export type ArmMode = "hang" | "carry" | "open" | "up" | "rope" | "crossed" | "bouquet" | "oar" | "basket" | "wave" | "reach" | "point" | "lap";
export type Prop = "rope" | "oar" | "bouquet" | "basket" | "loaf" | null;

export type Outfit = {
  build?: Build;
  skin?: string;
  top: string;              // shirt / coat / blouse
  pants: string;
  boots?: string;           // INK (default) = ink foot strokes
  hat?: Hat;
  hatCol?: string;
  hair?: string;
  hairStyle?: Hair;
  belt?: string | null;
  buttons?: string;
  sash?: string;
  apron?: string;           // baker's and Pip's apron panel
  sleeves?: Sleeves;
  dress?: string;           // bell dress instead of a bean torso
  cravat?: string;
  moustache?: string;
  beard?: string;
  veil?: string;            // bride's veil (drawn behind the head + over the shoulders)
  wreath?: string;          // flower band over the crown
  prop?: Prop;
  collar?: string;
};

/** adults 3.5 head-heights (torso 1.10, legs 1.40 = 1.68 m at SU 0.00216); Pip is 3.3 HH (1.51 m), kids 2.9 HH */
export const BUILD: Record<Build, { a: number; torso: number; legs: number; tw: number }> = {
  adult: { a: 118, torso: 1.1, legs: 1.4, tw: 0.8 },
  stout: { a: 118, torso: 1.15, legs: 1.32, tw: 0.94 },
  old: { a: 118, torso: 1.16, legs: 1.26, tw: 0.86 },
  pip: { a: 112, torso: 1.02, legs: 1.3, tw: 0.74 },
  kid: { a: 110, torso: 0.88, legs: 1.05, tw: 0.72 },
};

// ---- our six named characters (colours are ours; nothing is traced from the reference) ----
/** Pip: slight, 12, straw hair under a small cap, flour-dusted apron over a blue shirt, rolled sleeves, too-big boots */
export const PIP: Outfit = {
  build: "pip", top: "#4a7fd0", pants: "#6d5a44", boots: "#5a3b28", hat: "cap", hatCol: "#7f6a52",
  hair: "#e8c877", hairStyle: "fringe", apron: "#f4eddc", belt: "#3a2f26", sleeves: "rolled", skin: SKINS[1],
};
/** the baker: heavyset, big moustache, white cap and apron */
export const BAKER: Outfit = {
  build: "stout", top: "#f6f1e4", pants: "#6d6a63", boots: "#3b3229", hat: "baker", hatCol: "#fdfaf2",
  moustache: "#8d8477", apron: "#fdfaf2", belt: "#8a6b46", prop: "loaf", skin: SKINS[1],
};
/** the bride: cream dress, veil, bouquet */
export const BRIDE: Outfit = {
  build: "adult", top: "#fdf6e6", pants: "#f2e6cf", dress: "#fdf6e6", veil: "#fbf7ec", wreath: "#e8b7c6",
  hair: "#6b4a30", hairStyle: "bun", prop: "bouquet", skin: SKINS[0],
};
/** the groom: dark suit, cravat */
export const GROOM: Outfit = {
  build: "adult", top: "#3a4055", pants: "#2f3547", boots: INK, hat: "topper", hatCol: "#2e2a36",
  cravat: "#f6f1e6", hair: "#3b2a20", hairStyle: "short", buttons: "#d9dde0", skin: SKINS[2],
};
/** the bell-ringer: old, hunched, pulling the rope in the belfry */
export const RINGER: Outfit = {
  build: "old", top: "#7a6a56", pants: "#5a5148", boots: INK, hair: "#e9e6df", hairStyle: "short",
  moustache: "#e9e6df", beard: "#e9e6df", belt: "#4a3a28", prop: "rope", skin: SKINS[1],
};
/** the boatman: straw hat, oar, standing in his boat */
export const BOATMAN: Outfit = {
  build: "adult", top: "#e6dcc6", pants: "#3f4a5a", boots: INK, hat: "straw", hatCol: "#d9b877",
  belt: "#6b4a2a", sash: "#8a4a4a", prop: "oar", sleeves: "rolled", skin: SKINS[3],
};

// ---- crowd generators: deterministic; 8 shoppers + kids for the market, 8 Sunday-best guests in the church square ----
const COATS = ["#3f6fb5", "#8c3b4a", "#5d7a3a", "#b5653f", "#2f5f6a", "#7b5ac9", "#c9773a", "#4a6b8a"];
const SKIRTS = ["#d9a441", "#c25a7a", "#5a8fc2", "#8a9a5b"];
const SUNDAY = ["#2f4a7a", "#7a3b4a", "#3f6b52", "#6b5a8a", "#8a6a3a", "#39536b", "#8a4a58", "#4a5a7a"];
const HEADS: Hat[] = ["topper", "bonnet", "straw", "cap", "kerchief", "hair"];

export type Folk = { o: Outfit; arms: ArmMode; kid: boolean; seed: number };

const folk = (o: Outfit, arms: ArmMode, seed: number, kid = false): Folk => ({ o, arms, kid, seed });

/** market shoppers: baskets, bonnets, a couple of kids; every variant has its own silhouette */
export const marketFolk = (v: number): Folk => {
  const skin = SKINS[v % 4], kid = v % 7 === 5, woman = v % 2 === 1;
  const coat = COATS[v % 8], hat = HEADS[v % 6];
  const o: Outfit = kid
    ? { build: "kid", top: COATS[(v + 3) % 8], pants: "#3b5b9a", boots: "#f4f1ea", hat: v % 2 ? "cap" : null, hatCol: "#e2453c", hair: "#4a3426", hairStyle: "fringe", skin }
    : woman
      ? { build: v % 4 === 1 ? "stout" : "adult", top: coat, pants: "#3b3f52", boots: "#4a3426", hat, hatCol: "#e9cf8f",
        dress: v % 3 === 0 ? SKIRTS[v % 4] : undefined, hair: "#5a3b2a", hairStyle: "bun", prop: v % 5 === 3 ? "basket" : null, skin }
      : { build: "adult", top: coat, pants: "#3b3f52", boots: "#4a3426", hat, hatCol: "#2e2a36", hair: "#4a3426",
        hairStyle: v % 3 === 0 ? "bald" : "short", belt: "#3a2f26", prop: v % 6 === 4 ? "basket" : null, skin };
  const arms: ArmMode = o.prop === "basket" ? "basket" : v % 6 === 1 ? "point" : "hang";
  return folk(o, arms, 40 + v, kid);
};

/** church guests in Sunday best, from shot 6 on */
export const churchGuest = (v: number): Folk => {
  const skin = SKINS[(v + 1) % 4], kid = v % 6 === 4, woman = v % 2 === 0;
  const coat = SUNDAY[v % 8];
  const o: Outfit = kid
    ? { build: "kid", top: SUNDAY[(v + 2) % 8], pants: "#3b3f52", boots: "#3b3229", hair: "#4a3426", hairStyle: "fringe", prop: "bouquet", skin }
    : woman
      ? { build: "adult", top: coat, pants: "#3b3f52", boots: "#4a3426", hat: v % 3 === 0 ? "topper" : "bonnet", hatCol: "#e9cf8f",
        dress: v % 2 === 0 ? SKIRTS[(v + 2) % 4] : undefined, hair: "#5a3b2a", hairStyle: "bun", prop: v % 4 === 1 ? "bouquet" : null, skin }
      : { build: v % 4 === 3 ? "stout" : "adult", top: coat, pants: "#333a4a", boots: INK, hat: "topper", hatCol: "#2e2a36",
        cravat: "#f6f1e6", hair: "#4a3426", hairStyle: "short", buttons: "#d9dde0", skin };
  return folk(o, o.prop === "bouquet" ? "bouquet" : "hang", 70 + v, kid);
};

// ===================================================================================================================
// hats and hair
// ===================================================================================================================
const BONNET = "#e9cf8f", BONNET_BRIM = "#d6b46a";
/** parts that sit BEHIND the head: the veil drape, the bonnet blob, a bun, a kerchief back */
const hatBehind = (p: Pen, o: Outfit, H: Blob, cx: number, hc: number, light: number, thick: number, ow: number) => {
  const W = 2 * H.a, HH = 2 * H.b;
  if (o.veil) {
    const vb = blobPts(cx, hc + 0.42 * HH, { ...H, a: H.a * 1.22, b: H.b * 1.92, asym: 0.02, egg: 0.3, rot: 0, noise: 0.007, seed: H.seed + 5 });
    p.gradFill(vb, o.veil, mul(o.veil, SH_CLOTH), light, 0.3);
    p.inkRing(vb, ow * 0.85, thick);
    p.stroke([[cx - 0.72 * H.a, hc + 0.5 * HH], [cx - 1.05 * H.a, hc + 1.55 * HH], [cx - 1.12 * H.a, hc + 2.2 * HH]], 3 * (W / 100));
    p.stroke([[cx + 0.72 * H.a, hc + 0.5 * HH], [cx + 1.05 * H.a, hc + 1.55 * HH], [cx + 1.12 * H.a, hc + 2.2 * HH]], 3 * (W / 100));
    return;
  }
  if (o.hat === "bonnet") {
    const bb = blobPts(cx, hc - 0.07 * HH, { ...H, a: H.a * 1.17, b: H.b * 1.13, asym: 0, egg: 0.04, seed: H.seed + 3 });
    p.shadedFill(bb, BONNET, mul(BONNET, SH_CLOTH), light, H.a * 1.17);
    p.inkRing(bb, ow * 0.85, thick);
    return;
  }
  if (o.hat === "kerchief") {
    const kb = blobPts(cx, hc - 0.04 * HH, { ...H, a: H.a * 1.1, b: H.b * 1.08, asym: 0, egg: 0.06, seed: H.seed + 3 });
    p.shadedFill(kb, o.hatCol ?? "#d9a441", mul(o.hatCol ?? "#d9a441", SH_CLOTH), light, H.a * 1.1);
    p.inkRing(kb, ow * 0.85, thick);
    return;
  }
  if (o.hairStyle === "bun" && o.hair) {
    p.ell(cx - 0.86 * H.a, hc - 0.5 * H.b, 0.4 * H.a, 0.34 * H.b, o.hair, ow * 0.6);
  }
  if (o.hairStyle === "long" && o.hair) {
    const lb = blobPts(cx, hc + 0.3 * HH, { ...H, a: H.a * 1.14, b: H.b * 1.3, asym: 0.03, egg: 0.2, seed: H.seed + 6 });
    p.shadedFill(lb, o.hair, mul(o.hair, SH_CLOTH), light, H.a);
    p.inkRing(lb, ow * 0.8, thick);
  }
};
const hatOn = (p: Pen, o: Outfit, hp: P2[], H: Blob, cx: number, hc: number, light: number, seed: number, facing: number, side: boolean) => {
  const W = 2 * H.a, HH = 2 * H.b, u = W / 100, crown = hc - H.b, ow = 0.85 * 5 * u;
  const a = H.rot + rad(4 * (rnd(seed, 20) - 0.5)); // tilt with the head, +-2 deg extra
  const R = (pts: P2[]) => rotPts(pts, a, cx, hc);
  const deg = (a * 180) / Math.PI;
  /** shallow arc that follows the skull, sagging 3u in the middle (hat bases) */
  const sag = (yb: number, wb: number): P2[] => {
    const base: P2[] = [];
    for (let i = 0; i <= 12; i++) { const t = i / 12; base.push([cx + wb * (2 * t - 1), yb + 3 * u * (1 - (2 * t - 1) ** 2)]); }
    return base;
  };
  /** the head's own crown above `cut`, pushed out 3 %, optionally with a scalloped lower edge */
  const domeOf = (cut: number, scallop: boolean): P2[] | null => {
    const keep = (x: number, y: number) => y < cut;
    const n = hp.length;
    const startIdx = Math.max(0, hp.findIndex(([x, y], i) => keep(x, y) && !keep(hp[(i + n - 1) % n][0], hp[(i + n - 1) % n][1])));
    const arc = [...hp.slice(startIdx), ...hp.slice(0, startIdx)].filter(([x, y]) => keep(x, y))
      .map(([x, y]) => [cx + (x - cx) * 1.03, hc + (y - hc) * 1.03] as P2);
    if (arc.length < 3) return null;
    if (scallop) {
      const [x0, y0] = arc[arc.length - 1], [x1, y1] = arc[0];
      for (let i = 1; i < 6; i++) arc.push([x0 + ((x1 - x0) * i) / 6, y0 + ((y1 - y0) * i) / 6 + (i % 2 ? 4 * u : 0)]);
    }
    return arc;
  };
  const col = o.hatCol ?? "#7f6a52";
  if (o.hat === "cap") {
    const cut = crown + 0.3 * HH, dome = domeOf(cut, false);
    if (dome) {
      p.shadedFill(dome, col, mul(col, SH_FELT), light, H.a, 0.35);
      p.poly(dome, null, ow);
      // a short front peak, nudged to the facing side
      const s = facing || (side ? 1 : rnd(seed, 21) < 0.5 ? -1 : 1);
      if (side) p.poly(R([[cx + 40 * u, cut - 2 * u], [cx + 74 * u, cut + 4 * u], [cx + 40 * u, cut + 6 * u]]), shade(col, 0.8), ow);
      else {
        const [px, py] = R([[cx + s * 4 * u, cut + 1.5 * u]])[0];
        p.ell(px, py, 32 * u, 0.06 * HH, shade(col, 0.8), ow, 0, 180, deg);
      }
    }
  } else if (o.hat === "baker") {
    const yb = crown + 0.18 * HH, wb = 0.62 * H.a;
    const band = R([...sag(yb, wb), [cx + wb * 0.92, yb - 0.2 * HH], [cx - wb * 0.92, yb - 0.2 * HH]]);
    p.shadedFill(band, shade(col, 0.94), mul(col, SH_FELT), light, wb, 0.4);
    p.poly(band, null, ow);
    const puffs: [number, number, number][] = [[-0.62, -0.34, 0.42], [0.6, -0.3, 0.4], [-0.2, -0.6, 0.5], [0.28, -0.66, 0.46]];
    for (const [dx, dy, r] of puffs) {
      const [px, py] = R([[cx + dx * H.a, yb + dy * HH]])[0];
      p.ell(px, py, r * H.a, r * H.b, col, ow);
    }
  } else if (o.hat === "straw") {
    const yb = crown + 0.26 * HH;
    const cw = 0.62 * H.a, ht = 0.42 * HH;
    const body = R([...sag(yb, cw).reverse(), [cx - cw * 0.86, yb - ht], [cx + cw * 0.86, yb - ht]]);
    p.shadedFill(body, o.hatCol ?? "#d9b877", mul(o.hatCol ?? "#d9b877", SH_CLOTH), light, cw, 0.4);
    p.poly(body, null, ow);
    const [bx, by] = R([[cx, yb + 2 * u]])[0];
    p.ell(bx, by, 0.72 * H.a, 0.11 * HH, o.hatCol ?? "#d9b877", ow, 0, 360, deg);
    p.ell(bx, by, 0.72 * H.a, 0.11 * HH, null, ow * 0.9, 0, 360, deg);
    p.clip(ellPts(bx, by, 0.72 * H.a, 0.11 * HH, 0, 360, deg), () => p.band(R([[cx - 0.7 * H.a, yb - 1 * u], [cx + 0.7 * H.a, yb + 3 * u]]), "#8a5a2a", 2.2 * u, 0.7 * u));
  } else if (o.hat === "topper") {
    const yb = crown + 0.22 * HH, ht = 0.8 * HH, wb = 0.31 * W, wt = 0.33 * W;
    const body = R([...sag(yb, wb).reverse(), [cx - wt, yb - ht], [cx + wt, yb - ht]]);
    p.shadedFill(body, col, mul(col, SH_FELT), light, wt, 0.4);
    p.clip(body, () => p.band(R([[cx - wt - 4 * u, yb - 0.13 * HH], [cx + wt + 4 * u, yb - 0.13 * HH]]), shade(o.top, 0.9), 0.14 * HH, 0.8 * u));
    p.poly(body, null, ow);
    const [bx, by] = R([[cx, yb + 1 * u]])[0];
    p.ell(bx, by, 0.45 * W, 0.05 * HH, "#1d1b22", ow, 0, 360, deg);
  } else if (o.hat === "bonnet") {
    const [bx, by] = R([[cx + (side ? 6 * u : 0), crown + 0.16 * HH]])[0];
    p.arc(bx, by, 0.5 * W, 0.2 * HH, 200, 340, 7 * u, BONNET_BRIM);
    p.arc(bx, by, 0.5 * W + 3.5 * u, 0.2 * HH + 3.5 * u, 200, 340, 1.2 * u);
    const cy = hc + H.b * 0.98;
    p.stroke([[cx - 14 * u, cy - 4 * u], [cx, cy + 2 * u], [cx + 14 * u, cy - 4 * u]], 2 * u, BONNET_BRIM);
  } else if (o.hat === "kerchief") {
    const [kx, ky] = R([[cx, crown + 0.14 * HH]])[0];
    p.poly(R([[cx - 0.42 * W, crown + 0.2 * HH], [cx + 0.42 * W, crown + 0.2 * HH], [kx, ky - 0.1 * HH]]), o.hatCol ?? "#d9a441", ow);
    p.stroke([[cx - 12 * u, hc + H.b * 0.9], [cx, hc + H.b * 1.06], [cx + 12 * u, hc + H.b * 0.9]], 3 * u, o.hatCol ?? "#d9a441");
  } else if (o.hat === "wreath") {
    const cw = o.wreath ?? "#e8b7c6";
    for (let i = 0; i < 7; i++) {
      const t = -1 + (2 * i) / 6, [px, py] = R([[cx + t * 0.78 * H.a, crown + 0.2 * HH - 0.1 * HH * (1 - t * t)]])[0];
      p.ell(px, py, 0.11 * H.a, 0.1 * H.b, i % 2 ? cw : shade(cw, 0.88), 2.5 * u);
    }
    for (const t of [-0.55, 0, 0.55]) { const [px, py] = R([[cx + t * 0.78 * H.a, crown + 0.11 * HH]])[0]; p.ell(px, py, 0.07 * H.a, 0.05 * H.b, "#6f8f4a", 2 * u); }
  } else if (o.hat === "hair" || (!o.hat && o.hair)) {
    if (!o.hair) return;
    const cut = crown + 0.42 * HH, dome = domeOf(cut, true);
    if (!dome) return;
    p.shadedFill(dome, o.hair, mul(o.hair, SH_FELT), light, H.a, 0.35);
    p.poly(dome, null, ow);
    const s = side ? -1 : facing || 1;
    p.stroke([[cx + s * 10 * u, cut - 30 * u], [cx + s * 2 * u, cut - 12 * u]], 1.2 * u);
  }
  // straw strands of hair sticking out under a brimmed cap (Pip)
  if (o.hat === "cap" && o.hair) {
    const cut = crown + 0.3 * HH;
    for (const t of [-0.85, -0.5, -0.15, 0.2, 0.55, 0.9]) {
      const [bxp, byp] = R([[cx + t * 0.72 * H.a, cut + 2 * u]])[0];
      const dir = t * 0.8 + 0.35 * (facing || 1);
      p.stroke([[bxp, byp], [bxp + dir * 13 * u, byp + 16 * u + 6 * u * (rnd(seed, 30 + t * 7) - 0.5)]], 3.4 * u, o.hair);
    }
  }
};

// ===================================================================================================================
// faces (the table is above, with the hats, so the wardrobe reads in one block)
// ===================================================================================================================
export type Expr = "neutral" | "stern" | "grin" | "laugh" | "whistle" | "nervous" | "shock" | "relief" | "relief_open" | "dazed"
  | "pained" | "smile" | "smile_closed" | "lick" | "beam" | "awe";
type EyeK = "dot" | "small" | "lid" | "slit" | "happy" | "dash" | "squeeze" | "shock" | "shockHalf" | "spiral";
type MouthK = "dash" | "frown" | "smirk" | "smile" | "smileWide" | "grin" | "laugh" | "o" | "O" | "wave" | "teeth" | "lick";
export const EXPRS: Expr[] = ["neutral", "stern", "grin", "laugh", "whistle", "nervous", "shock", "relief", "relief_open", "dazed",
  "pained", "smile", "smile_closed", "lick", "beam", "awe"];
/** eyes [back, front], brows [inner, outer] offsets in u (+ = down), mouth kind — characters.md 2.5 */
const FACE: Record<Expr, { eye: [EyeK, EyeK]; brow: [number, number]; mouth: MouthK }> = {
  neutral: { eye: ["lid", "lid"], brow: [0, -1], mouth: "dash" },
  stern: { eye: ["lid", "lid"], brow: [3, -2], mouth: "frown" },
  grin: { eye: ["happy", "happy"], brow: [-3, -3], mouth: "grin" },
  laugh: { eye: ["squeeze", "squeeze"], brow: [-4, -4], mouth: "laugh" },
  whistle: { eye: ["dash", "dash"], brow: [-2, -4], mouth: "o" },
  nervous: { eye: ["small", "small"], brow: [-3, 2], mouth: "wave" },
  shock: { eye: ["shock", "shock"], brow: [-7, -6], mouth: "O" },
  relief: { eye: ["happy", "happy"], brow: [-2, 1], mouth: "smileWide" },
  relief_open: { eye: ["happy", "happy"], brow: [-2, 1], mouth: "grin" },
  dazed: { eye: ["spiral", "spiral"], brow: [-3, 2], mouth: "wave" },
  pained: { eye: ["squeeze", "lid"], brow: [-3, 2], mouth: "teeth" },
  smile: { eye: ["dot", "dot"], brow: [0, -1], mouth: "smirk" },
  smile_closed: { eye: ["happy", "happy"], brow: [0, -1], mouth: "smile" },
  lick: { eye: ["dot", "dot"], brow: [0, -1], mouth: "lick" },
  beam: { eye: ["happy", "happy"], brow: [-4, -4], mouth: "grin" },
  awe: { eye: ["dot", "dot"], brow: [-6, -6], mouth: "O" },
};
const halfLid = (k: EyeK): EyeK => (k === "dot" || k === "small" ? "lid" : k === "lid" ? "slit" : k === "shock" ? "shockHalf" : k);
const eyeKind = (k: EyeK, lid: number): EyeK =>
  lid >= 1 && k !== "happy" && k !== "squeeze" && k !== "spiral" ? "dash" : lid > 0 ? halfLid(k) : k;
const lidOf = (b: boolean | number | undefined) => (b === true ? 1 : Number(b) || 0);

const eye = (p: Pen, kind: EyeK, x: number, ey: number, u: number, side: number, look: number, skin: string) => {
  const lx = x + look * 3 * u, lw = 3.8 * u;
  switch (kind) {
    case "dot": p.ell(lx, ey, 3.8 * u, 5.5 * u, INK, 0); break;
    case "small": p.ell(lx, ey, 3 * u, 4.4 * u, INK, 0); break;
    case "lid": p.ell(lx, ey - u, 7 * u, 6 * u, INK, 0, 0, 180); p.stroke([[x - 9 * u, ey - u], [x + 9 * u, ey - u]], lw); break;
    case "slit": p.ell(lx, ey, 7 * u, 2.6 * u, INK, 0, 0, 180); p.stroke([[x - 9 * u, ey], [x + 9 * u, ey]], lw); break;
    case "happy": p.arc(x, ey + 3 * u, 8 * u, 6 * u, 200, 340, lw); break;
    case "dash": p.stroke([[x - 8.5 * u, ey], [x + 8.5 * u, ey]], lw); break;
    case "squeeze": p.stroke([[x + 6 * u * side, ey - 5 * u], [x - 6 * u * side, ey], [x + 6 * u * side, ey + 5 * u]], lw); break;
    case "shock": case "shockHalf":
      p.ell(x, ey, 11 * u, 11 * u, WHITE, 2.6 * u); p.dot(lx - side * 1.5 * u, ey + 1.5 * u, 3 * u);
      if (kind === "shockHalf") { p.ell(x, ey, 11 * u, 11 * u, skin, 0, 180, 360); p.stroke([[x - 11 * u, ey], [x + 11 * u, ey]], 2.6 * u); }
      break;
    default: {
      const s: P2[] = [];
      for (let t = 1; t < 15; t++) s.push([x + Math.cos(t * 0.9) * t * 0.55 * u, ey + Math.sin(t * 0.9) * t * 0.55 * u]);
      p.stroke(s, 2.4 * u);
    }
  }
};

/** open "D" mouth with a white teeth band (+ tongue) */
const dmouth = (p: Pen, mx: number, y: number, rx: number, ry: number, u: number, tongue = false) => {
  p.ell(mx, y, rx, ry, MOUTH, 0, 0, 180);
  p.clip([[mx - rx, y], [mx + rx, y], [mx + rx, y + 3 * u], [mx - rx, y + 3 * u]], () => p.ell(mx, y, rx, ry, TEETH, 0, 0, 180));
  if (tongue) p.ell(mx + 2 * u, y + 0.62 * ry, 0.4 * rx, 0.28 * ry, TONGUE, 0);
  p.ell(mx, y, rx, ry, null, 3 * u, 0, 180);
};

const mouth = (p: Pen, kind: MouthK, mx: number, my: number, u: number, k = 1) => {
  const mw = 4 * u;
  switch (kind) {
    case "dash": p.stroke([[mx - 5.5 * u * k, my], [mx + 5.5 * u * k, my - 0.8 * u]], mw); break;
    case "frown": p.arc(mx, my + 3 * u, 6.5 * u * k, 3.5 * u, 200, 340, mw); break;
    case "smirk": p.arc(mx + u, my - 3 * u, 7 * u * k, 4 * u, 10, 150, mw); break;
    case "smile": p.arc(mx, my - 3 * u, 8 * u * k, 4.5 * u, 20, 160, mw); break;
    case "smileWide": p.arc(mx, my - 4 * u, 11 * u * k, 6 * u, 15, 165, mw); break;
    case "grin": dmouth(p, mx, my - u, 12 * u * k, 8 * u, u); break;
    case "laugh": dmouth(p, mx, my, 16 * u * k, 11 * u, u, true); break;
    case "o": p.ell(mx + 4 * u, my, 3.5 * u, 4 * u, MOUTH, 2.8 * u); break;
    case "O": p.ell(mx, my + 2 * u, 9 * u * k, 11 * u, MOUTH, 3.2 * u); break;
    case "wave": { const s: P2[] = []; for (let i = 0; i <= 12; i++) s.push([mx - 9 * u * k + i * 1.5 * u * k, my + 1.5 * u * Math.sin(i * 1.3)]); p.stroke(s, 3 * u); break; }
    case "teeth":
      p.poly([[mx - 12 * u * k, my - 4 * u], [mx + 12 * u * k, my - 4 * u], [mx + 11 * u * k, my + 4 * u], [mx - 11 * u * k, my + 4 * u]], TEETH, 3 * u);
      for (const j of [-1, 0, 1]) p.stroke([[mx + j * 6 * u * k, my - 4 * u], [mx + j * 6 * u * k, my + 4 * u]], 1.5 * u);
      break;
    case "lick": p.arc(mx, my - 3 * u, 8 * u * k, 4.5 * u, 20, 160, mw); p.ell(mx + 6 * u * k, my + 3 * u, 3.6 * u, 4.6 * u, TONGUE, 2.4 * u); break;
  }
};

export type FaceX = { moustache?: string; beard?: string; stout?: boolean; up?: number };
/** face v2 (front / 3-4). u = 1 % of the head path width W. Eyes 26u apart on the centre line, brows 20u up, mouth 20u
 *  down, everything slid toward the facing side. `up` (0..1) lifts the whole face for "looking up at the bell".
 *  No blush, no catchlights. */
const faceFront = (p: Pen, cx: number, cy: number, W: number, expr: Expr, facing: number, look: number, lid: number, brim: boolean,
  skin: string, x: FaceX = {}) => {
  const u = W / 100, F = FACE[expr], fx = cx + 7 * u * facing, up = clamp01(x.up ?? 0);
  const ex = (F.eye[0] === "shock" ? 12 : 13) * u, ey = cy - up * 5 * u;
  for (const side of [-1, 1]) {
    const x2 = fx + side * ex;
    const kind = eyeKind(F.eye[(facing ? side === facing : side > 0) ? 1 : 0], lid);
    eye(p, kind, x2, ey, u, side, look, skin);
    const [dI, dO] = F.brow, by = ey - ((brim ? 17 : 20) + up * 6) * u;
    if (kind === "shock" || kind === "shockHalf") p.arc(x2, by - 6 * u, 9 * u, 3 * u, 200, 340, 4 * u);
    else taper(p, [x2 - side * 8.5 * u, by + dI * u], [x2 + side * 8.5 * u, by + dO * u], 5 * u, 2.5 * u);
  }
  const mx = cx + 8 * u * facing, my = cy + 20 * u - up * 3 * u;
  mouth(p, F.mouth, mx, my, u);
  if (x.moustache) for (const s of [-1, 1])
    taper(p, [mx + s * 1.5 * u, cy + 12.5 * u], [mx + s * (x.stout ? 19 : 15) * u, cy + (x.stout ? 10.5 : 15) * u], x.stout ? 5.5 * u : 4.5 * u, 1.6 * u, x.moustache);
  if (expr === "nervous") p.ell(cx + 40 * u * (facing || 1), cy - 22 * u, 3 * u, 5 * u, "#9fd4ff", 2 * u);
};

/** profile face (facing screen-right): one eye, brow, nose tick, small mouth near the front edge; no skin bump, no ear */
const faceSide = (p: Pen, hx: number, hy: number, W: number, expr: Expr, lid: number, brim: boolean, skin: string, x: FaceX = {}) => {
  const u = W / 100, F = FACE[expr], ex = hx + 27 * u, ey = hy - clamp01(x.up ?? 0) * 5 * u;
  const kind = eyeKind(F.eye[1], lid);
  eye(p, kind, ex, ey, u, 1, 0.6, skin);
  const by = ey - (brim ? 17 : 20) * u, [dI, dO] = F.brow;
  if (kind === "shock" || kind === "shockHalf") p.arc(ex, by - 6 * u, 9 * u, 3 * u, 200, 340, 4 * u);
  else taper(p, [ex + 8 * u, by + dI * u], [ex - 7 * u, by - u + dO * u], 5 * u, 2.5 * u);
  p.stroke([[hx + 44 * u, hy + 4 * u], [hx + 47.5 * u, hy + 9 * u], [hx + 43 * u, hy + 10 * u]], 3 * u);
  mouth(p, F.mouth, hx + 33 * u, hy + 21 * u, u, 0.62);
  if (x.moustache) taper(p, [hx + 41 * u, hy + 13.5 * u], [hx + 25 * u, hy + (x.stout ? 11.5 : 16) * u], x.stout ? 5.5 * u : 4.5 * u, 1.6 * u, x.moustache);
  if (expr === "nervous") p.ell(hx - 30 * u, hy - 24 * u, 3 * u, 5 * u, "#9fd4ff", 2 * u);
};

// ===================================================================================================================
// bodies
// ===================================================================================================================
export type Gait = "walk" | "run" | "stand" | "crouch" | "sit";
export type FrontOpts = {
  /** 0..1 through one gait cycle (a footfall at 0 and 0.5) */
  phase?: number;
  expr?: Expr;
  mode?: Gait;
  arms?: ArmMode;
  /** -1 / +1: which way the character is looking (slides the features, bulges the jaw) */
  look?: number;
  /** 0..1: lift the whole face for "looking up at the bell" */
  up?: number;
  blink?: boolean | number;
  /** foot lift in design units (60 = walk, 110 = run) */
  lift?: number;
  /** in-canvas-body roll (deg): the sideways lean of a stroll, the weight shift of a run */
  tilt?: number;
  headTilt?: number;
  /** 0..20: hunch forward (the old bell-ringer). 0 for everyone else */
  lean?: number;
  /** 0..1: how far into a squat the crouch is (ducking the cart axle) */
  squat?: number;
  /** 0..1: how far the rope is pulled down (the bell-ringer), or the wave phase for `arms: "wave"` */
  pull?: number;
  sway?: number;
  /** canvas angle the key light comes FROM (painted crescent + thick outline side) */
  light?: number;
  facing?: -1 | 0 | 1;
  seed?: number;
};
export type SideOpts = {
  phase?: number; expr?: Expr; mode?: Gait; arms?: ArmMode; stride?: number; blink?: boolean | number;
  light?: number; seed?: number; lean?: number; pull?: number; lift?: number; squat?: number;
};

const footStroke = (p: Pen, a: P2, b: P2, w: number, col: string) => {
  if (col !== INK) p.stroke([a, b], w + 3, INK);
  p.stroke([a, b], w, col);
};
type Limb = { pts: [P2, P2, P2]; front: boolean; short: boolean };

/** front view: legs -> arms behind -> torso (+clothing, apron, belt, cravat) -> head (+hair, hat, beard, face) -> props */
export const bodyFront = (p: Pen, o: Outfit, opts: FrontOpts = {}) => {
  const { phase = 0, expr = "neutral", mode = "walk", arms = "hang", look = 0, up = 0, blink = 0, lift = 64, tilt = 0,
    headTilt = 0, lean = 0, squat = 0, pull = 0, sway = 1, light = DEF_LIGHT, facing = 0, seed = 1 } = opts;
  const Bd = BUILD[o.build ?? "adult"], skin = o.skin ?? SKIN, two = Math.PI * 2, lid = lidOf(blink);
  const H = headBlob(seed, Bd.a, facing), W = 2 * H.a, HH = 2 * H.b, u = W / 100;
  const sole = 975, sq = mode === "crouch" ? clamp01(squat || 1) : 0, hunch = clamp01(lean / 20);
  const tall = (1 + Bd.torso + Bd.legs) * HH;
  const bob = mode === "walk" || mode === "run" ? (mode === "run" ? 0.03 : 0.022) * tall * Math.cos(2 * two * phase) : 0;
  const hipY = mode === "sit" ? sole - 0.24 * HH : sole - Bd.legs * HH * (1 - 0.52 * sq) + bob;
  const torsoBot = hipY + 0.12 * HH * (1 + 0.15 * sq);
  const chin = torsoBot - Bd.torso * HH * (1 - 0.06 * sq) + 0.05 * HH * hunch;
  const hc = chin - H.b, crown = hc - H.b;
  const thick = thickAngle(light), ow = 5 * u;
  const legCol = mix(o.pants, INK, 0.55), armCol = mix(o.top, INK, 0.5), footCol = o.boots ?? INK;
  // ---- legs ----
  p.rot = null;
  if (mode === "sit") {
    for (const side of [-1, 1]) {
      const h: P2 = [300 + side * 15 * u, hipY], k: P2 = [300 + side * 36 * u, hipY + 0.2 * HH], f: P2 = [300 + side * 44 * u, sole - 8 * u];
      p.stroke(curve(h, k, f), 5.8 * u, legCol);
      footStroke(p, [f[0] - side * 2 * u, f[1]], [f[0] + side * 12 * u, f[1] - 5 * u], 7.5 * u, footCol);
    }
  } else if (sq > 0.05) {                                   // deep squash: knees out, feet planted wide
    for (const side of [-1, 1]) {
      const h: P2 = [300 + side * 17 * u, hipY];
      const k: P2 = [300 + side * (32 * u + 26 * u * sq), hipY + 0.3 * HH * (1 - 0.25 * sq)];
      const f: P2 = [300 + side * (26 * u + 8 * u * sq), sole - 4 * u];
      p.stroke(curve(h, k, f), 5.8 * u, legCol);
      footStroke(p, [f[0] - side * 4 * u, f[1]], [f[0] + side * 13 * u, f[1] + 0.5 * u], 7.5 * u, footCol);
    }
  } else {
    const L = (mode === "run" ? 1.8 : 1) * lift;
    for (const [side, ph] of [[-1, 0], [1, 0.5]] as const) {
      const up2 = Math.max(0, Math.sin(two * (phase + ph))) * L;
      const hx = 300 + side * 15 * u, fx = 300 + side * 22 * u, fy = sole - 4 * u - up2;
      const k: P2 = [(hx + fx) / 2 + side * (1.5 * u + up2 * 0.16), (hipY + fy) / 2 - up2 * 0.08];
      p.stroke(curve([hx, hipY], k, [fx, fy]), 5.8 * u, legCol);
      footStroke(p, [fx - side * 4 * u, fy], [fx + side * (o.build === "pip" || o.build === "kid" ? 17 : 13) * u, fy + 0.5 * u], 7.5 * u, footCol);
    }
  }
  // ---- upper body: rolls about the hips (the reference leans 3-8 deg and shifts with the step) ----
  const swing = mode === "walk" || mode === "run" ? sway * Math.sin(two * phase) * (mode === "run" ? 1.5 : 1) : 0;
  const A = tilt + swing;
  p.rot = A ? [rad(A), 300, hipY] : null;
  const T: Blob = { a: ((Bd.tw / 2) * W) / 1.06, b: 0.5 * (torsoBot - (chin - 0.25 * HH)), nTop: 2.2, nBot: 2.6,
    egg: o.build === "stout" ? 0.17 : 0.12, asym: 0.04 * facing, rot: 0, noise: 0.006, seed: seed + 7 };
  const tcx = 300 + 3 * u * facing, tcy = torsoBot - T.b, tp = blobPts(tcx, tcy, T);
  const sh = (side: number): P2 => [tcx + side * 0.85 * T.a, chin + 0.12 * HH];
  const outX = (side: number, k: number) => tcx + side * (k * T.a + 4 * u);
  const handAt = (side: number, k: number, yy: number): P2 => [tcx + side * k * T.a, yy];
  /** one arm: shoulder -> elbow -> hand, in design units */
  const limb = (side: number, kind: ArmMode, front: boolean): Limb => {
    const S = sh(side), E = (k: number, yy: number): P2 => [outX(side, k), yy];
    const mk = (e: P2, h: P2): Limb => ({ pts: [S, e, h], front, short: o.sleeves === "short" });
    switch (kind) {
      case "carry": return mk(E(1.02, chin + 0.5 * HH), handAt(side, 0.62, chin + 0.08 * HH));
      case "crossed": return mk(E(0.95, chin + 0.34 * HH), handAt(-side, 0.5, chin + 0.46 * HH));
      case "bouquet": return mk(E(0.82, chin + 0.44 * HH), handAt(side, 0.2, chin + 0.56 * HH));
      case "lap": return mk(E(1.05, chin + 0.7 * HH), handAt(side, 0.35, chin + 0.95 * HH));
      case "rope": return mk(E(0.95, chin + 0.3 * HH + pull * 0.3 * HH), handAt(side, 0.26, chin - 0.2 * HH + pull * 0.62 * HH));
      case "oar": return side > 0
        ? mk(E(1.05, chin + 0.3 * HH), handAt(1, 0.8, chin + 0.02 * HH))
        : mk(E(1.0, chin + 0.46 * HH), handAt(1, 0.2, chin + 0.34 * HH));
      case "basket": return side > 0
        ? mk(E(0.92, chin + 0.5 * HH), handAt(1, 0.72, chin + 0.8 * HH))
        : mk(E(1.12, chin + 0.48 * HH), handAt(side, 1.02, chin + 0.92 * HH));
      case "open": return mk(E(1.16, chin + 0.42 * HH), handAt(side, 1.5, chin + 0.52 * HH));
      case "up": return mk(E(1.06, chin - 0.1 * HH), handAt(side, 0.85, chin - 0.66 * HH));
      case "wave": return side > 0
        ? mk(E(1.1, chin - 0.05 * HH), [outX(1, 1.3) + 9 * u * Math.sin(phase * two), chin - 0.55 * HH])
        : mk(E(1.12, chin + 0.48 * HH), handAt(side, 1.02, chin + 0.92 * HH));
      case "reach": return side > 0
        ? mk(E(1.12, chin + 0.34 * HH), [outX(1, 1.4), chin + 0.16 * HH])
        : mk(E(1.12, chin + 0.48 * HH), handAt(side, 1.02, chin + 0.92 * HH));
      case "point": return side > 0
        ? mk(E(1.1, chin + 0.25 * HH), [outX(1, 1.45), chin - 0.05 * HH])
        : mk(E(1.12, chin + 0.48 * HH), handAt(side, 1.02, chin + 0.92 * HH));
      default: return mk(E(1.12, S[1] + 0.48 * HH), [outX(side, 1.12) + side * 3 * u + swing * 14 * u, chin + 0.92 * HH - Math.abs(swing) * 8 * u]);
    }
  };
  const frontBoth = arms === "carry" || arms === "crossed" || arms === "bouquet" || arms === "lap" || arms === "rope" || arms === "oar";
  const farArm: ArmMode = arms === "wave" || arms === "reach" || arms === "point" || arms === "basket" ? "hang" : arms;
  const limbs: Limb[] = [limb(-1, farArm, frontBoth), limb(1, arms, frontBoth || arms === "wave" || arms === "reach" || arms === "point" || arms === "basket")];
  const drawLimb = (l: Limb) => {
    const [S, E, Hd] = l.pts;
    if (o.sleeves === "rolled") {
      p.stroke(curve(S, lerp2(S, E, 0.5), E), 5.2 * u, armCol);
      p.stroke(curve(lerp2(S, E, 0.42), E, Hd), 5.0 * u, skin);
      p.stroke([E, lerp2(E, Hd, 0.24)], 6.2 * u, armCol);
    } else if (o.sleeves === "short") p.stroke(curve(S, E, Hd), 5.0 * u, skin);
    else p.stroke(curve(S, E, Hd), 5.2 * u, armCol);
    p.dot(Hd[0], Hd[1], 5.5 * u);
  };
  for (const l of limbs) if (!l.front) drawLimb(l);
  // ---- torso ----
  if (o.dress) {
    const D: Blob = { a: 0.5 * W * 0.98, b: 0.5 * ((sole - 0.35 * HH) - (chin - 0.2 * HH)), nTop: 2.0, nBot: 3.0, egg: 0.35,
      asym: 0.03 * facing, rot: 0, noise: 0.006, seed: seed + 9 };
    const dp = blobPts(300, sole - 0.35 * HH - D.b, D);
    p.gradFill(dp, o.dress, mul(o.dress, SH_CLOTH), light);
    p.rimLight(dp, mix(o.dress, WHITE, 0.45), light, 2 * u, 0.4);
    p.inkRing(dp, ow, thick);
    const Sw: Blob = { a: 0.38 * W, b: 0.32 * HH, nTop: 2.2, nBot: 2.4, egg: 0.1, asym: 0, rot: 0, noise: 0.006, seed: seed + 8 };
    const sp = blobPts(300, chin + 0.12 * HH, Sw);
    p.gradFill(sp, o.top, mul(o.top, SH_CLOTH), light);
    p.inkRing(sp, ow * 0.9, thick);
    if (o.wreath) p.band([[tcx - 0.5 * Sw.a, chin + 0.2 * HH], [tcx + 0.5 * Sw.a, chin + 0.16 * HH]], o.wreath, 5 * u, 1.6 * u);
    if (limbs[0].front) drawLimb(limbs[0]);
    if (limbs[1].front) drawLimb(limbs[1]);
  } else {
    p.gradFill(tp, o.top, mul(o.top, SH_CLOTH), light);
    p.clip(tp, () => {
      if (o.apron) {                                   // the apron panel: inset, with creases and flour dust
        const aw = 0.66 * T.a, ay0 = chin + 0.06 * HH, ay1 = torsoBot - 0.02 * HH;
        const ap = blobPts(tcx, (ay0 + ay1) / 2, { a: aw, b: 0.5 * (ay1 - ay0), nTop: 2.6, nBot: 1.9, egg: -0.05, asym: 0, rot: 0, noise: 0.004, seed: seed + 21 });
        p.gradFill(ap, o.apron, mul(o.apron, SH_CLOTH), light, 0.34);
        p.poly(ap, null, 2.4 * u);
        if (o.build === "pip") for (let i = 0; i < 7; i++) {
          const q = rnd(seed + i, 33);
          p.dot(tcx + (rnd(seed + i, 34) - 0.5) * 1.2 * aw, ay0 + q * (ay1 - ay0), 2.4 * u, rgba(WHITE, 0.85));
        }
      }
      if (o.belt) {
        for (const s of [-1, 1]) p.band([[tcx - s * 0.75 * T.a, chin - 0.05 * HH], [tcx + s * 0.8 * T.a, torsoBot - 0.1 * HH]], o.belt, 5.5 * u, 1.8 * u);
        const xc = tcx + 0.025 * T.a, yc = chin - 0.05 * HH + (torsoBot - 0.1 * HH - (chin - 0.05 * HH)) * (0.75 / 1.55);
        p.poly([[xc - 3.5 * u, yc - 3.5 * u], [xc + 3.5 * u, yc - 3.5 * u], [xc + 3.5 * u, yc + 3.5 * u], [xc - 3.5 * u, yc + 3.5 * u]], "#d9dde0", 1.5 * u);
      }
      if (o.sash) p.band([[tcx - 1.3 * T.a, torsoBot - 0.32 * HH], [tcx + 1.3 * T.a, torsoBot - 0.32 * HH]], o.sash, 0.13 * HH, 1.8 * u);
      if (o.cravat) {
        p.poly([[tcx - 0.3 * T.a, chin + 0.06 * HH], [tcx + 0.3 * T.a, chin + 0.06 * HH], [tcx + 0.06 * T.a, chin + 0.34 * HH], [tcx - 0.06 * T.a, chin + 0.34 * HH]], o.cravat, 2.6 * u);
        p.ell(tcx, chin + 0.07 * HH, 0.14 * T.a, 0.05 * HH, o.cravat, 2.2 * u);
      }
      for (let i = 0; i < 4; i++) {
        const y = chin + 0.2 * HH + i * 0.2 * HH;
        if (y > torsoBot - 0.04 * HH) break;
        if (o.apron) break;
        p.dot(tcx + 2 * u * facing, y, 3 * u, INK); p.dot(tcx + 2 * u * facing, y, 2.2 * u, o.buttons ?? shade(o.top, 0.7));
      }
    });
    if (o.sash) { const s = facing || 1; p.poly([[tcx + s * 0.55 * T.a, torsoBot - 0.3 * HH], [tcx + s * 0.75 * T.a, torsoBot + 0.05 * HH], [tcx + s * 0.45 * T.a, torsoBot + 0.02 * HH]], o.sash, 1.6 * u); }
    p.rimLight(tp, mix(o.top, WHITE, 0.45), light, 2 * u, 0.4);
    p.inkRing(tp, ow, thick);
    for (const l of limbs) if (l.front) drawLimb(l);
  }
  // ---- props in the hands ----
  const hN = limbs[1].pts[2], hF = limbs[0].pts[2];
  if (o.prop === "rope") {
    const rx = hN[0] * 0.35 + tcx * 0.65;
    p.band([[rx, hN[1] - 0.24 * HH], [rx, 6]], "#bb8c54", 8 * u, 2 * u, "round");
    p.band([[rx, hF[1] + 0.3 * HH], [rx, hF[1] + 2.1 * HH]], "#bb8c54", 8 * u, 2 * u, "round");
    p.ell(rx, hF[1] + 0.34 * HH, 10 * u, 8 * u, "#bb8c54", 2.4 * u);
    p.stroke([[rx - 14 * u, hF[1] + 0.12 * HH], [rx + 14 * u, hF[1] + 0.12 * HH]], 4 * u, "#8a6238");
    p.dot(rx, hN[1] - 0.18 * HH, 5.5 * u);
  } else if (o.prop === "oar") {
    const t0: P2 = [hN[0] - 4 * u, hN[1] - 0.16 * HH], t1: P2 = [hN[0] + 52 * u, 962];
    p.band([t0, t1], "#a87a4a", 6 * u, 2 * u, "round");
    p.band([t0, lerp2(t0, t1, 0.42)], "#8a6a4a", 7 * u, 0.8 * u, "round");
    p.dot(hF[0], hF[1], 5.5 * u);
    p.dot(hN[0], hN[1], 5.5 * u);
  } else if (o.prop === "bouquet") {
    const bx = (hN[0] + hF[0]) / 2, by = (hN[1] + hF[1]) / 2;
    p.stroke([[bx - 4 * u, by + 30 * u], [bx - 1 * u, by]], 4 * u, "#5d7a3a");
    p.stroke([[bx + 6 * u, by + 30 * u], [bx + 3 * u, by]], 4 * u, "#5d7a3a");
    const petals = ["#f0d0dc", "#fbf2e2", "#e8b7c6", "#d9a441", "#f0d0dc"];
    for (let i = 0; i < 5; i++) {
      const px = bx + (i - 2) * 9 * u, py = by - 6 * u + (i % 2 ? 4 * u : 0);
      p.ell(px, py, 10 * u, 9 * u, petals[i], 2.6 * u); p.dot(px, py, 3 * u, "#e8b45a");
    }
    p.dot(hN[0], hN[1], 5.5 * u); p.dot(hF[0], hF[1], 5.5 * u);
    p.poly([[bx - 16 * u, by + 26 * u], [bx + 16 * u, by + 26 * u], [bx, by + 52 * u]], "#f2e6cf", 3 * u);
  } else if (o.prop === "basket") {
    const bx = hN[0], by = hN[1] + 16 * u;
    p.arc(bx, by, 20 * u, 24 * u, 180, 360, 3.4 * u, "#a8823f");
    const bw = rrect(bx - 22 * u, by, bx + 22 * u, by + 46 * u, 7 * u);
    p.poly(bw, "#c8a165", ow * 0.8);
    p.stroke([[bx - 20 * u, by + 16 * u], [bx + 20 * u, by + 16 * u]], 2 * u);
    p.stroke([[bx - 19 * u, by + 32 * u], [bx + 19 * u, by + 32 * u]], 2 * u);
    p.ell(bx - 9 * u, by - 4 * u, 8 * u, 6 * u, "#b5653f", 2.2 * u);
    p.ell(bx + 10 * u, by - 6 * u, 7 * u, 6 * u, "#6f8f4a", 2.2 * u);
    p.dot(hN[0], hN[1], 5.5 * u);
  } else if (o.prop === "loaf") {
    p.ell(hN[0] + 4 * u, hN[1] + 8 * u, 22 * u, 14 * u, "#d9a25a", 3 * u);
    p.stroke([[hN[0] - 6 * u, hN[1] + 4 * u], [hN[0] + 2 * u, hN[1] + 2 * u]], 2.4 * u);
    p.dot(hN[0], hN[1], 5.5 * u);
  }
  // ---- head ----
  const Ah = A + headTilt, [cpx, cpy] = rotAbout([300, chin], rad(A), [300, hipY]);
  p.rot = Ah ? [rad(Ah), 300, chin, cpx - 300, cpy - chin] : null;
  hatBehind(p, o, H, 300, hc, light, thick, ow);
  const hp = blobPts(300, hc, H);
  p.shadedFill(hp, skin, mul(skin, SH_SKIN), light, H.a);
  p.inkRing(hp, ow, thick);
  if (o.beard) {
    const Bb: Blob = { a: H.a * 0.9, b: H.b * 0.74, nTop: 2.5, nBot: 1.9, egg: -0.12, asym: 0.03, rot: 0, noise: 0.012, seed: seed + 11 };
    const bp = blobPts(300, hc + 0.6 * H.b, Bb);
    p.shadedFill(bp, o.beard, mul(o.beard, SH_WHITE), light, Bb.a, 0.35);
    p.inkRing(bp, ow * 0.7, thick);
  }
  hatOn(p, o, hp, H, 300, hc, light, seed, facing, false);
  const brim = !!o.hat && o.hat !== "hair" && o.hat !== "bonnet" && o.hat !== "veil" && o.hat !== "kerchief";
  faceFront(p, 300, hc, W, expr, facing, look, lid, brim, skin, { moustache: o.moustache, beard: o.beard, stout: o.build === "stout", up });
  p.rot = null;
};

// ===================================================================================================================
// side view (profiles): the same wardrobe, seen from the side. Forward is screen-right before the card is mirrored.
// ===================================================================================================================
/** two-bone leg, knee bending forward (+x) */
const ik = (hip: P2, ank: P2, l1: number, l2: number): P2 => {
  const dx = ank[0] - hip[0], dy = ank[1] - hip[1], d = clamp(Math.hypot(dx, dy), 1, l1 + l2 - 0.01);
  const A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)), k = Math.atan2(dy, dx) - A;
  return [hip[0] + l1 * Math.cos(k), hip[1] + l1 * Math.sin(k)];
};

/** side view: footfalls land at phase 0 (near foot) and 0.5 (far foot) and the stance foot is planted (it slides back
 *  at exactly the walking speed while the hip rises and falls over it), so `stride` only has to be foreshortened. */
export const bodySide = (p: Pen, o: Outfit, opts: SideOpts = {}) => {
  const { phase = 0, expr = "neutral", mode = "walk", arms = o.prop === "oar" ? "oar" : "hang", stride = 1, blink = 0,
    light = DEF_LIGHT, seed = 1, lean = 0, pull = 0, lift = 60, squat = 0 } = opts;
  const Bd = BUILD[o.build ?? "adult"], skin = o.skin ?? SKIN, two = Math.PI * 2, lid = lidOf(blink);
  const H: Blob = { ...headBlob(seed, Bd.a, 1), asym: 0.12, rot: rad(3 + 3 * (rnd(seed, 7) - 0.5)) };
  const W = 2 * H.a, HH = 2 * H.b, u = W / 100, sole = 975, ankY = sole - 4 * u;
  const thick = thickAngle(light), ow = 5 * u, wide = o.build === "pip" || o.build === "kid";
  const sq = mode === "crouch" ? clamp01(squat || 1) : 0;
  const legLen = (Bd.legs + 0.12) * HH * (1 - 0.5 * sq) - 4 * u, l1 = legLen / 2, l2 = legLen / 2;
  const nearCol = mix(o.pants, INK, 0.55), farCol = mix(o.pants, INK, 0.75), footCol = o.boots ?? INK;
  type LegS = { ank: P2; pitch: number; near: boolean };
  const legs: LegS[] = [];
  let hipY = ankY - legLen * 0.995, leanA = 0, nearFwd = 0;
  if (mode === "walk" || mode === "run") {
    // a walker coming straight at the lens is foreshortened to stride 0: keep a minimum so the legs never divide to NaN
    const S = Math.max(12, 370 * stride * (mode === "run" ? 1.5 : 1)), liftH = (mode === "run" ? 1.8 : 1) * lift;
    const st = (ph: number) => {
      const c = (((phase + ph) % 1) + 1) % 1;
      if (c < 0.5) { const s = c / 0.5; return { x: S / 2 - S * s, h: 0, stance: true, s }; }
      const s = (c - 0.5) / 0.5; // swing: a cycloid in world space, so the foot leaves and lands at zero ground speed
      return { x: -S / 2 + S * s - (S / Math.PI) * Math.sin(2 * Math.PI * s), h: liftH * Math.sin(Math.PI * s), stance: false, s };
    };
    const nL = st(0), fL = st(0.5), stance = nL.stance ? nL : fL;
    const Leff = legLen * (1 - 0.035 * Math.sin(Math.PI * stance.s));
    hipY = ankY - Math.sqrt(Math.max(1, Leff * Leff - stance.x * stance.x));
    for (const [L, near] of [[fL, false], [nL, true]] as const)
      legs.push({ ank: [300 + L.x, ankY - L.h], pitch: L.stance ? 0 : rad(35 * Math.sin(Math.PI * L.s) * (1 - 1.6 * L.s)), near });
    leanA = 4 + 3 * Math.cos(2 * two * phase) + 0.5 * lean;
    nearFwd = nL.x / (S / 2);
  } else if (mode === "crouch") {
    hipY = ankY - legLen * (0.99 - 0.34 * sq);
    const sp = 0.25 + 0.35 * (1 - sq);
    legs.push({ ank: [300 - sp * legLen, ankY], pitch: rad(-14), near: false }, { ank: [300 + sp * legLen, ankY], pitch: rad(2), near: true });
    leanA = 14 * sq;
  } else if (mode === "sit") {
    hipY = ankY - legLen * 0.62;
    for (const [dx, near] of [[-9, false], [1, true]] as const) {
      const knee: P2 = [300 + l1 * 0.94 + dx * u, hipY + 10 * u];
      legs.push({ ank: [knee[0] + l2 * (wide ? 0.86 : 0.94), ankY], pitch: rad(-8), near });
    }
    leanA = 3;
  } else {
    legs.push({ ank: [300 - 6 * u, ankY], pitch: 0, near: false }, { ank: [300 + 6 * u, ankY], pitch: 0, near: true });
  }
  const torsoBot = hipY + 0.12 * HH, chin = torsoBot - Bd.torso * HH + 0.05 * HH * clamp01(lean / 20);
  const hc = chin - H.b, crown = hc - H.b, hip: P2 = [300, hipY];
  p.rot = null;
  const footLen = (wide ? 17 : 13) * u;
  for (const L of legs) {
    const knee = mode === "sit" ? ([300 + l1 * 0.94 + (L.near ? 1 * u : -9 * u), hipY + 10 * u] as P2) : ik(hip, L.ank, l1, l2);
    p.stroke([[300 + (L.near ? 0 : -5 * u), hipY], knee, L.ank], 5.8 * u, L.near ? nearCol : farCol);
    const c = Math.cos(L.pitch), s = Math.sin(L.pitch);
    footStroke(p, [L.ank[0] - 3 * u * c, L.ank[1] - 3 * u * s], [L.ank[0] + footLen * c, L.ank[1] + footLen * s + 0.5 * u],
      7.5 * u, L.near ? footCol : footCol === INK ? INK : shade(footCol, 0.82));
  }
  // ---- upper body leans about the hip ----
  p.rot = leanA ? [rad(leanA), 300, hipY] : null;
  const T: Blob = { a: (o.build === "stout" ? 0.37 : 0.32) * W, b: 0.5 * (torsoBot - (chin - 0.25 * HH)), nTop: 2.2, nBot: 2.5,
    egg: o.build === "stout" ? 0.16 : 0.1, asym: 0.06, rot: 0, noise: 0.006, seed: seed + 7 };
  const tcx = 300 + 2 * u, tcy = torsoBot - T.b, tp = blobPts(tcx, tcy, T);
  const armCol = o.sleeves === "short" ? mix(skin, INK, 0.06) : mix(o.top, INK, 0.5);
  const farArmCol = o.sleeves === "short" ? shade(skin, 0.86) : mix(o.top, INK, 0.7);
  const Ssh: P2 = [tcx + 0.06 * T.a, chin + 0.14 * HH], aLen = 0.92 * HH;
  const armTo = (S: P2, Hd: P2, bend: number): [P2, P2, P2] => [S, [(S[0] + Hd[0]) / 2 + 3 * u, (S[1] + Hd[1]) / 2 - bend * u], Hd];
  const hang = (sw: number, off = 0): [P2, P2, P2] =>
    [Ssh, [Ssh[0] + sw * 1.4 * u + off * u, Ssh[1] + 0.52 * aLen], [Ssh[0] + sw * 2.8 * u + off * 1.6 * u, Ssh[1] + 0.98 * aLen]];
  let nearArm: [P2, P2, P2], farArm: [P2, P2, P2] | null = null;
  switch (arms) {
    case "carry": case "lap": case "basket": case "bouquet": {
      const h: P2 = [tcx + 0.5 * aLen, chin + 0.5 * HH];
      nearArm = armTo(Ssh, h, 6); farArm = armTo(Ssh, [h[0] - 10 * u, h[1] + 4 * u], 9);
      break;
    }
    case "rope": {
      nearArm = armTo(Ssh, [tcx + 0.3 * aLen, chin + (0.52 - 0.5 * pull) * HH], 4);
      farArm = [Ssh, [Ssh[0] + 7 * u, Ssh[1] - 0.18 * aLen], [Ssh[0] + 15 * u, Ssh[1] - 0.3 * aLen]];
      break;
    }
    case "oar": {
      nearArm = armTo(Ssh, [tcx + 0.62 * aLen, chin + 0.44 * HH], 10);
      farArm = armTo(Ssh, [tcx - 0.05 * aLen, chin + 0.6 * HH], 8);
      break;
    }
    case "up": case "wave": {
      const h: P2 = [Ssh[0] + 0.45 * aLen, Ssh[1] - 0.72 * aLen + (arms === "wave" ? 8 * u * Math.sin(phase * two) : 0)];
      nearArm = armTo(Ssh, h, -10); farArm = hang(1, -3);
      break;
    }
    case "point": { nearArm = armTo(Ssh, [Ssh[0] + 1.02 * aLen, chin + 0.06 * HH], -3); break; }
    case "reach": { nearArm = armTo(Ssh, [Ssh[0] + 1.06 * aLen, chin - 0.2 * HH], -4); break; }
    case "open": { nearArm = armTo(Ssh, [Ssh[0] + 0.9 * aLen, Ssh[1] - 0.06 * aLen], -5); farArm = armTo(Ssh, [Ssh[0] + 0.35 * aLen, Ssh[1] + 0.5 * aLen], 6); break; }
    case "crossed": {
      nearArm = armTo(Ssh, [Ssh[0] - 0.34 * aLen, chin + 0.44 * HH], 4);
      farArm = armTo(Ssh, [Ssh[0] - 0.1 * aLen, chin + 0.5 * HH], 7);
      break;
    }
    default: { nearArm = hang(nearFwd); farArm = hang(-nearFwd, -4); }
  }
  const drawArm = (a: [P2, P2, P2], col: string) => {
    if (o.sleeves === "rolled") {
      p.stroke(curve(a[0], lerp2(a[0], a[1], 0.5), a[1]), 5.4 * u, col);
      p.stroke(curve(lerp2(a[0], a[1], 0.45), a[1], a[2]), 5.0 * u, mix(skin, INK, 0.08));
      p.stroke([a[1], lerp2(a[1], a[2], 0.24)], 6.4 * u, col);
    } else p.stroke(curve(a[0], a[1], a[2]), 5.2 * u, col);
    p.dot(a[2][0], a[2][1], 5.5 * u);
  };
  if (farArm) drawArm(farArm, farArmCol);
  if (o.dress) {
    const D: Blob = { a: 0.5 * W * 0.92, b: 0.5 * (torsoBot - (chin - 0.2 * HH)), nTop: 2.0, nBot: 3.0, egg: 0.32,
      asym: 0.04, rot: 0, noise: 0.006, seed: seed + 9 };
    const dp = blobPts(300 + 3 * u, sole - 0.35 * HH - D.b, D);
    p.gradFill(dp, o.dress, mul(o.dress, SH_CLOTH), light);
    p.rimLight(dp, mix(o.dress, WHITE, 0.45), light, 2 * u, 0.4);
    p.inkRing(dp, ow, thick);
  }
  p.gradFill(tp, o.top, mul(o.top, SH_CLOTH), light);
  p.clip(tp, () => {
    if (o.apron) {
      const aw = 0.52 * T.a, ay0 = chin + 0.08 * HH, ay1 = torsoBot - 0.02 * HH;
      const ap: P2[] = [];
      for (let i = 0; i <= 18; i++) { const t = i / 18; ap.push([tcx - 0.2 * aw + aw * t, ay0 + 4 * u * (1 - (2 * t - 1) ** 2)]); }
      for (let i = 18; i >= 0; i--) { const t = i / 18; ap.push([tcx - 0.16 * aw + 0.92 * aw * t, ay1 - 5 * u * (1 - (2 * t - 1) ** 2)]); }
      p.gradFill(ap, o.apron, mul(o.apron, SH_CLOTH), light, 0.34);
      p.poly(ap, null, 2.4 * u);
      if (o.build === "pip") for (let i = 0; i < 6; i++) p.dot(tcx + (rnd(seed + i, 33) - 0.4) * aw, ay0 + rnd(seed + i, 34) * (ay1 - ay0), 2.4 * u, rgba(WHITE, 0.85));
    }
    if (o.belt) p.band([[tcx - 0.75 * T.a, chin - 0.05 * HH], [tcx + 0.8 * T.a, torsoBot - 0.1 * HH]], o.belt, 5.5 * u, 1.8 * u);
    if (o.sash) p.band([[tcx - 1.3 * T.a, torsoBot - 0.32 * HH], [tcx + 1.3 * T.a, torsoBot - 0.32 * HH]], o.sash, 0.13 * HH, 1.8 * u);
    if (o.cravat) p.poly([[tcx - 0.02 * T.a, chin + 0.06 * HH], [tcx + 0.42 * T.a, chin + 0.1 * HH], [tcx + 0.3 * T.a, chin + 0.36 * HH], [tcx + 0.14 * T.a, chin + 0.3 * HH]], o.cravat, 2.6 * u);
    if (!o.apron) for (let i = 0; i < 3; i++) {
      const y = chin + 0.16 * HH + i * 0.24 * HH;
      if (y < torsoBot - 0.06 * HH) { p.dot(tcx + 0.8 * T.a, y, 3 * u, INK); p.dot(tcx + 0.8 * T.a, y, 2.2 * u, o.buttons ?? shade(o.top, 0.7)); }
    }
  });
  p.rimLight(tp, mix(o.top, WHITE, 0.45), light, 2 * u, 0.4);
  p.inkRing(tp, ow, thick);
  drawArm(nearArm, armCol);
  // ---- props (side view) ----
  const hn = nearArm[2], hf = (farArm ?? nearArm)[2];
  if (o.prop === "rope") {
    p.band([[hn[0], hn[1] + 6 * u], [hn[0], 2]], "#bb8c54", 8 * u, 2 * u, "round");
    p.band([[hf[0] + 2 * u, hf[1] + 20 * u], [hf[0] + 2 * u, hf[1] + 1.5 * HH]], "#bb8c54", 8 * u, 2 * u, "round");
    p.ell(hf[0] + 2 * u, hf[1] + 24 * u, 11 * u, 9 * u, "#9a6f3c", 2.4 * u);
  } else if (o.prop === "oar") {
    const t0: P2 = [hn[0] - 2 * u, hn[1] - 6 * u], t1: P2 = [hn[0] + 66 * u, sole + 4];
    p.band([t0, t1], "#a87a4a", 6.5 * u, 2 * u, "round");
    p.band([lerp2(t0, t1, 0.62), t1], "#8a6a4a", 8.5 * u, 1 * u, "round");
  } else if (o.prop === "basket") {
    const bx = hn[0] + 6 * u, by = hn[1] + 22 * u;
    p.arc(bx, by, 20 * u, 22 * u, 180, 360, 3.4 * u, "#a8823f");
    p.poly(rrect(bx - 22 * u, by, bx + 22 * u, by + 44 * u, 7 * u), "#c8a165", ow * 0.8);
    p.stroke([[bx - 20 * u, by + 15 * u], [bx + 20 * u, by + 15 * u]], 2 * u);
    p.stroke([[bx - 19 * u, by + 30 * u], [bx + 19 * u, by + 30 * u]], 2 * u);
  } else if (o.prop === "bouquet") {
    const bx = hn[0] + 10 * u, by = hn[1] - 8 * u;
    const petals = ["#f0d0dc", "#fbf2e2", "#e8b7c6", "#d9a441", "#f0d0dc"];
    for (let i = 0; i < 5; i++) { const px = bx + (i - 2) * 8 * u, py = by + (i % 2 ? 6 * u : 0); p.ell(px, py, 10 * u, 9 * u, petals[i], 2.6 * u); p.dot(px, py, 3 * u, "#e8b45a"); }
  } else if (o.prop === "loaf") {
    p.ell(hn[0] + 12 * u, hn[1] - 4 * u, 22 * u, 14 * u, "#d9a25a", 3 * u);
  }
  // ---- head ----
  const hx = 300 + 5 * u;
  hatBehind(p, o, H, hx, hc, light, thick, ow);
  const hp = blobPts(hx, hc, H);
  p.shadedFill(hp, skin, mul(skin, SH_SKIN), light, H.a);
  p.inkRing(hp, ow, thick);
  if (o.beard) {
    const Bb: Blob = { a: H.a * 0.84, b: H.b * 0.7, nTop: 2.5, nBot: 1.9, egg: -0.12, asym: 0.05, rot: 0, noise: 0.012, seed: seed + 11 };
    const bp = blobPts(hx + 0.18 * H.a, hc + 0.6 * H.b, Bb);
    p.shadedFill(bp, o.beard, mul(o.beard, SH_WHITE), light, Bb.a, 0.35);
    p.inkRing(bp, ow * 0.7, thick);
  }
  hatOn(p, o, hp, H, hx, hc, light, seed, 1, true);
  const brim = !!o.hat && o.hat !== "hair" && o.hat !== "bonnet" && o.hat !== "veil" && o.hat !== "kerchief";
  faceSide(p, hx, hc, W, expr, lid, brim, skin, { moustache: o.moustache, beard: o.beard, stout: o.build === "stout" });
  p.rot = null;
};

// ===================================================================================================================
// critters
// ===================================================================================================================
/** a goose in the 600 x 1000 card, feet on the sole line, ~500 units tall (place it at scale ~0.6 for a 0.65 m bird) */
export const bodyGoose = (p: Pen, opts: { bob?: number; light?: number; seed?: number; facing?: number } = {}) => {
  const { bob = 0, light = DEF_LIGHT, seed = 5, facing = 1 } = opts;
  const s = facing >= 0 ? 1 : -1, sole = 975, thick = thickAngle(light), ow = 3.6;
  const hb = bob * 14, GT = "#f2a343", GD = "#cf7c22", PL = "#fdfbf4";
  const bx = 290, by = 828;
  for (const k of [-1, 1]) {
    const lx = bx + k * 30 * s;
    p.stroke([[lx, by + 60], [lx, sole - 10]], 7.5, GT);
    p.stroke([[lx - 8 * s, sole - 9], [lx + 16 * s, sole - 6]], 6.5, GD);
  }
  const n0: P2 = [bx + s * 96, by - 30 - hb * 0.25], n1: P2 = [bx + s * 148, by - 150 - hb * 0.7], hd: P2 = [bx + s * 168, by - 218 - hb];
  p.line(curve(n0, n1, hd), PL, 42, true);
  const bp = blobPts(bx, by, { a: 134, b: 90, nTop: 2.1, nBot: 2.4, egg: 0.08, asym: 0.05 * s, rot: rad(6 * s), noise: 0.01, seed });
  p.shadedFill(bp, PL, mul(PL, SH_WHITE), light, 134, 0.4);
  p.inkRing(bp, ow, thick);
  p.arc(bx - s * 12, by + 8, 80, 54, 202, 348, 3.4, shade(PL, 0.9));
  p.poly([[bx - s * 118, by + 6], [bx - s * 150, by - 26], [bx - s * 96, by - 22]], PL, ow * 0.9);
  const hp = blobPts(hd[0], hd[1], { a: 46, b: 40, nTop: 1.9, nBot: 2.2, egg: -0.05, asym: 0.05 * s, rot: 0, noise: 0.01, seed: seed + 1 });
  p.shadedFill(hp, PL, mul(PL, SH_WHITE), light, 46, 0.4);
  p.inkRing(hp, ow, thick);
  p.poly([[hd[0] + s * 26, hd[1] - 8], [hd[0] + s * 94, hd[1] + 3], [hd[0] + s * 26, hd[1] + 18]], GT, ow * 0.9);
  p.stroke([[hd[0] + s * 30, hd[1] + 6], [hd[0] + s * 86, hd[1] + 6]], 2.4, GD);
  p.dot(hd[0] + s * 16, hd[1] - 12, 7.5);
};

/** the market dog on the 600 x 1000 card, ~300 units tall (place it at scale ~0.62 for a 0.4 m dog) */
export const bodyDog = (p: Pen, opts: { bob?: number; light?: number; seed?: number; facing?: number; wag?: number } = {}) => {
  const { bob = 0, light = DEF_LIGHT, seed = 9, facing = 1, wag = 0 } = opts;
  const s = facing >= 0 ? 1 : -1, sole = 975, thick = thickAngle(light), ow = 3.4;
  const BR = "#b9743f", BD = "#8c5227", b = bob * 10, bx = 300, by = sole - 150 + b, hd: P2 = [bx + s * 120, by - 78 + b * 0.6];
  for (const k of [-1, 1]) {
    const lx = bx + s * 52 + k * 22 * s;
    p.stroke([[lx, by + 34], [lx + (k > 0 ? 8 * s : -6 * s), sole - 12]], 9, BD);
    p.stroke([[lx + (k > 0 ? 4 * s : -4 * s), sole - 12], [lx + (k > 0 ? 20 * s : 12 * s), sole - 9]], 7, BR);
  }
  p.stroke([[bx - s * 74, by - 20], [bx - s * 118, by - 56 + wag * 26], [bx - s * 132, by - 20 - wag * 20]], 11, BR);
  const body = blobPts(bx, by, { a: 96, b: 52, nTop: 2.2, nBot: 2.3, egg: 0.04, asym: 0.04 * s, rot: rad(5 * s), noise: 0.012, seed });
  p.shadedFill(body, BR, mul(BR, [0.86, 0.82, 0.8]), light, 96, 0.4);
  p.inkRing(body, ow, thick);
  const hp = blobPts(hd[0], hd[1], { a: 52, b: 44, nTop: 1.9, nBot: 2.2, egg: -0.06, asym: 0.05 * s, rot: rad(6 * s), noise: 0.012, seed: seed + 2 });
  p.shadedFill(hp, BR, mul(BR, [0.86, 0.82, 0.8]), light, 52, 0.4);
  p.inkRing(hp, ow, thick);
  p.poly([[hd[0] - s * 10, hd[1] - 40], [hd[0] - s * 42, hd[1] - 96], [hd[0] + s * 14, hd[1] - 44]], BD, ow * 0.9);
  p.ell(hd[0] + s * 44, hd[1] + 10, 26, 18, BD, ow * 0.85);
  p.dot(hd[0] + s * 62, hd[1] + 4, 7, INK);
  p.dot(hd[0] + s * 28, hd[1] - 14, 6, INK);
  p.stroke([[hd[0] + s * 30, hd[1] + 24], [hd[0] + s * 58, hd[1] + 20]], 2.6, "#7a3b2a");
};

// ===================================================================================================================
// effect drawings (own quads, not silhouettes; anything soft is faded alpha, anything hard is cut out)
// ===================================================================================================================
/** dust puff on a 300 x 300 canvas; t in 0..1 */
export const fxPuff = (p: Pen, t: number, col = "238,225,205") => {
  for (let i = 0; i < 5; i++) {
    const a = rad(160 + i * 55), d = 40 + 70 * t, r = (34 + 20 * (i % 2)) * (1 - 0.6 * t);
    p.ell(150 + d * Math.cos(a), 180 + d * 0.45 * Math.sin(a), r, r * 0.8, `rgba(${col},${(1 - t).toFixed(3)})`, 0);
  }
};

/** flour burst on a 360 x 360 canvas; t in 0..1 (white cloud + a scatter of grains) */
export const fxFlour = (p: Pen, t: number) => {
  const c = 180;
  for (let i = 0; i < 6; i++) {
    const a = rad(200 + i * 40), d = (26 + 92 * t) * (0.8 + 0.28 * (i % 3)), r = (30 + 18 * (i % 2)) * (1 - 0.45 * t);
    p.ell(c + d * Math.cos(a), c - 24 + d * 0.6 * Math.sin(a), r, r * 0.76, `rgba(255,251,240,${(0.92 * (1 - t)).toFixed(3)})`, 0);
  }
  for (let i = 0; i < 10; i++) {
    const a = rad(206 + i * 23), d = 34 + 140 * t;
    p.dot(c + d * Math.cos(a), c - 30 + d * 0.52 * Math.sin(a), 3.6, `rgba(255,250,236,${(1 - t).toFixed(3)})`);
  }
};

/** the wedding cake on a 260 x 340 canvas: two white tiers, piped icing, a tiny couple on top. */
export const fxCake = (p: Pen) => {
  const H = 340, cx = 130, W = "#fdfbf5", WS = "#dcd5c6", l = rad(-120);
  p.ell(cx, H - 18, 106, 17, "#efe6d4", 3.5);
  const t1 = rrect(cx - 88, H - 128, cx + 88, H - 24, 9);
  p.gradFill(t1, W, WS, l); p.inkRing(t1, 3.6, -Math.PI / 2, 0.5);
  p.band([[cx - 86, H - 126], [cx + 86, H - 126]], W, 9, 2);
  for (let i = -4; i <= 4; i++) p.dot(cx + i * 20, H - 124, 6.5, "#f6f1e2");
  const t2 = rrect(cx - 58, H - 206, cx + 58, H - 124, 9);
  p.gradFill(t2, W, WS, l); p.inkRing(t2, 3.6, -Math.PI / 2, 0.5);
  p.band([[cx - 56, H - 204], [cx + 56, H - 204]], W, 8, 2);
  for (let i = -2; i <= 2; i++) p.dot(cx + i * 21, H - 202, 6, "#f6f1e2");
  for (let i = -3; i <= 3; i++) p.ell(cx + i * 18, H - 122, 9, 7, W, 2.4);
  p.poly([[cx - 30, H - 206], [cx + 30, H - 206], [cx + 24, H - 234], [cx - 24, H - 234]], "#f3ecdd", 2.6);
  p.ell(cx - 14, H - 246, 13, 19, "#fdf6e6", 2.6);
  p.poly([[cx - 27, H - 232], [cx - 1, H - 232], [cx - 14, H - 274]], "#fdf6e6", 2.6);
  p.ell(cx - 14, H - 278, 8, 8, SKIN, 2.2);
  p.poly([[cx + 9, H - 206], [cx + 27, H - 206], [cx + 27, H - 250], [cx + 9, H - 250]], "#3a4055", 2.6);
  p.ell(cx + 18, H - 258, 9, 9, SKIN, 2.2);
  p.ell(cx + 18, H - 268, 15, 3.4, "#2e2a36", 2);
  p.stroke([[cx - 6, H - 252], [cx + 8, H - 250]], 3, "#e8b7c6");
  for (let i = 0; i < 5; i++) { const a = i * 1.26; p.dot(cx + Math.cos(a) * 46, H - 226 + Math.sin(a) * 14, 4, "#f0d0dc"); }
};

/** a gull silhouette on a 160 x 80 canvas; kind 0 = wings up, 1 = wings down */
export const fxBird = (p: Pen, kind = 0) => {
  const s = kind ? -1 : 1, col = "#2f2b38";
  p.stroke([[10, 44 + 8 * s], [44, 18], [78, 42]], 7, col);
  p.stroke([[78, 42], [112, 18], [150, 44 + 8 * s]], 7, col);
};

/** sun-burst at the bell mouth on a 720 x 720 canvas; t in 0..1 (soft card): warm core + rays */
export const fxGlow = (p: Pen, t: number, rays = 12) => {
  const c = 360, e = 1 - (1 - t) ** 2.2, R = 70 + 300 * e, g = p.g;
  const gr = g.createRadialGradient(c, c, 0, c, c, R);
  gr.addColorStop(0, `rgba(255,252,228,${(0.95 * (1 - t)).toFixed(3)})`);
  gr.addColorStop(0.42, `rgba(255,240,186,${(0.5 * (1 - t)).toFixed(3)})`);
  gr.addColorStop(1, "rgba(255,232,164,0)");
  g.fillStyle = gr; g.beginPath(); g.arc(c, c, R, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < rays; i++) {
    const a = rad((i * 360) / rays + 8 * (i % 2)), r0 = 60 + 40 * e, r1 = 150 + 260 * e * (0.7 + 0.3 * (i % 3));
    p.stroke([[c + r0 * Math.cos(a), c + r0 * Math.sin(a)], [c + r1 * Math.cos(a), c + r1 * Math.sin(a)]],
      Math.max(2, 10 * (1 - t)), `rgba(255,246,206,${(0.7 * (1 - t)).toFixed(3)})`);
  }
};

/** the bell rope on a 90 x 620 canvas (v 0 = top of the card); `sway` bends the bottom of the rope */
export const fxRope = (p: Pen, sway = 0) => {
  const x = 45;
  p.band([[x, 0], [x + sway * 3, 300], [x + sway * 8, 590]], "#c9a05e", 16, 3, "round");
  for (let i = 0; i < 6; i++) { const y = 46 + i * 92; p.stroke([[x + sway * (i * 1.4) - 8, y], [x + sway * (i * 1.4) + 8, y + 15]], 3.4, "#a97f42"); }
  p.ell(x + sway * 8, 592, 19, 15, "#b8883f", 3);
};

/** the rowboat, side-on, on a 560 x 250 canvas; `tilt` in radians rocks it about the gunwale */
export const fxBoat = (p: Pen, tilt = 0) => {
  p.rot = tilt ? [tilt, 280, 120] : null;
  const hull: P2[] = [[16, 118], [30, 96], [530, 96], [544, 118], [500, 186], [60, 186]];
  p.gradFill(hull, "#b9814a", mul("#b9814a", SH_CLOTH), rad(-120));
  p.inkRing(hull, 4, -Math.PI / 2, 0.5);
  p.stroke([[40, 128], [250, 132], [520, 128]], 3.4, "#8a5c30");
  p.stroke([[52, 156], [250, 160], [508, 156]], 3.4, "#8a5c30");
  p.poly([[46, 96], [96, 108], [96, 92]], "#8a5c30", 3);
  p.poly(rrect(150, 84, 176, 102, 4), "#9a6a3a", 3);
  p.poly(rrect(384, 84, 410, 102, 4), "#9a6a3a", 3);
  p.ell(120, 92, 34, 9, "#c9a066", 2.6);
  p.rot = null;
};

/** flat water ring on a 600 x 600 canvas, drawn top-down; t in 0..1 */
export const fxRing = (p: Pen, t: number) => {
  const g = p.g;
  for (let k = 0; k < 3; k++) {
    const u = t - k * 0.22;
    if (u <= 0 || u >= 1) continue;
    g.beginPath(); g.ellipse(300, 300, 60 + 230 * u, 60 + 230 * u, 0, 0, Math.PI * 2);
    g.strokeStyle = k === 0 ? "#f6fcff" : "#cfe8fa"; g.lineWidth = 9 * (1 - u) + 3; g.stroke();
  }
};

/** cast shadow on a 128 x 256 canvas: soft contact pool at the feet (y 205) + a tail away from the sun, fading with
 *  distance; multiply colour (sRGB-encoded ratio), white = no change */
export const fxShadow = (p: Pen, col: string) => {
  const g = p.g;
  g.fillStyle = WHITE; g.fillRect(0, 0, 128, 256);
  g.save(); g.filter = "blur(9px)";
  const lg = g.createLinearGradient(0, 205, 0, 22);
  lg.addColorStop(0, mix(col, WHITE, 0.08)); lg.addColorStop(0.55, mix(col, WHITE, 0.3)); lg.addColorStop(1, mix(col, WHITE, 0.85));
  g.fillStyle = lg;
  g.beginPath(); g.moveTo(40, 205); g.bezierCurveTo(36, 120, 46, 50, 64, 30); g.bezierCurveTo(82, 50, 92, 120, 88, 205); g.closePath(); g.fill();
  g.fillStyle = col; g.beginPath(); g.ellipse(64, 205, 30, 17, 0, 0, Math.PI * 2); g.fill();
  g.restore();
};

/** tight contact pool right under the feet on a 128 x 128 canvas (multiply colour) */
export const fxContact = (p: Pen, col: string) => {
  const g = p.g;
  g.fillStyle = WHITE; g.fillRect(0, 0, 128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [r, k] of [[0, 0], [0.32, 0.02], [0.5, 0.22], [0.66, 0.58], [0.82, 0.88], [1, 1]] as const) gr.addColorStop(r, mix(col, WHITE, k));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
};

/** soft ground contact blob on a 128 x 128 canvas, multiply colour in the centre (long fall-off: big pools, water) */
export const fxBlob = (p: Pen, col: string) => {
  const g = p.g;
  g.fillStyle = WHITE; g.fillRect(0, 0, 128, 128);
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  for (const [r, k] of [[0, 0], [0.5, 0.04], [0.64, 0.18], [0.76, 0.42], [0.87, 0.72], [0.95, 0.92], [1, 1]] as const) gr.addColorStop(r, mix(col, WHITE, k));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
};

