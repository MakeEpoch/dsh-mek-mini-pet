import test from 'node:test';
import assert from 'node:assert/strict';
import { createIsolation } from '../dsh/isolation.js';

test('failure releases every owned resource, stops callbacks, and never escapes to the host', () => {
  const released = [], reports = [];
  const scope = createIsolation((phase, error) => reports.push([phase, error.message]));
  scope.own(() => released.push('pet'));
  scope.own(() => { released.push('observer'); throw new Error('cleanup failed'); });
  scope.own(() => released.push('sessions'));
  let calls = 0;
  const callback = scope.guard('update', () => { calls++; throw new Error('bad task'); });
  assert.doesNotThrow(callback); assert.doesNotThrow(callback);
  assert.equal(calls, 1); assert.equal(scope.stopped, true);
  assert.deepEqual(released, ['sessions', 'observer', 'pet']);
  assert.deepEqual(reports, [['cleanup', 'cleanup failed'], ['update', 'bad task']]);
  scope.own(() => released.push('late resource')); scope.dispose();
  assert.deepEqual(released, ['sessions', 'observer', 'pet', 'late resource']);
});

test('rejected navigation promises and failing diagnostics stay within the boundary', async () => {
  let released = 0;
  const scope = createIsolation(() => { throw new Error('logger unavailable'); });
  scope.own(() => released++);
  await assert.doesNotReject(scope.guard('navigation', () => Promise.reject(new Error('offline')))());
  assert.equal(scope.stopped, true); assert.equal(released, 1);
});
