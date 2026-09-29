# Application defaults

Edit **[`src/config.ts`](../src/config.ts)**, run `npm run build`, then refresh or upload the rebuilt `dist/`. It is the application's configuration entry point; it runs in Node as well as the browser. Every setting has a comment describing its meaning and units. Basic validation catches invalid zoom/radius ranges and nonpositive timing/voice limits during a build.

| Group | What to change |
| --- | --- |
| `startup` | Randomize seed on browser load, deterministic fallback seed, preset, weather, pause/reduced-motion handling, initial menu visibility and regrowth seed increment |
| `camera` | Initial/min/max zoom, zoom steps, automatic drift and its idle resume delay, keyboard speeds, easing and grid overlay |
| `world.settings` / `limits` | Landscape/animal slider defaults and maximum values |
| `world.opening` | Sparse-start plant/animal fractions and transition radii |
| `world.rivers` | Pond spacing, channel half-width and downstream speed; water zero disables the network |
| `world.regions` | Recurring regional wavelength, open-canopy fraction and wet-region water depth |
| `world.birds` | Canopy crossing chance, search radius and bounded territory margin |
| `world.population` | Candidate probability for each species, plus inland elephant retention |
| `world.cache` / `maxActiveChunks` | Byte/count/distance budgets and active viewport cap |
| `rendering` | Renderer preference, pixel-ratio caps and Canvas tint-cache limits |
| `interface` | Menu idle timeout, slider debounce and statistics update/sample intervals |
| `audio` | Desktop/mobile initial enabled states, mix levels, proximity, polyphony, call timing/pitch ranges, fades, PCM rate/seed and individual sounds |

A URL seed/position override still takes precedence, and `?renderer=canvas` can force Canvas. Sliders and keyboard controls override defaults for the current page only. Resetting world settings restores `CONFIG.world.settings`. Home restores configured zoom/drift at the seeded opening. `camera.driftResumeSeconds` defaults to 3: navigation delays drift without overriding P or Pause. Pinch zoom shares the same zoom bounds as buttons and the wheel. The config is build-time source, not a live settings store.

## Startup seeds

Browser loads choose a fresh unsigned 32-bit seed using Web Crypto by default. A valid integer `?seed=` overrides this choice (including `0`); empty, fractional or invalid values use the configured startup policy. Explicit integers retain unsigned 32-bit normalization. Set `startup.randomizeSeed` to `false` to use `startup.seed` on ordinary loads. Headless world constructors retain that deterministic default regardless of the browser policy. Entropy is selected once before world creation; terrain, animals, regrowth and checkpoints still use seeded randomness. Refresh does not save or reuse the previous random seed.

## Every sound can be tuned

Each entry in `CONFIG.audio.sounds` has the same documented controls:

| Field | Effect |
| --- | --- |
| `enabled` | Omit this sound from the browser's buffer bank and playback |
| `gain` | Linear volume multiplier; 0 silences it, 1 preserves its authored level |
| `speed` | Playback multiplier; affects pitch and duration together |
| `duration` | Synthesized seconds; beds must exceed the half-second crossfade |
| `pitch` | Tone/brightness multiplier without changing length |
| `rhythm` | Speed of pulses, trills, modulation or gusts |
| `texture` | Strength of noise/rasp; tonal-only sounds ignore this |
| `intervalScale` | Spacing multiplier for calls/steps; >1 makes them less frequent; beds ignore this |

The synthetic bank contains leaves, water, rain, insects, footsteps, whistles (`bird`), trills, warbles, woodpecker taps, chatter and gull calls. **The low wobbling `warble` is disabled by default.** Toucans now use the clear whistle, and the distant chorus filters out disabled sounds. The remaining voices keep their existing levels.

For example, lower `audio.sounds.trill.gain` to `.6` for quieter trills, increase `woodpecker.intervalScale` to `2` for less frequent drumming, or set any voice's `enabled` to `false`. Change `rhythm` to alter articulation without shortening the entire clip; use `speed` when both pitch and duration should change.

`npm run audio:preview` exports tuned individual WAVs, including disabled voices for auditioning, and a `forest-chorus.wav` mix using the enabled bank and configured levels. Individual files represent synthesis before playback gain/speed; the chorus applies those controls. It also exports the retained elephant recording and includes nearby elephant calls in the mix. Recorded sounds use enabled/gain/speed/intervalScale; synthesis-only fields do not alter recorded PCM. These files live under ignored `artifacts/audio/` and can be regenerated.

## Library boundaries and limits

Reusable audio and rendering libraries accept options injected by the application. They retain standalone defaults for other consumers and never import the jungle config. `src/jungle/` uses config directly for application-specific generation. The preview script uses the same audio config as the browser.

The fixed 60 Hz simulation, tile projection, atlas layout, codec IDs, model geometry and detailed species state machines remain implementation contracts rather than independent knobs. Changing those requires coordinated code/art/tests. Increasing visible density, zoom-out range, PCM durations/sample rate or cache sizes can raise CPU/memory costs; run the tests and benchmark after substantial adjustments. Preserve the current 64 MiB shared-atlas contract.

World checkpoints store slider values, but not a copy of this entire source configuration. Use the same generation configuration when restoring checkpoints; changing opening/population rules requires discarding older checkpoints or explicitly versioning/migrating them. Nothing automatically persists across browser reloads.

`world.patches` controls canopy fullness, clearing wavelength (`clearingScale`, tiles), maximum local thinning (`clearingAmount`, 0–1), continuous rooted wind (`sway`, shear amplitude; `windPeriod`, seconds), and three leaf-tint palettes. `audio.mobileEnabled` defaults to false and is only a startup choice; explicit mute/unmute remains authoritative. Arrangement planning follows density/opening and river geometry settings, with temporary bounded terrain probes. Changing generator controls requires a new world, as before. See [landscape groups](LANDSCAPE-PATCHES.md).

`population.canopyBirdBoost` increases colorful flocks in dense cover; `blackBear` and `bearFamilyChance` tune solitary versus mother–cub candidates. Species placement uses independent seeded streams. See [regional variety](REGIONAL-VARIETY.md).


Landscape motion uses `world.patches.groundSway` for low foliage, `flowerSwayPixels` and `flowerWindPeriod` for a separate, restrained flower-bed breeze, `sway` for trees, and `rustleCoverage`/`rustlePixels` for optional crown detail. `rendering.animationBudget` averages CPU submission cost with `responseSeconds`, fades crown detail toward `minimum` above `targetMs`, and restores it below 70% of that target. It never changes simulation speed, populations or broad wind. Rendering follows browser animation callbacks rather than a fixed FPS cap; the fixed 60 Hz clock belongs to simulation. See [landscape motion](LANDSCAPE-PATCHES.md).

Current sound, input, bears/zebras, giraffe proportions, elephant sampling, shared landscape accents and schema 18/14 are documented in [wildlife refinements](WILDLIFE-REFINEMENTS.md).

`world.patches.accentRustlePeriod` controls the local leaf/petal animation cycle while broad sway keeps running. `world.birds.crossingChance`, `crossingRange` and `territoryMargin` tune occasional perch-to-perch flights across water. Vulture and seagull frequency remain under `world.population`; these generator changes require a fresh world. See [wildlife refinements](WILDLIFE-REFINEMENTS.md#gentle-rustling-and-river-crossings).

`interface.menuIdleSeconds` defaults to 3. Toolbar interaction restarts this delay; open Settings/Help panels and held controls suspend it. Closing a panel starts a full delay. Enter toggles controls, a single touch tap toggles them, and a double tap leaves them visible. The toolbar fades in/out in 160 ms; reduced-motion preferences remove this transition. The startup loading canopy is independent of menu visibility and remains until the first rendered frame.
