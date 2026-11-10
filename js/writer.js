// 筆順寫字格：使用教育部《國字標準字體筆順學習網》資料（經 g0v zh-stroke-data 整理）
// 座標系 0–2048。模式：demo（看動畫）→ trace（描紅）→ free（自己寫，只顯示田字格）
import { sfx } from './audio.js';

const NS = 'http://www.w3.org/2000/svg';
const cache = {};
export async function loadStrokes(ch) {
  const key = ch.codePointAt(0).toString(16);
  if (!cache[key]) cache[key] = fetch(`js/data/strokes/${key}.json`).then(r => r.json());
  return cache[key];
}

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
function resample(pts, n = 16) {
  if (pts.length === 1) return Array(n).fill(pts[0]);
  const lens = [0];
  for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + dist(pts[i - 1], pts[i]));
  const total = lens[lens.length - 1] || 1, out = [];
  for (let k = 0; k < n; k++) {
    const t = (k / (n - 1)) * total;
    let i = 1; while (i < lens.length - 1 && lens[i] < t) i++;
    const seg = (lens[i] - lens[i - 1]) || 1, r = (t - lens[i - 1]) / seg;
    out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * r, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * r]);
  }
  return out;
}
function pathLen(pts) { let s = 0; for (let i = 1; i < pts.length; i++) s += dist(pts[i - 1], pts[i]); return s; }

// 使用者這一筆和標準筆畫的差距（越小越像）
function score(user, track) {
  const t = track.map(p => [p[0], p[1]]);
  const tl = pathLen(t);
  const a = resample(user), b = resample(t);
  let s = 0; for (let i = 0; i < a.length; i++) s += dist(a[i], b[i]);
  s /= a.length;
  const startD = dist(user[0], t[0]);
  const lenRatio = pathLen(user) / Math.max(tl, 120);
  return { s, startD, lenRatio, short: tl < 260 };
}
function accept(sc) {
  if (sc.short) return sc.s < 330 && sc.startD < 420;            // 點、短筆
  return sc.s < 300 && sc.startD < 450 && sc.lenRatio > 0.45 && sc.lenRatio < 2.2;
}

export class Writer {
  constructor(host, { onStroke, onWrong, onDone, onHint } = {}) {
    this.host = host; this.cb = { onStroke, onWrong, onDone, onHint };
    this.svg = el('svg', { viewBox: '0 0 2048 2048', class: 'writer-svg' }, host);
    const g = el('g', { class: 'grid' }, this.svg);
    el('rect', { x: 24, y: 24, width: 2000, height: 2000, class: 'grid-box' }, g);
    el('line', { x1: 1024, y1: 24, x2: 1024, y2: 2024, class: 'grid-dash' }, g);
    el('line', { x1: 24, y1: 1024, x2: 2024, y2: 1024, class: 'grid-dash' }, g);
    this.defs = el('defs', {}, this.svg);
    this.ghost = el('g', { class: 'ghost' }, this.svg);
    this.done = el('g', { class: 'done' }, this.svg);
    this.hintG = el('g', { class: 'hint' }, this.svg);
    this.ink = el('polyline', { class: 'ink', points: '' }, this.svg);
    this.uid = 'w' + Math.random().toString(36).slice(2, 7);
    this.bindInput();
  }

  async load(ch, mode = 'trace') {
    this.ch = ch; this.mode = mode;
    this.strokes = await loadStrokes(ch);
    this.i = 0; this.wrongHere = 0; this.wrongTotal = 0; this.hints = 0; this.busy = false;
    this.ghost.innerHTML = ''; this.done.innerHTML = ''; this.hintG.innerHTML = ''; this.defs.innerHTML = '';
    this.strokes.forEach((s, k) => {
      const cp = el('clipPath', { id: `${this.uid}c${k}` }, this.defs);
      el('path', { d: s.d }, cp);
    });
    if (mode === 'trace') this.strokes.forEach(s => el('path', { d: s.d }, this.ghost));
    this.host.classList.toggle('free', mode === 'free');
    return this.strokes.length;
  }

  // 用畫筆沿著軌跡「刷」出一筆的動畫
  animateStroke(k, layer, cls, dur = 650) {
    return new Promise(res => {
      const s = this.strokes[k];
      const g = el('g', { 'clip-path': `url(#${this.uid}c${k})` }, layer);
      const pts = s.t.map(p => `${p[0]},${p[1]}`).join(' ');
      const w = Math.max(...s.t.map(p => p[2] || 0), 150) * 2.2;
      const line = el('polyline', { points: pts, class: cls, 'stroke-width': w }, g);
      const L = pathLen(s.t) + w;
      line.style.strokeDasharray = L; line.style.strokeDashoffset = L;
      line.getBoundingClientRect();
      line.style.transition = `stroke-dashoffset ${dur}ms ease-in-out`;
      line.style.strokeDashoffset = 0;
      setTimeout(() => res(g), dur + 30);
    });
  }

  async demo() {
    this.busy = true;
    this.done.innerHTML = ''; this.hintG.innerHTML = '';
    for (let k = 0; k < this.strokes.length; k++) {
      const g = await this.animateStroke(k, this.hintG, 'demo-brush');
      const n = this.strokes[k].t[0];
      const badge = el('g', { class: 'num' }, this.hintG);
      el('circle', { cx: n[0], cy: n[1], r: 70 }, badge);
      const tx = el('text', { x: n[0], y: n[1] + 30 }, badge); tx.textContent = k + 1;
      g.setAttribute('data-k', k);
      await new Promise(r => setTimeout(r, 120));
    }
    await new Promise(r => setTimeout(r, 500));
    this.hintG.innerHTML = '';
    this.busy = false;
  }

  async hint() {
    if (this.busy || this.i >= this.strokes.length) return;
    this.hints++; this.cb.onHint?.(this.i);
    this.busy = true;
    const g = await this.animateStroke(this.i, this.hintG, 'hint-brush', 800);
    setTimeout(() => g.remove(), 900);
    this.busy = false;
  }

  fillStroke(k) { el('path', { d: this.strokes[k].d, class: 'filled' }, this.done); }

  bindInput() {
    const toLocal = e => {
      const r = this.svg.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * 2048, ((e.clientY - r.top) / r.height) * 2048];
    };
    let pts = null;
    this.svg.addEventListener('pointerdown', e => {
      if (this.busy || !this.strokes || this.i >= this.strokes.length) return;
      e.preventDefault(); this.svg.setPointerCapture(e.pointerId);
      pts = [toLocal(e)];
    });
    this.svg.addEventListener('pointermove', e => {
      if (!pts) return; e.preventDefault();
      const p = toLocal(e); if (dist(p, pts[pts.length - 1]) > 12) pts.push(p);
      this.ink.setAttribute('points', pts.map(q => q.join(',')).join(' '));
    });
    const end = () => {
      if (!pts) return;
      const u = pts; pts = null;
      this.ink.setAttribute('points', '');
      if (u.length < 2 && this.strokes[this.i].t.length > 2) { this.judge([u[0], [u[0][0] + 1, u[0][1] + 1]]); return; }
      this.judge(u.length < 2 ? [u[0], [u[0][0] + 1, u[0][1] + 1]] : u);
    };
    this.svg.addEventListener('pointerup', end);
    this.svg.addEventListener('pointercancel', () => { pts = null; this.ink.setAttribute('points', ''); });
  }

  judge(u) {
    const k = this.i, sc = score(u, this.strokes[k].t);
    if (accept(sc)) {
      this.fillStroke(k); sfx.stroke();
      this.i++; this.wrongHere = 0;
      this.cb.onStroke?.(k, this.strokes.length);
      if (this.i >= this.strokes.length) this.cb.onDone?.({ wrong: this.wrongTotal, hints: this.hints });
      return;
    }
    // 是不是寫成後面的筆畫了？
    let order = false;
    for (let j = k + 1; j < this.strokes.length; j++) if (accept(score(u, this.strokes[j].t))) { order = true; break; }
    this.wrongHere++; this.wrongTotal++;
    sfx.wrong();
    this.host.classList.remove('shake'); void this.host.offsetWidth; this.host.classList.add('shake');
    this.cb.onWrong?.({ order, times: this.wrongHere });
    if (this.wrongHere >= 2) this.hint();
  }
}
