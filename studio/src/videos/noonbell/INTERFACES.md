# "Pip and the Noon Bell" — module interfaces (v1, frozen)

Read `contract.ts` first — it is the single source of shared numbers. **Do not invent layout numbers, times or
character positions that are already in `contract.ts`.** Every module here is a copy-and-adapt of the matching file in
`../bridge/` (which is our working implementation of `references/reports/*.md`). Read the reference report named for
your file before writing.

Film: 1080×1920, 30 fps, `TOTAL = 900` frames, daytime, silent. One street along z: bakery (+34) → market (+14) →
lane (−4) → river bridge (−12…−32) → climb (−44…−58, +2.2 m) → church square (−62) → tower (−76) → door (−84).

---

## Ownership (one agent per row — never edit another row's files)

| Agent | Owns | Role |
|---|---|---|
| **S1 SET** | `world.ts`, `build.ts`, `paint.ts` | the whole 3D street, its textures and props |
| **S2 CAST** | `cast.ts`, `toon.ts` | every 2D character, the cake, effects |
| **S3 POST** | `lights.ts`, `shade.ts`, `cardshade.ts`, `ink.ts`, `lensblur.ts`, `grade.ts` | lighting presets + the post chain |
| **S4 CAMERA** | `story.ts`, `NoonBell.tsx` | the shot list, camera moves, DOF, crossfades, the composer |
| lead | `contract.ts`, `Root.tsx`, `scripts/check-assets.mjs`, audio | integration, soundtrack, QC, render |

---

## Required exports (exact names & signatures — the composer imports these)

### `contract.ts` (already written, lead) — do not change
`FPS TOTAL tOf clamp01 smooth glide easeOut mix lin` · `V3 Light Spot` · layout consts
`STREET_HALF Z_START Z_BAKERY Z_MARKET Z_LANE RIVER_Z1 RIVER_Z0 Z_RIVER WATER_Y RAMP0 RAMP1 RAMP_H Z_SQUARE Z_TOWER Z_DOOR Z_END`
· `camber streetY climbWallX overWater` · `ShotTime SHOT_TIME shotIndexAt spotAt` · `pipZ pipX pipPos pipYaw PipMode pipMode`
· `cakePos cakeHeld` · `bakerSpot bakerPos bakerYaw` · `boatmanZ boatmanPos boatmanYaw` · `GEESE goosePos gooseBob`
· `BELL_AT BELL_STRIKE bellAngle bellStrike` · `Fg Cam chestOf headOf v3`

### S4 — `story.ts` (no imports except `./contract` and `three`)
```ts
export { FPS, TOTAL } from "./contract";           // re-export for the composer
export const XFADE: Record<number, number>;        // crossfade frames at each cut (reference grammar: 6–8)
export const shotAt: (f: number) => ShotTime;
export const layersAt: (f: number) => { id: number; alpha: number }[];   // copy bridge/story.ts exactly
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const camAt: (id: number, f: number) => Cam;
export const dofAt: (f: number) => { cInf: number; focus?: (f: number) => V3 };
export const focusAt: (id: number, f: number) => V3;
export const kickAt: (t: number) => number;        // optional whoosh amplitude (may return 1)
export const FOREGROUND: Fg[];                     // near-camera props to blur (see depth.md 6.3)
export const BACKGROUND: { kit: string; x: number; y: number; z: number; s: number; yaw?: number }[];
```
Camera grammar (motion.md §0, non-negotiable): every move is a **symmetric smootherstep glide** (`glide`) of 18–40 f,
peak ≈ 14–25 px/f at 720p; reframes bigger than ~half a frame width are a **hard cut**; holds **push in** 0.15–0.35 %/f;
rolls 4–8° over ≥18 f. No 3-frame snaps. One shot per row of `SHOT_TIME` (ids 1–8, frames `a..b`).

### S4 — `NoonBell.tsx`
Copy `../bridge/Bridge.tsx` and adapt: same `EffectComposer multisampling={4}` chain
(`InkPass` → `LensBlur.pre` → `LensBlur.main` → `BloomEffect`(ADD, threshold 1.0, levels 6, radius 0.6, mip forced to
540×960) → `ToneMappingEffect(NEUTRAL)` → `GradeEffect`), the same `useKit`/`delayRender` pattern, and `layersAt(f)`
crossfade stacking. Export `NOONBELL_FRAMES = TOTAL` and `NoonBell` (React.FC). Import `World`, `loadKit` from
`./world`; `noInkFallback` from `./ink`; `LensBlur, GrainEffect` from `./lensblur`; `GradeEffect, GRADES, GRADE_STRENGTH,
gradeFor` from `./grade`; `Kit` from `./build`. Camera: `fov 40, near 0.2, far 1500`.

### S1 — `world.ts`
```ts
export const loadKit: () => Promise<Kit>;                       // GLTFLoader over public/bridge/kenney/*.glb (see bridge)
export class World {
  root: THREE.Object3D;
  constructor(kit: Kit);
  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene): THREE.Vector3;
}
```
`update` returns the camera's look target (the composer copies it and uses it as the DOF focus default). It must:
pose the sun **camera-relative, frozen per shot** (bridge/world.ts `shotSun`), write the sky, fog, water uniforms and
the per-shot `LOOK`, place the static set once in the constructor, then each frame place the actors from `stage(id, t,
cam)` (imported from `./cast`) and the props from `story.ts`'s `FOREGROUND`/`BACKGROUND`. Set `scene.fog`. Geometry
for the street must use `streetY(z)` from `contract.ts` and leave a hole for `overWater(z)`.

### S1 — `build.ts`
Shared geometry helpers, kept from bridge and adapted: `Kit`, `V`, `quad`, `tri`, `boxGeo`, `Batch`, `lam`, `prop`,
`kitClone`, `house`, `buildTown` → rename to `buildStreet`, `flagTex`, `Ray`, `Strand` (only if still used). Import
layout from `./contract` (`streetY`, `RAMP_H`, …) — the bridge file imports `D0` from `./story`; replace that.

### S1 — `paint.ts`
`rng`, `ctex`, `rep`, `jit`, and HD painters. Keep every painter that is still used; add what the new set needs
(shop awning cloth, market-stall canvas, cake, bakery bread, church stone, clock face). Follow `textures.md`: thin
3–5 px painted lines, flat saturated sun/shade fields, no fine uniform noise, no black.

### S2 — `cast.ts`
```ts
export const SU: number;
export class Pool { req(key,w,h,k,draw): Req; flush(): void }
export class Actor { constructor(parent); mesh; bind(); }
export class Fx { constructor(parent); use(soft); bind(); }
export type Place = { key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body"; roll?: number; size?: [number,number,number] };
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x,y,z: number; w: number; h: number;
  flat?: boolean; rot?: number; soft?: boolean };
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };
export type Stage = { places: Place[]; fx: FxPlace[] };
export const stage: (id: number, t: number, cam: CamInfo) => Stage;
```
Every character comes from `contract.ts` (`pipPos`, `bakerPos`, `goosePos`, `boatmanPos`, `cakePos`, …) posed by
`pipMode`/`bakerSpot`/`gooseBob`. Cards stay camera-facing billboards on layer `NOINK` with `alphaTest`, shaded by
`cardShade()`. Cast: **Pip**, the **baker**, the **bride** and **groom**, a **bell-ringer**, the **boatman**,
**2 geese**, a **market crowd** (shoppers + kids) and a **church crowd** (guests). ≥8 distinct silhouettes.

### S2 — `toon.ts`
Canvas2D drawing kit, no imports. Keep `Pen`, `bodyFront`, `bodySide`, `headBlob` and the ink/outline helpers; replace
`RIFLEMAN`/`KID`/`SKINS`/`OFFICER`/`PARENT`/`soldier`/`townsfolk` with the new cast's draw functions. Implement
`characters.md` v2: heads slightly wider than tall (H/W ≈ 0.93), pointed crown + fuller jaw, ~10 % asymmetry, a few
degrees of tilt, outline ~3× thicker on the shadow side, eyes/mouth hand-placed. Export `Outfit`, `Expr`, `FrontOpts`,
`SideOpts` and the `fx*` effect drawers you keep.

### S3 — `lights.ts`
`LightPreset`, `LIGHTS` (`"day" | "golden"`), `WorldLook`, `LOOK` — keep the bridge structure and field names exactly
(the values are `lighting.md` §9.1). Every shot is `"day"`: tune `day` for a **bright noon** (lighting.md + grade.md
targets: median Y′ ≈ 0.57, lit C* ≈ 34, warm black point (35,19,20), no pure black, vignette ≈ 0.86). `golden` may stay
as-is even if unused.

### S3 — `shade.ts`, `cardshade.ts`, `ink.ts`, `lensblur.ts`, `grade.ts`
Port these **unchanged in behaviour** — they already implement `outlines.md`, `depth.md` and `grade.md`. Only touch
them if a change is needed for the new `day` look, and keep every exported name identical. `twoTone` overwrites
`reflectedLight.directDiffuse`; `InkPass` needs `.dispose()`; `GRADES`/`GRADE_STRENGTH`/`gradeFor` must keep their
signatures.

---

## Hard rules (all agents)
- **No `Math.random()`.** Seeded `rng` / `hash` only — chunk machines must render identical frames.
- **No local rendering.** Local = write files, `npx tsc --noEmit`, `node scripts/check-assets.mjs`. Never render.
- **Do not touch `../bridge/`** (it is the working reference) and do not touch another agent's files.
- Keep every pixel-sized number specified **at 1080×1920** and scaled by `output height / 1920`.
- Only general rules from `references/` — never copy a reference character, prop or shot.
