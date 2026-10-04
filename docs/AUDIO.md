# Soundscapes and the reusable audio library

Sound is **muted by default on every platform**, with master **60%**, environment **5%** and wildlife **80%**. The top-right speaker button remains visible when Enter/Return hides the main menu. Settings contains the same mute control and the three volume sliders. The initial scene has a quiet leaf/water bed underneath independent bird phrases, with steps, rain and dusk insects joining as appropriate.

`CONFIG.audio.enabled` defaults to false. Every user explicitly enables sound with the speaker button. `mobileEnabled` remains an additional mobile opt-in restriction if automatic startup is configured in a custom build; resizing a window never changes mute.

When sound is enabled, the application attempts startup automatically and retries on clicks/keypresses if browser autoplay policy suspends it. A muted preference is never reversed by a gesture. The graph is silent while suspended, paused or hidden, avoiding a queue of calls that would burst out on resume. Browsers may require the first interaction before producing sound; see [autoplay behavior](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay). The graph is released on page exit and can restart after a back/forward-cache return. Nothing is fetched from a sound service.

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

Call `WebAudioSink.enable()` to start or resume; callers that attempt autoplay must also retry from a user gesture when blocked. Its constructor accepts an optional context factory for headless adapter tests. `apply()` uses the audio clock and exponential gain targets: weather/habitat layers ease over .8 seconds, master mute/pause over .12 seconds. Enabling does not create a context or loop per animal. Calls happen at 10 Hz; native audio nodes render continuously between updates.

Four environmental beds and one flight-only propulsion loop feed a master gain and soft-knee compressor. At most 12 effects overlap; completed nodes disconnect immediately. The planner considers only the nearest 32 emitters within five world tiles and replaces its history every update. Steps follow changing stride phases, with a global .18-second spacing floor. Each bird owns an ID-seeded timer and varying pitch; there is no shared chirp gate. A fixed three-voice distant canopy chorus supplies additional overlapping whistles, trills and occasional woodpecker-like drumming, even when visible wildlife is sparse. It represents ambient calls rather than hidden animal agents. Each phrase chooses a new pitch and pause; rain and dusk lengthen pauses. The planner emits at most four events per update. Offscreen/retired IDs do not accumulate. The twelve enabled synthetic buffers plus one mono elephant recording total about 9.57 MiB, under 10 MiB and are included in the UI resource estimate after sound is enabled.

## Original sound generation

The background beds and bird calls are **original procedural approximations**. Elephant trumpets use one bundled CC0 wildlife recording. We searched for reusable forest/rain audio, but selected synthesis for the original forest palette. The elephant recording is retained locally with provenance; normal builds do not download audio. The implementation follows the [W3C Web Audio API](https://www.w3.org/TR/webaudio/) graph, buffer, gain automation, stereo panner and compressor contracts.

- Leaves: band-limited seeded noise with slow independent gust modulation.
- Water: a low filtered wash with a faint high-frequency component.
- Rain: filtered broadband noise; a separate layer so it can blend over leaves/water.
- Insects: quiet high-frequency pulsed tones for dusk.
- Steps: brief filtered noise with soft attack and exponential decay.
- Birds: swept whistles, rapid trills, optional lower warbles (disabled by default), noisy chatter and gull-like calls, plus damped wooden taps with changing rhythm for woodpecker-like drumming. Nearby species select a suitable voice; all callers vary playback rate from 0.80–1.24. These are stylized synthesized calls, not species-identification recordings.

Beds synthesize eleven seconds with a half-second overlap, producing 10.5-second shared loops. Loop buffers use an equal-power overlap across their join. One-shots begin/end at zero, and the signal has headroom before mixing. A limiter-like compressor controls overlapping transients; it is not a promise about arbitrary external audio clips or device volume. Each species does not yet have its own recorded call, and there is no convolution reverb, physical acoustic occlusion or underwater listener model.

```sh
npm run audio:preview  # thirteen synthetic WAVs + elephant.wav + a 30-second forest-chorus.wav mix → artifacts/audio/
npm test              # PCM, loop seams, planner and injected Web Audio adapter
```

To add a sound: extend the typed bank, author its pure PCM generator (or later add a licensed decoded-buffer source), register it once in the browser bank, and map application events to it. Preserve provenance, bounded voices, zero-ended effect envelopes and loop continuity. Keep synthesis outside the animation loop. Tests verify finite samples, DC offset, headroom, stereo determinism, loop discontinuities, weather layering, panning, pause/mute, history bounds, lazy startup, gain ramps and disposal. Browser QA verifies startup/control behavior; final subjective sound balance still benefits from listening on the intended speakers/headphones.

The master uses a fixed 0.75 headroom factor after its user slider. Wildlife and environment controls are independent: the distant bird chorus belongs to wildlife, so the 5% environment setting does not suppress it. `npm run audio:preview` exports the default mix for listening on the intended speakers/headphones. The preview approximates panning and excludes the browser compressor; subjective balance still needs listening on target hardware.

All application audio defaults and individual voice tuning live in [`src/config.ts`](../src/config.ts). The low wobbling warble is disabled; toucans use the clear whistle. The planner filters disabled calls and the browser skips their buffers. See [configuration](CONFIGURATION.md) for gain, speed, duration, pitch, rhythm, texture and interval controls.

## Recorded elephant trumpet

Nearby elephant agents occasionally emit the [CC0 “Elephant voice - trumpeting” recording by தகவலுழவன்](https://commons.wikimedia.org/wiki/File:Elephant_voice_-_trumpeting.ogg), dated 1 February 2011. Source OGG, exact source revision, license links, conversion command and source/derived SHA-256 hashes live in [`assets/source/audio/provenance.json`](../assets/source/audio/provenance.json). The unmodified OGG is retained alongside it. The shipped mono 24 kHz PCM16 WAV has short endpoint fades and half source amplitude; attribution travels with `dist/assets/audio/`. The build verifies both hashes. The later CC0 tiger recording is documented in [megafauna](MEGAFAUNA.md).

`decodePcmWav()` is a small DOM-free decoder for retained PCM16 files. The application injects the decoded recording into `WebAudioSink`; the reusable audio library does not fetch jungle assets. Missing/invalid recordings fail visibly at startup. `npm run audio:preview` uses the same WAV, tuning and planner as the browser.

Each nearby elephant owns an audio-only ID-seeded caller with an 18–42-second minimum-base spacing (lengthened by rain/dusk), slight rate variation and distance attenuation. Calls belong to the wildlife slider and share the existing voice/history caps. There is no distant elephant chorus, and snakes make no footstep sounds. Muting, pausing, hiding or suspending the audio context does not queue calls for later playback.

`CONFIG.audio.sounds.elephant` controls enabled/gain/speed/intervalScale. Its duration/pitch/rhythm/texture fields document the source and do not resynthesize or time-stretch a recording; edit/reconvert the retained recording to change those characteristics. Original synthetic voices continue honoring their synthesis controls.

Current sound, input, bears/zebras, giraffe proportions, elephant sampling, shared landscape accents and schema 16/13 are documented in [wildlife refinements](WILDLIFE-REFINEMENTS.md).

## Space visitors

Flight-only `hover` is a short shared stereo loop with gentle beating harmonics and a faint high whistle, panned toward nearby spacecraft and ramped over 0.12 seconds. It is mixed by the wildlife slider rather than the quiet environmental bed slider. Multiple nearby ships feed the same bounded propulsion layer. `alien` supplies short formant-like syllables only during crew exploration; individual audio-only callers vary pitch and phrase spacing, with species-specific rates. Both respect per-sound tuning, distance, mute, pause and the existing caller/effect budgets. They never consume behavior RNG. See [spacecraft](SPACECRAFT.md#flight-effects-and-voices) and audition `hover.wav` / `alien.wav` from `npm run audio:preview`.

## Zen sanctuaries

See [zen sanctuaries and the hidden artifact editor](ZEN.md) for original tree provenance, baked directional inhabitants, localized music, H/five-tap controls, bounded ownership and validation. Current world/agent schemas are **25/20**.

Tigers (75), hippos (76), bison (77), registered monk stair transitions and the retained CC0 tiger recording are documented in [megafauna](MEGAFAUNA.md). Current world/agent schemas are **26/21**.
