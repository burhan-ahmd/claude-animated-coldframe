# 15 s soundtrack for the ColdframeSmokeTest composition (story frames 0-449 = the film's first
# 15 s): the film's OWN music stem (music.py) + SFX stem (sfx.py), sliced to exactly 15.000 s and
# mixed WITHOUT the voice - the voice is a personal recording and is never committed or shared.
# sfx.py scales every event against a voice-loudness reference (v_ref); without a voice we pass a
# stand-in constant, which is only a global gain (all events share it), so the original relative
# mix is preserved and the master stage below sets the absolute level.
# Full-length stems are cached in _cache/ exactly like mix.py, so reruns are fast.
# usage: cd studio/shorts/bridge/audio && python smoke_audio.py
# output: studio/public/audio/smoke-15s.wav (48 kHz stereo 24-bit, <= -1 dBTP)
import os
import numpy as np
from dsp import (SR, ns, dbg, integrated, momentary_max, true_peak, fades, write_wav)
import timeline as T
import mix as M  # reuses its log() and cached()

HERE = M.HERE  # studio/shorts/bridge/audio
OUT_DIR = os.path.normpath(os.path.join(M.ROOT, "..", "..", "public", "audio"))  # studio/public/audio
OUT = os.path.join(OUT_DIR, "smoke-15s.wav")

DUR = 15.0
N = ns(DUR)                     # 720,000 samples = 15.000 s exactly at 48 kHz
V_REF = -18.0                   # stand-in narration loudness (global gain only, see header)
TARGET_LUFS = -16.0             # master target (voice-less test mix, a touch louder than the film's -15 under voice)
CEIL_DBTP = -1.2                # same true-peak ceiling as the film mix
MUSIC_GAIN_DB = 0.0             # music vs SFX balance in the slice (tuned once from the measured stems)
FADE_OUT = 0.6                  # musical outro fade so the test ends in silence, not mid-note


def main():
    M.log("rendering full-length stems (cached after the first run)")
    import music
    b = music.build()
    m = M.cached("music_raw", lambda: music.render(b, ref=-20.0)[0])[:, :N]
    import sfx
    s = M.cached("sfx_raw_v18", lambda: sfx.render(V_REF)[0])[:, :N]

    mI, sI = integrated(m), integrated(s)
    M.log(f"slice loudness: music {mI:.1f} LU, sfx {sI:.1f} LU (balance gain {MUSIC_GAIN_DB:+.1f} dB)")
    x = m * dbg(MUSIC_GAIN_DB) + s

    # musical ending: fade the last FADE_OUT seconds to silence (the picture keeps cutting at 14.8 s)
    k = ns(DUR - FADE_OUT)
    x[:, k:] *= np.linspace(1, 0, N - k)[None, :] ** 1.5
    x = fades(x, 0.01, 0.0)

    # master: normalize to TARGET_LUFS, then cap true peak; report real measured numbers
    x *= dbg(TARGET_LUFS - integrated(x))
    tp = true_peak(x)
    if tp > CEIL_DBTP:
        x *= dbg(CEIL_DBTP - tp)
        M.log(f"peaked above ceiling ({tp:.2f} dBTP) - trimmed to {CEIL_DBTP} (final {integrated(x):.1f} LUFS)")
    tp = true_peak(x)
    M.log(f"master: {integrated(x):.1f} LUFS integrated, {tp:.2f} dBTP, {N} samples = {N / SR:.3f} s")

    os.makedirs(OUT_DIR, exist_ok=True)
    write_wav(OUT, x, 24)
    M.log("wrote", OUT)


if __name__ == "__main__":
    main()
