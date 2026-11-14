# Sound sources that the bridge film never needed: soft shoes, a goose, a hand cart, an oar, a church bell, a
# wooden door, a china cake stand. Same construction style as sfx_gen.py (impulse/noise excitation -> resonator bank,
# or formant synthesis for the animal), and every generator is deterministic given its `r` RNG.
import numpy as np
from dsp import (SR, TAU, ns, tt, rng, lp, hp, bp, reson, resbank, peq, colored, smooth_noise, ramp, fades, shape,
                 phase, modal, pan, st, widen, place)
import sfx_gen as G

# inharmonic mode sets
COBBLE = [(420, 16, 0.9), (880, 20, 0.7), (1600, 24, 0.45), (2600, 30, 0.25), (4100, 34, 0.12)]
STONE = [(300, 12, 1.0), (700, 16, 0.6), (1250, 20, 0.35), (2100, 26, 0.18)]
PLANK = [(190, 10, 1.0), (430, 13, 0.8), (820, 16, 0.5), (1450, 20, 0.28), (2500, 24, 0.14)]
# a church bell: hum, prime, tierce, quint, nominal, superquint, octave nominal - the classic English ringing bell
BELL = [(1.000, 1.00, 1.00), (2.000, 0.90, 0.92), (2.400, 1.00, 0.78), (3.000, 0.85, 0.62),
        (4.000, 1.00, 0.55), (5.400, 0.80, 0.28), (8.000, 0.70, 0.16), (10.800, 0.55, 0.08)]


# ---------------------------------------------------------------- footsteps
def step(r, surf="cobble", run=1.0):
    """one soft-soled shoe: a low thump + the ground's own ring + a small scuff. run>1 = a harder, faster landing."""
    d = 0.34
    t = tt(d)
    f = r.uniform(72, 96)
    thump = np.exp(-t / r.uniform(0.026, 0.040)) * np.sin(phase(f * (1 + 0.2 * np.exp(-t / 0.010))))
    modes = {"cobble": COBBLE, "stone": STONE, "wood": PLANK}[surf]
    ring = modal(d, [(fr * r.uniform(0.94, 1.07), q, g * (0.5 if surf == "cobble" else 1.0)) for fr, q, g in modes], r)
    nz = r.standard_normal(len(t))
    tap = bp(nz, 900, 5000, 1) * np.exp(-t / 0.004) * (0.30 if surf == "cobble" else 0.22)
    scuff = bp(nz, 350, 2600, 1) * np.clip(t / 0.015, 0, 1) * np.exp(-t / 0.055) * 0.20 * r.uniform(0.4, 1.0)
    g = {"cobble": 0.62, "stone": 0.72, "wood": 0.80}[surf]
    return fades((thump * 0.9 + ring * g + tap + scuff) * (0.85 + 0.3 * (run - 1.0)), 0.0, 0.05)


def hop(r):
    """a child's light two-foot landing"""
    return step(r, "cobble", 0.8) * 0.7


# ---------------------------------------------------------------- goose
def honk(r, f0=None, dur=None):
    """a goose: buzzy formant source with a fast pitch fall and a breathy attack"""
    base = f0 or r.uniform(300, 430)
    d = dur or r.uniform(0.22, 0.34)
    n = ns(d)
    t = np.arange(n) / SR
    f = base * G._track(n, [(0, 1.25), (d * 0.18, 1.35), (d * 0.5, 1.0), (d, 0.82)], t)
    forms = G.vowel_track(n, [(0, "A"), (d * 0.35, "a"), (d, "o")])
    amp = np.clip(t / 0.012, 0, 1) * np.clip((d - t) / 0.05, 0, 1)
    y = G.vox(f, forms, amp, r, 1.15, tilt=0.9, breath=0.08, fmax=6500, jitter=0.003)
    y = y * (1 + 0.5 * np.tanh(3.0 * np.sin(2 * np.pi * base * t)))      # nasal rasp
    y = peq(y, 2200, 5.0, 0.9)
    y += bp(r.standard_normal(n), 900, 4500, 1) * np.exp(-t / 0.018) * 0.20
    return fades(y * 0.75, 0.004, 0.05)


# ---------------------------------------------------------------- the cart, the oar, the door
def cart_roll(dur, r, speed=1.0):
    """a wooden hand cart rolling on cobbles: wheel clatter whose rate rises and falls with `speed`"""
    n = ns(dur)
    rate = np.linspace(7.0, 7.0, 32) * speed * (1 + 0.12 * np.sin(np.linspace(0, 3, 32)))
    imp = G.stick_slip(dur, rate, r, 0.06)
    body = resbank(imp, [(150, 8, 1.0), (320, 11, 0.7), (640, 14, 0.45), (1150, 18, 0.25)])
    rumble = lp(r.standard_normal(n), 220, 1) * 0.5
    return fades(body + rumble, 0.02, 0.05)


def cart_creak(dur, r):
    return G.creak(dur, r, 90, 150, G.TIMBER, rough=0.16, scale=0.9)


def oar_dip(r, pull=1.0):
    """an oar blade entering and pulling through water, with the wooden thunk against the rowlock"""
    d = 0.9
    t = tt(d)
    ent = bp(r.standard_normal(len(t)), 400, 5000, 1) * np.exp(-t / 0.05) * (1 - np.exp(-t / 0.004)) * 0.9
    bub = G.bubbles(0.9, r, 60, 300, 3000) * 0.5
    thunk = modal(d, [(180, 9, 0.9), (390, 12, 0.6), (760, 15, 0.35)], r) * np.exp(-t / 0.12) * 0.7
    blade = lp(r.standard_normal(len(t)), 700, 1) * np.exp(-t / 0.16) * 0.5 * pull
    return fades(ent + bub + thunk + blade, 0.005, 0.15)


def door_open(r):
    """the church door: latch clink, a long wooden creak, a soft hinge sigh"""
    clink = G.clink(r, r.uniform(900, 1600), 0.16, 0.7) * 0.7
    cr = G.creak(0.75, r, 70, 190, G.WOOD, rough=0.13, scale=0.7)
    sigh = lp(r.standard_normal(ns(0.6)), 500, 1) * np.linspace(0, 1, ns(0.6)) ** 0.5 * np.linspace(1, 0, ns(0.6)) * 0.25
    y = np.zeros((2, ns(1.0)))
    place(y, clink, 0.0)
    place(y, cr, 0.06)
    place(y, sigh, 0.2)
    return fades(y, 0.004, 0.12)


# ---------------------------------------------------------------- the cake
def cake_set(r):
    """the cake stand meeting the table: a wooden thump with a small china ring - the payoff of the whole film"""
    d = 0.8
    t = tt(d)
    thump = np.exp(-t / 0.05) * np.sin(phase(r.uniform(80, 105) * (1 + 0.25 * np.exp(-t / 0.012))))
    wood = modal(d, [(160, 9, 1.0), (370, 12, 0.6), (720, 15, 0.3)], r) * np.exp(-t / 0.18)
    china = modal(d, [(2400, 60, 0.16), (3900, 70, 0.10), (5900, 80, 0.06)], r) * np.exp(-t / 0.5)
    return fades(thump * 1.0 + wood * 0.8 + china, 0.0, 0.1)


def china_rattle(dur, r, level=1.0):
    """plates and cups on a wobbling tray"""
    n = ns(dur)
    y = np.zeros((2, n))
    t = 0.02
    while t < dur:
        c = G.clink(r, r.uniform(1800, 4200), 0.14, 0.8) * r.uniform(0.3, 1.0)
        place(y, c, t)
        t += r.uniform(0.05, 0.14)
    return fades(y * 0.5 * level, 0.004, 0.05)


def flour_puff(dur, r):
    """a soft flour cloud: short bright noise bloom"""
    n = ns(dur)
    y = bp(r.standard_normal(n), 1200, 7000, 1) * (1 - np.exp(-tt(dur) / 0.008)) * np.exp(-tt(dur) / (dur * 0.30))
    return fades(y * 0.5, 0.0, 0.06)


def stumble(r):
    """shoe slip + a hand catching the cake: scuff, a small oof and a china tinkle"""
    d = 0.7
    y = np.zeros((2, ns(d)))
    place(y, G.stroll_step(r, 1.0) * 1.2, 0.0)
    place(y, G.oof(r, "oof") * 0.5, 0.05)
    place(y, china_rattle(0.15, r, 0.8), 0.10)
    return fades(y, 0.004, 0.1)


# ---------------------------------------------------------------- the bell
def bell_toll(r, f0=196.0, big=1.0):
    """a cast church bell: inharmonic partials, a long hum, and a metallic strike transient. 196 Hz = a G3 bell."""
    d = 6.0
    t = tt(d)
    y = np.zeros(len(t))
    for rat, q, amp in BELL:
        decay = d * (0.30 + 0.70 / (1 + rat))          # low partials ring longest
        y += amp * np.exp(-t / decay) * np.sin(phase(f0 * rat * (1 + 0.0015 * np.sin(2 * np.pi * 3.1 * t))))
    nz = r.standard_normal(len(t))
    strike = bp(nz, 900, 6000, 1) * np.exp(-t / 0.010) * 0.5
    y = y * big + strike
    y = peq(y, 1100, 2.5, 1.0)
    return fades(y / max(1e-6, np.max(np.abs(y))) * 0.95, 0.001, 0.9)


def rope_creak(dur, r, amp=1.0):
    """the bell rope / the wooden headstock rocking"""
    return G.creak(dur, r, 55, 130, G.TIMBER, rough=0.18, scale=1.2,
                   shape_pts=[(0, 0), (0.25, 1), (0.6, 0.6), (1, 0)]) * amp


# ---------------------------------------------------------------- crowd
def crowd_bed(dur, r, level=1.0, seed=3):
    """market / wedding-party murmur: layers of babble at different distances, no intelligible words"""
    n = ns(dur)
    y = np.zeros((2, n))
    for i, (base, sc, g) in enumerate([(118, 1.0, 1.0), (152, 0.85, 0.8), (196, 0.72, 0.6), (96, 1.25, 0.5)]):
        b = G.babble(dur, rng(seed * 31 + i), base, sc, rate=r.uniform(3.4, 5.2), active=0.7, fmax=3200)
        d = r.uniform(4.0, 14.0)
        y += pan(b, r.uniform(-0.8, 0.8)) * g * (2.6 / d)
    return y * level


def cheer(dur, r, joy=1.0):
    """a wedding-party cheer: hurrahs over applause, with a couple of kids higher up"""
    n = ns(dur)
    y = np.zeros((2, n))
    t = 0.0
    while t < dur * 0.55:
        place(y, pan(G.hurrah(r, 150, 0.9), r.uniform(-0.6, 0.6)), t)
        t += r.uniform(0.18, 0.42)
    place(y, pan(G.hurrah(r, 300, 1.1, kid=True) * 0.6, r.uniform(-0.5, 0.5)), 0.1)
    y += _fit(G.applause(dur, r, people=48), n) * 0.9
    return fades(y * joy, 0.01, 0.2)


def _fit(x, n):
    if x.shape[1] >= n:
        return x[:, :n]
    return np.pad(x, ((0, 0), (0, n - x.shape[1])))


def bird_flock(dur, r):
    """startled pigeons leaving a tower"""
    n = ns(dur)
    y = np.zeros((2, n))
    t = 0.0
    while t < dur:
        place(y, pan(G.bird_chirps(0.25, r, 1.0, "sparrow") * r.uniform(0.25, 0.7), r.uniform(-1, 1)), t)
        t += r.uniform(0.05, 0.16)
    flip = bp(r.standard_normal(n), 600, 3500, 1) * np.exp(-tt(dur) / (dur * 0.5)) * 0.35
    return fades(y + flip, 0.01, 0.1)
