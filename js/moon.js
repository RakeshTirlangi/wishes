import * as THREE from 'three';
import { clamp, lerp, rand, noise1, tweens, ease } from './util.js';
import { makeCanvas, canvasTexture, glowTexture } from './sprites.js';

const EXPR = {
  neutral:   { smile: 0.45, wide: 0,    squint: 0,    love: 0, blush: 0.35, brow: 0,    open: 0 },
  curious:   { smile: 0.35, wide: 0.25, squint: 0,    love: 0, blush: 0.35, brow: 0.35, open: 0 },
  happy:     { smile: 0.8,  wide: 0,    squint: 0.35, love: 0, blush: 0.5,  brow: 0.1,  open: 0 },
  excited:   { smile: 1,    wide: 0.7,  squint: 0,    love: 0, blush: 0.65, brow: 0.7,  open: 0.35 },
  joy:       { smile: 1,    wide: 0,    squint: 0.2,  love: 1, blush: 0.75, brow: 0.2,  open: 0.25 },
  loving:    { smile: 0.75, wide: 0,    squint: 0.5,  love: 0, blush: 0.6,  brow: -0.1, open: 0 },
  surprised: { smile: 0.2,  wide: 0.9,  squint: 0,    love: 0, blush: 0.4,  brow: 0.9,  open: 0.55 },
  tender:    { smile: 0.6,  wide: 0.1,  squint: 0.25, love: 0, blush: 0.55, brow: -0.05, open: 0 },
};

export class Moon {
  constructor(world) {
    this.world = world;
    this.R = 6;
    this.group = new THREE.Group();
    this.group.position.set(0, 14, -30);
    this.pivot = new THREE.Group();
    this.group.add(this.pivot);

    const mat = new THREE.MeshStandardMaterial({ map: this.makeSurface(), roughness: 0.95, metalness: 0, emissive: new THREE.Color(0x4a4028), emissiveIntensity: 0.45 });
    this.body = new THREE.Mesh(new THREE.SphereGeometry(this.R, 72, 48), mat);
    this.pivot.add(this.body);

    this.faceCanvas = makeCanvas(512, 448);
    this.faceCtx = this.faceCanvas.getContext('2d');
    this.faceTex = canvasTexture(this.faceCanvas);
    const a = 0.95, b = 0.78;
    const faceGeo = new THREE.SphereGeometry(this.R * 1.012, 48, 32, Math.PI / 2 - a, 2 * a, Math.PI / 2 - b, 2 * b);
    this.face = new THREE.Mesh(faceGeo, new THREE.MeshStandardMaterial({ map: this.faceTex, transparent: true, roughness: 0.9, depthWrite: false, emissive: new THREE.Color(0x2a2418), emissiveIntensity: 0.4 }));
    this.pivot.add(this.face);

    this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(256, 'rgba(255,240,200,0.9)', 'rgba(200,180,255,0.3)'), color: 0xd8ccff, transparent: true, blending: THREE.AdditiveBlending, opacity: 0.6, depthWrite: false }));
    this.halo.scale.set(36, 36, 1);
    this.halo.position.z = -3;
    this.group.add(this.halo);

    this.state = { blink: 0, lookX: 0, lookY: 0, ...EXPR.neutral };
    this.target = { ...EXPR.neutral };
    this.lookTarget = null; // THREE.Vector3 in world space, or null for the viewer
    this.look = { x: 0, y: 0 };
    this.sacc = { x: 0, y: 0, t: 0 };
    this.talking = false;
    this.nextBlink = 1.5; this.blinkT = -1; this.doubleBlink = false;
    this.motion = { nod: 0, wave: 0, hop: 0, tilt: 0 };
    this.redrawAcc = 0;
    this.draw();
  }

  makeSurface() {
    const W = 1024, H = 512, c = makeCanvas(W, H), g = c.getContext('2d');
    const base = g.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, '#f8ebc0'); base.addColorStop(0.5, '#f3e2a8'); base.addColorStop(1, '#e9d393');
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    // mottled surface
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${rand() < 0.5 ? '255,250,230' : '200,170,110'},${rand(0.03, 0.08)})`;
      g.beginPath(); g.arc(rand(W), rand(H), rand(4, 26), 0, Math.PI * 2); g.fill();
    }
    // craters, sparse near the face (u≈0.25, v≈0.5)
    for (let i = 0; i < 70; i++) {
      const u = rand(), v = rand();
      const nearFace = Math.hypot((u - 0.25) * 2.2, (v - 0.5) * 1.3) < 0.42;
      if (nearFace && rand() < 0.8) continue;
      const x = u * W, y = v * H, r = rand(6, 30);
      const sh = g.createRadialGradient(x, y, r * 0.2, x, y, r);
      sh.addColorStop(0, 'rgba(190,160,100,0.35)'); sh.addColorStop(0.75, 'rgba(200,170,110,0.18)'); sh.addColorStop(1, 'rgba(255,245,210,0)');
      g.fillStyle = sh; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,250,225,0.5)'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, r * 0.85, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
    }
    return canvasTexture(c);
  }

  express(name, dur = 0.8) {
    const e = EXPR[name] || EXPR.neutral;
    for (const k in e) tweens.add(dur, ((key, from, to) => (t) => { this.target[key] = lerp(from, to, t); })(k, this.target[k], e[k]), ease.inOutSine);
  }
  lookAt(target) { this.lookTarget = target ? target.clone() : null; }
  nod() { return tweens.add(1.1, (t) => { this.motion.nod = Math.sin(t * Math.PI * 2) * 0.12 * (1 - t * 0.5); }); }
  wave() { return tweens.add(2.6, (t) => { this.motion.wave = Math.sin(t * Math.PI * 5) * 0.14 * Math.sin(t * Math.PI); }); }
  hop(times = 3) { return tweens.add(0.45 * times, (t) => { this.motion.hop = Math.abs(Math.sin(t * Math.PI * times)) * 1.1; }); }
  blinkNow() { this.blinkT = 0; }

  draw() {
    const g = this.faceCtx, s = this.state, W = 512, H = 448;
    g.clearRect(0, 0, W, H);
    const skin = '#f4e4ae';
    // blush
    g.fillStyle = `rgba(255,120,150,${0.42 * s.blush})`;
    g.beginPath(); g.ellipse(256 - 128, 268, 42, 24, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(256 + 128, 268, 42, 24, 0, 0, Math.PI * 2); g.fill();

    const closed = clamp(Math.max(s.blink, s.love), 0, 1);
    for (const sx of [-1, 1]) {
      const cx = 256 + sx * 80, cy = 196 - s.brow * 5;
      const rx = 44 * (1 + 0.28 * s.wide), ry = 56 * (1 + 0.28 * s.wide);
      g.save();
      g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.clip();
      const sg = g.createLinearGradient(0, cy - ry, 0, cy + ry); sg.addColorStop(0, '#e6ebf6'); sg.addColorStop(1, '#ffffff');
      g.fillStyle = sg; g.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
      const ix = cx + s.lookX * rx * 0.34, iy = cy - s.lookY * ry * 0.3;
      const ir = rx * 0.74;
      const ig = g.createRadialGradient(ix, iy + ir * 0.35, ir * 0.1, ix, iy, ir);
      ig.addColorStop(0, '#7a68e0'); ig.addColorStop(0.5, '#34306e'); ig.addColorStop(1, '#17132f');
      g.fillStyle = ig; g.beginPath(); g.ellipse(ix, iy, ir, ir * 1.08, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0f0c22'; g.beginPath(); g.arc(ix, iy, ir * 0.48, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.beginPath(); g.arc(ix - ir * 0.36, iy - ir * 0.38, ir * 0.27, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(ix + ir * 0.32, iy + ir * 0.3, ir * 0.12, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(ix, iy + ir * 0.55, ir * 0.5, ir * 0.22, 0, 0, Math.PI * 2); g.fill();
      // lids
      const lidY = cy - ry + 2 * ry * closed;
      const bow = lerp(ry * 0.35, -ry * 0.75, s.love) * (0.25 + 0.75 * closed);
      g.fillStyle = skin;
      g.beginPath(); g.moveTo(cx - rx - 3, cy - ry - 3); g.lineTo(cx + rx + 3, cy - ry - 3); g.lineTo(cx + rx + 3, lidY);
      g.quadraticCurveTo(cx, lidY + bow, cx - rx - 3, lidY); g.closePath(); g.fill();
      if (s.squint > 0.01) {
        const ly = cy + ry - ry * 0.6 * s.squint;
        g.beginPath(); g.moveTo(cx - rx - 3, cy + ry + 3); g.lineTo(cx - rx - 3, ly);
        g.quadraticCurveTo(cx, ly - ry * 0.45 * s.squint, cx + rx + 3, ly); g.lineTo(cx + rx + 3, cy + ry + 3); g.closePath(); g.fill();
      }
      g.restore();
      // lash line
      g.strokeStyle = `rgba(85,55,40,${0.55 + 0.3 * closed})`; g.lineWidth = 3 + 3.5 * closed; g.lineCap = 'round';
      g.beginPath(); g.moveTo(cx - rx * 0.96, lidY + 1); g.quadraticCurveTo(cx, lidY + bow + 1, cx + rx * 0.96, lidY + 1); g.stroke();
      // brow: nearly invisible at rest, lifts when surprised or excited
      const browA = 0.1 + 0.4 * Math.max(0, s.brow);
      const by = cy - ry - 16 - s.brow * 16;
      g.strokeStyle = `rgba(150,110,70,${browA})`; g.lineWidth = 3;
      g.beginPath(); g.moveTo(cx - rx * 0.6, by + 5); g.quadraticCurveTo(cx, by - 5, cx + rx * 0.6, by + 5); g.stroke();
    }
    // mouth
    const mx = 256, my = 318, w = 60 + 64 * s.smile, lift = s.smile * 22, op = s.open;
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (op < 0.04) {
      g.strokeStyle = '#6a3b38'; g.lineWidth = 7;
      g.beginPath(); g.moveTo(mx - w / 2, my - lift); g.quadraticCurveTo(mx, my + lift * 1.25 + 8, mx + w / 2, my - lift); g.stroke();
    } else {
      g.fillStyle = '#5a2238';
      g.beginPath(); g.moveTo(mx - w / 2, my - lift); g.quadraticCurveTo(mx, my - lift * 0.3 + 4, mx + w / 2, my - lift);
      g.quadraticCurveTo(mx, my + lift * 1.25 + 8 + op * 64, mx - w / 2, my - lift); g.closePath(); g.fill();
      g.strokeStyle = '#6a3b38'; g.lineWidth = 5; g.stroke();
      g.save(); g.clip();
      g.fillStyle = '#ff7f9c'; g.beginPath(); g.ellipse(mx, my + lift * 0.9 + op * 58, w * 0.32, 14 + op * 20, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(mx - w * 0.3, my - lift - 2, w * 0.6, 7 * op + 3);
      g.restore();
    }
    this.faceTex.needsUpdate = true;
  }

  update(dt, t, camera) {
    const s = this.state, tg = this.target;
    // blink scheduling
    this.nextBlink -= dt;
    if (this.nextBlink <= 0 && this.blinkT < 0) { this.blinkT = 0; this.nextBlink = rand(2.4, 5.5); this.doubleBlink = Math.random() < 0.18; }
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      const k = this.blinkT / 0.24;
      s.blink = k < 0.4 ? k / 0.4 : clamp(1 - (k - 0.4) / 0.6, 0, 1);
      if (k >= 1) { s.blink = 0; this.blinkT = -1; if (this.doubleBlink) { this.doubleBlink = false; this.nextBlink = 0.12; } }
    }
    // look direction
    let lx = 0, ly = 0;
    const p = this.group.position;
    const target = this.lookTarget || camera.position;
    const dx = target.x - p.x, dy = target.y - p.y, dz = target.z - p.z;
    if (dz > 2) { lx = clamp((dx / (dz + 6)) * 1.6, -1, 1); ly = clamp((dy / (dz + 6)) * 1.6, -1, 1); }
    else { const m = Math.hypot(dx, dy) || 1; lx = (dx / m) * 0.9; ly = (dy / m) * 0.9; }
    this.sacc.t -= dt;
    if (this.sacc.t <= 0) { this.sacc.t = rand(1.2, 3.5); this.sacc.x = rand(-0.1, 0.1); this.sacc.y = rand(-0.08, 0.08); }
    const k = 1 - Math.pow(0.02, dt);
    this.look.x = lerp(this.look.x, lx + this.sacc.x, k);
    this.look.y = lerp(this.look.y, ly + this.sacc.y, k);
    s.lookX = this.look.x; s.lookY = this.look.y;
    // expression smoothing
    const ke = 1 - Math.pow(0.001, dt);
    for (const key of ['smile', 'wide', 'squint', 'love', 'blush', 'brow']) s[key] = lerp(s[key], tg[key], ke);
    let openT = tg.open;
    if (this.talking) {
      const gate = noise1(t * 1.6, 3) > -0.45 ? 1 : 0.15;
      openT = 0.1 + 0.55 * Math.max(0, 0.55 * Math.sin(t * 12.5) + 0.45 * Math.sin(t * 7.1 + 1.3)) * gate;
    }
    s.open = lerp(s.open, openT, 1 - Math.pow(0.0005, dt));

    // head motion
    const m = this.motion;
    this.pivot.rotation.z = m.wave + Math.sin(t * 0.5) * 0.03 + m.tilt;
    this.pivot.rotation.y = this.look.x * 0.22;
    this.pivot.rotation.x = -this.look.y * 0.14 + m.nod;
    this.pivot.position.y = Math.sin(t * 0.8) * 0.25 + m.hop;
    this.halo.material.opacity = 0.5 + Math.sin(t * 0.7) * 0.08 + s.love * 0.2;

    // face redraw (throttled)
    this.redrawAcc += dt;
    if (this.redrawAcc >= 1 / 30) { this.redrawAcc = 0; this.draw(); }
  }
}
