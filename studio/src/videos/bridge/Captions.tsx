// Word-by-word captions for every new short. One word at a time, popped in on its measured onset and
// replaced by the next. Render it as the LAST child of the composition, as a plain DOM overlay on top of
// the three.js canvas, so the ink / lens blur / bloom / grade passes never touch the text.
//
//   import {Captions, normalizeWords} from './Captions';
//   import rawWords from './words.json';            // or a words.ts table, either works
//   const WORDS = normalizeWords(rawWords);
//   ...
//   <Captions words={WORDS} />
//
// The engine comes from the upstream v2 skill (alifmahmudashik/shorts-studio-skill, MIT): normalizeWords
// accepts the common speech-to-text shapes, captions appear `lead` frames before the word is heard and
// `yPercent` can be a function so a close-up can move the line out of a face's way.
//
// The LOOK defaults are the locked quiet-mill house style (fredlorz captions, do not change without asking):
// Lilita One committed at public/fonts/LilitaOne-Regular.ttf (cloud runners ship no fonts we can rely on),
// 176 px, off-white #fbf7ef fill, 13 px outline #17161d with paintOrder stroke-then-fill, a hard offset
// shadow (no blur), letterSpacing -0.01em, one word centred at 75.52 % of frame height (= 1450 px at 1920),
// and a 5-frame pop that settles out of a small overshoot with a 16 px rise. The accent-colour highlight
// from upstream exists as a prop but is OFF by default; turning it on deviates from the house style.
//
// All pixel sizes are for a 1080 x 1920 frame and scale with the real frame height / 1920.
import React, { useEffect, useState } from "react";
import {
  AbsoluteFill,
  cancelRender,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

/** Any of the common speech-to-text shapes: {word|text, start|start_time, end|end_time}, seconds or milliseconds. */
export type RawWord = {
  word?: string;
  text?: string;
  start?: number;
  end?: number;
  start_time?: number;
  end_time?: number;
  type?: string; // ElevenLabs Scribe marks gaps as type: 'spacing'; those are skipped
};
export type Word = { text: string; start: number; end: number }; // seconds

/** Convert STT output to clean `Word[]` in seconds. If a time is above 600 the whole file is treated as ms. */
export function normalizeWords(raw: RawWord[]): Word[] {
  const items = raw
    .filter((w) => w.type !== "spacing" && w.type !== "audio_event")
    .map((w) => ({
      text: String(w.text ?? w.word ?? "").trim(),
      start: Number(w.start ?? w.start_time ?? 0),
      end: Number(w.end ?? w.end_time ?? w.start ?? w.start_time ?? 0),
    }))
    .filter((w) => w.text.length > 0);
  const maxT = items.reduce((m, w) => Math.max(m, w.end), 0);
  const k = maxT > 600 ? 1 / 1000 : 1;
  return items
    .map((w) => ({ text: w.text, start: w.start * k, end: w.end * k }))
    .sort((a, b) => a.start - b.start);
}

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

export type CaptionsProps = {
  words: Word[];
  /** Vertical position of the caption centre as % of frame height. The house default 75.52 = 1450 px at
   *  1920: clear of faces, above the platform UI strips. A function lets a shot move it when a face,
   *  key prop or bubble sits at the default height. */
  yPercent?: number | ((frame: number) => number);
  fontSize?: number; // px at 1080 wide
  stroke?: number; // outline px at 1080 wide
  maxWidthPercent?: number; // keep inside the 6 % side margins
  uppercase?: boolean;
  /** Words matching this regex are drawn in the accent colour. Default null = off: the house style locks
   *  the fill to off-white; enable an accent only if the user asks for it. */
  highlight?: RegExp | null;
  color?: string;
  accent?: string;
  /** Keep the last word visible this long (s) when the next word starts later than that. */
  holdAfter?: number;
  /** Frames the caption appears BEFORE the word is heard (the visual lands 0-3 frames ahead of the word). */
  lead?: number;
  fontFamily?: string;
};

export const Captions: React.FC<CaptionsProps> = ({
  words,
  yPercent = 75.52,
  fontSize = 176,
  stroke = 13,
  maxWidthPercent = 86,
  uppercase = false,
  highlight = null,
  color = "#fbf7ef",
  accent = "#ffd84a",
  holdAfter = 0.18,
  lead = 1,
  fontFamily = FONT,
}) => {
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

  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const s = height / 1920;
  const t = (frame + lead) / fps;

  // last word that has started
  let i = -1;
  for (let k = 0; k < words.length; k++) {
    if (words[k].start <= t) i = k;
    else break;
  }
  if (i < 0 || !ready) return null;
  const w = words[i];
  const next = words[i + 1];
  const visibleUntil = Math.min(next ? next.start : Infinity, w.end + holdAfter);
  if (t > visibleUntil) return null;

  // the house pop: settle out of a small, slightly overshooting pop in 5 frames; readable from frame 1
  const age = Math.max(0, Math.round((t - w.start) * fps));
  const k = clamp01(age / 5);
  const scale = 0.9 + 0.1 * smooth(k) + 0.04 * Math.sin(Math.PI * k);
  const rise = (1 - smooth(k)) * 16 * s;
  const y = typeof yPercent === "function" ? yPercent(frame) : yPercent;
  const text = uppercase ? w.text.toUpperCase() : w.text;
  const hot = highlight ? highlight.test(w.text) : false;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          left: `${(100 - maxWidthPercent) / 2}%`,
          width: `${maxWidthPercent}%`,
          top: `${y}%`,
          transform: `translateY(calc(-50% + ${rise}px)) scale(${scale})`,
          textAlign: "center",
          fontFamily,
          fontWeight: 400,
          fontSize: fontSize * s,
          lineHeight: 1,
          letterSpacing: "-0.01em",
          color: hot ? accent : color,
          WebkitTextStroke: `${stroke * s}px #17161d`,
          paintOrder: "stroke fill",
          textShadow: `0 ${10 * s}px 0 rgba(23,22,29,0.28)`,
          whiteSpace: "nowrap",
          overflow: "hidden",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
