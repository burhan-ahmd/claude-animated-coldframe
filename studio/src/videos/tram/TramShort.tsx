// Tram.tsx — the composer for "The Last Tram" (450 frames @ 30 fps, 1080x1920). No voiceover, no flash:
// SFX and ambience only, so there is nothing to caption and nothing to white out.
// Post chain, identical in order to the bridge reference:
//   InkPass (world ink, its own pass) -> lens blur pre + main (thin-lens DOF per shot) ->
//   [bloom (emissive only) + NEUTRAL tone map + colour grade] (one merged EffectPass), MSAA 4.
// Dissolves stack a second ThreeCanvas for their six frames, exactly as the reference does.
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, ToneMappingEffect, ToneMappingMode } from "postprocessing";
import { World } from "./city";
import { Tram } from "./tram";
import { Weather } from "./weather";
import { Cast } from "./cast";
import { InkPass, noInkFallback } from "../bridge/ink";
import { LensBlur } from "../bridge/lensblur";
import { GradeEffect } from "../bridge/grade";
import { NIGHT_GRADE, GRADE_STRENGTH, layersAt, dofAt, FRAMES } from "./story";
import { tramZ } from "./contract";

export const TRAM_FRAMES = FRAMES;

/** Bloom for emissive sources only: the MIP chain always starts at half the frame height, so the glow keeps the
 *  same size relative to the picture at any output scale. ADD is HDR-safe. */
const makeBloom = () => {
  const b = new BloomEffect({ blendFunction: BlendFunction.ADD, intensity: 0.62, luminanceThreshold: 1.0, luminanceSmoothing: 0.2, mipmapBlur: true, levels: 6, radius: 0.7 });
  const mip = b.mipmapBlurPass;
  const setSize = mip.setSize.bind(mip);
  mip.setSize = (w: number, h: number) => setSize(Math.round((1920 * w) / Math.max(h, 1)), 1920);
  return b;
};

const fwd = new THREE.Vector3(), fpt = new THREE.Vector3();

const Inner: React.FC<{ id: number }> = ({ id }) => {
  const f = useCurrentFrame();
  const { camera, scene } = useThree();
  const world = useMemo(() => new World(), []);
  const tram = useMemo(() => new Tram(), []);
  const weather = useMemo(() => new Weather(), []);
  const cast = useMemo(() => new Cast(), []);
  const stage = useMemo(() => {
    const g = new THREE.Group();
    g.add(world.root, tram.root, weather.root, cast.root);
    return g;
  }, [world, tram, weather, cast]);
  const fx = useMemo(() => ({
    ink: new InkPass(scene, camera as THREE.PerspectiveCamera),
    lens: new LensBlur({ maxCoC: 26, nearScale: 1.25 }),
    bloom: makeBloom(),
    tone: new ToneMappingEffect({ mode: ToneMappingMode.NEUTRAL }),
    grade: new GradeEffect(NIGHT_GRADE, GRADE_STRENGTH),
  }), [camera, scene]);
  useEffect(() => () => fx.ink.dispose(), [fx]);
  const post = useMemo(() => (
    <EffectComposer multisampling={4}>
      {[
        <primitive key="ink" object={fx.ink} dispose={null} />,
        <primitive key="pre" object={fx.lens.pre} dispose={null} />,
        <primitive key="lens" object={fx.lens.main} dispose={null} />,
        <primitive key="bloom" object={fx.bloom} dispose={null} />,
        <primitive key="tone" object={fx.tone} dispose={null} />,
        <primitive key="grade" object={fx.grade} dispose={null} />,
      ].filter((e): e is React.JSX.Element => !!e)}
    </EffectComposer>
  ), [fx]);

  const cam = camera as THREE.PerspectiveCamera;
  const target = world.update(id, f, cam, scene);
  tram.update(f);
  weather.update(f, cam, tramZ(f));
  cast.update(f, cam);
  noInkFallback(stage);
  const d = dofAt(f);
  cam.getWorldDirection(fwd);
  if (d.focus) fpt.set(...d.focus()); else fpt.copy(target);
  fx.lens.focus = Math.max(0.3, fpt.sub(cam.position).dot(fwd));
  fx.lens.cInf = d.cInf;
  return (
    <>
      <primitive object={stage} dispose={null} />
      {post}
    </>
  );
};

const ShotView: React.FC<{ id: number; alpha: number }> = ({ id, alpha }) => (
  <AbsoluteFill style={{ opacity: alpha }}>
    <ThreeCanvas width={1080} height={1920} shadows
      gl={{ antialias: false, stencil: false, powerPreference: "high-performance", toneMappingExposure: 1.0 }}
      camera={{ fov: 36, near: 0.2, far: 700 }}>
      <Inner id={id} />
    </ThreeCanvas>
  </AbsoluteFill>
);

export const TramShort: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#05070d" }}>
      {layersAt(f).map((l, i) => <ShotView key={i ? "over" : "base"} id={l.id} alpha={l.alpha} />)}
    </AbsoluteFill>
  );
};
