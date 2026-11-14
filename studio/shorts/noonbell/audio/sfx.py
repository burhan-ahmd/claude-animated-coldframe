# Every sound effect + ambience bed of "Pip and the Noon Bell", as a cue list timed to the picture (timeline.py),
# rendered into one stereo SFX stem. Silent film: no voice stem, so every level is a "naive" LU figure relative to a
# stand-in narration loudness and events sit SFX_DB under it; ambience BEDS are not reduced. Distance to the camera
# adds gain, a low-pass and more reverb (timeline.dist_fx).
import math
import numpy as np
from dsp import (SR, ns, tt, rng, dbg, lp, hp, bp, peq, pan, st, place, fades, widen, make_ir, convolve_st,
                 momentary_max, integrated, colored, smooth_noise)
import sfx_gen as G
import gen2 as N2
import timeline as T

N = ns(T.DUR)
SFX_DB = -6.0


class Cue:
    def __init__(self, t, name, desc, gen, naive, kind="event", p=0.0, extra=0.0, lpf=None, send=0.12, group=None, cut=None):
        self.t, self.name, self.desc, self.gen, self.naive = t, name, desc, gen, naive
        self.kind, self.p, self.extra, self.lpf, self.send, self.cut = kind, p, extra, lpf, send, cut
        self.group = group or name
        self.applied = naive + (SFX_DB if kind == "event" else 0.0) + extra
        self.measured = None


def _cut(gen, dur, fin, fout):
    def g():
        x, a = gen()
        return fades(x, fin, fout), a
    return g


def _bed(gen, dur, fin, fout):
    return _cut(gen, dur, fin, fout)


def _mix(*xs):
    """sum mono/stereo fragments of differing lengths, right-padded to the longest."""
    ys = [st(np.asarray(x, float)) for x in xs]
    n = max(y.shape[1] for y in ys)
    out = np.zeros((2, n))
    for y in ys:
        out[:, :y.shape[1]] += y
    return out


def cues():
    C = []
    R = rng(900)
    rr = lambda: rng(int(R.integers(1 << 30)))
    add = C.append

    # ================================================================ ambience beds
    def air(dur, seed, crowd=0.0, water=0.0, flags=0.0, birds=0.45, wind=1.0, far=0.0):
        def g():
            r = rng(seed)
            n = ns(dur)
            x = G.breeze(dur, r, wind, 0.16, 800)
            if water:
                rv = bp(colored(n, r, 0.8), 160, 1600, 1) * water * (0.8 + 0.2 * smooth_noise(n, r, 0.25))
                x += st(rv)
            if crowd:
                x += N2.crowd_bed(dur, r, crowd, seed=seed) * 0.9
            if flags:
                x += pan(G.flag_flutter(dur, r) * flags, 0.3)
            x += pan(G.bird_chirps(dur, r, birds, "sparrow") * 0.09, 0.5)
            x += pan(G.bird_chirps(dur, r, birds * 0.6, "sparrow") * 0.06, -0.6)
            if far:
                x += lp(N2.crowd_bed(dur, r, far, seed=seed + 7) * 0.5, 1800, 2)
            return fades(x, 0.5, 0.6), 0.0
        return g

    add(Cue(0.00, "amb_town", "bakery corner + market air: breeze, bunting, sparrows, a dog, shoppers far off (shots 1-3)",
            _bed(air(12.6, 11, crowd=0.8, flags=0.22, birds=0.5, wind=0.9, far=0.5), 12.6, 0.5, 0.5), -21, "bed", send=0.0))
    add(Cue(12.30, "amb_bridge", "open water on the bridge: river flow under the deck, wind over the parapet, a gull (shot 4)",
            _bed(air(8.6, 21, water=1.15, flags=0.0, birds=0.35, wind=1.25), 8.6, 0.4, 0.4), -20, "bed", send=0.0))
    add(Cue(20.60, "amb_terrace", "the church terrace: breeze over the square, birds, faint wedding party inside (shots 5-8)",
            _bed(air(9.6, 31, crowd=0.55, flags=0.12, birds=0.45, wind=0.85, far=0.45), 9.6, 0.5, 0.4), -20, "bed", send=0.0))

    # ================================================================ Pip's footsteps (from his own cadence curve)
    starts = []
    for (t, foot, surf, v) in T.footfalls():
        d = T.camera_distance()[T.shot_at(t)]
        g, lpf, send = T.dist_fx(d)
        # the deck and the stone are louder than cobbles; a running step lands harder
        lvl = 20 * math.log10(max(0.2, v / 1.8))
        starts.append(t)

        def gen(r=rr(), surf=surf, v=v):
            return N2.step(rng(int(r.integers(1 << 30))), surf, 0.85 + 0.35 * (v - 1.8)), 0.0
        add(Cue(t, "step", f"Pip's shoe on {surf} ({v:.1f} m/s, shot {T.shot_at(t)})", gen, -13,
                extra=max(g, -11.0) + lvl, lpf=lpf, send=send, group="steps",
                p=(-0.22 if foot == 0 else 0.22)))
    # (Pip takes len(starts) steps; the number only matters if a cue needs to be re-timed)

    # ================================================================ camera whooshes on every cut
    for i, tc in enumerate(T.cut_times()):
        add(Cue(tc - 0.16, "whoosh", f"cut {i + 1} -> shot {i + 2}: air whoosh centred on the cut ({tc:.2f} s)",
                (lambda r=rr(): (G.whoosh(0.55, r, 0.22, 300, 2600, 0.6, 0.3, 0.2), 0.16)), -19, extra=-3.0,
                lpf=None, send=0.3))

    # ================================================================ shot 1 - the bakery hand-over
    add(Cue(0.20, "shop_bell", "the bakery door bell as Pip comes out (small brass clink on a spring)",
            lambda: (G.clink(rng(101), 2600, 0.5, 1.0) * 0.9, 0.0), -14, extra=-2.0, send=0.2))
    add(Cue(0.66, "cake_set", "the baker sets the wedding cake down on the counter for Pip",
            lambda: (N2.cake_set(rng(102)), 0.0), -12, extra=-1.0, send=0.16))
    add(Cue(0.95, "baker_grunt", "the baker's gruff 'careful, boy!' - one short muffled syllable",
            lambda: (peq(G.oof(rng(103), "ugh", base=118), 1400, -2.0, 1.0) * 1.1, 0.0), -13, extra=-1.5, send=0.18))
    add(Cue(1.35, "cake_lift", "china stands and plates settling as Pip gets both hands under the cake",
            lambda: (N2.china_rattle(0.9, rng(104), 0.7), 0.0), -20, extra=-2.0, send=0.14))
    add(Cue(2.60, "baker_wave", "the baker's approving chuckle behind him",
            lambda: (lp(G.babble(1.3, rng(105), 128, 0.9, rate=3.4, active=0.92), 2600, 1) * 0.9, 0.0), -21, extra=-2.0, send=0.2))

    # ================================================================ shot 2 - the market square
    add(Cue(4.35, "stall_clatter", "a stallholder banging crates and folding a table as Pip hurries past",
            lambda: (G.rattle(0.7, rng(201), 26, heavy=True) * 0.8, 0.0), -16, extra=-2.0, send=0.2))
    add(Cue(5.05, "produce_spill", "a barrel of apples tipped over: a scatter of small hard knocks",
            lambda: (_mix(G.rattle(1.1, rng(202), 34) * 0.7, G.bubbles(0.5, rng(203), 26, 500, 2600) * 0.3), 0.0), -17, extra=-2.0, send=0.22))
    for i, th in enumerate(T.GOOSE_HONKS):
        add(Cue(th, "goose_honk", f"goose {i % 2 + 1} honks at Pip (market / lane)",
                (lambda r=rng(210 + i): (N2.honk(r), 0.0)), -15, extra=-2.0 + (0.0 if i % 2 else -1.5), send=0.18,
                p=-0.3 if i % 2 else 0.35))
    add(Cue(6.30, "kid_laugh", "a child shrieking with laughter as the geese scatter",
            lambda: (pan(G.hurrah(rng(204), 300, 1.15, kid=True) * 0.8, 0.4), 0.0), -16, extra=-2.0, send=0.22))
    add(Cue(7.60, "crate_drop", "a crate hits the cobbles behind him",
            lambda: (_mix(N2.step(rng(205), "cobble", 1.6) * 1.4, G.rattle(0.35, rng(206), 40, heavy=True) * 0.6), 0.0), -15, extra=-1.5, send=0.2))
    add(Cue(8.05, "bunting", "the bunting and stall canvas cracking in the gust above the square",
            lambda: (G.flag_flutter(1.4, rng(207)) * 0.8, 0.0), -22, extra=-2.0, send=0.25))

    # ================================================================ shot 3 - the lane and the cart
    add(Cue(8.85, "cart_creak", "an old hand cart creaks as it is left across the lane",
            lambda: (N2.cart_creak(1.2, rng(301)), 0.0), -16, extra=-2.0, send=0.2))
    add(Cue(9.60, "cart_roll", "the cart rolls the last metre into the middle of the lane",
            lambda: (N2.cart_roll(1.5, rng(302), 0.8), 0.0), -15, extra=-1.5, send=0.2))
    add(Cue(10.90, "cart_stop", "the cart stops: wheel scuff and the shafts knocking the cobbles",
            lambda: (_mix(N2.step(rng(303), "cobble", 1.2) * 1.2, G.rattle(0.3, rng(304), 30, heavy=True)), 0.0), -15, extra=-1.5, send=0.2))
    add(Cue(12.30, "duck_under", "Pip ducks under the cart's axle: a quick air whoosh past the lens, a scrape of his apron",
            lambda: (_mix(G.whoosh(0.6, rng(305), 0.35, 260, 1900, 0.5, 0.35, 0.25), G.rattle(0.2, rng(306), 20) * 0.25), 0.0), -12,
            extra=-1.0, send=0.22))
    add(Cue(12.62, "cake_tilt", "the cake tilts as he straightens up - a small china wobble",
            lambda: (N2.china_rattle(0.7, rng(307), 0.9), 0.0), -17, extra=-1.5, send=0.16))

    # ================================================================ shot 4 - the river bridge
    add(Cue(12.35, "deck_creak", "the old bridge deck and parapet creak under him",
            lambda: (_mix(N2.cart_creak(1.6, rng(401)) * 0.7, hp(G.creak(1.0, rng(402), 40, 90, G.TIMBER, rough=0.15), 60) * 0.5), 0.0), -19,
            extra=-2.0, send=0.26))
    for i, to in enumerate(T.OARS):
        add(Cue(to, "oar", f"the boatman's oar dipping into the river below (stroke {i + 1})",
                (lambda r=rng(410 + i): (N2.oar_dip(r, 0.9), 0.0)), -14, extra=-1.5, send=0.24,
                lpf=6000, p=0.35 * (1 if i % 2 else -1)))
    add(Cue(13.10, "river_lap", "the river slapping the quay stone under the span",
            lambda: (G.splash_big(rng(420)) * 0.35, 0.0), -19, extra=-2.0, send=0.28))
    add(Cue(16.25, "pause_air", "the hush when Pip stops mid-span and looks down: wind off the water",
            lambda: (G.breeze(1.3, rng(421), 0.8, 0.3, 500), 0.0), -24, extra=-2.0, send=0.3))
    add(Cue(16.85, "gull", "a gull cries once, far over the water",
            lambda: (lp(G.bird_chirps(3.5, rng(422), 1.0, "blackbird") * 0.8, 4000, 1), 0.0), -23, extra=-2.0, send=0.3, cut=17.75))
    add(Cue(17.30, "goose_catchup", "the geese catch up to him on the bridge, honking",
            lambda: (_mix(N2.honk(rng(423)), N2.honk(rng(424)) * 0.8), 0.0), -17, extra=-2.0, send=0.22, p=-0.35))

    # ================================================================ shot 5 - the climb
    add(Cue(17.60, "puff", "Pip's breath as he starts up the slope with the cake",
            lambda: (bp(rng(501).standard_normal(ns(0.5)), 300, 2600, 1) * np.exp(-tt(0.5) / 0.12) * 0.5, 0.0), -20, extra=-2.0, send=0.2))
    add(Cue(18.40, "stumble", "he catches his boot on a step and lands the cake back level",
            lambda: (N2.stumble(rng(502)), 0.0), -13, extra=-1.0, send=0.22))
    add(Cue(18.55, "flour", "a puff of flour off his apron",
            lambda: (N2.flour_puff(0.4, rng(503)), 0.0), -21, extra=-2.0, send=0.2))
    add(Cue(19.20, "step_stone", "his boots scraping up the stone steps",
            lambda: (N2.step(rng(504), "stone", 1.1) * 1.3, 0.0), -16, extra=-2.0, send=0.22))
    add(Cue(20.00, "relief", "Pip's relieved breath as he reaches the terrace",
            lambda: (bp(rng(505).standard_normal(ns(0.7)), 250, 2200, 1) * np.exp(-tt(0.7) / 0.18) * 0.45, 0.0), -21, extra=-2.0, send=0.22))

    # ================================================================ shot 6 - the church square
    add(Cue(21.05, "lychgate", "the lychgate iron latch and the gate swinging behind him",
            lambda: (_mix(G.clink(rng(601), 1400, 0.25, 0.8) * 0.8, G.creak(0.6, rng(602), 70, 150, G.CHAIN, rough=0.2) * 0.5), 0.0), -18,
            extra=-2.0, send=0.24))
    add(Cue(21.55, "pigeons", "pigeons burst off the tower as the guests gather",
            lambda: (N2.bird_flock(1.8, rng(603)) * 0.8, 0.0), -20, extra=-2.0, send=0.28))
    add(Cue(22.40, "guest_murmur", "the wedding guests notice him coming up the square",
            lambda: (N2.crowd_bed(3.2, rng(604), 0.7, seed=61), 0.0), -22, extra=-2.0, send=0.26))
    add(Cue(23.20, "hymn_hum", "a warm hum from inside the church as the door is propped open",
            lambda: (lp(N2.crowd_bed(2.4, rng(605), 0.5, seed=62), 1200, 2), 0.0), -24, extra=-2.0, send=0.3))

    # ================================================================ shot 7 - the bell tower
    add(Cue(24.95, "rope_creak", "the bell-ringer heaves the rope: the wheel and headstock creak",
            lambda: (N2.rope_creak(1.3, rng(701), 1.0), 0.0), -18, extra=-1.5, send=0.26))
    add(Cue(26.20, "height_wind", "wind at the top of the tower",
            lambda: (G.breeze(1.6, rng(702), 0.9, 0.35, 700), 0.0), -24, extra=-2.0, send=0.3))
    add(Cue(26.60, "sparrows_tower", "sparrows and a distant martin around the belfry",
            lambda: (pan(G.bird_chirps(3.4, rng(703), 0.9, "sparrow") * 0.7, -0.4), 0.0), -23, extra=-2.0, send=0.3, cut=28.10))
    for i, (tb, amp) in enumerate(T.bell_swings()):
        if tb >= T.BELL_STRIKE:
            continue                                     # the strike is cued separately below
        add(Cue(tb, "bell_swing", f"the bell rocks ({amp:.2f}): headstock creak and a soft body tone",
                (lambda r=rng(710 + i), a=amp: (_mix(N2.rope_creak(0.7, r, 0.6 * a), N2.bell_toll(r, 196.0, 0.22 * a)), 0.0)), -17,
                extra=-1.5, send=0.3))

    # ================================================================ shot 8 - the delivery, and the noon bell
    add(Cue(27.95, "door_open", "the church door pulls open ahead of him",
            lambda: (N2.door_open(rng(801)), 0.0), -17, extra=-1.5, send=0.26))
    add(Cue(28.55, "run_stop", "Pip skids to a stop at the threshold, breathing hard",
            lambda: (_mix(N2.step(rng(802), "stone", 2.1) * 1.5, bp(rng(803).standard_normal(ns(0.6)), 300, 2400, 1) * np.exp(-tt(0.6) / 0.15) * 0.4), 0.0),
            -14, extra=-1.0, send=0.24))
    add(Cue(29.05, "cake_land", "THE CAKE LANDS on the table - the whole film hinges on this thump",
            lambda: (N2.cake_set(rng(804)), 0.0), -9, extra=0.0, send=0.2))
    add(Cue(T.BELL_STRIKE, "bell_toll", "NOON: the great bell strikes once, over everything",
            lambda: (N2.bell_toll(rng(805), 196.0, 1.0), 0.0), -8, extra=0.0, send=0.34))
    add(Cue(T.BELL_STRIKE + 0.05, "cheer", "the wedding party erupts - cheers, applause, a kid whooping",
            lambda: (N2.cheer(0.95, rng(806), 1.0), 0.0), -12, extra=-0.5, send=0.3))
    add(Cue(T.BELL_STRIKE + 0.30, "china_final", "the cake stand rings on as the room settles",
            lambda: (N2.china_rattle(1.4, rng(807), 0.6), 0.0), -21, extra=-2.0, send=0.3))
    return C


def render(v_ref, on_event=None):
    """v_ref = stand-in narration loudness (LU). Returns (stereo stem, cue list with measured levels)."""
    C = cues()
    out = np.zeros((2, N))
    send = np.zeros(N)
    for c in C:
        x, anchor = c.gen()
        x = np.asarray(x, float)
        x = pan(x, c.p) if x.ndim == 1 else x
        if c.cut is not None:
            k = ns(c.cut - (c.t - anchor))
            if 0 < k < x.shape[1]:
                x = fades(x[:, :k], 0.0, 0.02)
        tgt = v_ref + c.applied
        cur = momentary_max(x) if c.kind == "event" else integrated(x)
        if np.isfinite(cur):
            x = x * dbg(tgt - cur)
        if c.lpf:
            x = lp(x, c.lpf, 1)
        c.measured = momentary_max(x) - v_ref if c.kind == "event" else integrated(x) - v_ref
        t0 = c.t - anchor
        place(out, x, t0)
        if on_event:
            on_event(c, x, t0)
        if c.send > 0:
            G._place_mono(send, c.send * x.mean(0), t0)
    valley = make_ir(1.1, 77, pre=0.01, hf=1.6, early=[(0.09, 0.45, -0.5), (0.14, 0.3, 0.6), (0.23, 0.2, -0.2)])
    out += 0.55 * convolve_st(send, valley)
    out = hp(out, 25, 2)
    end = ns(T.DUR - 0.12)
    out[:, end:] *= np.linspace(1, 0, N - end)[None, :] ** 2
    return out, C
