import test from 'node:test';
import assert from 'node:assert/strict';
import { startupSeed } from '../src/platform';

test('ordinary loads request fresh entropy and malformed URL seeds do not pin a world', () => {
  let next = 100;
  const fresh = () => next++;
  assert.equal(startupSeed(null, fresh), 100);
  assert.equal(startupSeed(null, fresh), 101);
  for (const parameter of ['', ' ', 'nope', 'NaN', 'Infinity', '1.5', '9007199254740992']) {
    const expected = next;
    assert.equal(startupSeed(parameter, fresh), expected);
    assert.equal(next, expected + 1);
  }
});

test('explicit seeds preserve zero and unsigned normalization without requesting entropy', () => {
  const unused = () => { throw new Error('An explicit seed must not request entropy'); };
  for (const [parameter, expected] of [['0', 0], ['42', 42], [' 42 ', 42], ['-1', 4294967295], ['4294967296', 0]] as const) {
    assert.equal(startupSeed(parameter, unused), expected);
    assert.equal(startupSeed(parameter, unused), expected);
  }
  assert.equal(startupSeed(null, () => 2718), 2718);
});
