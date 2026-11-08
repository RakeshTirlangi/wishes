export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export const ease = {
  linear: (t) => t,
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outBack: (t) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  outElastic: (t) => (t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1),
  smooth: (t) => t * t * (3 - 2 * t),
};

// Global pacing knob (URL ?fast=3 speeds everything up for testing).
export const pacing = { speed: 1 };

export const wait = (ms) => new Promise((r) => setTimeout(r, ms / pacing.speed));

class Tweens {
  constructor() { this.list = []; }
  add(duration, onUpdate, easeFn = ease.inOutSine) {
    return new Promise((res) => {
      this.list.push({ t: 0, duration: Math.max(0.0001, duration / pacing.speed), onUpdate, ease: easeFn, res });
    });
  }
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const tw = this.list[i];
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.duration);
      tw.onUpdate(tw.ease(k), k);
      if (k >= 1) { this.list.splice(i, 1); tw.res(); }
    }
  }
}
export const tweens = new Tweens();
export const tweenValue = (obj, key, to, duration, easeFn) => {
  const from = obj[key];
  return tweens.add(duration, (e) => { obj[key] = from + (to - from) * e; }, easeFn);
};
export const tweenVec = (vec, to, duration, easeFn) => {
  const from = vec.clone();
  return tweens.add(duration, (e) => { vec.lerpVectors(from, to, e); }, easeFn);
};

export const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
export const params = new URLSearchParams(location.search);

// Small seeded noise helpers for organic motion.
export const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
export const noise1 = (t, seed = 0) => {
  const i = Math.floor(t), f = t - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash(i + seed * 17.3), hash(i + 1 + seed * 17.3), u) * 2 - 1;
};
