import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import adapter from '../electron/main.cjs';
function fixture() {
  const ipcMain = new EventEmitter(); let window;
  class BrowserWindow extends EventEmitter {
    constructor(options) { super(); this.options = options; this.destroyed = false; this.visible = false; this.bounds = options; this.sent = []; this.webContents = new EventEmitter(); this.webContents.mainFrame = {}; this.webContents.send = (...args) => this.sent.push(args); this.webContents.setWindowOpenHandler = fn => { this.openHandler = fn; }; window = this; }
    loadFile() { return Promise.resolve(); }
    isDestroyed() { return this.destroyed; }
    showInactive() { this.visible = true; }
    hide() { this.visible = false; }
    getBounds() { return this.bounds; }
    setBounds(bounds) { this.bounds = bounds; }
    destroy() { this.destroyed = true; this.emit('closed'); }
  }
  const workArea = { x: 0, y: 0, width: 1920, height: 1080 };
  const screen = { getPrimaryDisplay: () => ({ workArea }), getDisplayMatching: () => ({ workArea }) };
  const opened = [];
  const pet = adapter.createDesktopPet({ BrowserWindow, ipcMain, screen }, { onOpenTask: task => opened.push(task) });
  const channel = ipcMain.eventNames()[0];
  const emit = (message, event = { sender: window.webContents, senderFrame: window.webContents.mainFrame }) => ipcMain.emit(channel, event, message);
  return { pet, window, ipcMain, emit, opened, channel };
}
test('desktop queues tasks before renderer readiness, validates sender and task actions', () => {
  const { pet, window, emit, opened } = fixture();
  pet.updateTask({ id: 'a', status: 'working' });
  assert.equal(window.sent.length, 0);
  emit({ type: 'ready' }, { sender: {}, senderFrame: {} }); assert.equal(window.sent.length, 0);
  emit({ type: 'ready' }); assert.equal(window.visible, true);
  assert.equal(window.sent.at(-1)[1].payload[0].id, 'a');
  emit({ type: 'open-task', id: 'missing' }); assert.equal(opened.length, 0);
  emit({ type: 'open-task', id: 'a' }); assert.equal(opened[0].id, 'a');
  emit({ type: 'hide' }); assert.equal(window.visible, false);
  pet.show(); assert.equal(window.visible, true);
  assert.deepEqual(window.openHandler({ url: 'https://example.com' }), { action: 'deny' });
  pet.destroy();
});
test('desktop update order, size validation, position bounds and teardown', () => {
  const { pet, window, emit, ipcMain, channel } = fixture();
  pet.updateTask({ id: 'a', status: 'working' }); pet.updateTask({ id: 'b', status: 'working' }); pet.updateTask({ id: 'a', status: 'waiting' });
  pet.hide(); emit({ type: 'ready' }); assert.equal(window.visible, false);
  assert.deepEqual(window.sent.at(-1)[1].payload.map(t => t.id), ['b', 'a']);
  assert.throws(() => pet.configure({ theme: 'invalid' }));
  assert.throws(() => pet.updateTask({ id: 'x', status: 'invalid' }));
  emit({ type: 'move', dx: 1e9, dy: 1e9 });
  assert.ok(window.bounds.x + window.bounds.width <= 1920);
  assert.ok(window.bounds.y + window.bounds.height <= 1080);
  assert.equal(window.options.webPreferences.nodeIntegration, false);
  assert.equal(window.options.webPreferences.contextIsolation, true);
  assert.equal(window.options.webPreferences.sandbox, true);
  pet.destroy(); pet.destroy();
  assert.equal(ipcMain.listenerCount(channel), 0);
});
