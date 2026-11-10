// 所有要唸出來的固定台詞（語音工坊會把這些全部做成音檔）
import { STORY } from './story.js';
import { PRAISE } from './audio.js';
import { GUIDES } from './voices.js';

export const fillSay = t => t.replace(/\{n\}/g, '小探險家');
export const storySay = p => `${p.title}。${fillSay(p.text)}${p.ask ? '。' + p.ask : ''}`;

export const SAY = {
  trialIntro: '五行試煉開始囉！先跟我一起寫「金、木、水、火、土」五個字。每寫對一筆，我就往前跳一格。寫錯也沒關係，我會給你提示！',
  hatchFirst: '我們搭纜車到孵蛋神社吧！這次免費喔。咦？這顆粉紅色的蛋在動！快點蛋五下，幫牠出來！',
  hatchAgain: 'Rara 已經是你的好夥伴了！',
  hatched: 'Rara 孵出來了！牠是《山海經》裡的羬羊，屬性是火和土。從現在開始，Rara 會陪你一起探險！',
};

export const QUIZ = [
  { q: '「金」一共有幾畫？', a: '8', o: ['6', '7', '8', '9'], key: '金' },
  { q: '哪一個字讀作「ㄕㄨㄟˇ」？', a: '水', o: ['火', '水', '木', '土'], key: '水', say: '哪一個字讀作水？' },
  { q: '「火」的注音是哪一個？', a: 'ㄏㄨㄛˇ', o: ['ㄏㄨㄛ', 'ㄏㄨㄛˊ', 'ㄏㄨㄛˇ', 'ㄏㄨㄛˋ'], key: '火' },
  { q: '「木」一共有幾畫？', a: '4', o: ['3', '4', '5', '6'], key: '木' },
  { q: '故事裡說，五行之中哪一個會讓樹木長大？', a: '水', o: ['金', '水', '火', '土'], key: null },
];

export function allLines() {
  const out = new Set();
  STORY.forEach(p => out.add(storySay(p)));
  Object.values(SAY).forEach(t => out.add(t));
  QUIZ.forEach(q => out.add(q.say || q.q));
  Object.values(PRAISE).flat().forEach(([w]) => out.add(w));
  PRAISE.cheer.forEach(([w]) => out.add(w + '，再選一次！'));
  GUIDES.forEach(g => out.add(g.sample));
  return [...out];
}
