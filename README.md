# A Universe For You 🌙✨

An interactive, cinematic birthday experience under a moonlit night sky. The camera drifts from the Milky Way down to a full moon over a calm sea, follows the moonlight across the water to a birthday cake on a wooden pier, and waits. She makes a wish and blows into her phone's microphone, the candles go out, the stars become her wishes and fly into a glowing envelope, and the envelope rises past the moon into the sky. It ends with fireworks over the sea and the birthday message.

Built as a static web app with no build step and no libraries. The whole world is drawn as SVG (generated in `js/scene.js`) and a camera animates the SVG viewBox. The Web Audio API handles real breath detection plus procedural music and sound effects. There is no voice narration.

## Run locally

Any static server works; the page needs HTTPS or `localhost` for microphone access.

```
python -m http.server 8787
# open http://localhost:8787/
```

## Story / scene states

`INTRO → MOON → CAKE_REVEAL → WISH_INVITATION → MICROPHONE_LISTENING → CANDLES_EXTINGUISHED → CELEBRATION → STARS_COLLECT_WISHES → ENVELOPE_SEALED → ENVELOPE_SENT → FINAL_BIRTHDAY_GREETING`

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
| `fast=4` | speeds the whole story up (testing) |
| `auto=1` | auto-taps the buttons (testing) |

## Files

- `index.html`, `css/style.css`: overlay UI, captions, final greeting, and the CSS that animates twinkling stars, waves, moonlight glints and the lighthouse
- `js/scene.js`: the SVG world (sky gradient, painted Milky Way, stars, moon, clouds, island and lighthouse, sea, pier, cake with candle flames and smoke, envelope, shooting stars, fireworks) and the viewBox camera
- `js/director.js`: the scene state machine and camera shots
- `js/audio.js`: audio engine, procedural music, sound effects, blow detector
- `js/confetti.js`: screen-space confetti and hearts for the finale
- `js/ui.js`, `js/util.js`: overlay helpers, tweens and easing
