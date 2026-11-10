// 神獸聲音設定（台灣華語）。音檔由「語音工坊」事先產生，放在 audio/{id}/
// provider: google = Google Cloud Text-to-Speech（cmn-TW），azure = Microsoft Azure 語音（zh-TW）
export const GUIDES = [
  { id: 'QQ', name: 'QQ 朱雀', gender: '女聲', img: 'QQ_cheer', sample: '我是 QQ！你好棒喔，我們一起去冒險吧！',
    gemini: { speaker: 'Leda', style: '你是一隻活潑可愛的紫色小鵪鶉，聲音清脆、有精神，像在跟國小孩子說話，語氣開心。' },
    google: { name: 'cmn-TW-Wavenet-A', pitch: 4, rate: 1.05 }, azure: { name: 'zh-TW-HsiaoYuNeural', pitch: '+8%', rate: '+5%' } },
  { id: 'RaRa', name: 'Rara 羬羊', gender: '女聲', img: 'RaRa_hatched', sample: '我是 Rara，慢慢來沒關係，我陪你。',
    gemini: { speaker: 'Aoede', style: '你是一隻溫柔的小羊，說話輕柔、慢慢的，很有耐心，像大姊姊在安慰孩子。' },
    google: { name: 'cmn-TW-Wavenet-A', pitch: 1.5, rate: 0.92 }, azure: { name: 'zh-TW-HsiaoChenNeural', pitch: '+0%', rate: '-5%' } },
  { id: 'Uni', name: '麒麟 Uni', gender: '女聲', img: 'Uni_hatched', sample: '我是麒麟 Uni，一字千金，你寫的每個字都很珍貴。',
    gemini: { speaker: 'Kore', style: '你是一隻優雅的麒麟，聲音清亮、溫暖，帶著鼓勵的語氣。' },
    google: { name: 'cmn-TW-Wavenet-A', pitch: 0, rate: 0.95 }, azure: { name: 'zh-TW-HsiaoChenNeural', pitch: '+6%', rate: '+0%' } },
  { id: 'Taki', name: '青龍 Taki', gender: '男聲', img: 'Taki_hatched', sample: '我是青龍 Taki，水滴石穿，每天練一點點就會成功。',
    gemini: { speaker: 'Puck', style: '你是一隻爽朗的青龍，像有活力的大哥哥，語氣熱情、充滿鼓勵。' },
    google: { name: 'cmn-TW-Wavenet-C', pitch: 0, rate: 0.95 }, azure: { name: 'zh-TW-YunJheNeural', pitch: '+0%', rate: '-3%' } },
  { id: 'Yuki', name: '白虎 Yuki', gender: '男聲', img: 'Yuki_hatched', sample: '我是白虎 Yuki，倒背如流，你一定做得到！',
    gemini: { speaker: 'Orus', style: '你是一隻沉穩的白虎，聲音低沉有力，像可靠的教練，語氣堅定溫暖。' },
    google: { name: 'cmn-TW-Wavenet-B', pitch: -1, rate: 0.93 }, azure: { name: 'zh-TW-YunJheNeural', pitch: '-8%', rate: '-5%' } },
  { id: 'BuBu', name: '玄武 BuBu', gender: '男聲', img: 'BuBu_hatched', sample: '我是玄武 BuBu，積土成山，慢慢走也能走很遠。',
    gemini: { speaker: 'Charon', style: '你是一隻慈祥的玄武老烏龜，像和藹的老爺爺，說話慢慢的、很溫和。' },
    google: { name: 'cmn-TW-Wavenet-C', pitch: -4, rate: 0.82 }, azure: { name: 'zh-TW-YunJheNeural', pitch: '-15%', rate: '-15%' } },
];
export const DEFAULT_GUIDE = 'QQ';
// Gemini-TTS 共用的口音指令（語音工坊可以修改）
export const TW_ACCENT = '請用道地的台灣口音國語（台灣華語）朗讀：咬字自然、輕柔，不捲舌、不加兒化音，語調像台灣的國小老師或故事姊姊。';

// 要唸的文字 → 檔名（FNV-1a 雜湊），工坊和遊戲用同一套規則
export function norm(t) { return String(t).replace(/[「」『』〔〕\s]/g, ''); }
export function hashText(t) {
  const s = norm(t); let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
