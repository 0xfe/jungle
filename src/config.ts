import type { AudioKind } from './audio/mixer';
import type { Habitat, Weather } from './jungle/world';
import type { SoundTuning } from './audio/synthesis';

/**
 * Application defaults. Edit here, run `npm run build`, then refresh the page.
 * Fractions use 0–1; times are seconds unless explicitly named Ms.
 * Runtime sliders override these values for the current page only.
 * Geometry, codec IDs and species state-machine rules stay beside their implementations.
 */
export const CONFIG = {
  startup: {
    /** Choose a fresh browser seed on each load unless ?seed= supplies an integer. */
    randomizeSeed: true,
    /** Deterministic headless default; browser fallback when randomizeSeed is false. */
    seed: 2718,
    /** Initial vegetation preset: rainforest, flowering or wetland. */
    habitat: 'rainforest' as Habitat,
    /** Initial weather: sun, rain or dusk. */
    weather: 'sun' as Weather,
    /** Start with animation paused. */
    paused: false,
    /** Also pause initially when the OS requests reduced motion. */
    respectReducedMotion: true,
    /** Reveal the bottom toolbar at startup instead of requiring Enter. */
    menuVisible: false,
    /** Seed increment used by the Regrow keyboard command. */
    regrowSeedStep: 7919,
  },
  camera: {
    /** Automatically drift when not paused or manually navigating. */
    drift: true,
    /** Seconds without navigation before automatic travel resumes. P still disables drift. */
    driftResumeSeconds: 3,
    /** Initial and Home-key zoom; 1 means 100%. */
    zoom: 1,
    /** Smallest allowed zoom; wider views load more chunks. */
    minZoom: .65,
    /** Largest allowed zoom. */
    maxZoom: 2.5,
    /** Zoom change per button/key press. */
    zoomStep: .1,
    /** Zoom change per mouse-wheel event. */
    wheelZoomStep: .05,
    /** Horizontal automatic travel in CSS pixels/second. */
    driftSpeed: 16,
    /** Normal keyboard travel in CSS pixels/second. */
    moveSpeed: 240,
    /** Shift-key travel in CSS pixels/second. */
    fastMoveSpeed: 850,
    /** Camera velocity easing time constant, in seconds; smaller is snappier. */
    easingSeconds: .18,
    /** Draw tile seams initially (G still toggles them). */
    grid: false,
  },
  world: {
    /** Landscape slider defaults. These describe probability, not exact area coverage. */
    settings: {
      /** Relative lake abundance; 0 removes water, 1 creates much more. */
      water: .2,
      /** Lake scale, 0–1: maps to a 4–18 tile noise wavelength. */
      waterSize: .15,
      /** Relative abundance of small dry clearings, 0–1. */
      barren: .08,
      /** Relative meadow abundance, 0–1. */
      meadow: .1,
      /** Hill relief/abundance, 0–1; hills remain vegetated. */
      hills: .08,
      /** Plant placement multiplier before the opening's density envelope. */
      plants: 1,
      /** Whole animal-group probability multiplier; preserves families and schools. */
      animals: 2.5,
    },
    limits: {
      /** Maximum trees/undergrowth slider multiplier. */
      plants: 1.5,
      /** Maximum animal-life slider multiplier. */
      animals: 5,
      /** Maximum for the normalized landscape sliders. */
      landscape: 1,
    },
    opening: {
      /** Radius in tiles that retains the sparsest density. */
      innerRadius: 3,
      /** Radius in tiles where full density is reached; must exceed innerRadius. */
      outerRadius: 22,
      /** Fraction of configured plant density at the starting clearing. */
      plants: .24,
      /** Fraction of configured group density at the starting clearing. */
      animals: .85,
    },
    regions: {
      /** Wavelength in tiles for recurring open, flowering, fruiting and wet regions. */
      scale: 24,
      /** Canopy fraction in the most open mature regions; the opening still applies. */
      openCanopy: .32,
      /** Extra lake-field depth in wet regions, scaled by the water setting. */
      wetDepth: .24,
    },
    patches: {
      /** Compound 16-tile landscape arrangements with overlapping porous borders. */
      enabled: true,
      /** Continuous canopy fullness; opening density still applies. No per-tile lottery. */
      coverage: .9,
      /** World-space clearing field wavelength in tiles; dense stands stay intact. */
      clearingScale: 5,
      /** Canopy reduction at the heart of occasional grassy glades, from 0 to 1. */
      clearingAmount: .9,
      /** Rooted shear amplitude (screen units per unit height) and wind cycle seconds. */
      sway: .026,
      windPeriod: 5,
      /** Maximum fraction of tree crowns with extra local rustling (all trees sway). */
      rustleCoverage: .45,
      /** Additional crown displacement in logical pixels; no new sprite frames. */
      rustlePixels: 1.6,
      /** Low foliage bends around its lower edge; soil stays still. */
      groundSway: .045,
      /** Flower beds and their grass fringe: maximum tip travel in logical pixels. */
      flowerSwayPixels: .75,
      /** Slow flower breeze cycle in seconds, independent of tree wind. */
      flowerWindPeriod: 9,
      /** RGB foliage palettes multiply a luminance mask; wood/soil retain their color.
       * Change these to red/brown for seasonal leaves; there are only three shared tints. */
      foliage: [[110,184,49],[96,166,48],[128,192,60]] as readonly (readonly [number,number,number])[],
    },
    population: {
      /** Extra colorful-bird candidate weight in dense canopy (added to the open boost). */
      canopyBirdBoost: 1.3,
      /** Black bear candidate probability; most solitary, some mothers with 1–2 cubs. */
      blackBear: .05,
      bearFamilyChance: .28,
      /** Solitary squirrels favor open woodland; each still requires a real tree. */
      squirrel: .10,
      /** Solitary boar favor dense cover and occasionally charge nearby deer. */
      boar: .055,
      /** Riverside species candidates, filtered by the rendered water/bank habitat. */
      beaver: .12,
      crocodile: .035,
      toad: .22,
      /** Deer family candidate probability per 4×4 chunk, before density scaling. */
      deer: .075,
      /** Toucan flock candidate probability per chunk. */
      toucan: .045,
      /** Orangutan family candidate probability per chunk. */
      orangutan: .025,
      /** Jaguar candidate probability in a chunk with a deer candidate. */
      jaguarWithDeer: .24,
      /** Jaguar candidate probability in other chunks. */
      jaguar: .012,
      /** Monkey troop candidate probability per chunk. */
      monkey: .06,
      /** Wolf pack candidate probability per chunk. */
      wolf: .018,
      /** Giraffe group candidate probability per chunk. */
      giraffe: .035,
      /** Elephant family candidate probability; habitat checks still apply. */
      elephant: .085,
      /** Fraction of inland elephant candidates retained (others favor water). */
      inlandElephantRetention: .12,
      /** Shorebird group candidate probability per chunk. */
      seagull: .30,
      /** Fish school candidate probability per chunk. */
      fish: .4,
      /** Solitary whale candidate probability; requires deep water. */
      whale: .025,
      /** Macaw flock candidate probability per chunk. */
      macaw: .075,
      /** Parakeet flock candidate probability per chunk. */
      parakeet: .085,
      /** Kingfisher group candidate probability per chunk. */
      kingfisher: .06,
      /** Solitary constrictor candidate per chunk; requires trees. */
      boa: .055,
      /** Loose group of 3–5 small snakes per chunk. */
      smallSnake: .045,
    },
    rivers: {
      /** Approximate spacing of connected pond nodes, in world tiles. */
      spacing: 32,
      /** Channel half-width in tiles, before per-reach variation. */
      width: .85,
      /** Typical downstream debris/foam speed, in tiles per second. */
      speed: .34,
    },
    cache: {
      /** Maximum accounted chunk bytes, including active chunks; not total browser RAM. */
      maxBytes: 4 * 1024 * 1024,
      /** Maximum cached 4×4 chunks, including active chunks. */
      maxEntries: 256,
      /** Expire unpinned chunks farther than this Chebyshev distance in chunks. */
      maxDistance: 12,
    },
    /** Hard active-viewport chunk cap; must fit the count and byte cache budgets. */
    maxActiveChunks: 144,
  },
  rendering: {
    /** Prefer WebGL, or force Canvas; ?renderer=canvas still overrides this. */
    renderer: 'webgl' as 'webgl' | 'canvas',
    /** Maximum device pixel ratio for WebGL. Higher uses more fill-rate and memory. */
    webglPixelRatio: 2,
    /** Maximum device pixel ratio for the slower Canvas fallback. */
    canvasPixelRatio: 1,
    /** Number of cached tinted sprites in Canvas. */
    canvasTintEntries: 512,
    /** Accounted byte limit for cached tinted Canvas sprites. */
    canvasTintBytes: 8 * 1024 * 1024,
    /** Optional crown detail fades under CPU load; complete scenes still render at rAF cadence. */
    animationBudget: { targetMs: 14, minimum: .3, responseSeconds: 1.5 },
  },
  interface: {
    /** Delay after moving a world slider before rebuilding the landscape, milliseconds. */
    settingsDebounceMs: 250,
    /** Time between updates to FPS and statistics text, seconds. */
    statsInterval: .5,
    /** Number of recent rendered frames used for CPU p95 statistics. */
    statsSamples: 120,
  },
  audio: {
    /** Mobile/touch-first devices start muted unless explicitly enabled here. */
    mobileEnabled: false,
    /** Start sound automatically where permitted; otherwise unlock on the first gesture. */
    enabled: true,
    levels: {
      /** Master volume, 0–1, before the mixer's fixed headroom gain. */
      master: .6,
      /** Leaves, water, rain and insects volume, 0–1. */
      ambience: .05,
      /** Animal footsteps and all nearby/distant bird calls volume, 0–1. */
      wildlife: .8,
    },
    /** Seconds between scene-to-audio planning updates; audio rendering stays continuous. */
    updateInterval: .1,
    /** Generated PCM sample rate in Hz; higher costs more memory. */
    sampleRate: 24000,
    /** Seed for reproducible noise textures; independent of animal simulation RNG. */
    seed: 123,
    /** Maximum simultaneously playing one-shots; background beds are separate. */
    maxVoices: 12,
    /** Master gain ramp time constant in seconds (mute/pause fades). */
    masterFade: .12,
    /** Environment gain ramp time constant in seconds (weather transitions). */
    environmentFade: .8,
    /** Radius in world tiles for audible animals and canopy sampling. */
    radius: 5,
    /** Maximum nearby emitters retained in audio history. */
    maxEmitters: 32,
    /** Maximum new one-shot sounds per planner update. */
    maxEvents: 4,
    /** Base minimum gap between bird phrases, seconds, before each sound's intervalScale. */
    callGapMin: 1.5,
    /** Base maximum gap between bird phrases, seconds. */
    callGapMax: 6,
    /** Lower bound of randomized bird playback speed/pitch, before per-sound speed. */
    pitchMin: .8,
    /** Upper bound of randomized bird playback speed/pitch. */
    pitchMax: 1.24,
    /** Enable the three distant canopy callers in addition to visible birds. */
    chorus: true,
    /** Number of nearby trees that counts as a fully dense canopy for sound mixing. */
    canopyTrees: 18,
    /** Per-sound controls (also documented on the SoundTuning interface for editor hover):
     * enabled: include in playback; gain: linear volume multiplier, 1 = unchanged;
     * speed: playback-rate multiplier (changes pitch AND duration);
     * duration: synthesized seconds (beds must exceed their 0.5-second crossfade);
     * pitch: tone/brightness multiplier without changing length;
     * rhythm: pulse, modulation or gust speed multiplier;
     * texture: noise/rasp multiplier, 0 = no noise (tonal-only sounds ignore it);
     * intervalScale: call/step spacing multiplier, >1 = less frequent (beds ignore it).
     * Speeds, durations, pitch, rhythm and intervalScale must be positive.
     * Gain/texture may be zero. Large gain/texture can cause distortion.
     * Disabled voices still export individually for auditioning, but are excluded from the chorus mix. */
    sounds: {
      /** CC0 recorded trumpet. Gain/speed/intervalScale apply; synthesis fields describe the retained source only. */
      elephant: { enabled:true, gain:.7, speed:1, duration:1.438, pitch:1, rhythm:1, texture:1, intervalScale:1 },
      /** Filtered leafy wind; pitch changes brightness, rhythm changes gust speed. */
      leaves: { enabled:true, gain:1, speed:1, duration:11, pitch:1, rhythm:1, texture:1, intervalScale:1 },
      /** Low water wash; texture controls noise strength. */
      water: { enabled:true, gain:1, speed:1, duration:11, pitch:1, rhythm:1, texture:1, intervalScale:1 },
      /** Rain bed, mixed only during rainy weather. */
      rain: { enabled:true, gain:1, speed:1, duration:11, pitch:1, rhythm:1, texture:1, intervalScale:1 },
      /** High pulsing insects, mixed at dusk; rhythm controls pulse frequency. */
      insects: { enabled:true, gain:1, speed:1, duration:11, pitch:1, rhythm:1, texture:1, intervalScale:1 },
      /** Brief movement-linked footfalls; rhythm changes decay speed. */
      step: { enabled:true, gain:1, speed:1, duration:.22, pitch:1, rhythm:1, texture:1, intervalScale:1 },
      /** Clear swept whistle; rhythm changes syllable spacing. */
      bird: { enabled:true, gain:1, speed:1, duration:1.25, pitch:1, rhythm:1, texture:1, intervalScale:1 },
      /** Bright fast trill; rhythm changes the trill's pulses. */
      trill: { enabled:true, gain:1, speed:1, duration:1.8, pitch:1, rhythm:1, texture:1, intervalScale:1 },
      /** Removed from the default mix: the disliked low wobbling/record-player whistle. */
      warble: { enabled:false, gain:1, speed:1, duration:2.1, pitch:1, rhythm:1, texture:1, intervalScale:1 },
      /** Wooden drumming; pitch controls resonance and rhythm controls tapping speed. */
      woodpecker: { enabled:true, gain:1, speed:1, duration:1.4, pitch:1, rhythm:1, texture:1, intervalScale:1 },
      /** Noisy parrot chatter; texture changes rasp and rhythm changes pulse speed. */
      chatter: { enabled:true, gain:1, speed:1, duration:1.35, pitch:1, rhythm:1, texture:1, intervalScale:1 },
      /** Gull-like shoreline call; pitch and rhythm change its sweep. */
      gull: { enabled:true, gain:1, speed:1, duration:1.7, pitch:1, rhythm:1, texture:1, intervalScale:1 },
    } satisfies Record<AudioKind, SoundTuning>,
  },
};

/** Fail early during build/startup for common typos that could create invalid loops or views. */
export function validateConfig(c:typeof CONFIG=CONFIG):void {
  const require=(ok:boolean,message:string)=>{if(!ok)throw new Error(`Invalid config: ${message}`);};
  const numbers=(value:unknown,path='CONFIG')=>{if(typeof value==='number')require(Number.isFinite(value)&&value>=0,`${path} must be finite and nonnegative`);else if(value&&typeof value==='object')for(const [key,v] of Object.entries(value))numbers(v,`${path}.${key}`);};
  numbers(c);
  require(c.camera.minZoom>0&&c.camera.minZoom<=c.camera.zoom&&c.camera.zoom<=c.camera.maxZoom,'camera zoom must fit minZoom/maxZoom');
  require(c.world.opening.outerRadius>c.world.opening.innerRadius,'opening.outerRadius must exceed innerRadius');
  require(c.world.rivers.spacing>=20&&c.world.rivers.width>=.6&&c.world.rivers.width<=2&&c.world.rivers.speed>0,'rivers need spacing >=20, width 0.6–2 and positive flow');
  require(c.world.opening.plants<=1&&c.world.opening.animals<=1,'opening density fractions must be <=1');
  require(c.world.regions.scale>0&&c.world.regions.openCanopy<=1&&c.world.population.bearFamilyChance<=1,'regions need a positive scale and canopy/family fractions <=1');
  require(c.world.patches.clearingScale>0&&c.world.patches.clearingAmount<=1&&c.world.patches.windPeriod>0,'patches need positive clearingScale/windPeriod and clearingAmount <=1');
  require(c.world.patches.rustleCoverage<=1,'patch rustleCoverage must be <=1');
  require(c.world.patches.flowerWindPeriod>0,'flowerWindPeriod must be positive');
  require(c.rendering.animationBudget.targetMs>0&&c.rendering.animationBudget.minimum<=1&&c.rendering.animationBudget.responseSeconds>0,'animation budget needs positive timing and minimum <=1');
  for(const n of [c.interface.statsSamples,c.world.maxActiveChunks,c.world.cache.maxEntries,c.audio.maxVoices,c.audio.maxEmitters,c.audio.maxEvents])require(Number.isInteger(n)&&n>0,'sample, chunk and voice limits must be positive integers');
  require(c.world.maxActiveChunks<=c.world.cache.maxEntries,'maxActiveChunks must fit cache.maxEntries');
  for(const n of [c.audio.updateInterval,c.audio.radius,c.audio.canopyTrees,c.interface.statsInterval,c.rendering.canvasPixelRatio,c.rendering.webglPixelRatio])require(n>0,'update intervals, radii and pixel ratios must be positive');
  require(c.audio.callGapMin>0&&c.audio.callGapMax>=c.audio.callGapMin,'bird call gap range must be positive and ordered');
  require(c.audio.pitchMin>0&&c.audio.pitchMax>=c.audio.pitchMin,'bird pitch range must be positive and ordered');
  for(const [name,s] of Object.entries(c.audio.sounds)){
    require(s.speed>0&&s.pitch>0&&s.rhythm>0&&s.intervalScale>0,`${name} speed/pitch/rhythm/intervalScale must be positive`);
    require(s.duration>(['leaves','water','rain','insects'].includes(name)?.5:0),`${name} duration is too short`);
  }
}
validateConfig();
