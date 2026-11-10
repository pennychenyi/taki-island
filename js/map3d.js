// 3D 世界地圖：黏土玩具感的島嶼，可旋轉、縮放、點選
import * as THREE from '../vendor/three.module.min.js';
import { OrbitControls } from '../vendor/OrbitControls.js';

export const PLACES = {
  taiwan: { name: '台灣島', arch: 'taiwan', pos: [0, 0], color: 0x8fcf8a, open: true },
  qinglong: { name: '青龍島', arch: 'chinese', el: 'wood', pos: [25, 0], color: 0x7fc9a0, open: false, sub: '國語・木' },
  zhuque: { name: '朱雀島', arch: 'chinese', el: 'fire', pos: [19, 6], color: 0xf1a39a, open: false, sub: '國語・火' },
  baihu: { name: '白虎島', arch: 'chinese', el: 'metal', pos: [13, 0], color: 0xe9d9b0, open: false, sub: '國語・金' },
  xuanwu: { name: '玄武島', arch: 'chinese', el: 'water', pos: [19, -6], color: 0x9cc3e8, open: false, sub: '國語・水' },
  math: { name: '數學列島', arch: 'math', el: 'earth', pos: [0, -20], color: 0xf2c879, open: false, sub: '即將開放' },
  nature: { name: '自然列島', arch: 'nature', pos: [0, 20], color: 0xa6dcb6, open: false, sub: '即將開放' },
  social: { name: '社會列島', arch: 'social', pos: [-19, 0], color: 0xf4b9c8, open: false, sub: '即將開放' },
};
export const ARCH_NAME = { taiwan: '台灣島', chinese: '國語列島', math: '數學列島', nature: '自然列島', social: '社會列島' };

const clay = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra });

function tree(round, color) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.6, 8), clay(0xb98a5e));
  trunk.position.y = 0.3; g.add(trunk);
  const top = round
    ? new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), clay(color))
    : new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.1, 12), clay(color));
  top.position.y = round ? 0.9 : 1.05; g.add(top);
  return g;
}

function island(r, color, { trees = 4, mountain = false, seed = 1 } = {}) {
  const g = new THREE.Group();
  const cliff = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.12, 1.2, 40), clay(0xf3e2c0));
  cliff.position.y = -0.2; g.add(cliff);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), clay(color));
  cap.scale.y = 0.22; cap.position.y = 0.38; g.add(cap);
  let s = seed;
  const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < trees; i++) {
    const a = rnd() * Math.PI * 2, d = r * (0.35 + rnd() * 0.45);
    const t = tree(rnd() > 0.5, rnd() > 0.5 ? 0x6fbf73 : 0x9bd27c);
    t.position.set(Math.cos(a) * d, 0.45, Math.sin(a) * d); t.scale.setScalar(0.8 + rnd() * 0.5);
    g.add(t);
  }
  if (mountain) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r * 0.45, r * 0.9, 24), clay(0x7cb87a));
    m.position.y = 0.4 + r * 0.42; g.add(m);
    const snow = new THREE.Mesh(new THREE.ConeGeometry(r * 0.13, r * 0.26, 24), clay(0xffffff));
    snow.position.y = 0.4 + r * 0.76; g.add(snow);
  }
  return g;
}

function cloud() {
  const g = new THREE.Group(), m = clay(0xffffff, { transparent: true, opacity: 0.92 });
  [[0, 0, 0, 1], [0.9, -0.1, 0.2, 0.75], [-0.9, -0.15, -0.1, 0.7], [0.3, 0.35, 0, 0.7]].forEach(([x, y, z, r]) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), m); b.position.set(x, y, z); g.add(b);
  });
  return g;
}

export function createMap(host, { night = false, onPick } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  host.appendChild(renderer.domElement);
  const labels = document.createElement('div'); labels.className = 'map-labels'; host.appendChild(labels);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400);
  camera.position.set(0, 46, 52);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.enablePan = true;
  controls.minDistance = 14; controls.maxDistance = 95; controls.maxPolarAngle = 1.25;
  controls.target.set(2, 0, 0);

  const hemi = new THREE.HemisphereLight(0xfff4e6, 0x9ad0e6, 1.1); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(20, 40, 15); scene.add(sun);

  const sea = new THREE.Mesh(new THREE.CircleGeometry(75, 64), clay(0x9fd8ec, { roughness: 0.6 }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -0.5; scene.add(sea);

  const pickables = [], labelEls = [];
  const addLabel = (id, text, sub, obj, y) => {
    const d = document.createElement('button'); d.className = 'map-label'; d.dataset.id = id;
    d.innerHTML = `<b>${text}</b>${sub ? `<small>${sub}</small>` : ''}`;
    d.onclick = () => onPick?.(id);
    labels.appendChild(d); labelEls.push({ d, obj, y });
  };

  // 台灣島：中央、偏長，有玉山
  const tw = island(3.2, PLACES.taiwan.color, { trees: 9, mountain: true, seed: 7 });
  tw.scale.set(0.75, 1, 1.7); tw.rotation.y = 0.35;
  scene.add(tw); tw.userData.id = 'taiwan'; pickables.push(tw); addLabel('taiwan', '台灣島', '出發點', tw, 4.2);

  Object.entries(PLACES).forEach(([id, p], i) => {
    if (id === 'taiwan') return;
    const big = p.arch !== 'chinese';
    const isl = island(big ? 3.4 : 2.2, p.color, { trees: big ? 6 : 3, seed: i * 13 + 3 });
    isl.position.set(p.pos[0], 0, p.pos[1]); isl.userData.id = id;
    scene.add(isl); pickables.push(isl);
    addLabel(id, p.name, p.sub, isl, big ? 2.6 : 2.1);
  });
  // 國語列島之間的纜車線
  const cable = new THREE.LineBasicMaterial({ color: 0x8a6d4b });
  const pts = ['qinglong', 'zhuque', 'baihu', 'xuanwu', 'qinglong'].map(k => new THREE.Vector3(PLACES[k].pos[0], 2.4, PLACES[k].pos[1]));
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), cable));

  const clouds = [];
  for (let i = 0; i < 9; i++) {
    const c = cloud(); c.position.set((Math.random() - 0.5) * 70, 7 + Math.random() * 4, (Math.random() - 0.5) * 60);
    c.scale.setScalar(0.8 + Math.random() * 0.8); scene.add(c); clouds.push(c);
  }

  const starGeo = new THREE.BufferGeometry(), sp = [];
  for (let i = 0; i < 600; i++) { const a = Math.random() * Math.PI * 2, b = Math.random() * 0.9, R = 160; sp.push(R * Math.cos(a) * Math.cos(b), R * Math.sin(b) + 10, R * Math.sin(a) * Math.cos(b)); }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xfff6d8, size: 0.9 }));
  scene.add(stars);

  // 主角＋靈獸標記
  const loader = new THREE.TextureLoader();
  const marker = new THREE.Group(); scene.add(marker);
  const sprite = (file, s) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: loader.load(`assets/img/${file}.webp`), transparent: true }));
    sp.scale.set(s, s, 1); return sp;
  };
  let heroS = null, petS = null;

  function setMarker(loc, avatar, pet) {
    const p = PLACES[loc] || PLACES.taiwan;
    marker.position.set(p.pos[0], 0, p.pos[1]);
    if (heroS) marker.remove(heroS); if (petS) marker.remove(petS);
    heroS = sprite(avatar, 3.2); heroS.position.set(-0.6, 2.6, 0.8); marker.add(heroS);
    if (pet) { petS = sprite(pet, 2); petS.position.set(1.3, 1.8, 1.2); marker.add(petS); } else petS = null;
  }

  function setNight(n) {
    scene.background = new THREE.Color(n ? 0x1d2b4f : 0xcfeefa);
    scene.fog = new THREE.Fog(n ? 0x1d2b4f : 0xcfeefa, 90, 200);
    sea.material.color.set(n ? 0x2b4a78 : 0x9fd8ec);
    hemi.intensity = n ? 0.45 : 1.1; sun.intensity = n ? 0.35 : 1.4;
    sun.color.set(n ? 0xbfd0ff : 0xffffff);
    stars.visible = n; clouds.forEach(c => c.visible = !n);
    host.classList.toggle('night', n);
  }
  setNight(night);

  // 點一下（不是拖曳）才算選取
  const ray = new THREE.Raycaster(), v = new THREE.Vector2();
  let down = null;
  renderer.domElement.addEventListener('pointerdown', e => down = [e.clientX, e.clientY]);
  renderer.domElement.addEventListener('pointerup', e => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 8) return;
    const r = renderer.domElement.getBoundingClientRect();
    v.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(v, camera);
    const hit = ray.intersectObjects(pickables, true)[0];
    if (hit) { let o = hit.object; while (o && !o.userData.id) o = o.parent; if (o) onPick?.(o.userData.id); }
  });

  // 直拿（手機、iPad 直向）時，從西邊看過去：台灣島在下、國語列島在上；橫拿時從南邊看
  let lastPortrait = null;
  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    const portrait = w < h;
    if (portrait === lastPortrait) return;
    lastPortrait = portrait;
    const polar = 0.82;
    if (portrait) {
      const D = w / h < 0.6 ? 66 : 54;
      controls.target.set(10, 0, 0);
      camera.position.set(10 - Math.sin(polar) * D, Math.cos(polar) * D, 0);
    } else {
      const D = 60;
      controls.target.set(3, 0, 0);
      camera.position.set(3, Math.cos(polar) * D, Math.sin(polar) * D);
    }
    controls.update();
  }
  const ro = new ResizeObserver(resize); ro.observe(host); resize();

  const tmp = new THREE.Vector3(); let t = 0, raf;
  function loop() {
    raf = requestAnimationFrame(loop); t += 0.016;
    clouds.forEach((c, i) => { c.position.x += 0.01 + i * 0.001; if (c.position.x > 40) c.position.x = -40; });
    if (heroS) heroS.position.y = 2.6 + Math.sin(t * 2) * 0.12;
    if (petS) petS.position.y = 1.8 + Math.abs(Math.sin(t * 3)) * 0.35;
    controls.update(); renderer.render(scene, camera);
    const w = host.clientWidth, h = host.clientHeight;
    labelEls.forEach(({ d, obj, y }) => {
      obj.getWorldPosition(tmp); tmp.y += y; tmp.project(camera);
      const vis = tmp.z < 1;
      d.style.display = vis ? '' : 'none';
      d.style.transform = `translate(-50%,-100%) translate(${(tmp.x * 0.5 + 0.5) * w}px,${(-tmp.y * 0.5 + 0.5) * h}px)`;
    });
  }
  loop();

  return { setMarker, setNight, dispose() { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); host.innerHTML = ''; } };
}
