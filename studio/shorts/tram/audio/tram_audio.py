#!/usr/bin/env python3
"""tram_audio.py - soundtrack for "The Last Tram" (1902), 450 frames @ 30 fps = 15.000 s.

Ambience + sound effects ONLY (no music, no voice): a heavy rain floor on the cobbles and on the
tram's roof, rail squeal + wheel rumble + motor drone, bells, brake bite, controller clacks, a
distant thunder roll, footfalls in 4-6 cm of water, a paper boat set down and left bobbing, the
boy's boots and the hollow metal step, and the departure. Cue frames come from the frozen
studio/src/videos/tram/story.ts; every frame number below is that file's law.

Deterministic: every generator is numpy default_rng(seed) - no unseeded randomness anywhere.
Writes studio/public/audio/tram-15s.wav : 48 kHz, stereo, 24-bit PCM, exactly 720000 samples,
-16 LUFS integrated, true peak <= -2.2 dBTP.

Usage:  python studio/shorts/tram/audio/tram_audio.py
"""
from __future__ import annotations

import math
import os
import sys
import time

import numpy as np
from scipy import ndimage, signal

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)

from dsp import (SR, TAU, ns, tt, rng, dbg, lp, hp, bp, peq, reson, resbank, colored, smooth_noise,  # noqa: E402
                 ramp, fades, shape, phase, modal, impulse_train, pan, st, place, widen, make_ir,
                 convolve_st, integrated, momentary, momentary_max, short_term, lra, true_peak, write_wav)
import sfx_gen as G                                                                                # noqa: E402

# ---------------------------------------------------------------- film contract
FPS = 30.0
TOTAL = 450
DUR = TOTAL / FPS                                  # 15.0 s exactly
N = ns(DUR)                                        # 720000 samples exactly
OUT_WAV = os.path.abspath(os.path.join(HERE, "..", "..", "..", "public", "audio", "tram-15s.wav"))
SEED = 20261113
TARGET_LUFS = -16.0
CEIL_DBTP = -2.90                                   # 0.7 dB under the -2.2 spec so no meter can trip


def fr(f: float) -> float:
    return f / FPS


def sat(x: float) -> float:
    return 0.0 if x < 0 else (1.0 if x > 1 else float(x))


def lerp(a, b, t):
    return a + (b - a) * t


def smootherstep(a, b, f):
    x = sat((f - a) / (b - a))
    return x * x * x * (x * (x * 6 - 15) + 10)


def rng_for(name: str):
    """named, reproducible generator: same seed chain every run."""
    h = 2166136261
    for c in name:
        h = ((h ^ ord(c)) * 16777619) & 0xFFFFFFFF
    return rng((SEED * 2654435761 + h) & 0x7FFFFFFF)


# ---------------------------------------------------------------- picture mirror (story.ts / contract.ts)
def tram_z(f: float) -> float:
    if f <= 96:
        return lerp(-22.0, -2.0, sat(f / 96.0) ** 2)
    if f <= 300:
        return -2.0
    return lerp(-2.0, -58.0, sat((f - 300.0) / 150.0) ** 2)


def tram_speed(f: float) -> float:
    """m/s, from the frozen tramZ() curve"""
    return (tram_z(min(TOTAL, f + 0.5)) - tram_z(max(0.0, f - 0.5))) * FPS


def tram_speed_per_sample(n: int) -> np.ndarray:
    fg = np.arange(-1.0, TOTAL + 2.0)
    vg = np.array([tram_speed(f) for f in fg])
    return np.interp(np.arange(n) / FPS, fg, vg)


def lady_x(f: float) -> float:
    return lerp(-3.75, 4.35, smootherstep(150, 344, f))


def boy_x(f: float) -> float:
    return lerp(4.16, 1.78, smootherstep(336, 386, f))


def boy_z(f: float) -> float:
    return lerp(-4.2, -3.72, smootherstep(336, 386, f))


def boat_pos(f: float) -> tuple[float, float]:
    if f < 196:
        return (lerp(4.02, 3.98, sat((f - 176) / 20.0)), lerp(-4.5, -5.0, sat((f - 176) / 29.0)))
    t = sat((f - 205) / 245.0)
    return (lerp(3.98, 3.02, t), lerp(-5.0, -6.45, t))


def pan_of(x: float, scale: float = 4.6) -> float:
    """world x (m, street centre 0, kerbs +/-4.62) -> stereo pan, camera on the +X pavement"""
    return float(np.clip(x / scale, -0.95, 0.95))


SHOTS = [(0, 70), (70, 150), (150, 248), (248, 330), (330, 405), (405, 450)]
CAMS = [  # key positions per shot, straight out of story.ts CAMS
    [(0, (6.55, 3.92, 10.6)), (70, (6.05, 3.34, 8.35))],
    [(70, (5.15, 1.86, 6.9)), (110, (4.82, 1.72, 5.2)), (150, (4.66, 1.66, 4.35))],
    [(150, (5.5, 1.62, 3.5)), (200, (5.34, 1.52, 2.5)), (248, (5.2, 1.44, 1.6))],
    [(248, (4.62, 0.5, -2.05)), (292, (4.5, 0.44, -2.42)), (330, (4.4, 0.4, -2.75))],
    [(330, (4.72, 1.5, -0.55)), (368, (4.58, 1.56, -0.95)), (405, (4.46, 1.6, -1.3))],
    [(405, (5.3, 2.02, 3.7)), (450, (5.2, 2.08, 3.95))],
]


def shot_at(f: float) -> int:
    for i, (a, b) in enumerate(SHOTS):
        if f < b:
            return i
    return len(SHOTS) - 1


def cam_pos(f: float) -> np.ndarray:
    ks = CAMS[shot_at(f)]
    fr_ = float(np.clip(f, ks[0][0], ks[-1][0]))
    out = []
    for ax in range(3):
        out.append(float(np.interp(fr_, [k[0] for k in ks], [k[1][ax] for k in ks])))
    return np.array(out)


def dist_to(p: np.ndarray, f: float) -> float:
    return float(np.linalg.norm(p - cam_pos(f)))


def dist_fx(d: float):
    """distance -> (gain dB, low-pass Hz, reverb send) - the bridge toolkit's law, kept"""
    d = max(d, 2.5)
    g = -14.0 * math.log10(d / 2.5)
    lpf = float(np.clip(17000.0 * (2.5 / d) ** 0.55, 1200, 17000))
    send = 0.06 + 0.5 * float(np.clip(math.log(d / 2.5) / math.log(25), 0, 1))
    return g, lpf, send


# ---------------------------------------------------------------- small mix helpers
def put(out, x, t, gain=1.0, p=0.0, amap=None):
    """add x (mono or (2,n)) into (2,N) at time t, panned p, optional per-sample gain map"""
    x = np.asarray(x, float)
    seg = pan(x, p) if x.ndim == 1 else x
    if amap is not None:
        seg = seg * amap[None, :]
    i = ns(t)
    a, b = max(0, i), min(out.shape[1], i + seg.shape[1])
    if b > a:
        out[:, a:b] += gain * seg[:, a - i:b - i]


def curve_for(n, pts, t0=0.0):
    """piecewise-linear gain curve, n samples long, starting at absolute time t0 (s)"""
    xs = np.array([p[0] for p in pts], float)
    ys = np.array([p[1] for p in pts], float)
    return np.interp(t0 + np.arange(n) / SR, xs, ys)


def env_at(pts, n, t0=0.0):
    return curve_for(n, pts, t0)


def nrm_i(x, target):
    """scale so the integrated loudness (whole buffer) is `target` LUFS"""
    cur = integrated(x)
    return x if not np.isfinite(cur) else x * dbg(target - cur)


def nrm_p(x, target_dbfs):
    return x * dbg(target_dbfs - 20 * np.log10(np.abs(x).max() + 1e-12))


def stride_times(xf, f0, f1, stride, first=0.0):
    """footfalls while a body's world-x advances by `stride` metres (deterministic)"""
    ts, xl, f = [], None, f0 + first
    while f <= f1:
        x = xf(f)
        if xl is None or abs(x - xl) >= stride:
            ts.append(fr(f))
            xl = x
        f += 1
    return ts


# ================================================================ SFX generators (original synthesis)
def droplets(n, r, rate, modes, jit=1.0):
    """sparse impulse cloud through a resonator bank - rain ticking on stone, metal roofs, puddles"""
    cnt = max(1, int(rate * n / SR))
    x = np.zeros(n)
    k = r.integers(0, n, cnt)
    np.add.at(x, k, r.uniform(0.35, 1.0, cnt))
    md = [(f * r.uniform(1 - 0.12 * jit, 1 + 0.12 * jit), q, g) for f, q, g in modes]
    return resbank(x, md)


STONE = [(1750, 14, 1.0), (2650, 18, 0.8), (3900, 22, 0.6), (5600, 28, 0.4), (8200, 34, 0.22)]
ROOF = [(190, 9, 1.0), (330, 11, 0.7), (505, 13, 0.5), (830, 16, 0.3), (1350, 20, 0.15)]


def rain_bed(r):
    """the floor of the whole film: heavy rain on cobbles AND on the tram roof, slow gusting"""
    out = np.zeros((2, N))
    for ch in range(2):
        gust = 0.66 + 0.34 * smooth_noise(N, r, 0.28)
        gust *= 0.92 + 0.08 * smooth_noise(N, r, 0.85)
        mass = bp(colored(N, r, 0.85), 170, 7000, 2)      # the mass of falling water
        fine = hp(colored(N, r, 0.45), 5200)              # fine spray hiss
        spray = bp(colored(N, r, 0.25), 2600, 11000, 2)    # the bright top of the downpour
        cobble = bp(colored(N, r, 0.6), 450, 3200, 2)     # rain beating the wet setts
        body = lp(colored(N, r, 1.9), 250, 2)             # air / puddle body
        drop = droplets(N, r, 190, STONE) * 0.55          # individual drops on stone
        splat = droplets(N, r, 9, ROOF[1:]) * 1.4         # bigger splats in the standing water
        out[ch] = (mass * 0.95 + fine * 0.5 + spray * 0.3 + cobble * 0.5 + body * 0.5
                   + drop * 0.55 + splat * 0.35) * gust
    # rain hammering the tram roof: drumming on sheet steel, level follows the tram's distance
    tick = droplets(N, r, 220, ROOF) * 1.0
    prox = curve_for(N, [(0, 0.10), (40, 0.2), (70, 0.42), (96, 0.9), (150, 1.0), (300, 1.0),
                         (360, 1.0), (405, 0.9), (450, 0.3)])
    tick_near = tick * prox
    tick_far = lp(tick, 2400, 2) * (1.0 - prox) * 0.55
    sheet = bp(colored(N, r, 0.4), 1300, 11000, 2) * (0.28 + 0.5 * prox)
    roofl = widen(tick_near + tick_far, r, 9, 0.8) + st(sheet * 0.30)
    return out + roofl * 0.85


def rail_squeal(r, f0=0.0, f1=96.0):
    """steel on steel, curling up to the stop: high-Q squeal that grows, over a rail grind"""
    n = ns(fr(f1 - f0))
    t = np.arange(n) / SR
    dur = max(t[-1], 1e-9)
    nz = colored(n, r, 0.85)
    wob = smooth_noise(n, r, 1.6)

    def fcentre(T):
        u = np.clip(np.asarray(T, float) / dur, 0, 1)
        return 1450 + 900 * u ** 0.8 + 180 * np.interp(np.asarray(T, float), t, wob)

    def band(mult, width):
        return shape(nz, lambda T, F: np.exp(-0.5 * (np.log2(np.maximum(F[:, None], 20) / (fcentre(T) * mult)[None, :]) / width) ** 2),
                     1024, 256)
    y = band(1.0, 0.28) * 1.0 + band(1.62, 0.34) * 0.55 + band(0.66, 0.4) * 0.4
    rough = 0.55 + 0.45 * np.abs(np.sin(phase(21 + 7 * smooth_noise(n, r, 2.2))))
    grind = bp(colored(n, r, 1.1), 300, 1800, 2) * 0.55
    y = (y * rough + grind) * env_at([(0, 0.05), (20, 0.28), (55, 0.55), (80, 0.95), (92, 1.0), (96, 0.6)], n, fr(f0))
    return fades(y, 0.15, 0.05)


def rolling_bed(r):
    """wheel-on-rail: joint clatter + low grind + traction-motor growl + electric drone, whole film"""
    n = N
    ff = np.arange(n) / FPS                                   # frame index per sample
    speed = np.clip(tram_speed_per_sample(n), 0.0, 30.0)
    # motor / electrical drone: pitch and level follow the tram through the film
    fm = np.interp(ff, [0, 70, 96, 150, 300, 330, 405, 425, 450],
                   [26.0, 27.5, 29.0, 28.0, 28.5, 29.0, 34.0, 62.0, 74.0])
    fm = fm * (1 + 0.012 * smooth_noise(n, r, 1.3))
    ph = phase(fm)
    drone = (np.sin(ph) + 0.6 * np.sin(2 * ph + 0.7) + 0.35 * np.sin(3 * ph + 1.9) + 0.2 * np.sin(4.05 * ph + 2.6))
    drone = lp(drone, 700, 2) * (0.55 + 0.45 * np.sin(phase(1.7 + 0.4 * smooth_noise(n, r, 0.5))) ** 2)
    whine = lp(bp(colored(n, r, 0.4), 600, 3400, 1), 3400, 1) * (0.35 + 1.1 * np.clip((ff - 390) / 45, 0, 1))
    dg = curve_for(n, [(0, 0.42), (60, 0.6), (96, 0.85), (140, 0.35), (300, 0.32), (360, 0.4),
                       (405, 0.55), (430, 1.0), (450, 0.55)])
    idle = curve_for(n, [(0, 0.0), (96, 0.0), (120, 1.0), (300, 1.0), (360, 0.6), (405, 0.0), (450, 0.0)])
    motor = (drone * 0.9 + whine * 0.5 * (0.3 + 0.7 * idle)) * dg
    # joint clatter + grind only while the wheels turn (arrival 0-96, departure 405-450)
    rolling = ((ff <= 97.0) | (ff >= 404.0)).astype(float)
    rate = speed * FPS / 5.5                                   # rail joints every ~5.5 m
    imp = np.zeros(n)
    tm, ph_ = 0.0, 0.0
    while tm < DUR:
        k = ns(tm)
        if rolling[k] > 0.5 and speed[k] > 0.3:
            imp[k] += r.uniform(0.4, 1.0) * min(1.0, speed[k] / 8.0)
        step = 1.0 / max(rate[k], 0.25)
        tm += step * (1 + r.normal(0, 0.1))
    clat = resbank(imp, [(160, 9, 1.0), (280, 12, 0.8), (520, 14, 0.6), (940, 18, 0.4), (1700, 26, 0.22)])
    grind = bp(colored(n, r, 1.2), 90, 600, 2) * np.clip(speed / 6.0, 0, 1.4) * rolling
    env = np.clip(speed / 5.0, 0, 1.0) * rolling
    roll = (clat * 1.5 + grind * 0.8) * np.where(env > 0, 0.25 + 0.75 * env, 0.0)
    # the tram recedes on departure
    recede = curve_for(n, [(0, 1.0), (404, 1.0), (420, 0.62), (450, 0.18)])
    return motor, roll * recede, idle


def brakes_release(r):
    """f=300 the driver changes ends: air/brake release + the body settling on its springs"""
    d = 1.1
    t = tt(d)
    nz = r.standard_normal(len(t))
    hiss = bp(nz, 900, 5000, 1) * (1 - np.exp(-t / 0.02)) * np.exp(-t / 0.28) * 0.5
    clack = modal(d, [(140, 1.0, 0.05), (300, 0.7, 0.035), (640, 0.4, 0.02)], r) * 0.8
    spring = modal(d, [(62, 1.0, 0.35), (118, 0.6, 0.28)], r) * 0.7
    return fades(hiss + clack + spring, 0.004, 0.2)


def hum_brighten(r):
    """the far headlamp's electrical mains hum brightening - an effect drone, not a tune"""
    d = 6.0
    n = ns(d)
    t = np.arange(n) / SR
    wob = 1 + 0.003 * smooth_noise(n, r, 4.0)
    y = np.sin(phase(100 * wob)) + 0.5 * np.sin(phase(200 * wob) + 0.4) + 0.25 * np.sin(phase(300 * wob) + 1.1)
    y = lp(y, 900, 2) * (0.5 + 0.5 * np.sin(phase(0.7 + 0.2 * smooth_noise(n, r, 0.5))) ** 2)
    y += bp(colored(n, r, 0.4), 2000, 6000, 1) * 0.5
    return fades(y * np.interp(t, [0, 0.5, 6.0], [0.0, 1.0, 1.0]), 0.1, 0.3)


def water_splash(r, depth=1.0, dur=0.6):
    """a foot breaking 4-6 cm of standing water: slap, displaced body, bubbles, wavelets"""
    n = ns(dur)
    t = np.arange(n) / SR
    nz = r.standard_normal(n)
    thump = np.exp(-t / 0.022) * np.sin(phase(110 * (1 + 0.7 * np.exp(-t / 0.008)))) * 0.55
    slap = bp(nz, 420, 7500, 1) * (1 - np.exp(-t / 0.0012)) * np.exp(-t / 0.016) * 1.0
    body = lp(nz, 900, 2) * (1 - np.exp(-t / 0.004)) * np.exp(-t / 0.055) * 0.85
    bub = G.bubbles(dur, r, 700 * np.exp(-t / 0.06) + 30, 320, 3000, (0.005, 0.022), np.exp(-t / 0.13)) * 0.75
    lap = bp(colored(n, r, 0.7), 900, 4500, 1) * np.exp(-t / 0.09) * 0.22
    return fades((thump + slap + body + bub + lap) * (0.55 + 0.45 * depth), 0.0006, 0.07)


def stone_step(r, scuff=0.5):
    """a small shoe on wet setts at the kerb"""
    d = 0.3
    t = tt(d)
    nz = r.standard_normal(len(t))
    click = hp(nz, 2800) * np.exp(-t / 0.0013) * 0.75
    tap = modal(d, [(r.uniform(900, 1500), 1.0, 0.014), (r.uniform(1900, 3100), 0.6, 0.008),
                    (r.uniform(3800, 6200), 0.32, 0.004)], r)
    wet = bp(colored(len(t), r, 0.6), 600, 4200, 1) * np.exp(-t / 0.03) * 0.4
    sc = bp(nz, 500, 3000, 1) * np.clip(t / 0.012, 0, 1) * np.exp(-t / 0.05) * 0.2 * scuff
    return fades(click + tap + wet + sc, 0.0005, 0.05)


def boot_water(r):
    """a boot coming down hard through the flood"""
    return water_splash(r, 1.45, 0.7)


def metal_thud(r):
    """the hollow METAL thud of a boot on the tram's step, plus the body answering"""
    d = 1.1
    t = tt(d)
    nz = r.standard_normal(len(t))
    hit = bp(nz, 300, 9000, 1) * np.exp(-t / 0.0022) * 1.0
    body = modal(d, [(88, 1.0, 0.10), (168, 0.7, 0.062), (352, 0.5, 0.04), (720, 0.3, 0.022), (1450, 0.2, 0.012)], r)
    step = modal(d, [(430, 1.0, 0.055), (880, 0.65, 0.03), (1900, 0.4, 0.016), (3300, 0.22, 0.008)], r)
    sub = np.exp(-t / 0.07) * np.sin(phase(58 * (1 + 0.6 * np.exp(-t / 0.012)))) * 0.75
    return fades(hit + body + step + sub, 0.0, 0.14)


def bell(r, f0=None, dur=1.9, hard=1.0):
    """the tram gong, struck close and brassy: inharmonic partials + striker noise"""
    f0 = f0 or r.uniform(540, 600)
    ratios = [1.0, 2.0, 2.76, 3.01, 4.16, 5.43, 6.79, 8.24]
    amps = [1.0, 0.6, 0.5, 0.42, 0.3, 0.2, 0.12, 0.07]
    taus = [1.55, 1.05, 0.8, 0.62, 0.45, 0.3, 0.2, 0.13]
    modes = [(f0 * ratios[i] * r.uniform(0.998, 1.002), amps[i], taus[i]) for i in range(len(ratios))]
    y = modal(dur, modes, r)
    beat = modal(dur, [(f0 * 2.0 * 1.008, 0.35, 0.9)], r)          # beat against the 2nd partial: brass wobble
    t = tt(dur)
    strike = bp(r.standard_normal(len(t)), 1500, 9500, 1) * np.exp(-t / 0.0025) * 0.7 * hard
    return fades(y + beat + strike, 0.0, 0.25)


def brake_bite(r):
    """f=92 the brake shoes bite: a hard metallic clamp"""
    d = 0.75
    t = tt(d)
    nz = r.standard_normal(len(t))
    clamp = bp(nz, 500, 8500, 1) * np.exp(-t / 0.006) * 1.0
    metal = modal(d, [(1500, 1.0, 0.05), (2350, 0.8, 0.03), (3600, 0.5, 0.02), (5400, 0.3, 0.01)], r)
    thunk = np.exp(-t / 0.05) * np.sin(phase(96 * (1 + 0.8 * np.exp(-t / 0.008)))) * 1.1
    screech = bp(colored(len(t), r, 0.5), 1200, 5200, 1) * np.exp(-t / 0.13) * 0.3
    grab = lp(nz, 400, 2) * np.exp(-t / 0.04) * 0.7
    return fades(clamp + metal + thunk + screech + grab, 0.0, 0.16)


def controller_clack(r):
    """the driver's controller handle: a deep clack inside the tram"""
    d = 0.5
    t = tt(d)
    nz = r.standard_normal(len(t))
    click = hp(nz, 2400) * np.exp(-t / 0.001) * 0.85
    handle = modal(d, [(150, 1.0, 0.045), (312, 0.7, 0.03), (620, 0.4, 0.016), (1250, 0.2, 0.008)], r)
    thunk = np.exp(-t / 0.038) * np.sin(phase(72 * (1 + 0.5 * np.exp(-t / 0.01)))) * 1.0
    return fades(click + handle + thunk, 0.0, 0.12)


def elec_tick(r):
    """a small electrical tick off the controller"""
    d = 0.07
    t = tt(d)
    nz = r.standard_normal(len(t))
    return fades(hp(nz, 3200) * np.exp(-t / 0.0007) * 0.7 + reson(nz, r.uniform(2400, 4600), 8) * np.exp(-t / 0.0035) * 0.5,
                 0.0002, 0.012)


def plip(r, f_lo=280, f_hi=1200, tau=0.022, rise=(6.0, 20.0)):
    """a water plip: bubble whose pitch rises as it shrinks"""
    n = ns(max(tau * 8, 0.05))
    t = np.arange(n) / SR
    f = r.uniform(f_lo, f_hi)
    return fades(np.sin(phase(f * (1 + r.uniform(*rise) * t))) * np.exp(-t / tau), 0.0002, 0.012)


def drip(r, bright=1.0):
    """one drip off the umbrella / the tram's eaves"""
    y = plip(r, 900 * bright, 3200 * bright, r.uniform(0.004, 0.011), (10, 30))
    y += hp(r.standard_normal(len(y)), 5000) * np.exp(-np.arange(len(y)) / SR / 0.0005) * 0.25
    return y


def paper_rustle(r, dur=0.42):
    """folded newspaper unfolding: crinkle crackle"""
    n = ns(dur)
    t = np.arange(n) / SR
    nz = colored(n, r, 0.25)
    cr = bp(nz, 1800, 9000, 1)
    ctrl = ndimage.uniform_filter1d(np.abs(r.standard_normal(n)), ns(0.005)) * 9.0
    env = np.clip(ctrl, 0, 1.8) * np.interp(t, [0, dur * 0.35, dur * 0.75, dur], [0.0, 1.0, 0.7, 0.0])
    return fades(cr * env * 0.55 + bp(r.standard_normal(n), 350, 2200, 1) * np.exp(-t / 0.06) * 0.18, 0.004, 0.06)


def boat_set_down(r):
    """the paper boat is set on the water: a soft plip plus a small splash"""
    d = 1.0
    n = ns(d)
    t = np.arange(n) / SR
    nz = r.standard_normal(n)
    pl = plip(r, 260, 620, 0.03, (8, 22))
    splash = bp(nz, 500, 6000, 1) * (1 - np.exp(-t / 0.002)) * np.exp(-t / 0.03) * 0.5
    bub = G.bubbles(d, r, 260 * np.exp(-t / 0.08) + 12, 350, 2600, (0.006, 0.025), np.exp(-t / 0.16)) * 0.5
    pap = bp(r.standard_normal(n), 1200, 4500, 1) * np.exp(-t / 0.02) * 0.12
    y = splash + bub + pap
    k = ns(0.02)
    m = min(len(pl), len(y) - k)
    y[k:k + m] += pl[:m]
    return fades(y, 0.001, 0.1)


def tap_small(r, f_lo=260, f_hi=1100):
    """a tiny water tap against the paper hull: a plip, a hollow paper knock, a wet tick"""
    y = plip(r, f_lo, f_hi, r.uniform(0.004, 0.009), (8, 24)) * 0.8
    n = ns(0.16)
    t = np.arange(n) / SR
    knock = modal(0.16, [(r.uniform(360, 470), 1.0, 0.022), (r.uniform(760, 980), 0.55, 0.012),
                         (r.uniform(1500, 2100), 0.25, 0.006)], r)
    knock *= 1 + 0.25 * np.exp(-t / 0.004)
    y2 = np.zeros(len(y))
    y2[:min(n, len(y))] += knock[:min(n, len(y))]
    y = y + y2 * 0.9
    y += bp(r.standard_normal(len(y)), 900, 5200, 1) * np.exp(-np.arange(len(y)) / SR / 0.0016) * 0.3
    return y


def spark(r):
    """a trolley-wheel arcing on the overhead wire: a tiny crackle"""
    d = 0.09
    t = tt(d)
    nz = r.standard_normal(len(t))
    y = hp(nz, 4500) * np.exp(-t / r.uniform(0.0004, 0.0009)) * 0.8
    y += bp(nz, 2500, 9000, 1) * np.exp(-t / 0.004) * 0.3
    return fades(y, 0.0001, 0.01)


def thunder(r, dur=4.2):
    """one distant roll, well behind the buildings"""
    n = ns(dur)
    t = np.arange(n) / SR
    base = colored(n, r, 1.7)
    roll = 0.45 + 0.55 * np.abs(smooth_noise(n, r, 0.8))
    env = (1 - np.exp(-t / 0.35)) * np.exp(-t / 2.0)
    y = base * roll * env
    deep = lp(colored(n, r, 2.6), 95, 2) * env * 1.8
    y = lp(y, 1400, 2) + deep
    return fades(y / (np.abs(y).max() + 1e-9), 0.05, 1.5)


# ================================================================ build
def build():
    out = np.zeros((2, N))
    send = np.zeros((2, N))
    notes = []

    def note(kind, frame, name, desc):
        notes.append((kind, frame, name, desc))

    # ---------------------------------------------------------- 0-450 rain bed
    r = rng_for("rain")
    rain = nrm_i(rain_bed(r), -21.5)
    gust = curve_for(N, [(0, 1.0), (2.6, 1.14), (5.0, 0.9), (7.4, 1.1), (9.8, 0.86), (12.4, 1.13), (15.0, 1.0)])
    out += rain * gust[None, :]
    place(send, rain.mean(0) * 0.10, 0.0)
    note("bed", 0, "rain_bed", "heavy rain on cobbles + on the tram roof, slow gusting (the floor of the film)")

    # ---------------------------------------------------------- 0-450 rolling: rail, motor, drone
    motor, roll, idle = rolling_bed(rng_for("roll"))
    # 0-96 arrival: motor grows and the wheels are turning; also the squeal
    squeal = nrm_p(rail_squeal(rng_for("squeal")), -13.0)
    put(out, squeal, 0.0, 1.0, 0.0)
    place(send, squeal * 0.18, 0.0)
    put(out, nrm_p(roll, -14.0), 0.0, 1.0, 0.0)
    put(out, nrm_p(motor, -20.5), 0.0, 1.0, 0.0)
    note("bed", 0, "rail_roll", "rail/steel squeal growing + wheel-on-rail rumble to the stop (0-96)")
    note("bed", 96, "motor_drone", "low motor + electrical drone idling at the stop (96-405)")

    # ---------------------------------------------------------- 92 brake shoes bite
    bb = nrm_p(brake_bite(rng_for("brake")), -7.5)
    put(out, bb, fr(92), 1.0, 0.05)
    place(send, bb * 0.3, fr(92))
    note("event", 92, "brake_bite", "brake shoes bite: hard metallic clamp")

    # ---------------------------------------------------------- 96-104 bell struck twice, close
    for f in (96.0, 103.0):
        b = nrm_p(bell(rng_for(f"bell{f}"), 566, 1.8), -6.5)
        put(out, b, fr(f), 1.0, 0.0)
        place(send, b * 0.34, fr(f))
    note("event", 96, "bell_x2", "bell struck twice, close and brassy (96, 103)")

    # ---------------------------------------------------------- 96-300 stand ambience
    # rain on the tram roof is inside the rain bed (proximity curve); here: lapping, drips, ticks
    r = rng_for("stand")
    n = ns(fr(204))                                     # 96-300
    t = np.arange(n) / SR
    lap = np.zeros((2, n))
    for ch in range(2):
        lap[ch] = (bp(colored(n, r, 0.9), 150, 2200, 1) * (0.6 + 0.4 * smooth_noise(n, r, 0.45)) * 0.5
                   + lp(colored(n, r, 2.0), 160, 2) * 0.4)
    tm = 0.6
    while tm < fr(204) - 0.6:                           # lapping sloshes at the kerb
        d = 0.55
        s = shape(r.standard_normal(ns(d)), lambda T, F: np.exp(-0.5 * (np.log2(np.maximum(F[:, None], 20) / 750) / 1.2) ** 2), 512, 128)
        s *= np.exp(-tt(d) / 0.13) * (1 - np.exp(-tt(d) / 0.03)) * 0.8
        s += G.bubbles(d, r, 110, 300, 1600, (0.006, 0.02), np.exp(-tt(d) / 0.15)) * 0.6
        put(lap, s, tm, 1.0, pan_of(4.0) + r.uniform(-0.15, 0.1))
        tm += 0.35 + r.exponential(1.1)
    drips = G.bubbles(fr(204), r, 1.6, 1200, 3600, (0.004, 0.012), rise=(10, 30)) * 0.9
    lap += widen(drips, r, 7, 1.0) * 0.55
    lap = nrm_i(lap, -30.0)
    put(out, lap, fr(96), 1.0, 0.0)
    place(send, lap.mean(0) * 0.12, fr(96))
    note("bed", 96, "flood_lap", "flood water lapping at the kerb (96-300)")

    # drips off the tram into the flood
    r = rng_for("drips")
    tm = fr(100) + r.uniform(0.2, 0.8)
    while tm < fr(300):
        put(out, nrm_p(drip(r), -25.0), tm, r.uniform(0.5, 1.0), -0.12 + r.uniform(-0.2, 0.2))
        tm += 0.35 + r.exponential(1.5)
    note("event", 110, "tram_drips", "water dripping off the tram into the flood")

    # slow electrical ticks off the controller
    tm = fr(100)
    while tm < fr(300):
        put(out, nrm_p(elec_tick(r), -27.0), tm, r.uniform(0.6, 1.0), r.uniform(-0.2, 0.2))
        tm += r.uniform(1.1, 3.4)
    note("event", 120, "elec_tick", "slow electrical tick from the controller")

    # ---------------------------------------------------------- ~120 one distant thunder roll
    th = thunder(rng_for("thunder"), 4.2)
    th = lp(th, 850, 2)
    put(out, nrm_p(th, -16.0), fr(120) - 0.6, 1.0, -0.25)
    place(send, nrm_p(th, -16.0) * 0.9, fr(120) - 0.6)
    note("event", 120, "thunder", "one distant thunder roll, well behind the buildings (frame 120)")

    # ---------------------------------------------------------- 150-344 the lady crosses
    r = rng_for("lady")
    r_cam = rng_for("lady_cam")
    for i, tm in enumerate(stride_times(lady_x, 150, 344, 0.62)):
        f = tm * FPS
        x = lady_x(f)
        d = math.hypot(x - cam_pos(f)[0], -7.45 - cam_pos(f)[2])
        g, lpf, snd = dist_fx(d)
        y = water_splash(r, 1.0 + 0.15 * ((i % 2) * 2 - 1), 0.6)
        y = lp(y, lpf, 1)
        y = nrm_p(y, -8.5 + 0.45 * g)
        put(out, y, tm, 1.0, pan_of(x))
        place(send, y * snd, tm)
    # her umbrella drips
    tm = fr(152)
    while tm < fr(344):
        f = tm * FPS
        put(out, nrm_p(drip(r_cam), -24.0), tm, r.uniform(0.4, 1.0), pan_of(lady_x(f)) + r.uniform(-0.15, 0.15))
        tm += 0.22 + r_cam.exponential(0.9)
    note("event", 150, "lady_steps", "the lady crossing the flooded road L->R: footfalls in 4-6 cm of water + umbrella drips (150-344)")

    # ---------------------------------------------------------- 176-205 the boy at the kerb
    r = rng_for("boy_kerb")
    for k, f in enumerate([176.0, 189.0, 199.0]):
        x = 4.16 + (k % 2) * 0.12
        y = nrm_p(stone_step(r, 0.6), -15.5)
        put(out, y, fr(f), 1.0, pan_of(x))
        place(send, y * 0.2, fr(f))
    put(out, nrm_p(paper_rustle(rng_for("paper")), -19.0), fr(183), 1.0, pan_of(4.16) - 0.05)
    boat = boat_set_down(rng_for("boat_set"))
    put(out, nrm_p(boat, -12.5), fr(196), 1.0, pan_of(3.99))
    place(send, nrm_p(boat, -12.5) * 0.4, fr(196))
    note("event", 176, "boy_kerb", "the boy at the kerb: small quick footsteps on wet stone, paper rustle")
    note("event", 196, "boat_set_down", "the paper boat set on the water: soft plip + small splash (196-205)")

    # ---------------------------------------------------------- 205-450 the boat bobbing in the gutter
    r = rng_for("boat")
    tm = fr(206)
    while tm < 14.93:
        f = tm * FPS
        x, z = boat_pos(f)
        d = math.hypot(x - cam_pos(f)[0], z - cam_pos(f)[2])
        g, lpf, snd = dist_fx(d)
        # it is the last thing on screen: keep a floor on its level and its brightness
        g = max(g, -9.0)
        lpf = max(lpf, 4200)
        y = lp(tap_small(r, 260 + 20 * (tm % 1), 1100), lpf, 1)
        put(out, y, tm, dbg(-14.5 + 0.15 * g), pan_of(x) + r.uniform(-0.08, 0.08))
        if r.uniform() < 0.22:
            place(send, y * snd * 0.5, tm)
        tm += 0.14 + r.exponential(0.45)
    # it is the last thing on screen: make certain it is still talking at 440
    for f in (430.0, 435.0, 440.0, 445.0, 449.0):
        x, z = boat_pos(f)
        d = math.hypot(x - cam_pos(f)[0], z - cam_pos(f)[2])
        g = max(dist_fx(d)[0], -3.0)
        put(out, lp(tap_small(rng_for(f"boattend{f}"), 250, 1000), 6000, 1), fr(f),
            dbg(-12.0 + 0.3 * g), pan_of(x) + r.uniform(-0.06, 0.06))
    note("event", 205, "boat_bob", "the paper boat nudging in the gutter: tiny irregular water taps (205-450, still there at 440)")

    # ---------------------------------------------------------- 300 the driver changes ends
    cl = nrm_p(controller_clack(rng_for("ctrl")), -11.5)
    cl = lp(cl, 1300, 1)                                  # heard from inside/through the body
    put(out, cl, fr(300), 1.0, 0.0)
    place(send, cl * 0.35, fr(300))
    rel = nrm_p(brakes_release(rng_for("release")), -20.0)
    put(out, rel, fr(301) + 0.1, 1.0, 0.0)
    hb = nrm_p(hum_brighten(rng_for("hum")), -26.0)
    put(out, hb, fr(300), 1.0, 0.0)
    place(send, hb * 0.4, fr(300))
    note("event", 300, "controller_clack", "the driver changes ends: deep controller clack, brake release, the far headlamp's hum brightens")

    # ---------------------------------------------------------- 336-386 the boy crosses and boards
    r = rng_for("boy_cross")
    r_cam = rng_for("boy_cam")
    for k, tm in enumerate(stride_times(boy_x, 336, 386, 0.5)):
        f = tm * FPS
        x = boy_x(f)
        d = math.hypot(x - cam_pos(f)[0], boy_z(f) - cam_pos(f)[2])
        g, lpf, snd = dist_fx(d)
        y = lp(boot_water(r), min(lpf, 12000), 1)
        put(out, nrm_p(y, -9.5 + 0.6 * g), tm, 1.0, pan_of(x))
        place(send, y * snd, tm)
    # 352 the boot lands on the step: hollow METAL thud
    mt = nrm_p(metal_thud(rng_for("metal")), -6.0)
    put(out, mt, fr(352), 1.0, pan_of(1.6))
    place(send, mt * 0.35, fr(352))
    # handrail grasp + his weight on the step
    gr = nrm_p(G.creak(0.4, r_cam, 300, 520, G.SMALLMETAL, [(0, 0.2), (0.3, 1), (0.8, 0.7), (1, 0)], rough=0.09, noise=0.02), -15.0)
    put(out, gr, fr(358), 1.0, pan_of(1.5))
    put(out, nrm_p(G.clink(r_cam, 3100, 0.14), -16.0), fr(359.5), 1.0, pan_of(1.5))
    st2 = nrm_p(metal_thud(rng_for("metal2")), -11.0)
    put(out, lp(st2, 2600, 1), fr(374), 1.0, pan_of(1.4))
    note("event", 336, "boy_boards", "boots through the flood, hollow metal thud on the step (352), handrail grasp, weight on the step")

    # ---------------------------------------------------------- 405 departure
    dep = np.zeros((2, N))
    for f in (405.0, 413.0):
        b = nrm_p(bell(rng_for(f"dbell{f}"), 566, 1.9), -6.5)
        put(dep, b, fr(f), 1.0, 0.0)
        place(send, b * 0.34, fr(f))
    # motor windup + accelerating, receding rail clatter (405-450) - built from the speed curve
    r = rng_for("depart")
    tm, z_prev = fr(405), tram_z(405)
    while tm < 14.98:
        f = tm * FPS
        z = tram_z(f)
        if abs(z - z_prev) >= 4.5:
            z_prev = z
            d = math.hypot(0.0 - cam_pos(f)[0], z - cam_pos(f)[2])
            g, lpf, snd = dist_fx(d)
            y = resbank(impulse_train([0.0], 0.35, [1.0]), [(170, 8, 1.0), (300, 11, 0.8), (560, 14, 0.6), (1050, 18, 0.4)])
            y = lp(y, min(lpf, 12000), 1)
            put(dep, nrm_p(y, -12.0 + g), tm, 1.0, 0.0)
            if r.uniform() < 0.3:
                place(send, y * snd * 0.6, tm)
        tm += 1.0 / FPS
    # windup: the drone already rides the motor curve; add the traction whine bloom
    pos = ns(fr(405))
    wh = bp(colored(N - pos, rng_for("whine"), 0.5), 1100, 3800, 1)
    wh *= curve_for(N - pos, [(0, 0), (0.6, 0.9), (3.6, 0.75), (5.0, 0.2)], fr(405))
    put(dep, nrm_p(wh, -26.0), fr(405), 1.0, 0.0)
    # the tram is receding: let the tail open so the boat is the last thing on screen
    out += dep * curve_for(N, [(0, 1), (14.30, 1), (14.80, 0.45), (15.0, 0.14)])[None, :]
    note("event", 405, "departure", "departure bell x2, the motor winds up, wheels rolling, rail clatter accelerating and receding (405-450)")

    # ---------------------------------------------------------- trolley sparks + eaves drips, anywhere
    r = rng_for("spark")
    tm = 0.4
    while tm < 14.9:
        acc = 405.0 <= tm * FPS <= 450.0
        put(out, nrm_p(spark(r), -25.0), tm, r.uniform(0.6, 1.0), r.uniform(-0.25, 0.25))
        tm += (0.18 + r.exponential(0.7)) if acc else (0.9 + r.exponential(2.4))
    r = rng_for("eaves")
    tm = 0.3
    while tm < 14.9:
        put(out, nrm_p(drip(r), -27.0), tm, r.uniform(0.4, 1.0), r.uniform(-0.9, 0.9))
        tm += 0.5 + r.exponential(1.4)
    note("event", 0, "sparks_drips", "occasional trolley-wheel spark crackles on the overhead wire + eaves drips")

    # ---------------------------------------------------------- reverb + output
    canyon = make_ir(1.7, 808, pre=0.021, hf=1.5,
                     early=[(0.021, 0.5, -0.6), (0.035, 0.4, 0.55), (0.058, 0.3, -0.35), (0.081, 0.22, 0.6)])
    wet = 0.5 * convolve_st(send, canyon)
    out = hp(out + wet, 26, 2)
    # safety: exact length, no click, no silence
    out = out[:, :N]
    if out.shape[1] < N:
        out = np.pad(out, ((0, 0), (0, N - out.shape[1])))
    out *= fades(np.ones(N), 0.008, 0.035)[None, :]
    return out, notes


# ================================================================ master
def limiter(x, ceil_db=CEIL_DBTP, look=0.003, rel=0.09):
    """4x-oversampled peak detection, look-ahead min filter, release one-pole (the bridge toolkit's limiter)"""
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
            outp = np.empty(len(seg))
            g = 1.0
            for k in range(len(seg)):
                g = min(seg[k], g + (1 - g) * kr)
                outp[k] = g
            g2[a:e] = outp
    g3 = np.minimum(ndimage.uniform_filter1d(g2, 2 * La + 1, mode="nearest"), 1.0)
    return x * g3[None, :], g3


def main():
    t0 = time.time()
    print(f"[tram] building {TOTAL} frames = {DUR:.3f} s = {N} samples @ {SR} Hz")
    mix, notes = build()
    assert mix.shape == (2, N), mix.shape

    G_db = TARGET_LUFS - integrated(mix)
    y = mix
    for it in range(8):
        y, g3 = limiter(mix * dbg(G_db))
        L = integrated(y)
        print(f"[tram] master iter {it}: gain {G_db:+.2f} dB -> {L:.3f} LUFS, "
              f"TP {true_peak(y):.2f} dBTP, max GR {-20 * np.log10(g3.min()):.2f} dB")
        if abs(L - TARGET_LUFS) < 0.02:
            break
        G_db += TARGET_LUFS - L

    peak = np.abs(y).max()
    assert peak < 1.0, f"clipping: peak {peak:.6f}"
    assert y.shape == (2, N)
    os.makedirs(os.path.dirname(OUT_WAV), exist_ok=True)
    write_wav(OUT_WAV, y, 24)

    # ---------------- report
    print("\n[tram] measurement")
    print(f"  integrated  : {integrated(y):+.2f} LUFS   (target {TARGET_LUFS:+.1f})")
    print(f"  true peak   : {true_peak(y):+.2f} dBTP    (spec <= -2.2)")
    print(f"  LRA         : {lra(y):.2f} LU   maxM {momentary_max(y):.2f} LUFS   maxS {max(short_term(y)):.2f} LUFS")
    print(f"  sample peak : {20 * math.log10(peak):+.2f} dBFS")
    print(f"  GR max      : {-20 * math.log10(g3.min()):.2f} dB, active(>0.1 dB) {100 * (g3 < 0.9886).mean():.2f}%")
    print("\n[tram] per-second RMS (mono sum / sqrt(2)) and peak")
    sq = ((y[0] + y[1]) * 0.5) ** 2
    ok = True
    for s in range(15):
        seg = sq[s * SR:(s + 1) * SR]
        rms = math.sqrt(float(seg.mean()))
        pk = float(np.abs(y[:, s * SR:(s + 1) * SR]).max())
        dbr, dbp = 20 * math.log10(rms + 1e-12), 20 * math.log10(pk + 1e-12)
        if dbr < -60:
            ok = False
        print(f"  {s:2d}.0-{s + 1:2d}.0 s   rms {dbr:7.2f} dBFS   peak {dbp:7.2f} dBFS")
    print(f"  no silent second: {'PASS' if ok else 'FAIL'}")
    print(f"\n[tram] wrote {OUT_WAV}  ({os.path.getsize(OUT_WAV)} bytes, {N} frames, {N / SR:.3f} s)")
    print(f"[tram] cue sheet: {len(notes)} entries - see studio/shorts/tram/audio/CUES.md")
    write_cues(notes, y, G_db)
    print(f"[tram] done in {time.time() - t0:.0f} s")


def write_cues(notes, y, G_db):
    L = ["# The Last Tram (1902) - soundtrack cue sheet", "",
         "All sound is original: synthesized in numpy/scipy by `tram_audio.py` (SFX + rain/rail/motor beds)," ,
         "using the bridge short's proven DSP kit (`dsp.py`, `sfx_gen.py`, copied unchanged).",
         "SFX + ambience only - no music, no voiceover. Frames are 30 fps, so frame/30 = seconds.", "",
         "## Files", "| file | content |", "|---|---|",
         "| `studio/public/audio/tram-15s.wav` | the master: 48 kHz, stereo, 24-bit, 720000 samples = 15.000 s |", "",
         "## Master", f"- Integrated **{integrated(y):.2f} LUFS**, true peak **{true_peak(y):.2f} dBTP** "
         f"(master gain {G_db:+.2f} dB, master limiter ceiling {CEIL_DBTP} dBTP)", "",
         "## Cues", "| frame | time s | kind | cue | what |", "|---|---|---|---|---|"]
    for kind, f, name, desc in sorted(notes, key=lambda x: x[1]):
        L.append(f"| {f:.0f} | {fr(f):.3f} | {kind} | `{name}` | {desc} |")
    open(os.path.join(HERE, "CUES.md"), "w", encoding="utf-8").write("\n".join(L) + "\n")


if __name__ == "__main__":
    main()
