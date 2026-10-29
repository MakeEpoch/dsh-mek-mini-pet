import { createPet } from '../src/index.js';
import { watchSessions } from './sessions.js';
import { createIsolation } from './isolation.js';

export const inject = ['sessions', 'uiSession', 'uiWorkspace'];

/**
 * Locate the shell's brand mark without reading another plugin's class names.
 *
 * The official mark renders as one flat `svg` of width `size` whose height follows the
 * artwork's 23.16:17.04 ratio, placed in the sidebar header beside the wordmark. So the
 * search looks at every svg in the left column's header strip and keeps the widest one:
 * menu icons there are square 16px glyphs, the mark is wider than it is tall.
 */
export function findBrandMark() {
  const candidates = [];
  for (const svg of document.querySelectorAll('body svg[aria-hidden="true"], body svg')) {
    if (svg.closest('dsh-pet-v7')) continue;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || rect.width < 18 || rect.width > 40) continue;
    // The sidebar header sits against the left edge, above the session list.
    if (rect.left > innerWidth * 0.35 || rect.top > 120) continue;
    // A brand mark is wider than tall; square glyphs are menu icons.
    if (rect.width <= rect.height * 1.1) continue;
    candidates.push({ svg, rect, left: rect.left, top: rect.top });
  }
  if (!candidates.length) return null;
  // The header mark is the leftmost, then highest, of the wide shapes found there.
  candidates.sort((a, b) => a.left - b.left || a.top - b.top);
  return candidates[0].svg;
}

/**
 * Report the geometry the live page offers, so a real shell can explain a miss
 * through `dshPetDebug()` instead of a guess from a fixture.
 */
export function describeBrandSearch() {
  return [...document.querySelectorAll('body svg')].filter(svg => !svg.closest('dsh-pet-v7')).map(svg => {
    const r = svg.getBoundingClientRect();
    if (!r.width || r.left > innerWidth * 0.35 || r.top > 160) return null;
    const reasons = [];
    if (r.width < 18 || r.width > 40) reasons.push(`width ${Math.round(r.width)} outside 18..40`);
    if (r.width <= r.height * 1.1) reasons.push('not wider than tall');
    return { w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), t: Math.round(r.top), accepted: !reasons.length, reasons };
  }).filter(Boolean);
}

/** The first compact header row containing the mark, excluding the full sidebar. */
export function findBrandRow(mark) {
  const valid = node => {
    const box = node.getBoundingClientRect();
    return box.width >= 140 && box.height >= 16 && box.height <= 160;
  };
  // The shell exposes a drag row around the brand identity and sidebar toggle.
  // The identity is an inline-flex span: increasing its height cannot move New Session.
  const dragRow = mark?.closest('[data-window-drag]');
  if (dragRow && valid(dragRow)) return dragRow;
  for (let node = mark?.parentElement; node && node !== document.body; node = node.parentElement) {
    const box = node.getBoundingClientRect();
    if (box.height > 160) return null;
    const display = getComputedStyle(node).display;
    if (!node.matches('button,a') && ['flex', 'grid', 'block'].includes(display) && valid(node)) return node;
  }
  return null;
}

/** Optional UI: failures stop this companion, never reject the host activation. */
export function apply(ctx) {
  const scope = createIsolation((phase, error) => {
    console.error(`[mini-pet] disabled after ${phase}; dsh can continue`, error);
  });
  const start = scope.guard('initialization', () => {
    let watcher, mark, row, brandTarget, timer, held = false, originalVisibility, originalMarkVisibility, originalHeight, inlineSlot, adopting = false;
    let current = new Map();
    const pet = createPet({ storageKey: 'dsh.mini-pet.web.v1',
      onError: error => scope.fail('pet UI', error),
      onOpenTask: scope.guard('open session', ({ id }) => {
        const result = ctx.uiWorkspace.openSession(id);
        watcher?.acknowledge(id);
        return result;
      })
    });
    scope.own(() => pet.destroy());
    pet.element.setAttribute('data-dsh-plugin', 'mini-pet');
    const restoreProperty = (node, property, original) => {
      if (!node) return;
      if (original?.value) node.style.setProperty(property, original.value, original.priority);
      else node.style.removeProperty(property);
    };
    const restoreMark = () => {
      restoreProperty(brandTarget, 'display', originalVisibility);
      restoreProperty(brandTarget, 'visibility', originalMarkVisibility);
      restoreProperty(row, 'height', originalHeight);
      mark?.removeAttribute('data-dsh-mini-pet-brand');
    };
    const paint = () => {
      if (!mark) return;
      if (held) {
        if (inlineSlot) {
          brandTarget.style.setProperty('display', 'none', 'important');
          row?.style.setProperty('height', 'auto', 'important');
          inlineSlot.style.setProperty('display', 'block', 'important');
        } else brandTarget.style.setProperty('visibility', 'hidden', 'important');
      } else {
        inlineSlot?.style.setProperty('display', 'none', 'important');
        restoreProperty(brandTarget, 'display', originalVisibility);
      restoreProperty(brandTarget, 'visibility', originalMarkVisibility);
        restoreProperty(row, 'height', originalHeight);
      }
    };
    const readStyle = (node, property) => node ? { value: node.style.getPropertyValue(property), priority: node.style.getPropertyPriority(property) } : undefined;
    const adopt = () => {
      if (adopting) return paint();
      adopting = true;
      try {
      const next = mark?.isConnected ? mark : findBrandMark();
      if (next === mark && (!row || inlineSlot?.isConnected)) return paint();
      restoreMark(); mark = next; row = findBrandRow(mark);
      brandTarget = mark?.closest('button,a') || mark;
      if (row) {
        brandTarget = mark;
        while (brandTarget?.parentElement && brandTarget.parentElement !== row) brandTarget = brandTarget.parentElement;
      }
      originalVisibility = readStyle(brandTarget, 'display'); originalMarkVisibility = readStyle(brandTarget, 'visibility'); originalHeight = readStyle(row, 'height');
      if (inlineSlot?.parentElement !== row) {
        pet.element.attachSidebarSlot(null);
        inlineSlot?.remove(); inlineSlot = undefined;
        if (row) {
          inlineSlot = document.createElement('div'); inlineSlot.setAttribute('data-dsh-mini-pet-slot', '');
          inlineSlot.style.cssText = 'display:none;flex:1 1 0%;min-width:0;height:64px;position:relative;';
          row.insertBefore(inlineSlot, brandTarget);
          pet.element.attachSidebarSlot(inlineSlot);
        }
      }
      mark?.setAttribute('data-dsh-mini-pet-brand', ''); paint();
      } finally { adopting = false; }
    };
    scope.own(restoreMark);
    scope.own(() => inlineSlot?.remove());
    const brand = scope.guard('brand event', event => { held = event.detail.hidden; adopt(); });
    pet.element.addEventListener('dsh-pet:brand', brand);
    scope.own(() => pet.element.removeEventListener('dsh-pet:brand', brand));
    adopt();
    pet.element.attachBrandSlot(() => mark, () => row);
    // Live inspection from the page console: dshPetDebug() reports real geometry.
    window.dshPetDebug = () => ({ found: !!mark, mark: mark ? { tag: mark.tagName, cls: String(mark.className?.baseVal ?? mark.className).slice(0, 40) } : null, search: describeBrandSearch(), pet: { hidden: pet.element.preferences.hidden, logoAnchored: !!pet.element.shadowRoot.querySelector('.logo-mark') && !pet.element.shadowRoot.querySelector('.logo-mark').hidden } });
    scope.own(() => delete window.dshPetDebug);
    adopt();
    const refresh = scope.guard('brand layout', () => { adopt(); pet.element.measureBrandSlot(); });
    const observer = new MutationObserver(scope.guard('brand observer', () => { clearTimeout(timer); timer = setTimeout(refresh, 80); }));
    scope.own(() => { observer.disconnect(); clearTimeout(timer); });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-sidebar-collapsed'] });
    addEventListener('resize', refresh);
    scope.own(() => removeEventListener('resize', refresh));
    watcher = watchSessions({ sessions: ctx.sessions, statuses: ctx.uiSession.sessionStatus,
      onError: error => scope.fail('session subscription', error), publish(tasks) {
        const next = new Map(tasks.map(task => [task.id, JSON.stringify(task)]));
        for (const id of current.keys()) if (!next.has(id)) pet.removeTask(id);
        for (const task of tasks) if (current.get(task.id) !== next.get(task.id)) pet.updateTask(task);
        current = next;
      }
    });
    scope.own(() => watcher.dispose());
    return () => scope.dispose();
  });
  scope.guard('effect registration', () => ctx.effect(start, 'mini-pet: isolated companion'))();
}
