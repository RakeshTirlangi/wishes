// The whole world is one SVG: sky, Milky Way, stars, moon, sea, pier, cake, envelope and effects.
// A "camera" animates the SVG viewBox for cinematic moves.
import { rand, clamp, lerp, noise1, ease, isMobile, pick, tweens, pacing } from './util.js';

export const NS = 'http://www.w3.org/2000/svg';
export function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
const f2 = (n) => Math.round(n * 100) / 100;
const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

export const W = { x0: -2200, x1: 4200, top: -1700, horizon: 1200 };
export const MOON = { x: 1000, y: 600, r: 115 };
export const ENV = { x: 1000, y: 1500 };
const CX = 1000;
const CAKE = { base: 1960, t1Top: 1848, t2Top: 1758 };
const pierHW = (y) => 95 + (y - 1600) * 0.285;

function grad(defs, type, id, stops, attrs = {}) {
  const g = el(type === 'r' ? 'radialGradient' : 'linearGradient', { id, ...attrs }, defs);
  for (const s of stops) el('stop', { offset: s[0], 'stop-color': s[1], 'stop-opacity': s[2] ?? 1 }, g);
  return g;
}
function setHref(img, url) { img.setAttribute('href', url); img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', url); }
function heartD(s) { return `M0,${0.9 * s} C${-1.6 * s},${-0.2 * s} ${-0.8 * s},${-1.5 * s} 0,${-0.5 * s} C${0.8 * s},${-1.5 * s} ${1.6 * s},${-0.2 * s} 0,${0.9 * s} Z`; }

/* --------------------------------------------------------- painted textures */
function milkyWayURL() {
  const Wc = isMobile ? 1536 : 2048, Hc = Math.round(Wc * 0.3);
  const c = document.createElement('canvas'); c.width = Wc; c.height = Hc;
  const g = c.getContext('2d');
  const mid = (x) => Hc / 2 + Math.sin((x / Wc) * Math.PI * 1.3 + 0.4) * Hc * 0.06;
  const edge = (x) => Math.pow(Math.sin((Math.PI * x) / Wc), 1.4);
  g.globalCompositeOperation = 'lighter';
  const cols = ['150,140,255', '255,170,215', '120,170,255', '255,215,190', '190,150,255'];
  for (let i = 0; i < 340; i++) {
    const x = rand(Wc), y = mid(x) + gauss() * Hc * 0.085, r = rand(0.02, 0.07) * Wc, a = rand(0.025, 0.07) * edge(x), col = pick(cols);
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, `rgba(${col},${a})`); rg.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = rg; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  for (let i = 0; i < (isMobile ? 16000 : 24000); i++) {
    const x = rand(Wc), y = mid(x) + gauss() * Hc * 0.1;
    if (Math.random() > edge(x)) continue;
    const s = Math.random() < 0.97 ? rand(0.5, 1.3) : rand(1.4, 2.4);
    g.fillStyle = `rgba(255,${Math.round(rand(225, 255))},${Math.round(rand(210, 255))},${rand(0.2, 0.85)})`;
    g.fillRect(x, y, s, s);
  }
  g.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 120; i++) {
    const x = rand(Wc), y = mid(x) + gauss() * Hc * 0.03 + Hc * 0.01, rx = rand(0.015, 0.055) * Wc, ry = rx * rand(0.12, 0.3);
    g.save(); g.translate(x, y); g.scale(1, ry / rx);
    const rg = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    rg.addColorStop(0, `rgba(0,0,0,${rand(0.25, 0.55)})`); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill(); g.restore();
  }
  return c.toDataURL('image/png');
}

function cloudURL(seedCount = 30) {
  const Wc = 640, Hc = 200;
  const c = document.createElement('canvas'); c.width = Wc; c.height = Hc;
  const g = c.getContext('2d');
  for (let i = 0; i < seedCount; i++) {
    const x = Wc / 2 + gauss() * Wc * 0.18, y = Hc * 0.6 + gauss() * Hc * 0.08, r = rand(30, 75);
    const rg = g.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(255,255,255,0.32)'); rg.addColorStop(0.6, 'rgba(255,255,255,0.1)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg; g.fillRect(0, 0, Wc, Hc);
  }
  g.globalCompositeOperation = 'source-atop';
  const lg = g.createLinearGradient(0, 0, 0, Hc);
  lg.addColorStop(0, '#efe8ff'); lg.addColorStop(0.55, '#a99cd6'); lg.addColorStop(1, '#4b4278');
  g.fillStyle = lg; g.fillRect(0, 0, Wc, Hc);
  return c.toDataURL('image/png');
}

/* ------------------------------------------------------------ particle pool */
class Pool {
  constructor(parent, n) {
    this.p = [];
    for (let i = 0; i < n; i++) this.p.push({ e: el('circle', { r: 0, opacity: 0 }, parent), on: false });
    this.i = 0;
  }
  emit(x, y, o = {}) {
    let q = null;
    for (let k = 0; k < this.p.length; k++) { const c = this.p[(this.i + k) % this.p.length]; if (!c.on) { q = c; this.i = (this.i + k + 1) % this.p.length; break; } }
    if (!q) { q = this.p[this.i]; this.i = (this.i + 1) % this.p.length; }
    Object.assign(q, { on: true, x, y, vx: o.vx || 0, vy: o.vy || 0, life: 0, ttl: o.ttl || 1, r0: o.r0 ?? 4, r1: o.r1 ?? 1, a0: o.a ?? 1, g: o.g || 0, drag: o.drag ?? 1, sway: o.sway || 0, seed: rand(10), fade: o.fade || 'out' });
    q.e.setAttribute('fill', o.fill || 'url(#pGold)');
  }
  update(dt, t) {
    for (const q of this.p) {
      if (!q.on) continue;
      q.life += dt;
      const k = q.life / q.ttl;
      if (k >= 1) { q.on = false; q.e.setAttribute('opacity', 0); continue; }
      const dr = Math.pow(q.drag, dt * 60);
      q.vx *= dr; q.vy = q.vy * dr + q.g * dt;
      q.x += q.vx * dt + Math.sin(t * 1.6 + q.seed) * q.sway * dt; q.y += q.vy * dt;
      const a = q.fade === 'inout' ? Math.min(1, k * 5) * (1 - k) : 1 - k * k;
      q.e.setAttribute('cx', f2(q.x)); q.e.setAttribute('cy', f2(q.y));
      q.e.setAttribute('r', f2(lerp(q.r0, q.r1, k))); q.e.setAttribute('opacity', f2(a * q.a0));
    }
  }
}

/* ================================================================== Scene */
export class Scene {
  constructor(svg) {
    this.svg = svg; this.t = 0;
    this.cam = { cx: 1000, cy: -450, w: 1500, h: 1300, m: 1.35 };
    this.vb = { x: 0, y: 0, w: 1, h: 1 };
    this.lit = 1; this.smokeT = 0; this.ember = 0; this.bright = 0;
    this.meteors = []; this.nextMeteor = 4; this.meteorRate = 1;
    this.flights = []; this.clouds = [];
    this.defs = el('defs', {}, svg);
    this.root = el('g', {}, svg);
    this.makeDefs();
    this.buildSky();
    this.buildMoon();
    this.buildHorizon();
    this.buildSea();
    this.buildPier();
    this.buildCake();
    this.buildEnvelope();
    this.flyLayer = el('g', {}, this.root);
    this.fx = new Pool(el('g', {}, this.root), isMobile ? 170 : 260);
    this.flash = el('circle', { cx: ENV.x, cy: ENV.y, r: 0, fill: 'url(#flash)', opacity: 0 }, this.root);
    this.resize();
  }

  /* ---------------------------------------------------------------- defs */
  makeDefs() {
    const d = this.defs, U = { gradientUnits: 'userSpaceOnUse' };
    grad(d, 'l', 'sky', [[0, '#01020a'], [0.3, '#040824'], [0.58, '#0d1442'], [0.78, '#1d1d56'], [0.9, '#372a6a'], [0.965, '#64437c'], [1, '#9b6788']], { ...U, x1: 0, y1: W.top - 600, x2: 0, y2: W.horizon });
    grad(d, 'l', 'skyBright', [[0, '#3b4a9a', 0], [0.6, '#5a62c4', 0.35], [1, '#d397c4', 0.7]], { ...U, x1: 0, y1: W.top, x2: 0, y2: W.horizon });
    grad(d, 'l', 'sea', [[0, '#4d3c74'], [0.02, '#2c2658'], [0.12, '#171940'], [0.45, '#0a0d27'], [1, '#03040d']], { ...U, x1: 0, y1: W.horizon, x2: 0, y2: 2700 });
    grad(d, 'l', 'haze', [[0, '#c07aa8', 0], [0.75, '#d88fb0', 0.28], [1, '#f0b0b8', 0.4]], { x1: 0, y1: 0, x2: 0, y2: 1 });
    grad(d, 'r', 'moonBody', [[0, '#fffdf3'], [0.45, '#f5efda'], [0.82, '#e3d9bc'], [1, '#cfc3a2']], { cx: '42%', cy: '38%', r: '70%' });
    grad(d, 'r', 'moonLimb', [[0, '#5a5040', 0], [0.72, '#5a5040', 0], [1, '#5a5040', 0.38]]);
    grad(d, 'r', 'moonHalo', [[0, '#fff6dc', 0.55], [0.42, '#fff2d0', 0.4], [0.6, '#ddd2ff', 0.13], [1, '#b8a8ff', 0]]);
    grad(d, 'r', 'moonGlowWide', [[0, '#e8e0ff', 0.22], [0.3, '#d8ccff', 0.07], [1, '#b8a8ff', 0]]);
    grad(d, 'r', 'mare', [[0, '#857d6e', 0.6], [0.5, '#8a8272', 0.38], [1, '#8f8776', 0]]);
    grad(d, 'r', 'craterB', [[0, '#fffff4', 0.95], [0.35, '#f7f2e2', 0.5], [1, '#f7f2e2', 0]]);
    grad(d, 'r', 'craterD', [[0, '#8a8170', 0.3], [0.65, '#a0977f', 0.12], [1, '#a0977f', 0]]);
    grad(d, 'r', 'starGlow', [[0, '#ffffff', 0.95], [0.12, '#f4f0ff', 0.6], [0.35, '#c9c2ff', 0.14], [1, '#c9c2ff', 0]]);
    grad(d, 'r', 'starGlowWarm', [[0, '#ffffff', 0.95], [0.12, '#fff2da', 0.6], [0.35, '#ffd9a8', 0.14], [1, '#ffd9a8', 0]]);
    grad(d, 'r', 'starGlowGold', [[0, '#ffffff', 1], [0.15, '#fff1c4', 0.85], [0.4, '#ffcf6b', 0.3], [1, '#ffb84d', 0]]);
    grad(d, 'l', 'meteor', [[0, '#ffffff', 0], [0.75, '#e6e4ff', 0.35], [1, '#ffffff', 0.95]]);
    grad(d, 'r', 'reflCol', [[0, '#fff3d6', 0.16], [0.5, '#e8dcff', 0.07], [1, '#e8dcff', 0]]);
    grad(d, 'r', 'lhGlow', [[0, '#fff3c0', 1], [0.2, '#ffd27a', 0.6], [1, '#ffb84d', 0]]);
    grad(d, 'l', 'deck', [[0, '#1a1522'], [1, '#33262f']], { ...U, x1: 0, y1: 1600, x2: 0, y2: 2700 });
    grad(d, 'r', 'warmGlow', [[0, '#ffb066', 0.42], [0.35, '#ff9a55', 0.16], [1, '#ff8a40', 0]]);
    grad(d, 'r', 'flameGlow', [[0, '#ffd08a', 0.85], [0.3, '#ffa050', 0.32], [1, '#ff8030', 0]]);
    grad(d, 'l', 'flameOuter', [[0, '#ff6a10', 0.9], [0.3, '#ffae3a', 1], [0.72, '#ffe08a', 0.9], [1, '#fff3c8', 0]], { x1: 0, y1: 1, x2: 0, y2: 0 });
    grad(d, 'r', 'flameInner', [[0, '#ffffff', 1], [0.6, '#fff4c0', 0.9], [1, '#ffe08a', 0]], { cy: '80%', r: '70%' });
    grad(d, 'l', 'tier1', [[0, '#c86b8f'], [0.22, '#f0a9c2'], [0.45, '#ffd3e2'], [0.72, '#efa6c0'], [1, '#b85f84']], { ...U, x1: CX - 128, y1: 0, x2: CX + 128, y2: 0 });
    grad(d, 'l', 'tier2', [[0, '#c9b0e6'], [0.22, '#e6d6fa'], [0.45, '#faf2ff'], [0.72, '#e3d2f7'], [1, '#b49ad6']], { ...U, x1: CX - 88, y1: 0, x2: CX + 88, y2: 0 });
    grad(d, 'l', 'icing', [[0, '#fffaf4'], [1, '#f1e2d6']], { x1: 0, y1: 0, x2: 0, y2: 1 });
    grad(d, 'l', 'icingTop', [[0, '#f3e7dc'], [0.6, '#fffaf4'], [1, '#fffdf9']], { x1: 0, y1: 0, x2: 0, y2: 1 });
    grad(d, 'l', 'plate', [[0, '#cfc6ec'], [0.5, '#f4f0ff'], [1, '#b9aedc']], { x1: 0, y1: 0, x2: 1, y2: 0 });
    grad(d, 'r', 'pearl', [[0, '#ffffff'], [0.6, '#f1ebff'], [1, '#c9bce6']], { cx: '35%', cy: '35%' });
    grad(d, 'r', 'goldBead', [[0, '#fff3c4'], [0.5, '#f0c35c'], [1, '#a8792a']], { cx: '35%', cy: '35%' });
    grad(d, 'l', 'candleShade', [[0, '#000', 0.25], [0.35, '#fff', 0.15], [0.6, '#fff', 0], [1, '#000', 0.3]], { x1: 0, y1: 0, x2: 1, y2: 0 });
    grad(d, 'l', 'paper', [[0, '#fffaf0'], [1, '#f1dfb8']], { x1: 0, y1: 0, x2: 0, y2: 1 });
    grad(d, 'l', 'paperFlap', [[0, '#fff7e4'], [1, '#ead2a0']], { x1: 0, y1: 0, x2: 0, y2: 1 });
    grad(d, 'l', 'envInside', [[0, '#d8b678'], [1, '#f2dcae']], { x1: 0, y1: 0, x2: 0, y2: 1 });
    grad(d, 'r', 'envInner', [[0, '#fff8d8', 1], [0.5, '#ffd77a', 0.6], [1, '#ffc24d', 0]]);
    grad(d, 'r', 'envGlow', [[0, '#ffe2a0', 0.55], [0.3, '#ffd27a', 0.18], [1, '#ffc24d', 0]]);
    grad(d, 'r', 'wax', [[0, '#ee5b78'], [0.7, '#b51f45'], [1, '#86102e']], { cx: '40%', cy: '35%' });
    grad(d, 'l', 'beam', [[0, '#fff1c4', 0.6], [0.2, '#ffd27a', 0.22], [0.6, '#ffb84d', 0.05], [1, '#ffb84d', 0]], { x1: 0, y1: 0, x2: 0, y2: 1 });
    grad(d, 'r', 'flash', [[0, '#ffffff', 1], [0.25, '#fff1c8', 0.7], [1, '#ffd27a', 0]]);
    grad(d, 'r', 'pGold', [[0, '#fffbe6', 1], [0.35, '#ffd36b', 0.8], [1, '#ffb84d', 0]]);
    grad(d, 'r', 'pWhite', [[0, '#ffffff', 1], [0.35, '#eef0ff', 0.7], [1, '#c9c2ff', 0]]);
    grad(d, 'r', 'pPink', [[0, '#fff0f6', 1], [0.35, '#ff8fbf', 0.8], [1, '#ff5fa0', 0]]);
    grad(d, 'r', 'pBlue', [[0, '#f0fbff', 1], [0.35, '#8fd3ff', 0.8], [1, '#5fb0ff', 0]]);
    grad(d, 'r', 'pViolet', [[0, '#f6f0ff', 1], [0.35, '#b99cff', 0.8], [1, '#9070ff', 0]]);
    grad(d, 'r', 'pSmoke', [[0, '#d9d4e6', 0.55], [0.5, '#b9b2cc', 0.25], [1, '#a9a2bc', 0]]);
    // candle stripes
    const cols = [['#ffd1dc', '#fff8fa'], ['#cde7ff', '#f6fbff'], ['#fff0b0', '#fffcea'], ['#d6f7cc', '#f6fff2'], ['#e6d0ff', '#fbf7ff'], ['#ffdcbc', '#fff8f0'], ['#c6f3ec', '#f2fffd']];
    cols.forEach((c, i) => {
      const p = el('pattern', { id: `cs${i}`, patternUnits: 'userSpaceOnUse', width: 7, height: 7, patternTransform: 'rotate(38)' }, d);
      el('rect', { width: 7, height: 7, fill: c[1] }, p); el('rect', { width: 2.8, height: 7, fill: c[0] }, p);
    });
  }

  /* ----------------------------------------------------------------- sky */
  buildSky() {
    const sky = this.sky = el('g', {}, this.root);
    el('rect', { x: -9000, y: -7000, width: 20000, height: 7000 + W.horizon + 2, fill: 'url(#sky)' }, sky);
    this.skyBright = el('rect', { x: -9000, y: -7000, width: 20000, height: 7000 + W.horizon + 2, fill: 'url(#skyBright)', opacity: 0 }, sky);
    // soft nebula glows
    for (const n of [[350, -150, 900, 380, '#8a6cff', 0.1, -24], [1750, -520, 800, 300, '#ff7ac0', 0.07, -24], [2600, -900, 700, 260, '#6cb0ff', 0.07, -24]]) {
      const id = `neb${Math.round(n[0])}`;
      grad(this.defs, 'r', id, [[0, n[4], n[5]], [1, n[4], 0]]);
      el('ellipse', { cx: n[0], cy: n[1], rx: n[2], ry: n[3], fill: `url(#${id})`, transform: `rotate(${n[6]} ${n[0]} ${n[1]})` }, sky);
    }
    const mw = el('image', { x: -1500, y: -950, width: 4800, height: 1800, preserveAspectRatio: 'none', opacity: 0.85, transform: 'rotate(-24 1000 -50)' }, sky);
    setHref(mw, milkyWayURL());

    // static star field: three merged paths (cheap to draw)
    const buckets = [[], [], []];
    const n = isMobile ? 1300 : 1900;
    for (let i = 0; i < n; i++) {
      const x = rand(W.x0, W.x1), y = W.top + Math.pow(rand(), 1.2) * (W.horizon - 12 - W.top);
      if (Math.hypot(x - MOON.x, y - MOON.y) < MOON.r * 2.2) continue;
      const near = y > W.horizon - 260;
      const b = near ? 0 : Math.random() < 0.6 ? 0 : Math.random() < 0.7 ? 1 : 2;
      const r = [rand(1.2, 1.9), rand(1.8, 2.6), rand(2.4, 3.2)][b];
      buckets[b].push(`M${f2(x - r)},${f2(y)}a${f2(r)},${f2(r)} 0 1,0 ${f2(2 * r)},0a${f2(r)},${f2(r)} 0 1,0 ${f2(-2 * r)},0`);
    }
    const op = [0.4, 0.65, 0.9];
    buckets.forEach((b, i) => el('path', { d: b.join(''), fill: i === 2 ? '#fff8ec' : '#eef0ff', opacity: op[i] }, sky));
    // twinklers
    const tw = el('g', {}, sky);
    for (let i = 0; i < (isMobile ? 140 : 220); i++) {
      const x = rand(W.x0, W.x1), y = W.top + Math.pow(rand(), 1.1) * (W.horizon - 40 - W.top);
      if (Math.hypot(x - MOON.x, y - MOON.y) < MOON.r * 2.2) continue;
      el('circle', { cx: f2(x), cy: f2(y), r: f2(rand(2, 3.4)), fill: pick(['#ffffff', '#dfe6ff', '#fff1dc']), class: 'tw', style: `--d:${rand(2, 6).toFixed(2)}s;--dl:${(-rand(6)).toFixed(2)}s;--o:${rand(0.6, 1).toFixed(2)}` }, tw);
    }
    // wish stars: bright stars that will later fly into the envelope
    this.starLayer = el('g', {}, sky);
    this.wishStars = [];
    const nw = isMobile ? 110 : 150;
    let tries = 0;
    while (this.wishStars.length < nw && tries++ < 2000) {
      const x = rand(-800, 2800), y = rand(-1000, 1080);
      if (Math.hypot(x - MOON.x, y - MOON.y) < MOON.r * 2.6) continue;
      const R = rand(2.4, 4.4), warm = Math.random() < 0.35;
      const g = el('g', { transform: `translate(${f2(x)},${f2(y)})` }, this.starLayer);
      const inner = el('g', { class: 'ws', style: `--d:${rand(2.5, 6).toFixed(2)}s;--dl:${(-rand(6)).toFixed(2)}s` }, g);
      const glow = el('circle', { r: f2(R * 6), fill: warm ? 'url(#starGlowWarm)' : 'url(#starGlow)' }, inner);
      if (R > 3.3 || Math.random() < 0.25) {
        const L = R * rand(7, 10);
        el('path', { d: `M0,${-L} Q${R * 0.35},0 0,${L} Q${-R * 0.35},0 0,${-L}Z M${-L},0 Q0,${R * 0.35} ${L},0 Q0,${-R * 0.35} ${-L},0Z`, fill: '#ffffff', opacity: 0.55 }, inner);
      }
      el('circle', { r: f2(R), fill: '#ffffff' }, inner);
      this.wishStars.push({ g, inner, glow, x, y, R, warm, keep: this.wishStars.length % 9 === 0, gone: false });
    }
    this.meteorLayer = el('g', {}, sky);
  }

  /* ---------------------------------------------------------------- moon */
  buildMoon() {
    const { x, y, r } = MOON;
    const back = el('g', {}, this.root);
    this.addCloud(back, -900, 1010, 1600, 320, 0.38, 2.2);
    this.addCloud(back, 1550, 1040, 1400, 260, 0.32, -1.8);
    this.addCloud(back, -400, 260, 1100, 200, 0.14, 1.2);
    const g = this.moonG = el('g', { transform: `translate(${x},${y})` }, this.root);
    this.moonWide = el('circle', { r: r * 7, fill: 'url(#moonGlowWide)' }, g);
    this.moonHalo = el('circle', { r: r * 2.4, fill: 'url(#moonHalo)' }, g);
    const clip = el('clipPath', { id: 'moonClip' }, this.defs); el('circle', { r }, clip);
    el('circle', { r, fill: 'url(#moonBody)' }, g);
    const d = el('g', { 'clip-path': 'url(#moonClip)' }, g);
    // fine surface texture
    for (let i = 0; i < 160; i++) el('ellipse', { cx: f2(rand(-r, r)), cy: f2(rand(-r, r)), rx: f2(rand(3, 14)), ry: f2(rand(3, 11)), fill: Math.random() < 0.6 ? '#fffef6' : '#a39a86', opacity: f2(rand(0.03, 0.07)) }, d);
    // maria: each sea is a soft cluster of overlapping blobs, so the edges look irregular and natural
    const maria = [[-0.36, -0.34, 0.3, 0.24], [0.12, -0.3, 0.19, 0.17], [0.27, -0.03, 0.23, 0.19], [0.64, -0.2, 0.11, 0.09], [0.5, 0.22, 0.14, 0.2], [-0.6, 0.06, 0.26, 0.48], [-0.2, 0.44, 0.19, 0.13], [-0.08, -0.62, 0.36, 0.11], [0.31, 0.36, 0.1, 0.09], [0.0, -0.08, 0.09, 0.07], [-0.42, 0.62, 0.16, 0.09]];
    for (const m of maria) {
      for (let j = 0; j < 6; j++) {
        const cx = (m[0] + gauss() * m[2] * 0.28) * r, cy = (m[1] + gauss() * m[3] * 0.28) * r;
        el('ellipse', { cx: f2(cx), cy: f2(cy), rx: f2(m[2] * r * rand(0.55, 0.95)), ry: f2(m[3] * r * rand(0.55, 0.95)), fill: 'url(#mare)', opacity: 0.32, transform: `rotate(${Math.round(rand(-40, 40))} ${f2(cx)} ${f2(cy)})` }, d);
      }
    }
    // Tycho with its bright rays, Copernicus and Kepler, plus small craters
    const ty = [-0.15 * r, 0.72 * r];
    for (let i = 0; i < 16; i++) {
      const a = rand(Math.PI * 2), L = rand(0.35, 1.1) * r;
      el('line', { x1: f2(ty[0]), y1: f2(ty[1]), x2: f2(ty[0] + Math.cos(a) * L), y2: f2(ty[1] + Math.sin(a) * L), stroke: '#fffdf0', 'stroke-width': f2(rand(0.8, 2)), 'stroke-opacity': f2(rand(0.08, 0.2)), 'stroke-linecap': 'round' }, d);
    }
    for (const c of [[ty[0], ty[1], 0.07 * r], [-0.3 * r, 0.05 * r, 0.06 * r], [-0.55 * r, 0, 0.04 * r], [0.2 * r, -0.62 * r, 0.035 * r], [0.6 * r, 0.5 * r, 0.04 * r]]) {
      el('circle', { cx: f2(c[0]), cy: f2(c[1]), r: f2(c[2] * 2.2), fill: 'url(#craterB)' }, d);
    }
    for (let i = 0; i < 34; i++) {
      const a = rand(Math.PI * 2), rr = Math.sqrt(rand()) * r * 0.95;
      el('circle', { cx: f2(Math.cos(a) * rr), cy: f2(Math.sin(a) * rr), r: f2(rand(1.5, 4.5)), fill: Math.random() < 0.85 ? 'url(#craterB)' : 'url(#craterD)', opacity: 0.8 }, d);
    }
    el('circle', { r, fill: 'url(#moonLimb)' }, g);
    const front = el('g', {}, this.root);
    this.addCloud(front, 520, 600, 1000, 130, 0.16, 2.6);
  }

  addCloud(parent, x, y, w, h, o, v) {
    if (!this.cloudURL) this.cloudURL = cloudURL();
    const img = el('image', { x, y, width: w, height: h, preserveAspectRatio: 'none', opacity: o }, parent);
    setHref(img, this.cloudURL);
    this.clouds.push({ img, x, v });
  }

  /* ------------------------------------------------------ horizon and land */
  buildHorizon() {
    const g = el('g', {}, this.root);
    el('rect', { x: -9000, y: W.horizon - 150, width: 20000, height: 152, fill: 'url(#haze)' }, g);
    const H = W.horizon;
    const hill = (x) => Math.max(0, 38 + 26 * Math.sin(x * 0.004) + 18 * Math.sin(x * 0.011 + 1) + 8 * Math.sin(x * 0.031));
    let d = `M-9000,${H + 2} L-9000,${H - 30}`;
    for (let x = -4000; x <= 420; x += 30) d += ` L${x},${f2(H - hill(x) * clamp((420 - x) / 600, 0, 1))}`;
    d += ` L420,${H + 2} Z`;
    el('path', { d, fill: '#0b0a1f', stroke: '#2a244e', 'stroke-width': 1.2 }, g);
    // island with a lighthouse
    const isl = (x) => Math.max(0, 115 * Math.exp(-Math.pow((x - 2300) / 260, 2)) + 22 * Math.sin(x * 0.02) * Math.exp(-Math.pow((x - 2300) / 400, 2)));
    d = `M1700,${H + 2}`;
    for (let x = 1700; x <= 2900; x += 20) d += ` L${x},${f2(H - isl(x))}`;
    d += ` L2900,${H + 2} Z`;
    el('path', { d, fill: '#0b0a1f', stroke: '#2a244e', 'stroke-width': 1.2 }, g);
    const lx = 2420, ly = H - isl(lx);
    el('path', { d: `M${lx - 8},${ly} L${lx - 5},${ly - 62} L${lx + 5},${ly - 62} L${lx + 8},${ly} Z`, fill: '#bdb6d8' }, g);
    for (const yy of [ly - 18, ly - 42]) el('rect', { x: lx - 7.5, y: yy, width: 15, height: 7, fill: '#8a3a52' }, g);
    el('rect', { x: lx - 7, y: ly - 72, width: 14, height: 10, fill: '#1a1630' }, g);
    el('path', { d: `M${lx - 9},${ly - 72} L${lx},${ly - 82} L${lx + 9},${ly - 72} Z`, fill: '#3a2a46' }, g);
    el('circle', { cx: lx, cy: ly - 67, r: 70, fill: 'url(#lhGlow)', class: 'lighthouse' }, g);
    this.lighthouse = { x: lx, y: ly - 67 };
  }

  /* ----------------------------------------------------------------- sea */
  buildSea() {
    const H = W.horizon;
    const g = el('g', {}, this.root);
    el('rect', { x: -9000, y: H, width: 20000, height: 8000, fill: 'url(#sea)' }, g);
    // faint lighthouse reflection
    el('rect', { x: this.lighthouse.x - 4, y: H + 4, width: 8, height: 120, fill: '#ffd27a', opacity: 0.12, class: 'lighthouse' }, g);
    el('ellipse', { cx: MOON.x, cy: 1735, rx: 270, ry: 530, fill: 'url(#reflCol)' }, g);
    const waves = el('g', {}, g);
    const rows = isMobile ? 40 : 54;
    for (let k = 0; k < rows; k++) {
      const tt = k / (rows - 1), y = H + 6 + Math.pow(tt, 1.8) * 1400;
      let d = '', x = -4200;
      while (x < 6200) {
        const len = rand(60, 300) * (0.4 + tt * 1.6), gap = rand(40, 260) * (0.4 + tt * 1.6), amp = 1 + tt * 4;
        d += `M${f2(x)},${f2(y)}q${f2(len / 2)},${f2(-amp)} ${f2(len)},0`;
        x += len + gap;
      }
      const crest = k % 3 !== 0;
      el('path', { d, fill: 'none', stroke: crest ? '#8a82cc' : '#06081c', 'stroke-width': f2(0.8 + tt * 4), 'stroke-opacity': f2(crest ? 0.05 + tt * 0.08 : 0.3), 'stroke-linecap': 'round', class: 'wave', style: `--d:${rand(5, 11).toFixed(2)}s;--dl:${(-rand(10)).toFixed(2)}s;--dx:${(10 + tt * 50).toFixed(1)}px` }, waves);
    }
    // moonlight glitter path
    this.glints = el('g', { opacity: 0.85 }, g);
    for (let i = 0; i < (isMobile ? 150 : 220); i++) {
      const t = Math.pow(rand(), 1.5), y = H + 3 + t * 1300, spread = 10 + t * 430;
      const x = MOON.x + gauss() * spread * 0.45;
      el('ellipse', { cx: f2(x), cy: f2(y), rx: f2((4 + t * 70) * rand(0.5, 1.2)), ry: f2(0.8 + t * 3.5), fill: '#fff3d6', class: 'glint', style: `--d:${rand(1.2, 3.6).toFixed(2)}s;--dl:${(-rand(4)).toFixed(2)}s;--o:${(0.3 + 0.65 * (1 - t) * rand(0.6, 1)).toFixed(2)}` }, this.glints);
    }
  }

  /* ---------------------------------------------------------------- pier */
  buildPier() {
    const g = el('g', {}, this.root);
    const far = 1600, near = 3300;
    // posts in the water
    for (const y of [1650, 1820, 2080, 2420, 2900]) {
      for (const s of [-1, 1]) {
        const x = CX + s * (pierHW(y) + 2), w = 6 + (y - far) * 0.014, h = 40 + (y - far) * 0.12;
        el('ellipse', { cx: f2(x), cy: f2(y + h), rx: f2(w * 2.2), ry: f2(w * 0.5), fill: '#000', opacity: 0.35 }, g);
        el('rect', { x: f2(x - w / 2), y, width: f2(w), height: f2(h), fill: '#120d18' }, g);
        el('rect', { x: f2(x - w / 2), y: f2(y + h + 3), width: f2(w), height: f2(h * 0.6), fill: '#120d18', opacity: 0.25 }, g);
      }
    }
    // deck sides (thickness)
    const th = (y) => 4 + (y - far) * 0.025;
    for (const s of [-1, 1]) {
      el('path', { d: `M${CX + s * pierHW(far)},${far} L${CX + s * pierHW(near)},${near} L${CX + s * pierHW(near)},${near + th(near)} L${CX + s * pierHW(far)},${far + th(far)} Z`, fill: '#0f0b14' }, g);
    }
    el('rect', { x: CX - pierHW(far), y: far, width: pierHW(far) * 2, height: th(far), fill: '#0f0b14' }, g);
    el('path', { d: `M${CX - pierHW(far)},${far} L${CX + pierHW(far)},${far} L${CX + pierHW(near)},${near} L${CX - pierHW(near)},${near} Z`, fill: 'url(#deck)' }, g);
    // planks
    let d = '';
    for (let k = 1; k < 30; k++) { const y = far + (near - far) * Math.pow(k / 30, 1.5); d += `M${f2(CX - pierHW(y))},${f2(y)}L${f2(CX + pierHW(y))},${f2(y)}`; }
    el('path', { d, stroke: '#0c0910', 'stroke-width': 2, 'stroke-opacity': 0.7 }, g);
    d = '';
    for (const u of [-0.5, 0, 0.5]) d += `M${f2(CX + u * pierHW(far))},${far}L${f2(CX + u * pierHW(near))},${near}`;
    el('path', { d, stroke: '#0c0910', 'stroke-width': 1.2, 'stroke-opacity': 0.4 }, g);
    // moonlit edges
    el('path', { d: `M${CX - pierHW(far)},${far} L${CX + pierHW(far)},${far} M${CX - pierHW(far)},${far} L${CX - pierHW(near)},${near} M${CX + pierHW(far)},${far} L${CX + pierHW(near)},${near}`, stroke: '#cfc6ff', 'stroke-opacity': 0.22, 'stroke-width': 1.6, fill: 'none' }, g);
  }

  /* ---------------------------------------------------------------- cake */
  buildCake() {
    this.warm = el('circle', { cx: CX, cy: 1740, r: 620, fill: 'url(#warmGlow)' }, this.root);
    this.deckGlow = el('ellipse', { cx: CX, cy: 1975, rx: 430, ry: 140, fill: 'url(#warmGlow)' }, this.root);
    const g = this.cakeG = el('g', {}, this.root);
    const b = CAKE.base;
    el('ellipse', { cx: CX, cy: b + 8, rx: 190, ry: 30, fill: '#000', opacity: 0.4 }, g);
    el('ellipse', { cx: CX, cy: b + 5, rx: 168, ry: 25, fill: '#8f84b4' }, g);
    el('ellipse', { cx: CX, cy: b, rx: 168, ry: 25, fill: 'url(#plate)', stroke: '#e8c67a', 'stroke-width': 2.5 }, g);

    const tier = (top, bottom, rx, ry, gradId, nPearl) => {
      el('path', { d: `M${CX - rx},${top} L${CX - rx},${bottom} A${rx},${ry} 0 0,0 ${CX + rx},${bottom} L${CX + rx},${top} Z`, fill: `url(#${gradId})` }, g);
      el('path', { d: this.dripPath(CX, top, rx, ry, 30, 10, 26), fill: 'url(#icing)' }, g);
      el('ellipse', { cx: CX, cy: top, rx: rx + 2, ry, fill: 'url(#icingTop)' }, g);
      el('path', { d: `M${CX - rx - 2},${top} A${rx + 2},${ry} 0 0,0 ${CX + rx + 2},${top}`, fill: 'none', stroke: '#ffffff', 'stroke-opacity': 0.7, 'stroke-width': 1.4 }, g);
      for (let i = 0; i <= nPearl; i++) {
        const a = (i / nPearl) * Math.PI;
        el('circle', { cx: f2(CX + rx * Math.cos(a)), cy: f2(bottom + ry * Math.sin(a)), r: 4.6, fill: i % 2 ? 'url(#goldBead)' : 'url(#pearl)' }, g);
      }
    };
    tier(CAKE.t1Top, b - 6, 128, 20, 'tier1', 26);
    // hearts and gold garland on the lower tier
    const mid = (CAKE.t1Top + b) / 2 + 8;
    const angs = [0.35, 0.75, 1.15, 1.57, 1.99, 2.39, 2.79];
    let swag = '';
    angs.forEach((a, i) => {
      const x = CX + 128 * Math.cos(a), y = mid + 20 * Math.sin(a) * 0.6, sc = Math.sin(a);
      el('path', { d: heartD(8), fill: i % 2 ? '#ffd27a' : '#ff6f9c', transform: `translate(${f2(x)},${f2(y)}) scale(${f2(sc)},1)` }, g);
      if (i < angs.length - 1) {
        const a2 = angs[i + 1], x2 = CX + 128 * Math.cos(a2), y2 = mid + 20 * Math.sin(a2) * 0.6;
        swag += `M${f2(x)},${f2(y - 16)} Q${f2((x + x2) / 2)},${f2((y + y2) / 2 - 2)} ${f2(x2)},${f2(y2 - 16)}`;
      }
    });
    el('path', { d: swag, fill: 'none', stroke: '#f0c35c', 'stroke-width': 2.2, 'stroke-linecap': 'round' }, g);
    tier(CAKE.t2Top, CAKE.t1Top + 4, 88, 14, 'tier2', 20);
    for (let i = 0; i < 40; i++) {
      const a = rand(0.2, Math.PI - 0.2), x = CX + 86 * Math.cos(a), y = rand(CAKE.t2Top + 22, CAKE.t1Top - 6) + 14 * Math.sin(a) * 0.5;
      el('rect', { x: -1, y: -3.5, width: 2.2, height: 7, rx: 1, fill: pick(['#ff8fbf', '#8fd3ff', '#ffd27a', '#b99cff', '#ffffff']), transform: `translate(${f2(x)},${f2(y)}) rotate(${Math.round(rand(180))})` }, g);
    }
    // candles, back to front
    const cands = [];
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 - Math.PI / 2; cands.push({ i, x: CX + 58 * Math.cos(a), y: CAKE.t2Top + 9 * Math.sin(a) }); }
    cands.sort((p, q) => p.y - q.y);
    this.flames = [];
    for (const c of cands) {
      const top = c.y - 52;
      el('rect', { x: f2(c.x - 4.5), y: f2(top), width: 9, height: 52, fill: `url(#cs${c.i})` }, g);
      el('rect', { x: f2(c.x - 4.5), y: f2(top), width: 9, height: 52, fill: 'url(#candleShade)' }, g);
      el('ellipse', { cx: f2(c.x), cy: f2(top), rx: 4.5, ry: 1.6, fill: '#fffaf0' }, g);
      el('line', { x1: f2(c.x), y1: f2(top), x2: f2(c.x + 0.6), y2: f2(top - 5), stroke: '#2a2020', 'stroke-width': 1.3, 'stroke-linecap': 'round' }, g);
      const ember = el('circle', { cx: f2(c.x + 0.6), cy: f2(top - 5), r: 1.6, fill: '#ff7a2a', opacity: 0 }, g);
      const fg = el('g', { transform: `translate(${f2(c.x + 0.4)},${f2(top - 4)})` }, g);
      const glow = el('circle', { cy: -12, r: 34, fill: 'url(#flameGlow)' }, fg);
      const shape = el('g', {}, fg);
      el('path', { d: 'M0,0 C-7,-3 -7.5,-13 -2.6,-21 C-1,-24 0,-28 0,-32 C1.6,-26 7.6,-17 6.6,-9 C6,-3 3.6,0 0,0 Z', fill: 'url(#flameOuter)' }, shape);
      el('path', { d: 'M0,-1 C-3.4,-2.5 -3.6,-9 0,-16 C3.6,-9 3.4,-2.5 0,-1 Z', fill: 'url(#flameInner)' }, shape);
      el('ellipse', { cx: 0, cy: -2, rx: 2.6, ry: 2.2, fill: '#6f9cff', opacity: 0.55 }, shape);
      this.flames.push({ glow, shape, ember, x: c.x + 0.6, y: top - 5, seed: rand(100) });
    }
    this.smoke = new Pool(el('g', {}, this.root), isMobile ? 90 : 140);
  }

  dripPath(cx, cy, rx, ry, n, minL, maxL) {
    const R = rx + 2;
    let d = `M${cx - R},${cy} A${R},${ry} 0 0,0 ${cx + R},${cy}`;
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI;
      const len = i === 0 || i === n ? 2 : i % 2 ? rand(minL, maxL) * (0.45 + 0.55 * Math.sin(a)) : rand(3, 6);
      pts.push([cx + R * Math.cos(a), cy + ry * Math.sin(a) + len]);
    }
    d += ` L${f2(pts[0][0])},${f2(pts[0][1])}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += ` Q${f2(pts[i][0])},${f2(pts[i][1])} ${f2(mx)},${f2(my)}`;
    }
    return d + ` L${f2(pts[n][0])},${f2(pts[n][1])} Z`;
  }

  /* ------------------------------------------------------------ envelope */
  buildEnvelope() {
    const g = this.envG = el('g', { opacity: 0 }, this.root);
    this.env = { x: ENV.x, y: ENV.y, s: 0.001, fill: 0, pulse: 0, bob: 1, rot: 0, visible: false };
    this.beam = el('path', { d: 'M-34,40 L34,40 L120,1500 L-120,1500 Z', fill: 'url(#beam)', opacity: 0 }, g);
    this.envGlow = el('circle', { r: 280, fill: 'url(#envGlow)', opacity: 0.5 }, g);
    el('rect', { x: -95, y: -62, width: 190, height: 124, rx: 4, fill: 'url(#envInside)' }, g);
    this.envInner = el('ellipse', { cx: 0, cy: -36, rx: 82, ry: 34, fill: 'url(#envInner)', opacity: 0 }, g);
    this.flap = el('path', { d: 'M-95,-62 L95,-62 L0,26 Z', fill: 'url(#paperFlap)', stroke: '#e2b860', 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, g);
    this.pocket = el('path', { d: 'M-95,-62 L0,6 L95,-62 L95,62 L-95,62 Z', fill: 'url(#paper)', stroke: '#e2b860', 'stroke-width': 1.6, 'stroke-linejoin': 'round' }, g);
    el('path', { d: 'M-95,62 L-12,2 M95,62 L12,2', stroke: '#e2b860', 'stroke-width': 1.1, 'stroke-opacity': 0.7, fill: 'none' }, g);
    this.sealG = el('g', { transform: 'translate(0,14) scale(0.001)' }, g);
    el('circle', { r: 19, fill: 'url(#wax)', stroke: '#8a1430', 'stroke-width': 1.5 }, this.sealG);
    el('circle', { r: 13, fill: 'none', stroke: '#f37a96', 'stroke-width': 1, 'stroke-opacity': 0.6 }, this.sealG);
    el('path', { d: heartD(7.5), fill: '#ff8aa6' }, this.sealG);
    this.flapFront = false;
    this.setFlap(-1);
  }

  setFlap(s) {
    const v = Math.abs(s) < 0.03 ? 0.03 * (s < 0 ? -1 : 1) : s;
    this.flap.setAttribute('transform', `translate(0,-62) scale(1,${f2(v)}) translate(0,62)`);
    if (s > 0 && !this.flapFront) { this.envG.insertBefore(this.flap, this.sealG); this.flapFront = true; }
  }

  /* ---------------------------------------------------------- story API */
  setCam(shot) { Object.assign(this.cam, { m: 1.35 }, shot); }

  extinguish() {
    this.smokeT = 4.5; this.ember = 1;
    return tweens.add(0.3, (e) => { this.lit = 1 - e; }, ease.outCubic);
  }

  celebrate() {
    tweens.add(3, (e) => { this.bright = e; }, ease.inOutSine);
    this.meteorRate = 4; this.nextMeteor = 0.2;
    tweens.add(2.4, (e, k) => { const p = Math.sin(k * Math.PI); this.moonHalo.setAttribute('r', f2(MOON.r * (2.4 + p * 0.9))); });
    for (let i = 0; i < 40; i++) {
      const a = rand(Math.PI * 2), sp = rand(40, 160);
      this.fx.emit(CX, 1690, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, ttl: rand(1.2, 2.2), r0: rand(4, 8), r1: 1, g: 30, drag: 0.97, fill: pick(['url(#pGold)', 'url(#pPink)', 'url(#pWhite)']) });
    }
  }

  async appearEnvelope() {
    const e = this.env; e.visible = true;
    this.envG.setAttribute('opacity', 1);
    for (let i = 0; i < 30; i++) { const a = rand(Math.PI * 2), sp = rand(30, 120); this.fx.emit(e.x, e.y, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ttl: rand(0.8, 1.5), r0: rand(4, 7), r1: 1, drag: 0.96 }); }
    await tweens.add(1.4, (k) => { e.s = Math.max(0.001, k); }, ease.outBack);
  }

  /* Send the wish stars to the envelope, staggered, along curved paths. */
  collect({ stagger = 0.05, dur = 2.6, onArrive } = {}) {
    const target = { x: ENV.x, y: ENV.y - 40 };
    const list = this.wishStars.filter((s) => !s.keep && !s.gone);
    list.sort((a, b) => (a.y + rand(-250, 250)) - (b.y + rand(-250, 250)));
    let left = list.length;
    return new Promise((resolve) => {
      list.forEach((s, k) => {
        const side = (s.x < target.x ? -1 : 1) * rand(80, 300);
        this.flights.push({
          s, t0: this.t + (k * stagger) / pacing.speed, dur: (dur * rand(0.85, 1.2)) / pacing.speed, started: false, pts: [],
          c: { x: (s.x + target.x) / 2 + side, y: Math.min(s.y, target.y) - rand(80, 320) }, target,
          done: () => { onArrive && onArrive(); if (--left === 0) resolve(); },
        });
      });
      if (!left) resolve();
    });
  }

  async sealEnvelope() {
    await tweens.add(1.4, (e) => this.setFlap(-1 + 2 * e), ease.inOutCubic);
    this.env.fill = 0;
    for (let i = 0; i < 24; i++) { const a = rand(Math.PI * 2), sp = rand(40, 140); this.fx.emit(this.env.x, this.env.y + 14, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ttl: rand(0.6, 1.2), r0: rand(3, 6), r1: 1, drag: 0.95 }); }
    await tweens.add(0.6, (e) => this.sealG.setAttribute('transform', `translate(0,14) scale(${f2(Math.max(0.001, e))})`), ease.outBack);
  }

  launchEnvelope(duration, onProgress) {
    const e = this.env; e.bob = 0;
    tweens.add(1.4, (k) => { this.beam.setAttribute('opacity', f2(k)); this.envGlow.setAttribute('opacity', f2(0.5 + k * 0.4)); }, ease.outCubic);
    const y0 = e.y, y1 = -1500;
    return tweens.add(duration, (k, raw) => { e.y = lerp(y0, y1, k); e.rot = Math.sin(raw * Math.PI * 3) * 3; if (onProgress) onProgress(raw, k); }, ease.inOutSine);
  }

  async vanishEnvelope() {
    const e = this.env;
    this.flash.setAttribute('cx', f2(e.x)); this.flash.setAttribute('cy', f2(e.y));
    for (let i = 0; i < 60; i++) { const a = rand(Math.PI * 2), sp = rand(80, 320); this.fx.emit(e.x, e.y, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ttl: rand(1, 2), r0: rand(5, 9), r1: 1, drag: 0.95, fill: pick(['url(#pGold)', 'url(#pWhite)']) }); }
    const s0 = e.s;
    await tweens.add(1.1, (k, raw) => {
      this.flash.setAttribute('r', f2(40 + raw * 1100)); this.flash.setAttribute('opacity', f2(Math.sin(raw * Math.PI)));
      e.s = Math.max(0.001, s0 * (1 - k));
    }, ease.outCubic);
    e.visible = false; this.envG.setAttribute('opacity', 0);
  }

  restoreStars() {
    for (const s of this.wishStars) {
      if (!s.gone) continue;
      s.gone = false;
      this.starLayer.appendChild(s.g);
      s.g.setAttribute('transform', `translate(${f2(s.x)},${f2(s.y)})`);
      s.glow.setAttribute('fill', s.warm ? 'url(#starGlowWarm)' : 'url(#starGlow)');
      s.g.style.display = '';
      s.g.style.transition = 'none'; s.g.style.opacity = '0';
      const delay = rand(0, 3);
      requestAnimationFrame(() => requestAnimationFrame(() => { s.g.style.transition = `opacity 2.2s ease ${delay.toFixed(2)}s`; s.g.style.opacity = '1'; }));
    }
  }

  firework(x, y) {
    const cols = pick([['url(#pGold)', 'url(#pWhite)'], ['url(#pPink)', 'url(#pGold)'], ['url(#pBlue)', 'url(#pWhite)'], ['url(#pViolet)', 'url(#pPink)']]);
    const n = isMobile ? 38 : 56;
    this.fx.emit(x, y, { ttl: 0.45, r0: 70, r1: 20, fill: 'url(#pWhite)', a: 0.8 });
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.06, 0.06), sp = rand(0.7, 1) * rand(170, 240);
      this.fx.emit(x, y, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, ttl: rand(1.5, 2.3), r0: rand(4, 6.5), r1: 1.2, g: 60, drag: 0.972, fill: cols[i % 2] });
    }
  }

  rocket(x, y, onBurst) {
    const y0 = W.horizon - 10, dur = 1.1 / pacing.speed;
    const start = this.t;
    this.rockets = this.rockets || [];
    this.rockets.push({ x, y, y0, start, dur, onBurst });
  }

  reset() {
    this.lit = 1; this.smokeT = 0; this.ember = 0; this.bright = 0; this.meteorRate = 1;
    const e = this.env; Object.assign(e, { x: ENV.x, y: ENV.y, s: 0.001, fill: 0, pulse: 0, bob: 1, rot: 0, visible: false });
    this.envG.setAttribute('opacity', 0); this.beam.setAttribute('opacity', 0); this.envGlow.setAttribute('opacity', 0.5);
    this.envG.insertBefore(this.flap, this.pocket); this.flapFront = false; this.setFlap(-1);
    this.sealG.setAttribute('transform', 'translate(0,14) scale(0.001)');
    this.flash.setAttribute('opacity', 0);
  }

  /* -------------------------------------------------------------- frame */
  resize() { this.aspect = window.innerWidth / Math.max(1, window.innerHeight); }

  applyCamera() {
    const c = this.cam, a = this.aspect;
    const h = Math.max(c.h, Math.min(c.w / a, c.h * c.m)), w = h * a;
    const d = h * 0.004, ox = Math.sin(this.t * 0.31) * d, oy = Math.sin(this.t * 0.23 + 1) * d * 0.7;
    const vb = this.vb; vb.x = c.cx - w / 2 + ox; vb.y = c.cy - h / 2 + oy; vb.w = w; vb.h = h;
    this.svg.setAttribute('viewBox', `${f2(vb.x)} ${f2(vb.y)} ${f2(w)} ${f2(h)}`);
  }

  spawnMeteor() {
    const vb = this.vb;
    const x = vb.x + rand(0.2, 1) * vb.w, y = vb.y + rand(0.02, 0.35) * vb.h;
    if (y > W.horizon - 150) return;
    const ang = rand(145, 165) * (Math.PI / 180), len = vb.h * rand(0.12, 0.22), sp = vb.h * rand(0.6, 0.95), w = vb.h * 0.0018;
    const g = el('g', {}, this.meteorLayer);
    el('polygon', { points: `0,${f2(-w)} 0,${f2(w)} ${f2(-len)},0`, fill: 'url(#meteor)' }, g);
    el('circle', { r: f2(w * 1.5), fill: '#ffffff' }, g);
    el('circle', { r: f2(w * 6), fill: 'url(#starGlow)' }, g);
    this.meteors.push({ g, x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: 0, ttl: rand(0.7, 1.1), rot: (ang * 180) / Math.PI });
  }

  update(dt, t) {
    this.t = t;
    // flames
    const lit = this.lit;
    for (const fl of this.flames) {
      const n = noise1(t * 7 + fl.seed, fl.seed), n2 = noise1(t * 3 + fl.seed, fl.seed + 5);
      const sy = (0.92 + 0.14 * n) * lit, sx = (1 - 0.07 * n) * lit;
      fl.shape.setAttribute('transform', `skewX(${f2(n2 * 7)}) scale(${f2(Math.max(0.001, sx))},${f2(Math.max(0.001, sy))})`);
      fl.glow.setAttribute('opacity', f2(lit * (0.82 + 0.18 * n)));
      if (this.ember > 0) fl.ember.setAttribute('opacity', f2(this.ember * (0.7 + 0.3 * Math.sin(t * 20 + fl.seed))));
    }
    if (this.ember > 0) { this.ember = Math.max(0, this.ember - dt * 0.6); if (!this.ember) for (const fl of this.flames) fl.ember.setAttribute('opacity', 0); }
    const flick = 0.9 + 0.1 * noise1(t * 6, 42);
    this.warm.setAttribute('opacity', f2(0.85 * lit * flick));
    this.deckGlow.setAttribute('opacity', f2(0.9 * lit * flick));
    if (this.smokeT > 0) {
      this.smokeT -= dt;
      for (const fl of this.flames) if (Math.random() < (this.smokeT > 3.6 ? 0.9 : 0.35))
        this.smoke.emit(fl.x + rand(-0.6, 0.6), fl.y, { vx: rand(-5, 5), vy: rand(-48, -30), ttl: rand(2.6, 4), r0: 1.5, r1: rand(14, 22), a: 0.5, fill: 'url(#pSmoke)', sway: 9, fade: 'inout', drag: 0.993 });
    }
    this.smoke.update(dt, t);

    // sky brightness, moon glow, clouds
    this.skyBright.setAttribute('opacity', f2(this.bright * 0.55));
    this.glints.setAttribute('opacity', f2(0.85 + this.bright * 0.15));
    this.moonWide.setAttribute('opacity', f2(0.85 + 0.15 * Math.sin(t * 0.6) + this.bright * 0.4));
    for (const c of this.clouds) { c.x += c.v * dt; c.img.setAttribute('x', f2(c.x)); }

    // shooting stars
    this.nextMeteor -= dt * this.meteorRate;
    if (this.nextMeteor <= 0) { this.nextMeteor = rand(4, 9); this.spawnMeteor(); }
    for (let i = this.meteors.length - 1; i >= 0; i--) {
      const m = this.meteors[i]; m.life += dt;
      const k = m.life / m.ttl;
      if (k >= 1) { m.g.remove(); this.meteors.splice(i, 1); continue; }
      m.x += m.vx * dt; m.y += m.vy * dt;
      m.g.setAttribute('transform', `translate(${f2(m.x)},${f2(m.y)}) rotate(${f2(m.rot)})`);
      m.g.setAttribute('opacity', f2(Math.sin(k * Math.PI)));
    }
    if (this.meteorRate > 1) this.meteorRate = Math.max(1, this.meteorRate - dt * 0.15);

    // star flights
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const fl = this.flights[i], s = fl.s;
      if (t < fl.t0) continue;
      if (!fl.started) {
        fl.started = true;
        this.flyLayer.appendChild(s.g);
        s.glow.setAttribute('fill', 'url(#starGlowGold)');
        fl.trail = el('polyline', { fill: 'none', stroke: '#ffd98a', 'stroke-width': f2(s.R * 1.1), 'stroke-opacity': 0.45, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, this.flyLayer);
        this.flyLayer.insertBefore(fl.trail, this.flyLayer.firstChild);
      }
      const k = clamp((t - fl.t0) / fl.dur, 0, 1), e = ease.inOutSine(k), u = 1 - e;
      const x = u * u * s.x + 2 * u * e * fl.c.x + e * e * fl.target.x;
      const y = u * u * s.y + 2 * u * e * fl.c.y + e * e * fl.target.y;
      const sc = 1 - 0.75 * ease.smooth(clamp((k - 0.7) / 0.3, 0, 1));
      s.g.setAttribute('transform', `translate(${f2(x)},${f2(y)}) scale(${f2(sc)})`);
      fl.pts.push(`${f2(x)},${f2(y)}`); if (fl.pts.length > 12) fl.pts.shift();
      fl.trail.setAttribute('points', fl.pts.join(' '));
      if (Math.random() < 0.18) this.fx.emit(x, y, { vx: rand(-15, 15), vy: rand(-10, 15), ttl: rand(0.5, 1), r0: s.R * 1.6, r1: 0.5 });
      if (k >= 1) {
        fl.trail.remove(); s.g.style.display = 'none'; s.gone = true;
        this.flights.splice(i, 1);
        this.env.fill = Math.min(1, this.env.fill + 0.012); this.env.pulse = 1;
        fl.done();
      }
    }

    // envelope
    const e = this.env;
    if (e.visible) {
      e.pulse = Math.max(0, e.pulse - dt * 3);
      const bob = e.bob ? Math.sin(t * 1.1) * 5 : 0;
      this.envG.setAttribute('transform', `translate(${f2(e.x)},${f2(e.y + bob)}) rotate(${f2(e.rot + (e.bob ? Math.sin(t * 0.8) * 1.5 : 0))}) scale(${f2(e.s)})`);
      this.envInner.setAttribute('opacity', f2(this.flapFront ? 0 : clamp(e.fill * 1.6 + e.pulse * 0.5, 0, 1)));
      if (Math.random() < 0.3) { const a = rand(Math.PI * 2), r = rand(120, 190); this.fx.emit(e.x + Math.cos(a) * r, e.y + Math.sin(a) * r * 0.7, { vx: -Math.sin(a) * 20, vy: rand(-20, 8), ttl: rand(1, 2), r0: rand(2.5, 5), r1: 1, fade: 'inout' }); }
      if (e.bob === 0) for (let q = 0; q < 2; q++) this.fx.emit(e.x + rand(-30, 30), e.y + 60, { vx: rand(-20, 20), vy: rand(30, 80), ttl: rand(0.8, 1.6), r0: rand(3, 6), r1: 1, fill: pick(['url(#pGold)', 'url(#pWhite)']) });
    }

    // rockets
    if (this.rockets) for (let i = this.rockets.length - 1; i >= 0; i--) {
      const r = this.rockets[i], k = (t - r.start) / r.dur;
      if (k >= 1) { this.rockets.splice(i, 1); this.firework(r.x, r.y); if (r.onBurst) r.onBurst(); continue; }
      const yy = lerp(r.y0, r.y, ease.outQuad(k));
      this.fx.emit(r.x + rand(-1, 1), yy, { vy: 20, ttl: 0.5, r0: 4, r1: 0.5, fill: 'url(#pGold)' });
    }
    this.fx.update(dt, t);
    this.applyCamera();
  }
}
