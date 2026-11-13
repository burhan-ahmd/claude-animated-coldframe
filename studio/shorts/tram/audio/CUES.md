# The Last Tram (1902) - soundtrack cue sheet

All sound is original: synthesized in numpy/scipy by `tram_audio.py` (SFX + rain/rail/motor beds),
using the bridge short's proven DSP kit (`dsp.py`, `sfx_gen.py`, copied unchanged).
SFX + ambience only - no music, no voiceover. Frames are 30 fps, so frame/30 = seconds.

## Files
| file | content |
|---|---|
| `studio/public/audio/tram-15s.wav` | the master: 48 kHz, stereo, 24-bit, 720000 samples = 15.000 s |

## Master
- Integrated **-16.00 LUFS**, true peak **-2.90 dBTP** (master gain +1.22 dB, master limiter ceiling -2.9 dBTP)

## Cues
| frame | time s | kind | cue | what |
|---|---|---|---|---|
| 0 | 0.000 | bed | `rain_bed` | heavy rain on cobbles + on the tram roof, slow gusting (the floor of the film) |
| 0 | 0.000 | bed | `rail_roll` | rail/steel squeal growing + wheel-on-rail rumble to the stop (0-96) |
| 0 | 0.000 | event | `sparks_drips` | occasional trolley-wheel spark crackles on the overhead wire + eaves drips |
| 92 | 3.067 | event | `brake_bite` | brake shoes bite: hard metallic clamp |
| 96 | 3.200 | bed | `motor_drone` | low motor + electrical drone idling at the stop (96-405) |
| 96 | 3.200 | event | `bell_x2` | bell struck twice, close and brassy (96, 103) |
| 96 | 3.200 | bed | `flood_lap` | flood water lapping at the kerb (96-300) |
| 110 | 3.667 | event | `tram_drips` | water dripping off the tram into the flood |
| 120 | 4.000 | event | `elec_tick` | slow electrical tick from the controller |
| 120 | 4.000 | event | `thunder` | one distant thunder roll, well behind the buildings (frame 120) |
| 150 | 5.000 | event | `lady_steps` | the lady crossing the flooded road L->R: footfalls in 4-6 cm of water + umbrella drips (150-344) |
| 176 | 5.867 | event | `boy_kerb` | the boy at the kerb: small quick footsteps on wet stone, paper rustle |
| 196 | 6.533 | event | `boat_set_down` | the paper boat set on the water: soft plip + small splash (196-205) |
| 205 | 6.833 | event | `boat_bob` | the paper boat nudging in the gutter: tiny irregular water taps (205-450, still there at 440) |
| 300 | 10.000 | event | `controller_clack` | the driver changes ends: deep controller clack, brake release, the far headlamp's hum brightens |
| 336 | 11.200 | event | `boy_boards` | boots through the flood, hollow metal thud on the step (352), handrail grasp, weight on the step |
| 405 | 13.500 | event | `departure` | departure bell x2, the motor winds up, wheels rolling, rail clatter accelerating and receding (405-450) |
