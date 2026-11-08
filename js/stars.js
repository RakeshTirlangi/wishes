import * as THREE from 'three';
import { isMobile, clamp, lerp, rand, ease, pacing } from './util.js';
import { SpriteSystem, Particles, starAtlas, glowTexture, STAR_EXPR } from './sprites.js';

const fract = (x) => x - Math.floor(x);

export class Stars {
  constructor(world) {
    this.world = world;
    const n = (this.n = isMobile ? 230 : 320);
    this.sys = new SpriteSystem(n, starAtlas(), { atlas: [4, 4] });
    this.sys.mesh.renderOrder = -1;
    this.trail = new Particles(isMobile ? 900 : 1500, glowTexture(64), { blending: THREE.AdditiveBlending, fade: 'out', drag: 0.985 });
    this.trail.mesh.renderOrder = 2;
    world.add(this.sys.mesh, this.trail.mesh);

    this.origin = new Float32Array(n * 3);
    this.ctrl = new Float32Array(n * 3);
    this.base = new Float32Array(n);
    this.seed = new Float32Array(n);
    this.expr = new Uint8Array(n);
    this.state = new Uint8Array(n); // 0 idle, 1 traveling, 2 collected
    this.t0 = new Float32Array(n);
    this.dur = new Float32Array(n);
    this.keep = new Uint8Array(n);
    this.fadeIn = new Float32Array(n).fill(1);
    this.happy = 0;
    this.target = new THREE.Vector3(0, 6, -6);
    this.onArrive = null;
    this.time = 0;

    const exprs = [STAR_EXPR.NEUTRAL, STAR_EXPR.HAPPY, STAR_EXPR.NEUTRAL, STAR_EXPR.SLEEPY, STAR_EXPR.HAPPY, STAR_EXPR.LOVING, STAR_EXPR.SURPRISED, STAR_EXPR.NEUTRAL];
    for (let i = 0; i < n; i++) {
      const near = i % 4 === 0;
      const r = near ? rand(42, 70) : rand(80, 150);
      const th = rand(-1.95, 1.95); // around -z
      const el = near ? rand(-0.15, 0.9) : Math.asin(rand(-0.08, 0.98));
      const x = r * Math.sin(th) * Math.cos(el), y = r * Math.sin(el) + 4, z = -r * Math.cos(th) * Math.cos(el);
      this.origin[i * 3] = x; this.origin[i * 3 + 1] = y; this.origin[i * 3 + 2] = z;
      this.base[i] = near ? rand(1.3, 2.6) : rand(3.2, 6.5);
      this.seed[i] = rand();
      this.expr[i] = exprs[Math.floor(rand(exprs.length))];
      this.keep[i] = i % 9 === 0 ? 1 : 0; // a few stay behind to watch
      const tint = rand();
      if (tint < 0.6) this.sys.setColor(i, 1, 1, 1);
      else if (tint < 0.8) this.sys.setColor(i, 1, 0.9, 0.95);
      else this.sys.setColor(i, 0.92, 0.9, 1);
    }
    this.sys.count = n;
    this.sys.commit();
  }

  setHappy(v) { this.happy = v; }

  /* Send every star (except the keepers) to a target point, staggered. Resolves when the last one arrives. */
  collect(target, { stagger = 0.04, dur = 2.6 } = {}) {
    this.target.copy(target);
    const order = [];
    for (let i = 0; i < this.n; i++) if (!this.keep[i] && this.state[i] === 0) order.push(i);
    // mostly far-to-near with some shuffle so the sky empties gracefully
    order.sort((a, b) => (this.origin[b * 3 + 2] + rand(-30, 30)) - (this.origin[a * 3 + 2] + rand(-30, 30)));
    const now = this.time;
    order.forEach((i, k) => {
      this.state[i] = 1;
      this.t0[i] = now + (k * stagger) / pacing.speed;
      this.dur[i] = (dur * rand(0.85, 1.15)) / pacing.speed;
      const ox = this.origin[i * 3], oy = this.origin[i * 3 + 1], oz = this.origin[i * 3 + 2];
      // control point: above the straight path, bowed sideways
      const mx = (ox + target.x) / 2, my = (oy + target.y) / 2, mz = (oz + target.z) / 2;
      const side = Math.sign(ox || rand(-1, 1)) * rand(6, 22);
      this.ctrl[i * 3] = mx + side; this.ctrl[i * 3 + 1] = my + rand(10, 26); this.ctrl[i * 3 + 2] = mz + rand(-6, 6);
    });
    const total = ((order.length - 1) * stagger + dur * 1.2) / pacing.speed;
    return new Promise((res) => setTimeout(res, total * 1000 + 300));
  }

  /* Bring the stars back for the finale. */
  restore() {
    for (let i = 0; i < this.n; i++) if (this.state[i] === 2) { this.state[i] = 0; this.fadeIn[i] = 0; this.t0[i] = this.time + rand(0, 2.5); }
  }

  update(dt, t) {
    this.time = t;
    const S = this.sys, happy = this.happy;
    const tx = this.target.x, ty = this.target.y, tz = this.target.z;
    for (let i = 0; i < this.n; i++) {
      const seed = this.seed[i];
      const st = this.state[i];
      if (st === 2) { S.alpha[i] = 0; S.size[i] = 0; continue; }
      const blink = fract(t * 0.28 + seed * 13.7) > 0.945 ? 1 : 0;
      let expr = this.expr[i];
      if (happy > 0.5) expr = seed < 0.45 ? STAR_EXPR.HAPPY : seed < 0.78 ? STAR_EXPR.EXCITED : STAR_EXPR.LOVING;
      S.frame[i] = expr * 2 + blink;
      const bounce = happy * Math.abs(Math.sin(t * 4.2 + seed * 20)) * 2.2;
      const fx = Math.sin(t * 0.5 + seed * 10) * 1.3, fy = Math.cos(t * 0.42 + seed * 7) * 1.3 + bounce;
      const twinkle = 0.86 + 0.14 * Math.sin(t * 3.1 + seed * 30) + happy * 0.18;
      S.rot[i] = Math.sin(t * 0.8 + seed * 9) * 0.12;
      if (st === 0) {
        if (this.fadeIn[i] < 1) { if (t > this.t0[i]) this.fadeIn[i] = Math.min(1, this.fadeIn[i] + dt * 0.8); }
        const f = ease.outCubic(this.fadeIn[i]);
        S.setPos(i, this.origin[i * 3] + fx, this.origin[i * 3 + 1] + fy, this.origin[i * 3 + 2]);
        S.size[i] = this.base[i] * twinkle * f;
        S.alpha[i] = f;
      } else {
        const k = clamp((t - this.t0[i]) / this.dur[i], 0, 1);
        if (k <= 0) { S.setPos(i, this.origin[i * 3] + fx, this.origin[i * 3 + 1] + fy, this.origin[i * 3 + 2]); S.size[i] = this.base[i] * twinkle * (1 + 0.25 * Math.sin(t * 9)); S.alpha[i] = 1; continue; }
        const e = ease.inOutSine(k), u = 1 - e;
        const ox = this.origin[i * 3], oy = this.origin[i * 3 + 1], oz = this.origin[i * 3 + 2];
        const cx = this.ctrl[i * 3], cy = this.ctrl[i * 3 + 1], cz = this.ctrl[i * 3 + 2];
        const x = u * u * ox + 2 * u * e * cx + e * e * tx;
        const y = u * u * oy + 2 * u * e * cy + e * e * ty;
        const z = u * u * oz + 2 * u * e * cz + e * e * tz;
        S.setPos(i, x, y, z);
        const shrink = 1 - 0.75 * ease.smooth(clamp((k - 0.6) / 0.4, 0, 1));
        // keep an on-screen size that stays readable as the star comes close
        const cp = this.world.camera.position;
        const camD = Math.hypot(cp.x - x, cp.y - y, cp.z - z);
        const sz = Math.min(this.base[i], Math.max(0.9, camD * 0.045)) * shrink * (1 + 0.1 * Math.sin(t * 8 + seed));
        S.size[i] = sz;
        S.alpha[i] = 1;
        S.frame[i] = (seed < 0.5 ? STAR_EXPR.EXCITED : STAR_EXPR.LOVING) * 2 + blink;
        if (this.trail.count < this.trail.max - 2) {
          for (let q = 0; q < 2; q++) this.trail.emit(x + rand(-0.3, 0.3), y + rand(-0.3, 0.3), z + rand(-0.3, 0.3), { vx: rand(-0.6, 0.6), vy: rand(-0.4, 0.2), vz: rand(-0.6, 0.6), ttl: rand(0.5, 1.1), size0: sz * 0.45, size1: 0.05, alpha: 0.85, r: 1, g: rand(0.78, 0.9), b: rand(0.35, 0.55) });
        }
        if (k >= 1) { this.state[i] = 2; S.alpha[i] = 0; if (this.onArrive) this.onArrive(i); }
      }
    }
    S.commit();
    this.trail.update(dt, t);
  }
}
