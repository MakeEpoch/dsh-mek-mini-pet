import test from 'node:test';
import assert from 'node:assert/strict';
import { SpritePlayer } from '../src/sprite.js';
import { validateOptions } from '../src/characters.js';
test('sprite cadence advances frames and stops during reduced motion or teardown', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const element = { style: {}, dataset: {} }; const player = new SpritePlayer(element);
  player.play({ row: 7, frames: 6, speed: 1 });
  assert.equal(element.dataset.row, '7'); assert.equal(element.dataset.frame, '0');
  t.mock.timers.tick(121); assert.equal(element.dataset.frame, '1');
  player.play({ row: 7, frames: 6, paused: true });
  t.mock.timers.tick(1000); assert.equal(element.dataset.frame, '0');
  player.play({ row: 9, frames: 1, column: 4 });
  assert.equal(element.dataset.frame, '4'); assert.equal(element.style.backgroundPosition, `${4 / 7 * 100}% 90%`);
  player.play({ row: 3, frames: 4 }); t.mock.timers.tick(121);
  player.stop(); const last = element.dataset.frame;
  t.mock.timers.tick(1000); assert.equal(element.dataset.frame, last);
});
test('invalid settings are rejected as a whole before changing pet preferences', () => {
  for (const bad of [{ character: 'missing' }, { speed: 2 }, { interactions: 'yes' }, { theme: '__proto__' }, { locked: null }]) assert.throws(() => validateOptions(bad));
  assert.doesNotThrow(() => validateOptions({ character: 'dousha', still: true, speed: 0.75, locked: true }));
});

test('animation timer faults stop the player and notify its local boundary once', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const element = { style: {}, dataset: {} }, failures = [];
  const player = new SpritePlayer(element, error => failures.push(error.message));
  player.play({ frames: 6 });
  Object.defineProperty(element.style, 'backgroundPosition', { set() { throw new Error('frame render failed'); } });
  assert.doesNotThrow(() => t.mock.timers.tick(121));
  assert.deepEqual(failures, ['frame render failed']);
  t.mock.timers.tick(1000); assert.equal(failures.length, 1);
});
