// cast.ts — the three characters of "The Last Tram", drawn with the toon Pen, plus the paper boat.
// One owner: this file. Everything here is a flat cartoon card facing the camera; the light comes from the tram
// (screen-left, slightly above), so each figure is drawn with a warm inner rim on that side and a cool shade on
// the other. Poses are ANIMATED BY MOVING THE JOINTS, not by cross-dissolving two drawings (a dissolve would
// double-expose); a small library of joint poses is baked once at load and stepped through per frame.
import * as THREE from "three";
import { mulberry32, clamp, lerp, smoothstep, sat, STREET } from "./contract";
import { Pen, Card, makeCard, mix, CARD_CENTRE_Y, CARD_W_M, CARD_H, INK } from "./toon";
import { boyPos, ladyPos, conductorPos, boatPos, boatYaw, boatPhase, crouchAmt, BOY_KERB, doorWorldZ } from "./story";

type RGB = [number, number, number];
const L = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`;
/** night rule: the rim colour that the tram's lamps throw on an edge, and the cool body shade */
const RIM: RGB = [255, 206, 152];
const RIM2: RGB = [255, 178, 108];
const COOL = "rgba(24,32,54,0.46)";
const WARM = "rgba(255,196,132,0.22)";

// ============================================================================ the boy
const BOY: RGB = [188, 150, 122];          // face, hands
const BOY_HAIR: RGB = [56, 40, 30];
const COAT: RGB = [96, 76, 60];            // a coat that was somebody else's first
const COAT_D: RGB = [58, 45, 36];
const PATCH: RGB[] = [[132, 106, 74], [78, 96, 84], [118, 88, 92]];
const SHORTS: RGB = [66, 62, 70];
const SOCK: RGB = [104, 100, 92];
const BOOT: RGB = [46, 42, 40];

/** The boy, 1.14 m (570 px). t = 0 standing at the kerb, t = 1 crouched, setting the boat on the water. */
function drawBoy(p: Pen, rnd: () => number, t: number) {
  const c = clamp(t, 0, 1);
  const j = (a: number[], b: number[]) => [lerp(a[0], b[0], c), lerp(a[1], b[1], c)] as [number, number];
  const hip = j([252, 742], [256, 800]);
  const kneeL = j([230, 862], [204, 868]), footL = j([224, 976], [212, 976]);
  const kneeR = j([274, 862], [306, 868]), footR = j([282, 976], [296, 976]);
  const sh = j([248, 606], [252, 684]);
  const elbL = j([212, 666], [204, 728]), handL = j([202, 718], [230, 764]);
  const elbR = j([288, 666], [298, 728]), handR = j([300, 718], [274, 764]);
  const neck = j([250, 592], [254, 672]);
  const head = j([250, 508], [254, 592]);
  const hr = 66, tilt = -6 - 10 * c;

  const rim = (pts: [number, number][], w = 5) => p.lit(pts, L(RIM), w, -5, -4, COOL, 6, 5);

  // ---- back arm
  const armB = p.taper(elbR[0], elbR[1], 15, handR[0], handR[1], 11, L([72, 58, 46]), 3.2);
  rim(armB, 3);
  p.ell(handR[0], handR[1], 12, 12, 0, L([150, 118, 96]), 3);

  // ---- legs
  for (const [k, ft, side] of [[kneeL, footL, -1], [kneeR, footR, 1]] as Array<[[number, number], [number, number], number]>) {
    const th = p.taper(hip[0] + side * 16, hip[1], 24, k[0], k[1], 17, L(SOCK), 3.2);
    rim(th, 3.4);
    const sh2 = p.taper(k[0], k[1], 17, ft[0], ft[1] - 12, 15, L(SOCK), 3.2);
    rim(sh2, 3);
  }
  // boots
  for (const ft of [footL, footR]) {
    const bt: [number, number][] = [[ft[0] - 19, ft[1] - 20], [ft[0] + 17, ft[1] - 22], [ft[0] + 24, ft[1] + 6], [ft[0] - 22, ft[1] + 8]];
    p.shape(bt, L(BOOT), 3.4);
    rim(bt, 3);
    p.bar(ft[0] - 20, ft[1] - 4, ft[0] + 20, ft[1] - 4, 3, "rgba(20,18,20,0.7)", 0);   // sole line
  }

  // ---- torso: a coat far too big, hem to the knees, collar up
  const coat: [number, number][] = [
    [hip[0] - 46, hip[1] + 34], [hip[0] - 56, hip[1] - 12], [sh[0] - 40, sh[1] - 8], [sh[0] - 30, sh[1] - 18],
    [sh[0] + 34, sh[1] - 20], [sh[0] + 46, sh[1] - 6], [hip[0] + 52, hip[1] - 10], [hip[0] + 44, hip[1] + 34],
  ];
  p.shape(coat, L(COAT), 3.6);
  rim(coat, 6);
  // hem shadow + patches + buttons + a rope belt + a big pocket
  p.inside(coat, "rgba(20,16,14,0.34)");
  for (let i = 0; i < 3; i++) {
    const px = sh[0] + (i - 1) * 26 + rnd() * 8, py = hip[1] - 20 + rnd() * 26 + i * 6;
    p.shape([[px - 13, py - 11], [px + 12, py - 14], [px + 14, py + 12], [px - 12, py + 10]], L(PATCH[i]), 2.6);
    for (let s = 0; s < 4; s++) p.bar(px - 11 + s * 7, py - 12, px - 9 + s * 7, py + 11, 1.4, "rgba(30,24,20,0.6)", 0);
  }
  p.shape([[sh[0] - 44, sh[1] - 4], [sh[0] - 20, sh[1] + 6], [sh[0] + 30, sh[1] + 8], [sh[0] + 44, sh[1] - 2], [sh[0] + 44, sh[1] + 12], [sh[0] - 44, sh[1] + 12]], "rgba(40,32,24,0.85)", 2.6);
  for (let i = 0; i < 4; i++) p.ell(sh[0] - 6 + i * 14, sh[1] + 26 + i * 12, 5.5, 5.5, 0, "#3a2c20", 2.4); // buttons
  p.bar(hip[0] - 40, hip[1] - 46, hip[0] + 40, hip[1] - 40, 4.5, "#6b5636", 3.0);                        // belt
  p.shape([[sh[0] + 22, hip[1] - 34], [sh[0] + 54, hip[1] - 36], [sh[0] + 52, hip[1] - 4], [sh[0] + 20, hip[1] - 6]], L([80, 62, 48]), 3);
  // collar turned up, a thin scarf with a loose end
  p.shape([[sh[0] - 42, sh[1] - 6], [sh[0] - 34, sh[1] - 40], [sh[0] - 4, sh[1] - 26], [sh[0] + 4, sh[1] - 40], [sh[0] + 38, sh[1] - 6]], L(COAT_D), 3.4);
  const scarf = p.taper(sh[0] + 6, sh[1] - 22, 11, sh[0] + 62, sh[1] + 40 + 8 * Math.sin(1.1), 7, L([126, 74, 68]), 3.0);
  rim(scarf, 2.6);

  // ---- front arm
  const ua = p.taper(sh[0] - 34, sh[1] + 4, 17, elbL[0], elbL[1], 14, L(COAT), 3.4);
  rim(ua, 4);
  const fa = p.taper(elbL[0], elbL[1], 14, handL[0], handL[1], 11, L(COAT), 3.4);
  rim(fa, 3.4);
  p.ell(handL[0], handL[1], 12.5, 12.5, 0, L(BOY), 3.2);

  // ---- head
  const hd = p.ell(head[0], head[1], hr, hr * 0.96, tilt, L(BOY), 3.6);
  p.lit(hd, L(RIM2), 7, -6, -5, COOL, 8, 7);
  // face: eyes up (he is watching the tram's lamp), a small nose, an open mouth
  const ex = head[0] + 2, ey = head[1] + 4 + 6 * c;
  for (const s of [-1, 1]) {
    p.ell(ex + s * 17, ey, 7.4, 9.2 + 1.4 * c, 0, "#f2ece0", 2.4);
    p.ell(ex + s * 17 - 1.2, ey - 4 - 3 * c, 4.4, 5.0, 0, "#241c26", 0);
  }
  p.bar(ex - 22, ey - 15, ex - 9, ey - 17, 2.6, "#3a2a22", 0);
  p.bar(ex + 9, ey - 17, ex + 22, ey - 15, 2.6, "#3a2a22", 0);
  p.shape([[ex - 3, ey + 12], [ex + 3, ey + 12], [ex + 2, ey + 19], [ex - 2, ey + 19]], "rgba(120,88,70,0.55)", 0);
  p.ell(ex, ey + 30 + 2 * c, 7 + 3 * c, 5 + 4 * c, 0, "#40202a", 2.2);
  p.bar(ex - 12, ey + 22, ex - 24, ey + 34, 2.4, "rgba(30,22,20,0.7)", 0);     // cheek smudge
  // a fringe of hair and the flat cap, a size too big, brim slightly up
  p.shape([[head[0] - hr - 2, head[1] - 14], [head[0] - hr + 6, head[1] - 40], [head[0] - 12, head[1] - 52], [head[0] + 22, head[1] - 50], [head[0] + hr - 4, head[1] - 30], [head[0] + hr + 2, head[1] - 6]], L(BOY_HAIR), 3.0);
  const cap: [number, number][] = [
    [head[0] - hr - 8, head[1] - 26], [head[0] - hr - 16, head[1] - 46], [head[0] - 40, head[1] - 74],
    [head[0] + 30, head[1] - 76], [head[0] + hr + 2, head[1] - 44], [head[0] + hr + 6, head[1] - 26],
  ];
  p.shape(cap, L([74, 60, 50]), 3.6);
  p.lit(cap, L(RIM), 6, -5, -6, COOL, 6, 6);
  p.shape([[head[0] - hr - 18, head[1] - 30], [head[0] + hr + 8, head[1] - 30], [head[0] + hr + 4, head[1] - 16], [head[0] - hr - 22, head[1] - 18]], L([56, 44, 38]), 3.2); // the brim
  p.bar(head[0] - 12, head[1] - 76, head[0] + 12, head[1] - 77, 3, L([44, 34, 28]), 0);
  p.ell(head[0] + 2, head[1] - 78, 5, 5, 0, L([128, 104, 70]), 2.2);  // the button on top

  // ---- the paper boat, carried in both hands and set down when he crouches
  const bx = c < 0.5 ? handL[0] + 26 : (handL[0] + handR[0]) / 2;
  const by = c < 0.5 ? handL[1] - 4 : (handL[1] + handR[1]) / 2 + 2;
  paperBoatFlat(p, bx, by, c > 0.5 ? 62 : 54, 0.3 * Math.PI, rnd, 1);
}

/** The paper boat in 2D (for the card) and in 3D (for the water) share this silhouette. */
export function paperBoatFlat(p: Pen, x: number, y: number, w: number, rot: number, rnd: () => number, inkW = 3) {
  const h = w * 0.42;
  const c = p.c, cos = Math.cos(rot), sin = Math.sin(rot);
  const T = (dx: number, dy: number): [number, number] => [x + dx * cos - dy * sin, y + dx * sin + dy * cos];
  const bow = T(0, 0), port = T(-w / 2, h * 0.5), stern = T(0, h * 0.75), star = T(w / 2, h * 0.5);
  const sailL = T(-w * 0.24, h * 0.5), tip = T(0, -h * 0.42), sailR = T(w * 0.24, h * 0.5), mid = T(0, h * 0.16);
  // hull: the classic two-panel fold, plus the sail fold standing up in the middle
  p.shape([port, bow, star, stern], "#ded4bc", inkW);
  p.shape([port, bow, mid], "#f0e8d4", inkW * 0.8);
  p.shape([bow, star, mid], "#cbc0a6", inkW * 0.8);
  p.shape([sailL, tip, sailR, mid], "#f4ecd8", inkW * 0.9);
  p.shape([sailL, tip, mid], "#e2d8c0", inkW * 0.7);
  p.bar(port[0], port[1], bow[0], bow[1], 1.6, "rgba(90,74,56,0.5)", 0);
  p.bar(bow[0], bow[1], star[0], star[1], 1.6, "rgba(90,74,56,0.5)", 0);
  void rnd;
}

// ============================================================================ the lady
const COATC: RGB = [92, 44, 54];          // oxblood, which is the only saturated thing in the film
const COATC_D: RGB = [40, 20, 28];
const FUR: RGB = [42, 36, 40];
const LADY_SKIN: RGB = [202, 168, 146];
const UMB: RGB = [34, 32, 40];

/** The lady, 1.66 m (830 px), crossing the flood with a big black umbrella. ph = walk phase 0..1. */
function drawLady(p: Pen, rnd: () => number, ph: number) {
  const sw = Math.sin(ph * Math.PI * 2), cw = Math.cos(ph * Math.PI * 2);
  const hip: [number, number] = [250, 690];
  const bob = Math.abs(sw) * 3.5;
  hip[1] -= bob;
  const footF: [number, number] = [250 + sw * 40, 976 - Math.max(0, sw) * 16];
  const footB: [number, number] = [250 - sw * 40, 976 - Math.max(0, -sw) * 16];
  const kneeF: [number, number] = [(hip[0] + footF[0]) / 2 + 6 * sw, 836 - bob];
  const kneeB: [number, number] = [(hip[0] + footB[0]) / 2 - 6 * sw, 836 - bob];
  const sh: [number, number] = [248, 384 - bob * 0.5];
  const neck: [number, number] = [250, 366 - bob * 0.5];
  const head: [number, number] = [252, 252 - bob * 0.5];
  const rim = (pts: [number, number][], w = 6) => p.lit(pts, L(RIM), w, -5, -4, COOL, 7, 5);

  // ---- back leg
  p.taper(hip[0] - 12, hip[1], 26, kneeB[0], kneeB[1], 18, L([52, 36, 40]), 3.0);
  p.ell(footB[0], footB[1] - 12, 20, 14, 0, L([32, 28, 30]), 3.4);
  p.bar(footB[0] - 18, footB[1] + 2, footB[0] + 20, footB[1] + 2, 3, "#191618", 0);
  p.bar(footB[0] + 10, footB[1] + 8, footB[0] + 14, footB[1] + 22, 3.4, "#191618", 0); // heel
  // ---- the coat: long, nipped in at the waist, hem heavy with water
  const coat: [number, number][] = [
    [hip[0] - 78, 930 + (footB[1] - 976) * 0.3], [hip[0] - 56, 800], [hip[0] - 44, 690], [sh[0] - 46, sh[1] + 26],
    [sh[0] - 30, sh[1] - 4], [sh[0] + 30, sh[1] - 4], [sh[0] + 46, sh[1] + 26], [hip[0] + 44, 690],
    [hip[0] + 56, 800], [hip[0] + 80, 930 + (footF[1] - 976) * 0.3],
  ];
  p.shape(coat, L(COATC), 3.8);
  rim(coat, 7);
  p.inside(coat, "rgba(16,10,14,0.34)");                                   // wet, and the water drags the hem dark
  p.shape([[hip[0] - 78, 906], [hip[0] + 80, 906], [hip[0] + 78, 946], [hip[0] - 74, 946]], "rgba(10,8,12,0.5)", 0);
  for (let i = 0; i < 9; i++) p.ell(hip[0] - 12 + i * 12, 822 + rnd() * 8, 4.6, 4.6, 0, "#2a2026", 2.2);  // button row
  p.bar(hip[0] - 44, 686, hip[0] + 44, 686, 5.5, "rgba(28,18,24,0.9)", 2.4);                              // belt
  p.shape([[sh[0] - 34, sh[1] + 4], [sh[0] - 12, sh[1] + 26], [sh[0] - 6, sh[1] - 6]], L(COATC_D), 2.8);   // lapel
  // ---- fur collar
  const fur = p.ell(sh[0], sh[1] - 4, 54, 17, -3, L(FUR), 3.4);
  for (let i = 0; i < 14; i++) p.bar(sh[0] - 50 + i * 7, sh[1] - 12 + Math.sin(i) * 3, sh[0] - 46 + i * 7, sh[1] + 4, 2, "rgba(70,60,64,0.5)", 0);
  p.lit(fur, L(RIM), 6, -5, -5, "", 0, 0);
  // ---- front leg
  p.taper(hip[0] + 12, hip[1], 26, kneeF[0], kneeF[1], 18, L([62, 42, 46]), 3.0);
  p.ell(footF[0], footF[1] - 12, 21, 14, 0, L([40, 34, 36]), 3.4);
  p.bar(footF[0] - 19, footF[1] + 2, footF[0] + 21, footF[1] + 2, 3, "#191618", 0);
  // ---- the umbrella: tilted into the rain, held in the near hand
  const umbTilt = -0.22 - 0.06 * Math.sin(ph * Math.PI * 2);
  const hand: [number, number] = [sh[0] + 58, sh[1] + 66 - cw * 6];
  const shaftTop: [number, number] = [hand[0] - 66, hand[1] - 220];
  p.bar(hand[0], hand[1], shaftTop[0], shaftTop[1], 5, "#3a3026", 3.0);
  p.ell(hand[0], hand[1] - 4, 14, 15, 0, L([46, 38, 40]), 3.2);       // her glove
  const cx = shaftTop[0], cy = shaftTop[1] - 6, rw = 210, rh = 62;
  const canopy: [number, number][] = [];
  for (let i = 0; i <= 18; i++) { const a = Math.PI * (1 - i / 18); canopy.push([cx + Math.cos(a) * rw, cy + Math.sin(a) * -rh + umbTilt * (i - 9) * 3]); }
  canopy.push([cx + rw, cy + 30]); canopy.push([cx - rw, cy + 30]);
  p.shape(canopy, L(UMB), 4.0);
  p.lit(canopy, L(RIM2), 8, -6, -7, "rgba(10,10,16,0.4)", 6, 8);
  for (let i = 0; i <= 6; i++) {                                     // ribs + the drip edges
    const a = Math.PI * (1 - i / 6);
    p.bar(cx, cy + 6, cx + Math.cos(a) * rw, cy + Math.sin(a) * -rh + umbTilt * (i - 3) * 3 + 26, 2.2, "rgba(150,150,160,0.28)", 0);
  }
  p.bar(cx, cy - 8, cx, cy + 40, 5.5, "#403828", 3.0);               // ferrule
  p.ell(cx, cy + 42, 13, 8, 0, "#5a4c34", 3.2);
  for (let i = 0; i < 12; i++) { const a = Math.PI * (1 - i / 11); p.bar(cx + Math.cos(a) * rw * 0.98, cy + Math.sin(a) * -rh + 24, cx + Math.cos(a) * rw * 1.02, cy + Math.sin(a) * -rh + 40 + rnd() * 26, 1.8, "rgba(190,215,240,0.3)", 0); }
  // ---- head, hat, veil
  const hd = p.ell(head[0], head[1], 62, 68, -4, L(LADY_SKIN), 3.6);
  p.lit(hd, L(RIM2), 7, -6, -6, COOL, 8, 7);
  p.ell(head[0] + 6, head[1] + 2, 5.4, 6.4, 0, "#2a2026", 2.2);
  p.ell(head[0] + 28, head[1] + 2, 5.0, 6.0, 0, "#2a2026", 2.2);
  p.shape([[head[0] + 20, head[1] + 14], [head[0] + 34, head[1] + 30], [head[0] + 26, head[1] + 32]], "rgba(150,110,96,0.7)", 1.8);
  p.bar(head[0] + 12, head[1] + 44, head[0] + 36, head[1] + 42, 2.6, "#4a2530", 0);
  const hat: [number, number][] = [[head[0] - 74, head[1] - 34], [head[0] + 66, head[1] - 40], [head[0] + 58, head[1] - 20], [head[0] - 78, head[1] - 16]];
  p.shape(hat, L([44, 32, 36]), 3.6);
  p.shape([[head[0] - 30, head[1] - 40], [head[0] + 18, head[1] - 46], [head[0] + 20, head[1] - 96], [head[0] - 30, head[1] - 100]], L([54, 40, 44]), 3.4);
  p.lit([[head[0] - 30, head[1] - 40], [head[0] + 18, head[1] - 46], [head[0] + 20, head[1] - 96], [head[0] - 30, head[1] - 100]], L(RIM), 5, -4, -5, COOL, 5, 5);
  p.bar(head[0] - 34, head[1] - 52, head[0] + 22, head[1] - 54, 7, "#5c2a34", 2.6);   // hat band
  p.bar(head[0] + 34, head[1] - 88, head[0] + 76, head[1] - 128, 4, "#8a7050", 2.4);  // feather
  p.bar(head[0] + 40, head[1] - 92, head[0] + 82, head[1] - 134, 2.4, "rgba(190,164,120,0.7)", 0);
  void cw;
}

// ============================================================================ the conductor
const NAVY: RGB = [44, 54, 78];
const NAVY_D: RGB = [24, 30, 46];
const BRASS: RGB = [198, 160, 88];

/** The conductor, 1.74 m (870 px): drawn full height then CROPPED at the waist by the caller, because he leans
 *  out of the doorway and only his upper half should be in front of the tram side. b = beckon (0 watch, 1 come on). */
function drawConductor(p: Pen, rnd: () => number, b: number) {
  const bb = clamp(b, 0, 1);
  const hip: [number, number] = [250, 690];
  const sh: [number, number] = [246, 356];
  const head: [number, number] = [248, 236];
  const rim = (pts: [number, number][], w = 6) => p.lit(pts, L(RIM2), w, -5, -5, "rgba(20,26,44,0.4)", 7, 6);
  // legs (cropped away later, but drawn so the coat reads)
  p.taper(hip[0] - 16, hip[1], 28, 232, 976, 19, L(NAVY_D), 3.0);
  p.taper(hip[0] + 16, hip[1], 28, 272, 976, 19, L(NAVY_D), 3.0);
  // tunic: double breasted, nipped, with a skirt to the hip
  const tunic: [number, number][] = [
    [hip[0] - 58, hip[1] + 16], [hip[0] - 52, hip[1] - 40], [hip[0] - 46, 520], [sh[0] - 52, sh[1] + 22],
    [sh[0] - 30, sh[1] - 8], [sh[0] + 30, sh[1] - 8], [sh[0] + 52, sh[1] + 22], [hip[0] + 46, 520],
    [hip[0] + 52, hip[1] - 40], [hip[0] + 58, hip[1] + 16],
  ];
  p.shape(tunic, L(NAVY), 3.8);
  rim(tunic, 7);
  p.inside(tunic, "rgba(12,16,30,0.3)");
  for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) {
    const bx = sh[0] - 22 + r * 40, by = 400 + i * 54;
    p.ell(bx, by, 7, 7, 0, L(BRASS), 2.6);
    p.ell(bx, by, 3, 3, 0, "rgba(255,240,190,0.6)", 0);
  }
  p.bar(hip[0] - 56, hip[1] - 46, hip[0] + 56, hip[1] - 44, 6, "#20263a", 2.6);      // belt
  p.ell(hip[0] + 6, hip[1] - 46, 12, 12, 0, L(BRASS), 3.0);                          // buckle
  p.ell(hip[0] - 20, hip[1] - 26, 16, 16, 0, "rgba(120,112,96,0.9)", 3.0);           // the ticket punch in its pocket
  p.bar(hip[0] - 30, hip[1] - 40, hip[0] - 4, hip[1] + 22, 2.4, "rgba(232,224,196,0.55)", 0);  // watch chain
  p.ell(hip[0] - 2, hip[1] + 20, 9, 11, 0, L(BRASS), 2.8);
  // collar, bow tie, epaulettes
  p.shape([[sh[0] - 34, sh[1] + 6], [sh[0] - 16, sh[1] - 30], [sh[0] + 2, sh[1] - 6], [sh[0] + 20, sh[1] - 30], [sh[0] + 36, sh[1] + 6]], "#e8e2d0", 3.2);
  p.ell(sh[0], sh[1] + 6, 15, 9, 0, "#7a2430", 2.6);
  for (const s of [-1, 1]) p.shape([[sh[0] + s * 30, sh[1] + 4], [sh[0] + s * 54, sh[1] + 2], [sh[0] + s * 56, sh[1] + 16], [sh[0] + s * 30, sh[1] + 18]], L(NAVY_D), 3.0);
  // far arm: holds the grab handle by the door
  const fa = p.taper(sh[0] + 44, sh[1] + 18, 19, sh[0] + 74, 470, 14, L(NAVY), 3.4);
  rim(fa, 4);
  p.ell(sh[0] + 78, 456, 15, 15, 0, "#ddd8c8", 3.2);
  // near arm: hanging, then raised and beckoning (the boy is out in the water, so the gesture has to carry)
  const elb: [number, number] = [sh[0] - 74 - 6 * bb, sh[1] + 90 - 120 * bb];
  const hand: [number, number] = [sh[0] - 96 + 76 * bb, sh[1] + 150 - 320 * bb];
  const ua = p.taper(sh[0] - 44, sh[1] + 20, 20, elb[0], elb[1], 15, L(NAVY), 3.6);
  rim(ua, 4.4);
  const fore = p.taper(elb[0], elb[1], 15, hand[0], hand[1], 12, L(NAVY), 3.4);
  rim(fore, 3.6);
  p.ell(hand[0], hand[1], 17, 17, 0, "#e6e0d0", 3.4);                                // white glove
  p.ell(hand[0] - 3, hand[1] - 7, 8, 7, -20 * bb, "#e6e0d0", 2.2);
  // head: a big walrus moustache, a peaked cap, a badge
  const hd = p.ell(head[0], head[1], 60, 66, 2, L([198, 156, 130]), 3.6);
  rim(hd, 7);
  p.ell(head[0] + 6, head[1] - 4, 5.6, 6.6, 0, "#241c22", 2.2);
  p.ell(head[0] + 30, head[1] - 4, 5.0, 6.0, 0, "#241c22", 2.2);
  p.bar(head[0] - 20, head[1] - 20, head[0] - 6, head[1] - 24, 3, "#3a2c26", 0);
  p.bar(head[0] + 14, head[1] - 24, head[0] + 28, head[1] - 20, 3, "#3a2c26", 0);
  p.shape([[head[0] - 6, head[1] + 10], [head[0] + 6, head[1] + 10], [head[0] + 4, head[1] + 20], [head[0] - 4, head[1] + 20]], "rgba(140,100,84,0.6)", 0);
  const mo: [number, number][] = [[head[0] - 34, head[1] + 28], [head[0] - 12, head[1] + 26], [head[0], head[1] + 34], [head[0] + 12, head[1] + 26], [head[0] + 34, head[1] + 28], [head[0] + 30, head[1] + 44], [head[0], head[1] + 50], [head[0] - 30, head[1] + 44]];
  p.shape(mo, "#cfc6b4", 3.0);
  p.lit(mo, L(RIM), 4, -4, -4, "", 0, 0);
  const cap: [number, number][] = [[head[0] - 62, head[1] - 34], [head[0] - 52, head[1] - 74], [head[0] - 20, head[1] - 92], [head[0] + 30, head[1] - 90], [head[0] + 56, head[1] - 66], [head[0] + 60, head[1] - 34]];
  p.shape(cap, L(NAVY), 3.8);
  rim(cap, 6);
  p.shape([[head[0] - 76, head[1] - 34], [head[0] + 52, head[1] - 40], [head[0] + 48, head[1] - 18], [head[0] - 80, head[1] - 16]], L(NAVY_D), 3.4);
  p.shape([[head[0] - 74, head[1] - 22], [head[0] + 46, head[1] - 28], [head[0] + 44, head[1] - 42], [head[0] - 72, head[1] - 36]], L(BRASS), 2.6);
  p.ell(head[0] - 4, head[1] - 60, 15, 13, 0, L(BRASS), 2.8);
  p.ell(head[0] - 4, head[1] - 60, 7, 6, 0, "#3a2a18", 1.8);
  void rnd;
}

// ============================================================================ assembly
const POSE = { boy: 7, lady: 8, cond: 5 };

export class Cast {
  root = new THREE.Group();
  private boy: Card[] = [];
  private lady: Card[] = [];
  private cond: Card[] = [];
  private boat: THREE.Mesh;
  private boatMat: THREE.MeshBasicMaterial;

  constructor() {
    for (let i = 0; i < POSE.boy; i++) this.boy.push(makeCard((p, r) => drawBoy(p, r, i / (POSE.boy - 1)), 200 + i, `boy${i}`));
    for (let i = 0; i < POSE.lady; i++) this.lady.push(makeCard((p, r) => drawLady(p, r, i / POSE.lady), 300 + i, `lady${i}`));
    // the conductor is cropped at canvas y = 560 (his chest): only the part above the doorway sill is kept, so
    // the card can stand in front of the tram side without a leg hanging down through the panelling.
    for (let i = 0; i < POSE.cond; i++) this.cond.push(makeCard((p, r) => { drawConductor(p, r, i / (POSE.cond - 1)); p.c.clearRect(0, 560, 512, CARD_H - 560); }, 400 + i, `cond${i}`));
    for (const c of [...this.boy, ...this.lady, ...this.cond]) { c.mat.depthWrite = true; c.mesh.visible = false; this.root.add(c.mesh); }
    // ---- the paper boat: eight triangles of cream paper with a real ink outline (world geometry, not a card)
    const v = (x: number, y: number, z: number) => [x, y, z] as [number, number, number];
    const bow = v(0, 0.028, 0.085), stern = v(0, 0.028, -0.085), keel = v(0, -0.012, 0);
    const port = v(-0.05, 0.052, 0), star = v(0.05, 0.052, 0), tip = v(0, 0.106, 0), mid = v(0, 0.052, 0);
    const tri = [bow, keel, stern, bow, port, keel, port, stern, keel, bow, keel, star, keel, stern, star, port, tip, mid, tip, star, mid, port, bow, mid, bow, star, mid];
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(tri.flat(), 3));
    g.computeVertexNormals();
    this.boatMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.18, 1.11, 0.94), side: THREE.DoubleSide, toneMapped: false });
    this.boat = new THREE.Mesh(g, this.boatMat);
    this.boat.scale.setScalar(1);
    this.root.add(this.boat);
  }

  /** pose index from a continuous 0..1 parameter, stepped (the poses are baked, so no dissolve is needed) */
  private static idx(t: number, n: number) { return Math.min(n - 1, Math.max(0, Math.round(sat(t) * (n - 1)))); }

  update(f: number, cam: THREE.Camera) {
    const q = cam.quaternion;
    const place = (card: Card, x: number, y: number, z: number, sc = 1, tint: [number, number, number] = [1, 1, 1]) => {
      card.mesh.visible = true;
      card.mesh.position.set(x, y + CARD_CENTRE_Y, z);
      card.mesh.quaternion.copy(q);
      card.mesh.scale.setScalar(sc);
      // the grades are baked into the palette already; the tint only carries the lamp flicker and the fall-off
      card.mat.color.setRGB(tint[0], tint[1], tint[2]);
    };
    const flick = 1 + 0.045 * Math.sin(f * 1.7) + 0.03 * Math.sin(f * 0.53 + 2.1);

    // ---- the boy
    for (const c of this.boy) c.mesh.visible = false;
    {
      const t = crouchAmt(f);
      const bi = Cast.idx(t, POSE.boy);
      const P = boyPos(f);
      // 1.02, not 1.15: at 3.6-5 m he was the hottest thing in a night scene and read as a sticker
      const near = clamp(1.02 - 0.10 * t, 0, 1.3);
      const out = new THREE.Vector3(P.x, 0.02, P.z);
      place(this.boy[bi], out.x, out.y, out.z, 1, [near * flick, near * 0.97 * flick, near * 0.92 * flick]);
    }
    // ---- the lady: walk phase from the distance she has actually covered, so her feet never slide
    for (const c of this.lady) c.mesh.visible = false;
    {
      const P = ladyPos(f);
      const dist = Math.abs(P.x - ladyPos(150).x) + Math.abs(P.z - ladyPos(150).z);
      const ph = dist / 0.88;
      place(this.lady[Math.floor(ph) % POSE.lady], P.x, STREET.waterY * 0.4, P.z, 1, [1.0 * flick, 0.95 * flick, 0.9 * flick]);
    }
    // ---- the conductor: he only exists once the tram has stopped, and he beckons from f = 318
    for (const c of this.cond) c.mesh.visible = false;
    if (f > 286) {
      const P = conductorPos(f);
      const b = smoothstep(318, 344, f) * (1 - smoothstep(372, 392, f));
      const c = this.cond[Cast.idx(b, POSE.cond)];
      // 0.31 puts his cropped chest edge at the doorway sill, so he reads as leaning out of the opening
      place(c, P.x, 0.31, P.z, 1, [1.34 * flick, 1.24 * flick, 1.1 * flick]);
    }
    // ---- the boat
    const B = boatPos(f);
    const held = 1 - boatPhase(f);
    this.boat.position.copy(B);
    if (held > 0.01) { const P = boyPos(f); this.boat.position.set(lerp(B.x, P.x + 0.02, held), lerp(B.y, 0.62, held), lerp(B.z, P.z - 0.22, held)); }
    this.boat.rotation.set(0, boatYaw(f), 0.06 * Math.sin(f * 0.9) - 0.18 * held);
    this.boat.rotation.x = 0.09 * Math.sin(f * 0.63 + 0.7);
    this.boatMat.color.setRGB(1.18 * (0.85 + 0.15 * flick), 1.11 * (0.85 + 0.15 * flick), 0.94 * (0.85 + 0.15 * flick));
  }

  dispose() { for (const c of [...this.boy, ...this.lady, ...this.cond]) c.dispose(); this.boat.geometry.dispose(); this.boatMat.dispose(); }
  /** the boat is a ripple source on the water */
  boatAt(f: number) { return boatPos(f); }
  boyAt(f: number) { return boyPos(f); }
  ladyAt(f: number) { return ladyPos(f); }
  kerb() { return BOY_KERB; }
  doorZ(f: number) { return doorWorldZ(f); }
  static _unused = { mix, INK, mulberry32 };
}
