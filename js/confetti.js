import * as THREE from 'three';
import { isMobile, rand, pick } from './util.js';
import { Particles, confettiAtlas } from './sprites.js';

const COLORS = [[1, 0.78, 0.42], [1, 0.95, 0.75], [1, 0.62, 0.78], [0.79, 0.72, 1], [0.62, 0.9, 1], [1, 1, 1]];
const HEART = [[1, 0.45, 0.6], [1, 0.3, 0.45], [1, 0.7, 0.82]];

export class Confetti {
  constructor(world) {
    this.world = world;
    this.sys = new Particles(isMobile ? 420 : 700, confettiAtlas(64), { atlas: [2, 2], gravity: -1.6, drag: 0.992, swayAmp: 1.4, fade: 'out' });
    this.hearts = new Particles(isMobile ? 90 : 140, confettiAtlas(64), { atlas: [2, 2], gravity: 0.25, drag: 0.995, swayAmp: 1.2, fade: 'inout' });
    this.sys.mesh.renderOrder = 8; this.hearts.mesh.renderOrder = 8;
    world.add(this.sys.mesh, this.hearts.mesh);
    this.active = false;
    this._f = new THREE.Vector3(); this._r = new THREE.Vector3(); this._u = new THREE.Vector3(); this._p = new THREE.Vector3();
  }
  start() { this.active = true; }
  stop() { this.active = false; }
  /* Spawn relative to the camera so the celebration follows the shot. */
  spawnPoint(dist, rx, ry) {
    const cam = this.world.camera;
    cam.getWorldDirection(this._f);
    this._r.crossVectors(this._f, cam.up).normalize();
    this._u.crossVectors(this._r, this._f).normalize();
    return this._p.copy(cam.position).addScaledVector(this._f, dist).addScaledVector(this._r, rx).addScaledVector(this._u, ry);
  }
  update(dt, t) {
    if (this.active) {
      for (let q = 0; q < 4; q++) if (this.sys.count < this.sys.max) {
        const d = rand(8, 24), p = this.spawnPoint(d, rand(-1, 1) * d * 0.9, d * 0.6 + rand(0, 4));
        const c = pick(COLORS);
        this.sys.emit(p.x, p.y, p.z, { vx: rand(-0.8, 0.8), vy: rand(-0.5, 0.3), vz: rand(-0.5, 0.5), ttl: rand(5, 8), size0: rand(0.12, 0.3) * d * 0.08, size1: rand(0.1, 0.25) * d * 0.08, alpha: 1, frame: pick([1, 1, 2, 3]), spin: rand(-5, 5), rot: rand(6), r: c[0], g: c[1], b: c[2], sway: rand(10) });
      }
      if (this.hearts.count < this.hearts.max && Math.random() < 0.5) {
        const d = rand(8, 20), p = this.spawnPoint(d, rand(-1, 1) * d * 0.8, -d * 0.55);
        const c = pick(HEART);
        this.hearts.emit(p.x, p.y, p.z, { vx: rand(-0.3, 0.3), vy: rand(0.8, 1.6), vz: 0, ttl: rand(5, 8), size0: rand(0.3, 0.7) * d * 0.08, size1: rand(0.4, 0.9) * d * 0.08, alpha: 0.95, frame: 0, spin: rand(-0.6, 0.6), rot: rand(-0.3, 0.3), r: c[0], g: c[1], b: c[2], sway: rand(10) });
      }
    }
    this.sys.update(dt, t); this.hearts.update(dt, t);
  }
}
