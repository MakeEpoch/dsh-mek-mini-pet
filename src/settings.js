import { CHARACTERS } from './characters.js';
import { petArt } from './art.js';

const css = `:host{display:block;font:14px/1.6 system-ui,-apple-system,"Segoe UI",sans-serif;color:#344b43;color-scheme:light}[hidden]{display:none!important}*{box-sizing:border-box}h2,h3,p{margin:0}h2{font-size:22px;font-weight:650}h3{font-size:13px;margin-bottom:12px;color:#75816f}p{color:#819078;font-size:12px}.panel{max-width:650px;padding:6px}header{margin-bottom:24px}.cards{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:26px}button,select,input{font:inherit}button{cursor:pointer;color:inherit}.card{background:#f7f9f2;border:1px solid #dce5d5;border-radius:16px;padding:16px;display:flex;gap:12px;text-align:left;align-items:center}.card[aria-pressed=true]{border:2px solid #73996c;background:#edf3e6;padding:15px}.card strong{display:block;font-size:14px}.card small{display:block;color:#7e8b77;font-size:11px}.thumb{width:58px;height:64px;flex-shrink:0}.thumb svg{width:100%;height:100%}.sprite-thumb{background-repeat:no-repeat;background-size:800% 1100%;background-position:0 0}.rows{display:grid;gap:0}.row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:13px 0;border-bottom:1px solid #edf0e7}.row span{display:block;font-size:13px}.row small{display:block;font-size:11px;color:#8b9483}select{border:1px solid #d4decf;border-radius:9px;padding:7px;background:#fffef9;color:#486046;min-width:110px}input[type=checkbox]{accent-color:#73996c;width:18px;height:18px}.actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:22px}.actions button{background:#f3f7ed;border:1px solid #d5e0cc;border-radius:10px;padding:9px 13px;font-size:12px}.feedback{min-height:24px;font-size:12px;color:#54824f;margin-top:12px}.foot{font-size:11px;color:#949e8c;margin-top:12px}button:focus-visible,select:focus-visible,input:focus-visible{outline:3px solid #8aab76;outline-offset:3px}@media(max-width:450px){.card{padding:10px;gap:6px;align-items:center}.card[aria-pressed=true]{padding:9px}.thumb{width:42px;height:46px}.card small{font-size:10px}.row{gap:9px}h2{font-size:19px}}`;

export class PetSettings extends HTMLElement {
  #pet; #abort; #listen;
  constructor() {
    super(); this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `<style>${css}</style><section class="panel" aria-label="小宠物设置"><header><h2>小宠物</h2><p>选一个熟悉的伙伴，让陪伴按你的习惯来。</p></header><h3>选择角色</h3><div class="cards"><button class="card" data-character="xiaoyin" aria-pressed="false"><span class="thumb sprite-thumb"></span><span><strong>小音</strong><small>图集动画角色</small></span></button><button class="card" data-character="dousha" aria-pressed="false"><span class="thumb">${petArt}</span><span><strong>豆沙</strong><small>原创豆沙兔</small></span></button></div><h3>外观与行为</h3><div class="rows">
      <label class="row"><span>显示大小<small>角色大小，不影响页面布局</small></span><select class="size" data-setting="size" aria-label="宠物体型"><option value="mini">迷你（56px）</option><option value="tiny">袖珍（80px）</option><option value="small">小小只（112px）</option><option value="medium">刚刚好</option><option value="large">大一点</option></select></label>
      <label class="row"><span>外衣<small class="theme-help">豆沙可换色，小音保持原始配色</small></span><select class="theme" data-setting="theme" aria-label="宠物外衣"><option value="mint">鼠尾草</option><option value="peach">奶桃</option><option value="lilac">芋泥</option></select></label>
      <label class="row"><span>减少动画<small>系统减少动态效果设置也会生效</small></span><input type="checkbox" data-setting="still" aria-label="减少动画"></label>
      <label class="row"><span>动画速度</span><select data-setting="speed" aria-label="动画速度"><option value="0.75">慢一点</option><option value="1">标准</option><option value="1.25">快一点</option></select></label>
      <label class="row"><span>允许摸摸互动<small>关闭后隐藏爱心按钮；摸摸只弹爱心</small></span><input type="checkbox" data-setting="interactions" aria-label="允许摸摸互动"></label>
      <label class="row"><span>显示任务气泡<small>收起宠物后可点角落按钮唤醒</small></span><input type="checkbox" data-setting="showBubble" aria-label="显示任务气泡"></label>
      <label class="row"><span>锁定位置<small>避免误拖动；点击互动仍可使用</small></span><input type="checkbox" data-setting="locked" aria-label="锁定位置"></label>
    </div><div class="actions"><button data-action="pat">♡ 试试摸摸</button><button data-action="show">显示宠物</button><button data-action="reset">位置复位</button><button data-action="defaults">恢复默认</button></div><p class="feedback" role="status" aria-live="polite"></p><p class="foot">修改后自动保存到当前浏览器。角色状态来自 dsh 会话，互动不会改变任务结果。</p></section>`;
    this.shadowRoot.querySelector('.sprite-thumb').style.backgroundImage = `url("${CHARACTERS.xiaoyin.sheet}")`;
  }
  #safe(fn) {
    return (...args) => {
      if (this.#pet?.failure) return;
      try { return fn(...args); }
      catch (error) { this.#pet?.reportError(error); this.#abort?.abort(); this.#listen?.abort(); }
    };
  }
  set pet(value) { this.#listen?.abort(); this.#pet = value; this.#safe(() => { this.#bind(); this.#sync(); })(); }
  get pet() { return this.#pet; }
  connectedCallback() { this.#safe(() => this.#connect())(); }
  #connect() {
    this.#abort?.abort(); this.#abort = new AbortController();
    const on = (type, fn) => this.shadowRoot.addEventListener(type, this.#safe(fn), { signal: this.#abort.signal });
    on('change', event => {
      const input = event.target; const key = input.dataset.setting;
      if (!key || !this.#pet) return;
      const value = input.type === 'checkbox' ? input.checked : key === 'speed' ? Number(input.value) : input.value;
      this.#pet.configure({ [key]: value }); this.#message('设置已保存');
    });
    on('click', event => {
      const button = event.target.closest('button'); if (!button || !this.#pet) return;
      if (button.dataset.character) { this.#pet.configure({ character: button.dataset.character }); this.#message(`已切换到${CHARACTERS[button.dataset.character].name}`); }
      const action = button.dataset.action;
      if (action === 'pat') this.#pet.pat();
      if (action === 'show') { this.#pet.show(); this.#message('宠物已显示'); }
      if (action === 'reset') { this.#pet.resetPosition(); this.#message('位置已复位'); }
      if (action === 'defaults') { this.#pet.resetPreferences(); this.#message('已恢复默认设置'); }
    });
    this.#bind(); this.#sync();
  }
  disconnectedCallback() { this.#abort?.abort(); this.#listen?.abort(); }
  #bind() {
    this.#listen?.abort(); if (!this.#pet || !this.isConnected) return;
    this.#listen = new AbortController();
    this.#pet.addEventListener('dsh-pet:preferences', this.#safe(() => this.#sync()), { signal: this.#listen.signal });
    this.#pet.addEventListener('dsh-pet:feedback', this.#safe(event => this.#message(event.detail.message)), { signal: this.#listen.signal });
  }
  #message(text) { this.shadowRoot.querySelector('.feedback').textContent = text; }
  #sync() {
    if (!this.#pet) return; const prefs = this.#pet.preferences;
    for (const button of this.shadowRoot.querySelectorAll('[data-character]')) button.setAttribute('aria-pressed', String(button.dataset.character === prefs.character));
    for (const input of this.shadowRoot.querySelectorAll('[data-setting]')) {
      if (input.type === 'checkbox') input.checked = prefs[input.dataset.setting]; else input.value = String(prefs[input.dataset.setting]);
    }
    this.shadowRoot.querySelector('[data-action="pat"]').hidden = !prefs.interactions;
    this.shadowRoot.querySelector('.theme').disabled = prefs.character !== 'dousha';
  }
}
if (!customElements.get('dsh-pet-settings-v5')) customElements.define('dsh-pet-settings-v5', PetSettings);
