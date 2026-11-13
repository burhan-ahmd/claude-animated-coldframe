// wet.ts — every painted texture in the film, drawn with Canvas2D at load time (no external assets, nothing to
// download on a cloud machine, and nothing can go missing like a dropped .glb). One owner: this file.
// Rain-night palette note: these are ALBEDO values. world.ts multiplies them by the NIGHT two-tone term
// (<= ~0.5), so they are painted a good deal lighter than the final screen value would suggest.
import * as THREE from "three";
import { mulberry32, clamp } from "./contract";

export type Draw = (c: CanvasRenderingContext2D, w: number, h: number, rnd: () => number) => void;

export function tex(w: number, h: number, seed: number, draw: Draw, repeat?: [number, number], srgb = true): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const c = cv.getContext("2d") as CanvasRenderingContext2D;
  c.imageSmoothingEnabled = true;
  draw(c, w, h, mulberry32(seed));
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
}

const hex = (r: number, g: number, b: number) => `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
const shade = (c: [number, number, number], k: number) => hex(c[0] * k, c[1] * k, c[2] * k);
/** grime / mottle pass: soft multiply blobs, the cheapest way to stop a flat fill reading as plastic */
function mottle(c: CanvasRenderingContext2D, w: number, h: number, rnd: () => number, n: number, dark: number, r: number) {
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = rnd() * h, rr = r * (0.4 + rnd() * 1.5);
    const g = c.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, `rgba(0,0,0,${dark * (0.35 + rnd() * 0.65)})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g; c.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
}
/** speckle: fine grain, keeps a big surface from banding when the grade stretches the darks */
function speckle(c: CanvasRenderingContext2D, w: number, h: number, rnd: () => number, n: number, a: number, light = true) {
  for (let i = 0; i < n; i++) {
    const v = light ? 255 : 0;
    c.fillStyle = `rgba(${v},${v},${v},${a * rnd()})`;
    c.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 1.6, 1 + rnd() * 1.6);
  }
}

// ---------------------------------------------------------------- street surfaces
/** Wet granite setts, 512 px = 2.4 m. Crowned rows, per-sett variation, wet sheets darkened along one axis. */
export const cobbles = (seed = 11) => tex(512, 512, seed, (c, w, h, rnd) => {
  c.fillStyle = "#232529"; c.fillRect(0, 0, w, h);            // the joint shadow colour
  const rows = 17, rh = h / rows;
  const base: Array<[number, number, number]> = [[104, 106, 112], [92, 95, 102], [116, 117, 120], [84, 88, 96], [124, 122, 118]];
  for (let r = 0; r < rows; r++) {
    const y = r * rh, ph = r % 2 ? 0.5 : 0.0;
    let x = -rh * (0.6 + rnd() * 0.4) + ph * 34;
    while (x < w) {
      const sw = 26 + rnd() * 16, col = base[(rnd() * base.length) | 0], k = 0.86 + rnd() * 0.34;
      const g = c.createLinearGradient(x, y, x, y + rh);
      g.addColorStop(0, shade(col, k * 1.14)); g.addColorStop(1, shade(col, k * 0.78));
      c.fillStyle = g;
      const bx = x + 1.6, by = y + 1.4, bw = sw - 3.2, bh = rh - 2.8, rr = 3.2;
      c.beginPath();
      c.moveTo(bx + rr, by);
      c.arcTo(bx + bw, by, bx + bw, by + bh, rr); c.arcTo(bx + bw, by + bh, bx, by + bh, rr);
      c.arcTo(bx, by + bh, bx, by, rr); c.arcTo(bx, by, bx + bw, by, rr);
      c.closePath(); c.fill();
      if (rnd() < 0.22) { c.fillStyle = `rgba(20,22,26,${0.12 + rnd() * 0.18})`; c.fillRect(bx + 2, by + 2, bw - 4, bh - 4); }
      if (rnd() < 0.14) { c.fillStyle = `rgba(190,196,205,${0.06 + rnd() * 0.1})`; c.fillRect(bx + 3, by + 2, bw * 0.42, bh * 0.4); }
      x += sw;
    }
  }
  mottle(c, w, h, rnd, 26, 0.5, 70);
  // wet sheets: the flood film sits in the joints and in shallow depressions
  for (let i = 0; i < 7; i++) {
    const x = rnd() * w, y = rnd() * h, rr = 60 + rnd() * 110;
    const g = c.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, `rgba(24,30,44,${0.24 + rnd() * 0.3})`); g.addColorStop(0.75, `rgba(24,30,44,${0.1})`); g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g; c.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  speckle(c, w, h, rnd, 2600, 0.09);
});

/** Pavement flags, 512 px = 2.6 m. Big chamfered slabs, worn smooth in the middle, moss in the joints. */
export const flags = (seed = 23) => tex(512, 512, seed, (c, w, h, rnd) => {
  c.fillStyle = "#26282c"; c.fillRect(0, 0, w, h);
  const n = 4, s = w / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = 0.87 + rnd() * 0.3, col: [number, number, number] = rnd() < 0.3 ? [112, 110, 104] : [98, 100, 106];
    const g = c.createLinearGradient(i * s, j * s, (i + 1) * s, (j + 1) * s);
    g.addColorStop(0, shade(col, k * 1.12)); g.addColorStop(1, shade(col, k * 0.84));
    c.fillStyle = g; c.fillRect(i * s + 2, j * s + 2, s - 4, s - 4);
    c.strokeStyle = "rgba(210,214,222,0.10)"; c.lineWidth = 2;
    c.beginPath(); c.moveTo(i * s + 3, j * s + 3); c.lineTo((i + 1) * s - 3, j * s + 3); c.stroke();
    if (rnd() < 0.5) { c.fillStyle = "rgba(60,72,54,0.10)"; c.fillRect(i * s + 2, j * s + 2, s - 4, 6 + rnd() * 10); }
  }
  mottle(c, w, h, rnd, 22, 0.42, 60); speckle(c, w, h, rnd, 2200, 0.08);
});

/** Kerb stones: a long granite edge with chipped tops. */
export const kerb = (seed = 31) => tex(256, 128, seed, (c, w, h, rnd) => {
  c.fillStyle = "#2b2d31"; c.fillRect(0, 0, w, h);
  let x = 0;
  while (x < w) {
    const sw = 60 + rnd() * 40, k = 0.85 + rnd() * 0.3;
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, shade([124, 126, 130], k * 1.1)); g.addColorStop(1, shade([96, 99, 104], k * 0.8));
    c.fillStyle = g; c.fillRect(x + 1.5, 0, sw - 3, h);
    c.fillStyle = "rgba(255,255,255,0.07)"; c.fillRect(x + 1.5, 0, sw - 3, 4);
    x += sw;
  }
  mottle(c, w, h, rnd, 12, 0.5, 40); speckle(c, w, h, rnd, 700, 0.1);
});

// ---------------------------------------------------------------- masonry
/** Brick wall, 512 px = 3.0 m. Courses, per-brick tone, mortar, soot rising from the pavement. */
export const brick = (seed: number, col: [number, number, number], soot = 0.5) => tex(512, 512, seed, (c, w, h, rnd) => {
  c.fillStyle = hex(58, 55, 52); c.fillRect(0, 0, w, h);
  const rows = 26, rh = h / rows, bw = 62;
  for (let r = 0; r < rows; r++) {
    const y = r * rh, off = r % 2 ? bw * 0.5 : 0;
    for (let x = -bw; x < w + bw; x += bw) {
      const k = 0.78 + rnd() * 0.5, warm = rnd() < 0.18 ? 1.1 : 1;
      const g = c.createLinearGradient(0, y, 0, y + rh);
      g.addColorStop(0, shade([col[0] * warm, col[1] * warm, col[2] * warm], k * 1.12));
      g.addColorStop(1, shade([col[0], col[1], col[2]], k * 0.8));
      c.fillStyle = g; c.fillRect(x + off + 2, y + 2, bw - 4, rh - 3.4);
      if (rnd() < 0.1) { c.fillStyle = `rgba(230,228,220,${0.05 + rnd() * 0.08})`; c.fillRect(x + off + 3, y + 3, bw - 6, rh - 6); }
    }
  }
  // soot and rain streaks from the top, damp rising from the bottom
  const gs = c.createLinearGradient(0, 0, 0, h);
  gs.addColorStop(0, `rgba(26,26,30,${0.34 * soot})`); gs.addColorStop(0.45, `rgba(26,26,30,${0.1 * soot})`); gs.addColorStop(1, `rgba(18,20,26,${0.42 * soot})`);
  c.fillStyle = gs; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 14; i++) {
    const x = rnd() * w; c.fillStyle = `rgba(22,24,28,${0.06 + rnd() * 0.12})`;
    c.fillRect(x, 0, 3 + rnd() * 9, h * (0.3 + rnd() * 0.7));
  }
  mottle(c, w, h, rnd, 20, 0.4, 66); speckle(c, w, h, rnd, 2600, 0.09);
});

/** Rendered plaster / stucco, 512 px = 3.0 m: patchy, cracked, stained under the sills. */
export const plaster = (seed: number, col: [number, number, number], soot = 0.5) => tex(512, 512, seed, (c, w, h, rnd) => {
  c.fillStyle = hex(col[0], col[1], col[2]); c.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) {
    const x = rnd() * w, y = rnd() * h, rr = 20 + rnd() * 90, k = 0.86 + rnd() * 0.3;
    const g = c.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, shade(col, k).replace("rgb", "rgba").replace(")", `,${0.3 + rnd() * 0.4})`)); g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g; c.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  c.strokeStyle = "rgba(30,30,34,0.25)";
  for (let i = 0; i < 10; i++) { // hairline cracks
    c.lineWidth = 0.7 + rnd();
    let x = rnd() * w, y = rnd() * h;
    c.beginPath(); c.moveTo(x, y);
    for (let s = 0; s < 7; s++) { x += (rnd() - 0.5) * 40; y += 12 + rnd() * 26; c.lineTo(x, y); }
    c.stroke();
  }
  const gs = c.createLinearGradient(0, 0, 0, h);
  gs.addColorStop(0, `rgba(28,28,32,${0.3 * soot})`); gs.addColorStop(0.5, "rgba(28,28,32,0.04)"); gs.addColorStop(1, `rgba(16,18,24,${0.45 * soot})`);
  c.fillStyle = gs; c.fillRect(0, 0, w, h);
  mottle(c, w, h, rnd, 18, 0.3, 70); speckle(c, w, h, rnd, 2000, 0.08);
});

/** Slate roof, 512 px = 3.0 m: overlapping courses with a lit lower edge (the only place a night roof reads). */
export const slates = (seed = 47) => tex(512, 512, seed, (c, w, h, rnd) => {
  c.fillStyle = "#1b2026"; c.fillRect(0, 0, w, h);
  const rows = 12, rh = h / rows, sw = 54;
  for (let r = rows - 1; r >= 0; r--) {
    const y = r * rh, off = r % 2 ? sw * 0.5 : 0;
    for (let x = -sw; x < w + sw; x += sw) {
      const k = 0.8 + rnd() * 0.4, col: [number, number, number] = rnd() < 0.15 ? [86, 90, 96] : [56, 62, 72];
      c.fillStyle = shade(col, k);
      c.fillRect(x + off, y, sw - 2, rh - 1);
      c.fillStyle = `rgba(150,164,186,${0.06 + rnd() * 0.09})`;
      c.fillRect(x + off, y + rh - 4, sw - 2, 2.4);      // wet edge catching the sky
      c.fillStyle = "rgba(0,0,0,0.3)"; c.fillRect(x + off, y + rh - 1.6, sw - 2, 1.6);
    }
  }
  mottle(c, w, h, rnd, 16, 0.4, 60); speckle(c, w, h, rnd, 1400, 0.08);
});

// ---------------------------------------------------------------- the tram
const bodyGreen = "#1d3a33", bodyGreen2 = "#152c27", cream = "#cbb887", brass = "#b98b3f";

/** Lower body panel: 2048 px = 8.5 m. Beaded vertical panels, cream lining, gold pin-stripe, rivets, splash dirt. */
export const tramLower = (seed = 61) => tex(2048, 256, seed, (c, w, h, rnd) => {
  c.fillStyle = bodyGreen; c.fillRect(0, 0, w, h);
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(255,255,255,0.10)"); g.addColorStop(0.55, "rgba(255,255,255,0)"); g.addColorStop(1, "rgba(0,0,0,0.5)");
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 128) {  // beading
    c.fillStyle = "rgba(255,255,255,0.07)"; c.fillRect(x, 6, 2, h - 12);
    c.fillStyle = "rgba(0,0,0,0.35)"; c.fillRect(x + 2, 6, 3, h - 12);
  }
  c.fillStyle = cream; c.fillRect(0, 16, w, 9);                 // cream lining band
  c.fillStyle = "rgba(0,0,0,0.35)"; c.fillRect(0, 25, w, 3);
  c.fillStyle = brass; c.fillRect(0, 44, w, 3.4);               // gold pin-stripe
  c.fillStyle = "rgba(255,240,200,0.25)"; c.fillRect(0, 44, w, 1.2);
  for (let x = 20; x < w; x += 46) {                            // rivet rows
    const y = 12; const rr = 3.1;
    const rg = c.createRadialGradient(x - 0.9, y - 0.9, 0, x, y, rr);
    rg.addColorStop(0, "#e8d9ae"); rg.addColorStop(0.6, "#8e7440"); rg.addColorStop(1, "#2a2216");
    c.fillStyle = rg; c.beginPath(); c.arc(x, y, rr, 0, 7); c.fill();
  }
  c.fillStyle = "rgba(10,12,14,0.5)"; c.fillRect(0, h - 44, w, 44);   // road splash
  const sp = c.createLinearGradient(0, h - 70, 0, h);
  sp.addColorStop(0, "rgba(20,22,24,0)"); sp.addColorStop(1, "rgba(12,14,18,0.72)");
  c.fillStyle = sp; c.fillRect(0, h - 70, w, 70);
  for (let i = 0; i < 130; i++) { c.fillStyle = `rgba(30,26,20,${0.05 + rnd() * 0.14})`; c.fillRect(rnd() * w, h * 0.55 + rnd() * h * 0.45, 4 + rnd() * 40, 1 + rnd() * 3); }
  mottle(c, w, h, rnd, 40, 0.32, 60); speckle(c, w, h, rnd, 3000, 0.07);
});

/** Upper body panel above the windows: 2048 x 96 = 8.5 m x 0.40 m (241 px/m), green with the cream lining
 *  and small vent louvres. */
export const tramUpper = (seed = 67) => tex(2048, 96, seed, (c, w, h, rnd) => {
  c.fillStyle = bodyGreen2; c.fillRect(0, 0, w, h);
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(0,0,0,0.42)"); g.addColorStop(0.6, "rgba(255,255,255,0.05)"); g.addColorStop(1, "rgba(255,255,255,0.12)");
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = "rgba(0,0,0,0.4)"; c.fillRect(0, 0, w, 6);
  c.fillStyle = cream; c.fillRect(0, h - 16, w, 5);
  c.fillStyle = brass; c.fillRect(0, h - 8, w, 2);
  for (let x = 40; x < w; x += 210) {  // louvres
    c.fillStyle = "rgba(8,10,12,0.7)"; c.fillRect(x, 16, 74, 34);
    for (let k = 0; k < 4; k++) { c.fillStyle = "rgba(120,130,120,0.16)"; c.fillRect(x + 3, 19 + k * 8, 68, 2.2); }
  }
  mottle(c, w, h, rnd, 26, 0.3, 30); speckle(c, w, h, rnd, 900, 0.07);
});

/** The lit saloon: 2048 x 208 = 8.5 m x 0.86 m exactly (241 px/m), so the band maps 1:1 onto the geometry.
 *  Eight windows, warm interior, painted passengers, straps, condensation. This is an UNLIT material
 *  (MeshBasicMaterial) whose colour is pushed above 1 so the glass blooms. */
export const tramWindows = (seed = 71) => tex(2048, 208, seed, (c, w, h, rnd) => {
  c.fillStyle = bodyGreen; c.fillRect(0, 0, w, h);
  c.fillStyle = "rgba(0,0,0,0.4)"; c.fillRect(0, 0, w, 14);
  const n = 8, pad = 52, gw = (w - pad * 2 - (n - 1) * 34) / n;
  const warm = ["#ffcf8e", "#f7bd7c", "#e8ab6d", "#ffd79c", "#dfa165", "#f6c184", "#e6ae72", "#ffd090"];
  for (let i = 0; i < n; i++) {
    const x = pad + i * (gw + 34), y = 30, gwid = gw, ghei = h - 62;
    // window frame: dark timber with brass beading
    c.fillStyle = "#2a2018"; c.fillRect(x - 12, y - 12, gwid + 24, ghei + 24);
    c.fillStyle = "rgba(200,170,110,0.5)"; c.fillRect(x - 4, y - 4, gwid + 8, 3);
    // glass: warm interior gradient + painted interior detail
    const g = c.createLinearGradient(x, y, x, y + ghei);
    const base = warm[i];
    g.addColorStop(0, base); g.addColorStop(0.42, "#e8b173"); g.addColorStop(1, "#8a5c34");
    c.fillStyle = g; c.fillRect(x, y, gwid, ghei);
    // ceiling lamp glow at the top of the glass
    const lg = c.createRadialGradient(x + gwid * 0.5, y + 6, 0, x + gwid * 0.5, y + 6, gwid * 0.7);
    lg.addColorStop(0, "rgba(255,246,214,0.9)"); lg.addColorStop(1, "rgba(255,240,200,0)");
    c.fillStyle = lg; c.fillRect(x, y, gwid, ghei * 0.6);
    // horizontal handrail
    c.fillStyle = "rgba(120,72,30,0.85)"; c.fillRect(x, y + ghei * 0.3, gwid, 7);
    c.fillStyle = "rgba(255,225,170,0.35)"; c.fillRect(x, y + ghei * 0.3, gwid, 2);
    // hanging leather straps
    for (let s = 0; s < 3; s++) {
      const sx = x + gwid * (0.2 + s * 0.3) + rnd() * 6;
      c.fillStyle = "rgba(58,34,18,0.9)"; c.fillRect(sx, y + 4, 3, 46);
      c.beginPath(); c.ellipse(sx + 1.5, y + 54, 6, 8, 0, 0, 7); c.fill();
    }
    // seated passengers as warm silhouettes (they read as people through rain-blurred glass)
    const nseats = rnd() < 0.55 ? 2 : 1;
    for (let p = 0; p < nseats; p++) {
      const px = x + gwid * (0.24 + p * 0.48 + rnd() * 0.06), py = y + ghei * 0.60, sc = 0.85 + rnd() * 0.3;
      c.fillStyle = "rgba(38,22,12,0.86)";
      c.beginPath(); c.ellipse(px, py - 46 * sc, 20 * sc, 24 * sc, 0, 0, 7); c.fill();      // head
      c.beginPath();                                                                          // torso + shoulders
      c.moveTo(px - 34 * sc, py + 34 * sc); c.lineTo(px - 24 * sc, py - 20 * sc);
      c.lineTo(px + 24 * sc, py - 20 * sc); c.lineTo(px + 34 * sc, py + 34 * sc); c.closePath(); c.fill();
      if (rnd() < (i === 3 ? 0.9 : 0.35)) {   // a hat, because it is 1902
        c.fillStyle = "rgba(30,18,12,0.9)";
        c.beginPath(); c.ellipse(px, py - 62 * sc, 26 * sc, 7 * sc, 0, 0, 7); c.fill();
        c.fillRect(px - 15 * sc, py - 82 * sc, 30 * sc, 22 * sc);
      }
    }
    // a period card in one window
    if (i === 5) { c.fillStyle = "#e7dcc2"; c.fillRect(x + 10, y + 10, gwid * 0.32, ghei * 0.2); c.fillStyle = "#7a2f22"; c.fillRect(x + 14, y + 14, gwid * 0.32 - 8, 4); c.fillRect(x + 14, y + 24, gwid * 0.32 - 18, 3); }
    // condensation: dribbles down the glass and a blurred bloom at the edges
    for (let d = 0; d < 16; d++) { c.fillStyle = `rgba(255,240,215,${0.05 + rnd() * 0.12})`; c.fillRect(x + rnd() * gwid, y + rnd() * ghei * 0.5, 1 + rnd() * 2.4, 6 + rnd() * 60); }
    const cg = c.createLinearGradient(0, y, 0, y + ghei);
    cg.addColorStop(0, "rgba(255,240,210,0.22)"); cg.addColorStop(0.25, "rgba(255,240,210,0)"); cg.addColorStop(1, "rgba(20,12,6,0.34)");
    c.fillStyle = cg; c.fillRect(x, y, gwid, ghei);
    // rain running on the OUTSIDE of the glass
    for (let d = 0; d < 9; d++) {
      const dx = x + rnd() * gwid;
      c.strokeStyle = `rgba(230,240,255,${0.06 + rnd() * 0.1})`; c.lineWidth = 1 + rnd();
      c.beginPath(); c.moveTo(dx, y + rnd() * ghei * 0.3); c.lineTo(dx + (rnd() - 0.5) * 7, y + ghei * (0.5 + rnd() * 0.5)); c.stroke();
    }
  }
  // window pillars: green wood + brass beading
  for (let i = 0; i < n; i++) {
    const x = pad + i * (gw + 34) - 12;
    c.fillStyle = bodyGreen2; c.fillRect(x, 0, 12, h);
    c.fillStyle = "rgba(190,150,80,0.35)"; c.fillRect(x + 11, 0, 2, h);
  }
  mottle(c, w, h, rnd, 30, 0.22, 40);
});

/** The tram end: 512 wide x 700 tall. Dash panel, backlit route box, motorman's window, lifeguard slats. */
export const tramEnd = (seed = 73) => tex(512, 700, seed, (c, w, h, rnd) => {
  c.fillStyle = bodyGreen; c.fillRect(0, 0, w, h);
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(0,0,0,0.35)"); g.addColorStop(0.5, "rgba(255,255,255,0.06)"); g.addColorStop(1, "rgba(0,0,0,0.5)");
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  // motorman's window (upper centre)
  c.fillStyle = "#2a2018"; c.fillRect(96, 34, w - 192, 210);
  const wg = c.createLinearGradient(0, 34, 0, 244);
  wg.addColorStop(0, "#ffd79c"); wg.addColorStop(0.5, "#e0a86e"); wg.addColorStop(1, "#7d5228");
  c.fillStyle = wg; c.fillRect(106, 44, w - 212, 190);
  c.fillStyle = "rgba(40,24,12,0.85)";
  c.beginPath(); c.ellipse(w * 0.42, 150, 26, 30, 0, 0, 7); c.fill();     // the motorman, seen from behind
  c.beginPath(); c.moveTo(w * 0.42 - 44, 234); c.lineTo(w * 0.42 - 30, 138); c.lineTo(w * 0.42 + 30, 138); c.lineTo(w * 0.42 + 44, 234); c.closePath(); c.fill();
  c.fillStyle = "rgba(28,18,10,0.9)"; c.beginPath(); c.ellipse(w * 0.42, 122, 34, 9, 0, 0, 7); c.fill(); c.fillRect(w * 0.42 - 20, 100, 40, 24);
  c.fillStyle = "rgba(255,240,210,0.2)"; c.fillRect(106, 44, w - 212, 16);
  // where the driver stands, a wooden floor
  c.fillStyle = "#3a2a1c"; c.fillRect(120, 244, w - 240, 40);
  // route / destination box (backlit)
  c.fillStyle = "#241a10"; c.fillRect(w * 0.28, 296, w * 0.44, 74);
  const rb = c.createLinearGradient(0, 296, 0, 370);
  rb.addColorStop(0, "#ffe6b4"); rb.addColorStop(0.5, "#ffcf86"); rb.addColorStop(1, "#e0a44f");
  c.fillStyle = rb; c.fillRect(w * 0.28 + 6, 302, w * 0.44 - 12, 62);
  c.fillStyle = "#3a2410"; c.font = "bold 46px Georgia, serif"; c.textAlign = "center"; c.textBaseline = "middle";
  c.fillText("7", w * 0.4, 336);
  c.font = "bold 26px Georgia, serif"; c.fillText("DEPOT", w * 0.62, 336);
  // lower dash + panel joints
  c.fillStyle = cream; c.fillRect(0, 392, w, 8);
  c.fillStyle = brass; c.fillRect(0, 404, w, 3);
  for (let x = 0; x < w; x += 86) { c.fillStyle = "rgba(255,255,255,0.06)"; c.fillRect(x, 416, 2, h - 420); c.fillStyle = "rgba(0,0,0,0.3)"; c.fillRect(x + 2, 416, 3, h - 420); }
  // lifeguard slats (the cow-catcher)
  c.fillStyle = "#15181c"; c.fillRect(24, h - 210, w - 48, 200);
  for (let i = 0; i < 11; i++) {
    const y = h - 200 + i * 18;
    c.fillStyle = "#2c3138"; c.fillRect(28, y, w - 56, 12);
    c.fillStyle = "rgba(170,180,195,0.14)"; c.fillRect(28, y, w - 56, 3);
  }
  c.fillStyle = "rgba(10,12,16,0.6)"; c.fillRect(20, h - 26, w - 40, 26);
  mottle(c, w, h, rnd, 26, 0.34, 46); speckle(c, w, h, rnd, 1800, 0.08);
});

/** Roof: dark ribbed boards with a drain channel each side. */
export const tramRoof = (seed = 79) => tex(1024, 256, seed, (c, w, h, rnd) => {
  c.fillStyle = "#232a27"; c.fillRect(0, 0, w, h);
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(170,180,180,0.16)"); g.addColorStop(0.5, "rgba(255,255,255,0.03)"); g.addColorStop(1, "rgba(0,0,0,0.45)");
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 64) { c.fillStyle = "rgba(255,255,255,0.07)"; c.fillRect(x, 0, 2, h); c.fillStyle = "rgba(0,0,0,0.4)"; c.fillRect(x + 2, 0, 4, h); }
  // standing water on the roof, which is where the rain-on-metal comes from
  for (let i = 0; i < 12; i++) { const x = rnd() * w, y = rnd() * h, rr = 20 + rnd() * 60; const rg = c.createRadialGradient(x, y, 0, x, y, rr); rg.addColorStop(0, "rgba(120,150,175,0.2)"); rg.addColorStop(1, "rgba(0,0,0,0)"); c.fillStyle = rg; c.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  mottle(c, w, h, rnd, 20, 0.36, 50); speckle(c, w, h, rnd, 1200, 0.07);
});

/** Painted shop sign, board + serif lettering. Kept legible: the mesh carrying it is unlit (no side-sun wash). */
export const signBoard = (text: string, bg = "#2b2118", fg = "#e6cf9a", seed = 91) => tex(512, 128, seed, (c, w, h, rnd) => {
  c.fillStyle = bg; c.fillRect(0, 0, w, h);
  c.strokeStyle = fg; c.lineWidth = 3; c.globalAlpha = 0.6; c.strokeRect(9, 9, w - 18, h - 18); c.globalAlpha = 1;
  c.fillStyle = fg; c.textAlign = "center"; c.textBaseline = "middle";
  let size = 62; c.font = `bold ${size}px Georgia, serif`;
  while (c.measureText(text).width > w - 54 && size > 18) { size -= 2; c.font = `bold ${size}px Georgia, serif`; }
  c.fillText(text, w / 2, h / 2 + 2);
  mottle(c, w, h, rnd, 12, 0.4, 30); speckle(c, w, h, rnd, 500, 0.1);
});

// ---------------------------------------------------------------- sprites / gradients (unlit helpers)
/** soft radial glow, for lamp halos and light pools on the water */
export const radial = (seed = 101, pow = 1.9, tight = 1) => tex(256, 256, seed, (c, w, h) => {
  const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  for (let i = 0; i <= 16; i++) { const t = i / 16; g.addColorStop(t, `rgba(255,255,255,${Math.pow(1 - t, pow) * tight})`); }
  c.fillStyle = g; c.fillRect(0, 0, w, h);
}, undefined, false);

/** A wet-street reflection streak: bright across a narrow band, fading along its length. */
export const streak = (seed = 103) => tex(128, 512, seed, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(255,255,255,0.85)"); g.addColorStop(0.22, "rgba(255,255,255,0.5)");
  g.addColorStop(0.6, "rgba(255,255,255,0.16)"); g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  const xg = c.createLinearGradient(0, 0, w, 0);
  xg.addColorStop(0, "rgba(0,0,0,1)"); xg.addColorStop(0.5, "rgba(0,0,0,0)"); xg.addColorStop(1, "rgba(0,0,0,1)");
  c.globalCompositeOperation = "destination-out";
  const bands = 9;
  for (let i = 0; i < bands; i++) { const x = (i / bands) * w; c.fillStyle = `rgba(0,0,0,${0.24 + 0.3 * Math.abs(Math.sin(i * 1.7))})`; c.fillRect(x, 0, w / bands + 1, h); }
  c.globalCompositeOperation = "source-over";
  c.fillStyle = xg; c.globalCompositeOperation = "destination-out"; c.fillRect(0, 0, w * 0.16, h); c.fillRect(w * 0.84, 0, w * 0.16, h);
  c.globalCompositeOperation = "source-over";
}, undefined, false);

/** Rain streak sprite for a Points cloud (vertical, soft ends). */
export const rainStreak = (seed = 107) => tex(32, 128, seed, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.35, "rgba(255,255,255,0.75)");
  g.addColorStop(0.75, "rgba(255,255,255,0.95)"); g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g; c.fillRect(w * 0.36, 0, w * 0.28, h);
  c.filter = "blur(2px)"; c.drawImage(c.canvas, 0, 0); c.filter = "none";
}, undefined, false);

/** Expanding ring for water splashes. */
export const splashRing = (seed = 109) => tex(128, 128, seed, (c, w, h) => {
  const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.62, "rgba(255,255,255,0)");
  g.addColorStop(0.82, "rgba(255,255,255,0.9)"); g.addColorStop(0.93, "rgba(255,255,255,0.25)"); g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g; c.fillRect(0, 0, w, h);
}, undefined, false);

/** Rain on the camera lens: a few out-of-focus droplets. Sits 0.35 m in front of the lens, so the DOF smears it. */
export const lensRain = (seed = 113) => tex(512, 512, seed, (c, w, h, rnd) => {
  c.clearRect(0, 0, w, h);
  for (let i = 0; i < 26; i++) {
    const x = rnd() * w, y = rnd() * h, rr = 8 + rnd() * 30;
    const g = c.createRadialGradient(x - rr * 0.25, y - rr * 0.3, rr * 0.1, x, y, rr);
    g.addColorStop(0, "rgba(225,240,255,0.12)"); g.addColorStop(0.6, "rgba(160,190,225,0.07)");
    g.addColorStop(0.88, "rgba(20,30,48,0.30)"); g.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = g; c.beginPath(); c.ellipse(x, y, rr, rr * (0.7 + rnd() * 0.5), rnd() * 3, 0, 7); c.fill();
    if (rnd() < 0.4) { c.fillStyle = "rgba(255,255,255,0.10)"; c.beginPath(); c.arc(x - rr * 0.3, y - rr * 0.35, rr * 0.18, 0, 7); c.fill(); }
  }
  for (let i = 0; i < 400; i++) { c.fillStyle = `rgba(200,220,245,${rnd() * 0.05})`; c.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2); }
}, undefined, false);

/** Water-surface normal-ish detail: the flood sheet's ripple pattern (tiled, animated in the shader by time). */
export const waterDetail = (seed = 127) => tex(512, 512, seed, (c, w, h, rnd) => {
  c.fillStyle = "#808080"; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 220; i++) {
    const x = rnd() * w, y = rnd() * h, rr = 8 + rnd() * 54;
    const g = c.createRadialGradient(x, y, 0, x, y, rr);
    const up = rnd() < 0.5;
    g.addColorStop(0, up ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.22)"); g.addColorStop(1, "rgba(128,128,128,0)");
    c.fillStyle = g; c.fillRect(x - rr, y - rr, rr * 2, rr * 2);
  }
  c.filter = "blur(1.5px)"; c.drawImage(c.canvas, 0, 0); c.filter = "none";
}, undefined, false);
