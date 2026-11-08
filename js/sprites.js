import * as THREE from 'three';
import { rand, lerp } from './util.js';

export function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function canvasTexture(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 2; return t; }

/* ---------- procedural textures ---------- */
export function glowTexture(size = 128, inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,0.35)') {
  const c = makeCanvas(size, size), g = c.getContext('2d');
  const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  r.addColorStop(0, inner); r.addColorStop(0.35, mid); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, size, size);
  return canvasTexture(c);
}

export function smokeTexture(size = 128) {
  const c = makeCanvas(size, size), g = c.getContext('2d');
  // Several soft overlapping puffs for a natural edge.
  for (let i = 0; i < 9; i++) {
    const x = size / 2 + rand(-size * 0.14, size * 0.14), y = size / 2 + rand(-size * 0.14, size * 0.14), rr = size * rand(0.22, 0.34);
    const r = g.createRadialGradient(x, y, 0, x, y, rr);
    r.addColorStop(0, 'rgba(255,255,255,0.22)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, size, size);
  }
  return canvasTexture(c);
}

export function sparkleTexture(size = 128) {
  const c = makeCanvas(size, size), g = c.getContext('2d');
  const cx = size / 2;
  const r = g.createRadialGradient(cx, cx, 0, cx, cx, cx);
  r.addColorStop(0, 'rgba(255,255,255,0.9)'); r.addColorStop(0.25, 'rgba(255,255,255,0.25)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, size, size);
  g.fillStyle = 'rgba(255,255,255,1)';
  const spike = (len, w) => { g.beginPath(); g.moveTo(cx, cx - len); g.quadraticCurveTo(cx + w, cx, cx, cx + len); g.quadraticCurveTo(cx - w, cx, cx, cx - len); g.fill(); };
  spike(cx * 0.95, 5); g.save(); g.translate(cx, cx); g.rotate(Math.PI / 2); g.translate(-cx, -cx); spike(cx * 0.95, 5); g.restore();
  g.save(); g.translate(cx, cx); g.rotate(Math.PI / 4); g.translate(-cx, -cx); g.globalAlpha = 0.6; spike(cx * 0.5, 3); g.rotate(Math.PI / 2); spike(cx * 0.5, 3); g.restore();
  return canvasTexture(c);
}

export function cloudTexture(size = 256) {
  const c = makeCanvas(size, size), g = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const x = size / 2 + rand(-size * 0.28, size * 0.28), y = size * 0.55 + rand(-size * 0.12, size * 0.12), rr = size * rand(0.12, 0.22);
    const r = g.createRadialGradient(x, y, 0, x, y, rr);
    r.addColorStop(0, 'rgba(255,255,255,0.35)'); r.addColorStop(0.6, 'rgba(255,255,255,0.12)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, size, size);
  }
  return canvasTexture(c);
}

// 2x2 atlas: 0 heart, 1 rectangle confetti, 2 round confetti, 3 small 4-point sparkle
export function confettiAtlas(cell = 64) {
  const c = makeCanvas(cell * 2, cell * 2), g = c.getContext('2d');
  g.fillStyle = '#fff';
  // heart
  g.save(); g.translate(cell / 2, cell / 2 + 4);
  g.beginPath(); g.moveTo(0, 18); g.bezierCurveTo(-28, -4, -16, -30, 0, -14); g.bezierCurveTo(16, -30, 28, -4, 0, 18); g.fill(); g.restore();
  // rect
  g.fillRect(cell + cell * 0.3, cell * 0.2, cell * 0.4, cell * 0.6);
  // circle
  g.beginPath(); g.arc(cell / 2, cell + cell / 2, cell * 0.28, 0, Math.PI * 2); g.fill();
  // sparkle
  const cx = cell + cell / 2, cy = cell + cell / 2;
  g.beginPath(); g.moveTo(cx, cy - 26); g.quadraticCurveTo(cx + 4, cy, cx, cy + 26); g.quadraticCurveTo(cx - 4, cy, cx, cy - 26); g.fill();
  g.beginPath(); g.moveTo(cx - 26, cy); g.quadraticCurveTo(cx, cy + 4, cx + 26, cy); g.quadraticCurveTo(cx, cy - 4, cx - 26, cy); g.fill();
  return canvasTexture(c);
}

/* Star characters: 4x4 atlas. Frames 0..11 = expression(0..5)*2 + blink(0/1). 12 = halo glow, 13 = plain star. */
export const STAR_EXPR = { NEUTRAL: 0, HAPPY: 1, EXCITED: 2, LOVING: 3, SURPRISED: 4, SLEEPY: 5 };
export function starAtlas(cell = 128) {
  const c = makeCanvas(cell * 4, cell * 4), g = c.getContext('2d');
  const drawStar = (cx, cy, R, r, fill, stroke) => {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 === 0 ? R : r;
      const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad;
      i === 0 ? g.moveTo(x, y) : g.lineTo(x, y);
    }
    g.closePath();
    g.lineJoin = 'round'; g.lineWidth = 9; g.strokeStyle = stroke; g.stroke();
    g.fillStyle = fill; g.fill();
  };
  for (let f = 0; f < 12; f++) {
    const expr = Math.floor(f / 2), blink = f % 2 === 1;
    const ox = (f % 4) * cell, oy = Math.floor(f / 4) * cell;
    const cx = ox + cell / 2, cy = oy + cell / 2;
    // halo
    const halo = g.createRadialGradient(cx, cy, cell * 0.2, cx, cy, cell * 0.5);
    halo.addColorStop(0, 'rgba(255,225,150,0.55)'); halo.addColorStop(1, 'rgba(255,225,150,0)');
    g.fillStyle = halo; g.fillRect(ox, oy, cell, cell);
    const grad = g.createRadialGradient(cx, cy - 6, 4, cx, cy, cell * 0.4);
    grad.addColorStop(0, '#fff8dc'); grad.addColorStop(0.6, '#ffe28a'); grad.addColorStop(1, '#ffc95a');
    drawStar(cx, cy + 2, cell * 0.36, cell * 0.17, grad, '#ffc24d');
    // face
    const ex = 11, ey = cy - 2;
    const big = expr === STAR_EXPR.EXCITED || expr === STAR_EXPR.SURPRISED ? 1.25 : 1;
    const blush = expr !== STAR_EXPR.NEUTRAL;
    if (blush) {
      g.fillStyle = 'rgba(255,120,150,0.45)';
      g.beginPath(); g.ellipse(cx - 19, ey + 9, 6, 3.5, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(cx + 19, ey + 9, 6, 3.5, 0, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = '#2a2140'; g.lineCap = 'round'; g.lineWidth = 3.2;
    const eye = (x) => {
      if (blink) { g.beginPath(); g.moveTo(x - 5, ey + 1); g.quadraticCurveTo(x, ey + 4, x + 5, ey + 1); g.stroke(); return; }
      if (expr === STAR_EXPR.LOVING) { g.beginPath(); g.moveTo(x - 5.5, ey + 2); g.quadraticCurveTo(x, ey - 6, x + 5.5, ey + 2); g.stroke(); return; }
      g.fillStyle = '#2a2140';
      g.beginPath(); g.ellipse(x, ey, 5.2 * big, 6.8 * big, 0, 0, Math.PI * 2); g.fill();
      if (expr === STAR_EXPR.SLEEPY) { g.fillStyle = '#ffd97a'; g.fillRect(x - 7, ey - 9, 14, 8); g.beginPath(); g.moveTo(x - 6, ey - 1); g.lineTo(x + 6, ey - 1); g.stroke(); }
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 1.8 * big, ey - 2.4 * big, 2 * big, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(x + 1.8 * big, ey + 2 * big, 1 * big, 0, Math.PI * 2); g.fill();
    };
    eye(cx - ex); eye(cx + ex);
    // mouth
    g.strokeStyle = '#2a2140'; g.lineWidth = 2.6;
    const my = ey + 11;
    if (expr === STAR_EXPR.NEUTRAL || expr === STAR_EXPR.SLEEPY) { g.beginPath(); g.moveTo(cx - 3.5, my); g.quadraticCurveTo(cx, my + 2.5, cx + 3.5, my); g.stroke(); }
    else if (expr === STAR_EXPR.HAPPY || expr === STAR_EXPR.LOVING) { g.beginPath(); g.moveTo(cx - 6, my - 1); g.quadraticCurveTo(cx, my + 6, cx + 6, my - 1); g.stroke(); }
    else if (expr === STAR_EXPR.EXCITED) { g.fillStyle = '#4a2a3a'; g.beginPath(); g.moveTo(cx - 7, my - 2); g.quadraticCurveTo(cx, my + 11, cx + 7, my - 2); g.closePath(); g.fill(); g.fillStyle = '#ff8aa8'; g.beginPath(); g.ellipse(cx, my + 4.5, 3.5, 2.2, 0, 0, Math.PI * 2); g.fill(); }
    else { g.fillStyle = '#4a2a3a'; g.beginPath(); g.ellipse(cx, my + 1, 3.2, 4.2, 0, 0, Math.PI * 2); g.fill(); }
  }
  // frame 12: halo glow
  { const ox = 0, oy = cell * 3, cx = ox + cell / 2, cy = oy + cell / 2;
    const r = g.createRadialGradient(cx, cy, 0, cx, cy, cell / 2);
    r.addColorStop(0, 'rgba(255,235,180,0.9)'); r.addColorStop(0.3, 'rgba(255,220,150,0.35)'); r.addColorStop(1, 'rgba(255,220,150,0)');
    g.fillStyle = r; g.fillRect(ox, oy, cell, cell); }
  // frame 13: plain star
  { const ox = cell, oy = cell * 3, cx = ox + cell / 2, cy = oy + cell / 2;
    drawStar(cx, cy, cell * 0.3, cell * 0.14, '#fff2c4', '#ffd36b'); }
  return canvasTexture(c);
}

/* ---------- instanced billboard sprite system ---------- */
const VERT = `
attribute vec3 aPos; attribute float aSize; attribute float aAlpha; attribute float aFrame; attribute float aRot; attribute vec3 aColor;
uniform vec2 uAtlas;
varying vec2 vUv; varying float vAlpha; varying vec3 vColor;
void main(){
  float c = cos(aRot), s = sin(aRot);
  vec2 p = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * aSize;
  vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
  mv.xy += p;
  gl_Position = projectionMatrix * mv;
  float col = mod(aFrame, uAtlas.x); float row = floor(aFrame / uAtlas.x);
  vUv = (uv + vec2(col, uAtlas.y - 1.0 - row)) / uAtlas;
  vAlpha = aAlpha; vColor = aColor;
}`;
const FRAG = `
uniform sampler2D uMap;
varying vec2 vUv; varying float vAlpha; varying vec3 vColor;
void main(){
  vec4 t = texture2D(uMap, vUv);
  gl_FragColor = vec4(t.rgb * vColor, t.a * vAlpha);
  if (gl_FragColor.a < 0.003) discard;
}`;

export class SpriteSystem {
  constructor(max, texture, { atlas = [1, 1], blending = THREE.NormalBlending, depthTest = true, depthWrite = false } = {}) {
    this.max = max;
    const plane = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = plane.index;
    geo.setAttribute('position', plane.attributes.position);
    geo.setAttribute('uv', plane.attributes.uv);
    this.pos = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.frame = new Float32Array(max);
    this.rot = new Float32Array(max);
    this.color = new Float32Array(max * 3).fill(1);
    this.attrs = {
      aPos: new THREE.InstancedBufferAttribute(this.pos, 3),
      aSize: new THREE.InstancedBufferAttribute(this.size, 1),
      aAlpha: new THREE.InstancedBufferAttribute(this.alpha, 1),
      aFrame: new THREE.InstancedBufferAttribute(this.frame, 1),
      aRot: new THREE.InstancedBufferAttribute(this.rot, 1),
      aColor: new THREE.InstancedBufferAttribute(this.color, 3),
    };
    for (const k in this.attrs) { this.attrs[k].setUsage(THREE.DynamicDrawUsage); geo.setAttribute(k, this.attrs[k]); }
    this.geo = geo;
    this.material = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: texture }, uAtlas: { value: new THREE.Vector2(atlas[0], atlas[1]) } },
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite, depthTest, blending,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.count = 0;
  }
  get count() { return this.geo.instanceCount; }
  set count(n) { this.geo.instanceCount = n; }
  setColor(i, r, g, b) { this.color[i * 3] = r; this.color[i * 3 + 1] = g; this.color[i * 3 + 2] = b; }
  setPos(i, x, y, z) { this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; }
  commit() { for (const k in this.attrs) this.attrs[k].needsUpdate = true; }
}

/* Particle pool on top of SpriteSystem: simple physics + life. */
export class Particles extends SpriteSystem {
  constructor(max, texture, opts = {}) {
    super(max, texture, opts);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.ttl = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.size1 = new Float32Array(max);
    this.alpha0 = new Float32Array(max);
    this.spin = new Float32Array(max);
    this.sway = new Float32Array(max);
    this.gravity = opts.gravity || 0; // y acceleration
    this.drag = opts.drag ?? 1;
    this.swayAmp = opts.swayAmp ?? 0;
    this.fade = opts.fade || 'out'; // 'out' | 'inout' | 'none'
  }
  emit(x, y, z, { vx = 0, vy = 0, vz = 0, ttl = 1, size0 = 0.2, size1 = 0.2, alpha = 1, frame = 0, spin = 0, rot = 0, r = 1, g = 1, b = 1, sway = 0 } = {}) {
    if (this.count >= this.max) return -1;
    const i = this.count++;
    this.setPos(i, x, y, z);
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = 0; this.ttl[i] = ttl; this.size0[i] = size0; this.size1[i] = size1; this.alpha0[i] = alpha;
    this.frame[i] = frame; this.spin[i] = spin; this.rot[i] = rot; this.sway[i] = sway;
    this.size[i] = size0; this.alpha[i] = alpha; this.setColor(i, r, g, b);
    return i;
  }
  kill(i) {
    const last = --this.count;
    if (i !== last) {
      for (let k = 0; k < 3; k++) { this.pos[i * 3 + k] = this.pos[last * 3 + k]; this.vel[i * 3 + k] = this.vel[last * 3 + k]; this.color[i * 3 + k] = this.color[last * 3 + k]; }
      this.life[i] = this.life[last]; this.ttl[i] = this.ttl[last]; this.size0[i] = this.size0[last]; this.size1[i] = this.size1[last];
      this.alpha0[i] = this.alpha0[last]; this.frame[i] = this.frame[last]; this.spin[i] = this.spin[last]; this.rot[i] = this.rot[last]; this.sway[i] = this.sway[last];
    }
  }
  update(dt, t) {
    const drag = Math.pow(this.drag, dt * 60);
    for (let i = this.count - 1; i >= 0; i--) {
      this.life[i] += dt;
      const k = this.life[i] / this.ttl[i];
      if (k >= 1) { this.kill(i); continue; }
      this.vel[i * 3 + 1] += this.gravity * dt;
      this.vel[i * 3] *= drag; this.vel[i * 3 + 1] *= drag; this.vel[i * 3 + 2] *= drag;
      this.pos[i * 3] += this.vel[i * 3] * dt + Math.sin(t * 1.7 + this.sway[i]) * this.swayAmp * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = lerp(this.size0[i], this.size1[i], k);
      this.rot[i] += this.spin[i] * dt;
      let a = 1;
      if (this.fade === 'out') a = 1 - k * k;
      else if (this.fade === 'inout') a = Math.min(1, k * 6) * (1 - k * k);
      this.alpha[i] = this.alpha0[i] * a;
    }
    this.commit();
  }
}
