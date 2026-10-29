import test from 'node:test';
import assert from 'node:assert/strict';
import { watchSessions } from '../dsh/sessions.js';
function observable(value) {
  const listeners = new Set();
  return { getSnapshot: () => value, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    set(next) { value = next; for (const fn of [...listeners]) fn(); }, count: () => listeners.size };
}
function setup() {
  const list = observable({ phase: 'ready', ids: ['a'], byId: { a: { displayTitle: '会话 A' } } });
  const statuses = observable(new Map([['a', { running: false }]]));
  const face = observable({ lastAgentError: null, promptError: null, openState: 'open' });
  const bindings = new Map([['a', { session: face }]]);
  let tasks;
  const watcher = watchSessions({ sessions: { list, binding: id => bindings.get(id) }, statuses, publish: next => { tasks = next; } });
  return { list, statuses, face, bindings, watcher, tasks: () => tasks };
}
test('dsh baseline never invents completion; running-to-stopped uses review, not success', () => {
  const s = setup(); assert.deepEqual(s.tasks(), []);
  s.statuses.set(new Map([['a', { running: true }]])); assert.equal(s.tasks()[0].status, 'working');
  s.statuses.set(new Map([['a', { running: false }]])); assert.equal(s.tasks()[0].status, 'review');
  s.watcher.acknowledge('a'); assert.deepEqual(s.tasks(), []);
  s.statuses.set(new Map([['a', { running: true }]]));
  s.statuses.set(new Map([['a', { running: false }]])); assert.equal(s.tasks()[0].status, 'review');
  s.watcher.dispose();
});
test('dsh pending interactions and actual borrowed-session failures override running', () => {
  const s = setup();
  s.statuses.set(new Map([['a', { running: true, pendingInteraction: { kind: 'approval', key: '1' } }]]));
  assert.equal(s.tasks()[0].status, 'waiting');
  s.face.set({ lastAgentError: 'sensitive error details', openState: 'open' });
  assert.equal(s.tasks()[0].status, 'error'); assert.ok(!s.tasks()[0].message.includes('sensitive'));
  s.watcher.dispose(); assert.equal(s.list.count(), 0); assert.equal(s.statuses.count(), 0); assert.equal(s.face.count(), 0);
});
test('dsh drops missing references, prunes deleted rows and ignores subagent fallback running', () => {
  const s = setup();
  s.list.set({ phase: 'ready', ids: ['a', 'b'], byId: { a: { displayTitle: 'A' }, b: { origin: 'subagent', parentId: 'a' } } });
  s.statuses.set(new Map([['a', { running: undefined }], ['b', { running: true }]]));
  assert.deepEqual(s.tasks(), []);
  s.bindings.delete('a'); s.list.set({ phase: 'ready', ids: [], byId: {} }); s.statuses.set(new Map());
  assert.deepEqual(s.tasks(), []); assert.equal(s.face.count(), 0);
  s.watcher.dispose(); s.watcher.dispose();
});
test('dsh caps the display without hiding high-priority interactions', () => {
  const list = observable({ phase: 'ready', ids: [], byId: {} });
  const states = new Map(Array.from({ length: 110 }, (_, i) => [String(i), { running: true }]));
  states.set('attention', { running: true, pendingInteraction: { kind: 'question' } });
  const statuses = observable(states); let tasks;
  const watcher = watchSessions({ sessions: { list, binding: () => undefined }, statuses, publish: value => { tasks = value; } });
  assert.equal(tasks.length, 100); assert.equal(tasks[0].id, 'attention'); watcher.dispose();
});
test('new messages advance revisions once per message, without treating history loads or streaming chunks as new messages', () => {
  const s = setup();
  const events = observable({ change: { kind: 'replace', entries: [] } });
  s.bindings.get('a').eventSource = events;
  s.list.set(s.list.getSnapshot());
  s.statuses.set(new Map([['a', { running: true }]]));
  const baseline = s.tasks()[0].revision;
  const chunk = { type: 'transient', event: { type: 'assistant/live-chunk', data: { attemptId: 'reply-1' } } };
  events.set({ change: { kind: 'append', entries: [chunk] } });
  const firstMessage = s.tasks()[0].revision;
  assert.notEqual(firstMessage, baseline);
  events.set({ change: { kind: 'append', entries: [chunk] } });
  assert.equal(s.tasks()[0].revision, firstMessage, 'the next token is part of the same message');
  events.set({ change: { kind: 'prepend', entries: [{ event: { type: 'user/message', seq: 1 } }] } });
  assert.equal(s.tasks()[0].revision, firstMessage, 'reading older history must not reopen the bubble');
  events.set({ change: { kind: 'settle-assistant', attemptId: 'reply-1', entry: { type: 'event', event: { type: 'assistant/message', seq: 20 } } } });
  assert.equal(s.tasks()[0].revision, firstMessage);
  events.set({ change: { kind: 'append', entries: [{ event: { type: 'user/message', seq: 21 } }] } });
  assert.notEqual(s.tasks()[0].revision, firstMessage);
  s.watcher.dispose(); assert.equal(events.count(), 0); assert.equal(s.face.count(), 0);
});
test('an incoming message on an idle retained session creates a review reminder', () => {
  const s = setup(); const events = observable({ change: { kind: 'replace', entries: [] } });
  s.bindings.get('a').eventSource = events; s.list.set(s.list.getSnapshot());
  events.set({ change: { kind: 'append', entries: [{ event: { type: 'assistant/message', seq: 10 } }] } });
  assert.equal(s.tasks()[0].status, 'review');
  s.watcher.acknowledge('a'); assert.deepEqual(s.tasks(), []); s.watcher.dispose();
});

test('startup subscription failure releases subscriptions already installed', () => {
  const list = observable({ ids: [] }); let failure;
  const watcher = watchSessions({ sessions: { list }, statuses: { subscribe() { throw new Error('status source unavailable'); } },
    publish() {}, onError: error => { failure = error; } });
  assert.match(failure.message, /status source/); assert.equal(list.count(), 0); watcher.dispose();
});

test('runtime publish failure cannot escape a host source callback and releases all subscriptions', () => {
  const list = observable({ ids: ['a'], byId: {} }), statuses = observable(new Map());
  const face = observable({}), events = observable({ change: {} });
  let failPublish = false, failure;
  const watcher = watchSessions({ sessions: { list, binding: () => ({ session: face, eventSource: events }) }, statuses,
    publish() { if (failPublish) throw new Error('render failed'); }, onError: error => { failure = error; } });
  failPublish = true;
  assert.doesNotThrow(() => statuses.set(new Map([['a', { running: true }]])));
  assert.match(failure.message, /render failed/);
  assert.deepEqual([list.count(), statuses.count(), face.count(), events.count()], [0, 0, 0, 0]); watcher.dispose();
});

test('event subscription setup failure releases the borrowed session listener', () => {
  const list = observable({ ids: ['a'] }), statuses = observable(new Map()), face = observable({}); let failures = 0;
  watchSessions({ sessions: { list, binding: () => ({ session: face, eventSource: { subscribe() { throw new Error('unsupported event source'); } } }) },
    statuses, publish() {}, onError() { failures++; } });
  assert.equal(failures, 1); assert.deepEqual([list.count(), statuses.count(), face.count()], [0, 0, 0]);
});
