import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentSystem, SpeedMotor, type AgentEnvironment } from '../src/agents';
import { DeerAgent, PlantAgent, WaterAgent, MoteAgent, createPlant, jungleAgents } from '../src/jungle/agents';
import { DEER_RUN_STRIDE } from '../src/jungle/animation';
const environment: AgentEnvironment = { time: 0, canMove: () => true, nearby: () => [],
  sample: () => ({ moisture: .7, light: .8, wind: 1, elevation: 0, water: false }) };

test('every species survives a compact exact state round trip including RNG and motion history', () => {
  const agents = [new DeerAgent('deer', 3, 4, 981), new WaterAgent('pond', 1, 2), new MoteAgent('mote', 1, 2),
    ...Array.from({ length: 8 }, (_, i) => createPlant(i + 1, `plant-${i}`, i, 0, i * .15, .8))];
  for (let i = 0; i < 500; i++) for (const a of agents) a.update(1 / 60, environment);
  const bytes = jungleAgents.encode(agents), restored = jungleAgents.decode(bytes);
  assert.ok(bytes.length < 1200);
  assert.deepEqual(jungleAgents.encode(restored), bytes);
  assert.ok(restored[0] instanceof DeerAgent); assert.ok(restored[2] instanceof MoteAgent);
  for (let i = 0; i < 1000; i++) for (const [j, a] of agents.entries()) { a.update(1 / 60, environment); restored[j]!.update(1 / 60, environment); }
  assert.deepEqual(jungleAgents.encode(restored), jungleAgents.encode(agents));
  assert.throws(() => jungleAgents.decode(bytes.subarray(0, bytes.length - 1)), /Truncated/);
  const bad = bytes.slice(); bad[0] = 200; assert.throws(() => jungleAgents.decode(bad), /schema/);
});

test('agent random streams and snapshot perception are independent of update order', () => {
  const a = [new DeerAgent('a', 0, 0, 7), new DeerAgent('b', .2, 0, 9)], b = jungleAgents.decode(jungleAgents.encode(a));
  const first = new AgentSystem(), second = new AgentSystem();
  for (let i = 0; i < 3000; i++) { first.step(a, 1 / 60, environment); second.step([...b].reverse(), 1 / 60, environment); }
  assert.deepEqual(jungleAgents.encode(a), jungleAgents.encode(b));
});

test('running now covers substantial ground and plays over two strides per second with rounded acceleration', () => {
  const d = new DeerAgent('runner', 0, 0, 7);
  Object.assign(d, { state: 'run', heading: 0, target: { x: 10, y: 0 }, pace: 1, tripPace: 1, timer: 30, gait: 0, size: 1 });
  let lastAcceleration = 0;
  for (let i = 0; i < 180; i++) {
    d.update(1 / 60, environment);
    assert.ok(Math.abs(d.motor.acceleration - lastAcceleration) <= 22 / 60 + 1e-9);
    lastAcceleration = d.motor.acceleration;
  }
  assert.ok(d.x > 2.5 && d.x < 3.2, `covered ${d.x} tiles`);
  assert.ok(d.speed / DEER_RUN_STRIDE > 2.2);
  assert.ok(Math.abs(d.gait - d.x / DEER_RUN_STRIDE) < 1e-9);
  const early = new SpeedMotor(); const accelerations = [];
  for (let i = 0; i < 6; i++) { early.update(1, 1 / 60, 3.5, 22); accelerations.push(early.acceleration); }
  assert.ok(accelerations[0]! < accelerations[5]!); assert.ok(accelerations[0]! > 0);
});

test('neighbors alter deer alertness; local weather smoothly changes plant motion', () => {
  const deer = new DeerAgent('observer', 0, 0, 1); deer.timer = 0;
  deer.update(1 / 60, { ...environment, nearby: () => [{ id: 'runner', kind: 'deer', x: .5, y: 0, speed: 1 }] });
  assert.equal(deer.state, 'raise'); assert.equal(deer.alertness, .8);
  const plant = createPlant(2, 'palm', 0, 0, 0, 1); const before = plant.windRate;
  plant.update(1 / 60, { ...environment, sample: () => ({ ...environment.sample(0, 0), wind: 2 }) });
  assert.ok(plant.windRate > before && plant.windRate < 2 * plant.spec.windResponse);
  assert.equal(plant.x, 0); assert.equal(plant.y, 0); assert.ok(plant instanceof PlantAgent);
});
