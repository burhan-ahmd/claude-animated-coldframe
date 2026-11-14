# Original bright comic-heroic score for "Pip and the Noon Bell", composed and synthesised here. G major, 120 bpm, one
# quarter note = 0.5 s = one of Pip's walking steps, four quarters to the bar (2.0 s per bar, 15 bars over 30.000 s).
# One theme (A, eight bars) is stated, broken up, developed and finally answered by the real church bell at 29.1 s.
#
# Map to the picture (timeline.SHOTS):
#   bars 1-2   0.0-4.0   shot 1 bakery     the errand: music box + pizzicato, small and warm
#   bars 3-4   4.0-8.0   shot 2 market     the tune arrives in full: fife + glock, tuba oom-pah, light snare
#   bars 5-6   8.0-12.3  shot 3 lane       sneaking pizzicato, a chromatic slip as he ducks the cart axle
#   bars 7-8   12.3-16.7 shot 4 bridge     lyrical whistle over a warm pad: the one moment he can breathe
#   bars 9-10  16.7-20.7 shot 5 climb      a rising sequence (G-A-B-C), timpani pulse, snare drive, crescendo
#   bars 11-12 20.7-24.7 shot 6 square     full band, theme A grand, brass stabs, cymbal
#   bar 13-13.9 24.7-27.8 shot 7 tower     held dominant D7, snare roll crescendo, glock ticking, timpani
#   bar 13.9-14.5 27.8-29.1 shot 8 door    hushed: a thin pad and one held note - the breath before noon
#   29.1-30.0            shot 8 door       NOON: tutti G major hit exactly on the bell strike, ringing out
import numpy as np
from dsp import SR, ns, rng, pan, place, fades, dbg, make_ir, convolve_st, integrated, lp, hp
import instruments as I
import timeline as T

N = ns(T.DUR)
Q = 0.5                     # quarter note (s)
BAR = 4 * Q                 # 2.0 s

# theme A: (bar, beat, length in quarters, midi) — a plain, singable tune that can be whistled
THEME = [
    (1, 0, 1, 67), (1, 1, 1, 71), (1, 2, 2, 74),
    (2, 0, 1, 72), (2, 1, 1, 74), (2, 2, 2, 71),
    (3, 0, 1, 69), (3, 1, 1, 72), (3, 2, 2, 76),
    (4, 0, 1.5, 74), (4, 1.5, .5, 71), (4, 2, 2, 67),
    (5, 0, .5, 67), (5, .5, .5, 69), (5, 1, 1, 71), (5, 2, 2, 74),
    (6, 0, 1, 76), (6, 1, 1, 74), (6, 2, 2, 72),
    (7, 0, 1, 71), (7, 1, 1, 69), (7, 2, 1, 67), (7, 3, 1, 66),
    (8, 0, 4, 67),
]
# the lyrical half, used alone on the bridge
THEME_LYRIC = [(b, beat, d, m) for (b, beat, d, m) in THEME if b in (3, 4)]
CHB = {1: ["G"] * 4, 2: ["D7", "D7", "G", "G"], 3: ["C", "C", "G", "G"], 4: ["G", "G", "D7", "D7"],
       5: ["G", "G", "C", "C"], 6: ["C", "C", "G", "G"], 7: ["D7"] * 4, 8: ["G"] * 4}
CH = {
    "G": dict(oom=(43, 50), pah=[59, 62, 67], hi=[62, 67, 71]),
    "D": dict(oom=(50, 45), pah=[57, 62, 66], hi=[62, 66, 69]),
    "D7": dict(oom=(50, 45), pah=[57, 60, 66], hi=[60, 66, 69]),
    "C": dict(oom=(48, 55), pah=[60, 64, 67], hi=[64, 67, 72]),
    "Am": dict(oom=(45, 52), pah=[57, 60, 64], hi=[60, 64, 69]),
    "Em": dict(oom=(40, 47), pah=[59, 64, 67], hi=[64, 67, 71]),
}
F = I.m2f

SECTIONS = [
    ("errand", 0.00, 4.00), ("market", 4.00, 8.00), ("lane", 8.00, 12.30), ("bridge", 12.30, 16.70),
    ("climb", 16.70, 20.70), ("square", 20.70, 24.70), ("tower", 24.70, 27.80), ("hush", 27.80, 29.10),
    ("noon", 29.10, T.DUR),
]


class Band:
    def __init__(self):
        self.tr = {}
        self.send = {}
        self.cues = []

    def track(self, name, send):
        if name not in self.tr:
            self.tr[name] = np.zeros((2, N))
            self.send[name] = send
        return self.tr[name]

    def add(self, name, x, t, p=0.0, g=1.0, send=0.15):
        buf = self.track(name, send)
        place(buf, pan(x, p) if np.ndim(x) == 1 else x, t, g)


R = rng(900)


def _r():
    return rng(int(R.integers(1 << 30)))


def theme(t_bar1, bars=range(1, 9), transpose=0, vel=1.0, late=0.0):
    """(bar, beat, quarters, midi) -> [(t, dur_s, midi, vel)]"""
    return sorted((t_bar1 + (b - 1) * BAR + beat * Q + late, d * Q, m + transpose, vel)
                  for (b, beat, d, m) in THEME if b in bars)


def oompah(b, t_bar, chords, vel=0.6, every=True, pah_vel=0.4, bounce=False, pah=True):
    for beat in range(4):
        c = CH[chords[beat]]
        t = t_bar + beat * Q
        if bounce:
            lo = c["oom"][0]
            b.add("tuba", I.brass(F(lo), 0.2, vel, _r(), "tuba", scoop=-30), t, -0.1)
            b.add("tuba", I.brass(F(lo + 12), 0.16, vel * 0.85, _r(), "tuba", scoop=-45), t + Q / 2, -0.1)
        elif every or beat in (0, 2):
            m = c["oom"][beat % 2] if every else c["oom"][0 if beat == 0 else 1]
            b.add("tuba", I.brass(F(m), 0.3, vel * (1.0 if beat in (0, 2) else 0.88), _r(), "tuba"), t, -0.1)
        if pah and (every or beat in (1, 3)):
            tt_ = t + (Q / 2 if every else 0.0)
            for k, m in enumerate(c["pah"]):
                b.add("pah", I.brass(F(m), 0.15, pah_vel, _r(), "horn", scoop=-12), tt_ + 0.004 * k, 0.32 - 0.12 * k)


SN = {
    "light": [1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0, 2, 0, 1, 1],
    "walk": [3, 0, 1, 1, 2, 0, 1, 0, 3, 0, 1, 1, 2, 0, 1, 0],
    "drive": [2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 1],
}


def snare_bar(b, t_bar, pat, vel, steps=range(16), cres=0.0):
    for s in steps:
        v = SN[pat][s]
        if not v:
            continue
        t = t_bar + s * Q / 4
        vv = vel * (1 + cres * s / 16) * {1: 0.5, 2: 0.9, 3: 0.95}[v] * R.uniform(0.93, 1.05)
        if v == 3:
            b.add("snare", I.snare(vv * 0.4, _r()), t - 0.026, 0.05)
        b.add("snare", I.snare(vv, _r()), t + R.normal(0, 0.002), 0.05)


def roll(b, t0, t1, v0, v1, accent=None, at=None):
    for t, v in I.snare_roll(t0, t1, v0, v1, _r()):
        b.add("snare", I.snare(v, _r(), dur=0.14, buzz=True), t, 0.05)
    if accent:
        at = t1 if at is None else at
        b.add("snare", I.snare(accent * 0.4, _r()), at - 0.026, 0.05)
        b.add("snare", I.snare(accent, _r()), at, 0.05)


def melody(b, name, notes, fn="glock", p=0.0, gate=0.9, detune=0.0):
    """notes = [(t, dur_s, midi, vel)]"""
    for (t, d, m, v) in notes:
        if fn == "glock":
            x = I.glock(F(m + detune), v * R.uniform(0.92, 1.05), _r())
        elif fn == "fife":
            x = I.fife(F(m + detune), d * gate, v * R.uniform(0.94, 1.04), _r())
        elif fn == "vibes":
            x = I.vibes(F(m + detune), v * R.uniform(0.92, 1.05), _r(), dur=max(1.2, d + 0.8), damp=d + 0.35)
        elif fn == "musicbox":
            x = I.musicbox(F(m + detune), v * R.uniform(0.92, 1.05), _r())
        else:
            raise ValueError(fn)
        b.add(name, x, t, p)


def chorus(b, name, notes, voices, seed, joins=None, spread=0.75, vel=1.0, solo_gain=1.0):
    """several villagers whistling the same tune: own detune, timing, vibrato, breath and place across the square"""
    rr = rng(seed)
    for v in range(voices):
        rv = rng(seed * 101 + v)
        nv = [(t, d, m, vv * vel * rv.uniform(0.85, 1.0)) for (t, d, m, vv) in notes if joins is None or t >= joins[v] - 1e-6]
        if not nv:
            continue
        t0, y = I.whistle(nv, rv, detune=rv.uniform(-11, 11) if v else 0.0, jit=0.010,
                          lag=rv.uniform(0, 0.022) if v else 0.0, vib_rate=rv.uniform(5.0, 6.6),
                          vib_depth=rv.uniform(10, 22), breath=rv.uniform(0.04, 0.07))
        g = solo_gain if v == 0 else rv.uniform(0.45, 0.8)
        p = 0.0 if v == 0 else spread * rr.uniform(-1, 1)
        if v:
            y = lp(y, rv.uniform(5000, 9000), 1)
        b.add(name, y, t0, p, g)


def build():
    b = Band()
    for name, send in [("whistle", 0.0), ("fife", 0.16), ("glock", 0.22), ("tuba", 0.10), ("pah", 0.18),
                       ("snare", 0.13), ("cymbal", 0.16), ("stab", 0.16), ("timpani", 0.18), ("pad", 0.25),
                       ("vibes", 0.26), ("musicbox", 0.26), ("pluck", 0.18), ("brush", 0.12), ("triangle", 0.25)]:
        b.track(name, send)

    # ============ ERRAND (bars 1-2, 0-4 s): small and warm. Music box carries the tune, pizzicato walks, no drums.
    er = theme(0.0, bars=[1, 2], vel=0.55)
    melody(b, "musicbox", er, "musicbox", p=0.18)
    melody(b, "glock", er, "glock", p=-0.28, detune=12)
    for bar in (1, 2):
        tb = (bar - 1) * BAR
        for beat in range(4):
            m = CH[CHB[bar][0]]["oom"][beat % 2] + 12
            b.add("pluck", I.pluck(F(m), 0.55 * (1.0 if beat in (0, 2) else 0.7), _r(), dur=0.45, bright=0.4), tb + beat * Q, -0.05)
        for k, m in enumerate(CH[CHB[bar][0]]["hi"]):
            b.add("pad", I.pad([F(m)], BAR * 0.95, 0.10, _r(), att=0.6, rel=0.8), tb, 0.25 - 0.1 * k)
    b.add("triangle", I.triangle(0.25, _r(), dur=0.8), 1.0, 0.3)
    b.cues.append((0.0, "errand: theme A1-A2 on music box + glock, walking pizzicato, soft pad. Small, charming."))

    # ============ MARKET (bars 3-4, 4-8 s): the tune in full - fife + glock, tuba oom-pah, light snare.
    mk = theme(4.0, bars=[3, 4], vel=0.7)
    melody(b, "fife", mk, "fife", p=0.22)
    melody(b, "glock", mk, "glock", p=-0.32, detune=12)
    b.add("cymbal", I.cymbal(0.34, _r()), 4.0, 0.0)
    for bar in (3, 4):
        tb = 4.0 + (bar - 3) * BAR
        oompah(b, tb, CHB[bar], 0.52, True, 0.34)
        snare_bar(b, tb, "light", 0.34)
    b.cues.append((4.0, "market: theme A3-A4 tutti-lite - fife + glock on top, tuba on the beats, horns on the &s."))

    # ============ LANE (bars 5-6, 8-12.3 s): sneaking pizzicato, and a chromatic slip as he ducks under the axle.
    zv = theme(8.0, bars=[5, 6], vel=0.6)
    melody(b, "fife", zv, "fife", p=0.25)
    melody(b, "musicbox", zv, "musicbox", p=-0.3)
    for bar in (5, 6):
        tb = 8.0 + (bar - 5) * BAR
        for beat in range(4):
            m = CH[CHB[bar][0]]["oom"][beat % 2] + 12
            b.add("pluck", I.pluck(F(m), 0.7 if beat % 2 == 0 else 0.45, _r(), dur=0.32, bright=0.6), tb + beat * Q, -0.05)
        for k in range(8):                       # light ticking 8ths
            b.add("glock", I.glock(F(CH[CHB[bar][0]]["hi"][k % 3]), 0.16, _r(), dur=0.4), tb + k * Q / 2, -0.35)
    b.add("timpani", I.timpani(F(43), 0.35, _r()), 8.0, -0.1)
    b.cues.append((8.0, "lane: sneaking pizzicato, ticking glock, fife + music box on the theme."))
    # the duck: a quick chromatic tumble down, then a comic bump on the cobbles
    slip = [(11.95 + k * 0.075, 0.075, 74 - k, 0.5) for k in range(6)]
    melody(b, "fife", slip, "fife", p=0.2, gate=0.8)
    for k in range(4):
        b.add("snare", I.snare(0.28, _r(), dur=0.2), 12.30 + k * 0.05, 0.15)
    b.add("timpani", I.timpani(F(38), 0.3, _r()), 12.42, -0.1)
    b.cues.append((11.95, "the cart duck: fife tumbles chromatically down A-G-F#-F-E-Eb, four light snare taps, a low thud."))

    # ============ BRIDGE (bars 7-8, 12.3-16.7 s): the one moment he can breathe - solo whistle over a warm pad.
    b.add("cymbal", I.cymbal(0.3, _r(), dur=2.4), 12.30, 0.0)
    for (ta, tb_, ms) in [(12.30, 14.30, [43, 55, 62, 67]), (14.30, 16.30, [48, 55, 60, 67]), (16.30, 16.75, [50, 57, 62, 66])]:
        b.add("pad", I.pad([F(m) for m in ms], tb_ - ta, 0.5, _r(), att=0.45, rel=0.7), ta, 0.0)
        b.add("tuba", I.brass(F(ms[0] - 12 if ms[0] > 40 else ms[0]), tb_ - ta - 0.06, 0.30, _r(), "soft", scoop=-8), ta + 0.05, -0.1)
    lyr = theme(12.30, bars=[3, 4], vel=0.95)
    chorus(b, "whistle", lyr, 1, 41, spread=0.0, solo_gain=1.05)
    melody(b, "vibes", lyr, "vibes", p=-0.25, gate=0.85)
    b.add("triangle", I.triangle(0.3, _r(), dur=1.0), 16.2, 0.3)
    b.cues.append((12.30, "bridge: the tune turns lyrical - solo whistle over a warm pad, soft low brass, vibes echo."))

    # ============ CLIMB (bars 7.35-9.35, 16.7-20.7 s): a rising sequence, timpani pulse, snare drive, crescendo.
    for i, (tb, tr) in enumerate([(16.70, 0), (17.70, 2), (18.70, 4), (19.70, 5)]):
        cell = [(tb + j * 0.25, 0.25, m + tr, 0.35 + 0.09 * i) for j, m in enumerate([67, 69, 71, 74])]
        melody(b, "glock", cell, "glock", p=-0.3)
        melody(b, "fife", cell, "fife", p=0.25)
        for k in range(4):
            b.add("pluck", I.pluck(F(43 + 2 * i), 0.6 + 0.07 * i, _r(), dur=0.3, bright=0.6), tb + k * 0.25, -0.05)
        b.add("timpani", I.timpani(F(43 + 2 * i), 0.4 + 0.08 * i, _r()), tb, -0.1)
        b.add("timpani", I.timpani(F(43 + 2 * i), 0.3 + 0.06 * i, _r()), tb + 1.0, -0.1)
    snare_bar(b, 16.70, "drive", 0.42, cres=0.3)
    snare_bar(b, 17.70, "drive", 0.5, cres=0.3)
    snare_bar(b, 18.70, "drive", 0.56, cres=0.35)
    roll(b, 19.70, 20.68, 0.35, 0.85, accent=0.7, at=20.70)
    b.cues.append((16.70, "climb: a four-step rising sequence (G-A-B-C), timpani pulse, snare drive, snare roll into the square."))

    # ============ SQUARE (bars 10.35-12.35, 20.7-24.7 s): the tune returns grand, full band, brass stabs, cymbal.
    b.add("cymbal", I.cymbal(0.44, _r(), dur=2.6), 20.70, 0.0)
    sq = theme(20.70, bars=[1, 2], vel=0.85)
    melody(b, "glock", sq, "glock", p=-0.32, detune=12)
    melody(b, "fife", sq, "fife", p=0.24)
    chorus(b, "whistle", theme(20.70, bars=[3, 4], vel=0.6), 4, 44, joins=[20.70, 21.2, 21.7, 22.2], spread=0.7, solo_gain=0.8)
    for bar in (1, 2):
        tb = 20.70 + (bar - 1) * BAR
        oompah(b, tb, CHB[bar], 0.62, True, 0.44, bounce=(bar == 2))
        snare_bar(b, tb, "walk", 0.5)
    for m in [55, 59, 62, 67]:                    # a bright brass stab on the arrival
        b.add("stab", I.brass(F(m), 0.18, 0.7, _r(), "stab", scoop=-14), 20.70, (m - 56) / 22)
    b.cues.append((20.70, "square: theme A grand - glock + fife + four whistlers, bouncing tuba, brass stab + cymbal."))

    # ============ TOWER (bars 12.35-13.9, 24.7-27.8 s): held dominant, snare roll crescendo, glock ticking, timpani.
    for (ta, tb_, ms) in [(24.70, 26.70, [50, 57, 60, 66]), (26.70, 27.80, [50, 56, 60, 66])]:
        b.add("pad", I.pad([F(m) for m in ms], tb_ - ta, 0.42, _r(), att=0.4, rel=0.5), ta, 0.0)
    for k in range(16):                           # glock ticks the rising dominant
        m = [62, 66, 69, 74][k % 4] + (12 if k >= 8 else 0)
        b.add("glock", I.glock(F(m), 0.24, _r(), dur=0.5), 24.70 + k * 0.1875, -0.34)
    for k in range(6):
        b.add("timpani", I.timpani(F(50), 0.32 + 0.05 * k, _r()), 24.70 + k * 0.5, -0.1)
    roll(b, 26.10, 27.75, 0.3, 0.95, accent=0.85, at=27.80)
    b.add("cymbal", I.cymbal(0.3, _r(), dur=1.6), 27.80, 0.0)
    b.cues.append((24.70, "tower: held D7 - glock ticking, timpani pulse, 1.65 s snare roll crescendo to the door."))

    # ============ HUSH (27.8-29.1 s): music all but gone. One held chord and one note. The breath before noon.
    b.add("pad", I.pad([F(43), F(50), F(62)], 1.3, 0.30, _r(), att=0.25, rel=0.5), 27.80, 0.0)
    b.add("vibes", I.vibes(F(74), 0.35, _r(), dur=1.4, damp=1.2, trem_depth=0.15), 27.85, -0.2)
    b.add("triangle", I.triangle(0.22, _r(), dur=0.7), 28.6, 0.3)
    b.cues.append((27.80, "hush: the band drops away - one sustained G, one vibes note, a triangle. Silence for the door."))

    # ============ NOON (29.1-30.0 s): tutti G major on the bell strike, ringing out.
    hit = T.BELL_STRIKE
    for m in [43, 50, 55, 59, 62, 67, 71, 74]:
        b.add("stab", I.brass(F(m), 0.22, 0.85, _r(), "stab", scoop=-10), hit, (m - 56) / 26)
    b.add("timpani", I.timpani(F(43), 0.9, _r()), hit, -0.1)
    b.add("cymbal", I.cymbal(0.5, _r(), dur=3.2), hit, 0.0)
    b.add("glock", I.glock(F(86), 0.7, _r(), dur=2.4), hit, -0.3)
    b.add("glock", I.glock(F(79), 0.55, _r(), dur=2.2), hit + 0.01, 0.25)
    b.add("pad", I.pad([F(m) for m in [43, 55, 62, 67, 71]], 0.85, 0.45, _r(), att=0.05, rel=0.9), hit, 0.0)
    b.add("vibes", I.vibes(F(79), 0.4, _r(), dur=1.0, damp=0.9), hit + 0.5, 0.25)
    b.cues.append((hit, "NOON: tutti G major hit exactly on the bell strike - brass, timpani, cymbal, glock, pad - ringing out."))

    end = np.ones(N)
    a = ns(T.DUR - 0.9)
    end[a:] = np.linspace(1, 0, N - a) ** 1.5
    for k in b.tr:
        b.tr[k] *= end[None, :]
    return b


TARGET = {  # relative balance inside the band (LU, measured on each track's own active span)
    "whistle": 0.0, "fife": -3.0, "glock": -6.5, "tuba": -3.0, "pah": -8.0, "snare": -6.0, "cymbal": -11.0,
    "stab": -3.5, "timpani": -5.5, "pad": -4.0, "vibes": -2.5, "musicbox": -2.0, "pluck": -4.5, "brush": -13.0,
    "triangle": -15.0,
}


def render(b, ref=-20.0):
    hall = make_ir(1.5, 7, pre=0.018, hf=1.4)
    yard = make_ir(0.9, 8, pre=0.008, hf=1.8, early=[(0.11, 0.5, -0.4), (0.19, 0.35, 0.5)])
    dry = np.zeros((2, N))
    wet_hall = np.zeros((2, N))
    wet_yard = np.zeros((2, N))
    levels = {}
    for k, x in b.tr.items():
        if not np.any(x):
            continue
        L = integrated(x)
        g = dbg(ref + TARGET.get(k, -6) - L)
        levels[k] = (round(L, 1), round(ref + TARGET.get(k, -6), 1))
        x = x * g
        b.tr[k] = x
        dry += x
        if k == "whistle":
            wet_yard += 0.16 * x
        else:
            wet_hall += b.send[k] * x
    out = dry + 0.7 * convolve_st(wet_hall.mean(0), hall) + 0.8 * convolve_st(wet_yard.mean(0), yard)
    out = hp(out, 30, 2)
    return out, levels
