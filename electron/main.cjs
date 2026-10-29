const path = require('node:path');
const { randomUUID } = require('node:crypto');

// Electron is supplied by the host, so the web package has no runtime dependencies.
exports.createDesktopPet = function createDesktopPet({ BrowserWindow, ipcMain, screen }, { onOpenTask, ...options } = {}) {
  const channel = `dsh-pet:${randomUUID()}`;
  const area = screen.getPrimaryDisplay().workArea;
  const width = 290, height = 390;
  const win = new BrowserWindow({
    width, height, x: area.x + Math.max(0, area.width - width - 24), y: area.y + Math.max(0, area.height - height - 24),
    frame: false, transparent: true, alwaysOnTop: true, resizable: false, skipTaskbar: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true,
      additionalArguments: [`--dsh-pet-channel=${channel}`] }
  });
  let tasks = new Map(), ready = false, shouldShow = true, disposed = false;
  let preferences = { theme: options.theme ?? 'mint', size: options.size ?? 'medium' };
  const validOptions = data => ['mint', 'peach', 'lilac'].includes(data.theme) && ['mini', 'tiny', 'small', 'medium', 'large'].includes(data.size);
  if (!validOptions(preferences)) { win.destroy(); throw new TypeError('Invalid pet theme or size'); }
  const send = (type, payload) => { if (ready && !win.isDestroyed()) win.webContents.send(channel, { type, payload }); };
  const receive = (event, message) => {
    if (event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || !message) return;
    if (message.type === 'ready') {
      ready = true; send('configure', preferences); send('tasks', [...tasks.values()]);
      if (shouldShow) win.showInactive();
    }
    if (message.type === 'hide') { shouldShow = false; win.hide(); }
    if (message.type === 'open-task' && typeof message.id === 'string' && tasks.has(message.id)) onOpenTask?.({ ...tasks.get(message.id) });
    if (message.type === 'move' && Number.isFinite(message.dx) && Number.isFinite(message.dy)) {
      const bounds = win.getBounds();
      const target = { x: bounds.x + Math.max(-100, Math.min(100, Math.round(message.dx))), y: bounds.y + Math.max(-100, Math.min(100, Math.round(message.dy))), width, height };
      const work = screen.getDisplayMatching(target).workArea;
      target.x = Math.max(work.x, Math.min(target.x, work.x + Math.max(0, work.width - width)));
      target.y = Math.max(work.y, Math.min(target.y, work.y + Math.max(0, work.height - height)));
      win.setBounds(target);
    }
  };
  ipcMain.on(channel, receive);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  const readyPromise = win.loadFile(path.join(__dirname, 'pet.html'));
  // Caller can await pet.ready to surface loading failures.
  readyPromise.catch(() => {});
  const dispose = () => { if (disposed) return; disposed = true; ready = false; ipcMain.removeListener(channel, receive); tasks.clear(); };
  win.on('closed', dispose);
  return {
    window: win, ready: readyPromise,
    updateTask(task) {
      if (!task || typeof task.id !== 'string' || !task.id.trim() || task.id.length > 128 || !['working', 'waiting', 'success', 'error', 'review'].includes(task.status)) throw new TypeError('Invalid task');
      if (tasks.size >= 100 && !tasks.has(task.id)) throw new RangeError('Too many tasks');
      tasks.delete(task.id);
      tasks.set(task.id, { id: task.id, status: task.status, title: String(task.title ?? '当前任务').slice(0, 100), message: task.message == null ? undefined : String(task.message).slice(0, 180), revision: String(task.revision ?? '').slice(0, 128) });
      send('tasks', [...tasks.values()]);
    },
    removeTask(id) { tasks.delete(id); send('tasks', [...tasks.values()]); },
    clearTasks() { tasks.clear(); send('tasks', []); },
    configure(next) { const value = { ...preferences, ...next }; if (!validOptions(value)) throw new TypeError('Invalid pet options'); preferences = value; send('configure', preferences); },
    show() { shouldShow = true; if (ready && !win.isDestroyed()) { send('show'); win.showInactive(); } },
    hide() { shouldShow = false; if (!win.isDestroyed()) win.hide(); },
    destroy() { dispose(); if (!win.isDestroyed()) win.destroy(); }
  };
};
