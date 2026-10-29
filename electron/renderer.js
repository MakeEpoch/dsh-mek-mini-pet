import { createPet } from '../src/index.js';
const bridge = window.dshPetDesktop;
const pet = createPet({ storageKey: 'dsh.mini-pet.desktop.v1', onOpenTask: task => bridge.openTask(task.id) });
pet.element.setAttribute('native', '');
pet.show();
// Native movement uses the labelled drag handle; keyboard movement remains available.
const button = pet.element.shadowRoot.querySelector('.pet');
button.style.touchAction = 'auto';
button.setAttribute('aria-label', '摸摸宠物；使用顶部拖动条移动桌面窗口，方向键微调');
button.addEventListener('keydown', event => {
  const delta = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[event.key];
  if (delta) bridge.move(...delta);
});
pet.element.shadowRoot.querySelector('.tuck').addEventListener('click', () => bridge.hide());
const unsubscribe = bridge.subscribe(({ type, payload }) => {
  if (type === 'tasks') { pet.clearTasks(); for (const task of payload) pet.updateTask(task); }
  if (type === 'configure') pet.configure(payload);
  if (type === 'show') pet.show();
});
window.addEventListener('unload', () => { unsubscribe(); pet.destroy(); }, { once: true });
bridge.ready();
