// Screen-space SVG confetti and floating hearts for the finale.
import { rand, pick, isMobile } from './util.js';
import { el } from './scene.js';

const COLORS = ['#ffd27a', '#fff1c8', '#ff9cc2', '#c9b8ff', '#9fdcff', '#ffffff'];
const HEARTS = ['#ff6f9c', '#ff4f7f', '#ffb3cc'];
const heart = 'M0,9 C-16,-2 -8,-15 0,-5 C8,-15 16,-2 0,9 Z';

export class Confetti {
  constructor(svg) {
    this.svg = svg; this.items = []; this.active = false;
    const n = isMobile ? 90 : 140;
    for (let i = 0; i < n; i++) {
      const kind = i % 4 === 0 ? 'heart' : i % 3 === 0 ? 'dot' : 'rect';
      const e = kind === 'heart' ? el('path', { d: heart }, svg) : kind === 'dot' ? el('circle', { r: 4 }, svg) : el('rect', { x: -3, y: -6, width: 6, height: 12, rx: 1.5 }, svg);
      e.setAttribute('opacity', 0);
      this.items.push({ e, kind, on: false });
    }
    this.resize();
  }
  resize() { this.w = window.innerWidth; this.h = window.innerHeight; this.svg.setAttribute('viewBox', `0 0 ${this.w} ${this.h}`); }
  start() { this.active = true; }
  stop() { this.active = false; for (const it of this.items) { it.on = false; it.e.setAttribute('opacity', 0); } }
  spawn(it) {
    it.on = true; it.life = 0; it.ttl = rand(6, 10); it.rot = rand(360); it.vr = rand(-180, 180); it.seed = rand(10);
    if (it.kind === 'heart') { it.x = rand(this.w); it.y = this.h + 20; it.vy = -rand(40, 80); it.s = rand(0.7, 1.5); it.e.setAttribute('fill', pick(HEARTS)); it.vr = rand(-20, 20); it.rot = rand(-15, 15); }
    else { it.x = rand(this.w); it.y = -20; it.vy = rand(50, 110); it.s = rand(0.7, 1.3); it.e.setAttribute('fill', pick(COLORS)); }
  }
  update(dt, t) {
    for (const it of this.items) {
      if (!it.on) { if (this.active && Math.random() < 0.02) this.spawn(it); continue; }
      it.life += dt;
      if (it.life > it.ttl || it.y < -40 || it.y > this.h + 40) { it.on = false; it.e.setAttribute('opacity', 0); continue; }
      it.y += it.vy * dt; it.x += Math.sin(t * 1.5 + it.seed) * 30 * dt; it.rot += it.vr * dt;
      const sx = it.kind === 'rect' ? Math.cos(t * 4 + it.seed) : 1;
      const a = Math.min(1, it.life * 2) * Math.min(1, (it.ttl - it.life) * 1.5) * (it.kind === 'heart' ? 0.8 : 1);
      it.e.setAttribute('transform', `translate(${it.x.toFixed(1)},${it.y.toFixed(1)}) rotate(${it.rot.toFixed(1)}) scale(${(it.s * sx).toFixed(2)},${it.s.toFixed(2)})`);
      it.e.setAttribute('opacity', a.toFixed(2));
    }
  }
}
