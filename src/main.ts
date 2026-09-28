import { DEFAULT_SETTINGS, normalizeSettings, type WorldSettings } from './jungle/settings';
import { DEFAULT_AUDIO, Soundscape, type AudioSettings } from './audio';
import { WebAudioSink } from './audio/web-audio';
import { jungleSound } from './jungle/sound';
import { ECO_KINDS } from './jungle/ecology';
import { ease } from './agents';
import { InfiniteWorld } from './jungle/infinite';
import { cameraBounds, composeInfinite, panCamera, type InfiniteView } from './jungle/infinite-scene';
import { TerrainKind, TERRAIN_NAMES, landscape } from './jungle/terrain';
import { CanvasRenderer } from './iso/canvas';
import { WebGLRenderer } from './iso/webgl';
import { clamp, FixedClock } from './iso/math';
import type { PixelImage, Renderer } from './iso/render';
import { HABITATS, type Habitat, type Weather } from './jungle/world';
import { type AtlasManifest } from './jungle/scene';

const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const params = new URLSearchParams(location.search);
const initialSeed = Number(params.get('seed') ?? 2718) >>> 0;
let settings=normalizeSettings();
let world = new InfiniteWorld(initialSeed,'rainforest',undefined,settings);
const audioSettings:AudioSettings={...DEFAULT_AUDIO},soundscape=new Soundscape(),audio=new WebAudioSink();
let soundEnabled=false,audioElapsed=0;
const origin = world.landmark(TerrainKind.Forest);
let paused = matchMedia('(prefers-reduced-motion: reduce)').matches;
let drift = !paused, cameraVX = 0, cameraVY = 0, last = 0, frameCount = 0, fpsElapsed = 0;
const keys = new Set<string>();
const view: InfiniteView = { width: 900, height: 500, pixelRatio: 1, cameraX: origin.x, cameraY: origin.y, zoom: 1, grid: false };
for (const [param, field] of [['x', 'cameraX'], ['y', 'cameraY']] as const) { const n = Number(params.get(param)); if (params.has(param) && Number.isFinite(n)) view[field] = clamp(n, -1e8, 1e8); }
const clock = new FixedClock();
let canvas = el<HTMLCanvasElement>('jungle');
let renderer: Renderer, atlas: AtlasManifest;
const announce = (text: string) => { el('announcement').textContent = text; };
let uiVisible=false;
function toggleUI():void {
  uiVisible=!uiVisible;document.body.classList.toggle('ui-hidden',!uiVisible);
  document.querySelectorAll<HTMLElement>('[data-ui]').forEach(node=>{node.inert=!uiVisible;});
  if(!uiVisible){keys.clear();if(document.activeElement instanceof HTMLElement)document.activeElement.blur();}
}

function syncUI(): void {
  el('seed').textContent = String(world.seed).padStart(6, '0');
  el('habitat-caption').textContent = TERRAIN_NAMES[landscape(view.cameraX, view.cameraY, world.seed,world.settings).kind]!;
  document.querySelectorAll<HTMLButtonElement>('[data-habitat]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.habitat === world.habitat)));
  el('pause').setAttribute('aria-pressed', String(paused));
  el('pause-label').textContent = paused ? 'Resume' : 'Pause';
  el('status').textContent = paused ? 'A MOMENT OF STILLNESS' : 'THE JUNGLE IS ALIVE';
  el('zoom-label').textContent = `${Math.round(view.zoom * 100)}%`;
  el<HTMLButtonElement>('zoom-in').disabled=view.zoom>=2.5;el<HTMLButtonElement>('zoom-out').disabled=view.zoom<=.65;
  const weather = { sun: ['☀', 'Dappled sunlight', 'A gentle breeze through the canopy'], rain: ['☂', 'A passing shower', 'Rain stirs the leaves and quickens the deer'], dusk: ['☾', 'The blue hour', 'Longer rests as fireflies greet the evening'] }[world.weather];
  el('weather-icon').textContent = weather[0]!; el('weather-label').textContent = weather[1]!; el('weather-detail').textContent = weather[2]!;
}
function regrow(habitat = world.habitat): void {
  const weather = world.weather;
  world = new InfiniteWorld(habitat === world.habitat ? (world.seed + 7919) >>> 0 : world.seed, habitat,undefined,settings);
  const start = world.landmark(habitat === 'wetland' ? TerrainKind.Shallow : TerrainKind.Forest);
  view.cameraX = start.x; view.cameraY = start.y; cameraVX = cameraVY = 0;
  world.weather = weather; clock.reset(); syncUI(); announce(`New ${habitat} world, seed ${world.seed}.`);
}
function weather(): void { world.weather = (['sun', 'rain', 'dusk'] as Weather[])[(['sun', 'rain', 'dusk'].indexOf(world.weather) + 1) % 3]!; syncUI(); }
function zoom(delta: number): void { view.zoom = clamp(view.zoom + delta, .65, 2.5); syncUI(); }
function recenter(): void { const start = world.landmark(TerrainKind.Forest); view.cameraX = start.x; view.cameraY = start.y; cameraVX = cameraVY = 0; view.zoom = 1; drift = !paused; syncUI(); }
let landscapeIndex = 0;
function nextLandscape(): void {
  const kind = [TerrainKind.Dry, TerrainKind.Meadow, TerrainKind.Deep, TerrainKind.Forest][landscapeIndex++ % 4]!;
  const next = world.landmark(kind, view.cameraX, view.cameraY); view.cameraX = next.x; view.cameraY = next.y; cameraVX = cameraVY = 0;
  syncUI(); announce(`Exploring ${TERRAIN_NAMES[kind]!.toLowerCase()}.`);
}
let wildlifeIndex=0;
function nextWildlife():void {
  const kind=(['deer',...ECO_KINDS,'toucan','orangutan','jaguar'] as const)[wildlifeIndex++%(ECO_KINDS.length+4)]!;
  if(!settings.animals||(!settings.water&&['fish','whale','seagull'].includes(kind))||(!settings.plants&&['monkey','macaw','parakeet','kingfisher','toucan','orangutan'].includes(kind))){announce('Increase animal life and its habitat (trees or water) in Settings to find this wildlife.');return;}
  const next=world.wildlifeLandmark(kind,view.cameraX,view.cameraY);view.cameraX=next.x;view.cameraY=next.y;cameraVX=cameraVY=0;drift=false;
  syncUI();announce(`Watching ${kind} habitat.`);
}
function help(open = el('help').hidden): void { if(open&&!uiVisible)return; if(open)showSettings(false); el('help').hidden = !open; el('help-button').setAttribute('aria-expanded', String(open)); }
function showSettings(open=el('settings').hidden):void{
  if(open&&!uiVisible)return;
  el('settings').hidden=!open;el('settings-button').setAttribute('aria-expanded',String(open));
  if(open){el('help').hidden=true;el('help-button').setAttribute('aria-expanded','false');keys.clear();}
}
el('settings-button').onclick=()=>showSettings();el('close-settings').onclick=()=>{showSettings(false);el('settings-button').focus();};
let settingsTimer:ReturnType<typeof setTimeout>|undefined;
function applyWorldSettings():void{
  const weather=world.weather;world=new InfiniteWorld(world.seed,world.habitat,undefined,settings);world.weather=weather;
  clock.reset();soundscape.reset();syncUI();announce('Landscape settings applied.');
}
const controls:readonly [keyof WorldSettings,string,number][]=[['plants','Trees & undergrowth',150],['animals','Animal life',500],['water','Water abundance',100],['waterSize','Lake size',100],['barren','Barren clearings',100],['meadow','Meadows',100],['hills','Hills',100]];
function slider(container:HTMLElement,key:string,label:string,max:number,value:number,change:(n:number)=>void,unit=''){
 const row=document.createElement('label');row.className='setting';
 const title=document.createElement('span');title.className='setting-label';title.textContent=label;
 const output=document.createElement('output');const input=document.createElement('input');input.id=`setting-${key}`;input.type='range';input.min='0';input.max=String(max);input.step='1';input.value=String(Math.round(value*100));input.setAttribute('aria-label',label);output.htmlFor=input.id;
 const render=()=>{output.value=unit==='×'?`${(Number(input.value)/100).toFixed(2)}×`:`${input.value}%`;};render();title.append(output);row.append(title,input);container.append(row);
 input.oninput=()=>{render();change(Number(input.value)/100);};return{input,render};
}
const worldControls=controls.map(([key,label,max])=>({key,...slider(el('world-sliders'),key,label,max,settings[key],value=>{
 settings=normalizeSettings({...settings,[key]:value});clearTimeout(settingsTimer);settingsTimer=setTimeout(applyWorldSettings,250);
},key==='animals'||key==='plants'?'×':'')}));
el('reset-settings').onclick=()=>{clearTimeout(settingsTimer);settings=normalizeSettings(DEFAULT_SETTINGS);for(const c of worldControls){c.input.value=String(Math.round(settings[c.key]*100));c.render();}applyWorldSettings();};
for(const [key,label] of [['master','Master volume'],['ambience','Environment volume'],['wildlife','Animal sounds']] as const)slider(el('audio-sliders'),key,label,100,audioSettings[key],value=>{audioSettings[key]=value;updateAudio(0);});
function updateAudio(dt:number):void{
 if(!soundEnabled&&audio.state==='off')return;
 audio.apply(soundscape.update(jungleSound(world,view.cameraX,view.cameraY),dt,audioSettings,soundEnabled&&!paused&&!document.hidden));
}
el('sound-toggle').onclick=async()=>{
 const button=el<HTMLButtonElement>('sound-toggle');button.disabled=true;
 try{if(!soundEnabled)await audio.enable();soundEnabled=!soundEnabled;button.textContent=soundEnabled?'Mute sound':'Enable sound';button.setAttribute('aria-pressed',String(soundEnabled));el('sound-status').textContent=soundEnabled?'Sound on · fades with weather and nearby habitat.':'Sound off';updateAudio(0);}
 catch(error){el('sound-status').textContent='Sound could not start. Try enabling it again.';console.error(error);}
 finally{button.disabled=false;}
};
window.addEventListener('pagehide',()=>{audio.dispose();soundEnabled=false;el('sound-toggle').textContent='Enable sound';el('sound-toggle').setAttribute('aria-pressed','false');el('sound-status').textContent='Sound off';});
el('help-button').onclick = () => help(); el('close-help').onclick = () => { help(false); el('help-button').focus(); };
el('next-landscape').onclick = nextLandscape; el('next-wildlife').onclick=nextWildlife;
el('regrow').onclick = () => regrow(); el('weather').onclick = weather;
el('pause').onclick = () => { paused = !paused; syncUI(); };
el('zoom-in').onclick = () => zoom(.1); el('zoom-out').onclick = () => zoom(-.1);
document.querySelectorAll<HTMLButtonElement>('[data-habitat]').forEach(b => b.onclick = () => regrow(b.dataset.habitat as Habitat));
window.addEventListener('keydown', e => {
  if(e.key==='Enter'&&!e.metaKey&&!e.ctrlKey&&!e.altKey){e.preventDefault();if(!e.repeat)toggleUI();return;}
  if (e.metaKey || e.ctrlKey || e.altKey || (e.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName))) return;
  const key = e.key.toLowerCase();
  if (key === 'shift') keys.add(key);
  if (['arrowleft','arrowright','arrowup','arrowdown','w','a','s','d'].includes(key)) { e.preventDefault(); keys.add(key); drift = false; }
  if (e.repeat) return;
  if (key === '?' || key === 'h') help();
  else if (key === 'escape') {help(false);showSettings(false);}
  else if(key==='o')showSettings();
  else if (key === 'r') regrow();
  else if (key === 't') weather();
  else if (key === 'n') nextLandscape();
  else if (key === 'j') nextWildlife();
  else if (key === ' ' && !(e.target instanceof HTMLButtonElement)) { e.preventDefault(); paused = !paused; syncUI(); }
  else if (key === 'p') drift = !drift;
  else if (key === 'g') view.grid = !view.grid;
  else if (key === '+' || key === '=') zoom(.1);
  else if (key === '-') zoom(-.1);
  else if (key === 'home' || key === '0') { e.preventDefault(); recenter(); }
  else if (['1','2','3'].includes(key)) regrow(HABITATS[Number(key) - 1]!);
});
window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
window.addEventListener('blur', () => keys.clear());
document.addEventListener('visibilitychange', () => { last = 0; keys.clear(); updateAudio(0); });
let drag: { x: number; y: number } | undefined;
function bindCanvas(): void {
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); drift = false; });
  canvas.addEventListener('pointermove', e => { if (!drag) return; const ratio = view.width / canvas.clientWidth; panCamera(view, -(e.clientX - drag.x) * ratio, -(e.clientY - drag.y) * ratio); cameraVX = cameraVY = 0; drag = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', () => { drag = undefined; }); canvas.addEventListener('pointercancel', () => { drag = undefined; });
  canvas.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY > 0 ? -.05 : .05); }, { passive: false });
}
async function loadAtlas(): Promise<PixelImage> {
  const response = await fetch('./assets/jungle.json'); if (!response.ok) throw new Error('Cannot load sprite manifest'); atlas = await response.json() as AtlasManifest;
  const image = new Image(); image.src = './assets/jungle.png'; await image.decode();
  const surface = document.createElement('canvas'); surface.width = image.width; surface.height = image.height;
  const ctx = surface.getContext('2d', { willReadFrequently: true })!; ctx.drawImage(image, 0, 0);
  return { width: image.width, height: image.height, data: new Uint8Array(ctx.getImageData(0, 0, image.width, image.height).data) };
}
function freshCanvas(): void { const next = canvas.cloneNode() as HTMLCanvasElement; canvas.replaceWith(next); canvas = next; }
function resize(): void {
  const rect = el('stage').getBoundingClientRect(); view.pixelRatio = Math.min(devicePixelRatio || 1, renderer instanceof CanvasRenderer ? 1 : 2);
  view.width = Math.max(1, Math.round(rect.width * view.pixelRatio)); view.height = Math.max(1, Math.round(rect.height * view.pixelRatio));

}
const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(el('stage')); resize();
const stageSamples = Array.from({length:4},()=>new Float64Array(120));
const cpuSamples = new Float64Array(120); let sampleCursor = 0, sampleCount = 0;
function loop(now: number): void {
  const cpuStart = performance.now();
  const elapsed = last ? (now - last) / 1000 : 0;
  const dt = Math.min(elapsed, .1); last = now;
  let dx = Number(keys.has('arrowright') || keys.has('d')) - Number(keys.has('arrowleft') || keys.has('a'));
  let dy = Number(keys.has('arrowdown') || keys.has('s')) - Number(keys.has('arrowup') || keys.has('w'));
  const norm = Math.hypot(dx, dy); if (norm) { dx /= norm; dy /= norm; drift = false; }
  const speed = (keys.has('shift') ? 850 : 240) * view.pixelRatio;
  const targetX = norm ? dx * speed : drift && !paused ? 16 * view.pixelRatio : 0;
  const targetY = norm ? dy * speed : 0;
  cameraVX = ease(cameraVX, targetX, .18, dt); cameraVY = ease(cameraVY, targetY, .18, dt);
  if (!paused || norm) panCamera(view, cameraVX * dt, cameraVY * dt);
  world.ensure(cameraBounds(view));
  const streamed = performance.now();
  if (!paused && !document.hidden) clock.advance(dt, step => world.update(step));
  const simulated = performance.now();
  const frame = composeInfinite(world, atlas, view, clock.alpha);
  const composed = performance.now();
  renderer.render(frame);
  const submitted = performance.now();
  [streamed-cpuStart, simulated-streamed, composed-simulated, submitted-composed].forEach((value,i)=>stageSamples[i]![sampleCursor%120]=value);
  audioElapsed+=dt;if(audioElapsed>=.1){updateAudio(audioElapsed);audioElapsed=0;}
  cpuSamples[sampleCursor++ % cpuSamples.length] = performance.now() - cpuStart; sampleCount = Math.min(sampleCount + 1, cpuSamples.length);
  frameCount++; fpsElapsed += elapsed;
  if (fpsElapsed >= .5) { el('fps').textContent = String(Math.round(frameCount / fpsElapsed)); el('draws').textContent = String(frame.commands.length); el('cpu').textContent = cpuSamples.slice(0, sampleCount).sort()[Math.floor(sampleCount * .95)]!.toFixed(1); ['stream-cpu','sim-cpu','compose-cpu','render-cpu'].forEach((id,i)=>el(id).textContent=stageSamples[i]!.slice(0,sampleCount).sort()[Math.floor(sampleCount*.95)]!.toFixed(1)); updateStats(frame.commands.length); frameCount = 0; fpsElapsed = 0; }
  requestAnimationFrame(loop);
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
  el('coordinates').textContent = `${view.cameraX.toFixed(1)}, ${view.cameraY.toFixed(1)}`;
  el('habitat-caption').textContent = TERRAIN_NAMES[landscape(view.cameraX, view.cameraY, world.seed,world.settings).kind]!;
}
async function start(): Promise<void> {
  const pixels = await loadAtlas();
  try { if (params.get('renderer') === 'canvas') throw new Error('Canvas requested'); renderer = new WebGLRenderer(canvas, pixels); }
  catch { freshCanvas(); renderer = new CanvasRenderer(canvas, pixels); }
  resize(); bindCanvas();
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault(); renderer.dispose(); freshCanvas(); bindCanvas(); renderer = new CanvasRenderer(canvas, pixels); resize();
    el('renderer').textContent = renderer.name; announce('Graphics context lost. Continued with Canvas rendering.');
  });
  el('renderer').textContent = renderer.name; el('loading').hidden = true; syncUI(); requestAnimationFrame(loop);
}
start().catch(error => { console.error(error); el('loading').removeAttribute('data-ui');el('loading').inert=false;el('loading').hidden=false; el('loading').textContent = 'The jungle could not load. Run npm run build, then refresh.'; });
