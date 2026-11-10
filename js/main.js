import * as store from './store.js';
import { speak, stopSpeak, sfx, pickPraise, setGuide } from './audio.js';
import { SAY, QUIZ, storySay } from './lines.js';
import { GUIDES } from './voices.js';
import { STORY } from './story.js';
import { Writer } from './writer.js';

const app = document.getElementById('app');
const IMG = n => `assets/img/${n}.webp`;
const today = () => new Date().toLocaleDateString('sv');   // YYYY-MM-DD
const isNight = () => {
  const q = new URLSearchParams(location.search);
  if (q.has('night')) return true; if (q.has('day')) return false;   // 測試用：網址加 ?day 或 ?night
  const h = new Date().getHours(); return h >= 20 || h < 6;
};
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const EL = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };
const AVATARS = ['Avatar_samurai_boy', 'Avatar_samurai_red', 'Avatar_samurai_gold', 'Avatar_samurai_autumn', 'Avatar_prince_blue', 'Avatar_mage_barrier', 'Avatar_mage_golddragon'];
const PETS = {
  RaRa: { name: 'Rara 羊', el: '火＋土', img: 'RaRa_hatched', ride: null },
  Taki: { name: '青龍 Taki', el: '木', img: 'Taki_hatched', ride: 'fly' },
  QQ: { name: '朱雀 QQ', el: '火＋木', img: 'QQ_hatched', ride: 'fly' },
  Yuki: { name: '白虎 Yuki', el: '金', img: 'Yuki_hatched', ride: null },
  BuBu: { name: '玄武 BuBu', el: '水', img: 'BuBu_hatched', ride: 'swim' },
  Uni: { name: '麒麟 Uni', el: '土', img: 'Uni_hatched', ride: 'fly' },
};

let S = { kidId: null, kid: null, map: null, freeTripUsed: false };
const save = () => S.kid && store.saveKid(S.kidId, S.kid);
const name = () => esc(S.kid?.nickname || '小探險家');
const fill = t => t.replace(/\{n\}/g, S.kid?.nickname || '小探險家');

document.body.classList.toggle('night', isNight());

// 播放按鈕：在文字上面/前面用 QQ_cheer，在文字下面/後面用 QQ_cheer2
function playBtn(text, pos = 'above') {
  return `<button class="play ${pos}" data-say="${esc(text)}" aria-label="播放語音"><img src="${IMG(pos === 'above' ? 'QQ_cheer' : 'QQ_cheer2')}" alt=""><span>聽</span></button>`;
}
app.addEventListener('click', e => {
  const b = e.target.closest('.play'); if (!b) return;
  sfx.tap();
  if (b.classList.contains('on')) { stopSpeak(); b.classList.remove('on'); return; }
  document.querySelectorAll('.play.on').forEach(x => x.classList.remove('on'));
  b.classList.add('on'); speak(b.dataset.say, { onend: () => b.classList.remove('on') });
});

function screen(html, cls = '') {
  stopSpeak();
  if (S.map) { S.map.dispose(); S.map = null; }
  app.className = cls; app.innerHTML = html; app.scrollTop = 0;
}
function modal(html, cls = '') {
  const m = document.createElement('div'); m.className = 'modal-back';
  m.innerHTML = `<div class="modal ${cls}">${html}</div>`;
  document.body.appendChild(m);
  m.addEventListener('click', e => { if (e.target === m || e.target.closest('[data-close]')) { stopSpeak(); m.remove(); } });
  return m;
}
function toast(html, ms = 2600) {
  const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = html;
  document.body.appendChild(t); setTimeout(() => t.remove(), ms);
}
function praise(kind) {
  const [w, zy, mean] = pickPraise(kind);
  toast(`<img src="${IMG(kind === 'cheer' ? 'QQ_cheer2' : 'QQ_cheer')}" alt=""><div><b>${w}</b><small>${zy}</small><span>${mean}</span></div>`, 3200);
  speak(w);
}
function log(what, extra = {}) { S.kid.log.push({ day: today(), at: Date.now(), what, ...extra }); save(); }
function addMistake(key, { wrong = 0, hint = 0 }) {
  const m = S.kid.mistakes[key] || (S.kid.mistakes[key] = { wrong: 0, hint: 0, rightDays: [] });
  m.wrong += wrong; m.hint += hint; m.rightDays = []; save();
}

// ───────── 登入 ─────────
async function boot() {
  screen(`<div class="center"><img class="bob" src="${IMG('QQ_baby')}" width="140" alt=""><p>載入中…</p></div>`);
  const u = await store.init();
  if (u) return kidsScreen();
  loginScreen();
}

function loginScreen() {
  const on = store.online();
  screen(`
  <div class="login">
    <img class="hero bob" src="${IMG('QQ_incubator')}" alt="QQ 的孵蛋器">
    <h1>五行島的<br>種子守護者</h1>
    <p class="sub">和 QQ 一起，邊玩邊複習的島嶼探險</p>
    ${on ? `<button class="btn big gold" id="g">家長用 Google 登入</button>` : `<p class="warn">目前連不上雲端，可以先用試玩模式</p>`}
    <button class="btn ghost" id="guest">先試玩（只存在這台裝置）</button>
    <p class="fine">資料來源：中華民國教育部《國字標準字體筆順學習網》、教育部國語辭典</p>
  </div>`, 'scroll');
  document.getElementById('guest').onclick = () => { store.guest(); kidsScreen(); };
  const g = document.getElementById('g');
  if (g) g.onclick = async () => {
    g.disabled = true; g.textContent = '登入中…';
    try { const u = await store.signIn(); if (u) kidsScreen(); }
    catch (e) { g.disabled = false; g.textContent = '家長用 Google 登入'; toast(`登入沒有成功，請再試一次（${esc(e.code || e.message)}）`, 4000); }
  };
}

async function kidsScreen() {
  screen(`<div class="center"><p>讀取孩子資料…</p></div>`);
  let kids = [];
  try { kids = await store.listKids(); }
  catch (e) { toast('讀取資料失敗：請確認 Firestore 規則已設定。', 5000); console.warn(e); }
  const u = store.currentUser();
  screen(`
  <div class="page">
    <header class="bar"><h2>誰要去探險？</h2><button class="btn small ghost" id="out">${u.guest ? '回首頁' : '登出'}</button></header>
    <div class="kids">
      ${kids.map(k => `<button class="kid" data-id="${k.id}"><img src="${IMG(k.avatar)}" alt=""><b>${esc(k.nickname)}</b><small>${k.grade} 年級・${esc(k.version)}</small></button>`).join('')}
      <button class="kid add" id="add"><span>＋</span><b>新增孩子</b></button>
    </div>
  </div>`, 'scroll');
  document.getElementById('out').onclick = async () => { await store.signOut(); loginScreen(); };
  document.getElementById('add').onclick = newKidScreen;
  app.querySelectorAll('.kid[data-id]').forEach(b => b.onclick = () => {
    const k = kids.find(x => x.id === b.dataset.id);
    S.kidId = k.id; S.kid = { ...k }; delete S.kid.id; S.freeTripUsed = false; setGuide(S.kid.guide);
    S.kid.storySeen ? mapScreen() : storyScreen(0);
  });
}

function newKidScreen() {
  screen(`
  <div class="page">
    <header class="bar"><button class="btn small ghost" id="back">‹ 返回</button><h2>建立孩子檔案</h2><span></span></header>
    <form class="form" id="f" novalidate>
      <label>暱稱 <em>必填</em><input name="nickname" maxlength="12" placeholder="例如：Taki"></label>
      <label>就讀年級 <em>必填</em>
        <div class="seg" data-name="grade">${[1, 2, 3, 4, 5, 6].map(g => `<button type="button" data-v="${g}">${g}</button>`).join('')}</div></label>
      <label>國語課本版本 <em>必填</em>
        <div class="seg" data-name="version">
          <button type="button" data-v="南一">南一</button>
          <button type="button" data-v="康軒" disabled>康軒<small>即將推出</small></button>
          <button type="button" data-v="翰林" disabled>翰林<small>即將推出</small></button></div></label>
      <label>性別 <span class="opt">選填</span>
        <div class="seg" data-name="gender"><button type="button" data-v="男生">男生</button><button type="button" data-v="女生">女生</button><button type="button" data-v="">不填</button></div></label>
      <label>選一隻神獸當你的嚮導 <em>聲音</em>
        <div class="guides">${GUIDES.map(g => `<div class="guide ${g.id === 'QQ' ? 'sel' : ''}" data-g="${g.id}"><img src="${IMG(g.img)}" alt=""><b>${g.name}</b><small>${g.gender}</small><button type="button" class="btn small" data-hear="${g.id}">試聽</button></div>`).join('')}</div></label>
      <label>年齡 <span class="opt">選填</span><input name="age" type="number" inputmode="numeric" min="4" max="15" placeholder="例如：8"></label>
      <p class="err" id="err"></p>
      <p class="fine">只收遊戲需要的資料，不需要真實姓名或照片。</p>
      <button class="btn big gold" type="submit">下一步：選造型</button>
    </form>
  </div>`, 'scroll');
  const val = { guide: 'QQ' };
  bindGuides(app, g => val.guide = g);
  app.querySelectorAll('.seg').forEach(seg => seg.querySelectorAll('button:not([disabled])').forEach(b => b.onclick = () => {
    seg.querySelectorAll('button').forEach(x => x.classList.remove('sel')); b.classList.add('sel');
    val[seg.dataset.name] = b.dataset.v; document.getElementById('err').textContent = '';
  }));
  document.getElementById('back').onclick = kidsScreen;
  document.getElementById('f').onsubmit = async e => {
    e.preventDefault();
    const f = e.target, nick = f.nickname.value.trim();
    const err = document.getElementById('err');
    if (!nick) return err.textContent = '請輸入暱稱';
    if (!val.grade) return err.textContent = '請選擇年級';
    if (!val.version) return err.textContent = '請選擇課本版本';
    const kid = store.newKid({ nickname: nick, grade: val.grade, version: val.version, gender: val.gender, age: f.age.value, guide: val.guide });
    setGuide(kid.guide);
    try { S.kidId = await store.createKid(kid); S.kid = kid; S.freeTripUsed = false; avatarScreen(true); }
    catch (e2) { err.textContent = '存檔失敗，請確認網路和 Firestore 規則。'; console.warn(e2); }
  };
}

function bindGuides(root, onPick) {
  root.querySelectorAll('.guide').forEach(d => d.onclick = e => {
    const g = GUIDES.find(x => x.id === d.dataset.g);
    if (e.target.closest('[data-hear]')) { sfx.tap(); speak(g.sample, { as: g.id }); return; }
    root.querySelectorAll('.guide').forEach(x => x.classList.remove('sel')); d.classList.add('sel'); onPick(g.id);
  });
}
function guideModal() {
  const m = modal(`<h3>換嚮導神獸</h3><p class="sub">選一隻神獸陪你說話</p>
    <div class="guides">${GUIDES.map(g => `<div class="guide ${g.id === (S.kid.guide || 'QQ') ? 'sel' : ''}" data-g="${g.id}"><img src="${IMG(g.img)}" alt=""><b>${g.name}</b><small>${g.gender}</small><button type="button" class="btn small" data-hear="${g.id}">試聽</button></div>`).join('')}</div>
    <button class="btn gold" data-close>好了</button>`);
  bindGuides(m, g => { S.kid.guide = g; setGuide(g); save(); });
}

function avatarScreen(first = false) {
  screen(`
  <div class="page">
    <header class="bar">${first ? '<span></span>' : '<button class="btn small ghost" id="back">‹ 返回</button>'}<h2>選擇這次的造型</h2><span></span></header>
    <div class="avatars">${AVATARS.map(a => `<button class="av ${S.kid.avatar === a ? 'sel' : ''}" data-a="${a}"><img src="${IMG(a)}" alt=""></button>`).join('')}</div>
    <button class="btn big gold" id="ok">${first ? '就決定是你了！' : '換好了'}</button>
  </div>`, 'scroll');
  app.querySelectorAll('.av').forEach(b => b.onclick = () => {
    sfx.tap(); app.querySelectorAll('.av').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); S.kid.avatar = b.dataset.a;
  });
  const back = document.getElementById('back'); if (back) back.onclick = mapScreen;
  document.getElementById('ok').onclick = () => { save(); first ? storyScreen(0) : mapScreen(); };
}

// ───────── 開場故事 ─────────
function storyScreen(i, fromMap = false) {
  const p = STORY[i];
  const imgs = p.img.map(n => n === '{avatar}' ? S.kid.avatar : n);
  const text = fill(p.text);
  const say = storySay(p);
  screen(`
  <div class="story">
    <div class="story-top"><span class="dots">${STORY.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</span>
      <button class="btn small ghost" id="skip">${fromMap || S.kid.storySeen ? '關閉' : '跳過'}</button></div>
    <div class="story-art">${imgs.map((n, k) => `<img class="pop" style="animation-delay:${k * 0.15}s" src="${IMG(n)}" alt="">`).join('')}</div>
    ${p.eggs ? `<div class="eggs">${p.eggs.map(n => `<img class="sleepy" src="${IMG(n)}" alt="">`).join('')}</div>` : ''}
    <div class="scroll-paper">
      ${playBtn(say, 'above')}
      <h3>${p.title}</h3>
      ${text.split('\n').map(l => `<p>${esc(l)}</p>`).join('')}
      ${p.ask ? `<p class="ask">💬 ${p.ask}</p>` : ''}
      <div class="choices">${p.choices.map(c => `<button class="btn choice">${c}</button>`).join('')}</div>
    </div>
  </div>`, 'scroll paper-bg');
  app.querySelectorAll('.choice').forEach(b => b.onclick = () => {
    sfx.tap();
    if (i < STORY.length - 1) return storyScreen(i + 1, fromMap);
    S.kid.storySeen = true; save();
    fromMap || S.kid.progress.trial?.done ? mapScreen() : trialScreen();
  });
  document.getElementById('skip').onclick = () => { S.kid.storySeen = true; save(); fromMap || S.kid.progress.trial?.done ? mapScreen() : trialScreen(); };
}

// ───────── 3D 地圖 ─────────
async function mapScreen() {
  const k = S.kid;
  const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
  screen(`
  <div class="hud">
    <button class="me" id="me"><img src="${IMG(k.avatar)}" alt=""><b>${name()}</b></button>
    <div class="wallet">
      <span><img src="${IMG('coin')}" alt="金幣">${k.coins}</span>
      <span><img src="${IMG('Seed_wood')}" alt="種子">${sum(k.seeds)}</span>
      <span><img src="${IMG('Gem_fire')}" alt="寶石">${sum(k.gems)}</span>
    </div>
    <button class="btn small ghost" id="parent">家長</button>
  </div>
  <div class="map" id="map"></div>
  <div class="map-tip">${isNight() ? '🌙 晚安時間，星星出來了！' : '用手指轉動地圖，點島嶼出發'}</div>`, 'full');
  document.getElementById('me').onclick = meMenu;
  document.getElementById('parent').onclick = parentGate;
  const { createMap } = await import('./map3d.js');
  S.map = createMap(document.getElementById('map'), { night: isNight(), onPick: pickPlace });
  S.map.setMarker(k.location, k.avatar, k.pet);
  if (!k.progress.trial?.done) setTimeout(() => pickPlace('taiwan'), 600);
}

function meMenu() {
  const m = modal(`
    <h3>${name()} 的背包</h3>
    <div class="bag">
      ${Object.keys(EL).map(e => `<div><img src="${IMG('Seed_' + e)}" alt=""><b>${S.kid.seeds[e]}</b><small>${EL[e]}種子</small></div>`).join('')}
      ${Object.keys(EL).map(e => `<div><img src="${IMG('Gem_' + e)}" alt=""><b>${S.kid.gems[e]}</b><small>${EL[e]}寶石</small></div>`).join('')}
    </div>
    <div class="row"><button class="btn" id="av">換造型</button><button class="btn" id="pet">我的靈獸</button><button class="btn" id="st">聽故事</button><button class="btn" id="gd">換嚮導</button></div>
    <button class="btn ghost" data-close>關閉</button>`);
  m.querySelector('#av').onclick = () => { m.remove(); avatarScreen(); };
  m.querySelector('#pet').onclick = () => { m.remove(); petsModal(); };
  m.querySelector('#st').onclick = () => { m.remove(); storyScreen(0, true); };
  m.querySelector('#gd').onclick = () => { m.remove(); guideModal(); };
}

function petsModal() {
  const has = Object.keys(S.kid.pets);
  const m = modal(`
    <h3>我的靈獸夥伴</h3>
    <p class="sub">選一隻一起去探險</p>
    <div class="pets">${Object.entries(PETS).map(([id, p]) => {
      const ok = has.includes(id);
      return `<button class="pet ${ok ? '' : 'locked'} ${S.kid.pet === p.img ? 'sel' : ''}" data-id="${id}" ${ok ? '' : 'disabled'}>
        <img src="${IMG(ok ? p.img : id + '_egg')}" alt=""><b>${ok ? p.name : '？？？'}</b><small>${ok ? p.el : '還在蛋裡'}</small></button>`;
    }).join('')}</div>
    <button class="btn ghost" data-close>關閉</button>`);
  m.querySelectorAll('.pet:not(.locked)').forEach(b => b.onclick = () => {
    S.kid.pet = PETS[b.dataset.id].img; save(); sfx.tap(); m.remove(); mapScreen();
  });
}

function pickPlace(id) {
  sfx.tap();
  if (id === 'taiwan') return taiwanPanel();
  import('./map3d.js').then(({ PLACES, ARCH_NAME }) => {
    const p = PLACES[id];
    const here = S.kid.location === id;
    const m = modal(`
      <h3>${p.name}</h3>
      <p class="sub">${ARCH_NAME[p.arch]}${p.el ? `・五行屬「${EL[p.el]}」` : ''}</p>
      ${id === 'baihu' ? `<p>守護神獸：白虎 Yuki。<br>第一關〈最年輕的奶奶〉正在建造中，下一版開放！</p>` : `<p>這裡還在建造中，敬請期待！</p>`}
      ${here ? '<p class="ok">你現在就在這裡。</p>' : `<button class="btn big gold" id="go">出發去看看</button>`}
      <button class="btn ghost" data-close>關閉</button>`);
    const go = m.querySelector('#go');
    if (go) go.onclick = () => { m.remove(); transportModal(id); };
  });
}

function taiwanPanel() {
  const done = S.kid.progress.trial?.done;
  const n = Object.keys(S.kid.mistakes).length;
  const m = modal(`
    <h3>台灣島・福爾摩沙</h3>
    <p class="sub">出發點（五行屬「土」，在世界的正中央）</p>
    <div class="menu">
      <button class="tile" id="trial"><img src="${IMG('QQ_baby')}" alt=""><b>${done ? '再玩一次五行試煉' : '五行試煉'}</b><small>${done ? '已完成 ✓' : '第一個任務！'}</small></button>
      <button class="tile" id="story"><img src="${IMG('QQ_cheer')}" alt=""><b>QQ 故事屋</b><small>重聽開場故事</small></button>
      <button class="tile" id="dojo"><img src="${IMG('QQ_cheer2')}" alt=""><b>化輸為贏・修煉場</b><small>錯字怪 ${n} 隻</small></button>
      <button class="tile" id="pets"><img src="${IMG(S.kid.pets.RaRa ? 'RaRa_hatched' : 'RaRa_egg')}" alt=""><b>孵蛋神社</b><small>我的靈獸</small></button>
    </div>
    ${S.kid.location !== 'taiwan' ? `<button class="btn big gold" id="home">回台灣島</button>` : ''}
    <button class="btn ghost" data-close>關閉</button>`);
  m.querySelector('#trial').onclick = () => { m.remove(); trialScreen(); };
  m.querySelector('#story').onclick = () => { m.remove(); storyScreen(0, true); };
  m.querySelector('#pets').onclick = () => { m.remove(); petsModal(); };
  m.querySelector('#dojo').onclick = () => { m.remove(); dojoModal(); };
  const h = m.querySelector('#home'); if (h) h.onclick = () => { m.remove(); transportModal('taiwan'); };
}

function dojoModal() {
  const list = Object.entries(S.kid.mistakes);
  modal(`
    <h3>化輸為贏・修煉場</h3>
    <p class="sub">答錯或用過提示的字會變成錯字怪。在不同的三天各答對一次，就能打倒牠！</p>
    ${list.length ? `<div class="monsters">${list.map(([c, v]) => `<div class="mon"><b>${esc(c)}</b><small>${'⭐'.repeat(v.rightDays.length)}${'☆'.repeat(3 - v.rightDays.length)}</small></div>`).join('')}</div>
      <p class="fine">修煉場的練習關卡會在下一版開放。</p>` : `<p>目前沒有錯字怪，太厲害了！</p>`}
    <button class="btn ghost" data-close>關閉</button>`);
}

// ───────── 交通 ─────────
async function transportModal(dest) {
  const { PLACES, ARCH_NAME } = await import('./map3d.js');
  const from = PLACES[S.kid.location] || PLACES.taiwan, to = PLACES[dest];
  const sameArch = from.arch === to.arch && to.arch === 'chinese';
  const free = !S.freeTripUsed;
  const has = id => !!S.kid.pets[id];
  const opts = [
    sameArch && { id: 'cable', icon: '🚡', name: '纜車', cost: 0 },
    { id: 'glider', icon: '🪂', name: '滑翔翼', cost: 500 },
    { id: 'balloon', icon: '🎈', name: '熱氣球', cost: 1000 },
    { id: 'plane', icon: '✈️', name: '飛機', cost: 10000 },
    { id: 'Taki', icon: '🐉', name: '騎青龍', cost: 100, lock: !has('Taki') },
    { id: 'QQ', icon: '🐦', name: '騎朱雀 QQ', cost: 100, lock: !has('QQ') },
    { id: 'Uni', icon: '🦄', name: '騎麒麟', cost: 100, lock: !has('Uni') },
    { id: 'BuBu', icon: '🐢', name: '玄武泳渡', cost: 100, lock: !has('BuBu') },
  ].filter(Boolean);
  const m = modal(`
    <h3>前往 ${to.name}</h3>
    <p class="sub">從 ${from.name}（${ARCH_NAME[from.arch]}）出發</p>
    ${free ? '<p class="ok">🎁 這次登入的第一趟免費！</p>' : ''}
    <div class="rides">${opts.map(o => {
      const price = o.cost === 0 ? '免費' : free ? `<s>${o.cost}</s> 免費` : `${o.cost} 金幣`;
      const poor = !free && o.cost > S.kid.coins;
      return `<button class="ride" data-id="${o.id}" data-cost="${o.cost}" ${o.lock || poor ? 'disabled' : ''}>
        <span class="ic">${o.icon}</span><b>${o.name}</b><small>${o.lock ? '🔒 孵化後解鎖' : poor ? '金幣不夠' : price}</small></button>`;
    }).join('')}</div>
    <p class="fine">金幣：${S.kid.coins}</p>
    <button class="btn ghost" data-close>取消</button>`);
  m.querySelectorAll('.ride:not([disabled])').forEach(b => b.onclick = () => {
    const cost = Number(b.dataset.cost);
    if (cost > 0) { if (free) S.freeTripUsed = true; else S.kid.coins -= cost; }
    S.kid.location = dest; log('trip:' + dest, { by: b.dataset.id }); save();
    m.remove(); sfx.done();
    toast(`<span class="big-ic">${b.querySelector('.ic').textContent}</span><div><b>抵達 ${to.name}！</b></div>`);
    if (S.map) S.map.setMarker(dest, S.kid.avatar, S.kid.pet);
    mapScreen();
  });
}

// ───────── 五行試煉 ─────────
const TRIAL = ['金', '木', '水', '火', '土'];

function trialScreen() {
  screen(`
  <div class="trial">
    <header class="bar"><button class="btn small ghost" id="quit">‹ 地圖</button><h2>五行試煉</h2><span class="step" id="step"></span></header>
    <div id="stage"></div>
  </div>`, 'scroll');
  document.getElementById('quit').onclick = mapScreen;
  trialIntro();
}
const stage = () => document.getElementById('stage');

function trialIntro() {
  const t = SAY.trialIntro;
  stage().innerHTML = `
    <div class="qq-talk"><img src="${IMG('QQ_baby')}" class="bob" alt=""><p>${name()}，${esc(t)}</p>${playBtn(t, 'below')}</div>
    <button class="btn big gold" id="start">開始！</button>`;
  speak(t);
  document.getElementById('start').onclick = () => { sfx.tap(); writeChar(0); };
}

async function writeChar(ci) {
  const ch = TRIAL[ci];
  document.getElementById('step').textContent = `${ci + 1} / ${TRIAL.length}`;
  stage().innerHTML = `
    <div class="char-head"><span class="kai">${ch}</span><span class="tip" id="tip">先看一次筆順動畫</span></div>
    <div class="runner" id="runner"></div>
    <div class="writer" id="w"></div>
    <div class="row">
      <button class="btn" id="again">再看一次</button>
      <button class="btn" id="hint">提示下一筆</button>
      <button class="btn" id="redo">重寫</button>
    </div>`;
  const tip = document.getElementById('tip');
  const t0 = Date.now();
  const w = new Writer(document.getElementById('w'), {
    onStroke: (k, n) => { hop(k + 1, n); tip.textContent = k + 1 < n ? `寫對了！接著寫第 ${k + 2} 筆` : '完成！'; },
    onWrong: ({ order, times }) => {
      tip.textContent = order ? '筆順不對喔，先寫前面那一筆' : times >= 2 ? '看提示，跟著寫一次' : '再試一次，從起筆的地方開始';
      if (times === 1) { const [wd] = pickPraise('cheer'); tip.textContent += `（${wd}！）`; }
    },
    onHint: () => { tip.textContent = '看清楚這一筆怎麼寫'; },
    onDone: async ({ wrong, hints }) => {
      sfx.done();
      if (wrong || hints) addMistake(ch, { wrong, hint: hints });
      log('trial:' + ch, { ok: !wrong && !hints, wrong, hints, ms: Date.now() - t0 });
      praise(wrong || hints ? 'comeback' : ci > 0 && S.streak ? 'streak' : 'right');
      S.streak = !wrong && !hints;
      setTimeout(() => ci + 1 < TRIAL.length ? writeChar(ci + 1) : quiz(0, 0), 2400);
    },
  });
  const n = await w.load(ch, 'trace');
  const runner = document.getElementById('runner');
  runner.innerHTML = `${Array.from({ length: n + 1 }, (_, k) => `<i class="${k === n ? 'goal' : ''}"></i>`).join('')}<img id="hopper" src="${IMG('QQ_fly')}" alt="">`;
  const hop = (k, total) => {
    const h = document.getElementById('hopper'); if (!h) return;
    h.style.left = `calc(${(k / total) * 100}% - ${(k / total) * 44}px)`;
    h.classList.remove('jump'); void h.offsetWidth; h.classList.add('jump');
  };
  hop(0, n);
  await w.demo();
  tip.textContent = '換你寫！沿著淡淡的字，從第 1 筆開始';
  document.getElementById('again').onclick = async () => { if (!w.busy) { await w.demo(); } };
  document.getElementById('hint').onclick = () => w.hint();
  document.getElementById('redo').onclick = async () => { await w.load(ch, 'trace'); hop(0, n); tip.textContent = '重新開始，從第 1 筆寫'; };
}

function quiz(qi, wrongCount) {
  const q = QUIZ[qi];
  document.getElementById('step').textContent = `問答 ${qi + 1} / ${QUIZ.length}`;
  stage().innerHTML = `
    <div class="quiz">
      <p class="q">${esc(q.q)}</p>${playBtn(q.say || q.q, 'below')}
      <div class="opts">${q.o.map(o => `<button class="opt kai">${esc(o)}</button>`).join('')}</div>
      <div class="qq-pop" id="pop" hidden></div>
    </div>`;
  let tries = 0;
  app.querySelectorAll('.opt').forEach(b => b.onclick = () => {
    if (b.textContent === q.a) {
      b.classList.add('right'); sfx.done();
      praise(tries ? 'comeback' : 'right');
      log('quiz:' + qi, { ok: !tries });
      setTimeout(() => qi + 1 < QUIZ.length ? quiz(qi + 1, wrongCount + (tries ? 1 : 0)) : chest(), 1800);
    } else {
      tries++; b.classList.add('wrong'); b.disabled = true; sfx.wrong();
      if (q.key && tries === 1) addMistake(q.key, { wrong: 1 });
      const [wd, zy, mean] = pickPraise('cheer');
      const pop = document.getElementById('pop'); pop.hidden = false;
      pop.innerHTML = `<img src="${IMG('QQ_cheer2')}" alt=""><div><b>${wd}</b><small>${zy}</small><span>${mean}，再選一次！</span></div>`;
      speak(wd + '，再選一次！');
    }
  });
}

// 三選一寶箱（台灣島在五行的中央，屬「土」）
function chest(el = 'earth', after = hatchScreen) {
  const m = modal(`
    <h3>🎁 試煉完成！打開寶箱</h3>
    <p class="sub">選一種你最想要的獎勵</p>
    <div class="chest">
      <button class="prize" data-k="seed"><img src="${IMG('Seed_' + el)}" alt=""><b>${EL[el]}種子 ×1</b><small>種出糧食餵靈獸</small></button>
      <button class="prize" data-k="coin"><img src="${IMG('coin')}" alt=""><b>金幣 ×5</b><small>搭交通工具用</small></button>
      <button class="prize" data-k="gem"><img src="${IMG('Gem_' + el)}" alt=""><b>${EL[el]}寶石 ×2</b><small>收集五行寶石</small></button>
    </div>`, 'no-close');
  m.querySelectorAll('.prize').forEach(b => b.onclick = () => {
    const k = b.dataset.k;
    if (k === 'seed') S.kid.seeds[el] += 1; else if (k === 'coin') S.kid.coins += 5; else S.kid.gems[el] += 2;
    log('chest:' + k); save(); sfx.win(); sfx.coin();
    b.classList.add('chosen');
    setTimeout(() => { m.remove(); after(); }, 900);
  });
}

function hatchScreen() {
  const first = !S.kid.pets.RaRa;
  const t = first ? SAY.hatchFirst : SAY.hatchAgain;
  stage().innerHTML = `
    <div class="hatch">
      <p class="cable">🚡 纜車出發 → ⛩️ 孵蛋神社</p>
      <div class="qq-talk"><img src="${IMG('QQ_baby')}" alt=""><p>${esc(t)}</p>${playBtn(t, 'below')}</div>
      <button class="egg-btn" id="egg"><img src="${IMG(first ? 'RaRa_egg' : 'RaRa_hatched')}" alt="Rara 的蛋"></button>
      <p class="taps" id="taps">${first ? '點點蛋 ○○○○○' : ''}</p>
    </div>`;
  speak(t);
  if (!first) return finishTrial();
  let n = 0;
  document.getElementById('egg').onclick = e => {
    const b = e.currentTarget; n++; sfx.tap();
    b.classList.remove('wobble'); void b.offsetWidth; b.classList.add('wobble');
    document.getElementById('taps').textContent = '點點蛋 ' + '●'.repeat(n) + '○'.repeat(Math.max(0, 5 - n));
    if (n === 5) {
      sfx.hatch();
      b.innerHTML = `<img class="pop" src="${IMG('RaRa_jump')}" alt="Rara">`;
      b.onclick = null;
      S.kid.pets.RaRa = { hatched: true, at: Date.now() }; S.kid.pet = 'RaRa_hatched';
      const msg = SAY.hatched;
      document.getElementById('taps').textContent = msg;
      speak(msg);
      finishTrial();
    }
  };
}
function finishTrial() {
  S.kid.progress.trial = { done: true, at: Date.now() }; save();
  const b = document.createElement('button'); b.className = 'btn big gold'; b.textContent = '回到地圖';
  b.onclick = mapScreen; stage().appendChild(b);
}

// ───────── 家長 ─────────
function parentGate() {
  const a = 6 + Math.floor(Math.random() * 4), b = 3 + Math.floor(Math.random() * 6);
  const m = modal(`<h3>家長專區</h3><p>請回答：${a} × ${b} = ？</p>
    <input id="ans" type="number" inputmode="numeric"><p class="err" id="err"></p>
    <div class="row"><button class="btn gold" id="ok">進入</button><button class="btn ghost" data-close>取消</button></div>`);
  m.querySelector('#ok').onclick = () => {
    if (Number(m.querySelector('#ans').value) !== a * b) return m.querySelector('#err').textContent = '答案不對喔';
    m.remove(); parentScreen();
  };
}

function parentScreen() {
  const k = S.kid, L = k.log;
  const days = [...new Set(L.map(x => x.day))];
  const week = L.filter(x => Date.now() - x.at < 7 * 864e5);
  const ms = week.reduce((s, x) => s + (x.ms || 0), 0);
  const graded = week.filter(x => 'ok' in x);
  const rate = graded.length ? Math.round(100 * graded.filter(x => x.ok).length / graded.length) : null;
  const top = Object.entries(k.mistakes).sort((a, b) => (b[1].wrong + b[1].hint) - (a[1].wrong + a[1].hint)).slice(0, 5);
  screen(`
  <div class="page">
    <header class="bar"><button class="btn small ghost" id="back">‹ 地圖</button><h2>${name()} 的學習紀錄</h2><span></span></header>
    <div class="stats">
      <div><small>這週練習</small><b>${Math.round(ms / 60000)} 分鐘</b></div>
      <div><small>這週正確率</small><b>${rate === null ? '—' : rate + '%'}</b></div>
      <div><small>練習天數</small><b>${days.length} 天</b></div>
      <div><small>錯字怪</small><b>${Object.keys(k.mistakes).length} 隻</b></div>
    </div>
    <h3>破關進度</h3>
    <p>${k.progress.trial?.done ? '✓ 台灣島・五行試煉' : '○ 台灣島・五行試煉（尚未完成）'}</p>
    <h3>最常錯的字</h3>
    ${top.length ? `<p>${top.map(([c, v]) => `<span class="kai chip">${esc(c)}</span> 錯 ${v.wrong} 次・提示 ${v.hint} 次`).join('<br>')}</p>` : '<p>目前沒有。</p>'}
    <h3>帳號</h3>
    <div class="row"><button class="btn" id="kids">切換孩子</button><button class="btn ghost" id="out">登出</button></div>
    <p class="fine">紀錄${store.currentUser().guest ? '只存在這台裝置（試玩模式）' : '已存在雲端，換裝置登入也看得到'}。</p>
  </div>`, 'scroll');
  document.getElementById('back').onclick = mapScreen;
  document.getElementById('kids').onclick = async () => { await store.flush(); kidsScreen(); };
  document.getElementById('out').onclick = async () => { await store.flush(); await store.signOut(); loginScreen(); };
}

boot();
