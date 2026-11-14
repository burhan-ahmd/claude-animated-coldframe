# Picture timeline for "Pip and the Noon Bell", mirrored (read-only) from src/videos/noonbell/contract.ts so that every
# sound lands on the frame. 1080x1920, 30 fps, 900 frames = 30.000 s exactly. Daytime, silent film: music + SFX only.
#
# What lives here: the shot grid, the crossfades, Pip's walking cadence (derived by integrating his speed curve, so the
# footsteps match the picture's pace), the ground surface under him at any moment, the cart duck, the geese, the oars,
# and the bell (BELL_AT / BELL_STRIKE). sfx.py and music.py both read this and nothing else.
import math
import numpy as np

FPS = 30
TOTAL = 900
DUR = TOTAL / FPS                 # 30.000 s exactly
N = int(round(DUR * 48000))       # 1,440,000 samples
fr = lambda f: f / FPS

# ---------------------------------------------------------------- shots (id: first frame, end frame, spot)
SHOTS = {
    1: (0, 118, "bakery"), 2: (118, 250, "market"), 3: (250, 368, "lane"), 4: (368, 500, "bridge"),
    5: (500, 620, "climb"), 6: (620, 742, "square"), 7: (742, 834, "tower"), 8: (834, TOTAL, "door"),
}
# crossfades: the pictures overlap for x frames centred on the cut (mirrors story.ts XFADE)
XFADE = {2: 6, 3: 6, 4: 8, 5: 6, 6: 8, 7: 6, 8: 6}


def shot_t(i):
    a, b = SHOTS[i][:2]
    return fr(a), fr(b)


def shot_at(t):
    f = t * FPS
    for i in sorted(SHOTS, reverse=True):
        if f >= SHOTS[i][0]:
            return i
    return 1


def cut_times():
    """the moment of each cut (the whoosh in the mix peaks here)"""
    return [fr(SHOTS[i][0]) for i in sorted(SHOTS) if i > 1]


# ---------------------------------------------------------------- the street (contract.ts)
Z_START, Z_BAKERY, Z_MARKET, Z_LANE = 34.0, 30.0, 14.0, -4.0
RIVER_Z1, RIVER_Z0, Z_RIVER, WATER_Y = -12.0, -32.0, -22.0, -3.4
RAMP0, RAMP1, RAMP_H = -44.0, -58.0, 2.2
Z_SQUARE, Z_TOWER, Z_DOOR = -62.0, -76.0, -84.0
PIP_TZ = [(0.0, Z_START), (fr(118), 26.0), (fr(250), 6.0), (fr(368), -10.0), (fr(500), -44.0),
          (fr(620), -58.0), (fr(742), -72.0), (fr(834), -76.0), (DUR, -82.0)]


def _lin(pts, x):
    if x <= pts[0][0]:
        return pts[0][1]
    for i in range(1, len(pts)):
        if x <= pts[i][0]:
            (x0, y0), (x1, y1) = pts[i - 1], pts[i]
            return y0 + (y1 - y0) * (x - x0) / max(1e-9, x1 - x0)
    return pts[-1][1]


def pip_z(t):
    return _lin(PIP_TZ, t)


def pip_speed(t):
    h = 0.02
    return abs(pip_z(t + h) - pip_z(t - h)) / (2 * h)


def pip_x(t):
    w = 0.0
    if t < 8.3:
        w += 0.55 * math.sin(t * 0.9)
    if 8.3 <= t < 12.3:
        w += 0.9 * math.sin(t * 1.35 + 0.7)
    return w


def surface(t):
    """ground under Pip: cobbles in town, planks on the bridge deck, stone up the climb and in the square"""
    spot = SHOTS[shot_at(t)][2]
    if spot == "bridge":
        return "wood"
    if spot in ("climb", "square", "tower", "door"):
        return "stone"
    return "cobble"


# ---------------------------------------------------------------- Pip's footsteps
# The picture compresses the town (each shot cuts to a later stretch of street), so the cadence comes from a per-shot
# on-screen speed, not from the global z curve. Step length 0.85 m -> ~2.1 steps/s at a normal walk, ~3/s running.
STEP_LEN = 0.85
SPEED = {1: 1.85, 2: 1.95, 3: 2.05, 4: 1.45, 5: 1.05, 6: 1.55, 7: 2.65, 8: 2.25}   # m/s on screen
PAUSES = [(12.3, 13.0), (16.2, 17.4), (27.9, 29.0)]   # cart duck, the pause on the bridge, the look up at the bell


def _paused(t):
    return any(a <= t <= b for a, b in PAUSES)


def speed_at(t):
    if _paused(t):
        return 0.0
    return SPEED.get(shot_at(t), 1.8)


def footfalls():
    """[(t, foot, surface, speed)] - foot 0/1 alternating; the walker stops during the pauses."""
    out, s, foot = [], 0.0, 0
    while s < DUR - 0.05:
        v = speed_at(s)
        if v > 0.3:
            out.append((round(s, 4), foot, surface(s), v))
            foot ^= 1
            s += STEP_LEN / v
        else:
            s += 0.2
    return out


# ---------------------------------------------------------------- the bell
BELL_AT = 27.2          # the first swing
BELL_STRIKE = 29.1      # the noon strike (the film's payoff)
BELL_F = 0.85           # Hz


def bell_swings():
    """[(t, amp 0..1)] for every swing, so the rope, the bell and the air can all be cued"""
    out = []
    t = BELL_AT
    while t < DUR - 0.15:
        u = t - BELL_AT
        amp = min(0.62, 0.16 + 0.5 * (min(1.0, u / 1.4) ** 2 * (3 - 2 * min(1.0, u / 1.4))))
        out.append((round(t, 4), amp / 0.62))
        t += 1.0 / (2 * BELL_F)
    return out


def bell_strikes():
    """the audible strikes: every half-swing after BELL_STRIKE is a clang"""
    return [t for (t, _a) in bell_swings() if t >= BELL_STRIKE - 0.02]


# ---------------------------------------------------------------- props on the route
CART_T = 12.3           # the cart duck (frame 369)
CLIMB_T = (fr(500), fr(620))
GEESE_T = (fr(118), 17.0)
BOAT_T = (12.0, 17.8)   # the boatman crosses under the span
OARS = [12.4, 13.6, 14.8, 16.0, 17.2]
GOOSE_HONKS = [5.4, 7.1, 9.6, 10.9, 13.8, 15.6]


def camera_distance():
    """rough distance from the lens to the subject per shot, for the SFX distance model"""
    d = {1: 2.6, 2: 3.6, 3: 2.8, 4: 9.0, 5: 3.4, 6: 5.0, 7: 7.5, 8: 3.0}
    return d


def dist_fx(d, near=2.5, far=9.0):
    """(gain_dB, lpf_hz or None, reverb_send) for a source d metres away: closer = louder and drier"""
    k = float(np.clip((d - near) / max(1e-6, far - near), 0.0, 1.0))
    g = -7.0 * k
    lpf = None if k < 0.05 else int(14000 - 9000 * k)
    return g, lpf, 0.10 + 0.22 * k


def crowd_at(t):
    """(level 0..1, shot) of the crowd murmur - the market in shots 2-3, the wedding guests from shot 6"""
    if 4.0 <= t < 12.3:
        return 0.55 + 0.25 * (t - 4.0) / 8.3, shot_at(t)
    if t >= 20.7:
        return min(1.0, 0.45 + (t - 20.7) / 6.0), shot_at(t)
    return 0.0, shot_at(t)
