const { contextBridge, ipcRenderer } = require('electron');
const channel = process.argv.find(arg => arg.startsWith('--dsh-pet-channel='))?.slice('--dsh-pet-channel='.length);
if (channel) contextBridge.exposeInMainWorld('dshPetDesktop', {
  ready: () => ipcRenderer.send(channel, { type: 'ready' }),
  hide: () => ipcRenderer.send(channel, { type: 'hide' }),
  openTask: id => ipcRenderer.send(channel, { type: 'open-task', id }),
  move: (dx, dy) => ipcRenderer.send(channel, { type: 'move', dx, dy }),
  subscribe: callback => {
    const listener = (_event, message) => callback(message);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  }
});
