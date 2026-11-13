#!/usr/bin/env python3
"""Audio QC for studio/public/audio/tram-15s.wav  (15.000 s, 48 kHz, 2 ch, 24-bit).

Owner: agent S2. Read-only with respect to the WAV and everything else.

Checks
  A. container truth   : duration, exact sample frames, channels, bits per sample, rate
  B. loudness          : integrated LUFS + true peak dBTP  (ffmpeg ebur128=peak=true, stderr parse)
  C. per-second RMS    : all 15 seconds, loudest / quietest second, silent-second count
  D. clipping + DC     : full-scale sample count, near-full-scale count, DC offset per channel
  E. verdict           : PASS/FAIL per item + overall, printed as JSON on stdout

Usage
  python studio/shorts/tram/qc_audio.py [--wav PATH] [--out PATH] [--wait-secs N]
"""

from __future__ import annotations

import argparse
import json
import math
import re
import subprocess
import sys
import time
from pathlib import Path

import numpy as np

# ---------------------------------------------------------------- contract ----
EXPECTED_RATE = 48000
EXPECTED_CH = 2
EXPECTED_BITS = 24
EXPECTED_SECONDS = 15.0
EXPECTED_FRAMES = int(EXPECTED_RATE * EXPECTED_SECONDS)  # 720000
TARGET_LUFS = -16.0
LUFS_TOLERANCE = 1.0
MAX_TRUE_PEAK_DBTP = -2.2
SILENCE_DBFS = -60.0          # a second quieter than this counts as silent
FULL_SCALE_24 = 8388607       # max positive 24-bit code
INT24_SCALE = float(1 << 23)  # 8388608.0

DEFAULT_WAV = Path("studio/public/audio/tram-15s.wav")
DEFAULT_OUT = Path("out/qa/tram_audio_qc.json")


# ------------------------------------------------------------- wav reading ----
def read_wav_int24(path: Path):
    """Parse a RIFF/WAVE file manually and return (meta, int32 samples [frames, ch]).

    Manual parsing is used (not the wave module) so that the bit depth, channel
    count and exact frame count come straight from the file's own header, and so
    the 24-bit codes are available unrounded for the clipping / DC check.
    """
    raw = path.read_bytes()
    if len(raw) < 12 or raw[0:4] != b"RIFF" or raw[8:12] != b"WAVE":
        raise ValueError("not a RIFF/WAVE file")

    pos = 12
    fmt = None
    data = None
    while pos + 8 <= len(raw):
        cid = raw[pos:pos + 4]
        csize = int.from_bytes(raw[pos + 4:pos + 8], "little")
        body = raw[pos + 8:pos + 8 + csize]
        if cid == b"fmt ":
            fmt = body
        elif cid == b"data":
            data = body
            break
        pos += 8 + csize + (csize & 1)
    if fmt is None:
        raise ValueError("no 'fmt ' chunk")
    if data is None:
        raise ValueError("no 'data' chunk")

    audio_format = int.from_bytes(fmt[0:2], "little")
    channels = int.from_bytes(fmt[2:4], "little")
    rate = int.from_bytes(fmt[4:8], "little")
    bits = int.from_bytes(fmt[14:16], "little")
    # WAVE_FORMAT_EXTENSIBLE (0xFFFE) carries the real depth in the sub-format;
    # valid bits live at offset 18 of the extension. Accept it like plain PCM.
    container_bits = bits
    if audio_format == 0xFFFE and len(fmt) >= 20:
        container_bits = int.from_bytes(fmt[18:20], "little") or bits
    if audio_format not in (1, 0xFFFE):
        raise ValueError(f"unsupported WAV format tag {audio_format} (want 1=PCM)")

    bytes_per_sample = (bits + 7) // 8
    frame_bytes = bytes_per_sample * channels
    if frame_bytes == 0:
        raise ValueError("zero frame size")
    usable = len(data) - (len(data) % frame_bytes)
    frames = usable // frame_bytes
    buf = np.frombuffer(data[:usable], dtype=np.uint8)

    if bits == 24:
        b = buf.reshape(-1, 3).astype(np.int32)
        v = b[:, 0] | (b[:, 1] << 8) | (b[:, 2] << 16)
        v = np.where(v >= (1 << 23), v - (1 << 24), v)  # sign extend
        ints = v.astype(np.int32).reshape(-1, channels)
    elif bits == 16:
        ints = buf.view(np.int16).reshape(-1, channels).astype(np.int32)
    elif bits == 32:
        ints = buf.view(np.int32).reshape(-1, channels).astype(np.int32)
    else:
        raise ValueError(f"unsupported bit depth {bits}")

    meta = {
        "path": str(path),
        "file_bytes": len(raw),
        "audio_format_tag": audio_format,
        "channels": channels,
        "sample_rate": rate,
        "bits_per_sample": bits,
        "container_bits": container_bits,
        "frames": int(frames),
        "data_bytes": len(data),
        "duration_s": frames / float(rate) if rate else None,
    }
    return meta, ints


def ebur128(path: Path):
    """Run ffmpeg ebur128=peak=true and parse I (LUFS) + true peak (dBTP) from stderr."""
    cmd = [
        "ffmpeg", "-hide_banner", "-nostdin", "-nostats", "-v", "info",
        "-i", str(path),
        "-filter_complex", "[0:a]ebur128=peak=true[out]",
        "-map", "[out]", "-f", "null", "-",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, errors="replace")
    err = proc.stderr or ""

    def tofloat(s: str):
        try:
            return float(s)
        except (TypeError, ValueError):
            return None

    def grab_last(pattern: str):
        """Last match wins.

        ffmpeg 4.2 emits an *early* ebur128 summary while configuring the graph
        (before any audio is measured, so I: -70.0 LUFS / Peak: -inf dBFS) and
        the real summary at end-of-stream. Only the last one is meaningful.
        """
        found = re.findall(pattern, err, re.IGNORECASE | re.MULTILINE)
        return tofloat(found[-1]) if found else None

    integrated = grab_last(r"^\s*I:\s*(-?\d+(?:\.\d+)?|-inf|-nan)\s*LUFS")
    lra = grab_last(r"^\s*LRA:\s*(-?\d+(?:\.\d+)?)\s*LU")

    # True peak: the "Peak: ... dBFS" line inside the final "True peak:" heading.
    # The early (pre-measurement) block reports -inf, so prefer the last finite value.
    true_peak = None
    tp_blocks = re.findall(
        r"True peak:(.*?)(?:\n\s*\n|\Z)", err, re.IGNORECASE | re.DOTALL)
    peaks = []
    for blk in tp_blocks:
        m = re.search(r"Peak:\s*(-?\d+(?:\.\d+)?|-inf|-nan)\s*dBFS", blk, re.IGNORECASE)
        if m:
            peaks.append(tofloat(m.group(1)))
    finite = [v for v in peaks if v is not None and math.isfinite(v)]
    if finite:
        true_peak = finite[-1]
    elif peaks:
        true_peak = peaks[-1]

    return {
        "cmd": " ".join(cmd),
        "returncode": proc.returncode,
        "integrated_lufs": integrated,
        "loudness_range_lu": lra,
        "true_peak_dbtp": true_peak,
        "summaries_seen": len(re.findall(r"Summary:", err)),
        "stderr_tail": "\n".join(err.strip().splitlines()[-40:]),
    }


def db(x: float) -> float:
    return -math.inf if x <= 0.0 else 20.0 * math.log10(x)


# ------------------------------------------------------------------ helpers ---
def check(cid, label, measured, required, ok, note=""):
    return {
        "id": cid,
        "label": label,
        "measured": measured,
        "required": required,
        "pass": bool(ok),
        "note": note,
    }


def r(x, n=3):
    if x is None:
        return None
    if isinstance(x, float) and (math.isinf(x) or math.isnan(x)):
        return None if math.isnan(x) else ("-inf" if x < 0 else "inf")
    return round(float(x), n)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--wav", default=str(DEFAULT_WAV))
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--wait-secs", type=int, default=0)
    args = ap.parse_args()

    wav = Path(args.wav)
    waited = 0
    while not wav.exists() and waited < args.wait_secs:
        time.sleep(5)
        waited += 5
    if not wav.exists():
        result = {
            "wav": str(wav),
            "exists": False,
            "overall_verdict": "FAIL",
            "reason": f"file not found after waiting {waited}s",
        }
        print(json.dumps(result, indent=2))
        if args.out:
            Path(args.out).parent.mkdir(parents=True, exist_ok=True)
            Path(args.out).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        return 2

    meta, ints = read_wav_int24(wav)
    frames = meta["frames"]
    ch = meta["channels"]
    rate = meta["sample_rate"]

    x = ints.astype(np.float64) / INT24_SCALE        # [-1, 1) normalised
    dur = frames / float(rate)
    per_sec = rate  # one table row per 1.000 s

    checks = []

    # ---- A. container truth -------------------------------------------------
    checks.append(check(
        "duration", "exact duration (s)", r(dur, 6), EXPECTED_SECONDS,
        abs(dur - EXPECTED_SECONDS) < 5e-7,
        f"off by {dur - EXPECTED_SECONDS:+.6f} s",
    ))
    checks.append(check(
        "sample_count", "exact sample frames", frames, EXPECTED_FRAMES,
        frames == EXPECTED_FRAMES, f"off by {frames - EXPECTED_FRAMES:+d} frames",
    ))
    checks.append(check(
        "channels", "channels", ch, EXPECTED_CH, ch == EXPECTED_CH, "",
    ))
    checks.append(check(
        "bits", "bits per sample", meta["bits_per_sample"], EXPECTED_BITS,
        meta["bits_per_sample"] == EXPECTED_BITS, "",
    ))
    checks.append(check(
        "sample_rate", "sample rate (Hz)", rate, EXPECTED_RATE,
        rate == EXPECTED_RATE, "",
    ))

    # ---- B. loudness / true peak -------------------------------------------
    eb = ebur128(wav)
    lufs = eb["integrated_lufs"]
    tp = eb["true_peak_dbtp"]
    lufs_ok = lufs is not None and abs(lufs - TARGET_LUFS) <= LUFS_TOLERANCE
    tp_ok = tp is not None and tp <= MAX_TRUE_PEAK_DBTP
    checks.append(check(
        "integrated_loudness", "integrated loudness (LUFS)", r(lufs, 2),
        f"{TARGET_LUFS} +/- {LUFS_TOLERANCE} LUFS", lufs_ok,
        "" if lufs is not None else ("unparsed" if eb["returncode"] == 0 else "ffmpeg failed"),
    ))
    checks.append(check(
        "true_peak", "true peak (dBTP)", r(tp, 2), f"<= {MAX_TRUE_PEAK_DBTP} dBTP", tp_ok,
        "" if tp is not None else "not parsed from ebur128 output",
    ))

    # ---- C. per-second RMS --------------------------------------------------
    n_full = frames // per_sec if per_sec else 0
    table = []
    squares = x * x
    mono_ms = squares.mean(axis=1) if ch > 1 else squares[:, 0]
    for s in range(n_full):
        seg = mono_ms[s * per_sec:(s + 1) * per_sec]
        rms = float(math.sqrt(float(seg.mean()))) if seg.size else 0.0
        table.append({
            "second": s,
            "rms_dbfs": r(round(db(rms), 2)),
            "peak_dbfs": r(round(db(float(np.sqrt(squares[s * per_sec:(s + 1) * per_sec].max()))), 2)),
        })
    # trailing partial second (should not exist given frame contract)
    partial = frames - n_full * per_sec

    silent = [row["second"] for row in table if row["rms_dbfs"] is None or row["rms_dbfs"] < SILENCE_DBFS]
    loudest = max(table, key=lambda w: w["rms_dbfs"] if w["rms_dbfs"] is not None else -999) if table else None
    quietest = min(table, key=lambda w: w["rms_dbfs"] if w["rms_dbfs"] is not None else 999) if table else None
    checks.append(check(
        "second_count", "per-second RMS windows", len(table), EXPECTED_SECONDS,
        len(table) == int(EXPECTED_SECONDS) and partial == 0,
        f"trailing partial frames: {partial}",
    ))
    checks.append(check(
        "silent_seconds", f"silent seconds (RMS < {SILENCE_DBFS} dBFS)", len(silent), 0,
        len(silent) == 0, f"silent at {silent}" if silent else "",
    ))

    # ---- D. clipping + DC ---------------------------------------------------
    a = np.abs(ints)
    full_scale = int(np.count_nonzero(a >= FULL_SCALE_24))
    near_fs = int(np.count_nonzero(a >= int(FULL_SCALE_24 * 0.999)))
    checks.append(check(
        "full_scale_samples", "samples at full scale (abs >= 8388607)", full_scale, 0,
        full_scale == 0, f"also {near_fs} samples >= -0.0087 dBFS",
    ))

    dc = []
    for c in range(ch):
        col = x[:, c]
        mean_code = float(ints[:, c].mean())
        mean_norm = mean_code / INT24_SCALE
        dc.append({
            "channel": c + 1,
            "dc_offset_code": r(mean_code, 3),
            "dc_offset_pct_full_scale": r(mean_norm * 100.0, 6),
            "dc_offset_dbfs": r(round(db(abs(mean_norm)), 2)) if abs(mean_norm) > 0 else None,
            "pass": abs(mean_norm) < 0.001,
        })
    dc_ok = all(d["pass"] for d in dc)

    # ---- E. verdict ---------------------------------------------------------
    overall = all(c["pass"] for c in checks) and dc_ok

    result = {
        "wav": meta["path"],
        "exists": True,
        "file_bytes": meta["file_bytes"],
        "contract": {
            "expect_seconds": EXPECTED_SECONDS,
            "expect_frames": EXPECTED_FRAMES,
            "expect_rate": EXPECTED_RATE,
            "expect_channels": EXPECTED_CH,
            "expect_bits": EXPECTED_BITS,
        },
        "measured": {
            "duration_s": r(dur, 6),
            "sample_frames": frames,
            "channels": ch,
            "bits_per_sample": meta["bits_per_sample"],
            "sample_rate": rate,
            "integrated_lufs": r(lufs, 2),
            "true_peak_dbtp": r(tp, 2),
            "loudness_range_lu": r(eb["loudness_range_lu"], 2),
            "peak_sample_dbfs": r(round(db(float(np.abs(x).max())), 2)),
            "loudest_second": loudest,
            "quietest_second": quietest,
            "silent_seconds": silent,
            "silent_second_count": len(silent),
            "full_scale_samples": full_scale,
            "near_full_scale_samples": near_fs,
        },
        "checks": checks,
        "dc_offset": dc,
        "dc_offset_pass": dc_ok,
        "rms_per_second": table,
        "ebur128": {
            "returncode": eb["returncode"],
            "cmd": eb["cmd"],
            "stderr_tail": eb["stderr_tail"],
        },
        "overall": "PASS" if overall else "FAIL",
        "overall_verdict": "PASS" if overall else "FAIL",
    }

    out = Path(args.out) if args.out else None
    if out:
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")

    print(json.dumps(result, indent=2))
    return 0 if overall else 1


if __name__ == "__main__":
    sys.exit(main())