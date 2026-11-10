"""用 Gemini-TTS 產生神獸語音（由 GitHub Actions 執行）。
讀 scripts/lines.json，只產生還沒有的音檔，轉成 MP3 存到 audio/{神獸}/{雜湊}.mp3，並更新 audio/index.json。
遇到額度限制會先存下已完成的部分，下次執行再接著做。
"""
import base64, json, os, subprocess, sys, time, urllib.request, urllib.error

KEY = os.environ.get('GEMINI_API_KEY', '').strip()
MODEL = os.environ.get('TTS_MODEL', 'gemini-2.5-flash-preview-tts')
LIMIT_MIN = int(os.environ.get('MAX_MINUTES', '40'))
if not KEY:
    sys.exit('沒有設定 GEMINI_API_KEY')

data = json.load(open('scripts/lines.json', encoding='utf-8'))
os.makedirs('audio', exist_ok=True)
try:
    index = json.load(open('audio/index.json', encoding='utf-8'))
except Exception:
    index = {}

def save_index():
    json.dump(index, open('audio/index.json', 'w', encoding='utf-8'), separators=(',', ':'))

def synth(text, g):
    prompt = f"{data['accent']}{g['style']}\n請朗讀下面這段話：\n{text}"
    body = json.dumps({
        'contents': [{'parts': [{'text': prompt}]}],
        'generationConfig': {'responseModalities': ['AUDIO'],
                             'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': g['speaker']}}}},
    }).encode()
    url = f'https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent?key={KEY}'
    req = urllib.request.Request(url, data=body, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120) as r:
        j = json.load(r)
    return base64.b64decode(j['candidates'][0]['content']['parts'][0]['inlineData']['data'])

start = time.time()
done = 0
for g in data['guides']:
    have = set(index.get(g['id'], []))
    os.makedirs(f"audio/{g['id']}", exist_ok=True)
    for ln in data['lines']:
        if ln['h'] in have:
            continue
        if time.time() - start > LIMIT_MIN * 60:
            save_index(); print(f'時間到，先存檔。本次完成 {done} 句'); sys.exit(0)
        for attempt in range(6):
            try:
                pcm = synth(ln['t'], g)
                break
            except urllib.error.HTTPError as e:
                msg = e.read().decode(errors='ignore')[:300]
                if e.code == 429 and attempt < 5:
                    wait = 30 * (attempt + 1); print(f'額度限制，等 {wait} 秒'); time.sleep(wait); continue
                print(f"✗ {g['id']} {ln['t'][:15]}… HTTP {e.code} {msg}")
                save_index()
                sys.exit(0 if e.code == 429 else 1)
            except Exception as e:
                print(f"✗ {g['id']} {ln['t'][:15]}… {e}")
                if attempt == 5: save_index(); sys.exit(1)
                time.sleep(10)
        out = f"audio/{g['id']}/{ln['h']}.mp3"
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', 'pipe:0',
                        '-codec:a', 'libmp3lame', '-b:a', '48k', out], input=pcm, check=True)
        index.setdefault(g['id'], []).append(ln['h']); have.add(ln['h'])
        done += 1
        print(f"✓ {g['id']} {ln['t'][:20]}")
        if done % 10 == 0: save_index()
        time.sleep(float(os.environ.get('PAUSE', '4')))
save_index()
print(f'全部完成，本次產生 {done} 句')
