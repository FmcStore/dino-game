/* ================= DINO QUEST — 2D pixel-art auto-run platformer =================
   Sesuai referensi: T-Rex hijau lari ke kanan, koin emas, pohon, gunung,
   papan tanda panah, awan pixel, langit biru. Canvas 2D, tanpa three.js.
   Kontrol: ▲/swipe atas/tap = lompat · ▼/swipe bawah = nunduk · prinsnip adil. */
const $ = (id) => document.getElementById(id);
const ui = {
  score: $('score'), coins: $('coins'), hearts: $('hearts'),
  menu: $('menu'), over: $('over'), paused: $('paused'),
  btnPlay: $('btnPlay'), btnRetry: $('btnRetry'), btnResume: $('btnResume'),
  btnPause: $('btnPause'), btnMute: $('btnMute'),
  finalScore: $('finalScore'), finalCoins: $('finalCoins'), bestScore: $('bestScore'),
  loadInfo: $('loadInfo'), magnetTag: $('magnetTag'),
};

/* ================= AUDIO (synth chiptune mini) ================= */
let AC = null, muted = false;
function beep(freq = 660, dur = 0.09, type = 'square', vol = 0.1, slide = 0) {
  if (muted) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), AC.currentTime + dur);
    g.gain.setValueAtTime(vol, AC.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, AC.currentTime + dur);
    o.connect(g); g.connect(AC.destination);
    o.start(); o.stop(AC.currentTime + dur);
  } catch { /* abaikan */ }
}
const sfx = {
  coin: () => { beep(988, 0.07, 'square', 0.08); setTimeout(() => beep(1319, 0.12, 'square', 0.08), 60); },
  jump: () => beep(280, 0.2, 'square', 0.08, 480),
  hit: () => beep(150, 0.3, 'sawtooth', 0.16, -90),
  magnet: () => { beep(520, 0.1, 'sine', 0.1, 400); setTimeout(() => beep(780, 0.12, 'sine', 0.1, 400), 100); },
  over: () => { beep(392, 0.2, 'square', 0.12, -200); setTimeout(() => beep(196, 0.45, 'square', 0.12, -100), 200); },
};

/* ================= CANVAS / SKALA PIXEL ================= */
const cv = $('game'), ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
const H = 270;                 // tinggi virtual tetap (baris pixel)
let W = 320;                   // lebar virtual mengikuti aspek layar
const GY = H - 46;             // garis tanah (atas rumput)
const S2 = 2;                  // skala sprite (1px art = 2px virtual)

/* RNG seeded buat background */
function mulberry(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ================= SPRITE DARI PETA STRING ================= */
const PAL = {
  K: '#0F0F0F', G: '#5FB53A', g: '#3E9E2F', C: '#E8D48B', W: '#FFFFFF',
  B: '#7A4A2B', Y: '#FFC93C', O: '#E89C1A', R: '#9A9A9A', r: '#5A5A5A',
  T: '#7A4A26', L: '#3E9E2F', l: '#5AC14A', d: '#2E7D22',
  N: '#E8821A', n: '#B25A10', M: '#E8402E', m: '#A02018',
};
function spr(rows) {
  const h = rows.length, w = Math.max(...rows.map((r) => r.length));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.' || ch === ' ' || !PAL[ch]) return;
    g.fillStyle = PAL[ch]; g.fillRect(x, y, 1, 1);
  }));
  return c;
}

/* ---- T-Rex hijau (menghadap kanan). 2 frame lari + 1 nunduk ---- */
const DINO_A = spr([
  '..............KKKKKK....',
  '.............KGGGGGGK...',
  '............KGGGGGGGGK..',
  '............KGWWWKGGGGK.',
  '............KGWWKKGGGGGGK',
  '............KGGGGGGGGGGK',
  '............KGGGGKKKKK..',
  '..K.........KGGGKWWK....',
  '...KK.......KGGGKCK.....',
  '....KKKKKKKGGGGKCK......',
  '.....KGGGGGGGGGK........',
  '......KGGGGGgGK.........',
  '.......KGGK..KGGK.......',
  '.......KGK....KGK.......',
  '......KGK.....KGK.......',
  '......KKKK....KKKK......',
]);
const DINO_B = spr([
  '..............KKKKKK....',
  '.............KGGGGGGK...',
  '............KGGGGGGGGK..',
  '............KGWWWKGGGGK.',
  '............KGWWKKGGGGGGK',
  '............KGGGGGGGGGGK',
  '............KGGGGKKKKK..',
  '..K.........KGGGKWWK....',
  '...KK.......KGGGKCK.....',
  '....KKKKKKKGGGGKCK......',
  '.....KGGGGGGGGGK........',
  '......KGGGGGgGK.........',
  '.......KGGK...KGGK......',
  '........KGK....KGK......',
  '........KGK.....KGK.....',
  '........KKKK....KKKK....',
]);
const DINO_DUCK = spr([
  '........................KKKKK.....',
  '.......................KGGGGGGK...',
  '......................KGWWKGGGGK..',
  '......................KGGGGGGGGGK.',
  '......................KGGGGKKKK...',
  '....KKK...............KGGKWWK.....',
  '..KKGGGGKKKKKKKKKKKKKKGGKCCK......',
  '.KGGGGGGGGGGGGGGGGGGGGKCCK........',
  '.KgggggggggggggggggggGGK..........',
  '..KKK....KKK....KKK..KK...........',
]);
/* ---- Pterodactyl oranye (2 frame kepak, harus nunduk) ---- */
const PTERO_UP = spr([
  '..KK..........KK....',
  '.KMMK........KMMK...',
  '.KMMMK......KMMMK...',
  '..KMMMK....KMMMK....',
  '...KMMMK..KMMMK.....',
  '....KMMMMMMMMK......',
  '......KMMMMMMK......',
  '....KKMMMMMMMKKK....',
  '...KMMMWWKMKK.......',
  '....KMMMMMMK........',
  '.....KCCCCK.........',
  '......KKK...........',
]);
const PTERO_DN = spr([
  '......KMMMMMMK......',
  '....KKMMMMMMMKKK....',
  '...KMMMWWKMKK.......',
  '....KMMMMMMK.KK.....',
  '.....KCCCCK.KMMK....',
  '..KK.......KMMMK....',
  '.KMMK......KMMMK....',
  '.KMMMK......KMMK....',
  '..KK..........KK....',
]);
/* ---- Koin emas (2 frame putaran) ---- */
const COIN_A = spr([
  '...KKKK...',
  '..KYYYYK..',
  '.KYWYYYYK.',
  'KYWWYYYYYK',
  'KYWWYYYYYK',
  'KYWYYYYYYK',
  '.KYYYYYYK.',
  '.KYYYYYYK.',
  '..KYYYYK..',
  '...KKKK...',
]);
const COIN_B = spr([
  '..KK..',
  '.KYYK.',
  'KYWWYK',
  'KYWWYK',
  'KYWWYK',
  'KYWWYK',
  '.KYYK.',
  '..KK..',
]);
/* ---- Rintangan MERAH biar jelas: batu lava + duri merah ---- */
const ROCK = spr([
  '.....KK.......',
  '....KMMK......',
  '...KMMMMK.....',
  '..KMMmmMMK....',
  '.KMMmmmmMMK...',
  '.KMmMMMMmMK...',
  'KMMMMMMMMMMK..',
  'KMmMMMMMMmMK..',
  'KMMMMMMMMMMMK.',
  'KmMMMMMMMMmMK.',
  'KMMMMMMMMMMMK.',
  'KKKKKKKKKKKKK.',
]);
const BONES = spr([
  '..K...K...K...K...K...',
  '.KMK.KMK.KMK.KMK.KMK..',
  '.KMK.KMK.KMK.KMK.KMK..',
  '.KMMMKMMMKMMMKMMMKMMMK.',
  '.KMMMKMMMKMMMKMMMKMMMK.',
  '.KmMMKmMMKmMMKmMMKmMMK.',
  'KMMMMMMMMMMMMMMMMMMMMK',
  'KKKKKKKKKKKKKKKKKKKKKK',
]);
/* ---- Dekor: pohon, semak, batu kecil, papan tanda ---- */
const TREE = spr([
  '......KKKK..........',
  '....KKllllKK........',
  '...KlllLLLLlK.......',
  '..KllLLLLLLLLK......',
  '..KlLLddLLLLlK......',
  '.KllLLddLLLLLlK.....',
  '.KlLLLddLLLLLlK.....',
  'KllLLLddLLLLLLlK....',
  'KlLLLLddLLLLLLlK....',
  'KllLLLddLLLLLLlK....',
  '.KllLLLddLLLLlK.....',
  '.KlLLLLddLLLLlK.....',
  '..KllLLddLLLlK......',
  '...KlllLLLLlK.......',
  '....KKllllKK........',
  '......KKKK..........',
  '.......KTTK.........',
  '.......KTTK.........',
  '.......KTTK.........',
  '.......KTTK.........',
  '......KRRK..........',
]);
const BUSH = spr([
  '....KKKKKK......',
  '..KKllllllKK....',
  '.KllLLLLllllK...',
  'KllLLddLLlllK...',
  'KlLLLddLLLLlK...',
  'KKKKKKKKKKKKK...',
]);
const STONE_D = spr([
  '...KKKK.....',
  '..KRRRRK....',
  '.KRrrrrRK...',
  'KRRRRRRRRK..',
  'KKKKKKKKKK..',
]);
const SIGN = spr([
  '..KKK..............',
  '..KTTK.............',
  '..KTTK.............',
  '..KTTK.............',
  'KKTTTTTTTTTTTTKK...',
  'KTBBBBBBBBBBBBTK...',
  'KTBWWBBBBBWWBTK....',
  'KTBWWWBBWWWWBTK....',
  'KTBWWBBBBBWWBTK....',
  'KTBBBBBBBBBBBBTK...',
  'KKTTTTTTTTTTTTKK...',
  '..KTTK.............',
  '..KKK..............',
]);
/* ---- Magnet (powerup) ---- */
const MAGNET = spr([
  '...KK..KK...',
  '..KMMKKMMK..',
  '..KMK..KMK..',
  '..KMK..KMK..',
  '..KMK..KMK..',
  '..KMK..KMK..',
  '..KMK..KMK..',
  '..KMMKKMMK..',
  '...KMMMMK...',
  '...KWKKWK...',
  '...KWKKWK...',
  '...KKKKKK...',
]);
/* ---- Badge bahaya: kotak putih + seru merah (bukan kuning biar ga dikira koin) ---- */
const WARN = spr([
  '.KKKKKK.',
  'KWWWWWWK',
  'KWWMMWWK',
  'KWWMMWWK',
  'KWWMMWWK',
  'KWWMMWWK',
  'KWWMMWWK',
  'KWWWWWWK',
  '.KKKKKK.',
  '........',
  '..KKKK..',
  '..KMMK..',
  '..KMMK..',
  '..KKKK..',
]);
/* ---- Awan pixel (3 varian, putih) ---- */
const CLOUDS = [
  spr(['......KKKKKK..............',
       '....KKWWWWWWKK............',
       '..KKWWWWWWWWWWKK..........',
       '.KWWWWWWWWWWWWWWK.........',
       'KKKKKKKKKKKKKKKKKK........']),
  spr(['...KKKKK.........',
       '.KKWWWKKK.......',
       'KWWWWWWWWKK.....',
       'KKKKKKKKKKK.....']),
  spr(['........KKKK............',
       '......KKWWWWKK..........',
       '....KKWWWWWWWWK.........',
       '..KKWWWWWWWWWWWWKK......',
       '.KWWWWWWWWWWWWWWWWK.....',
       'KKKKKKKKKKKKKKKKKKK.....']),
];

/* ================= BACKGROUND STATIS (pre-render) ================= */
let farCv = null, nearCv = null, groundTile = null;
function buildStatic() {
  const W2 = W + 80;
  // gunung jauh (biru-abu) + dekat (toska), pola segitiga pixel
  farCv = document.createElement('canvas'); farCv.width = W2; farCv.height = H;
  nearCv = document.createElement('canvas'); nearCv.width = W2; nearCv.height = H;
  const fr = mulberry(7), nr = mulberry(21);
  const peaksF = [], peaksN = [];
  for (let i = 0; i < 7; i++) peaksF.push({ x: fr() * W2, w: 50 + fr() * 70, h: 40 + fr() * 55 });
  for (let i = 0; i < 6; i++) peaksN.push({ x: nr() * W2, w: 60 + nr() * 60, h: 22 + nr() * 30 });
  const fg = farCv.getContext('2d');
  for (const p of peaksF) {
    for (let dx = -p.w; dx <= p.w; dx++) {
      const x = Math.round(p.x + dx);
      if (x < 0 || x >= W2) continue;
      const hh = Math.round(p.h * (1 - Math.abs(dx) / p.w));
      fg.fillStyle = '#8AB8C0';
      fg.fillRect(x, GY - 14 - hh, 1, hh);
    }
  }
  const ng = nearCv.getContext('2d');
  for (const p of peaksN) {
    for (let dx = -p.w; dx <= p.w; dx++) {
      const x = Math.round(p.x + dx);
      if (x < 0 || x >= W2) continue;
      const hh = Math.round(p.h * (1 - Math.abs(dx) / p.w));
      ng.fillStyle = '#6AA99F';
      ng.fillRect(x, GY - 4 - hh, 1, hh);
    }
  }
  // semak horizon
  for (let x = 0; x < W2; x += 3) {
    const hh = 4 + Math.round(nr() * 6);
    ng.fillStyle = nr() < 0.5 ? '#2E7D32' : '#3E9E2F';
    ng.fillRect(x, GY - 2 - hh, 3, hh);
  }
  // ubin tanah 96px: rumput + fringe + tanah 3-tone
  groundTile = document.createElement('canvas');
  groundTile.width = 96; groundTile.height = 46;
  const t = groundTile.getContext('2d'), tr = mulberry(99);
  t.fillStyle = '#5AC02E'; t.fillRect(0, 0, 96, 7);
  t.fillStyle = '#3A9A24';
  for (let x = 0; x < 96; x += 6) { t.fillRect(x, 7, 6, 2); t.fillRect(x + 2, 9, 2, 2); }
  t.fillStyle = '#A05A2E'; t.fillRect(0, 11, 96, 35);
  for (let i = 0; i < 150; i++) {
    t.fillStyle = tr() < 0.55 ? '#7A3E22' : '#3A2115';
    t.fillRect(Math.floor(tr() * 96), 11 + Math.floor(tr() * 24), 2, 2);
  }
  t.fillStyle = '#3A2115'; t.fillRect(0, 36, 96, 10);
  t.fillStyle = '#2A150C'; t.fillRect(0, 41, 96, 5);
}

/* ================= STATE ================= */
const S = {
  mode: 'menu', speed: 85, dist: 0, score: 0, coin: 0,
  hearts: 2, y: 0, vy: 0, duckT: 0, inv: 0, magnet: 0,
  spawnIn: 200, elapsed: 0, camX: 0, run: 0, decoIx: 0,
  best: +(localStorage.getItem('dquest_best') || 0),
};
const GRAV = 1050, JUMP_V = 430;
let obstacles = [];   // {wx, kind, w, h(px virtual), yOff}
let pickups = [];     // {wx, kind:'coin'|'magnet', y, taken, phase}
let decos = [];       // {wx, img, y}
let cloudsA = [];     // {x, y, img, v}
let parts = [];       // debu {x,y,vx,vy,life}
const PX = () => Math.round(W * 0.30);   // posisi dino di layar

function resetRun() {
  obstacles = []; pickups = []; decos = []; parts = [];
  Object.assign(S, {
    speed: 85, dist: 0, score: 0, coin: 0, hearts: 2,
    y: 0, vy: 0, duckT: 0, inv: 0, magnet: 0, spawnIn: 160, elapsed: 0, decoIx: 0,
  });
  seedDeco(true);
  updateHUD();
}
const DECO_SEQ = [TREE, BUSH, BUSH, SIGN, TREE, BUSH, SIGN, BUSH, TREE, BUSH];
function nextDeco() { return DECO_SEQ[(S.decoIx++) % DECO_SEQ.length]; }
function seedDeco(fresh) {
  decos = [];
  S.decoIx = 0;
  let wx = S.camX - 40;
  const end = S.camX + W + 200;
  while (wx < end) {
    wx += 60 + Math.random() * 130;
    decos.push({ wx, img: nextDeco() });
  }
  if (fresh) {
    // 3 koin lengkung di depan dino (kayak gambar referensi)
    const bx = S.camX + PX() + 70;
    for (let i = 0; i < 3; i++) {
      pickups.push({
        wx: bx + i * 26, kind: 'coin', taken: false, phase: i * 2.1,
        y: GY - 44 - Math.sin((i / 2) * Math.PI) * 18,
      });
    }
  }
  if (fresh) {
    cloudsA = [];
    for (let i = 0; i < 5; i++) {
      cloudsA.push({
        x: Math.random() * (W + 100) - 50, y: 12 + Math.random() * 90,
        img: CLOUDS[i % CLOUDS.length], v: 4 + Math.random() * 6,
      });
    }
  }
}

/* ================= SPAWNER ================= */
const OBST = {
  rock: { w: 22, h: 18 },    // visual 28x24, hitbox dikecilin biar adil
  bones: { w: 34, h: 10 },   // visual 44x16, hitbox dikecilin biar adil
  ptero: { w: 30, h: 16 },   // visual 40x24, hitbox dikecilin biar adil
};
function spawnRow() {
  const r = Math.random();
  const diff = Math.min(1, S.elapsed / 75);
  const base = S.camX + W + 30;
  if (r < 0.30) {
    addObst('rock', base);
    if (Math.random() < 0.7) coinLine(base, 5, false);
  } else if (r < 0.50) {
    addObst('rock', base);
    if (Math.random() < 0.35 + diff * 0.3) addObst('rock', base + 46);
    coinArc(base);
  } else if (r < 0.66) {
    addObst('bones', base);
    if (Math.random() < 0.7) coinLine(base, 5, false);
  } else if (r < 0.84) {
    addObst('ptero', base);
    if (Math.random() < 0.6) coinLine(base, 4, true);   // koin rendah (sambil nunduk)
  } else {
    if (Math.random() < 0.30) pickups.push({ wx: base, kind: 'magnet', y: GY - 30, taken: false, phase: 0 });
    else coinLine(base, 8, false);
  }
  const gap = 230 - diff * 90 + Math.random() * 130;
  S.spawnIn = Math.max(150, gap);
}
function addObst(kind, wx) {
  obstacles.push({ wx, kind, w: OBST[kind].w, h: OBST[kind].h });
}
function coinLine(baseWx, n, low) {
  for (let i = 0; i < n; i++) {
    pickups.push({
      wx: baseWx + i * 22, kind: 'coin', taken: false, phase: Math.random() * 6,
      y: low ? GY - 16 : GY - 46,
    });
  }
}
function coinArc(baseWx) {
  for (let i = 0; i < 7; i++) {
    pickups.push({
      wx: baseWx - 20 + i * 20, kind: 'coin', taken: false, phase: Math.random() * 6,
      y: GY - 22 - Math.sin((i / 6) * Math.PI) * 52,
    });
  }
}

/* ================= INPUT ================= */
function cmd(c) {
  if (S.mode !== 'playing') return;
  if (c === 'jump' && S.y <= 0.5) { S.vy = JUMP_V; S.duckT = 0; sfx.jump(); dust(6); }
  if (c === 'down') {
    if (S.y > 0.5) S.vy = Math.min(S.vy, -460);   // banting ke tanah
    else { S.duckT = 0.62; }
  }
}
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  const k = e.key;
  if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === ' ') { e.preventDefault(); cmd('jump'); }
  else if (k === 'ArrowDown' || k === 's' || k === 'S') { e.preventDefault(); cmd('down'); }
  else if (k === 'p' || k === 'P' || k === 'Escape') togglePause();
});
let tsx = 0, tsy = 0, tSkip = false;
const UI_SEL = '#touch,#hud,.overlay,button';   // sentuh UI = bukan gesture canvas
addEventListener('touchstart', (e) => {
  if (e.target.closest && e.target.closest(UI_SEL)) { tSkip = true; return; }
  tSkip = false;
  const t = e.changedTouches[0]; tsx = t.clientX; tsy = t.clientY;
}, { passive: true });
addEventListener('touchend', (e) => {
  if (tSkip) { tSkip = false; return; }
  if (e.target.closest && e.target.closest(UI_SEL)) return;
  const t = e.changedTouches[0];
  const dx = t.clientX - tsx, dy = t.clientY - tsy;
  if (Math.hypot(dx, dy) < 24) { cmd('jump'); return; }   // tap layar = lompat
  if (Math.abs(dx) > Math.abs(dy)) cmd('jump');
  else cmd(dy < 0 ? 'jump' : 'down');
}, { passive: true });
let mdown = null;
cv.addEventListener('mousedown', (e) => { mdown = [e.clientX, e.clientY]; });
addEventListener('mouseup', (e) => {
  if (!mdown) return;
  if (e.target.closest && e.target.closest(UI_SEL)) { mdown = null; return; }
  const dx = e.clientX - mdown[0], dy = e.clientY - mdown[1];
  mdown = null;
  if (Math.hypot(dx, dy) < 24) { cmd('jump'); return; }
  if (Math.abs(dx) > Math.abs(dy)) cmd('jump');
  else cmd(dy < 0 ? 'jump' : 'down');
});
addEventListener('touchcancel', () => { tSkip = false; mdown = null; });
const bindHold = (id, c) => {
  const el = $(id);
  if (!el) return;
  // fire: cuma cmd(c) milik tombol ini — tDown SELALU 'down', tUp SELALU 'jump'.
  // stopPropagation = event tombol ga pernah sampai ke handler global di window,
  // jadi tekan/lepas NUNDUK ga bisa disalahartikan jadi tap-layar = lompat.
  const fire = (e) => { e.preventDefault(); e.stopPropagation(); cmd(c); };
  // swallow: lepas jari di atas tombol ditelan di sini + state gesture direset,
  // biar drag-dari-kanvas-lalu-lepas-di-tombol ga ninggalin mdown basi.
  const swallow = (e) => { if (e.cancelable) e.preventDefault(); e.stopPropagation(); tSkip = false; mdown = null; };
  el.addEventListener('touchstart', fire, { passive: false });
  el.addEventListener('mousedown', fire);
  el.addEventListener('touchend', swallow, { passive: false });
  el.addEventListener('touchcancel', swallow, { passive: false });
  el.addEventListener('mouseup', swallow);
};
bindHold('tUp', 'jump'); bindHold('tDown', 'down');

/* ================= FLOW ================= */
function startGame() {
  resetRun();
  S.mode = 'playing';
  ui.menu.classList.add('hidden');
  ui.over.classList.add('hidden');
  ui.paused.classList.add('hidden');
}
function gameOver() {
  if (S.mode !== 'playing') return;
  S.mode = 'over';
  sfx.over();
  S.best = Math.max(S.best, Math.floor(S.score));
  localStorage.setItem('dquest_best', S.best);
  ui.finalScore.textContent = Math.floor(S.score);
  ui.finalCoins.textContent = '🪙 ' + S.coin;
  ui.bestScore.textContent = '🏆 ' + S.best;
  setTimeout(() => ui.over.classList.remove('hidden'), 600);
}
function togglePause(force) {
  if (S.mode !== 'playing' && S.mode !== 'paused') return;
  const toPause = force !== undefined ? force : S.mode === 'playing';
  S.mode = toPause ? 'paused' : 'playing';
  ui.paused.classList.toggle('hidden', !toPause);
}
function updateHUD() {
  ui.score.textContent = Math.floor(S.score);
  ui.coins.textContent = '🪙 ' + S.coin;
  ui.hearts.textContent = '❤'.repeat(S.hearts) + '♡'.repeat(Math.max(0, 2 - S.hearts));
  ui.magnetTag.style.opacity = S.magnet > 0 ? 1 : 0;
}
ui.btnPlay.onclick = startGame;
ui.btnRetry.onclick = startGame;
ui.btnResume.onclick = () => togglePause(false);
ui.btnPause.onclick = () => togglePause();
ui.btnMute.onclick = () => {
  muted = !muted;
  ui.btnMute.textContent = muted ? '×' : '♪';
};
document.addEventListener('visibilitychange', () => { if (document.hidden) togglePause(true); });

function dust(n) {
  for (let i = 0; i < n; i++) {
    parts.push({
      x: PX() - 8 + Math.random() * 10, y: GY - 2 - Math.random() * 4,
      vx: -30 - Math.random() * 40, vy: -20 - Math.random() * 30,
      life: 0.4 + Math.random() * 0.2,
    });
  }
}
function hitPlayer() {
  S.hearts--;
  S.inv = 1.6;
  sfx.hit();
  updateHUD();
  if (S.hearts <= 0) gameOver();
}

/* ================= UPDATE ================= */
function playerBox() {
  const duck = S.duckT > 0;
  const w = duck ? 70 : 52, h = duck ? 22 : 38;
  return { x: PX() - w / 2, y: GY - S.y - h, w, h };
}
function update(dt) {
  S.elapsed += dt;
  S.run += dt;
  if (S.mode === 'playing') {
    S.speed = Math.min(190, S.speed + dt * 2.2);
    S.score += dt * S.speed * 0.06;
  }
  const dz = S.speed * dt;
  S.dist += dz; S.camX += dz;

  // fisika lompat
  if (S.y > 0 || S.vy !== 0) {
    S.vy -= GRAV * dt; S.y += S.vy * dt;
    if (S.y <= 0) { S.y = 0; S.vy = 0; dust(3); }
  }
  if (S.duckT > 0) S.duckT -= dt;
  if (S.inv > 0) S.inv -= dt;
  if (S.magnet > 0) { S.magnet -= dt; if (S.magnet <= 0) updateHUD(); }

  // awan melayang
  for (const c of cloudsA) {
    c.x -= (c.v + S.speed * 0.05) * dt;
    if (c.x < -70) { c.x = W + 20 + Math.random() * 60; c.y = 12 + Math.random() * 90; }
  }

  if (S.mode === 'playing') {
    S.spawnIn -= dz;
    if (S.spawnIn <= 0) spawnRow();

    const pb = playerBox();
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const o = obstacles[i];
      if (o.wx < S.camX - 60) { obstacles.splice(i, 1); continue; }
      const oy = o.kind === 'ptero' ? GY - 52 : GY - o.h;
      // hitbox obstacle di tengah sprite (bukan full), + margin adil 5px
      const ox = Math.round(o.wx - S.camX) + 5, ow = o.w - 10;
      const oh = Math.max(4, o.h - 6);
      if (!o.hit && S.inv <= 0 &&
        pb.x < ox + ow && pb.x + pb.w > ox &&
        pb.y < oy + oh && pb.y + pb.h > oy + 4) {
        o.hit = true; hitPlayer();
      }
    }
    for (let i = pickups.length - 1; i >= 0; i--) {
      const p = pickups[i];
      if (p.taken) continue;
      if (p.wx < S.camX - 40) { pickups.splice(i, 1); continue; }
      const sx = p.wx - S.camX;
      const px = PX(), py = GY - S.y - 14;
      let dx = px - sx, dy = py - p.y;
      let d = Math.hypot(dx, dy);
      const magnetR = S.magnet > 0 && p.kind === 'coin' ? 70 : 0;
      if (magnetR && d < magnetR) {
        p.wx += (dx / Math.max(1, d)) * 160 * dt;
        p.y += (dy / Math.max(1, d)) * 160 * dt;
        d = Math.hypot(px - (p.wx - S.camX), py - p.y);
      }
      if (d < 22) {
        p.taken = true; pickups.splice(i, 1);
        if (p.kind === 'coin') { S.coin++; S.score += 10; sfx.coin(); }
        else { S.magnet = 7; sfx.magnet(); }
        updateHUD();
      }
    }
    // deco mengalir
    let maxWx = S.camX - 100;
    for (const d of decos) maxWx = Math.max(maxWx, d.wx);
    decos = decos.filter((d) => d.wx > S.camX - 60);
    if (maxWx < S.camX + W + 160) {
      decos.push({ wx: maxWx + 60 + Math.random() * 130, img: nextDeco() });
    }
    if ((S.score | 0) % 3 === 0) updateHUD();
  } else {
    // mode menu/over: dunia tetap jalan pelan (attract), tanpa rintangan.
    // koin hiasan selalu ada 3 di layar (kayak gambar referensi)
    if (pickups.length < 3) {
      pickups.push({
        wx: S.camX + W * 0.55 + pickups.length * 34, kind: 'coin',
        taken: false, phase: pickups.length * 2.1, y: GY - 44 - (pickups.length % 2) * 16,
      });
    }
    pickups = pickups.filter((p) => p.wx > S.camX - 40);
    let maxWx = S.camX - 100;
    for (const d of decos) maxWx = Math.max(maxWx, d.wx);
    decos = decos.filter((d) => d.wx > S.camX - 60);
    if (maxWx < S.camX + W + 160) {
      decos.push({ wx: maxWx + 60 + Math.random() * 130, img: nextDeco() });
    }
  }

  // partikel debu
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.life <= 0) parts.splice(i, 1);
  }
  if (S.mode === 'playing' && S.y <= 0 && Math.random() < dt * 8) dust(1);
}

/* ================= DRAW ================= */
function drawImg(img, sx, sy, scale = S2) {
  ctx.drawImage(img, Math.round(sx), Math.round(sy), img.width * scale, img.height * scale);
}
function render() {
  // langit
  ctx.fillStyle = '#7CC6E8';
  ctx.fillRect(0, 0, W, H);
  // awan (parallax pelan)
  for (const c of cloudsA) drawImg(c.img, c.x, c.y, 2);
  // gunung jauh + dekat
  const fx = -Math.round(S.camX * 0.2) % 80 - 40, nx = -Math.round(S.camX * 0.45) % 80 - 40;
  ctx.drawImage(farCv, fx, 0);
  ctx.drawImage(nearCv, nx, 0);
  // deco jalan (pohon/tanda/batu) — di menu, yg dekat dino disembunyiin biar ga numpuk
  const PXM = S.mode === 'menu' ? PX() + 44 : PX();
  for (const d of decos) {
    const sx = Math.round(d.wx - S.camX);
    if (sx < -60 || sx > W + 40) continue;
    if (S.mode === 'menu' && Math.abs(sx - PXM) < 66) continue;
    drawImg(d.img, sx - (d.img.width * S2) / 2, GY - d.img.height * S2, S2);
  }
  // jangkar menu: pohon kiri + papan kanan selalu ada (kayak gambar referensi)
  if (S.mode === 'menu') {
    drawImg(TREE, 8, GY - TREE.height * S2, S2);
    drawImg(SIGN, W - 8 - SIGN.width * S2, GY - SIGN.height * S2, S2);
  }
  // tanah (ubin geser)
  const off = -Math.round(S.camX % 96);
  for (let x = off - 96; x < W + 96; x += 96) ctx.drawImage(groundTile, x, GY);
  // koin & magnet
  const coinImg = Math.floor(S.run * 6) % 2 ? COIN_A : COIN_B;
  for (const p of pickups) {
    const sx = p.wx - S.camX;
    if (sx < -30 || sx > W + 30) continue;
    if (p.kind === 'coin') {
      const bob = Math.sin(S.run * 4 + p.phase) * 2;
      drawImg(coinImg, sx - coinImg.width, p.y + bob - coinImg.height, 2);
    } else {
      const bob = Math.sin(S.run * 3) * 3;
      drawImg(MAGNET, sx - 12, p.y + bob - 12, 2);
    }
  }
  // rintangan: bayangan merah + tanda seru biar jelas HARUS DIHINDARI
  const pteroImg = Math.floor(S.run * 8) % 2 ? PTERO_UP : PTERO_DN;
  for (const o of obstacles) {
    const sx = Math.round(o.wx - S.camX);
    if (sx < -50 || sx > W + 50) continue;
    const topY = o.kind === 'ptero' ? GY - 52 + Math.sin(S.run * 6 + o.wx) * 3 : GY - o.h;
    ctx.fillStyle = 'rgba(200,40,30,.5)';
    ctx.fillRect(sx + 2, GY - 4, o.w - 4, 5);
    const bob = Math.sin(S.run * 5 + o.wx) * 2;
    drawImg(WARN, sx + o.w / 2 - 8, topY - 30 + bob, 2);
    if (o.kind === 'rock') drawImg(ROCK, sx, GY - 24, 2);
    else if (o.kind === 'bones') drawImg(BONES, sx, GY - 16, 2);
    else drawImg(pteroImg, sx, topY, 2);
  }
  // pemain: skala 2 biar proporsional lawan obstacle (kemarin 3 = kebesaran)
  const duck = S.duckT > 0;
  const running = Math.floor(S.run * 10) % 2 === 0;
  const pscale = 2;
  const img = duck ? DINO_DUCK : (S.y > 0.5 ? DINO_A : (running ? DINO_A : DINO_B));
  const blink = S.inv > 0 && Math.floor(S.elapsed * 14) % 2 === 0;
  if (!blink) {
    if (S.mode === 'over') {
      ctx.save();
      ctx.translate(PX(), GY - S.y);
      ctx.rotate(Math.PI);
      ctx.drawImage(img, -img.width * pscale, 0, img.width * pscale, img.height * pscale);
      ctx.restore();
    } else {
      drawImg(img, PXM - (img.width * pscale) / 2, GY - S.y - img.height * pscale, pscale);
    }
  }
  // debu
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  for (const p of parts) ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
}

/* ================= LOOP ================= */
function fit() {
  const a = innerWidth / Math.max(1, innerHeight);
  W = Math.max(200, Math.min(480, Math.round(H * a)));
  cv.width = W; cv.height = H;
  ctx.imageSmoothingEnabled = false;
  // letterbox: jaga aspek layar biar sprite nggak ketarik/gepeng di HP
  const s = Math.min(innerWidth / W, innerHeight / H);
  cv.style.width = Math.floor(W * s) + 'px';
  cv.style.height = Math.floor(H * s) + 'px';
  cv.style.left = Math.floor((innerWidth - W * s) / 2) + 'px';
  cv.style.top = Math.floor((innerHeight - H * s) / 2) + 'px';
  buildStatic();
}
addEventListener('resize', fit);
fit();
seedDeco(true);
ui.loadInfo.textContent = 'best: ' + S.best;

let last = performance.now();
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (S.mode !== 'paused') { update(dt); render(); }
}
if (new URLSearchParams(location.search).has('demo')) {
  // pajang 1 tiap jenis rintangan + koin di menu buat cek visual
  pickups = [];
  for (let i = 0; i < 3; i++) {
    pickups.push({ wx: S.camX + PX() - 24 + i * 24, kind: 'coin', taken: false, phase: i * 2.1, y: GY - 84 - (i % 2) * 14 });
  }
  const bx = S.camX + PX() + 30;
  obstacles.push({ wx: bx, kind: 'rock', w: OBST.rock.w, h: OBST.rock.h });
  obstacles.push({ wx: bx + 42, kind: 'bones', w: OBST.bones.w, h: OBST.bones.h });
  obstacles.push({ wx: bx + 70, kind: 'ptero', w: OBST.ptero.w, h: OBST.ptero.h });
}
if (new URLSearchParams(location.search).has('autoplay')) startGame();
requestAnimationFrame(tick);
