import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = process.env.DSH_PLAYWRIGHT_MODULE ? await import(process.env.DSH_PLAYWRIGHT_MODULE) : require('playwright');
const base = process.env.DSH_DEMO_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}), args: ['--no-sandbox'] });
const errors = [];
async function fixture({ hidden = false, factoryFailure = false } = {}) {
  const page = await browser.newPage({ reducedMotion: 'reduce', viewport: { width: 1200, height: 800 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/tests/dsh-fixture.html`);
  await page.evaluate(({ hidden, factoryFailure }) => {
    document.body.innerHTML = '<aside data-sidebar style="position:fixed;left:0;top:0;width:220px;height:800px"><svg id="brand" style="visibility:visible!important;width:24px;height:18px"><path d="M0 0h24v24H0z"/></svg></aside><main style="margin-left:250px"><button id="host-action">宿主仍可交互</button></main>';
    window.hostActions = 0; document.querySelector('#host-action').onclick = () => hostActions++;
    localStorage.setItem('dsh.mini-pet.web.v1', JSON.stringify({ hidden }));
    customElements.define('dsh-pet-v6', class extends HTMLElement {});
    if (factoryFailure) customElements.define = () => { throw new Error('injected module registration failure'); };
    window.__ModuleLoader__ = { load({ factory }) { window.plugin = factory(() => { throw new Error('unexpected runtime dependency'); }); } };
    const observable = initial => {
      let value = initial; const listeners = new Set();
      return { getSnapshot: () => value, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
        set(next) { value = next; for (const fn of [...listeners]) fn(); }, count: () => listeners.size };
    };
    window.list = observable({ ids: ['a'], byId: { a: { title: '测试会话' } } });
    window.statuses = observable(new Map([['a', { running: false }]]));
    window.face = observable({}); window.events = observable({ change: { kind: 'replace' } });
    window.context = {
      effect(fn) { window.cleanup = fn(); },
      sessions: { list, binding: () => ({ session: face, eventSource: events }) },
      uiSession: { sessionStatus: statuses }, uiWorkspace: { openSession() {} }
    };
    window.activate = () => {
      try { plugin.apply(context); window.shellReady = true; } catch (error) { window.bootError = error.message; }
      window.followingPluginReady = true;
    };
  }, { hidden, factoryFailure });
  await page.addScriptTag({ url: `${base}/lib/client.js` });
  return page;
}
async function assertHostSurvives(page) {
  assert.deepEqual(await page.evaluate(() => [shellReady, followingPluginReady, window.bootError]), [true, true, undefined]);
  await page.locator('#host-action').click(); assert.equal(await page.evaluate(() => hostActions), 1);
}
async function assertClean(page) {
  assert.equal(await page.locator('[data-dsh-plugin="mini-pet"]').count(), 0);
  assert.deepEqual(await page.evaluate(() => [list.count(), statuses.count(), face.count(), events.count()]), [0, 0, 0, 0]);
  assert.equal(await page.locator('#brand').evaluate(el => el.style.getPropertyValue('visibility')), 'visible');
  assert.equal(await page.locator('#brand').evaluate(el => el.style.getPropertyPriority('visibility')), 'important');
  assert.equal(await page.locator('#brand').getAttribute('data-dsh-mini-pet-brand'), null);
}
try {
  for (const hidden of [true, false]) {
    const page = await fixture({ hidden }); await page.evaluate(() => activate());
    const pet = page.locator('dsh-pet-v7');
    if (!hidden) await page.evaluate(() => document.querySelector('dsh-pet-v7').hide());
    await pet.locator('.logo-mark').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#brand').evaluate(el => getComputedStyle(el).visibility), 'hidden');
    const box = await pet.locator('.logo-mark').boundingBox(), anchor = await page.locator('#brand').boundingBox();
    assert.equal(Math.round(box.x), Math.max(8, Math.round(anchor.x))); assert.equal(Math.round(box.height), 64);
    const avatar = await pet.locator('.logo-avatar').evaluate(el => getComputedStyle(el).overflow); assert.equal(avatar, 'visible');
    await pet.locator('.logo-mark').click(); await pet.locator('.pet').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#brand').evaluate(el => getComputedStyle(el).visibility), 'visible');
    await page.evaluate(() => document.querySelector('dsh-pet-v7').configure({ character: 'dousha' }));
    await page.evaluate(() => document.querySelector('dsh-pet-v7').hide());
    await pet.locator('.logo-mark').waitFor({ state: 'visible' });
    await page.locator('#brand').evaluate(el => el.style.display = 'none');
    await page.evaluate(() => document.querySelector('dsh-pet-v7').measureBrandSlot());
    await pet.locator('.dock').waitFor({ state: 'visible' });
    await page.evaluate(() => cleanup()); await assertClean(page); await assertHostSurvives(page); await page.close();
  }
  const animated = await fixture();
  await animated.emulateMedia({ reducedMotion: 'no-preference' });
  await animated.evaluate(() => { activate(); document.querySelector('dsh-pet-v7').hide(); });
  await animated.locator('dsh-pet-v7 .logo-mark').waitFor({ state: 'visible' });
  await animated.locator('dsh-pet-v7 .logo-mark').click();
  await animated.waitForFunction(() => getComputedStyle(document.querySelector('#brand')).visibility === 'visible');
  await animated.evaluate(() => {
    const pet = document.querySelector('dsh-pet-v7'); pet.hide(); pet.show(); cleanup();
  });
  await assertClean(animated); await assertHostSurvives(animated); await animated.close();
  const startup = await fixture();
  await startup.evaluate(() => {
    const query = ShadowRoot.prototype.querySelector;
    ShadowRoot.prototype.querySelector = function(selector) { return selector === '.dock' ? null : query.call(this, selector); };
    activate(); ShadowRoot.prototype.querySelector = query;
  });
  await assertClean(startup); await assertHostSurvives(startup); await startup.close();
  const runtime = await fixture({ hidden: true });
  await runtime.evaluate(() => {
    activate(); document.querySelector('dsh-pet-v7').updateTask = () => { throw new Error('injected render failure'); };
    statuses.set(new Map([['a', { running: true }]]));
  });
  await assertClean(runtime); await assertHostSurvives(runtime); await runtime.close();
  const ui = await fixture(); await ui.evaluate(() => activate());
  await ui.evaluate(() => document.querySelector('dsh-pet-v7').shadowRoot.querySelector('.settings-dialog').remove());
  await ui.locator('dsh-pet-v7 .pet').focus(); await ui.locator('dsh-pet-v7 .more').click();
  await assertClean(ui); await assertHostSurvives(ui); await ui.close();
  const settings = await fixture(); await settings.evaluate(() => activate());
  await settings.locator('dsh-pet-v7 .pet').focus(); await settings.locator('dsh-pet-v7 .more').click();
  await settings.evaluate(() => { document.querySelector('dsh-pet-v7').configure = () => { throw new Error('injected settings failure'); }; });
  await settings.locator('dsh-pet-settings-v5 .size').selectOption('tiny');
  await assertClean(settings); await assertHostSurvives(settings); await settings.close();
  const navigation = await fixture();
  await navigation.evaluate(() => { context.uiWorkspace.openSession = async () => { throw new Error('injected navigation rejection'); }; activate(); statuses.set(new Map([['a', { running: true }]])); });
  await navigation.locator('dsh-pet-v7 .bubble').click();
  await navigation.locator('dsh-pet-v7').waitFor({ state: 'detached' });
  await assertClean(navigation); await assertHostSurvives(navigation); await navigation.close();
  const observer = await fixture({ hidden: true });
  await observer.evaluate(() => { activate(); document.querySelector('#brand').getBoundingClientRect = () => { throw new Error('injected layout failure'); }; document.body.append(document.createElement('div')); });
  await observer.locator('dsh-pet-v7').waitFor({ state: 'detached' });
  await assertClean(observer); await assertHostSurvives(observer); await observer.close();
  const factory = await fixture({ factoryFailure: true }); await factory.evaluate(() => activate());
  assert.deepEqual(await factory.evaluate(() => plugin.inject), []);
  await assertClean(factory); await assertHostSurvives(factory); await factory.close();
  assert.deepEqual(errors, []);
  console.log('Boot safety checks passed: brand/fallback, initialization, render, UI event, async navigation, observer and module factory faults; host action remains usable, no page errors, resources released.');
} finally { if (errors.length) console.error('Page errors:', errors); await browser.close(); }
