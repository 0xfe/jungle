import test from 'node:test';
import assert from 'node:assert/strict';
import { InteractionPause, PointerNavigation } from '../src/iso/navigation';
import { cameraScale, gestureCamera, type InfiniteView } from '../src/jungle/infinite-scene';
import { unproject } from '../src/iso/math';
import { TILE } from '../src/jungle/world';

test('drift resumes three seconds after the latest interaction, including a long stationary hold', () => {
  const pause = new InteractionPause(3);
  assert.equal(pause.blocked(0), false);
  pause.touch(1);
  assert.equal(pause.blocked(3.99), true);
  pause.touch(3.5);
  assert.equal(pause.blocked(6.49), true);
  assert.equal(pause.blocked(6.5), false);
  assert.equal(pause.blocked(20, true), true);
  assert.equal(pause.blocked(40, true), true);
  pause.touch(40.1); // pointer/key release starts a full delay
  assert.equal(pause.blocked(43.09), true);
  assert.equal(pause.blocked(43.1), false);
});

test('one-to-two-to-one pointer transitions do not jump and extra fingers are ignored', () => {
  const nav = new PointerNavigation();
  nav.begin(1, { x: 100, y: 100 });
  assert.deepEqual(nav.move(1, { x: 110, y: 100 }), { from: { x: 100, y: 100 }, to: { x: 110, y: 100 }, zoomRatio: 1 });
  nav.begin(2, { x: 210, y: 100 });
  assert.equal(nav.begin(3, { x: 900, y: 900 }), false);
  assert.equal(nav.move(3, { x: 0, y: 0 }), undefined);
  assert.deepEqual(nav.move(2, { x: 310, y: 100 }), { from: { x: 160, y: 100 }, to: { x: 210, y: 100 }, zoomRatio: 2 });
  nav.end(1);
  assert.deepEqual(nav.move(2, { x: 315, y: 102 }), { from: { x: 310, y: 100 }, to: { x: 315, y: 102 }, zoomRatio: 1 });
  nav.end(2);
  assert.equal(nav.active, false);
});

test('cancellation and coincident fingers cannot leave stuck gestures or invalid zoom', () => {
  const nav = new PointerNavigation();
  nav.begin(1, { x: 0, y: 0 }); nav.begin(2, { x: 0, y: 0 });
  assert.equal(nav.move(2, { x: 100, y: 0 })!.zoomRatio, 1);
  assert.equal(nav.move(2, { x: 200, y: 0 })!.zoomRatio, 2);
  nav.end(2);
  assert.equal(nav.move(2, { x: 300, y: 0 }), undefined);
  nav.clear();
  assert.equal(nav.active, false);
  assert.equal(nav.move(1, { x: 20, y: 0 }), undefined);
  assert.equal(nav.begin(1, { x: 20, y: 0 }), true);
});

/** Ground-plane world point below a backing-pixel position, independent of the gesture implementation. */
function worldPoint(view: InfiniteView, p: { x: number; y: number }) {
  const scale = cameraScale(view);
  const delta = unproject({ x: (p.x - view.width / 2) / scale, y: (p.y - view.height / 2) / scale }, TILE);
  return { x: view.cameraX + delta.x, y: view.cameraY + delta.y };
}
test('pinch keeps the world anchor beneath moving fingers at every DPR, limit and projection floor', () => {
  for (const pixelRatio of [1, 2]) for (const width of [390, 3200]) for (const zoomRatio of [.1, .8, 1, 1.3, 10]) {
    const view: InfiniteView = { width: width * pixelRatio, height: 844 * pixelRatio, pixelRatio, zoom: 1, grid: false, cameraX: -90.25, cameraY: -140.8 };
    const from = { x: 90 * pixelRatio, y: 300 * pixelRatio }, to = { x: 120 * pixelRatio, y: 340 * pixelRatio };
    const before = worldPoint(view, from);
    gestureCamera(view, { from, to, zoomRatio }, .65, 2.5);
    const after = worldPoint(view, to);
    assert.ok(Math.abs(before.x - after.x) < 1e-10 && Math.abs(before.y - after.y) < 1e-10);
    assert.equal(view.zoom, Math.max(.65, Math.min(2.5, zoomRatio)));
  }
});

test('pinching back in responds immediately after hitting the zoom limit', () => {
  const nav = new PointerNavigation();
  const view: InfiniteView = { width: 390, height: 844, pixelRatio: 1, zoom: 2.4, grid: false, cameraX: 0, cameraY: 0 };
  nav.begin(1, { x: 100, y: 100 }); nav.begin(2, { x: 200, y: 100 });
  gestureCamera(view, nav.move(2, { x: 300, y: 100 })!, .65, 2.5);
  assert.equal(view.zoom, 2.5);
  gestureCamera(view, nav.move(2, { x: 280, y: 100 })!, .65, 2.5);
  assert.equal(view.zoom, 2.25);
});

test('touch taps distinguish single and double taps from drags, pinches and long presses',async()=>{
 const {TouchTaps}=await import('../src/iso/navigation'),tap=new TouchTaps(),p={x:100,y:100};
 tap.begin(1,p,0);assert.equal(tap.end(1,80),1);
 tap.begin(2,{x:105,y:99},160);assert.equal(tap.end(2,240),2);
 // Pointer capture release after a successful tap must not erase the pair.
 tap.begin(3,p,500);assert.equal(tap.end(3,550),1);tap.cancel(3);
 tap.begin(4,p,620);assert.equal(tap.end(4,670),2);
 tap.begin(5,p,800);tap.move(5,{x:115,y:100});assert.equal(tap.end(5,850),0);
 tap.begin(6,p,900);assert.equal(tap.end(6,950),1);
 tap.clear();tap.begin(1,p,1000);tap.begin(2,p,1010);assert.equal(tap.end(1,1050),0);assert.equal(tap.end(2,1080),0);
 tap.begin(3,p,1150);assert.equal(tap.end(3,1200),1);
 tap.clear();tap.begin(4,p,1300);assert.equal(tap.end(4,1700),0);
 tap.begin(5,p,1800);assert.equal(tap.end(5,1850),1);
 tap.begin(6,{x:300,y:100},1900);assert.equal(tap.end(6,1950),1);
 tap.begin(7,p,2100);tap.cancel(7);assert.equal(tap.end(7,2150),0);
 tap.begin(8,p,2200);assert.equal(tap.end(8,2250),1);
});
