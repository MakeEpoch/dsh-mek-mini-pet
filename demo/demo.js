import { createPet } from '../src/index.js';
const log = document.querySelector('#event-text');
const pet = createPet({ storageKey: 'dsh.mini-pet.demo.v1', onOpenTask: task => {
  log.textContent = `点击了「${task.title}」 · 正式接入时由宿主打开对应任务`;
} });
window.demoPet = pet;
const stage = document.querySelector('#stage');
function center() {
  const rect = stage.getBoundingClientRect();
  pet.element.setPosition(rect.left + rect.width / 2 - 134, rect.top - 8);
}
// Demo always starts visible in its stage; embedded integrations restore their position.
pet.show();
pet.configure({ size: 'large' });
center();
for (const button of document.querySelectorAll('.swatches [data-theme]')) button.setAttribute('aria-pressed', String(button.dataset.theme === pet.element.preferences.theme));
document.querySelector('#reset').onclick = () => { pet.show(); center(); };
document.querySelector('#wake').onclick = () => { pet.show(); };
document.querySelector('#pat').onclick = () => pet.element.pat();
const examples = {
  working: ['正在整理你的工作区', '先把零散的小事，一件件理清楚。'],
  waiting: ['有一个选择需要你决定', '准备好了，点击这里查看任务。'],
  success: ['工作区整理完成', '事情做完啦，给自己一点小奖励。'],
  error: ['连接暂时没有成功', '可以打开任务，看看具体原因。']
};
for (const button of document.querySelectorAll('.states [data-state]')) button.onclick = () => {
  const status = button.dataset.state;
  if (status === 'idle') pet.clearTasks();
  else pet.updateTask({ id: 'demo-task', status, title: examples[status][0], message: examples[status][1] });
  for (const sibling of document.querySelectorAll('.states [data-state]')) sibling.setAttribute('aria-pressed', String(sibling === button));
  log.textContent = status === 'idle' ? '演示模式 · 已回到待命状态' : `演示事件 · task:${status} → ${examples[status][0]}`;
};
for (const button of document.querySelectorAll('.swatches [data-theme]')) button.onclick = () => {
  pet.configure({ theme: button.dataset.theme });
  for (const sibling of document.querySelectorAll('.swatches [data-theme]')) sibling.setAttribute('aria-pressed', String(sibling === button));
};
pet.element.addEventListener('dsh-pet:pat', () => { log.textContent = `${pet.element.character.name}收到你的摸摸了 ♡`; });

document.querySelector('#settings').onclick = () => pet.openSettings();
