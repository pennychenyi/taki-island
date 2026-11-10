// 資料層：Firebase（Google 登入 + Firestore），連不上時自動改用「訪客模式」（只存在這台裝置）
const FB_VER = '10.12.2';
const firebaseConfig = {
  apiKey: 'AIzaSyAsftvV4iJZq9xH61XWRsHfrdcY788nBt4',
  authDomain: 'taki-island.firebaseapp.com',
  projectId: 'taki-island',
  storageBucket: 'taki-island.firebasestorage.app',
  messagingSenderId: '139894215820',
  appId: '1:139894215820:web:99136dc8fc242d976b97a9',
};

let fb = null;          // { auth, db, m: modules }
let user = null;        // { uid, name, guest }
const LS = 'taki-island-guest';

export function newKid(form) {
  return {
    nickname: form.nickname, grade: Number(form.grade), version: form.version,
    gender: form.gender || '', age: form.age ? Number(form.age) : null,
    avatar: 'Avatar_samurai_boy', pet: null,
    coins: 0,
    seeds: { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 },
    gems: { wood: 0, fire: 0, earth: 0, metal: 0, water: 0 },
    pets: {},                  // { RaRa: { hatched: true, at } }
    progress: {},              // { trial: { done: true, at } }
    mistakes: {},              // 修煉場：{ 字: { wrong, hint, rightDays: [] } }
    log: [],                   // 練習紀錄：[{ day, what, ok, ms }]
    storySeen: false,
    location: 'taiwan',
    lastTripDay: '',
    createdAt: Date.now(),
  };
}

export async function init() {
  try {
    const [app, auth, fs] = await Promise.all([
      import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-app.js`),
      import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-auth.js`),
      import(`https://www.gstatic.com/firebasejs/${FB_VER}/firebase-firestore.js`),
    ]);
    const a = app.initializeApp(firebaseConfig);
    fb = { auth: auth.getAuth(a), db: fs.getFirestore(a), A: auth, F: fs };
    try { await auth.getRedirectResult(fb.auth); } catch (e) { console.warn(e); }
    return await new Promise(res => {
      const off = auth.onAuthStateChanged(fb.auth, u => {
        off();
        user = u ? { uid: u.uid, name: u.displayName || '', guest: false } : null;
        res(user);
      });
    });
  } catch (e) {
    console.warn('Firebase 無法使用，改用訪客模式', e);
    fb = null;
    return null;
  }
}

export const online = () => !!fb;
export const currentUser = () => user;

export async function signIn() {
  if (!fb) throw new Error('offline');
  const { A } = fb;
  const provider = new A.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    const r = await A.signInWithPopup(fb.auth, provider);
    user = { uid: r.user.uid, name: r.user.displayName || '', guest: false };
    return user;
  } catch (e) {
    // 加入主畫面後的模式有時不能跳出視窗，改用整頁跳轉
    if (/popup/i.test(e.code || '')) { await A.signInWithRedirect(fb.auth, provider); return null; }
    throw e;
  }
}

export function guest() { user = { uid: 'guest', name: '訪客', guest: true }; return user; }

export async function signOut() {
  if (fb && !user?.guest) await fb.A.signOut(fb.auth);
  user = null;
}

function guestData() { try { return JSON.parse(localStorage.getItem(LS)) || { kids: {} }; } catch { return { kids: {} }; } }
function guestSave(d) { try { localStorage.setItem(LS, JSON.stringify(d)); } catch {} }

export async function listKids() {
  if (user.guest) return Object.entries(guestData().kids).map(([id, k]) => ({ id, ...k }));
  const { F, db } = fb;
  const snap = await F.getDocs(F.collection(db, 'users', user.uid, 'kids'));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createKid(kid) {
  if (user.guest) {
    const d = guestData(); const id = 'k' + Date.now(); d.kids[id] = kid; guestSave(d); return id;
  }
  const { F, db } = fb;
  await F.setDoc(F.doc(db, 'users', user.uid), { updatedAt: Date.now() }, { merge: true });
  const ref = await F.addDoc(F.collection(db, 'users', user.uid, 'kids'), kid);
  return ref.id;
}

let saveTimer = null, pending = null;
export function saveKid(id, kid) {
  pending = { id, kid };
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 600);
}
export async function flush() {
  if (!pending) return;
  const { id, kid } = pending; pending = null;
  const data = JSON.parse(JSON.stringify(kid)); delete data.id;
  if (data.log && data.log.length > 500) data.log = data.log.slice(-500);
  try {
    if (user.guest) { const d = guestData(); d.kids[id] = data; guestSave(d); return; }
    const { F, db } = fb;
    await F.setDoc(F.doc(db, 'users', user.uid, 'kids', id), data);
  } catch (e) { console.warn('存檔失敗', e); }
}
addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
