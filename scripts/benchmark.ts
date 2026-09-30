import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { InfiniteWorld } from '../src/jungle/infinite';
import { cameraBounds, composeInfinite } from '../src/jungle/infinite-scene';
import { TerrainKind } from '../src/jungle/terrain';
import type { AtlasManifest } from '../src/jungle/scene';
import { writeQuads } from '../src/iso/batch';
const atlas: AtlasManifest = JSON.parse(await readFile('public/assets/jungle.json', 'utf8'));
const results = [];
const stats = (values: number[]) => { values.sort((a, b) => a - b); return { median: +values[Math.floor(values.length * .5)]!.toFixed(3), p95: +values[Math.floor(values.length * .95)]!.toFixed(3), max: +values.at(-1)!.toFixed(3) }; };
for (const scenario of ['forest', 'outer-forest', 'wide-rain', 'travel', 'volcano'] as const) {
  const world = new InfiniteWorld(), start = scenario==='volcano'?world.volcanoLandmark():world.landmark(TerrainKind.Forest,scenario==='outer-forest'||scenario==='wide-rain'?64:0,0);
  if (scenario === 'wide-rain') world.weather = 'rain';
  const view = { width: 1440, height: 900, pixelRatio: 1, zoom: scenario === 'wide-rain' ? .65 : 1, grid: false, cameraX: start.x, cameraY: start.y };
  let buffer = new Float32Array(0), quads = 0;
  const stream: number[] = [], simulation: number[] = [], composition: number[] = [], encoding: number[] = [];
  for (let frame = 0; frame < 480; frame++) {
    if (scenario === 'travel') view.cameraX += .15;
    const t0 = performance.now(); world.ensure(cameraBounds(view)); const t1 = performance.now();
    world.update(1 / 60); const t2 = performance.now();
    const scene = composeInfinite(world, atlas, view, .5); const t3 = performance.now();
    if (buffer.length < scene.commands.length * 48) buffer = new Float32Array(scene.commands.length * 96);
    writeQuads(scene.commands, atlas.width, atlas.height, buffer); const t4 = performance.now();
    quads = Math.max(quads, scene.commands.length);
    if (frame >= 120) { stream.push(t1 - t0); simulation.push(t2 - t1); composition.push(t3 - t2); encoding.push(t4 - t3); }
  }
  results.push({ scenario, ...world.stats, maxVisibleQuads: quads, streamingMs: stats(stream), simulationMs: stats(simulation), compositionMs: stats(composition), quadEncodingMs: stats(encoding) });
}
console.table(results.map(r => ({ scenario: r.scenario, tiles: r.active, agents: r.agents, quads: r.maxVisibleQuads,
  'stream p95 ms': r.streamingMs.p95, 'stream max ms': r.streamingMs.max, 'simulation p95 ms': r.simulationMs.p95,
  'compose p95 ms': r.compositionMs.p95, 'encode p95 ms': r.quadEncodingMs.p95, 'cache MiB': +(r.cachedBytes / 1048576).toFixed(3), expired: r.expired })));
console.log('CPU only; excludes pixel rasterization, GPU upload, browser scheduling and display. No machine-dependent pass threshold.');
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/benchmark.json', JSON.stringify({ node: process.version, platform: process.platform, arch: process.arch, results }, null, 2) + '\n');
