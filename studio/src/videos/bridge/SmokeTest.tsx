// ColdframeSmokeTest: a 15 s (450 frames @ 30 fps) distributed-render smoke test that rides the
// BridgeShort story: frames 0-449 are story frames 0-449 (shots 1-3 plus the cut into shot 4),
// so it exercises the real 3D world, the animated cast, camera moves, lighting and the full
// post chain (ink -> DOF -> bloom/tone/grade) exactly as the film does.
// The soundtrack is the film's own first 15 s of music + SFX (smoke_audio.py), committed as a
// synthesized wav and embedded here, so every coldframe chunk carries its exact PCM slice
// and the stitched MP4 is in sync (BridgeShort itself has no <Audio>; its sound is muxed outside).
// BridgeShort stays untouched and registered at its full 2,025 frames in Root.tsx.
import React from "react";
import { Audio, staticFile } from "remotion";
import { BridgeShort } from "./Bridge";

export const SMOKE_FRAMES = 450; // 15.000 s at 30 fps

export const ColdframeSmokeTest: React.FC = () => (
  <>
    <Audio src={staticFile("audio/smoke-15s.wav")} />
    <BridgeShort />
  </>
);
