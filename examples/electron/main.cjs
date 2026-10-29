const { app, BrowserWindow, ipcMain, screen, Tray, Menu, nativeImage } = require('electron');
const { createDesktopPet } = require('../../electron/main.cjs');
let pet, tray;
app.whenReady().then(async () => {
  pet = createDesktopPet({ BrowserWindow, ipcMain, screen }, { onOpenTask: task => console.log('宿主收到打开任务请求：', task.id) });
  const image = nativeImage.createFromPath(require('node:path').join(__dirname, '../../electron/tray.png'));
  tray = new Tray(image);
  tray.setToolTip('豆沙 · dsh mini pet');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '唤醒豆沙', click: () => pet.show() },
    { label: '演示：工作中', click: () => pet.updateTask({ id: 'example', status: 'working', title: '正在整理工作区' }) },
    { label: '演示：需要你看看', click: () => pet.updateTask({ id: 'example', status: 'waiting', title: '请确认下一步' }) },
    { label: '演示：已完成', click: () => pet.updateTask({ id: 'example', status: 'success', title: '整理完成啦' }) },
    { label: '清空演示任务', click: () => pet.clearTasks() },
    { type: 'separator' }, { label: '退出', click: () => app.quit() }
  ]));
  tray.on('click', () => pet.show());
  await pet.ready;
}).catch(error => { console.error(error); app.quit(); });
app.on('before-quit', () => { pet?.destroy(); tray?.destroy(); });
app.on('window-all-closed', () => {});
app.on('activate', () => pet?.show());
