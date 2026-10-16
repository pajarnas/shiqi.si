import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Sim, SPEC } from './physics.js';

/* ============================================================
   Words
   ============================================================ */

const STRINGS = {
  zh: {
    docTitle: '极限刹车 · 空翻版 — shiqi.si',
    loading: '正在生成场景…',
    eyebrow: '0–60 MPH · 0.81 S',
    title: '极限刹车 · 空翻版',
    tagline: '踩得越狠停得越快。踩过头也不会翻车，它会飞起来。',
    specTop: '极速',
    specBrake: '最大制动',
    specBarrier: '路障',
    rule1:
      '车会自己全力加速：<b>0–60 mph 只要 0.81 秒</b>，光靠电机极速 <b>250 mph</b>（402 km/h）。车速过 100 km/h 才能刹车。',
    rule2:
      '<b class="cool">按住喷气</b>点燃车尾 4 个喷口，多 2 g 推力，极速冲到 <b>383 mph</b>（616 km/h）。<b>不限时</b>，想喷多久喷多久；松开后风阻会把车速拖下来。',
    rule3: '一踩刹车就切断动力和喷气。<b>按得越久，力度越大。</b>',
    rule4:
      '力度到 <b class="hot">1612 N</b> 也不会翻车：推进器把车托起来，<b class="cool">侧滚一圈</b>再落地，但在空中没法刹车。',
    rule5: '来不及停？它会<b class="cool">侧翻飞过路障</b>稳稳落地，再自己烧着胎刹停，用时会变长。',
    rule6: '得分 = 初速度² ÷ 刹停用时。力度贴着 1612 N 又不碰到它，停得最快。',
    start: '开始挑战',
    again: '再来一次',
    rules: '规则',
    soundOn: '音效：开',
    soundOff: '音效：关',
    hintDesktop: '按住空格刹车 · 按住 Shift 或 ↑ 喷气',
    hintTouch: '左下按钮喷气 · 右下按钮或屏幕任意位置刹车',
    footnote:
      '0–60 mph 0.81 秒来自 2026 年 10 月新款 Roadster 发布会。383 mph（约音速的一半）是 Musk 提过的目标，发布会只确认超过 230 mph；电机极速用的是 2017 年承诺的 250 mph。喷气推力（游戏里不限时）和制动力是游戏设定。',
    jet: '喷气',
    tip: '☕ 请我喝杯咖啡',
    best: '最佳成绩 {n}',
    newBest: '新纪录！',
    brakeTimer: '刹车计时',
    toBarrier: '距路障',
    cleared: '已飞越',
    pedal: '踏板力',
    flipsLabel: '空翻',
    brake: '刹车',
    brakeReady: '踩刹车!',
    brakeHold: '按住加力',
    brakeAir: '空中',
    brakeAuto: '自动刹停',
    tooEarly: '车速过 100 km/h 才能刹车',
    brakeStart: '动力切断 · 初速度 {v} km/h',
    flip: '踏板到顶！空翻 ×{n}',
    leap: '来不及了，飞越路障！',
    land: '稳稳落地',
    landLeap: '飞越成功！',
    stopped: '完美刹停！',
    resClean: '刹停成功',
    resLeap: '飞越路障，平稳落地',
    subClean: '停在路障前 {gap} 米',
    subFlips: '路上空翻 {n} 次，停在路障前 {gap} 米',
    subLeap: '落地就结束；用时按它自己刹停所需的时间计算',
    statV0: '初速度',
    statTime: '刹停用时',
    statDist: '制动距离',
    statForce: '最大踏板力',
    statFlips: '空翻',
    statGap: '离路障',
    statOver: '越过路障',
    chartTitle: '制动过程',
    chartSpeed: '车速',
    chartForce: '踏板力',
    chartAir: '空中',
    score: '得分',
    donateTitle: '觉得好玩的话',
    donateBody: '完全随意，谢谢你玩到这里。',
    alipay: '支付宝',
    close: '关闭',
  },
  en: {
    docTitle: 'Brake or Flip — shiqi.si',
    loading: 'Building the scene…',
    eyebrow: '0–60 MPH · 0.81 S',
    title: 'Brake or Flip',
    tagline: "Brake harder, stop sooner. Overdo it and the car won't crash. It flies.",
    specTop: 'Top speed',
    specBrake: 'Max braking',
    specBarrier: 'Barrier',
    rule1:
      'The car launches on its own: <b>0–60 mph in 0.81 s</b>, and the motors alone top out at <b>250 mph</b> (402 km/h). Braking unlocks at 100 km/h.',
    rule2:
      '<b class="cool">Hold JET</b> to light the four rear nozzles: 2 g of extra push, up to <b>383 mph</b> (616 km/h). <b>No limit</b>: fire as long as you like. Let go and drag slows you back down.',
    rule3:
      'Braking cuts the motors and the jets. <b>The longer you hold, the harder it brakes.</b>',
    rule4:
      'Hit <b class="hot">1612 N</b> and nothing breaks: the thrusters lift the car, it <b class="cool">rolls sideways</b> and lands. It can\'t brake in the air.',
    rule5:
      'Can\'t stop in time? It <b class="cool">rolls sideways over the barrier</b>, lands, then burns its tyres to a stop. That costs time.',
    rule6: 'Score = initial speed² ÷ stopping time. Ride just under 1612 N to stop fastest.',
    start: 'Start',
    again: 'Again',
    rules: 'Rules',
    soundOn: 'Sound: on',
    soundOff: 'Sound: off',
    hintDesktop: 'Hold Space to brake · hold Shift or ↑ for the jets',
    hintTouch: 'Bottom-left: jets · bottom-right or anywhere: brake',
    footnote:
      '0–60 mph in 0.81 s is from the new Roadster reveal (October 2026). 383 mph, about half the speed of sound, is a target Musk has named; the reveal only confirmed over 230 mph. The 250 mph motor limit is the 2017 promise. Jet thrust (unlimited here) and braking are game settings.',
    jet: 'JET',
    tip: '☕ Buy me a coffee',
    best: 'Best {n}',
    newBest: 'New best!',
    brakeTimer: 'Brake timer',
    toBarrier: 'To barrier',
    cleared: 'Cleared',
    pedal: 'Pedal',
    flipsLabel: 'flips',
    brake: 'Brake',
    brakeReady: 'Brake!',
    brakeHold: 'Hold',
    brakeAir: 'Airborne',
    brakeAuto: 'Auto',
    tooEarly: 'Brake unlocks at 100 km/h',
    brakeStart: 'Power cut · {v} km/h',
    flip: 'Pedal maxed! Flip ×{n}',
    leap: 'Too late. Over the barrier!',
    land: 'Clean landing',
    landLeap: 'Cleared it!',
    stopped: 'Stopped!',
    resClean: 'Stopped',
    resLeap: 'Over the barrier, clean landing',
    subClean: 'Stopped {gap} m short of the barrier',
    subFlips: 'Flipped {n}× on the way, stopped {gap} m short',
    subLeap: 'The run ends on touchdown; the time includes the self-stop it would need',
    statV0: 'Initial speed',
    statTime: 'Stop time',
    statDist: 'Braking distance',
    statForce: 'Peak pedal',
    statFlips: 'Flips',
    statGap: 'Gap to barrier',
    statOver: 'Past barrier',
    chartTitle: 'Braking profile',
    chartSpeed: 'Speed',
    chartForce: 'Pedal',
    chartAir: 'Airborne',
    score: 'Score',
    donateTitle: 'If you enjoyed it',
    donateBody: 'Totally optional. Thanks for playing.',
    alipay: 'Alipay',
    close: 'Close',
  },
};

const store = {
  get(key) {
    try {
      return localStorage.getItem(`shiqi-brake:${key}`);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`shiqi-brake:${key}`, String(value));
    } catch {
      /* private mode: fine */
    }
  },
};

function pickLang() {
  const q = new URLSearchParams(location.search).get('lang');
  if (q) return q.toLowerCase().startsWith('zh') ? 'zh' : 'en';
  const saved = store.get('lang');
  if (saved === 'zh' || saved === 'en') return saved;
  const cookie = document.cookie.match(/(?:^|; )lang=([^;]+)/);
  if (cookie) return decodeURIComponent(cookie[1]).toLowerCase().startsWith('zh') ? 'zh' : 'en';
  return (navigator.language || 'en').toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

let lang = pickLang();

function t(key, vars) {
  let s = STRINGS[lang][key] ?? STRINGS.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

const $ = (id) => document.getElementById(id);
const fmt = (n) => Math.round(n).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US');

/* ============================================================
   Renderer, scene, camera
   ============================================================ */

const isTouch = matchMedia('(pointer: coarse)').matches;
const isSmall = Math.min(screen.width, screen.height) < 700;
const Q = {
  pixelRatio: Math.min(window.devicePixelRatio || 1, isSmall ? 1.6 : 2),
  shadowSize: isSmall ? 1024 : 2048,
  bloom: !isSmall,
};
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const app = $('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Q.pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const FOG = new THREE.Color('#7a4058');
scene.fog = new THREE.Fog(FOG, 140, 1250);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 6000);

const MAX_ANISO = renderer.capabilities.getMaxAnisotropy();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function texFrom(c, { repeat, srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(c);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = MAX_ANISO;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  }
  return tex;
}

/* Seeded noise so the world is the same every load. */
function mulberry32(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- sky ---------- */

const SUN_DIR = new THREE.Vector3(-0.2, 0.045, -1).normalize();

function skyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color('#0d0a24') },
      mid: { value: new THREE.Color('#47205a') },
      horizon: { value: new THREE.Color('#ff8a52') },
      ground: { value: new THREE.Color('#1c1220') },
      sunDir: { value: SUN_DIR },
      sunColor: { value: new THREE.Color('#ffc58a') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 top, mid, horizon, ground, sunDir, sunColor;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(horizon, mid, smoothstep(0.0, 0.2, h));
        col = mix(col, top, smoothstep(0.18, 0.75, h));
        col = mix(col, ground, smoothstep(0.0, -0.06, h));
        // sun glow hugs the horizon, a little wider sideways
        float s = max(dot(d, sunDir), 0.0);
        col += sunColor * (smoothstep(0.99955, 0.9998, s) * 2.6 + pow(s, 60.0) * 0.55 + pow(s, 8.0) * 0.22);
        float band = exp(-abs(h) * 22.0);
        col += vec3(1.0, 0.45, 0.25) * band * 0.18;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

const sky = new THREE.Mesh(new THREE.SphereGeometry(4000, 48, 24), skyMaterial());
sky.renderOrder = -10;
scene.add(sky);

/* Reflections: the paint and the gold glass should mirror this sunset. */
{
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 48, 24), skyMaterial()));
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(90, 32),
    new THREE.MeshBasicMaterial({ color: '#1a1218' }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -2;
  envScene.add(ground);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
  scene.environmentIntensity = 0.9;
  pmrem.dispose();
}

/* ---------- mountains: three rings that ride along with the camera ---------- */

const horizonGroup = new THREE.Group();
scene.add(horizonGroup);

function mountainRing(radius, base, amp, color, seed, rough) {
  const rand = mulberry32(seed);
  const N = 360;
  const phases = Array.from({ length: 5 }, () => rand() * Math.PI * 2);
  const pos = [];
  const idx = [];
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    let h = 0;
    for (let o = 0; o < 5; o++) {
      const f = 2 ** o * 3;
      h += Math.sin(a * f + phases[o]) * (1 / 2 ** o);
    }
    h = base + amp * (0.5 + 0.35 * h) + (rand() - 0.5) * rough;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    pos.push(x, -30, z, x, h, z);
    if (i < N) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  const m = new THREE.Mesh(
    g,
    new THREE.MeshBasicMaterial({ color, fog: false, side: THREE.DoubleSide }),
  );
  m.renderOrder = -5;
  return m;
}

horizonGroup.add(mountainRing(2600, 70, 230, '#5a2d4c', 11, 14));
horizonGroup.add(mountainRing(2050, 40, 160, '#3b1f3d', 23, 10));
horizonGroup.add(mountainRing(1650, 10, 90, '#24142a', 37, 6));

/* ---------- lights ---------- */

const hemi = new THREE.HemisphereLight('#a184d8', '#3a2526', 0.75);
scene.add(hemi);

const sun = new THREE.DirectionalLight('#ffb27c', 2.1);
sun.castShadow = true;
sun.shadow.mapSize.set(Q.shadowSize, Q.shadowSize);
sun.shadow.camera.left = -10;
sun.shadow.camera.right = 10;
sun.shadow.camera.top = 10;
sun.shadow.camera.bottom = -10;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 220;
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

/* ============================================================
   World
   ============================================================ */

const TRACK = SPEC.track;
const BARRIER = TRACK.barrierDistance;
const ROAD_START = -120;
const ROAD_END = BARRIER + TRACK.runoff;
const ROAD_LEN = ROAD_END - ROAD_START;
const ROAD_W = 14;
const toZ = (x) => -x; // road distance → world z

/* ---------- ground ---------- */

function groundTexture() {
  const [c, g] = canvas(256, 256);
  const rand = mulberry32(5);
  g.fillStyle = '#3a2a2c';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const v = 30 + rand() * 40;
    g.fillStyle = `rgba(${v + 20},${v},${v - 4},${0.25 + rand() * 0.35})`;
    g.fillRect(rand() * 256, rand() * 256, 1 + rand() * 3, 1 + rand() * 2);
  }
  return texFrom(c, { repeat: [260, 260] });
}

const GROUND_TILE = 6000 / 260;
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(6000, 6000),
  new THREE.MeshStandardMaterial({ map: groundTexture(), roughness: 1, color: '#9a8a8a' }),
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.04;
ground.receiveShadow = true;
scene.add(ground);

/* ---------- road ---------- */

const LANE = 3.75;
const TILE = 30; // one texture tile: two 6 m dashes with 9 m gaps

function roadTexture() {
  const W = 512;
  const H = 1024;
  const [c, g] = canvas(W, H);
  const px = W / ROAD_W;
  const py = H / TILE;
  g.fillStyle = '#2a292e';
  g.fillRect(0, 0, W, H);
  const rand = mulberry32(9);
  for (let i = 0; i < 9000; i++) {
    const v = 28 + rand() * 40;
    g.fillStyle = `rgba(${v},${v},${v + 6},${0.35 + rand() * 0.4})`;
    g.fillRect(rand() * W, rand() * H, 1 + rand() * 1.6, 1 + rand() * 1.6);
  }
  // worn tyre tracks in each lane
  for (const lane of [-LANE, 0, LANE]) {
    for (const off of [-0.9, 0.9]) {
      const x = (ROAD_W / 2 + lane + off) * px;
      const grad = g.createLinearGradient(x - 0.4 * px, 0, x + 0.4 * px, 0);
      grad.addColorStop(0, 'rgba(10,10,14,0)');
      grad.addColorStop(0.5, 'rgba(10,10,14,0.22)');
      grad.addColorStop(1, 'rgba(10,10,14,0)');
      g.fillStyle = grad;
      g.fillRect(x - 0.4 * px, 0, 0.8 * px, H);
    }
  }
  g.fillStyle = '#e9e6df';
  // solid edge lines
  for (const x of [-6.4, 6.4]) g.fillRect((ROAD_W / 2 + x - 0.075) * px, 0, 0.15 * px, H);
  // dashed lane lines, 6 m on / 9 m off
  for (const x of [-LANE / 2, LANE / 2]) {
    for (const y0 of [0, 15]) g.fillRect((ROAD_W / 2 + x - 0.075) * px, y0 * py, 0.15 * px, 6 * py);
  }
  return texFrom(c, { repeat: [1, ROAD_LEN / TILE] });
}

const road = new THREE.Mesh(
  new THREE.PlaneGeometry(ROAD_W, ROAD_LEN),
  new THREE.MeshStandardMaterial({ map: roadTexture(), roughness: 0.82, metalness: 0.02 }),
);
road.rotation.x = -Math.PI / 2;
road.position.set(0, 0, toZ(ROAD_START + ROAD_LEN / 2));
road.receiveShadow = true;
scene.add(road);

/* shoulders */
for (const side of [-1, 1]) {
  const s = new THREE.Mesh(
    new THREE.PlaneGeometry(3, ROAD_LEN),
    new THREE.MeshStandardMaterial({ color: '#4a3a38', roughness: 1 }),
  );
  s.rotation.x = -Math.PI / 2;
  s.position.set(side * (ROAD_W / 2 + 1.5), -0.02, road.position.z);
  s.receiveShadow = true;
  scene.add(s);
}

/* start line */
{
  const [c, g] = canvas(256, 32);
  for (let i = 0; i < 16; i++)
    for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? '#111' : '#eee';
      g.fillRect(i * 16, j * 16, 16, 16);
    }
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_W - 1.2, 1.1),
    new THREE.MeshStandardMaterial({ map: texFrom(c), roughness: 0.7 }),
  );
  line.rotation.x = -Math.PI / 2;
  line.position.set(0, 0.012, toZ(3.4));
  line.receiveShadow = true;
  scene.add(line);
}

/* ---------- guard rails ---------- */

const railMat = new THREE.MeshStandardMaterial({
  color: '#b9b6bd',
  metalness: 0.75,
  roughness: 0.35,
});
for (const side of [-1, 1]) {
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.32, ROAD_LEN), railMat);
  rail.position.set(side * 7.55, 0.62, road.position.z);
  scene.add(rail);
}
{
  const step = 4;
  const count = Math.floor(ROAD_LEN / step) * 2;
  const posts = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.12, 0.72, 0.12),
    new THREE.MeshStandardMaterial({ color: '#6c6872', metalness: 0.5, roughness: 0.5 }),
    count,
  );
  const m = new THREE.Matrix4();
  let i = 0;
  for (let x = ROAD_START; x < ROAD_END && i < count; x += step) {
    for (const side of [-1, 1]) {
      m.makeTranslation(side * 7.65, 0.36, toZ(x));
      posts.setMatrixAt(i++, m);
    }
  }
  posts.count = i;
  scene.add(posts);
}

/* ---------- street lamps ---------- */

function radialTexture(inner, outer) {
  const [c, g] = canvas(128, 128);
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return texFrom(c);
}

const LAMP_EVERY = 60;
const lampHeads = [];
{
  const xs = [];
  for (let x = ROAD_START + 20; x < ROAD_END; x += LAMP_EVERY) {
    xs.push([x, 1], [x + LAMP_EVERY / 2, -1]);
  }
  const poleGeo = new THREE.CylinderGeometry(0.07, 0.11, 10, 8);
  poleGeo.translate(0, 5, 0);
  const armGeo = new THREE.BoxGeometry(2.6, 0.1, 0.1);
  const headGeo = new THREE.BoxGeometry(0.9, 0.14, 0.36);
  const dark = new THREE.MeshStandardMaterial({ color: '#2d2a33', metalness: 0.6, roughness: 0.5 });
  const lit = new THREE.MeshStandardMaterial({
    color: '#fff1d6',
    emissive: '#ffd59a',
    emissiveIntensity: 3.2,
  });
  const poles = new THREE.InstancedMesh(poleGeo, dark, xs.length);
  const arms = new THREE.InstancedMesh(armGeo, dark, xs.length);
  const heads = new THREE.InstancedMesh(headGeo, lit, xs.length);
  const pools = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(13, 13),
    new THREE.MeshBasicMaterial({
      map: radialTexture('rgba(255,205,140,0.55)', 'rgba(255,205,140,0)'),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: true,
    }),
    xs.length,
  );
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
  const one = new THREE.Vector3(1, 1, 1);
  xs.forEach(([x, side], i) => {
    const px = side * 8.6;
    m.makeTranslation(px, 0, toZ(x));
    poles.setMatrixAt(i, m);
    m.makeTranslation(px - side * 1.25, 9.95, toZ(x));
    arms.setMatrixAt(i, m);
    m.makeTranslation(px - side * 2.4, 9.85, toZ(x));
    heads.setMatrixAt(i, m);
    lampHeads.push(px - side * 2.4, 9.72, toZ(x));
    m.compose(new THREE.Vector3(px - side * 2.6, 0.02, toZ(x)), q, one);
    pools.setMatrixAt(i, m);
  });
  poles.castShadow = false;
  scene.add(poles, arms, heads, pools);
}

/* ---------- glow sprites (lamp halos, barrier lights) ---------- */

const glowTex = radialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');

function glowPoints(positions, color, size) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    map: glowTex,
    color,
    size,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(g, mat);
}

scene.add(glowPoints(lampHeads, '#ffc98a', 3.2));

/* ---------- signs ---------- */

function signTexture(lines, bg, fg, w = 512, h = 256) {
  const [c, g] = canvas(w, h);
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.strokeStyle = fg;
  g.lineWidth = 10;
  g.strokeRect(14, 14, w - 28, h - 28);
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  lines.forEach(([text, size, y]) => {
    g.font = `800 ${size}px "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif`;
    g.fillText(text, w / 2, y * h);
  });
  return texFrom(c);
}

const signPost = new THREE.MeshStandardMaterial({
  color: '#56535b',
  metalness: 0.6,
  roughness: 0.4,
});

function addBoard(x, label) {
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 1.6),
    new THREE.MeshStandardMaterial({
      map: signTexture(
        [
          [label, 120, 0.42],
          ['路障 · BARRIER', 46, 0.78],
        ],
        '#13603d',
        '#f2f2ea',
      ),
      roughness: 0.6,
      emissive: '#ffffff',
      emissiveIntensity: 0.12,
    }),
  );
  board.position.set(9.4, 4.6, toZ(x));
  scene.add(board);
  for (const dx of [-1.1, 1.1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 4.2, 8), signPost);
    p.position.set(9.4 + dx, 2.1, toZ(x) - 0.05);
    scene.add(p);
  }
}

for (const d of [1000, 500, 300, 200, 100]) addBoard(BARRIER - d, `${d} m`);

/* ---------- barrier ---------- */

const barrierLights = [];
let barrierLamp = null;
{
  const [c, g] = canvas(256, 128);
  g.fillStyle = '#f2efe8';
  g.fillRect(0, 0, 256, 128);
  g.fillStyle = '#d6261b';
  for (let i = -4; i < 10; i++) {
    g.beginPath();
    g.moveTo(i * 40, 128);
    g.lineTo(i * 40 + 20, 128);
    g.lineTo(i * 40 + 20 + 64, 0);
    g.lineTo(i * 40 + 64, 0);
    g.closePath();
    g.fill();
  }
  const stripe = texFrom(c);
  const mat = new THREE.MeshStandardMaterial({
    map: stripe,
    roughness: 0.55,
    emissive: '#ffffff',
    emissiveMap: stripe,
    emissiveIntensity: 0.08,
  });
  const w = 2.7;
  const h = TRACK.barrierHeight;
  const d = TRACK.barrierDepth;
  for (let i = 0; i < 5; i++) {
    const block = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    block.position.set(-5.6 + i * 2.8, h / 2, toZ(BARRIER + d / 2));
    block.castShadow = true;
    block.receiveShadow = true;
    scene.add(block);
    barrierLights.push(-5.6 + i * 2.8, h + 0.14, toZ(BARRIER + d / 2));
  }
  const lampMat = new THREE.MeshStandardMaterial({
    color: '#ffb347',
    emissive: '#ff9d2e',
    emissiveIntensity: 4,
  });
  for (let i = 0; i < barrierLights.length; i += 3) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), lampMat);
    l.position.set(barrierLights[i], barrierLights[i + 1], barrierLights[i + 2]);
    scene.add(l);
  }
  barrierLamp = lampMat;
  // closed-road board behind the blocks
  const board = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 1.7),
    new THREE.MeshStandardMaterial({
      map: signTexture(
        [
          ['道路封闭', 96, 0.4],
          ['ROAD CLOSED', 64, 0.76],
        ],
        '#d6261b',
        '#ffffff',
        640,
        200,
      ),
      emissive: '#ffffff',
      emissiveIntensity: 0.18,
      roughness: 0.5,
    }),
  );
  board.position.set(0, 3.2, toZ(BARRIER + 4));
  scene.add(board);
  for (const dx of [-2.6, 2.6]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 8), signPost);
    p.position.set(dx, 1.6, toZ(BARRIER + 4) - 0.06);
    scene.add(p);
  }
}
const barrierGlow = glowPoints(barrierLights, '#ffa640', 1.6);
scene.add(barrierGlow);

/* ---------- skid marks ---------- */

const SKID_MAX = 1600;
const skids = new THREE.InstancedMesh(
  new THREE.PlaneGeometry(0.28, 0.62).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({
    color: '#0a090b',
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
  }),
  SKID_MAX,
);
skids.count = 0;
skids.frustumCulled = false;
scene.add(skids);
let skidCursor = 0;
let skidLastX = 0;

function addSkid(x, z) {
  const m = new THREE.Matrix4().makeTranslation(x, 0.015, z);
  skids.setMatrixAt(skidCursor, m);
  skidCursor = (skidCursor + 1) % SKID_MAX;
  skids.count = Math.min(SKID_MAX, skids.count + 1);
  skids.instanceMatrix.needsUpdate = true;
}

function clearSkids() {
  skids.count = 0;
  skidCursor = 0;
}

/* ============================================================
   The car (an original angular two-seater, not a replica)
   ============================================================ */

function loft(rings, capStart = true, capEnd = true) {
  const pos = [];
  const push = (a, b, c) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let i = 0; i < rings.length - 1; i++) {
    const A = rings[i];
    const B = rings[i + 1];
    const n = A.length;
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      push(A[k], B[k], A[k2]);
      push(A[k2], B[k], B[k2]);
    }
  }
  const cap = (R, flip) => {
    const c = new THREE.Vector3();
    R.forEach((p) => c.add(p));
    c.multiplyScalar(1 / R.length);
    for (let k = 0; k < R.length; k++) {
      const k2 = (k + 1) % R.length;
      if (flip) push(c, R[k2], R[k]);
      else push(c, R[k], R[k2]);
    }
  };
  if (capStart) cap(rings[0], false);
  if (capEnd) cap(rings[rings.length - 1], true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// [z, bottom y, shoulder y, deck y, bottom half-width, shoulder half-width, deck half-width]
const BODY = [
  [-2.32, 0.2, 0.36, 0.4, 0.7, 0.8, 0.62],
  [-2.12, 0.15, 0.46, 0.52, 0.86, 0.94, 0.74],
  [-1.82, 0.13, 0.7, 0.64, 0.9, 1.0, 0.78],
  [-1.45, 0.13, 0.79, 0.72, 0.82, 1.02, 0.8],
  [-1.08, 0.13, 0.72, 0.77, 0.88, 1.0, 0.8],
  [-0.6, 0.12, 0.6, 0.8, 0.94, 0.98, 0.8],
  [0.2, 0.12, 0.6, 0.82, 0.94, 0.98, 0.8],
  [0.88, 0.12, 0.68, 0.84, 0.92, 1.0, 0.82],
  [1.18, 0.13, 0.79, 0.86, 0.86, 1.03, 0.85],
  [1.45, 0.13, 0.83, 0.86, 0.8, 1.04, 0.86],
  [1.84, 0.14, 0.8, 0.84, 0.86, 1.02, 0.86],
  [2.15, 0.17, 0.72, 0.8, 0.86, 0.96, 0.82],
  [2.34, 0.24, 0.64, 0.74, 0.8, 0.88, 0.76],
];

// [z, base y, top y, base half-width, top half-width]
const CANOPY = [
  [-1.18, 0.76, 0.78, 0.72, 0.66],
  [-0.78, 0.79, 0.99, 0.77, 0.56],
  [-0.2, 0.81, 1.1, 0.79, 0.52],
  [0.45, 0.83, 1.12, 0.8, 0.52],
  [1.0, 0.85, 1.02, 0.8, 0.58],
  [1.45, 0.86, 0.92, 0.78, 0.66],
  [1.74, 0.85, 0.87, 0.74, 0.7],
];

function plateTexture() {
  const [c, g] = canvas(640, 200);
  const grad = g.createLinearGradient(0, 0, 0, 200);
  grad.addColorStop(0, '#f4fbf2');
  grad.addColorStop(0.45, '#bfe8b8');
  grad.addColorStop(1, '#3fbf5f');
  g.fillStyle = grad;
  g.beginPath();
  g.roundRect(4, 4, 632, 192, 18);
  g.fill();
  g.strokeStyle = '#1b1b1b';
  g.lineWidth = 5;
  g.beginPath();
  g.roundRect(14, 14, 612, 172, 12);
  g.stroke();
  g.fillStyle = '#111';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'bold 92px "PingFang SC", "Microsoft YaHei", "DIN Alternate", sans-serif';
  g.fillText('沪A·D1612F', 320, 108);
  const tex = texFrom(c);
  return tex;
}

/* Rocket-style plume: a hot core that thins out, with bright shock diamonds
   ("Mach rings") spaced along it. Drawn additively on an open cone. */
const plumeTime = { value: 0 };

function plumeMesh(length, r0, r1) {
  const geo = new THREE.CylinderGeometry(r0, r1, length, 24, 24, true);
  geo.translate(0, -length / 2, 0); // nozzle at the origin, plume along −y
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: plumeTime,
      uPower: { value: 0 },
      uSeed: { value: Math.random() * 10 },
      uCore: { value: new THREE.Color('#f4fbff') },
      uEdge: { value: new THREE.Color('#3f6dff') },
      uRing: { value: new THREE.Color('#fff0c2') },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        vUv = uv;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vN = normalize(mat3(modelMatrix) * normal);
        vV = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime, uPower, uSeed; uniform vec3 uCore, uEdge, uRing;
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        float u = 1.0 - vUv.y;                       // 0 at the nozzle, 1 at the tail
        float facing = abs(dot(normalize(vN), normalize(vV)));
        float core = pow(facing, 1.6);
        float fade = pow(1.0 - u, 1.35) * smoothstep(0.0, 0.03, u);
        // shock diamonds: tight bright bands that weaken downstream
        float spacing = 6.5;
        float ring = pow(max(0.0, cos(u * 3.14159 * spacing - 1.2)), 14.0);
        ring *= smoothstep(0.02, 0.1, u) * (1.0 - smoothstep(0.35, 0.8, u));
        float flick = 0.86 + 0.14 * sin(uTime * 71.0 + uSeed + u * 30.0) * sin(uTime * 37.0 + uSeed * 2.0);
        float a = (core * fade * 0.85 + ring * core * 2.2) * uPower * flick;
        vec3 col = mix(uEdge, uCore, clamp(core * 0.9, 0.0, 1.0));
        col = mix(col, uRing, clamp(ring * 1.4, 0.0, 1.0));
        gl_FragColor = vec4(col * a * 1.9, a);
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = 5;
  return mesh;
}

const car = (() => {
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  pivot.position.y = 0.55;
  root.add(pivot);
  const model = new THREE.Group();
  model.position.y = -0.55;
  pivot.add(model);

  const paint = new THREE.MeshPhysicalMaterial({
    color: '#e9eae5',
    metalness: 0.12,
    roughness: 0.34,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const carbon = new THREE.MeshStandardMaterial({
    color: '#16151a',
    metalness: 0.35,
    roughness: 0.55,
    flatShading: true,
    side: THREE.DoubleSide,
  });
  const visor = new THREE.MeshPhysicalMaterial({
    color: '#d9ab52',
    metalness: 1,
    roughness: 0.1,
    clearcoat: 1,
    flatShading: true,
    side: THREE.DoubleSide,
  });

  const upper = [];
  const lower = [];
  for (const [z, yb, ys, yt, wb, ws, wt] of BODY) {
    const yk = yb + 0.13;
    const wk = wb + (ws - wb) * 0.3;
    upper.push([
      V(wk, yk, z),
      V(ws, ys, z),
      V(wt, yt, z),
      V(-wt, yt, z),
      V(-ws, ys, z),
      V(-wk, yk, z),
    ]);
    lower.push([V(wb, yb, z), V(wk, yk, z), V(-wk, yk, z), V(-wb, yb, z)]);
  }
  const body = new THREE.Mesh(loft(upper), paint);
  const skirt = new THREE.Mesh(loft(lower), carbon);
  const canopyRings = CANOPY.map(([z, yb, yt, wb, wt]) => [
    V(wb, yb, z),
    V(wt, yt, z),
    V(-wt, yt, z),
    V(-wb, yb, z),
  ]);
  const canopy = new THREE.Mesh(loft(canopyRings), visor);
  for (const m of [body, skirt, canopy]) {
    m.castShadow = true;
    model.add(m);
  }

  // underbody: battery-pack floor with cross members, seen whenever the car flips
  {
    const [c, g] = canvas(256, 512);
    g.fillStyle = '#4a4d55';
    g.fillRect(0, 0, 256, 512);
    g.fillStyle = '#383a41';
    for (let y = 70; y < 450; y += 38) g.fillRect(36, y, 184, 30);
    g.strokeStyle = '#6a6e78';
    g.lineWidth = 6;
    g.strokeRect(30, 60, 196, 392);
    g.beginPath();
    g.moveTo(128, 60);
    g.lineTo(128, 452);
    g.stroke();
    g.fillStyle = '#2b2d33';
    for (const y of [24, 488]) g.fillRect(20, y - 10, 216, 20);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(1.66, 4.3),
      new THREE.MeshStandardMaterial({
        map: texFrom(c),
        metalness: 0.55,
        roughness: 0.55,
        side: THREE.DoubleSide,
      }),
    );
    floor.rotation.x = Math.PI / 2;
    floor.position.y = 0.118;
    model.add(floor);
  }

  // light bars
  const headMat = new THREE.MeshStandardMaterial({
    color: '#ffffff',
    emissive: '#dff1ff',
    emissiveIntensity: 5,
  });
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.028, 0.04), headMat);
  head.position.set(0, 0.37, -2.33);
  model.add(head);
  const tailMat = new THREE.MeshStandardMaterial({
    color: '#ff3a2a',
    emissive: '#ff2414',
    emissiveIntensity: 2,
  });
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.045, 0.04), tailMat);
  tail.position.set(0, 0.63, 2.35);
  model.add(tail);

  // splitter and diffuser
  const splitter = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 0.3), carbon);
  splitter.position.set(0, 0.13, -2.2);
  model.add(splitter);
  const diffuser = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 0.32), carbon);
  diffuser.position.set(0, 0.22, 2.2);
  model.add(diffuser);

  // cold-gas thruster nozzles: four at the rear, four at the corners
  const nozzleMat = new THREE.MeshStandardMaterial({
    color: '#2a3138',
    metalness: 0.8,
    roughness: 0.3,
    emissive: '#8fdcff',
    emissiveIntensity: 0,
  });
  const nozzles = [];
  const plumes = [];
  for (const x of [-0.55, -0.25, 0.25, 0.55]) {
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, 0.08, 14), nozzleMat);
    n.rotation.x = Math.PI / 2;
    n.position.set(x, 0.21, 2.37);
    model.add(n);
    nozzles.push({ pos: V(x, 0.21, 2.42), dir: V(0, -0.05, 1) });
    const plume = plumeMesh(4.6, 0.06, 0.3);
    plume.rotation.x = -Math.PI / 2; // −y → +z, straight out of the back
    plume.position.set(x, 0.21, 2.41);
    model.add(plume);
    plumes.push(plume);
  }
  const jetLight = new THREE.PointLight('#8fb3ff', 0, 16, 1.6);
  jetLight.position.set(0, 0.5, 3.6);
  model.add(jetLight);
  for (const [x, z] of [
    [-0.95, -1.95],
    [0.95, -1.95],
    [-0.95, 1.95],
    [0.95, 1.95],
  ]) {
    nozzles.push({ pos: V(x, 0.14, z), dir: V(Math.sign(x) * 0.45, -1, Math.sign(z) * 0.2) });
  }

  // active rear wing (airbrake while braking)
  const wingPivot = new THREE.Group();
  wingPivot.position.set(0, 0.92, 2.02);
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.026, 0.34), carbon);
  wing.position.z = 0.12;
  wing.castShadow = true;
  wingPivot.add(wing);
  model.add(wingPivot);
  for (const x of [-0.5, 0.5]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.12), carbon);
    strut.position.set(x, 0.87, 2.04);
    model.add(strut);
  }

  // plates: 440 × 140 mm, like the real thing
  const plateMat = new THREE.MeshStandardMaterial({
    map: plateTexture(),
    roughness: 0.45,
    metalness: 0.1,
  });
  const rear = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.14), plateMat);
  rear.position.set(0, 0.42, 2.352);
  model.add(rear);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.14), plateMat);
  front.position.set(0, 0.27, -2.335);
  front.rotation.y = Math.PI;
  model.add(front);

  // wheels
  const tireMat = new THREE.MeshStandardMaterial({ color: '#111114', roughness: 0.92 });
  const rimMat = new THREE.MeshStandardMaterial({
    color: '#3b3e46',
    metalness: 0.85,
    roughness: 0.3,
  });
  const spokeMat = new THREE.MeshStandardMaterial({ color: '#0e0e10', roughness: 0.6 });
  const caliperMat = new THREE.MeshStandardMaterial({
    color: '#d9ab52',
    metalness: 0.6,
    roughness: 0.35,
  });
  const tireGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 36).rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.27, 0.27, 0.31, 28).rotateZ(Math.PI / 2);
  const spokeGeo = new THREE.BoxGeometry(0.02, 0.5, 0.05);
  const wheels = [];
  for (const [x, z] of [
    [-0.88, -1.45],
    [0.88, -1.45],
    [-0.88, 1.45],
    [0.88, 1.45],
  ]) {
    const w = new THREE.Group();
    w.position.set(x, 0.36, z);
    const spin = new THREE.Group();
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = true;
    spin.add(tire, new THREE.Mesh(rimGeo, rimMat));
    for (let i = 0; i < 5; i++) {
      const s = new THREE.Mesh(spokeGeo, spokeMat);
      s.position.x = Math.sign(x) * 0.158;
      s.rotation.x = (i / 5) * Math.PI;
      spin.add(s);
    }
    const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.22), caliperMat);
    caliper.position.set(Math.sign(x) * 0.08, 0.13, -0.08);
    w.add(spin, caliper);
    model.add(w);
    wheels.push(spin);
  }

  // headlights that actually light the road
  const beam = new THREE.SpotLight('#e4f1ff', 70, 170, 0.42, 0.65, 1.1);
  beam.position.set(0, 0.45, -2.2);
  beam.target.position.set(0, 0, -34);
  model.add(beam, beam.target);

  // soft contact shadow, useful where the shadow map is coarse
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 5.4),
    new THREE.MeshBasicMaterial({
      map: radialTexture('rgba(0,0,0,0.6)', 'rgba(0,0,0,0)'),
      transparent: true,
      depthWrite: false,
    }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.01;
  scene.add(blob);

  scene.add(root);
  return {
    root,
    pivot,
    model,
    wheels,
    wingPivot,
    tailMat,
    nozzleMat,
    nozzles,
    plumes,
    jetLight,
    blob,
    headMat,
  };
})();

/* ============================================================
   Particles
   ============================================================ */

function cloudTexture(seed) {
  const [c, g] = canvas(128, 128);
  const rand = mulberry32(seed);
  for (let i = 0; i < 18; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * 28;
    const x = 64 + Math.cos(a) * r;
    const y = 64 + Math.sin(a) * r;
    const rad = 18 + rand() * 26;
    const grad = g.createRadialGradient(x, y, 0, x, y, rad);
    grad.addColorStop(0, 'rgba(255,255,255,0.32)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  }
  // keep the edge of the sprite clean
  g.globalCompositeOperation = 'destination-in';
  const mask = g.createRadialGradient(64, 64, 30, 64, 64, 64);
  mask.addColorStop(0, 'rgba(0,0,0,1)');
  mask.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = mask;
  g.fillRect(0, 0, 128, 128);
  return texFrom(c, { srgb: false });
}

const cloudTex = cloudTexture(3);
const WHITE = new THREE.Color('#f2edf0');

class Particles {
  constructor(capacity, { blending = THREE.NormalBlending, map = cloudTex, spin = true } = {}) {
    this.cap = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.size = new Float32Array(capacity);
    this.alpha = new Float32Array(capacity);
    this.rot = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.max = new Float32Array(capacity);
    this.base = new Float32Array(capacity);
    this.grow = new Float32Array(capacity);
    this.cursor = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    g.setAttribute('aRot', new THREE.BufferAttribute(this.rot, 1));
    this.geo = g;
    this.mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending,
      uniforms: {
        uScale: { value: window.innerHeight * Q.pixelRatio },
        uMap: { value: map },
        uSpin: { value: spin ? 1 : 0 },
      },
      vertexShader: /* glsl */ `
        attribute float aSize; attribute float aAlpha; attribute float aRot; attribute vec3 aColor;
        uniform float uScale; varying float vA; varying float vR; varying vec3 vC;
        void main() {
          vR = aRot; vC = aColor;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vA = aAlpha * smoothstep(0.6 + aSize * 0.5, 2.5 + aSize * 1.5, -mv.z);
          gl_PointSize = min(aSize * uScale / -mv.z, 900.0);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform float uSpin; varying float vA; varying float vR; varying vec3 vC;
        void main() {
          vec2 p = gl_PointCoord - 0.5;
          float c = cos(vR * uSpin), s = sin(vR * uSpin);
          p = mat2(c, -s, s, c) * p + 0.5;
          float a = texture2D(uMap, p).a * vA;
          if (a < 0.008) discard;
          gl_FragColor = vec4(vC, a);
        }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  emit(p, v, size, life, alpha = 1, color = WHITE, grow = 1) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.cap;
    this.pos.set([p.x, p.y, p.z], i * 3);
    this.vel.set([v.x, v.y, v.z], i * 3);
    this.col.set([color.r, color.g, color.b], i * 3);
    this.size[i] = size;
    this.life[i] = life;
    this.max[i] = life;
    this.base[i] = alpha;
    this.alpha[i] = alpha;
    this.rot[i] = Math.random() * 6.28;
    this.grow[i] = grow;
  }

  update(dt, { gravity = 0, drag = 1, growth = 1 }) {
    const k = Math.exp(-drag * dt);
    for (let i = 0; i < this.cap; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const o = i * 3;
      this.vel[o + 1] -= gravity * dt;
      this.vel[o] *= k;
      this.vel[o + 1] *= k;
      this.vel[o + 2] *= k;
      this.pos[o] += this.vel[o] * dt;
      this.pos[o + 1] = Math.max(0.05, this.pos[o + 1] + this.vel[o + 1] * dt);
      this.pos[o + 2] += this.vel[o + 2] * dt;
      this.size[i] += growth * this.grow[i] * dt;
      this.rot[i] += dt * 0.3;
      const f = this.life[i] / this.max[i];
      // fade in fast, linger, fade out
      this.alpha[i] =
        this.life[i] <= 0 ? 0 : this.base[i] * Math.min(1, (1 - f) * 8) * Math.min(1, f * 2.2);
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aColor.needsUpdate = true;
    this.geo.attributes.aSize.needsUpdate = true;
    this.geo.attributes.aAlpha.needsUpdate = true;
    this.geo.attributes.aRot.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
    this.alpha.fill(0);
    this.geo.attributes.aAlpha.needsUpdate = true;
  }

  resize() {
    this.mat.uniforms.uScale.value = window.innerHeight * Q.pixelRatio;
  }
}

// ground clouds (landing, burnouts) and thruster vapour (white jets that hang in the air)
const smoke = new Particles(isSmall ? 900 : 1600);
const vapor = new Particles(isSmall ? 1100 : 2000);
const PINK = new THREE.Color('#ff9aa6');
const WARM = new THREE.Color('#f7d9d6');

/* ============================================================
   Sound (all synthesised, nothing to download)
   ============================================================ */

class Sound {
  constructor() {
    this.ctx = null;
    this.muted = store.get('muted') === '1';
  }

  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(ctx.destination);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    const loopNoise = () => {
      const s = ctx.createBufferSource();
      s.buffer = this.noise;
      s.loop = true;
      s.start();
      return s;
    };

    // electric motor: a low saw for body, a high sine for the inverter whine
    this.motor = ctx.createOscillator();
    this.motor.type = 'sawtooth';
    this.motorFilter = ctx.createBiquadFilter();
    this.motorFilter.type = 'lowpass';
    this.motorGain = ctx.createGain();
    this.motorGain.gain.value = 0;
    this.motor.connect(this.motorFilter).connect(this.motorGain).connect(this.master);
    this.whine = ctx.createOscillator();
    this.whine.type = 'sine';
    this.whineGain = ctx.createGain();
    this.whineGain.gain.value = 0;
    this.whine.connect(this.whineGain).connect(this.master);
    this.motor.start();
    this.whine.start();

    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    loopNoise().connect(this.windFilter).connect(this.windGain).connect(this.master);

    this.squealFilter = ctx.createBiquadFilter();
    this.squealFilter.type = 'bandpass';
    this.squealFilter.frequency.value = 2600;
    this.squealFilter.Q.value = 9;
    this.squealGain = ctx.createGain();
    this.squealGain.gain.value = 0;
    loopNoise().connect(this.squealFilter).connect(this.squealGain).connect(this.master);

    // jets: a low roar for the rear plumes, a hiss for the corner thrusters
    this.jetFilter = ctx.createBiquadFilter();
    this.jetFilter.type = 'lowpass';
    this.jetFilter.frequency.value = 700;
    this.jetGain = ctx.createGain();
    this.jetGain.gain.value = 0;
    loopNoise().connect(this.jetFilter).connect(this.jetGain).connect(this.master);
    this.hissFilter = ctx.createBiquadFilter();
    this.hissFilter.type = 'highpass';
    this.hissFilter.frequency.value = 1500;
    this.hissGain = ctx.createGain();
    this.hissGain.gain.value = 0;
    loopNoise().connect(this.hissFilter).connect(this.hissGain).connect(this.master);
  }

  setMuted(m) {
    this.muted = m;
    store.set('muted', m ? '1' : '0');
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  update({ v, powered, force, active, airborne, jet = 0, lift = false }) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const on = active ? 1 : 0;
    this.motor.frequency.setTargetAtTime(38 + v * 1.4, now, 0.05);
    this.motorFilter.frequency.setTargetAtTime(260 + v * 22, now, 0.05);
    this.motorGain.gain.setTargetAtTime(on * (powered ? 0.06 : 0.018), now, 0.08);
    this.whine.frequency.setTargetAtTime(520 + v * 34, now, 0.05);
    this.whineGain.gain.setTargetAtTime(on * (powered ? 0.022 : 0.006), now, 0.08);
    const w = Math.min(1, v / 100);
    this.windFilter.frequency.setTargetAtTime(400 + v * 9, now, 0.1);
    this.windGain.gain.setTargetAtTime(on * w * w * 0.2, now, 0.12);
    const sq =
      !airborne && force > 1050 && v > 2 ? ((force - 1050) / 560) * Math.min(1, v / 30) : 0;
    this.squealGain.gain.setTargetAtTime(on * sq * 0.07, now, 0.05);
    this.jetGain.gain.setTargetAtTime(on * jet * 0.55, now, 0.06);
    this.jetFilter.frequency.setTargetAtTime(500 + jet * 900, now, 0.08);
    this.hissGain.gain.setTargetAtTime(on * (lift ? 0.28 : 0), now, 0.04);
  }

  ignite() {
    if (!this.ctx) return;
    const at = this.ctx.currentTime;
    this.tone('sine', 70, 40, at, 0.45, 0.45);
    this.burst(at, 0.5, 0.45, 'lowpass', 900, 0.7);
  }

  tone(type, f0, f1, at, dur, vol) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), at + dur);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(this.master);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  burst(at, dur, vol, type, freq, q = 1) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(vol, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    s.connect(f).connect(g).connect(this.master);
    s.start(at, Math.random());
    s.stop(at + dur + 0.05);
  }

  beep(high) {
    if (!this.ctx) return;
    const f = high ? 1320 : 660;
    this.tone('square', f, f, this.ctx.currentTime, high ? 0.45 : 0.16, 0.12);
  }

  click() {
    if (!this.ctx) return;
    const at = this.ctx.currentTime;
    this.burst(at, 0.06, 0.4, 'bandpass', 3000, 2);
    this.tone('sine', 220, 120, at, 0.1, 0.2);
  }

  thrust() {
    if (!this.ctx) return;
    const at = this.ctx.currentTime;
    this.burst(at, 0.9, 0.55, 'highpass', 900, 0.7);
    this.burst(at, 0.5, 0.35, 'lowpass', 300, 0.7);
    this.tone('sine', 140, 50, at, 0.5, 0.25);
  }

  land() {
    if (!this.ctx) return;
    const at = this.ctx.currentTime;
    this.tone('sine', 95, 38, at, 0.35, 0.5);
    this.burst(at, 0.3, 0.3, 'lowpass', 500, 0.8);
  }

  warn() {
    if (!this.ctx) return;
    this.tone('square', 980, 980, this.ctx.currentTime, 0.08, 0.08);
  }

  success() {
    if (!this.ctx) return;
    const at = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.tone('triangle', f, f, at + i * 0.09, 0.4, 0.14),
    );
  }

  ui() {
    if (!this.ctx) return;
    this.tone('sine', 880, 660, this.ctx.currentTime, 0.06, 0.06);
  }
}

const sound = new Sound();

/* ============================================================
   UI
   ============================================================ */

const ui = {
  hud: $('hud'),
  menu: $('menu'),
  result: $('result'),
  donate: $('donate'),
  timer: $('hudTimer'),
  distance: $('hudDistance'),
  distanceLabel: $('hudDistanceLabel'),
  distanceChip: $('hudDistance').parentElement,
  speed: $('hudSpeed'),
  arc: $('speedoArc'),
  force: $('force'),
  forceFill: $('forceFill'),
  forceValue: $('forceValue'),
  brakeBtn: $('brakeBtn'),
  brakeText: $('brakeText'),
  countdown: $('countdown'),
  toast: $('toast'),
  flipBadge: $('flipBadge'),
  flipCount: $('flipCount'),
  mute: $('muteBtn'),
  best: $('menuBest'),
  jetBtn: $('jetBtn'),
  jetGas: $('jetGas'),
  mph: $('hudMph'),
};

const SPEEDO_MAX = 650;
const arcLen = ui.arc.getTotalLength();
ui.arc.style.strokeDasharray = `${arcLen}`;
ui.arc.style.strokeDashoffset = `${arcLen}`;
{
  const a = Math.PI - (SPEC.brake.minSpeedKmh / SPEEDO_MAX) * Math.PI;
  const mark = $('speedoMark');
  mark.setAttribute('x1', `${100 + Math.cos(a) * 70}`);
  mark.setAttribute('y1', `${110 - Math.sin(a) * 70}`);
  mark.setAttribute('x2', `${100 + Math.cos(a) * 94}`);
  mark.setAttribute('y2', `${110 - Math.sin(a) * 94}`);
}

function show(el, on) {
  el.classList.toggle('hidden', !on);
}

let toastTimer = 0;
function toast(text, kind = '', ms = 1500) {
  ui.toast.textContent = text;
  ui.toast.className = `toast ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => show(ui.toast, false), ms);
}

function showCountdown(text) {
  if (text === null) {
    show(ui.countdown, false);
    return;
  }
  ui.countdown.textContent = text;
  show(ui.countdown, false);
  ui.countdown.getBoundingClientRect(); // reflow, so the pop animation restarts
  show(ui.countdown, true);
}

function bestScore() {
  return Number(store.get('best')) || 0;
}

function applyLang() {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  document.title = t('docTitle');
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-html]'))
    el.innerHTML = t(el.dataset.i18nHtml);
  for (const b of document.querySelectorAll('[data-lang]'))
    b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
  ui.mute.textContent = sound.muted ? t('soundOff') : t('soundOn');
  $('keyHint').textContent = isTouch ? t('hintTouch') : t('hintDesktop');
  const best = bestScore();
  ui.best.textContent = best ? t('best', { n: fmt(best) }) : '';
  if (lastResult) renderResult(lastResult, false);
}

/* ============================================================
   Game state
   ============================================================ */

const sim = new Sim();
const STEP = 1 / 120;
let mode = 'menu'; // menu | run | result
let pressed = false;
let pulse = false; // a tap shorter than one step still counts
let acc = 0;
let timeScale = 1;
let slowTarget = 1;
let resultDelay = -1;
let lastResult = null;
let thrusterTime = 0;
let shake = 0;
let elapsed = 0;
let landCam = 0;

function resetWorld() {
  sim.reset();
  clearSkids();
  smoke.clear();
  vapor.clear();
  skidLastX = 0;
  thrusterTime = 0;
  timeScale = 1;
  slowTarget = 1;
  acc = 0;
  placeCar(0);
}

function startRun() {
  sound.unlock();
  sound.ui();
  resetWorld();
  sim.start();
  mode = 'run';
  camMode = 'chase';
  show(ui.menu, false);
  show(ui.result, false);
  show(ui.hud, true);
  show(ui.flipBadge, false);
  ui.distanceChip.classList.remove('near', 'cleared');
  lastResult = null;
  resultDelay = -1;
  showCountdown(null);
}

function toMenu() {
  mode = 'menu';
  resetWorld();
  camMode = 'showcase';
  show(ui.hud, false);
  show(ui.result, false);
  show(ui.menu, true);
  applyLang();
  $('startBtn').focus({ preventScroll: true });
}

function handle(events) {
  for (const e of events) {
    switch (e.type) {
      case 'countdown':
        showCountdown(String(e.value));
        sound.beep(false);
        break;
      case 'go':
        showCountdown('GO');
        sound.beep(true);
        setTimeout(() => showCountdown(null), 650);
        break;
      case 'jetStart':
        sound.ignite();
        vibrate(25);
        shake = Math.max(shake, 0.15);
        break;
      case 'tooEarly':
        toast(t('tooEarly'), 'alert', 1200);
        sound.warn();
        break;
      case 'brakeStart':
        camMode = 'brake';
        toast(t('brakeStart', { v: e.v0Kmh.toFixed(1) }));
        sound.click();
        vibrate(18);
        break;
      case 'flip':
        camMode = 'air';
        slowTarget = reduceMotion ? 1 : 0.38;
        thrusterTime = 0.55;
        toast(t('flip', { n: e.count }), 'air', 1600);
        ui.flipCount.textContent = `×${e.count}`;
        show(ui.flipBadge, true);
        sound.thrust();
        vibrate([30, 30, 60]);
        liftBurst();
        break;
      case 'leap':
        camMode = 'air';
        slowTarget = reduceMotion ? 1 : 0.32;
        thrusterTime = 0.7;
        toast(t('leap'), 'air', 1800);
        sound.thrust();
        vibrate([40, 30, 80]);
        liftBurst();
        break;
      case 'land':
        slowTarget = reduceMotion ? 1 : 0.55;
        // swing in front of the car and look back at the touchdown cloud
        camMode = 'landed';
        landCam = 1.1;
        shake = Math.max(shake, 0.35);
        toast(e.kind === 'leap' ? t('landLeap') : t('land'), 'air', 1400);
        sound.land();
        vibrate(40);
        landingCloud();
        break;
      case 'stopped':
        if (camMode !== 'landed') camMode = 'finish';
        finishOrbit = 0;
        toast(t('stopped'), '', 1500);
        sound.success();
        vibrate([20, 40, 20]);
        lastResult = e.result;
        resultDelay = 1.7;
        break;
      default:
        break;
    }
  }
}

function vibrate(p) {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(p);
    } catch {
      /* not allowed here */
    }
  }
}

/* ---------- result ---------- */

function renderResult(r, record = true) {
  const title = $('resultTitle');
  if (r.leapt) {
    title.textContent = t('resLeap');
    title.className = 'air';
    $('resultSub').textContent = t('subLeap');
  } else {
    title.textContent = t('resClean');
    title.className = 'ok';
    const gap = Math.max(0, r.gap).toFixed(1);
    $('resultSub').textContent = r.flips
      ? t('subFlips', { n: r.flips, gap })
      : t('subClean', { gap });
  }
  $('statV0').textContent = `${r.v0Kmh.toFixed(1)} km/h`;
  $('statTime').textContent = `${r.stopSeconds.toFixed(3)} s`;
  $('statDist').textContent = `${r.stopDistance.toFixed(1)} m`;
  $('statForce').textContent = `${Math.round(r.peakForce)} N`;
  $('statFlips').textContent = `${r.flips}`;
  $('statGapLabel').textContent = r.leapt ? t('statOver') : t('statGap');
  $('statGap').textContent = r.leapt
    ? `+${(-r.gap).toFixed(1)} m`
    : `${Math.max(0, r.gap).toFixed(1)} m`;
  $('statScore').textContent = fmt(r.score);
  const bestEl = $('resultBest');
  if (record) {
    const prev = bestScore();
    r.isBest = r.score > prev;
    if (r.isBest) store.set('best', r.score);
  }
  bestEl.textContent = r.isBest ? t('newBest') : t('best', { n: fmt(bestScore()) });
  bestEl.classList.toggle('new', Boolean(r.isBest));
  requestAnimationFrame(() => drawChart(r));
}

function showResult(r) {
  mode = 'result';
  show(ui.hud, false);
  show(ui.result, true);
  renderResult(r, true);
  $('retryBtn').focus({ preventScroll: true });
}

function drawChart(r) {
  const cv = $('chart');
  const ctx = cv.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const W = cv.clientWidth;
  const H = cv.clientHeight;
  if (!W || !H) return;
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, W, H);
  const s = r.samples;
  if (s.length < 2) return;
  const pad = { l: 32, r: 38, t: 8, b: 18 };
  const w = W - pad.l - pad.r;
  const h = H - pad.t - pad.b;
  const tMax = Math.max(0.5, s[s.length - 1].t);
  const vMax = Math.max(100, Math.ceil(Math.max(...s.map((p) => p.speedKmh)) / 100) * 100);
  const fMax = 1800;
  const X = (tt) => pad.l + (tt / tMax) * w;
  const Yv = (v) => pad.t + h - (v / vMax) * h;
  const Yf = (f) => pad.t + h - (f / fMax) * h;
  ctx.font = '10px -apple-system, "PingFang SC", sans-serif';

  // airborne spans
  ctx.fillStyle = 'rgba(159,227,255,0.16)';
  let start = null;
  s.forEach((p, i) => {
    if (p.air && start === null) start = p.t;
    if ((!p.air || i === s.length - 1) && start !== null) {
      ctx.fillRect(X(start), pad.t, Math.max(2, X(p.t) - X(start)), h);
      start = null;
    }
  });

  // grid and axes
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.fillStyle = 'rgba(244,239,232,0.55)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const vStep = vMax > 300 ? 100 : 50;
  for (let v = 0; v <= vMax; v += vStep) {
    ctx.beginPath();
    ctx.moveTo(pad.l, Yv(v));
    ctx.lineTo(pad.l + w, Yv(v));
    ctx.stroke();
    ctx.fillText(String(v), pad.l - 5, Yv(v));
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const tStep = tMax > 60 ? 20 : tMax > 20 ? 5 : tMax > 6 ? 2 : 1;
  for (let tt = 0; tt <= tMax + 1e-6; tt += tStep) ctx.fillText(`${tt}s`, X(tt), pad.t + h + 4);

  // the 1612 N line
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = 'rgba(255,90,60,0.85)';
  ctx.beginPath();
  ctx.moveTo(pad.l, Yf(1612));
  ctx.lineTo(pad.l + w, Yf(1612));
  ctx.stroke();
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ff5a3c';
  ctx.fillText('1612', pad.l + w + 5, Yf(1612));
  ctx.fillStyle = 'rgba(232,199,126,0.7)';
  ctx.fillText('0 N', pad.l + w + 5, Yf(0));

  const line = (Y, color, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    s.forEach((p, i) => (i ? ctx.lineTo(X(p.t), Y(p)) : ctx.moveTo(X(p.t), Y(p))));
    ctx.stroke();
  };
  line((p) => Yf(p.force), '#e8c77e', 1.8);
  line((p) => Yv(p.speedKmh), '#f4efe8', 2.2);
  const last = s[s.length - 1];
  ctx.fillStyle = '#6fe3a8';
  ctx.beginPath();
  ctx.arc(X(last.t), Yv(0), 3.5, 0, Math.PI * 2);
  ctx.fill();
}

/* ---------- donation dialog ---------- */

for (const b of document.querySelectorAll('[data-open-donate]')) {
  b.addEventListener('click', () => {
    sound.ui();
    show(ui.donate, true);
    $('donateClose').focus({ preventScroll: true });
  });
}
$('donateClose').addEventListener('click', () => show(ui.donate, false));
ui.donate.addEventListener('pointerdown', (e) => {
  if (e.target === ui.donate) show(ui.donate, false);
});

/* ---------- buttons ---------- */

$('startBtn').addEventListener('click', startRun);
$('retryBtn').addEventListener('click', startRun);
$('menuBtn').addEventListener('click', () => {
  sound.ui();
  toMenu();
});
ui.mute.addEventListener('click', () => {
  sound.unlock();
  sound.setMuted(!sound.muted);
  applyLang();
});
for (const b of document.querySelectorAll('[data-lang]')) {
  b.addEventListener('click', () => {
    lang = b.dataset.lang;
    store.set('lang', lang);
    applyLang();
  });
}
for (const el of [ui.menu, ui.result, ui.donate]) {
  el.addEventListener('pointerdown', (e) => e.stopPropagation());
}

/* ---------- brake input ---------- */

function setPressed(on) {
  if (pressed === on) return;
  pressed = on;
  if (on) pulse = true;
}

let jetHeld = false;
let jetPointer = null;
function setJet(on) {
  if (jetHeld === on) return;
  jetHeld = on;
  if (on) sound.unlock();
}
ui.jetBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  jetPointer = e.pointerId;
  setJet(true);
});
window.addEventListener('pointerup', (e) => {
  if (e.pointerId === jetPointer) {
    jetPointer = null;
    setJet(false);
  }
});
window.addEventListener('pointercancel', () => setJet(false));
window.addEventListener('blur', () => setJet(false));
const JET_KEYS = new Set(['ShiftLeft', 'ShiftRight', 'ArrowUp', 'KeyW', 'KeyJ']);

const canBrakeNow = () =>
  mode === 'run' && (sim.phase === 'accelerating' || sim.phase === 'braking');

ui.brakeBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  sound.unlock();
  setPressed(true);
});
app.addEventListener('pointerdown', (e) => {
  if (!canBrakeNow()) return;
  e.preventDefault();
  setPressed(true);
});
for (const ev of ['pointerup', 'pointercancel', 'blur'])
  window.addEventListener(ev, (e) => {
    if (e.pointerId !== undefined && e.pointerId === jetPointer) return;
    setPressed(false);
  });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    setPressed(false);
    setJet(false);
  }
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && !ui.donate.classList.contains('hidden')) {
    show(ui.donate, false);
    return;
  }
  if (JET_KEYS.has(e.code)) {
    if (mode === 'run') {
      e.preventDefault();
      setJet(true);
    }
    return;
  }
  if (e.code !== 'Space') return;
  if (e.target instanceof HTMLButtonElement && mode !== 'run') return; // let the button click
  e.preventDefault();
  if (mode === 'menu' || mode === 'result') {
    if (!e.repeat && ui.donate.classList.contains('hidden')) startRun();
    return;
  }
  setPressed(true);
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') setPressed(false);
  if (JET_KEYS.has(e.code)) setJet(false);
});
window.addEventListener('contextmenu', (e) => e.preventDefault());

/* ============================================================
   Per-frame visuals
   ============================================================ */

const CAR_HALF = SPEC.car.length / 2;
let camMode = 'showcase';
let orbit = 0.9;
let finishOrbit = 0;
const camOffset = new THREE.Vector3(6, 2, 7);
const camLook = new THREE.Vector3(0, 0.6, 0);
let fov = 50;
const tmpV = new THREE.Vector3();
const tmpL = new THREE.Vector3();
const carPos = new THREE.Vector3();

function placeCar(dx) {
  const zc = toZ(sim.x - CAR_HALF);
  car.root.position.set(sim.side, sim.z, zc);
  carPos.set(sim.side, sim.z + 0.55, zc);
  for (const w of car.wheels) w.rotation.x -= dx / 0.36;
}

const tmpA = new THREE.Vector3();
const tmpC = new THREE.Color();
let liftFiring = false;

/** White cold-gas jet out of one nozzle (0–3 rear, 4–7 corners). */
function vaporJet(index, count, speed, size, alpha = 0.6) {
  const m = car.model.matrixWorld;
  const n = car.nozzles[index];
  const p = tmpA.copy(n.pos).applyMatrix4(m);
  const d = tmpV.copy(n.dir).normalize().transformDirection(m);
  for (let i = 0; i < count; i++) {
    const sp = speed * (0.7 + Math.random() * 0.6);
    vapor.emit(
      p,
      tmpL.set(
        d.x * sp + (Math.random() - 0.5) * 2,
        d.y * sp + (Math.random() - 0.5) * 2,
        d.z * sp - sim.v * 0.93 + (Math.random() - 0.5) * 2,
      ),
      size * (0.7 + Math.random() * 0.6),
      1.3 + Math.random() * 1.6,
      alpha,
      WHITE,
      1,
    );
  }
}

/** Gas hitting the road under the car and rolling outwards. */
function groundBlast(count) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.5 + Math.random() * 1.6;
    const out = 3 + Math.random() * 7;
    smoke.emit(
      tmpA.set(
        carPos.x + Math.cos(a) * r,
        0.25 + Math.random() * 0.6,
        carPos.z + Math.sin(a) * r * 1.6,
      ),
      tmpL.set(Math.cos(a) * out, 0.6 + Math.random() * 2.2, Math.sin(a) * out - sim.v * 0.85),
      1.4 + Math.random() * 1.4,
      2.4 + Math.random() * 1.8,
      0.42,
      tmpC.copy(WHITE).lerp(WARM, Math.random() * 0.6),
      1.3,
    );
  }
}

/** The big touchdown cloud, lit pink from below by the tail lights. */
function landingCloud() {
  const n = isSmall ? 90 : 150;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 2.4;
    const y = 0.2 + Math.random() * 2.6;
    const low = y < 1.3;
    const out = 1.5 + Math.random() * 6;
    smoke.emit(
      tmpA.set(carPos.x + Math.cos(a) * r, y, carPos.z + Math.sin(a) * r * 1.4),
      tmpL.set(Math.cos(a) * out, 1 + Math.random() * 5, Math.sin(a) * out - sim.v * 0.9),
      2 + Math.random() * 2.6,
      3.2 + Math.random() * 3,
      low ? 0.55 : 0.45,
      tmpC.copy(WHITE).lerp(PINK, low ? 0.35 + Math.random() * 0.45 : Math.random() * 0.15),
      1.6,
    );
  }
}

function liftBurst() {
  for (let k = 4; k < 8; k++) vaporJet(k, 10, 18, 0.7, 0.7);
  groundBlast(isSmall ? 24 : 40);
}

function afterStep(dt) {
  // skid marks and tyre smoke under hard braking
  if (!sim.airborne && sim.force > 900 && sim.v > 1.5) {
    if (sim.x - skidLastX > 0.5) {
      skidLastX = sim.x;
      const rz = toZ(sim.x - CAR_HALF - 1.45);
      addSkid(-0.88, rz);
      addSkid(0.88, rz);
    }
  } else {
    skidLastX = sim.x;
  }
  // burnout smoke from the rear tyres: hard braking, and the self-stop after a leap
  const heavy = sim.auto ? 0.7 : (sim.force - 800) / 812;
  if (!sim.airborne && sim.powerCut && heavy > 0 && sim.v > 4) {
    for (const side of [-1, 1]) {
      if (Math.random() > 0.35 + heavy * 0.6) continue;
      smoke.emit(
        tmpA.set(carPos.x + side * 0.95, 0.3, carPos.z + 1.5),
        tmpL.set(side * Math.random() * 1.6, 0.4 + Math.random() * 1.1, -sim.v * 0.18),
        0.9 + Math.random() * 0.9,
        2.2 + Math.random() * 1.8,
        0.3 * Math.min(1, heavy + 0.25),
        tmpC.copy(WHITE).lerp(PINK, Math.random() * 0.3),
        1.1,
      );
    }
  }
  // corner thrusters in the air: firing hard on take-off and touchdown,
  // pulsing in between to drive the roll; the vapour corkscrews as the car turns
  liftFiring = false;
  if (sim.air) {
    const s = sim.air.t / sim.air.T;
    liftFiring = s < 0.36 || s > 0.74 || Math.sin(sim.air.t * 21) > 0.4;
    if (liftFiring) {
      for (let k = 4; k < 8; k++) if (Math.random() < 0.8) vaporJet(k, 2, 18, 0.8, 0.75);
      if (sim.air.kind === 'leap' && s < 0.5) vaporJet((Math.random() * 4) | 0, 1, 12, 0.45);
      if (sim.z < 4.5 && Math.random() < 0.7) groundBlast(2);
      thrusterTime = 0.05;
    }
  }
  if (thrusterTime > 0) thrusterTime -= dt;
  // rear jets leave a thin vapour trail behind the plumes
  if (sim.jet > 0.05 && Math.random() < sim.jet * 0.7) {
    vaporJet((Math.random() * 4) | 0, 1, 22, 0.32, 0.28 * sim.jet);
  }
}

function updateCamera(dt) {
  const v = sim.v;
  const sf = Math.min(1, v / 110);
  let off;
  let look;
  let f;
  let k = 3.5;
  switch (camMode) {
    case 'showcase':
      orbit += dt * 0.14;
      off = tmpV.set(
        Math.sin(orbit) * 8.4,
        1.9 + Math.sin(orbit * 0.7) * 0.4,
        Math.cos(orbit) * 8.4,
      );
      look = tmpL.set(0, 0.05, 0);
      f = window.innerWidth < window.innerHeight ? 62 : 44;
      k = 2;
      break;
    case 'chase':
      off = tmpV.set(
        0.55 - sf * 0.3 + sim.jet * 0.9,
        1.85 - sf * 0.35 + sim.jet * 0.7,
        7.2 - sf * 1.3 + sim.jet * 1.6,
      );
      look = tmpL.set(0, 0.15, -9);
      f = 52 + sf * 20 + sim.jet * 9;
      break;
    case 'brake':
      off = tmpV.set(2.1, 1.25, 6.6 - sf);
      look = tmpL.set(0.2, 0.05, -4);
      f = 50 + sf * 14;
      break;
    case 'air':
      off = tmpV.set(sim.air && sim.air.kind === 'leap' ? 11 : 8.5, 1.1 + sim.z * 0.35, 1.6);
      look = tmpL.set(0, 0.1, -1.2);
      f = 46;
      k = 4.5;
      break;
    case 'landed':
      landCam -= dt;
      if (landCam <= 0) {
        camMode = sim.phase === 'stopped' ? 'finish' : 'brake';
        slowTarget = 1;
      }
      off = tmpV.set(4.2, 1.7, -10.5);
      look = tmpL.set(0, 0.4, 6);
      f = 54;
      k = 5;
      break;
    case 'finish':
      finishOrbit += dt * 0.32;
      off = tmpV.set(Math.sin(finishOrbit + 0.6) * 7.4, 1.6, Math.cos(finishOrbit + 0.6) * 7.4);
      look = tmpL.set(0, 0, 0);
      f = window.innerWidth < window.innerHeight ? 60 : 46;
      k = 2.2;
      break;
    default:
      return;
  }
  if (window.innerWidth < window.innerHeight && camMode !== 'showcase' && camMode !== 'finish') {
    // portrait screens are narrow: step back so the whole car stays in frame
    if (camMode === 'air') {
      off.x *= 1.8;
      off.y += 0.8;
      f += 8;
    } else {
      off.z += 2.2;
      off.y += 0.5;
      f += 10;
    }
  }
  const a = 1 - Math.exp(-k * dt);
  camOffset.lerp(off, a);
  camLook.lerp(look, a);
  fov += (f - fov) * a;
  // offsets are relative to the car, so the camera never lags behind at 370 km/h
  camera.position.copy(carPos).add(camOffset);
  if (camera.position.y < 0.35) camera.position.y = 0.35;
  const target = tmpV.copy(carPos).add(camLook);
  if (shake > 0 && !reduceMotion) {
    camera.position.x += (Math.random() - 0.5) * shake * 0.3;
    camera.position.y += (Math.random() - 0.5) * shake * 0.3;
    shake = Math.max(0, shake - dt * 1.6);
  }
  if (mode === 'run' && sim.v > 60 && !reduceMotion && !sim.airborne) {
    const buzz = 0.012 * sf + 0.03 * sim.jet;
    camera.position.x += (Math.random() - 0.5) * buzz;
    camera.position.y += (Math.random() - 0.5) * buzz;
  }
  camera.lookAt(target);
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
}

function updateCar(dt, simDt) {
  // body pitch from acceleration, and the flip / leap rotations
  const pitchTarget = sim.airborne ? 0 : THREE.MathUtils.clamp(sim.accel * 0.0028, -0.055, 0.03);
  car.pivot.userData.pitch = THREE.MathUtils.lerp(
    car.pivot.userData.pitch || 0,
    pitchTarget,
    1 - Math.exp(-dt * 6),
  );
  car.pivot.rotation.set(sim.pitch + car.pivot.userData.pitch, 0, sim.roll);

  // wing deploys as an airbrake, a little more in the air
  const wingTarget = sim.airborne ? 0.35 : (sim.force / SPEC.brake.breakForceN) * 0.95;
  car.wingPivot.rotation.x += (wingTarget - car.wingPivot.rotation.x) * Math.min(1, dt * 8);

  const braking = sim.powerCut && (sim.force > 5 || sim.auto);
  car.tailMat.emissiveIntensity +=
    ((braking ? 9 : 2.2) - car.tailMat.emissiveIntensity) * Math.min(1, dt * 12);
  car.nozzleMat.emissiveIntensity =
    thrusterTime > 0 || sim.jet > 0.05
      ? 4 + Math.random() * 3 + sim.jet * 4
      : Math.max(0, car.nozzleMat.emissiveIntensity - dt * 20);

  // four rear plumes with shock diamonds while the jets are lit
  plumeTime.value = elapsed;
  const jp = sim.jet;
  car.plumes.forEach((p, i) => {
    const pw = jp * (0.88 + 0.12 * Math.sin(elapsed * 53 + i * 1.7));
    p.visible = pw > 0.01;
    p.material.uniforms.uPower.value = pw;
    p.scale.set(1 + jp * 0.15, 0.35 + 0.8 * jp + 0.06 * Math.sin(elapsed * 41 + i), 1 + jp * 0.15);
  });
  car.jetLight.intensity = jp * 28;

  // contact shadow stays on the road and fades with height
  car.blob.position.set(sim.side, 0.012, car.root.position.z);
  const h = Math.min(1, sim.z / 4);
  car.blob.material.opacity = 1 - h * 0.85;
  car.blob.scale.setScalar(1 + h * 0.5);

  smoke.update(simDt, { gravity: -0.5, drag: 0.7, growth: 1.6 });
  vapor.update(simDt, { gravity: -0.25, drag: 1.4, growth: 2.2 });
}

function updateWorld() {
  // sky, mountains and the sun ride with the camera; ground snaps to its texture grid
  sky.position.copy(camera.position);
  horizonGroup.position.set(camera.position.x, 0, camera.position.z);
  ground.position.x = Math.round(camera.position.x / GROUND_TILE) * GROUND_TILE;
  ground.position.z = Math.round(camera.position.z / GROUND_TILE) * GROUND_TILE;
  sun.position.set(carPos.x - 22, carPos.y + 34, carPos.z - 70);
  sun.target.position.copy(carPos);
  const blink = Math.sin(elapsed * 7) > 0 ? 1 : 0.15;
  barrierLamp.emissiveIntensity = 0.5 + blink * 5;
  barrierGlow.material.opacity = 0.25 + blink * 0.75;
}

function updateHud() {
  if (mode !== 'run') return;
  ui.speed.textContent = String(Math.round(sim.speedKmh));
  ui.mph.textContent = `${Math.round(sim.v / 0.44704)} mph`;
  const jetLive = sim.phase === 'accelerating';
  // the ring shows how close the jets have pushed you to 383 mph
  ui.jetBtn.style.setProperty('--gas', Math.min(1, sim.speedKmh / SPEC.car.topSpeedKmh).toFixed(3));
  ui.jetBtn.disabled = !jetLive;
  ui.jetBtn.classList.toggle('ready', jetLive);
  ui.jetBtn.classList.toggle('firing', sim.jetting);
  ui.jetGas.textContent = sim.jetting ? `${sim.jetTime.toFixed(1)}s` : '∞';
  const n = Math.min(1, sim.speedKmh / SPEEDO_MAX);
  ui.arc.style.strokeDashoffset = `${arcLen * (1 - n)}`;
  ui.arc.classList.toggle('ready', sim.speedKmh >= SPEC.brake.minSpeedKmh);
  ui.timer.textContent = `${sim.brakeElapsed.toFixed(3)}s`;
  const d = sim.distanceToBarrier;
  if (sim.leapt || (sim.air && sim.air.kind === 'leap' && d < 0)) {
    ui.distanceLabel.textContent = t('cleared');
    ui.distance.textContent = `+${Math.max(0, Math.round(-d))}m`;
    ui.distanceChip.classList.add('cleared');
    ui.distanceChip.classList.remove('near');
  } else {
    ui.distanceLabel.textContent = t('toBarrier');
    ui.distance.textContent = `${Math.max(0, Math.round(d))}m`;
    ui.distanceChip.classList.toggle('near', d < 300);
  }
  const f = sim.force / SPEC.brake.breakForceN;
  ui.forceFill.style.height = `calc(${Math.min(1, f) * 94}% - 2px)`;
  ui.forceValue.textContent = `${Math.round(sim.force)} N`;
  ui.force.classList.toggle('danger', f > 0.86);
  const live = sim.canBrake || sim.phase === 'braking';
  ui.brakeBtn.disabled = !live || sim.auto;
  ui.brakeBtn.classList.toggle('ready', live && !sim.auto);
  ui.brakeBtn.classList.toggle('pressed', pressed && live && !sim.auto);
  ui.brakeText.textContent = sim.airborne
    ? t('brakeAir')
    : sim.auto
      ? t('brakeAuto')
      : sim.phase === 'braking'
        ? t('brakeHold')
        : sim.canBrake
          ? t('brakeReady')
          : t('brake');
}

/* ============================================================
   Post-processing and the loop
   ============================================================ */

let composer = null;
if (Q.bloom) {
  composer = new EffectComposer(renderer);
  composer.setPixelRatio(Q.pixelRatio);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(
    new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.55, 0.5, 0.86),
  );
  composer.addPass(new OutputPass());
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  if (composer) composer.setSize(w, h);
  smoke.resize();
  vapor.resize();
  if (lastResult && mode === 'result') drawChart(lastResult);
}
window.addEventListener('resize', resize);
window.visualViewport?.addEventListener('resize', resize);

let last = performance.now();
let maxDt = 0.05;
const api = { policy: null, jetPolicy: null };

function frame(now) {
  const dt = Math.min(maxDt, (now - last) / 1000);
  last = now;
  elapsed += dt;

  timeScale += (slowTarget - timeScale) * Math.min(1, dt * 7);
  // ease back to normal speed for the last part of a jump
  if (sim.air && sim.air.t / sim.air.T > 0.72) slowTarget = 1;
  const simDt = dt * timeScale;

  if (mode === 'run' || (mode === 'result' && sim.phase !== 'stopped')) {
    acc += simDt;
    let guard = 0;
    while (acc >= STEP && guard++ < 400) {
      acc -= STEP;
      const prevX = sim.x;
      const input = api.policy ? api.policy(sim) : pressed || pulse;
      const jetIn = api.jetPolicy ? api.jetPolicy(sim) : jetHeld;
      const events = sim.step(STEP, input, jetIn);
      pulse = false;
      placeCar(sim.x - prevX);
      handle(events);
      afterStep(STEP);
    }
  }
  if (resultDelay > 0) {
    resultDelay -= dt;
    if (resultDelay <= 0 && lastResult && mode === 'run') showResult(lastResult);
  }

  placeCar(0);
  updateCar(dt, simDt);
  updateCamera(dt);
  updateWorld();
  updateHud();
  sound.update({
    v: sim.v,
    powered: sim.phase === 'accelerating',
    force: sim.force,
    active: mode === 'run' && sim.phase !== 'countdown' && sim.phase !== 'stopped',
    airborne: sim.airborne,
    jet: sim.jet,
    lift: liftFiring,
  });

  if (composer) composer.render();
  else renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/* ---------- boot ---------- */

applyLang();
resetWorld();
camMode = 'showcase';
updateCamera(1);
renderer.compile(scene, camera);
requestAnimationFrame((now) => {
  last = now;
  frame(now);
  $('loading').classList.add('done');
  show(ui.menu, true);
  $('startBtn').focus({ preventScroll: true });
});

// handy for debugging from the console
// Console and test hooks: a scripted driver (`policy`) and a coarser frame step.
api.sim = sim;
api.startRun = startRun;
api.setMaxDt = (v) => {
  maxDt = v;
};
window.__brake = api;
