# Soundscapes and the reusable audio library

Open **Settings / O → Enable sound**. Leaves and a low environmental wash continue under local water, rain, dusk insects and occasional nearby footsteps/bird calls. Master, environment and animal levels are independent. Sound starts only after a button gesture, fades when muted/paused/hidden, and releases its graph on page exit. Nothing is fetched from a sound service.

## Layers and reuse

| Module | Responsibility |
| --- | --- |
| `src/audio/synthesis.ts` | Pure deterministic stereo PCM synthesis, independent of DOM/Web Audio |
| `src/audio/mixer.ts` | `SoundScene`, `SoundEmitter`, `SoundFrame`, `AudioSink`, bounded `Soundscape` planner and in-memory sink |
| `src/audio/web-audio.ts` | Lazy browser adapter: shared buffers, gain automation, stereo panning, compressor, bounded voices and disposal |
| `src/jungle/sound.ts` | Application adapter: weather/canopy/water near the camera and agent stride phases become a generic sound scene |

The audio library imports no jungle code. The isometric renderer imports no audio code. A listener in world coordinates and isometric x−y panning connect the two at the application boundary. A different scene can feed the same planner or send its own `SoundFrame` to an `AudioSink`.

```ts
import { Soundscape, MemoryAudioSink } from '../src/audio';
const planner = new Soundscape();
const output = new MemoryAudioSink();
output.apply(planner.update({x:0, y:0, canopy:1, water:.2, rain:0,
  night:0, emitters:[]}, .1));
// Inspect output.frame in Node; swap the sink for WebAudioSink in a browser.
```

Call `WebAudioSink.enable()` from a user gesture. Its constructor accepts an optional context factory for headless adapter tests. `apply()` uses the audio clock and exponential gain targets: weather/habitat layers ease over .8 seconds, master mute/pause over .12 seconds. Enabling does not create a context or loop per animal. Calls happen at 10 Hz; native audio nodes render continuously between updates.

Four looping stereo beds feed a master gain and soft-knee compressor. At most 12 effects overlap; completed nodes disconnect immediately. The planner considers only the nearest 32 emitters within five world tiles and replaces its history every update. Steps follow changing stride phases, with a global .18-second spacing floor. Birds call intermittently rather than all at once. Offscreen/retired IDs do not accumulate. Sound buffers total under 10 MiB and are included in the UI resource estimate after sound is enabled.

## Original sound generation

The current sounds are **original procedural approximations**, not wildlife recordings. No third-party sound asset is bundled. We searched for reusable forest/rain audio, but selected synthesis for a consistent gentle palette, deterministic offline tests and no license/download dependency. The implementation follows the [W3C Web Audio API](https://www.w3.org/TR/webaudio/) graph, buffer, gain automation, stereo panner and compressor contracts.

- Leaves: band-limited seeded noise with slow independent gust modulation.
- Water: a low filtered wash with a faint high-frequency component.
- Rain: filtered broadband noise; a separate layer so it can blend over leaves/water.
- Insects: quiet high-frequency pulsed tones for dusk.
- Steps: brief filtered noise with soft attack and exponential decay.
- Birds: three short swept tonal syllables with smooth envelopes and small playback-rate variation.

Loop buffers use an equal-power overlap across their join. One-shots begin/end at zero, and the signal has headroom before mixing. A limiter-like compressor controls overlapping transients; it is not a promise about arbitrary external audio clips or device volume. Each species does not yet have its own recorded call, and there is no convolution reverb, physical acoustic occlusion or underwater listener model.

```sh
npm run audio:preview  # six deterministic stereo WAVs → artifacts/audio/
npm test              # PCM, loop seams, planner and injected Web Audio adapter
```

To add a sound: extend the typed bank, author its pure PCM generator (or later add a licensed decoded-buffer source), register it once in the browser bank, and map application events to it. Preserve provenance, bounded voices, zero-ended effect envelopes and loop continuity. Keep synthesis outside the animation loop. Tests verify finite samples, DC offset, headroom, stereo determinism, loop discontinuities, weather layering, panning, pause/mute, history bounds, lazy startup, gain ramps and disposal. Browser QA verifies startup/control behavior; final subjective sound balance still benefits from listening on the intended speakers/headphones.
