# Soundtrack for "The Man Who Rode to Victory" (Fred Lorz, 1904): the narrator's voice (gain only) + an original
# 1904-style two-step score + synthesized SFX, mixed to one committed WAV (48 kHz stereo 24-bit, -16 LUFS, <= -1.2
# dBTP, exactly 31.500 s = 945 frames). All sound but the voice is generated here from dsp.py / instruments.py /
# sfx_gen.py in the bridge study's audio folder, so nothing third-party is shipped.
# usage: cd studio/shorts/fredlorz/audio && python fredlorz_audio.py
# output: studio/public/audio/fredlorz.wav
import os
import sys
import time
import subprocess
import numpy as np
from scipy import ndimage

HERE = os.path.dirname(os.path.abspath(__file__))
STUDIO = os.path.normpath(os.path.join(HERE, "..", "..", ".."))
REPO = os.path.dirname(STUDIO)
SRC = os.path.join(REPO, "new_story", "voiceover.mp3")
WORDS = os.path.join(REPO, "new_story", "word.txt")
OUT = os.path.join(STUDIO, "public", "audio", "fredlorz.wav")
CACHE = os.path.join(HERE, "_cache")
sys.path.insert(0, os.path.normpath(os.path.join(HERE, "..", "..", "bridge", "audio")))

from dsp import (SR, ns, dbg, fades, integrated, momentary_max, true_peak, pan, place, st, lp, hp, colored,
                 smooth_noise, phase, read_wav, write_wav, rng)
import instruments as I
import sfx_gen as G
from mix import limiter

FPS = 30
TOTAL = 945
DUR = TOTAL / FPS                 # 31.500 s
N = ns(DUR)
TARGET_LUFS = -16.0
CEIL_DBTP = -1.2
R = rng(2042)

# shots (frames) mirrored from story.ts: the music's level offset (LU under the voice) per section
SHOTS = [(0, 161), (161, 317), (317, 423), (423, 508), (508, 628), (628, 703), (703, 749), (749, 781), (781, 878), (878, TOTAL)]
MUSIC_OFF = [-11.5, -12.0, -12.0, -11.5, -10.5, -11.5, -11.5, -11.0, -10.5, -12.5]


def log(*a):
    print(f"[{time.strftime('%H:%M:%S')}]", *a, flush=True)


# ================================================================ voice + words
def hms(s):
    h, m, sec = s.split(":")
    return int(h) * 3600 + int(m) * 60 + float(sec)


def load_words():
    lines = [l.strip() for l in open(WORDS, encoding="utf-8") if l.strip()]
    return [(hms(lines[i]), lines[i + 1]) for i in range(0, len(lines) - 1, 2)]


def load_voice():
    os.makedirs(CACHE, exist_ok=True)
    tmp = os.path.join(CACHE, "voice.wav")
    if not os.path.exists(tmp):
        log("decoding the narration to 48 kHz mono (ffmpeg)")
        subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", SRC,
                        "-ac", "1", "-ar", str(SR), "-c:a", "pcm_s24le", tmp], check=True)
    x, sr = read_wav(tmp)
    assert sr == SR, sr
    v = x[0] if x.shape[0] == 1 else x.mean(0)
    out = np.zeros(N)
    out[: min(N, len(v))] = v[:N]
    return st(out)


def spans(words, merge=0.28):
    sp = []
    for t, w in words:
        e = t + 0.045 * len(w) + 0.06
        if sp and t - sp[-1][1] < merge:
            sp[-1][1] = max(sp[-1][1], e)
        else:
            sp.append([t, e])
    return sp


def duck_curve(depth=-3.5, pre=0.10, post=0.14, att=0.06, rel=0.40):
    ctrl = 1000
    nc = int(DUR * ctrl) + 2
    c = np.zeros(nc)
    for s, e in spans(load_words()):
        c[max(0, int((s - pre) * ctrl)):int((e + post) * ctrl)] = 1.0
    ka, kr = 1 - np.exp(-1 / (att * ctrl)), 1 - np.exp(-1 / (rel * ctrl))
    env = np.zeros(nc)
    e = 0.0
    for i in range(nc):
        e += (c[i] - e) * (ka if c[i] > e else kr)
        env[i] = e
    return np.interp(np.arange(N) / SR, np.arange(nc) / ctrl, depth * env)


# ================================================================ music: an original 1904 two-step
BEAT, BAR = 0.5, 1.0               # 120 bpm, 2/4 (a bar is two beats)
CH = {"C": (60, [0, 4, 7]), "A7": (57, [0, 4, 7, 10]), "D7": (62, [0, 4, 7, 10]), "G7": (55, [0, 4, 7, 10]),
      "F": (53, [0, 4, 7]), "Am": (57, [0, 3, 7]), "Dm": (62, [0, 3, 7]), "E7": (52, [0, 4, 7, 10])}
PROG = ["C", "A7", "D7", "G7", "C", "A7", "D7", "G7", "C", "A7", "D7", "G7", "C", "C", "G7", "C",
        "F", "F", "C", "G7", "C", "Am", "Am", "Dm", "E7", "Am", "E7", "F", "C", "G7", "C", "C"]
# the score's own motifs: (time s, midi, dur s, instrument)
MEL = [
    (0.05, 72, 0.22, "glock"), (0.55, 76, 0.22, "glock"), (1.05, 79, 0.5, "glock"), (1.60, 76, 0.35, "glock"),
    (5.40, 67, 0.30, "fife"), (5.90, 69, 0.30, "fife"), (6.40, 71, 0.55, "fife"),
    (10.55, 64, 0.28, "fife"), (11.05, 67, 0.28, "fife"), (11.55, 72, 0.55, "fife"),
    (14.10, 71, 0.30, "horn"), (14.55, 67, 0.30, "horn"), (15.05, 64, 0.60, "horn"),
    (16.95, 72, 0.18, "stab"), (17.35, 76, 0.18, "stab"), (17.75, 79, 0.18, "stab"), (18.15, 84, 0.70, "stab"),
    (19.20, 88, 0.20, "glock"), (19.45, 91, 0.20, "glock"), (19.70, 96, 0.45, "glock"),
    (21.55, 69, 0.35, "horn"), (21.95, 68, 0.35, "horn"), (22.35, 65, 0.55, "horn"),
    (24.10, 64, 0.35, "horn"), (24.60, 64, 0.35, "horn"), (25.10, 63, 0.60, "horn"),
    (27.05, 69, 0.35, "horn"), (27.55, 72, 0.35, "horn"), (28.05, 77, 0.55, "horn"), (28.55, 81, 0.75, "horn"),
    (30.35, 48, 0.55, "tuba"), (30.35, 84, 0.30, "glock"), (30.90, 62, 0.18, "glock"), (31.05, 67, 0.30, "glock"),
]
TF = {"stab": 0.28, "tuba": 0.55, "horn": 0.55, "fife": 0.42, "glock": 1.4, "pluck": 0.55}


def note(kind, midi, dur, r, vel=0.6):
    f = I.m2f(midi)
    if kind == "glock":
        return I.glock(f, vel, r, min(1.8, dur + 1.2))
    if kind == "fife":
        return I.fife(f, dur, vel, r)
    if kind == "pluck":
        return I.pluck(f, vel, r, min(0.9, dur + 0.25))
    if kind == "horn":
        return I.brass(f, dur, vel, r, "horn")
    if kind == "stab":
        return I.brass(f, dur, vel, r, "stab")
    if kind == "tuba":
        return I.brass(f, dur, vel, r, "tuba")
    raise ValueError(kind)


def build_music():
    r = rng(77)
    b = np.zeros((2, N))
    for bar, name in enumerate(PROG):
        t0 = bar * BAR
        if t0 >= DUR:
            break
        root, iv = CH[name]
        minor = name in ("Am", "Dm") or name == "E7" and False
        tension = 21 <= bar <= 26
        # tuba: root on beat 1, fifth on beat 2 (the "oom-pah")
        place(b, pan(note("tuba", root - 24, 0.42, r, 0.55), -0.1), t0, 1.0)
        place(b, pan(note("tuba", root - 24 + 7, 0.40, r, 0.48), -0.1), t0 + BEAT, 1.0)
        if not tension:
            for off in (0.5, 1.5):
                for k, i2 in enumerate(iv[:3]):
                    place(b, pan(note("pluck", root + i2, 0.22, r, 0.30), -0.25 + 0.25 * k), t0 + off, 1.0)
        # brushes on 1, snare on 2 (softer through the tension bars)
        place(b, pan(I.brush(0.30, r), 0.15), t0, 1.0)
        place(b, pan(I.snare(0.26 if not tension else 0.18, r, 0.30), 0.1), t0 + BEAT, 1.0)
        if bar % 2 == 0:
            place(b, pan(I.triangle(0.22, r, 1.2), 0.35), t0, 1.0)
        if tension:
            place(b, pan(I.timpani(I.m2f(root - 12), 0.5, r, 1.4), -0.2), t0, 1.0)
    for t, midi, dur, kind in MEL:
        if t >= DUR:
            break
        vel = 0.5 if kind in ("horn", "fife") else 0.42
        p = 0.25 if kind == "glock" else (-0.15 if kind == "tuba" else 0.2)
        place(b, pan(note(kind, midi, dur, r, vel), p), t, 1.0)
    # fanfare punctuation: cymbal + timpani at the tape crossings and the verdict
    for t, big in ((17.10, 0.5), (21.45, 0.35), (26.42, 0.45), (28.05, 0.5)):
        place(b, pan(I.cymbal(big, r, 1.8), 0.3), t, 0.7)
    return b


# ================================================================ SFX
def motor(n, f, r, level=1.0):
    t = np.arange(n) / SR
    ff = np.asarray(f if np.ndim(f) else f * np.ones(n), float)
    ph = phase(ff)
    body = 0.55 * np.sin(ph) + 0.30 * np.sin(2 * ph) + 0.18 * np.sin(3 * ph)
    chuff = 0.55 + 0.45 * np.clip(np.sin(ph), 0, 1)
    y = lp(body * chuff, 1300, 2) + 0.30 * lp(r.standard_normal(n), 480, 2)
    return hp(y, 38, 1) * level


def build_sfx(v_ref):
    r = rng(5150)
    b = np.zeros((2, N))

    def put(x, t, lvl, p=0.0, mode="momentary", off=0.0):
        """normalize a cue to (voice_ref - 6 dB + off) and place it (pans only mono sources)"""
        g = (v_ref - 6.0 + off) - (momentary_max(x) if mode == "momentary" else integrated(x))
        place(b, x if np.ndim(x) == 2 else pan(x, p), t, dbg(g))

    # ---- the car: putt-putt motor, wheel rumble, radiator steam, the breakdown ----
    n1 = ns(5.45)
    e1 = np.ones(n1)
    e1[ns(5.05):] = np.linspace(1, 0, n1 - ns(5.05))       # the cut to shot 2 takes the motor away with it
    put(motor(n1, 15.0 * (1 + 0.05 * smooth_noise(n1, r, 4.0)), r) * e1, 0.0, 1.0, -0.1, off=-10.0)
    seg = np.concatenate([np.linspace(14, 11, ns(1.2)), np.full(ns(0.83), 11.0), np.linspace(12, 16, ns(1.67)),
                          np.linspace(16, 15, ns(1.05)), np.full(ns(0.95), 14.6)])
    nn = ns(len(seg) / SR)
    m2 = motor(nn, seg[:nn] * (1 + 0.05 * smooth_noise(nn, r, 4.0)), r)
    env = np.ones(nn)
    k = ns(15.05 - 10.3)                       # the sputter after 15.05: irregular dropouts, then it dies
    drop = r.random(nn - k) < 0.30
    env[k:] *= np.where(drop, 0.22, 1.0) * np.linspace(1, 0, nn - k) ** 1.5
    put(m2 * env, 10.3, 1.0, -0.05, off=-9.0)
    for t0, dur in ((0.0, 5.4), (12.35, 2.7)):        # wheel rumble + road dust under the wheels
        nr = ns(dur)
        ru = lp(r.standard_normal(nr), 260, 1) * (0.4 + 0.6 * np.abs(smooth_noise(nr, r, 3.0)))
        put(ru, t0, 1.0, 0.05, off=-19.0)
    hz_n = ns(0.95)
    hiss = hp(r.standard_normal(hz_n), 2200, 2) * (0.6 + 0.4 * smooth_noise(hz_n, r, 6.0))
    put(hiss, 13.45, 1.0, 0.1, off=-20.0)             # radiator steam at speed
    put(G.clink(r, 900, 0.2), 15.9, 1.0, 0.2, off=-16.0)   # a last mechanical clank as the motor dies

    # ---- Fred's feet (jog, the 1905 lap, the closing walk) ----
    feet = [(5.36, 8.86, 1.6, 0.45), (15.4, 18.385, 2.6, 0.85), (26.04, 29.267, 3.0, 0.95), (29.267, 31.0, 1.6, 0.5)]
    for t0, t1, hz, sc in feet:
        k = 0
        while True:
            t = t0 + k / hz
            k += 1
            if t >= t1:
                break
            put(G.boot(r, 1.0), t, 1.0, 0.05 * (1 if k % 2 else -1), off=-20.0 + 6 * sc)

    # ---- crowd (officials, grandstand), reacts: cheer, gasp, murmur, the 1905 applause ----
    put(G.babble(14.6, r, 150, 1.0, rate=4.0, active=0.7), 16.93, 1.0, 0.1, mode="integrated", off=-24.0)
    put(G.hurrah(r, 150, 1.0), 17.30, 1.0, 0.15, off=-11.0)
    put(G.applause(2.4, r, 44), 17.35, 1.0, 0.0, off=-15.0)
    put(G.whoosh(0.5, r, 0.4, 500, 2600), 21.42, 1.0, 0.25, off=-13.0)   # the gasp at "that's him in the car!"
    put(G.babble(1.2, r, 210, 1.0, rate=5.5, active=0.95, fmax=4200), 21.45, 1.0, 0.3, off=-16.0)
    put(G.hurrah(r, 170, 1.0), 27.6, 1.0, -0.2, off=-15.0)               # laughter on the honest lap
    put(G.applause(3.0, r, 52), 28.15, 1.0, 0.0, off=-13.0)

    # ---- the props: the tape tears at the two crossings, the wreath, the judge's gavel ----
    for t in (17.067, 28.10):
        put(G.timber_tear(r, 0.45), t, 1.0, 0.0, off=-9.0)
        put(G.wood_crack(r), t + 0.02, 1.0, 0.05, off=-11.0)
        put(G.whoosh(0.45, r, 0.5, 300, 1800), t - 0.25, 1.0, 0.0, off=-14.0)
    for t in (19.20, 19.45, 19.70):
        put(I.glock(I.m2f(88 + int((t - 19.2) / 0.25) * 3), 0.5, r, 1.2), t, 1.0, 0.3, off=-17.0)
    put(G.hammer_hit(r, 0.7), 26.42, 1.0, -0.15, off=-10.0)

    # ---- the place: a light prairie breeze bed, a few birds, the xfade whooshes ----
    put(G.breeze(DUR, r, 0.6), 0.0, 1.0, 0.0, mode="integrated", off=-30.0)
    for t in (1.2, 4.6, 12.4, 23.8):
        put(G.bird_chirps(1.6, r, 0.35 + 0.2 * r.random()), t, 1.0, 0.35 * (1 if r.random() < 0.5 else -1), off=-24.0)
    for t in (16.93, 26.03, 29.27):
        put(G.whoosh(0.7, r, 0.35, 200, 1400), t - 0.35, 1.0, 0.0, off=-15.0)
    return b


# ================================================================ master
def lufs(x):
    v = integrated(x)
    return v if np.isfinite(v) else -99.0


def section_gains(m_ducked, v):
    gains = []
    for i, (a, b) in enumerate(SHOTS):
        f0, f1 = int(round(a / FPS * SR)), int(round(b / FPS * SR))
        Lm, Lv = lufs(m_ducked[:, f0:f1]), lufs(v[:, f0:f1])
        gains.append((Lv + MUSIC_OFF[i] - Lm) if (np.isfinite(Lm) and np.isfinite(Lv) and Lm > -70) else -99.0)
    last = next((g for g in reversed(gains) if g > -50), 0.0)
    gains = [max(g if g > -50 else last, -26.0) for g in gains]
    curve = np.zeros(N)
    t = np.arange(N) / SR
    for i, (a, b) in enumerate(SHOTS):
        curve[t >= a / FPS] = gains[i]
    return ndimage.uniform_filter1d(curve, ns(0.35), mode="nearest"), gains


def main():
    t_start = time.time()
    words = load_words()
    v = load_voice()
    v_ref = lufs(v)
    log(f"voice: {v_ref:.2f} LUFS, TP {true_peak(v):.2f} dBTP, {len(v[0]) / SR:.3f} s")

    m = build_music()
    dk = duck_curve()
    m_d = m * dbg(dk)[None, :]
    sec, gains = section_gains(m_d, v)
    m = m_d * dbg(sec)[None, :]
    log("music section gains (dB):", " ".join(f"{g:+.1f}" for g in gains))

    s = build_sfx(v_ref)
    log(f"stems: music {lufs(m):.1f}, sfx {lufs(s):.1f}, voice {lufs(v):.1f} LUFS")

    mix = v + m + s
    G = TARGET_LUFS - lufs(mix)
    for it in range(6):
        y, g3 = limiter(mix * dbg(G))
        L = lufs(y)
        log(f"master iter {it}: gain {G:+.2f} -> {L:.2f} LUFS, TP {true_peak(y):.2f} dBTP, maxGR {-20 * np.log10(g3.min()):.2f} dB")
        if abs(L - TARGET_LUFS) < 0.02:
            break
        G += TARGET_LUFS - L
    y = fades(y, 0.0, 0.06)
    assert y.shape == (2, N), y.shape
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    write_wav(OUT, y, 24)
    log(f"wrote {OUT}: {integrated(y):.2f} LUFS, {true_peak(y):.2f} dBTP, {N} samples = {N / SR:.3f} s")
    log(f"done in {time.time() - t_start:.0f} s")


if __name__ == "__main__":
    main()
