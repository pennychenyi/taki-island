// 語音（iPad 內建台灣中文語音）與音效（用 Web Audio 即時合成，不需要音檔）
let voice = null, ctx = null, speaking = null;

function pickVoice() {
  const vs = speechSynthesis.getVoices();
  voice = vs.find(v => v.lang === 'zh-TW') || vs.find(v => /zh[-_]TW|Mei-Jia|美佳/i.test(v.lang + v.name))
    || vs.find(v => /^zh/i.test(v.lang)) || null;
}
if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }

import { hashText, DEFAULT_GUIDE } from './voices.js';

// 先找「語音工坊」做好的神獸音檔；沒有的話才用裝置內建語音
let guide = DEFAULT_GUIDE, index = {}, player = null;
fetch('audio/index.json').then(r => r.ok ? r.json() : {}).then(j => index = j).catch(() => {});
export function setGuide(id) { guide = id || DEFAULT_GUIDE; }
export const hasClip = (text, g = guide) => !!index[g]?.includes(hashText(text));

export function speak(text, { rate = 0.9, onend, as } = {}) {
  stopSpeak();
  const g = as || guide;
  if (hasClip(text, g)) {
    player = player || new Audio();
    player.src = `audio/${g}/${hashText(text)}.mp3`;
    player.onended = () => { speaking = null; onend?.(); };
    player.onerror = () => { speaking = null; ttsSpeak(text, rate, onend); };
    speaking = player;
    player.play().catch(() => { speaking = null; onend?.(); });
    return;
  }
  ttsSpeak(text, rate, onend);
}
function ttsSpeak(text, rate, onend) {
  if (!('speechSynthesis' in window)) { onend?.(); return; }
  const u = new SpeechSynthesisUtterance(text.replace(/[「」『』〔〕]/g, ''));
  u.lang = 'zh-TW'; if (voice) u.voice = voice; u.rate = rate; u.pitch = 1.1;
  u.onend = () => { speaking = null; onend?.(); };
  u.onerror = () => { speaking = null; onend?.(); };
  speaking = u;
  speechSynthesis.speak(u);
}
export function stopSpeak() {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  if (player) { player.pause(); player.onended = null; }
  speaking = null;
}
export const isSpeaking = () => !!speaking;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function tone(freq, start, dur, type = 'sine', gain = 0.18) {
  const c = ac(), o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(gain, c.currentTime + start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + start); o.stop(c.currentTime + start + dur + 0.05);
}
export const sfx = {
  tap() { try { tone(660, 0, 0.08, 'triangle', 0.1); } catch {} },
  stroke() { try { tone(880, 0, 0.12, 'sine', 0.14); } catch {} },
  wrong() { try { tone(220, 0, 0.18, 'square', 0.08); tone(180, 0.12, 0.22, 'square', 0.08); } catch {} },
  done() { try { [523, 659, 784].forEach((f, i) => tone(f, i * 0.1, 0.25)); } catch {} },
  win() { try { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.3, 'triangle', 0.16)); } catch {} },
  coin() { try { tone(988, 0, 0.08, 'square', 0.07); tone(1319, 0.08, 0.25, 'square', 0.07); } catch {} },
  hatch() { try { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.09, 0.35, 'sine', 0.15)); } catch {} },
};

// 成語、文言稱讚（顯示注音和白話）
export const PRAISE = {
  right: [
    ['出類拔萃', 'ㄔㄨ ㄌㄟˋ ㄅㄚˊ ㄘㄨㄟˋ', '比一般人更優秀'],
    ['孺子可教也', 'ㄖㄨˊ ㄗˇ ㄎㄜˇ ㄐㄧㄠˋ ㄧㄝˇ', '這孩子值得好好栽培'],
    ['後生可畏', 'ㄏㄡˋ ㄕㄥ ㄎㄜˇ ㄨㄟˋ', '年輕人進步好快，令人佩服'],
    ['妙筆生花', 'ㄇㄧㄠˋ ㄅㄧˇ ㄕㄥ ㄏㄨㄚ', '寫字寫得像開花一樣漂亮'],
    ['一鳴驚人', 'ㄧ ㄇㄧㄥˊ ㄐㄧㄥ ㄖㄣˊ', '一表現就讓大家嚇一跳'],
  ],
  streak: [
    ['勢如破竹', 'ㄕˋ ㄖㄨˊ ㄆㄛˋ ㄓㄨˊ', '一路順利，擋都擋不住'],
    ['青出於藍', 'ㄑㄧㄥ ㄔㄨ ㄩˊ ㄌㄢˊ', '學得比老師還要好'],
  ],
  comeback: [
    ['失之東隅，收之桑榆', 'ㄕ ㄓ ㄉㄨㄥ ㄩˊ，ㄕㄡ ㄓ ㄙㄤ ㄩˊ', '早上弄丟的，傍晚又找回來了'],
    ['知錯能改，善莫大焉', 'ㄓ ㄘㄨㄛˋ ㄋㄥˊ ㄍㄞˇ，ㄕㄢˋ ㄇㄛˋ ㄉㄚˋ ㄧㄢ', '知道錯了能改正，就是最棒的事'],
    ['鍥而不捨，金石可鏤', 'ㄑㄧㄝˋ ㄦˊ ㄅㄨˋ ㄕㄜˇ，ㄐㄧㄣ ㄕˊ ㄎㄜˇ ㄌㄡˋ', '一直努力，連金石都能刻穿'],
  ],
  cheer: [
    ['勝敗乃兵家常事', 'ㄕㄥˋ ㄅㄞˋ ㄋㄞˇ ㄅㄧㄥ ㄐㄧㄚ ㄔㄤˊ ㄕˋ', '輸贏都很平常，別灰心'],
    ['失敗為成功之母', 'ㄕ ㄅㄞˋ ㄨㄟˊ ㄔㄥˊ ㄍㄨㄥ ㄓ ㄇㄨˇ', '失敗會帶我們走向成功'],
    ['再接再厲', 'ㄗㄞˋ ㄐㄧㄝ ㄗㄞˋ ㄌㄧˋ', '繼續努力，再試一次'],
    ['鐵杵磨成針', 'ㄊㄧㄝˇ ㄔㄨˇ ㄇㄛˊ ㄔㄥˊ ㄓㄣ', '只要有恆心，就一定做得到'],
  ],
};
export function pickPraise(kind) {
  const list = PRAISE[kind]; return list[Math.floor(Math.random() * list.length)];
}
