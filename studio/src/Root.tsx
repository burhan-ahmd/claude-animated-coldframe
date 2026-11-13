import React from "react";
import { Composition } from "remotion";
import { BridgeShort, BRIDGE_FRAMES } from "./videos/bridge/Bridge";
import { ColdframeSmokeTest, SMOKE_FRAMES } from "./videos/bridge/SmokeTest";
import { FredLorz, FredLorzTest, FREDLORZ_FRAMES, FREDLORZ_TEST_FRAMES } from "./videos/fredlorz/Lorz";

// One <Composition> per short. Copy src/videos/bridge to src/videos/<name> and register it here.
export const Root: React.FC = () => (
  <>
    <Composition id="BridgeShort" component={BridgeShort} durationInFrames={BRIDGE_FRAMES} fps={30} width={1080} height={1920} />
    {/* distributed-render smoke test: the story's first 450 frames plus the committed 15 s soundtrack */}
    <Composition id="ColdframeSmokeTest" component={ColdframeSmokeTest} durationInFrames={SMOKE_FRAMES} fps={30} width={1080} height={1920} />
    <Composition id="FredLorz" component={FredLorz} durationInFrames={FREDLORZ_FRAMES} fps={30} width={1080} height={1920} />
    {/* distributed-render smoke test: shot 1 (the car arrives) plus the committed soundtrack */}
    <Composition id="FredLorzTest" component={FredLorzTest} durationInFrames={FREDLORZ_TEST_FRAMES} fps={30} width={1080} height={1920} />
  </>
);
