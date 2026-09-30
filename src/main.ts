import { mobileDevice, startupSeed } from './platform';
import { AnimationBudget } from './iso/animation-budget';
import atlasManifestUrl from '../public/assets/jungle.json?url';
import atlasImageUrl from '../public/assets/jungle.png?url';
import elephantAudioUrl from '../public/assets/audio/elephant-trumpet.wav?url';
import { decodePcmWav, type SoundBuffer } from './audio';
import { CONFIG } from './config';
import { DEFAULT_SETTINGS, normalizeSettings, type WorldSettings } from './jungle/settings';
import { Soundscape, type AudioSettings } from './audio';
import { WebAudioSink } from './audio/web-audio';
import { jungleSound } from './jungle/sound';
import { ECO_KINDS } from './jungle/ecology';
import { ease } from './agents';
import { InfiniteWorld } from './jungle/infinite';
import { cameraBounds, composeInfinite, gestureCamera, panCamera, type InfiniteView } from './jungle/infinite-scene';
import { TouchTaps, InteractionPause, PointerNavigation } from './iso/navigation';
import { TerrainKind, TERRAIN_NAMES } from './jungle/terrain';
import { CanvasRenderer } from './iso/canvas';
import { WebGLRenderer } from './iso/webgl';
import { clamp, FixedClock } from './iso/math';
import type { PixelImage, Renderer } from './iso/render';
import { HABITATS, type Habitat, type Weather } from './jungle/world';
import { type AtlasManifest } from './jungle/scene';

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const startupStarted = performance.now();
const repositoryUrl = el<HTMLAnchorElement>('github-link').href;
console.info(`Starting Infinite Jungle · v${__BUILD_INFO__.version}\n${repositoryUrl}`);
const params = new URLSearchParams(location.search);
// Choose entropy once at the browser boundary; world generation stays deterministic.
const initialSeed = startupSeed(params.get('seed'), () => CONFIG.startup.randomizeSeed
  ? crypto.getRandomValues(new Uint32Array(1))[0]!
  : CONFIG.startup.seed);
let settings=normalizeSettings();
let world = new InfiniteWorld(initialSeed,CONFIG.startup.habitat,undefined,settings);
const recordings:Partial<Record<'elephant',SoundBuffer>>={};
let audioReady=false;
const audioSettings:AudioSettings={...CONFIG.audio.levels},soundscape=new Soundscape(CONFIG.audio),audio=new WebAudioSink(undefined,{...CONFIG.audio,recordings});
const mobile=mobileDevice(navigator.userAgent,navigator.maxTouchPoints,matchMedia('(pointer: coarse)').matches);
let soundEnabled=CONFIG.audio.enabled&&(!mobile||CONFIG.audio.mobileEnabled),audioElapsed=0,lastAudioState='off';
const origin = world.origin;
let paused = CONFIG.startup.paused || (CONFIG.startup.respectReducedMotion && matchMedia('(prefers-reduced-motion: reduce)').matches);
let drift = CONFIG.camera.drift && !paused, cameraVX = 0, cameraVY = 0, last = 0, frameCount = 0, fpsElapsed = 0;
const keys = new Set<string>();
const pointers = new PointerNavigation();
const menuTap = new TouchTaps();
const driftPause = new InteractionPause(CONFIG.camera.driftResumeSeconds);
/** Browser time is confined to input/presentation; it never changes simulation randomness. */
function pauseDrift(): void { driftPause.touch(performance.now() / 1000); }
const view: InfiniteView = { width: 900, height: 500, pixelRatio: 1, cameraX: origin.x, cameraY: origin.y, zoom: CONFIG.camera.zoom, grid: CONFIG.camera.grid };
for (const [param, field] of [['x', 'cameraX'], ['y', 'cameraY']] as const) { const n = Number(params.get(param)); if (params.has(param) && Number.isFinite(n)) view[field] = clamp(n, -1e8, 1e8); }
const clock = new FixedClock();
let canvas = el<HTMLCanvasElement>('jungle');
let renderer: Renderer, atlas: AtlasManifest;
const announce = (text: string) => { el('announcement').textContent = text; };
let uiVisible=!CONFIG.startup.menuVisible;
let menuTimer:ReturnType<typeof setTimeout>|undefined;
const menuPointers=new Set<number>();
/** Only idle, closed-panel controls disappear. A held control gets a fresh delay on release. */
function keepMenuAwake():void {
  clearTimeout(menuTimer);
  if(!uiVisible||!el('help').hidden||!el('settings').hidden||menuPointers.size)return;
  menuTimer=setTimeout(()=>{if(uiVisible)toggleUI();},CONFIG.interface.menuIdleSeconds*1000);
}
function toggleUI():void {
  uiVisible=!uiVisible;document.body.classList.toggle('ui-hidden',!uiVisible);
  document.querySelectorAll<HTMLElement>('[data-ui]').forEach(node=>{node.inert=!uiVisible;});
  if(!uiVisible){keys.clear();if(document.activeElement instanceof HTMLElement)document.activeElement.blur();}
  keepMenuAwake();
}
for(const type of ['pointermove','focusin','keydown','input','click'] as const)document.addEventListener(type,e=>{
  if(e.target instanceof Element&&e.target.closest('[data-ui]'))keepMenuAwake();
});
document.addEventListener('pointerdown',e=>{
  if(e.target instanceof Element&&e.target.closest('[data-ui]')){menuPointers.add(e.pointerId);keepMenuAwake();}
},{capture:true});
for(const type of ['pointerup','pointercancel','lostpointercapture'] as const)document.addEventListener(type,e=>{
  if(menuPointers.delete(e.pointerId))keepMenuAwake();
},{capture:true});

function syncUI(): void {
  el('pause').setAttribute('aria-pressed', String(paused));
  el('pause-label').textContent = paused ? 'Resume' : 'Pause';
  el('pause-icon').textContent=paused?'▶':'Ⅱ';
  el('zoom-label').textContent = `${Math.round(view.zoom * 100)}%`;
  el<HTMLButtonElement>('zoom-in').disabled=view.zoom>=CONFIG.camera.maxZoom;el<HTMLButtonElement>('zoom-out').disabled=view.zoom<=CONFIG.camera.minZoom;

}
function regrow(habitat = world.habitat): void {
  const weather = world.weather;
  world = new InfiniteWorld(habitat === world.habitat ? (world.seed + CONFIG.startup.regrowSeedStep) >>> 0 : world.seed, habitat,undefined,settings);
  const start = world.landmark(habitat === 'wetland' ? TerrainKind.Shallow : TerrainKind.Forest);
  view.cameraX = start.x; view.cameraY = start.y; cameraVX = cameraVY = 0;
  world.weather = weather; clock.reset(); syncUI(); announce(`New ${habitat} world, seed ${world.seed}.`);
}
function weather(): void { world.weather = (['sun', 'rain', 'dusk'] as Weather[])[(['sun', 'rain', 'dusk'].indexOf(world.weather) + 1) % 3]!; syncUI(); }
function zoom(delta: number): void { pauseDrift(); view.zoom = clamp(view.zoom + delta, CONFIG.camera.minZoom, CONFIG.camera.maxZoom); syncUI(); }
function recenter(): void { pauseDrift(); const start = world.origin; view.cameraX = start.x; view.cameraY = start.y; cameraVX = cameraVY = 0; view.zoom = CONFIG.camera.zoom; drift = CONFIG.camera.drift && !paused; syncUI(); }
let landscapeIndex = 0;
function nextLandscape(): void { pauseDrift();
  if(landscapeIndex++%5===4){
    if(!settings.water){announce('Increase Water abundance in Settings to visit a stream.');return;}
    const next=world.riverLandmark(view.cameraX,view.cameraY);view.cameraX=next.x;view.cameraY=next.y;cameraVX=cameraVY=0;syncUI();announce('Following a flowing jungle stream.');return;
  }
  const kind = [TerrainKind.Dry, TerrainKind.Meadow, TerrainKind.Deep, TerrainKind.Forest][(landscapeIndex-1) % 5]!;
  const next = world.landmark(kind, view.cameraX, view.cameraY); view.cameraX = next.x; view.cameraY = next.y; cameraVX = cameraVY = 0;
  syncUI(); announce(`Exploring ${TERRAIN_NAMES[kind]!.toLowerCase()}.`);
}
let wildlifeIndex=0;
function nextWildlife():void { pauseDrift();
  const kind=(['deer',...ECO_KINDS,'toucan','orangutan','jaguar'] as const)[wildlifeIndex++%(ECO_KINDS.length+4)]!;
  if(!settings.animals||(!settings.water&&['fish','whale','seagull','beaver','crocodile','toad'].includes(kind))||(!settings.plants&&['monkey','macaw','parakeet','kingfisher','toucan','orangutan','boa','squirrel'].includes(kind))){announce('Increase animal life and its habitat (trees or water) in Settings to find this wildlife.');return;}
  const next=world.wildlifeLandmark(kind,view.cameraX,view.cameraY);view.cameraX=next.x;view.cameraY=next.y;cameraVX=cameraVY=0;
  syncUI();announce(`Watching ${kind==='blackBear'?'black bear':kind} habitat.`);
}
function help(open = !uiVisible || el('help').hidden): void {
  if(open&&!uiVisible)toggleUI();
  if(open){showSettings(false);el<HTMLDetailsElement>('keyboard-commands').open=true;}
  el('help').hidden=!open;
  if(open)el('help').scrollTop=0;
  el('help-button').setAttribute('aria-expanded',String(open));keepMenuAwake();
}
function showSettings(open=el('settings').hidden):void{
  if(open&&!uiVisible)return;
  el('settings').hidden=!open;el('settings-button').setAttribute('aria-expanded',String(open));
  if(open){el('help').hidden=true;el('help-button').setAttribute('aria-expanded','false');keys.clear();}
  keepMenuAwake();
}
el('settings-button').onclick=()=>showSettings();el('close-settings').onclick=()=>{showSettings(false);el('settings-button').focus();};
let settingsTimer:ReturnType<typeof setTimeout>|undefined;
function applyWorldSettings():void{
  const weather=world.weather;world=new InfiniteWorld(world.seed,world.habitat,undefined,settings);world.weather=weather;
  clock.reset();soundscape.reset();syncUI();announce('Landscape settings applied.');
}
const controls:readonly [keyof WorldSettings,string,number][]=[['plants','Trees & undergrowth',CONFIG.world.limits.plants*100],['animals','Animal life',CONFIG.world.limits.animals*100],['water','Water abundance',CONFIG.world.limits.landscape*100],['waterSize','Lake size',CONFIG.world.limits.landscape*100],['barren','Barren clearings',CONFIG.world.limits.landscape*100],['meadow','Meadows',CONFIG.world.limits.landscape*100],['hills','Hills',CONFIG.world.limits.landscape*100]];
function slider(container:HTMLElement,key:string,label:string,max:number,value:number,change:(n:number)=>void,unit=''){
 const row=document.createElement('label');row.className='setting';
 const title=document.createElement('span');title.className='setting-label';title.textContent=label;
 const output=document.createElement('output');const input=document.createElement('input');input.id=`setting-${key}`;input.type='range';input.min='0';input.max=String(max);input.step='1';input.value=String(Math.round(value*100));input.setAttribute('aria-label',label);output.htmlFor=input.id;
 const render=()=>{output.value=unit==='×'?`${(Number(input.value)/100).toFixed(2)}×`:`${input.value}%`;};render();title.append(output);row.append(title,input);container.append(row);
 input.oninput=()=>{render();change(Number(input.value)/100);};return{input,render};
}
const worldControls=controls.map(([key,label,max])=>({key,...slider(el('world-sliders'),key,label,max,settings[key],value=>{
 settings=normalizeSettings({...settings,[key]:value});clearTimeout(settingsTimer);settingsTimer=setTimeout(applyWorldSettings,CONFIG.interface.settingsDebounceMs);
},key==='animals'||key==='plants'?'×':'')}));
el('reset-settings').onclick=()=>{clearTimeout(settingsTimer);settings=normalizeSettings(DEFAULT_SETTINGS);for(const c of worldControls){c.input.value=String(Math.round(settings[c.key]*100));c.render();}applyWorldSettings();};
for(const [key,label] of [['master','Master volume'],['ambience','Environment volume'],['wildlife','Animal sounds']] as const)slider(el('audio-sliders'),key,label,100,audioSettings[key],value=>{audioSettings[key]=value;updateAudio(0);});
function updateAudio(dt:number):void{
 if(lastAudioState!==audio.state){lastAudioState=audio.state;syncSound();}
 if(!soundEnabled&&audio.state==='off')return;
 audio.apply(soundscape.update(jungleSound(world,view.cameraX,view.cameraY),dt,audioSettings,soundEnabled&&audio.state==='running'&&!paused&&!document.hidden));
}
function syncSound():void {
 const running=audio.state==='running';
 el('sound-toggle').textContent=soundEnabled?'Mute sound':'Enable sound';
 el('sound-toggle').setAttribute('aria-pressed',String(soundEnabled));
 const mute=el<HTMLButtonElement>('mute-button');
 mute.setAttribute('aria-label',soundEnabled?'Mute sound':'Unmute sound');
 mute.setAttribute('aria-pressed',String(!soundEnabled));
 mute.title=soundEnabled?'Mute sound':'Unmute sound';
 mute.classList.toggle('muted',!soundEnabled);
 el('sound-status').textContent=!soundEnabled?'Sound muted.':running?'Sound on · nearby calls blend with the forest.':'Sound ready · click or press a key to start audio.';
}
function unlockSound():void {
 if(!audioReady||!soundEnabled||audio.state==='running')return;
 // Some browsers leave resume pending until a gesture. A later gesture must be able to retry.
 void audio.enable().then(()=>{syncSound();updateAudio(0);}).catch(()=>{
  syncSound();el('sound-status').textContent='Audio is waiting for permission. Try Enable sound again.';
 });
}
function toggleSound():void {soundEnabled=!soundEnabled;if(soundEnabled)unlockSound();syncSound();updateAudio(0);}
el('sound-toggle').onclick=toggleSound;el('mute-button').onclick=toggleSound;
function audioGesture(e:Event):void {
 if(e.target instanceof Element&&e.target.closest('#mute-button, #sound-toggle'))return;
 unlockSound();
}
window.addEventListener('pointerdown',audioGesture,{capture:true});
window.addEventListener('keydown',audioGesture,{capture:true});
window.addEventListener('pagehide',()=>audio.dispose());
window.addEventListener('pageshow',()=>{syncSound();unlockSound();});
el('help-button').onclick = () => help(); el('close-help').onclick = () => { help(false); el('help-button').focus(); };
el('pause').onclick = () => { paused = !paused; syncUI(); };
el('zoom-in').onclick = () => zoom(CONFIG.camera.zoomStep); el('zoom-out').onclick = () => zoom(-CONFIG.camera.zoomStep);
/** One action path for physical shortcuts and the tappable field guide. */
function executeCommand(key:string):void {
  if (key === '?' || key === 'h') help();
  else if (key === 'escape') {help(false);showSettings(false);}
  else if(key==='o')showSettings();
  else if (key === 'r') regrow();
  else if (key === 't') weather();
  else if (key === 'v') {pauseDrift();const v=world.volcanoLandmark(view.cameraX,view.cameraY);view.cameraX=v.x;view.cameraY=v.y-.75;cameraVX=cameraVY=0;syncUI();announce('Exploring an active volcano.');}
  else if (key === 'n') nextLandscape();
  else if (key === 'j') nextWildlife();
  else if (key === ' ') { paused = !paused; syncUI(); }
  else if (key === 'p') drift = !drift;
  else if (key === 'g') view.grid = !view.grid;
  else if (key === '+' || key === '=') zoom(CONFIG.camera.zoomStep);
  else if (key === '-') zoom(-CONFIG.camera.zoomStep);
  else if (key === 'home' || key === '0') { recenter(); }
  else if (['1','2','3'].includes(key)) regrow(HABITATS[Number(key) - 1]!);
}
for(const button of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-command]')))button.onclick=()=>{
  const key=button.dataset.command!;
  if(key==='enter'){toggleUI();return;}
  // Touch arrows take a discrete screen-space step; held keyboard travel stays continuous.
  const direction=key.replace('fast-',''),fast=key.startsWith('fast-');
  if(['arrowleft','arrowright','arrowup','arrowdown'].includes(direction)){
    pauseDrift();cameraVX=cameraVY=0;
    const distance=(fast?CONFIG.camera.fastMoveSpeed:CONFIG.camera.moveSpeed)*.25*view.pixelRatio;
    panCamera(view,(direction==='arrowright'?1:direction==='arrowleft'?-1:0)*distance,
      (direction==='arrowdown'?1:direction==='arrowup'?-1:0)*distance);
    syncUI();return;
  }
  executeCommand(key);
};
window.addEventListener('keydown', e => {
  // Preserve native activation for links and the actionable guide buttons.
  if(e.key==='Enter'&&e.target instanceof Element&&e.target.closest('#github-link, [data-command]'))return;
  if(e.key==='Enter'&&!e.metaKey&&!e.ctrlKey&&!e.altKey){e.preventDefault();if(!e.repeat)toggleUI();return;}
  if (e.metaKey || e.ctrlKey || e.altKey || (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName))) return;
  const key = e.key.toLowerCase();
  if (key === 'shift') keys.add(key);
  if (['arrowleft','arrowright','arrowup','arrowdown','w','a','s','d'].includes(key)) { e.preventDefault(); keys.add(key); pauseDrift(); }
  if (e.repeat) return;
  if(key===' '&&e.target instanceof HTMLButtonElement)return;
  if([' ','home','0','?'].includes(key))e.preventDefault();
  executeCommand(key);
});
window.addEventListener('keyup', e => { if (keys.delete(e.key.toLowerCase())&&e.key.toLowerCase()!=='shift') pauseDrift(); });
function clearNavigation(): void { if(pointers.navigating||keys.size>Number(keys.has('shift')))pauseDrift(); keys.clear(); pointers.clear(); menuTap.clear(); menuPointers.clear();keepMenuAwake();cameraVX = cameraVY = 0; }
window.addEventListener('blur', clearNavigation);
document.addEventListener('visibilitychange', () => { last = 0; clearNavigation(); updateAudio(0); });
function bindCanvas(): void {
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !pointers.begin(e.pointerId, { x: e.clientX, y: e.clientY })) return;
    menuTap.begin(e.pointerId,{x:e.clientX,y:e.clientY},e.timeStamp);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    menuTap.move(e.pointerId,{x:e.clientX,y:e.clientY});
    const gesture = pointers.move(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!gesture) return;
    const rect = canvas.getBoundingClientRect();
    const backing = (p: { x: number; y: number }) => ({ x: (p.x - rect.left) * view.width / rect.width, y: (p.y - rect.top) * view.height / rect.height });
    gestureCamera(view, { from: backing(gesture.from), to: backing(gesture.to), zoomRatio: gesture.zoomRatio }, CONFIG.camera.minZoom, CONFIG.camera.maxZoom);
    cameraVX = cameraVY = 0; pauseDrift(); syncUI();
  });
  const release = (e: PointerEvent) => {
    const moved=pointers.navigating;
    const tapped=e.type==='pointerup'?menuTap.end(e.pointerId,e.timeStamp):0;
    if(e.type!=='pointerup')menuTap.cancel(e.pointerId);
    // Mouse clicks toggle individually; a touch double-tap always leaves the menu open.
    if(tapped&&(e.pointerType!=='touch'||tapped===1||!uiVisible))toggleUI();
    else if(tapped===2)keepMenuAwake();
    if(pointers.end(e.pointerId)&&moved)pauseDrift();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', release);
  canvas.addEventListener('wheel', e => { e.preventDefault(); pauseDrift(); zoom(e.deltaY > 0 ? -CONFIG.camera.wheelZoomStep : CONFIG.camera.wheelZoomStep); }, { passive: false });
}
async function loadAtlas(): Promise<PixelImage> {
  const response = await fetch(new URL(atlasManifestUrl, import.meta.url)); if (!response.ok) throw new Error('Cannot load sprite manifest'); atlas = await response.json() as AtlasManifest;
  const image = new Image(); image.src = new URL(atlasImageUrl, import.meta.url).href; await image.decode();
  const surface = document.createElement('canvas'); surface.width = image.width; surface.height = image.height;
  const ctx = surface.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(image, 0, 0);
  return { width: image.width, height: image.height, data: new Uint8Array(ctx.getImageData(0, 0, image.width, image.height).data) };
}
function freshCanvas(): void { clearNavigation(); const next = canvas.cloneNode() as HTMLCanvasElement; canvas.replaceWith(next); canvas = next; }
function resize(): void {
  const rect = el('stage').getBoundingClientRect(); view.pixelRatio = Math.min(devicePixelRatio || 1, renderer instanceof CanvasRenderer ? CONFIG.rendering.canvasPixelRatio : CONFIG.rendering.webglPixelRatio);
  view.width = Math.max(1, Math.round(rect.width * view.pixelRatio)); view.height = Math.max(1, Math.round(rect.height * view.pixelRatio));

}
const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(el('stage')); resize();
const stageSamples = Array.from({length:4},()=>new Float64Array(CONFIG.interface.statsSamples));
const cpuSamples = new Float64Array(CONFIG.interface.statsSamples); let sampleCursor = 0, sampleCount = 0;
const animationBudget = new AnimationBudget(CONFIG.rendering.animationBudget);
function loop(now: number): void {
  const cpuStart = performance.now();
  const elapsed = last ? (now - last) / 1000 : 0;
  const dt = Math.min(elapsed, .1); last = now;
  let dx = Number(keys.has('arrowright') || keys.has('d')) - Number(keys.has('arrowleft') || keys.has('a'));
  let dy = Number(keys.has('arrowdown') || keys.has('s')) - Number(keys.has('arrowup') || keys.has('w'));
  const norm = Math.hypot(dx, dy); if (norm) { dx /= norm; dy /= norm; }
  const interacting = pointers.navigating || keys.size > Number(keys.has('shift'));
  const driftBlocked = driftPause.blocked(now / 1000, interacting);
  const speed = (keys.has('shift') ? CONFIG.camera.fastMoveSpeed : CONFIG.camera.moveSpeed) * view.pixelRatio;
  const targetX = norm ? dx * speed : drift && !paused && !driftBlocked ? CONFIG.camera.driftSpeed * view.pixelRatio : 0;
  const targetY = norm ? dy * speed : 0;
  cameraVX = ease(cameraVX, targetX, CONFIG.camera.easingSeconds, dt); cameraVY = ease(cameraVY, targetY, CONFIG.camera.easingSeconds, dt);
  if (!paused || norm) panCamera(view, cameraVX * dt, cameraVY * dt);
  world.ensure(cameraBounds(view));
  const streamed = performance.now();
  if (!paused && !document.hidden) clock.advance(dt, step => world.update(step));
  const simulated = performance.now();
  const frame = composeInfinite(world, atlas, view, clock.alpha, animationBudget.detail);
  const composed = performance.now();
  renderer.render(frame);
  const submitted = performance.now();
  if (!paused && !document.hidden) animationBudget.record(submitted - cpuStart, elapsed);
  [streamed-cpuStart, simulated-streamed, composed-simulated, submitted-composed].forEach((value,i)=>stageSamples[i]![sampleCursor%CONFIG.interface.statsSamples]=value);
  audioElapsed+=dt;if(audioElapsed>=CONFIG.audio.updateInterval){updateAudio(audioElapsed);audioElapsed=0;}
  cpuSamples[sampleCursor++ % cpuSamples.length] = performance.now() - cpuStart; sampleCount = Math.min(sampleCount + 1, cpuSamples.length);
  frameCount++; fpsElapsed += elapsed;
  if (fpsElapsed >= CONFIG.interface.statsInterval) { el('fps').textContent = String(Math.round(frameCount / fpsElapsed)); el('draws').textContent = String(frame.commands.length); el('cpu').textContent = cpuSamples.slice(0, sampleCount).sort()[Math.floor(sampleCount * .95)]!.toFixed(1); ['stream-cpu','sim-cpu','compose-cpu','render-cpu'].forEach((id,i)=>el(id).textContent=stageSamples[i]!.slice(0,sampleCount).sort()[Math.floor(sampleCount*.95)]!.toFixed(1)); updateStats(frame.commands.length); frameCount = 0; fpsElapsed = 0; }
  requestAnimationFrame(animate);
}
/** A runtime exception must leave a useful diagnosis instead of a silently frozen canvas. */
function animate(now:number):void {
  try { loop(now); }
  catch(error){
    console.error('Jungle frame failed',error);
    paused=true;syncUI();
    const notice=el('loading');notice.hidden=false;notice.setAttribute('role','alert');
    const message=document.createElement('p');message.textContent=`The jungle stopped: ${error instanceof Error?error.message:String(error)}`;
    const reload=document.createElement('button');reload.textContent='Reload jungle';reload.addEventListener('click',()=>location.reload());
    notice.replaceChildren(message,reload);canvas.setAttribute('aria-busy','false');
    audio.dispose();
  }
}
function updateStats(quads: number): void {
  const stats = world.stats;
  const values = { 'world-size': `≈${stats.worldSize}`, resident: stats.resident, 'active-tiles': stats.active,
    generated: stats.generated, expired: stats.expired, 'rendered-unique': `≈${stats.renderedUnique}`, 'visible-tiles': stats.renderedNow, agents: stats.agents, animals: stats.animals, herds: stats.herds };
  for (const [id, value] of Object.entries(values)) el(id).textContent = String(value);
  // Explicit estimate of owned resources, not a claim to know the browser's total RAM.
  const bytes = audio.bytes + stats.estimatedBytes + (renderer.auxiliaryBytes ?? 0) + atlas.width * atlas.height * 4 * 2 + view.width * view.height * 4 * 2 + quads * 256;
  el('memory').textContent = (bytes / 1e9).toFixed(3);
  el('cache-memory').textContent = `${(stats.cachedBytes / 1048576).toFixed(2)} / ${(world.cache.budget.maxBytes / 1048576).toFixed(0)}`;
  const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize;
  el('heap').textContent = heap ? (heap / 1e9).toFixed(3) : 'n/a';
  el('location-info').textContent = `Seed ${world.seed} · ${view.cameraX.toFixed(1)}, ${view.cameraY.toFixed(1)} · ${world.weather}`;
}
async function start(): Promise<void> {
  const pixels = await loadAtlas();
  if(CONFIG.audio.sounds.elephant.enabled){
    const response=await fetch(new URL(elephantAudioUrl,import.meta.url));
    if(!response.ok)throw new Error('Cannot load elephant recording; run npm run build');
    recordings.elephant=decodePcmWav(new Uint8Array(await response.arrayBuffer()));
  }
  audioReady=true;
  try { if ((params.get('renderer') ?? CONFIG.rendering.renderer) === 'canvas') throw new Error('Canvas requested'); renderer = new WebGLRenderer(canvas, pixels); }
  catch { freshCanvas(); renderer = new CanvasRenderer(canvas, pixels, {maxEntries:CONFIG.rendering.canvasTintEntries,maxBytes:CONFIG.rendering.canvasTintBytes}); }
  resize(); bindCanvas();
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault(); renderer.dispose(); freshCanvas(); bindCanvas(); renderer = new CanvasRenderer(canvas, pixels, {maxEntries:CONFIG.rendering.canvasTintEntries,maxBytes:CONFIG.rendering.canvasTintBytes}); resize();
    el('renderer').textContent = renderer.name; announce('Graphics context lost. Continued with Canvas rendering.');
  });
  el('renderer').textContent = renderer.name; syncUI(); syncSound(); unlockSound();
  // Keep the loading scene visible until the first real jungle frame is drawn.
  await new Promise<void>((resolve,reject)=>requestAnimationFrame(time=>{try{loop(time);resolve();}catch(error){reject(error);}}));
  el('loading').hidden=true;canvas.setAttribute('aria-busy','false');
  logStartup();
}
/** Snapshot only after the first frame, when streaming and visible-tile counts are populated. */
function logStartup(): void {
  console.groupCollapsed('Infinite Jungle ready');
  console.info('Build', __BUILD_INFO__);
  console.info('Runtime', {
    renderer: renderer.name, startupMs: Math.round(performance.now() - startupStarted),
    seed: world.seed, habitat: world.habitat, weather: world.weather, mobile, paused, drift,
    viewport: { width: view.width, height: view.height, pixelRatio: view.pixelRatio },
    camera: { x: view.cameraX, y: view.cameraY, zoom: view.zoom },
    sound: { enabled: soundEnabled, state: audio.state, levels: { ...audioSettings } },
  });
  console.info('World settings', { ...settings });
  console.info('Application defaults', structuredClone(CONFIG));
  console.info('Initial world stats (memory is estimated, not total browser RAM)', world.stats);
  console.info('Budgets', { cache: { ...world.cache.budget }, maxActiveChunks: CONFIG.world.maxActiveChunks });
  console.info('Atlas', { width: atlas.width, height: atlas.height, sprites: Object.keys(atlas.sprites).length, ...atlas.stats });
  console.groupEnd();
}
toggleUI();
start().catch(error => { console.error(error);el('loading').hidden=false;el('loading').setAttribute('role','alert');el('loading').textContent = 'The jungle could not load. Run npm run build, then refresh.';canvas.setAttribute('aria-busy','false'); });
