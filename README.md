# A Universe For You 🌙✨

An interactive, cinematic 3D birthday experience. The moon tells a story, the birthday girl makes a wish and blows into her phone's microphone, the candles go out, the stars become her wishes and fly into a magical envelope, and the envelope is sent beyond the stars.

Built as a static web app (no build step): vanilla ES modules + Three.js, Web Audio API for real breath detection, procedural music and sound effects, and the browser's speech synthesis for the moon's voice.

## Run locally

Any static server works; the page needs HTTPS or `localhost` for microphone access.

```
python -m http.server 8787
# open http://localhost:8787/
```

## Story / scene states

`INTRO → MOON_GREETING → CAKE_REVEAL → WISH_INVITATION → MICROPHONE_LISTENING → CANDLES_EXTINGUISHED → CELEBRATION → STARS_COLLECT_WISHES → ENVELOPE_SEALED → ENVELOPE_SENT → FINAL_MESSAGE → FINAL_BIRTHDAY_GREETING`

Every transition is triggered by the previous narration, animation, or interaction finishing (see `js/director.js`).

## Breath detection

`BlowDetector` in `js/audio.js`:

- `getUserMedia` (audio only, no recording, nothing leaves the browser) → `AnalyserNode`
- RMS level from the time-domain signal, spectral flatness from the spectrum (blowing is noise-like, speech is tonal)
- 1 s ambient calibration, then threshold = `max(minLevel, ambient × mul + 0.012)`
- a blow must stay above threshold for `hold` ms (hold decays when the level drops)
- a manual fallback button appears after 14 s, or immediately if the microphone is denied/unavailable

Tune from the URL while testing, for example `?blow=0.06&hold=400&flat=0.2&mul=3.5&strong=0.25`:

| param | default | meaning |
|---|---|---|
| `blow` | 0.045 | absolute RMS floor for a blow |
| `mul` | 3.2 | ambient multiplier for the threshold |
| `hold` | 320 | ms the level must stay above threshold |
| `flat` | 0.16 | spectral-flatness gate (lower = more permissive) |
| `strong` | 0.2 | RMS that always counts regardless of flatness |

## Other URL options

| param | effect |
|---|---|
| `to=Name` | shows "For Name, who is very special" on the start screen |
| `rate=0.9&pitch=1.1` | moon voice speed and pitch |
| `fast=4` | speeds the whole story up (testing; voice is skipped) |
| `auto=1` | auto-taps the buttons (testing) |

## Files

- `index.html`, `css/style.css` — overlay UI, subtitles, final greeting
- `js/world.js` — renderer, sky shader, background stars, dust, lights, camera rig
- `js/moon.js` — the moon character (canvas-drawn face on a sphere, blinking, looking, talking)
- `js/stars.js` — hundreds of star characters (instanced billboard sprites), travel-to-envelope animation
- `js/cake.js` — cake, candles, shader flames, smoke, sparkles, candlelight
- `js/envelope.js` — envelope, flap, wax seal, beam, launch and vanish
- `js/audio.js` — audio engine, procedural music, sound effects, narrator, blow detector
- `js/director.js` — the scene state machine and camera direction
- `js/sprites.js` — instanced sprite/particle engine and procedural textures
