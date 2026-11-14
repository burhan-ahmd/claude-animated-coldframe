# The 30 s soundtrack for "Pip and the Noon Bell". Silent film: the film's own score (music.py) + its SFX stem
# (sfx.py), mixed WITHOUT any voice. Every SFX event is scaled against a stand-in narration loudness (V_REF), which is
# only a global gain, so the original relative mix is preserved and the master stage sets the absolute level.
# Both stems are cached in _cache/ so a crash never costs a full re-render.
# usage: cd studio/shorts/noonbell/audio && python noonbell_audio.py
# output: studio/public/audio/noonbell.wav  (48 kHz stereo 24-bit, -16 LUFS integrated, <= -2.2 dBTP, 30.000 s)
#         studio/shorts/noonbell/audio/cues.md  (the cue sheet)
#         out/qa/noonbell_audio_qc.json         (measured loudness + per-cue levels)
import os
import json
import time
import numpy as np
from scipy import ndimage, signal
from dsp import (SR, ns, dbg, integrated, momentary_max, short_term, lra, true_peak, fades, write_wav)
import timeline as T

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "_cache")
OUT_DIR = os.path.normpath(os.path.join(HERE, "..", "..", "..", "public", "audio"))
OUT = os.path.join(OUT_DIR, "noonbell.wav")
QA_DIR = os.path.normpath(os.path.join(HERE, "..", "..", "..", "..", "out", "qa"))

DUR = T.DUR                     # 30.000 s
N = ns(DUR)                     # 1,440,000 samples
V_REF = -18.0                   # stand-in narration loudness (global gain only)
TARGET_LUFS = -16.0
CEIL_DBTP = -2.2
MUSIC_GAIN_DB = 0.0
SFX_GAIN_DB = +9.0              # silent film: no voice, so the SFX must cut through the score (bridge sat them 6 dB
                                # under a narration that no longer exists). +9 puts footsteps ~5 dB under the music.
FADE_OUT = 0.40


def log(*a):
    print(f"[{time.strftime('%H:%M:%S')}]", *a, flush=True)


def cached(name, fn):
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, name + ".npy")
    if os.path.exists(p):
        log("cache hit", name)
        return np.load(p).astype(np.float64)
    x = fn()
    np.save(p, np.asarray(x, np.float32))
    return x


# ================================================================ limiter
def limiter(x, ceil_db=CEIL_DBTP, look=0.003, rel=0.08):
    """4x-oversampled peak detection, look-ahead min filter, release one-pole, centred smoothing -> gain curve.
    (Same limiter as the bridge mix; here it is what lets the master sit at exactly -16 LUFS without a
    global trim costing loudness.)"""
    c = dbg(ceil_db)
    n = x.shape[1]
    up = np.abs(signal.resample_poly(x, 4, 1, axis=-1)).max(0)
    pk = np.pad(up, (0, max(0, 4 * n - len(up))))[: 4 * n].reshape(n, 4).max(1)
    gr = np.minimum(1.0, c / np.maximum(pk, 1e-12))
    La = max(1, ns(look))
    g1 = ndimage.minimum_filter1d(gr, 2 * La + 1, mode="nearest")
    g2 = g1.copy()
    idx = np.flatnonzero(g1 < 1.0)
    if len(idx):
        kr = 1 - np.exp(-1 / (rel * SR))
        gap = ns(rel * 8)
        brk = np.flatnonzero(np.diff(idx) > gap)
        starts = np.concatenate([[idx[0]], idx[brk + 1]])
        ends = np.concatenate([idx[brk], [idx[-1]]])
        for a, b_ in zip(starts, ends):
            e = min(n, b_ + gap)
            seg = g1[a:e]
            out = np.empty(len(seg))
            g = 1.0
            for k in range(len(seg)):
                g = min(seg[k], g + (1 - g) * kr)
                out[k] = g
            g2[a:e] = out
    g3 = ndimage.uniform_filter1d(g2, 2 * La + 1, mode="nearest")
    g3 = np.minimum(g3, 1.0)
    return x * g3[None, :], g3


def main():
    log("rendering stems (music is cached after the first run)")
    import music
    b = music.build()
    m = cached("music_raw", lambda: music.render(b, ref=-20.0)[0])[:, :N]
    import sfx
    s, C = sfx.render(V_REF)
    s = s[:, :N]

    mI, sI = integrated(m), integrated(s)
    log(f"stem loudness: music {mI:.1f} LU, sfx {sI:.1f} LU (gains music {MUSIC_GAIN_DB:+.1f} / sfx {SFX_GAIN_DB:+.1f} dB)")
    x = m * dbg(MUSIC_GAIN_DB) + s * dbg(SFX_GAIN_DB)

    # the film ends on the bell: fade the tail so the file cannot click on the last frame
    k = ns(DUR - FADE_OUT)
    x[:, k:] *= np.linspace(1, 0, N - k)[None, :] ** 1.2
    x = fades(x, 0.01, 0.0)

    # ---------------- master: 4x-oversampled look-ahead limiter, gain solved so LUFS lands on target
    G = TARGET_LUFS - integrated(x)
    g3 = np.ones(N)
    for it in range(6):
        y, g3 = limiter(x * dbg(G))
        L = integrated(y)
        log(f"master iter {it}: gain {G:+.2f} dB -> {L:.2f} LUFS, TP {true_peak(y):.2f} dBTP, "
            f"max GR {-20 * np.log10(max(1e-6, float(g3.min()))):.2f} dB")
        if abs(L - TARGET_LUFS) < 0.02:
            break
        G += TARGET_LUFS - L
    x = y
    tp = true_peak(x)
    I_, ST, LR = integrated(x), float(short_term(x).max()), lra(x)
    gr_max = -20 * np.log10(max(1e-6, float(g3.min())))
    log(f"master: {I_:.1f} LUFS integrated (max short-term {ST:.1f}, LRA {LR:.1f} LU), {tp:.2f} dBTP, "
        f"limiter max GR {gr_max:.2f} dB, {N} samples = {N / SR:.3f} s, stereo {SR} Hz 24-bit")

    os.makedirs(OUT_DIR, exist_ok=True)
    write_wav(OUT, x, 24)
    log("wrote", OUT)

    # ---------------- cue sheet + QC report
    rows = sorted(C, key=lambda c: c.t)
    with open(os.path.join(HERE, "cues.md"), "w", encoding="utf-8") as f:
        f.write("# \"Pip and the Noon Bell\" - cue sheet (30.000 s, generated by noonbell_audio.py)\n\n")
        f.write("## Music map\n\n| section | start | end |\n|---|---|---|\n")
        for (name, a, z) in music.SECTIONS:
            f.write(f"| {name} | {a:.2f} | {z:.2f} |\n")
        f.write("\n## Music cues\n\n| t | note |\n|---|---|\n")
        for (t, note) in b.cues:
            f.write(f"| {t:.2f} | {note} |\n")
        f.write("\n## Sound effects (measured level is LU relative to the stand-in narration)\n\n")
        f.write("| t | name | kind | LU | description |\n|---|---|---|---|---|\n")
        for c in rows:
            if c.kind == "bed" and c.measured is None:
                continue
            lv = "" if c.measured is None else f"{c.measured:.1f}"
            f.write(f"| {c.t:.2f} | {c.name} | {c.kind} | {lv} | {c.desc} |\n")
        log("wrote", os.path.join(HERE, "cues.md"))

    try:
        os.makedirs(QA_DIR, exist_ok=True)
        ev = {}
        for c in rows:
            if c.kind == "event" and c.measured is not None:
                ev.setdefault(c.name, []).append(round(c.measured, 1))
        json.dump({
            "file": OUT, "duration_s": round(N / SR, 3), "samples": N,
            "lufs_integrated": round(I_, 2), "lufs_short_term_max": round(float(ST), 2), "lra": round(float(LR), 2),
            "true_peak_dbtp": round(float(tp), 2), "music_ref_lu": round(mI, 1), "sfx_ref_lu": round(sI, 1),
            "v_ref": V_REF, "music_gain_db": MUSIC_GAIN_DB, "sfx_gain_db": SFX_GAIN_DB, "limiter_gr_max_db": round(gr_max, 2),
            "events": len([c for c in rows if c.kind == "event"]), "beds": len([c for c in rows if c.kind == "bed"]),
            "by_name": {k: {"n": len(v), "min": min(v), "max": max(v)} for k, v in sorted(ev.items())},
        }, open(os.path.join(QA_DIR, "noonbell_audio_qc.json"), "w"), indent=2)
        log("wrote", os.path.join(QA_DIR, "noonbell_audio_qc.json"))
    except Exception as e:  # the QC file is a convenience; never fail the render for it
        log("QC write skipped:", e)


if __name__ == "__main__":
    main()
