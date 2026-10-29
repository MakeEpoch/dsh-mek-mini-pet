import { PetState, STATES, clampPosition } from './state.js';
import { petArt } from './art.js';
import { overlayStyles, styles } from './styles.js';
import { CHARACTERS, DEFAULTS, SIZES, SPRITE_ROWS, validateOptions } from './characters.js';
import { SpritePlayer } from './sprite.js';
import './settings.js';

const colors = { mint: ['#c0dac5', '#96b99e'], peach: ['#efd0b9', '#dbac96'], lilac: ['#d5cdea', '#b5a8cf'] };
const glide = duration => ({ duration, easing: 'cubic-bezier(.42,0,.22,1)', fill: 'forwards' });
export class DshPet extends HTMLElement {
  #state = new PetState(); #prefs = { ...DEFAULTS }; #position; #abort; #timer; #sleeping = false;
  #drag; #suppressClick = false; #storageKey; #player; #motion; #look; #dragDirection;
  #feedback = ''; #lastSettingsFocus; #heartTimer; #bubbleDismissed = false;
  #logoPlayer; #overlay; #logoAnchor; #logoSize = 24; #logoRadius; #home; #logoMarkShown = false; #brandTimer; #handOver = 0;
  #swap = { rest: null, active: null };
  #failure; #onError; #sidebarSlot; #floatingParent; #relocating = false;
  constructor() {
    super(); this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `<style>${styles}</style><div class="wrap">
      <div class="bubble-shell"><button class="bubble" type="button" aria-label="查看当前任务"><span class="status-line"><i class="dot"></i><span class="status"></span><span class="count"></span></span><strong class="task-title"></strong><span class="message" aria-live="polite"></span></button><button class="bubble-restore" type="button" hidden><span aria-hidden="true">↗</span><span class="restore-label" hidden></span></button><button class="bubble-close" type="button" aria-label="关闭任务气泡" title="关闭，有新消息再显示">×</button></div>
      <button class="pet" type="button"><span class="vector">${petArt}</span><span class="sprite" aria-hidden="true" hidden></span><span class="emote-badge" hidden aria-hidden="true">♥</span></button>
      <span class="interaction-feedback" role="status" aria-live="polite" hidden></span>
      <div class="toolbar"><span class="name"></span><span class="separator"></span><button class="tool pat" title="摸摸">♡</button><button class="tool rest" aria-label="休息或唤醒宠物" title="休息 / 唤醒">☾</button><button class="tool more" aria-label="宠物设置" aria-expanded="false" title="宠物设置">⚙</button><button class="tool tuck" aria-label="收起宠物" title="收起">−</button></div>
    </div><button class="logo-mark" type="button" hidden><span class="logo-avatar"><span class="vector">${petArt}</span><span class="sprite" aria-hidden="true" hidden></span><span class="emote-badge" hidden aria-hidden="true">♥</span></span><i class="logo-dot"></i></button><button class="dock" type="button" hidden><i class="dot"></i><span></span> ↗</button>
    <dialog class="settings-dialog" aria-label="宠物设置"><button class="settings-close" aria-label="关闭宠物设置">×</button><dsh-pet-settings-v5></dsh-pet-settings-v5></dialog>`;
    this.#player = new SpritePlayer(this.#el('.sprite'), error => this.#fail(error));
    this.#logoPlayer = new SpritePlayer(this.#el('.logo-mark .sprite'), error => this.#fail(error));
  }
  #el(selector, root = this.shadowRoot) { return root.querySelector(selector); }
  get failure() { return this.#failure; }
  setErrorHandler(handler) { this.#onError = handler; }
  reportError(error) { this.#fail(error); }
  #fail(error) {
    if (this.#failure) return;
    this.#failure = error;
    this.remove();
    try { this.#onError?.(error); } catch { /* Keep the host callback isolated. */ }
  }
  #guard(fn) { return (...args) => { if (this.#failure) return; try { return fn(...args); } catch (error) { this.#fail(error); } }; }
  connectedCallback() { if (!this.#relocating) this.#guard(() => this.#connect())(); }
  #connect() {
    this.#storageKey = this.getAttribute('storage-key') || 'dsh.mini-pet.v1';
    try {
      const saved = JSON.parse(localStorage.getItem(this.#storageKey));
      if (saved && typeof saved === 'object') {
        for (const key of Object.keys(DEFAULTS)) {
          if (saved[key] === undefined) continue;
          try { validateOptions({ [key]: saved[key] }); this.#prefs[key] = saved[key]; } catch { /* Ignore one bad preference. */ }
        }
        this.#position = saved.position;
        if (saved.swap && typeof saved.swap === 'object') this.#swap = { rest: saved.swap.rest || null, active: saved.swap.active || null };
      }
    } catch { /* Storage is optional. */ }
    this.#abort?.abort(); this.#abort = new AbortController();
    const listen = (target, event, fn) => target.addEventListener(event, this.#guard(fn), { signal: this.#abort.signal });
    this.#el('dsh-pet-settings-v5').pet = this;
    if (this.#failure) return;
    listen(this.#el('.pet'), 'click', event => {
      if (event.detail === 0 || !this.#suppressClick) this.pat();
      this.#suppressClick = false;
    });
    listen(this.#el('.pat'), 'click', () => this.pat());
    listen(this.#el('.rest'), 'click', () => this.sleep());
    listen(this.#el('.tuck'), 'click', () => this.hide());
    listen(this.#el('.logo-mark'), 'click', () => this.show());
    listen(this.#el('.bubble-restore'), 'click', event => { event.stopPropagation(); this.show(); });
    listen(this.#el('.dock'), 'click', event => {
      if (event.detail === 0 || !this.#suppressClick) this.show();
      this.#suppressClick = false;
    });
    listen(this.#el('.bubble-close'), 'click', () => this.dismissBubble());
    listen(this.#el('.more'), 'click', () => this.openSettings());
    listen(this.#el('.settings-close'), 'click', () => this.closeSettings());
    listen(this.#el('.settings-dialog'), 'close', () => {
      this.#el('.more').setAttribute('aria-expanded', 'false'); this.#lastSettingsFocus?.focus();
    });
    listen(this.#el('.bubble'), 'click', () => {
      const task = this.snapshot.task;
      if (task) this.dispatchEvent(new CustomEvent('dsh-pet:open-task', { detail: { ...task }, bubbles: true, composed: true }));
      else this.#notify(`${this.character.name}正在安静陪伴你。`);
    });
    listen(this, 'keydown', event => {
      const delta = { ArrowLeft: [-10, 0], ArrowRight: [10, 0], ArrowUp: [0, -10], ArrowDown: [0, 10] }[event.key];
      if (!delta) return;
      const target = event.composedPath()[0];
      if (target === this.#el('.logo-mark')) {
        if (this.#prefs.locked) return;
        event.preventDefault(); this.#nudge(delta[0], delta[1], true); return;
      }
      if (![this.#el('.pet'), this.#el('.dock')].includes(target) || this.#prefs.locked) return;
      event.preventDefault(); this.#nudge(delta[0], delta[1], false);
    });
    const pet = this.#el('.pet');
    for (const handle of [pet, this.#el('.dock')]) {
      listen(handle, 'pointerdown', event => {
        this.#suppressClick = false;
        if (event.button !== 0 || this.#prefs.locked || this.hasAttribute('native')) return;
        this.#drag = { id: event.pointerId, x: event.clientX, y: event.clientY, origin: { ...this.#position } };
        handle.setPointerCapture(event.pointerId);
      });
      listen(handle, 'pointermove', event => {
        if (this.#drag?.id !== event.pointerId) return;
        const dx = event.clientX - this.#drag.x, dy = event.clientY - this.#drag.y;
        if (Math.hypot(dx, dy) > 5) this.#suppressClick = true;
        if (this.#suppressClick) {
          this.#dragDirection = handle === pet ? (dx < 0 ? 'left' : 'right') : undefined;
          this.setPosition(this.#drag.origin.x + dx, this.#drag.origin.y + dy, false); this.#animate();
        }
      });
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(handle, type, () => {
        this.#drag = null; this.#dragDirection = undefined; this.#look = undefined; this.#save(); this.#animate();
      });
    }
    listen(pet, 'pointermove', event => {
      if (!this.#drag && this.dataset.state === 'idle') {
        const box = pet.getBoundingClientRect();
        const angle = Math.atan2(event.clientX - box.x - box.width / 2, -(event.clientY - box.y - box.height / 2));
        this.#look = (Math.round(angle / (Math.PI / 8)) + 16) % 16; this.#animate();
      }
    });
    listen(pet, 'pointerleave', () => { this.#look = undefined; this.#animate(); });
    listen(window, 'resize', () => { if (this.#logoMarkShown && !this.#prefs.hidden) this.#renderLogoMark(); else this.#place(); });
    listen(document, 'visibilitychange', () => {
      this.toggleAttribute('data-paused', document.hidden); this.#animate();
      if (this.#home) this.#renderLogoMark();
    });
    this.#motion = matchMedia('(prefers-reduced-motion: reduce)');
    listen(this.#motion, 'change', () => this.#animate());
    this.#render(); this.#place(); this.toggleAttribute('data-paused', document.hidden);
  }
  disconnectedCallback() {
    if (this.#relocating) return;
    const clean = fn => { try { fn(); } catch { /* Continue releasing other resources. */ } };
    clean(() => this.#abort?.abort()); clean(() => this.#player.stop()); clean(() => this.#logoPlayer?.stop());
    clearTimeout(this.#timer); clearTimeout(this.#heartTimer); clearTimeout(this.#brandTimer); this.#drag = null;
    clean(() => this.#renderLogoHome(false)); clean(() => this.#stopFly()); clean(() => this.#overlay?.element.remove());
    this.removeAttribute('data-emote'); this.#feedback = ''; clean(() => this.closeSettings());
  }
  get snapshot() { return this.#state.snapshot(); }
  get preferences() { return { ...this.#prefs }; }
  get character() { return CHARACTERS[this.#prefs.character]; }
  updateTask(task) {
    const previous = this.snapshot.tasks.find(value => value.id === task?.id);
    const value = this.#state.update(task);
    const next = value.tasks.find(value => value.id === task.id);
    if (!previous || ['status', 'title', 'message', 'revision'].some(key => previous[key] !== next[key])) this.#bubbleDismissed = false;
    this.#sleeping = false; this.#look = undefined; this.#render(); return value;
  }
  dismissBubble() { this.#bubbleDismissed = true; this.#render(); }
  removeTask(id) { this.#state.remove(id); this.#render(); }
  clearTasks() { this.#state.clear(); this.#render(); }
  configure(options = {}) {
    validateOptions(options);
    for (const key of Object.keys(DEFAULTS)) if (options[key] !== undefined) this.#prefs[key] = options[key];
    if (!this.#prefs.interactions) { clearTimeout(this.#heartTimer); this.removeAttribute('data-emote'); }
    this.#render(); this.#place(); this.#save(); this.#changed();
  }
  resetPreferences() { this.#prefs = { ...DEFAULTS }; this.#sleeping = false; this.#bubbleDismissed = false; this.#position = undefined; this.#render(); this.#place(); this.#save(); this.#changed(); }
  show() {
    const from = this.#logoMarkShown ? this.#cast() : null;
    this.#prefs.hidden = false; this.#render(); this.#place(); this.#save(); this.#changed();
    if (from) this.#glide(from, this.#homeBox(), 'return', () => this.#restoreBrand(0));
    else this.#renderLogoHome(false);
  }
  hide() {
    this.closeSettings();
    if (this.#sidebarSlot?.isConnected) { this.#renderLogoHome(true); this.#measure(); }
    // Phase one: glide into the host slot first; the slot takes over once the pet has landed.
    if (this.#logoAnchor?.length && !this.#prefs.hidden) {
      this.#measure();
      const badge = this.#logoSwap(this.#logoSize);
      const from = this.#homeBox(), to = this.#cast() || { ...from, size: badge.size, w: badge.width, h: badge.height, radius: badge.radius };
      this.#glide(from, to, 'pop', () => {
        this.#prefs.hidden = true; this.#render(); this.#place(); this.#save(); this.#changed(); this.#renderLogoHome(true);
      });
      return;
    }
    this.#prefs.hidden = true; this.#render(); this.#place(); this.#save(); this.#changed();
  }
  openSettings() {
    if (this.#el('.settings-dialog').open) return;
    this.#lastSettingsFocus = this.shadowRoot.activeElement;
    this.#el('.settings-dialog').showModal(); this.#el('.more').setAttribute('aria-expanded', 'true');
  }
  closeSettings() { if (this.#el('.settings-dialog').open) this.#el('.settings-dialog').close(); }
  sleep() {
    if (this.snapshot.tasks.some(task => ['working', 'waiting', 'error'].includes(task.status))) { this.#notify('还有任务需要关注，我先陪你忙完。'); return false; }
    this.#sleeping = !this.#sleeping; this.#render();
    this.#notify(this.#sleeping ? `${this.character.name}休息一下，有事再叫我。` : `${this.character.name}醒来啦。`); return true;
  }
  pat() {
    if (!this.#prefs.interactions) return false;
    clearTimeout(this.#heartTimer);
    this.setAttribute('data-emote', 'heart'); this.#renderFeedback();
    const badge = this.#el('.emote-badge');
    badge.style.animation = 'none'; void badge.offsetWidth; badge.style.animation = '';
    this.#heartTimer = setTimeout(this.#guard(() => { this.removeAttribute('data-emote'); this.#renderFeedback(); }), 1000);
    this.dispatchEvent(new CustomEvent('dsh-pet:feedback', { detail: { message: `${this.character.name}收到你的摸摸了 ♡` }, bubbles: true, composed: true }));
    this.dispatchEvent(new CustomEvent('dsh-pet:pat', { bubbles: true, composed: true })); return true;
  }
  setPosition(x, y, persist = true) { this.#position = { x, y }; this.#place(); if (persist) this.#save(); }
  resetPosition() { this.#position = undefined; this.#place(); this.#save(); }
  #notify(message, duration = 2400) {
    clearTimeout(this.#timer); this.#feedback = message; this.#renderFeedback();
    this.dispatchEvent(new CustomEvent('dsh-pet:feedback', { detail: { message }, bubbles: true, composed: true }));
    this.#timer = setTimeout(this.#guard(() => { this.#feedback = ''; this.#renderFeedback(); }), duration);
  }
  #changed() { this.dispatchEvent(new CustomEvent('dsh-pet:preferences', { detail: this.preferences, bubbles: true, composed: true })); }

  #place() {
    if (!this.isConnected) return;
    if (this.#prefs.hidden && this.#logoAnchor?.length) {
      const { outer } = this.#slot();
      this.style.width = `${outer.width}px`;
      this.style.left = `${outer.left}px`; this.style.top = `${outer.top}px`;
      if (this.hasAttribute('data-embedded')) { this.style.removeProperty('width'); this.style.removeProperty('left'); this.style.removeProperty('top'); }
      return;
    }
    const width = this.#prefs.hidden ? this.#el('.dock').offsetWidth : 268;
    this.style.width = `${width}px`;
    const height = this.#prefs.hidden ? this.#el('.dock').offsetHeight : this.#el('.wrap').offsetHeight;
    this.#position = clampPosition(this.#position, { width: innerWidth, height: innerHeight }, { width, height });
    this.style.left = `${this.#position.x}px`; this.style.top = `${this.#position.y}px`;
    this.style.setProperty('--pet-top', `${this.#position.y}px`); this.style.setProperty('--pet-left', `${this.#position.x}px`);
  }
  #save() {
    try { localStorage.setItem(this.#storageKey, JSON.stringify({ ...this.#prefs, position: this.#position, swap: this.#swap })); }
    catch { /* Optional preferences. */ }
  }

  /** The pet is tucked into a host brand slot: the outer box and the badge inside it. */
  #slot() {
    if (!this.#logoAnchor?.length) return null;
    const outer = this.#logoAnchor[0];
    return { outer, inner: this.#logoSwap(outer.size) };
  }
  #logoSwap() { return { width: 56, height: 64, size: 64, radius: '0px', x: 0, y: 0 }; }
  #nudge(dx, dy, badge) {
    if (!badge) this.setPosition(this.#position.x + dx, this.#position.y + dy);
  }
  #relocate(parent) {
    if (!parent || this.parentNode === parent) return;
    const wasConnected = this.isConnected;
    this.#relocating = wasConnected;
    try { parent.append(this); } finally { this.#relocating = false; }
  }
  attachSidebarSlot(container) {
    if (this.#sidebarSlot === container) return;
    if (!this.#floatingParent) this.#floatingParent = this.parentNode;
    if (this.parentNode === this.#sidebarSlot) this.#relocate(this.#floatingParent || document.body);
    this.#sidebarSlot = container;
    if (this.#prefs.hidden && container) this.#renderLogoHome(true);
    this.#measure(); this.#render(); this.#place();
  }
  /** Take over a host brand slot so the tucked-away pet lives there. */
  attachBrandSlot(anchor, frame) {
    this.#home = { anchor, frame }; this.#logoAnchor = []; this.#measure();
    if (this.#prefs.hidden) this.#renderLogoMark();
    this.#render(); this.#place(); this.#save();
  }
  detachBrandSlot() {
    if (!this.#home) return false;
    this.#home = null; this.#logoAnchor = null; this.#stopFly();
    this.#renderLogoMark(); this.#render(); this.#place(); this.#save(); this.#renderLogoHome(false);
    return true;
  }
  /** Re-measure the host slot, e.g. after a resize or a sidebar toggle. */
  measureBrandSlot() {
    if (!this.#home) return;
    this.#measure();
    if (this.#prefs.hidden) this.#renderLogoMark(); else if (!this.#overlay?.animations?.length) this.#renderLogoHome(false);
    this.#render(); this.#place();
  }
  /** Ask the host to hide (true) or restore (false) its own brand mark. */
  #renderLogoHome(hold) { this.dispatchEvent(new CustomEvent('dsh-pet:brand', { detail: { hidden: hold, settled: !hold }, bubbles: true, composed: true })); }
  #restoreBrand(delay) {
    if (!this.#home) return;
    this.#renderLogoHome(false);
    clearTimeout(this.#brandTimer);
    this.#brandTimer = setTimeout(this.#guard(() => { this.#renderLogoMark(); this.#place(); }), delay);
  }
  #measure() {
    if (!this.#home) return;
    const inline = this.#sidebarSlot?.isConnected ? this.#sidebarSlot.getBoundingClientRect() : null;
    if (inline?.width >= 120) {
      this.#logoAnchor = [{ width: inline.width, height: 64, size: 64, left: inline.left, top: inline.top }];
      this.#logoSize = 64; this.#logoRadius = '0px'; return;
    }
    if (this.#sidebarSlot) { this.#logoAnchor = []; this.#renderLogoHome(false); return; }
    const anchor = this.#home.anchor?.(), box = anchor?.getBoundingClientRect?.();
    if (!box?.width) { this.#logoAnchor = []; this.#renderLogoHome(false); return; }
    const frameElement = this.#home.frame?.(), frame = frameElement?.getBoundingClientRect?.();
    // Reserve one compact header row: a full 64px figure with its task card beside it.
    const left = Math.max(8, frame?.width ? frame.left + 4 : box.left);
    const top = Math.max(8, frame?.width ? frame.top + 4 : box.top - 20);
    let column = anchor.closest('[data-sidebar],aside,nav')?.getBoundingClientRect();
    // The shell also uses an ordinary div for its column; a 56px rail must not
    // receive a wide task card just because no semantic sidebar tag is present.
    if (!column) for (let node = anchor.parentElement; node && node !== document.body; node = node.parentElement) {
      const rect = node.getBoundingClientRect();
      if (rect.width <= 420 && rect.height >= Math.min(240, innerHeight / 2)) { column = rect; break; }
    }
    const controls = frameElement ? [...frameElement.children].filter(node => !node.contains(anchor))
      .map(node => node.getBoundingClientRect()).filter(rect => rect.width && rect.left > box.right) : [];
    const right = Math.min(frame?.right ?? Infinity, ...controls.map(rect => rect.left - 8));
    const width = Math.min(296, frame?.width ? right - left - 4 : column?.width ? column.width - 16 : 256, innerWidth - left - 8);
    if (width < 56) { this.#logoAnchor = []; this.#renderLogoHome(false); return; }
    this.#logoAnchor = [{ width, height: 64, size: 64, left, top }];
    this.#logoSize = 64; this.#logoRadius = '0px';
  }
  #renderLogoMark() {
    const mark = this.#el('.logo-mark'); if (!mark) return;
    const { name, sheet } = this.character, slot = this.#slot(), capped = !!slot && this.#prefs.hidden;
    this.#logoMarkShown = capped;
    mark.hidden = !capped; mark.style.transform = `translate(${capped ? this.#logoSwap(this.#logoSize).x : 0}px,${capped ? this.#logoSwap(this.#logoSize).y : 0}px)`;
    mark.style.setProperty('--logo-w', '56px');
    mark.style.setProperty('--logo-h', '64px');
    mark.style.setProperty('--logo-radius', this.#logoRadius || '50%');
    const state = this.#sleeping ? 'sleeping' : this.snapshot.status;
    this.dataset.logoState = state;
    mark.setAttribute('aria-label', `${name}在这里，点击唤出${name}`);
    mark.title = `${name}在这里 · ${STATES[state].label} · 点击展开`;
    const sprite = this.#el('.sprite', mark), vector = this.#el('.vector', mark);
    vector.hidden = !!sheet; sprite.hidden = !sheet;
    if (sheet && sprite.dataset.character !== this.#prefs.character) { sprite.style.backgroundImage = `url("${sheet}")`; sprite.dataset.character = this.#prefs.character; }
    const [row, frames] = SPRITE_ROWS[state] || SPRITE_ROWS.idle;
    if (sheet && capped) this.#logoPlayer.play({ row, frames, speed: this.#prefs.speed, paused: document.hidden || this.#prefs.still || this.#motion?.matches || state === 'sleeping', column: 1 });
    else this.#logoPlayer.stop();
    // While parked in the host slot the bubble carries the explicit way back.
    const restore = this.#el('.bubble-restore');
    restore.hidden = !capped || this.#bubbleDismissed || !this.#prefs.showBubble;
    this.#el('.restore-label', restore).textContent = `恢复${name}`;
    restore.title = `展开${name}`;
    restore.setAttribute('aria-label', `恢复${name}，回到原来的位置`);
    if (!capped) return;
    if (this.#prefs.hidden) this.#renderLogoHome(true);
    this.#applySwap();
  }
  /** Move the badge inside the slot: negative offsets toward the outer edge. */
  #applySwap() { this.#el('.logo-mark').style.transform = ''; }
  /** Screen box of the full figure, preserving the sprite cell aspect ratio. */
  #cast() {
    const slot = this.#slot(); if (!slot) return null;
    return { left: slot.outer.left, top: slot.outer.top, size: 64, w: 56, h: 64, radius: '0px' };
  }
  /** Screen box the floating pet occupies, used as the start or end of a glide. */
  #homeBox() {
    const rect = this.#el('.pet').getBoundingClientRect(), size = rect.width || SIZES[this.#prefs.size];
    return { left: rect.left + (rect.width - size) / 2, top: rect.top + (rect.height - size) / 2, size, radius: '0px' };
  }
  #overlayLayer() {
    if (!this.#overlay) {
      const element = document.createElement('div'); element.className = 'overlay'; element.style.display = 'none';
      // The layer lives outside the shadow root, so it carries its own reset.
      const sheet = document.createElement('style'); sheet.textContent = overlayStyles; element.append(sheet);
      const flyer = document.createElement('div'); flyer.className = 'flyer'; element.append(flyer);
      this.#overlay = { element, flyer };
    }
    // The flight is a page-level layer: it must escape the fixed host box and its
    // shadow scope, or the pet could not travel to a slot elsewhere in the frame.
    if (!this.#overlay.element.isConnected) document.body.append(this.#overlay.element);
    return this.#overlay;
  }
  #stopFly() {
    cancelAnimationFrame(this.#handOver);
    this.#el('.pet').style.visibility = '';
    if (!this.#overlay) return;
    this.#overlay.animations?.forEach(animation => animation.cancel());
    this.#overlay.animations = []; this.#overlay.player?.stop();
    this.#overlay.element.style.display = 'none';
  }
  #flyer(box, phase) {
    const { element, flyer } = this.#overlayLayer(), { sheet, name } = this.character;
    flyer.dataset.phase = phase; flyer.dataset.character = name;
    flyer.innerHTML = `<span class="cast">${sheet ? '<span class="sprite"></span>' : `<span class="vector">${petArt}</span>`}</span><i class="landing-dot"></i>`;
    this.#overlay.player?.stop();
    const sprite = this.#el('.sprite', flyer);
    if (sheet) { sprite.hidden = false; sprite.style.backgroundImage = `url("${sheet}")`; }
    this.#overlay.player = new SpritePlayer(sprite, error => this.#fail(error));
    const still = this.#prefs.still || this.#motion?.matches;
    if (sheet) this.#overlay.player.play({ row: SPRITE_ROWS.waving[0], frames: SPRITE_ROWS.waving[1], speed: this.#prefs.speed * 1.4, paused: still });
    flyer.style.width = `${box.w ?? box.size}px`; flyer.style.height = `${box.h ?? box.size}px`;
    flyer.style.setProperty('--avatar-radius', box.radius || '50%');
    element.style.display = ''; element.dataset.still = String(!!still);
    return box;
  }
  /**
   * Glide the pet between its floating home and the host brand slot.
   * With reduced motion the badge simply fades in place.
   */
  #glide(from, to, phase, onArrive) {
    this.#stopFly();
    const { flyer } = this.#overlayLayer(), still = this.#prefs.still || this.#motion?.matches;
    this.#flyer(from, phase);
    // The flyer now stands exactly where the parked pet was; hide that copy one frame
    // later so the hand-over never shows both or neither.
    const parked = this.#el('.pet');
    const hide = () => { if (this.#overlay?.element.style.display !== 'none') parked.style.visibility = 'hidden'; };
    cancelAnimationFrame(this.#handOver); this.#handOver = requestAnimationFrame(this.#guard(hide));
    if (still) { this.#stopFly(); onArrive(); return; }
    const center = box => [box.left, box.top];
    const [x0, y0] = center(from), [x1, y1] = center(to), lift = Math.min(90, Math.hypot(x1 - x0, y1 - y0) * 0.22);
    const keyframes = [
      { transform: `translate(${x0}px,${y0}px)` },
      { transform: `translate(${(x0 + x1) / 2}px,${(y0 + y1) / 2 - lift}px)`, offset: 0.55 },
      { transform: `translate(${x1}px,${y1}px)` }
    ];
    const swing = box => ({ width: `${box.w ?? box.size}px`, height: `${box.h ?? box.size}px`, borderRadius: box.radius });
    const size = [swing(from), swing(to)];
    const cast = this.#el('.cast', flyer), timing = glide(430);
    const move = flyer.animate(keyframes, timing);
    const shrink = flyer.animate(size, timing);
    const hop = cast.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-9%)', offset: 0.55 }, { transform: 'translateY(0)' }], timing);
    this.#overlay.animations = [move, shrink, hop];
    move.addEventListener('finish', this.#guard(() => { if (this.#overlay.animations?.includes(move)) { this.#stopFly(); onArrive(); } }));
    for (const animation of [move, shrink, hop]) animation.finished.catch(() => {});
  }
  #animate() {
    if (!this.isConnected || !this.character.sheet || this.#prefs.hidden || document.hidden) { this.#player.stop(); return; }
    const state = this.#dragDirection || this.dataset.state;
    let [row, frames] = SPRITE_ROWS[state] || SPRITE_ROWS.idle, column = 0;
    if (this.#look !== undefined && state === 'idle') { row = this.#look < 8 ? 9 : 10; frames = 1; column = this.#look % 8; }
    this.#player.play({ row, frames, column, speed: this.#prefs.speed, paused: this.#prefs.still || this.#motion?.matches || state === 'sleeping' });
  }
  #renderFeedback() {
    this.#el('.interaction-feedback').textContent = this.#feedback; this.#el('.interaction-feedback').hidden = !this.#feedback;
    this.#el('.emote-badge').hidden = !this.hasAttribute('data-emote');
  }
  #render() {
    const embedded = this.#prefs.hidden && this.#sidebarSlot?.isConnected && !!this.#logoAnchor?.length;
    if (embedded) {
      if (!this.#floatingParent) this.#floatingParent = this.parentNode;
      this.#relocate(this.#sidebarSlot);
    } else if (this.parentNode === this.#sidebarSlot && this.#sidebarSlot) this.#relocate(this.#floatingParent || document.body);
    this.toggleAttribute('data-embedded', !!embedded);
    const { status, task, tasks } = this.snapshot; const current = this.#sleeping ? 'sleeping' : status; const { name, sheet } = this.character;
    this.dataset.state = current; this.dataset.character = this.#prefs.character;
    this.#el('.status').textContent = STATES[current].label;
    this.#el('.task-title').textContent = this.#sleeping ? `${name}休息中` : task?.title ?? `${name}在这里，陪你一起做事。`;
    this.#el('.message').textContent = this.#sleeping ? STATES.sleeping.message : task?.message ?? STATES.idle.message;
    this.#el('.bubble').title = `${this.#el('.task-title').textContent}\n${this.#el('.message').textContent}`;
    this.#el('.bubble-shell').hidden = !this.#prefs.showBubble;
    this.#el('.bubble').hidden = this.#bubbleDismissed;
    this.#el('.bubble-close').hidden = this.#bubbleDismissed || (this.#prefs.hidden && !!this.#logoAnchor?.length);
    this.#el('.count').textContent = tasks.length > 1 ? `${tasks.length} 个任务` : '';
    this.#el('.effect').textContent = ({ sleeping: 'z', waiting: '?', error: '!', working: '·' }[current] ?? '✦');
    // The compact figure and task card share the sidebar header while tucked.
    this.#el('.wrap').hidden = this.#prefs.hidden && !this.#logoAnchor?.length;
    this.#el('.pet').hidden = this.#prefs.hidden;
    this.#el('.toolbar').hidden = this.#prefs.hidden;
    this.toggleAttribute('data-parked', this.#prefs.hidden && !!this.#logoAnchor?.length);
    this.#el('.dock').hidden = !this.#prefs.hidden || !!this.#logoAnchor?.length;
    this.#el('.dock span').textContent = `${name}在这里`; this.#el('.dock').setAttribute('aria-label', `唤醒${name}`);
    this.#el('.dock').title = task ? `${STATES[status].label}：${task.title}` : `唤醒${name}`;
    this.#el('.name').textContent = name; this.#el('.pat').setAttribute('aria-label', `摸摸${name}`);
    this.#el('.pat').hidden = !this.#prefs.interactions;
    this.#el('.pet').setAttribute('aria-label', `摸摸${name}；${this.#prefs.locked ? '位置已锁定' : '可拖动，或用方向键移动'}`);
    this.#el('.pet').style.cursor = this.#prefs.locked ? 'pointer' : 'grab';
    this.#el('.vector').hidden = !!sheet; this.#el('.sprite').hidden = !sheet;
    if (sheet && this.#el('.sprite').dataset.character !== this.#prefs.character) { this.#el('.sprite').style.backgroundImage = `url("${sheet}")`; this.#el('.sprite').dataset.character = this.#prefs.character; }
    this.style.setProperty('--pet-fill', colors[this.#prefs.theme][0]); this.style.setProperty('--pet-inner', colors[this.#prefs.theme][1]);
    this.style.setProperty('--pet-size', `${SIZES[this.#prefs.size]}px`);
    this.style.visibility = ''; this.toggleAttribute('data-still', this.#prefs.still); this.#renderFeedback(); this.#animate();
    if (this.#home || this.#logoMarkShown) this.#renderLogoMark();
  }
}
// New identity avoids the previous version's immutable Custom Element during HMR.
const ELEMENT_TAG = 'dsh-pet-v7';
if (!customElements.get(ELEMENT_TAG)) customElements.define(ELEMENT_TAG, DshPet);
export function createPet({ container = document.body, storageKey, onOpenTask, onError, ...options } = {}) {
  const element = document.createElement(ELEMENT_TAG);
  element.setErrorHandler(onError);
  if (storageKey) element.setAttribute('storage-key', storageKey); container.append(element);
  try {
    if (element.failure) throw element.failure;
    element.configure(options);
    if (element.failure) throw element.failure;
  } catch (error) { element.remove(); throw error; }
  const open = event => onOpenTask?.(event.detail); element.addEventListener('dsh-pet:open-task', open);
  return { element, updateTask: task => element.updateTask(task), removeTask: id => element.removeTask(id), clearTasks: () => element.clearTasks(),
    show: () => element.show(), hide: () => element.hide(), configure: options => element.configure(options), openSettings: () => element.openSettings(),
    destroy: () => { element.removeEventListener('dsh-pet:open-task', open); element.remove(); }
  };
}
