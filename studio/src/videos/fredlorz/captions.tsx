// Word-synced captions for "The Man Who Rode to Victory": one word at a time in the lower third, popped in on its
// measured onset and replaced by the next. The timing table lives in words.ts (generated from the narration's word
// onsets by studio/shorts/fredlorz/build_words.py); this file only draws it, so re-timing the film is a data change.
//
// The word is drawn as flat ink-outlined type to match the world: off-white fill, a thick dark outline in the same
// near-black the ink pass uses, and a hard offset shadow (no blur) so the card reads over both the bright sand and
// the dark grandstand behind it. The face is Lilita One, committed under public/fonts because the cloud runners have
// no font we can rely on; it is loaded through the FontFace API behind delayRender so no frame renders before it is
// ready (a fallback face would change every glyph's width and the whole look).
import React, { useEffect, useState } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender, staticFile, useCurrentFrame } from "remotion";
import { CARDS, cardAt } from "./words";

const FONT = "FlCaption";
let fontReady: Promise<void> | null = null;
/** load the caption face once per page (the renderer re-mounts the tree per frame, the promise is module level) */
const loadFont = () =>
  (fontReady ??= (async () => {
    const face = new FontFace(FONT, `url("${staticFile("fonts/LilitaOne-Regular.ttf")}")`);
    await face.load();
    // this TS DOM lib predates FontFaceSet.add; the runtime API is exactly Set#add for fonts
    (document.fonts as unknown as Set<FontFace>).add(face);
  })());

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (x: number) => {
  const u = clamp01(x);
  return u * u * (3 - 2 * u);
};

const CAP = {
  size: 176,     // the widest card ("Roosevelt", 4.2 em) is 739 px at this size: ~170 px clear of each frame edge
  stroke: 13,
  ink: "#17161d",
  fill: "#fbf7ef",
  centreY: 1450, // 75% down the frame: clear of the faces, above the 1080x1920 platform UI strips (~1630+)
  pop: 5,        // frames the pop takes to settle
};

export const WordCaptions: React.FC = () => {
  const [handle] = useState(() => delayRender("caption font"));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    loadFont()
      .then(() => {
        if (!live) return;
        setReady(true);
        continueRender(handle);
      })
      .catch((e: unknown) => cancelRender(e));
    return () => {
      live = false;
    };
  }, [handle]);

  const f = useCurrentFrame();
  const card = CARDS[cardAt(f)];
  const age = Math.max(0, f - card.a);
  const k = clamp01(age / CAP.pop);
  // settle out of a small, slightly overshooting pop rather than sliding in: the word is readable from frame 1
  const scale = 0.9 + 0.1 * smooth(k) + 0.04 * Math.sin(Math.PI * k);
  const rise = (1 - smooth(k)) * 16;

  if (!ready) return null;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute", top: CAP.centreY - 130, left: 40, right: 40, height: 260,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <span
          style={{
            fontFamily: FONT, fontSize: CAP.size, fontWeight: 400, lineHeight: 1, letterSpacing: "-0.01em",
            color: CAP.fill, WebkitTextStroke: `${CAP.stroke}px ${CAP.ink}`, paintOrder: "stroke fill",
            textShadow: "0 10px 0 rgba(23,22,29,0.28)", whiteSpace: "nowrap",
            transform: `translateY(${rise}px) scale(${scale})`, transformOrigin: "50% 50%",
          }}
        >
          {card.w}
        </span>
      </div>
    </AbsoluteFill>
  );
};