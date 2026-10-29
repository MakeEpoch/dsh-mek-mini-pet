import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = process.env.DSH_PLAYWRIGHT_MODULE ? await import(process.env.DSH_PLAYWRIGHT_MODULE) : require('playwright')); }
catch { throw new Error('Install optional test tooling: npm install --no-save --package-lock=false playwright; or set DSH_PLAYWRIGHT_MODULE to its index.mjs'); }
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ['--no-sandbox'] });
const base = process.env.DSH_DEMO_URL || 'http://127.0.0.1:4173';
const errors = [];
try {
  await mkdir('artifacts', { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base); await page.locator('dsh-pet-v7 .pet').waitFor();
  const pet = page.locator('dsh-pet-v7');
  await page.mouse.move(0, 0);
  await pet.locator('.toolbar').waitFor({ state: 'hidden' });
  await pet.locator('.pet').hover();
  await pet.locator('.toolbar').waitFor({ state: 'visible' });
  await page.mouse.move(0, 0);
  await pet.locator('.toolbar').waitFor({ state: 'hidden' });
  await page.screenshot({ path: 'artifacts/demo-desktop.png', fullPage: true });
  for (const status of ['working', 'waiting', 'success', 'error', 'idle']) {
    await page.locator(`.states [data-state="${status}"]`).click();
    assert.equal(await pet.getAttribute('data-state'), status);
  }
  await page.locator('.swatches [data-theme="peach"]').click();
  assert.equal(await pet.evaluate(el => el.style.getPropertyValue('--pet-fill')), '#efd0b9');
  await pet.locator('.pet').focus();
  await pet.locator('.more').click();
  assert.equal(await pet.locator('.more').getAttribute('aria-expanded'), 'true');
  await pet.locator('dsh-pet-settings-v5 [data-character="dousha"]').click();
  await pet.locator('.theme').selectOption('lilac');
  await page.keyboard.press('Escape');
  await pet.locator('.pet').focus();
  await pet.locator('.tuck').click();
  assert.equal(await pet.locator('.dock').isVisible(), true);
  const dockStart = await pet.locator('.dock').boundingBox();
  await page.mouse.move(dockStart.x + 20, dockStart.y + 15);
  await page.mouse.down(); await page.mouse.move(dockStart.x - 70, dockStart.y + 65, { steps: 8 }); await page.mouse.up();
  assert.equal(await pet.locator('.dock').isVisible(), true, 'dragging the dock must not expand it');
  assert.ok((await pet.locator('.dock').boundingBox()).x < dockStart.x - 60);
  await pet.locator('.dock').focus(); await page.keyboard.press('ArrowDown');
  await page.evaluate(() => demoPet.element.setPosition(10000, 10000));
  const dockEdge = await pet.locator('.dock').boundingBox();
  assert.equal(Math.round(dockEdge.y + dockEdge.height), 1100, 'collapsed dock can reach the bottom edge');
  await pet.locator('.dock').click();
  assert.equal(await pet.locator('.pet').isVisible(), true);
  await page.evaluate(() => demoPet.element.setPosition(500, 200));
  const before = await pet.boundingBox();
  const body = await pet.locator('.pet').boundingBox();
  await page.mouse.move(body.x + body.width / 2, body.y + body.height / 2);
  await page.mouse.down(); await page.mouse.move(body.x + body.width / 2 + 70, body.y + body.height / 2 + 35, { steps: 8 }); await page.mouse.up();
  const after = await pet.boundingBox(); assert.ok(after.x > before.x + 50);
  assert.equal(await pet.getAttribute('data-emote'), null, 'dragging should not also pat');
  await pet.locator('.pet').focus(); await page.keyboard.press('ArrowLeft');
  assert.ok((await pet.boundingBox()).x < after.x);
  await pet.locator('.pat').click();
  assert.equal(await pet.locator('.interaction-feedback').isVisible(), false);
  assert.equal(await pet.locator('.pet .emote-badge').isVisible(), true, 'feedback remains visible with reduced motion');
  await pet.locator('.pet').focus(); await page.keyboard.press('Enter');
  assert.equal(await pet.locator('.interaction-feedback').isVisible(), false);
  await pet.locator('.pet').focus();
  await pet.locator('.more').click();
  await pet.locator('[data-setting="interactions"]').uncheck();
  assert.equal(await pet.locator('dsh-pet-settings-v5 [data-action="pat"]').isVisible(), false);
  await page.keyboard.press('Escape');
  await pet.locator('.pet').click();
  assert.equal(await pet.locator('.pat').isVisible(), false);
  assert.equal(await pet.locator('.pet .emote-badge').isVisible(), false);
  await pet.locator('.more').click();
  await pet.locator('[data-setting="interactions"]').check();
  await pet.locator('[data-setting="locked"]').check();
  await page.keyboard.press('Escape');
  const lockedPosition = await pet.boundingBox();
  await pet.locator('.pet').focus(); await page.keyboard.press('ArrowLeft');
  assert.equal((await pet.boundingBox()).x, lockedPosition.x);
  await page.evaluate(() => demoPet.configure({ locked: false }));
  await page.evaluate(() => {
    demoPet.updateTask({ id: 'background', status: 'working', title: '<img src=x onerror=alert(1)>' });
    demoPet.updateTask({ id: 'attention', status: 'waiting', title: '需要确认' });
    demoPet.updateTask({ id: 'finished', status: 'success', title: '另一个任务已完成' });
  });
  assert.equal(await pet.getAttribute('data-state'), 'waiting');
  const logBeforeClose = await page.locator('#event-text').innerText();
  await pet.locator('.bubble-close').click();
  assert.equal(await pet.locator('.bubble').isVisible(), false);
  assert.equal(await page.locator('#event-text').innerText(), logBeforeClose, 'closing the bubble must not open a task');
  await page.evaluate(() => demoPet.updateTask(demoPet.element.snapshot.task));
  assert.equal(await pet.locator('.bubble').isVisible(), false, 'identical task refresh must stay dismissed');
  await page.evaluate(() => demoPet.updateTask({ ...demoPet.element.snapshot.task, revision: 'new-message-1' }));
  assert.equal(await pet.locator('.bubble').isVisible(), true, 'a new message restores the bubble');
  await pet.locator('.bubble').click();
  assert.match(await page.locator('#event-text').innerText(), /需要确认/);
  await page.evaluate(() => demoPet.removeTask('attention'));
  assert.equal(await pet.getAttribute('data-state'), 'working');
  assert.equal(await pet.locator('.task-title').innerText(), '<img src=x onerror=alert(1)>');
  assert.equal(await pet.locator('img').count(), 0);
  await page.evaluate(() => { demoPet.clearTasks(); demoPet.element.sleep(); });
  assert.equal(await pet.getAttribute('data-state'), 'sleeping');
  await page.evaluate(() => demoPet.updateTask({ id: 'wake', status: 'working' }));
  assert.equal(await pet.getAttribute('data-state'), 'working');
  // Lifecycle and cleanup: reconnecting must not duplicate event subscriptions.
  const pats = await page.evaluate(() => {
    const el = demoPet.element; let count = 0;
    el.addEventListener('dsh-pet:pat', () => count++);
    el.remove(); document.body.append(el);
    el.shadowRoot.querySelector('.pat').click();
    return count;
  });
  assert.equal(pats, 1);
  await page.evaluate(() => demoPet.destroy());
  assert.equal(await page.locator('dsh-pet-v7').count(), 0);
  // A fresh instance restores preferences but never restores old task results.
  await page.reload(); await pet.locator('.pet').waitFor();
  assert.equal(await pet.getAttribute('data-state'), 'idle');
  assert.equal(await pet.locator('.theme').inputValue(), 'lilac');
  const savedPosition = await page.evaluate(() => JSON.parse(localStorage.getItem('dsh.mini-pet.demo.v1')).position);
  assert.ok(Number.isFinite(savedPosition.x));
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  mobile.on('pageerror', error => errors.push(error.message));
  await mobile.addInitScript(() => localStorage.setItem('dsh.mini-pet.demo.v1', '{bad json'));
  await mobile.goto(base); await mobile.locator('dsh-pet-v7 .pet').waitFor();
  assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await mobile.screenshot({ path: 'artifacts/demo-mobile.png', fullPage: true });
  await mobile.evaluate(() => window.demoPet.element.resetPosition());
  const box = await mobile.locator('dsh-pet-v7').boundingBox();
  assert.ok(box.x >= 0 && box.x + box.width <= 390);
  assert.ok(box.y >= 0 && box.y + box.height <= 844);
  await mobile.locator('dsh-pet-v7 .pet').tap();
  await mobile.locator('dsh-pet-v7 .more').tap();
  const menu = await mobile.locator('dsh-pet-v7 .settings-dialog').boundingBox();
  assert.ok(menu.y >= 0 && menu.y + menu.height <= 844);
  await mobile.locator('dsh-pet-v7 .size').selectOption('small');
  await mobile.keyboard.press('Escape');
  await mobile.evaluate(() => demoPet.element.resetPosition());
  await mobile.locator('dsh-pet-v7 .pet').tap();
  await mobile.locator('dsh-pet-v7 .more').tap();
  const smallMenu = await mobile.locator('dsh-pet-v7 .settings-dialog').boundingBox();
  assert.ok(smallMenu.y + smallMenu.height <= 844, 'small pet settings should scroll inside the viewport');
  // Render the actual desktop page with a narrow test bridge. This checks the
  // renderer and its CSP, but does not assert OS transparency or always-on-top.
  const desktop = await browser.newPage({ viewport: { width: 290, height: 390 }, reducedMotion: 'reduce' });
  desktop.on('pageerror', error => errors.push(error.message));
  await desktop.addInitScript(() => {
    window.bridgeActions = []; let subscriber;
    window.dshPetDesktop = {
      subscribe: callback => { subscriber = callback; window.sendPetMessage = callback; return () => {}; },
      ready: () => { subscriber({ type: 'configure', payload: { theme: 'mint', size: 'medium' } }); subscriber({ type: 'tasks', payload: [{ id: 'native-1', status: 'waiting', title: '桌面任务' }] }); },
      hide: () => window.bridgeActions.push('hide'),
      openTask: id => window.bridgeActions.push(id),
      move: (dx, dy) => window.bridgeActions.push([dx, dy])
    };
  });
  await desktop.goto(`${base}/electron/pet.html`); await desktop.locator('dsh-pet-v7 .bubble').waitFor();
  assert.equal(await desktop.locator('dsh-pet-v7').getAttribute('data-state'), 'waiting');
  await desktop.locator('dsh-pet-v7 .bubble').click();
  assert.deepEqual(await desktop.evaluate(() => window.bridgeActions), ['native-1']);
  await desktop.locator('dsh-pet-v7 .pet').focus(); await desktop.keyboard.press('ArrowRight');
  await desktop.locator('dsh-pet-v7 .tuck').click();
  assert.deepEqual(await desktop.evaluate(() => window.bridgeActions), ['native-1', [10, 0], 'hide']);
  await desktop.evaluate(() => sendPetMessage({ type: 'show' }));
  assert.equal(await desktop.locator('dsh-pet-v7 .pet').isVisible(), true);
  await desktop.screenshot({ path: 'artifacts/electron-renderer.png', omitBackground: true });
  const restricted = await browser.newPage();
  restricted.on('pageerror', error => errors.push(error.message));
  await restricted.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error('storage blocked'); };
    Storage.prototype.setItem = () => { throw new Error('storage blocked'); };
  });
  await restricted.goto(base); await restricted.locator('dsh-pet-v7 .pet').waitFor();
  assert.equal(await restricted.locator('dsh-pet-v7').getAttribute('data-state'), 'idle');
  const dsh = await browser.newPage({ viewport: { width: 1200, height: 800 }, reducedMotion: 'reduce' });
  dsh.on('pageerror', error => errors.push(error.message));
  await dsh.goto(`${base}/tests/dsh-fixture.html`);
  await dsh.evaluate(() => {
    // A user may still have v0.2 registered after a hot update. New controls
    // must never be attached to that old immutable Custom Element constructor.
    customElements.define('dsh-pet-v6', class extends HTMLElement {});
    window.__ModuleLoader__ = { load({ id, factory }) {
      if (id !== '@dsh/mini-pet') throw new Error('Unexpected module id');
      window.petPlugin = factory(id => { if (id === 'react') return { createElement: (tag, props) => ({ tag, props }) }; throw new Error('Unexpected external dependency: ' + id); });
    } };
  });
  await dsh.addScriptTag({ url: `${base}/lib/client.js` });
  await dsh.evaluate(() => {
    const observable = initial => { let value = initial; const listeners = new Set(); return {
      getSnapshot: () => value, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
      set(next) { value = next; for (const fn of [...listeners]) fn(); }, count: () => listeners.size
    }; };
    window.dshList = observable({ phase: 'ready', ids: ['task-a'], byId: { 'task-a': { displayTitle: '实际会话状态适配' } } });
    window.dshStatuses = observable(new Map([['task-a', { running: false }]]));
    window.dshDisposers = []; window.dshOpened = []; window.dshSettingsEntries = [];
    window.petPlugin.apply({
      effect(fn) { const off = fn(); window.dshDisposers.push(off); return off; },
      locale: { register: () => () => {} },
      slots: { inject: (seat, fn) => fn(), register(options, Component) { const record = { options, Component }; dshSettingsEntries.push(record); return () => { dshSettingsEntries.splice(dshSettingsEntries.indexOf(record), 1); }; } },
      sessions: { list: window.dshList, binding: () => undefined },
      uiSession: { sessionStatus: window.dshStatuses },
      uiWorkspace: { openSession: id => window.dshOpened.push(id) }
    });
  });
  assert.equal(await dsh.locator('dsh-pet-v7').getAttribute('data-state'), 'idle');
  await dsh.evaluate(() => dshStatuses.set(new Map([['task-a', { running: true }]])));
  assert.equal(await dsh.locator('dsh-pet-v7').getAttribute('data-state'), 'working');
  await dsh.evaluate(() => dshStatuses.set(new Map([['task-a', { running: true, pendingInteraction: { kind: 'approval' } }]])));
  assert.equal(await dsh.locator('dsh-pet-v7').getAttribute('data-state'), 'waiting');
  await dsh.evaluate(() => dshStatuses.set(new Map([['task-a', { running: false }]])));
  assert.equal(await dsh.locator('dsh-pet-v7').getAttribute('data-state'), 'review');
  await dsh.locator('dsh-pet-v7 .bubble').click();
  assert.deepEqual(await dsh.evaluate(() => dshOpened), ['task-a']);
  assert.equal(await dsh.locator('dsh-pet-v7').getAttribute('data-state'), 'idle');
  assert.deepEqual(await dsh.evaluate(() => dshSettingsEntries), []);
  await dsh.locator('dsh-pet-v7 .pet').focus();
  await dsh.locator('dsh-pet-v7 .more').click();
  await dsh.locator('dsh-pet-settings-v5 .size').selectOption('mini');
  assert.equal(await dsh.locator('dsh-pet-v7 .pet').evaluate(el => el.offsetHeight), 56);
  await dsh.locator('dsh-pet-settings-v5 [data-character="dousha"]').click();
  assert.equal(await dsh.locator('dsh-pet-v7').getAttribute('data-character'), 'dousha');
  await dsh.keyboard.press('Escape');
  await dsh.evaluate(() => { for (const off of dshDisposers) off(); });
  assert.equal(await dsh.locator('dsh-pet-v7').count(), 0);
  assert.deepEqual(await dsh.evaluate(() => [dshList.count(), dshStatuses.count()]), [0, 0]);
  assert.equal(await dsh.evaluate(() => dshSettingsEntries.length), 0);
  const animated = await browser.newPage({ viewport: { width: 1000, height: 900 }, reducedMotion: 'no-preference' });
  animated.on('pageerror', error => errors.push(error.message));
  await animated.goto(base); await animated.evaluate(() => demoPet.configure({ character: 'xiaoyin' })); await animated.locator('dsh-pet-v7 .pet .sprite').waitFor();
  const moving = animated.locator('dsh-pet-v7 .pet .sprite');
  await animated.mouse.move(0, 0);
  const firstFrame = await moving.getAttribute('data-frame');
  await animated.waitForFunction(frame => document.querySelector('dsh-pet-v7').shadowRoot.querySelector('.sprite').dataset.frame !== frame, firstFrame);
  for (const [status, row] of [['working', '7'], ['waiting', '6'], ['error', '5'], ['success', '4']]) {
    await animated.locator(`.states [data-state="${status}"]`).click();
    assert.equal(await moving.getAttribute('data-row'), row);
  }
  await animated.locator('.states [data-state="working"]').click();
  await animated.locator('dsh-pet-v7 .pet').focus();
  await animated.locator('dsh-pet-v7 .pat').click();
  assert.equal(await moving.getAttribute('data-row'), '7');
  assert.equal(await moving.evaluate(el => getComputedStyle(el).animationName), 'none');
  assert.equal(await animated.locator('dsh-pet-v7 .pet .emote-badge').isVisible(), true);
  await animated.evaluate(() => demoPet.configure({ still: true }));
  assert.equal(await moving.getAttribute('data-frame'), '0');
  await animated.locator('#settings').click();
  await animated.locator('dsh-pet-settings-v5 [data-character="dousha"]').click();
  await animated.locator('dsh-pet-settings-v5 [data-character="xiaoyin"]').click();
  await animated.locator('dsh-pet-settings-v5 [data-setting="speed"]').selectOption('1.25');
  await animated.screenshot({ path: 'artifacts/xiaoyin-settings.png', fullPage: true });
  await animated.reload(); await animated.locator('dsh-pet-v7 .pet .sprite').waitFor();
  assert.deepEqual(await animated.evaluate(() => { const p = demoPet.element.preferences; return [p.character, p.still, p.speed]; }), ['xiaoyin', true, 1.25]);
  assert.deepEqual(errors, []);
  console.log('Browser checks passed: task states, real pointer/keyboard pats, reduced-motion feedback, roles, shortcut settings, preferences, drag/lock, vector companion, v0.4 upgrade, disposal, mobile and Electron renderer.');
} finally { if (errors.length) console.error('Page errors:', errors); await browser.close(); }
