import test from 'node:test';
import assert from 'node:assert/strict';
import { PetState, clampPosition } from '../src/state.js';
test('concurrent tasks keep errors and input requests visible ahead of work and completion', () => {
  const model = new PetState();
  model.update({ id: 'a', status: 'working' });
  model.update({ id: 'b', status: 'waiting' });
  model.update({ id: 'c', status: 'success' });
  assert.equal(model.snapshot().task.id, 'b');
  model.update({ id: 'a', status: 'error' });
  assert.equal(model.snapshot().task.id, 'a');
  model.remove('a'); assert.equal(model.snapshot().status, 'waiting');
  model.remove('b'); assert.equal(model.snapshot().status, 'success');
  model.clear(); assert.deepEqual(model.snapshot(), { status: 'idle', task: null, tasks: [] });
});
test('newest update wins ties, task payloads are copied, and snapshots cannot mutate internal state', () => {
  const model = new PetState();
  const task = { id: 'a', status: 'working', title: 'original' };
  model.update(task); task.title = 'changed';
  model.update({ id: 'b', status: 'working' });
  assert.equal(model.snapshot().task.id, 'b');
  model.update({ id: 'a', status: 'working' });
  const snapshot = model.snapshot();
  assert.equal(snapshot.task.id, 'a');
  assert.throws(() => { snapshot.task.status = 'success'; });
  snapshot.tasks.pop(); assert.equal(model.snapshot().tasks.length, 2);
});
test('invalid or excessive task events fail without changing state', () => {
  const model = new PetState();
  for (const bad of [null, {}, { id: ' ', status: 'working' }, { id: 'x', status: 'idle' }, { id: 'x', status: '__proto__' }]) assert.throws(() => model.update(bad));
  for (let i = 0; i < 100; i++) model.update({ id: String(i), status: 'working', message: 'a'.repeat(1000) });
  assert.equal(model.snapshot().task.message.length, 180);
  assert.throws(() => model.update({ id: 'overflow', status: 'working' }), RangeError);
  model.update({ id: '0', status: 'success' });
  assert.equal(model.snapshot().tasks.length, 100);
});
test('drag positions stay in resized and smaller viewports; malformed preferences recover', () => {
  const viewport = { width: 900, height: 700 }, size = { width: 268, height: 311 };
  assert.deepEqual(clampPosition({ x: 2000, y: -10 }, viewport, size), { x: 632, y: 0 });
  assert.deepEqual(clampPosition({ x: NaN, y: 'oops' }, viewport, size), { x: 608, y: 365 });
  assert.deepEqual(clampPosition({ x: 900, y: 700 }, { width: 200, height: 200 }, size), { x: 0, y: 0 });
});
