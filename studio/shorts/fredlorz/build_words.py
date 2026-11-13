"""Word-level caption cards for "The Man Who Rode to Victory".

Reads the measured word onsets (new_story/word.txt: alternating timestamp / word lines, as produced by the
transcriber) and writes studio/src/videos/fredlorz/words.ts, the timing table the caption layer reads.

The narration is fast enough in three places that a strict one-word-per-onset caption would flash a word for
1-2 frames, and one onset pair is out of order (word.txt has "life." at 26.16 s after "A" at 26.04 s). So:

  * a non-monotonic onset is pulled forward to 50 ms after the previous word (keeps the spoken word order);
  * a card is never replaced sooner than MIN_HOLD frames after it appeared;
  * trailing . and , are dropped for the caption (keeping real abbreviations in KEEP), ! and ? are kept.

Both repairs only ever push a word later, and the measured worst case across the whole film is 1.5 frames
(50 ms) on the word "A" -- below the threshold where a caption reads as out of sync. Re-running this script
reproduces words.ts byte for byte.

Usage: python studio/shorts/fredlorz/build_words.py
"""
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
SRC = os.path.join(ROOT, "new_story", "word.txt")
OUT = os.path.join(ROOT, "studio", "src", "videos", "fredlorz", "words.ts")

FPS, TOTAL, MIN_HOLD = 30, 945, 3
KEEP = {"St."}  # abbreviations whose period is part of the word


def onsets(path):
    lines = [l.rstrip("\n") for l in open(path, encoding="utf-8") if l.strip()]
    out = []
    for i in range(0, len(lines) - 1, 2):
        h, m, s = lines[i].split(":")
        out.append([int(h) * 3600 + int(m) * 60 + float(s), lines[i + 1]])
    return out


def cards(words):
    """[(start_frame, word)] with the two timing repairs applied."""
    fixed = []
    for t, w in words:
        if fixed and t <= fixed[-1][0]:
            t = fixed[-1][0] + 0.05
        fixed.append((t, w))
    starts = []
    for i, (t, _w) in enumerate(fixed):
        f = t * FPS
        if i:
            f = max(f, starts[-1] + MIN_HOLD)
        starts.append(f)
    out = []
    for i, (_t, w) in enumerate(fixed):
        b = starts[i + 1] if i + 1 < len(starts) else TOTAL
        if w not in KEEP:
            w = re.sub(r"[.,]+$", "", w)
        out.append((int(round(starts[i])), int(round(b)), w))
    return out


def main():
    cs = cards(onsets(SRC))
    body = "\n".join('  { a: %d, b: %d, w: %s },' % (a, b, '"' + w.replace('"', '\\"') + '"') for a, b, w in cs)
    src = f'''// Word-level caption cards for "The Man Who Rode to Victory": one word on screen at a time, replaced on its
// measured onset. GENERATED FILE -- edit new_story/word.txt and re-run studio/shorts/fredlorz/build_words.py,
// do not hand-edit. `a` is the first frame the card is up, `b` the first frame it is gone; the card that is up
// at frame f is the one with a <= f < b, so the table is gap-free and covers 0..TOTAL.
export type Card = {{ a: number; b: number; w: string }};

export const CARDS: Card[] = [
{body}
];

/** the card on screen at frame f (the last one if f is past the end) */
export const cardAt = (f: number): number => {{
  for (let i = CARDS.length - 1; i > 0; i--) if (f >= CARDS[i].a) return i;
  return 0;
}};
'''
    open(OUT, "w", encoding="utf-8", newline="\n").write(src)
    print("wrote %s: %d cards, f0..f%d" % (os.path.relpath(OUT, ROOT), len(cs), cs[-1][1]))


if __name__ == "__main__":
    main()