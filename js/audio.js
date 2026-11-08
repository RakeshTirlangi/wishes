import { clamp, params, rand, pick } from './util.js';

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);

/* ------------------------------------------------------------------ engine */
export class AudioEngine {
  constructor() { this.ctx = null; this.muted = false; this.ready = false; }

  async init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = (this.ctx = new AC());
    try { await ctx.resume(); } catch (e) { /* resumed later on gesture */ }
    // iOS unlock
    try { const b = ctx.createBuffer(1, 1, 22050); const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch (e) {}
    this.master = ctx.createGain();
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -16; this.comp.ratio.value = 3; this.comp.knee.value = 12;
    this.master.connect(this.comp).connect(ctx.destination);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.0; this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
    this.reverb = ctx.createConvolver(); this.reverb.buffer = this.makeIR(3.2, 2.2);
    this.reverbGain = ctx.createGain(); this.reverbGain.gain.value = 0.45;
    this.reverb.connect(this.reverbGain).connect(this.master);
    this.noise = this.makeNoise(2);
    this.music = new Music(this);
    this.ducked = false;
    this.ready = true;
    if (this.muted) this.master.gain.value = 0;
    return true;
  }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }
  makeIR(seconds, decay) {
    const rate = this.ctx.sampleRate, len = Math.floor(rate * seconds), buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return buf;
  }
  makeNoise(seconds) {
    const rate = this.ctx.sampleRate, len = Math.floor(rate * seconds), buf = this.ctx.createBuffer(1, len, rate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 1, this.now, 0.05); }
  musicLevel() { return this.music && this.music.mood !== 'calm' ? 0.62 : 0.5; }
  duck(on) { this.ducked = on; if (this.musicBus) this.musicBus.gain.setTargetAtTime(on ? 0.16 : this.musicLevel(), this.now, 0.45); }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); }
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); }

  /* ---- synthesized sound effects ---- */
  noiseSource(t, dur) { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; s.start(t); s.stop(t + dur + 0.05); return s; }
  env(node, t, a, peak, d, end = 0.0008) { node.gain.setValueAtTime(0.0001, t); node.gain.exponentialRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(end, t + a + d); }

  bell(midi, t, vel = 0.5, dur = 1.8, dest = this.musicBus) {
    const ctx = this.ctx, f = midiHz(midi);
    const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = f * 2.76;
    const o3 = ctx.createOscillator(); o3.type = 'triangle'; o3.frequency.value = f * 2;
    const g1 = ctx.createGain(), g2 = ctx.createGain(), g3 = ctx.createGain();
    this.env(g1, t, 0.006, vel * 0.22, dur); this.env(g2, t, 0.004, vel * 0.05, 0.35); this.env(g3, t, 0.004, vel * 0.03, 0.6);
    o1.connect(g1); o2.connect(g2); o3.connect(g3);
    for (const g of [g1, g2, g3]) { g.connect(dest); g.connect(this.reverb); }
    o1.start(t); o2.start(t); o3.start(t); o1.stop(t + dur + 0.2); o2.stop(t + 0.6); o3.stop(t + 0.9);
  }
  ping(midi) { if (!this.ready) return; this.bell(midi || pick([81, 83, 86, 88, 90, 93]), this.now, 0.3, 1.2, this.sfxBus); }
  twinkle() { if (!this.ready) return; const t = this.now; this.bell(93, t, 0.22, 1.4, this.sfxBus); this.bell(98, t + 0.12, 0.16, 1.2, this.sfxBus); }

  extinguish() {
    if (!this.ready) return;
    const ctx = this.ctx, t = this.now;
    const n = this.noiseSource(t, 0.9);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.7; bp.frequency.setValueAtTime(1100, t); bp.frequency.exponentialRampToValueAtTime(220, t + 0.7);
    const g = ctx.createGain(); this.env(g, t, 0.03, 0.5, 0.75);
    n.connect(bp).connect(g).connect(this.sfxBus); g.connect(this.reverb);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(50, t + 0.35);
    const og = ctx.createGain(); this.env(og, t, 0.01, 0.35, 0.35); o.connect(og).connect(this.sfxBus); o.start(t); o.stop(t + 0.5);
    // falling sparkle
    [88, 84, 79].forEach((m, i) => this.bell(m, t + 0.25 + i * 0.13, 0.18, 1.0, this.sfxBus));
  }

  celebrate() {
    if (!this.ready) return;
    const t = this.now;
    [62, 66, 69, 74, 78, 81, 86, 90].forEach((m, i) => this.bell(m, t + i * 0.085, 0.55, 1.6, this.sfxBus));
    [93, 98].forEach((m, i) => this.bell(m, t + 0.75 + i * 0.1, 0.35, 2.2, this.sfxBus));
    const n = this.noiseSource(t, 1.6);
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000;
    const g = this.ctx.createGain(); this.env(g, t, 0.2, 0.07, 1.3);
    n.connect(hp).connect(g).connect(this.sfxBus);
  }

  whoosh(dur = 2.6) {
    if (!this.ready) return;
    const ctx = this.ctx, t = this.now;
    const n = this.noiseSource(t, dur);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(180, t); bp.frequency.exponentialRampToValueAtTime(3200, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + dur * 0.55); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    n.connect(bp).connect(g).connect(this.sfxBus); g.connect(this.reverb);
  }

  swell(dur = 3.2) {
    if (!this.ready) return;
    const ctx = this.ctx, t = this.now;
    [0, 7, 12].forEach((semi, i) => {
      const o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(midiHz(50 + semi), t); o.frequency.exponentialRampToValueAtTime(midiHz(74 + semi), t + dur);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12 / (i + 1), t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0008, t + dur + 0.6);
      o.connect(g).connect(this.sfxBus); g.connect(this.reverb); o.start(t); o.stop(t + dur + 0.7);
    });
  }

  pop() {
    if (!this.ready) return;
    const ctx = this.ctx, t = this.now;
    const n = this.noiseSource(t, 0.5);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = ctx.createGain(); this.env(g, t, 0.004, 0.35, 0.45);
    n.connect(lp).connect(g).connect(this.sfxBus); g.connect(this.reverb);
    for (let i = 0; i < 6; i++) this.bell(pick([86, 88, 90, 93, 95, 98]), t + 0.12 + i * rand(0.04, 0.1), 0.12, 0.7, this.sfxBus);
  }

  thump() {
    if (!this.ready) return;
    const ctx = this.ctx, t = this.now;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.22);
    const g = ctx.createGain(); this.env(g, t, 0.005, 0.6, 0.28); o.connect(g).connect(this.sfxBus); o.start(t); o.stop(t + 0.4);
    const n = this.noiseSource(t, 0.05); const ng = ctx.createGain(); this.env(ng, t, 0.002, 0.15, 0.04); n.connect(ng).connect(this.sfxBus);
    this.bell(86, t + 0.05, 0.25, 1.4, this.sfxBus);
  }
}

/* ------------------------------------------------------------------- music */
class Music {
  constructor(e) {
    this.e = e; this.ctx = e.ctx;
    this.chords = [[50, 57, 62, 66], [47, 54, 59, 62], [55, 59, 62, 67], [57, 61, 64, 69]];
    this.melodies = [[74, 78, 81, 78, 86, 81, 78, 74], [74, 78, 83, 78, 86, 83, 78, 74], [74, 79, 83, 79, 86, 83, 79, 74], [76, 81, 85, 81, 88, 85, 81, 76]];
    this.step = 0; this.stepDur = 0.5; this.nextTime = 0; this.mood = 'calm'; this.started = false;
    this.padOut = this.ctx.createGain(); this.padOut.gain.value = 0.16; this.padOut.connect(e.musicBus); this.padOut.connect(e.reverb);
    this.bellOut = this.ctx.createGain(); this.bellOut.gain.value = 0.55; this.bellOut.connect(e.musicBus);
  }
  start() {
    if (this.started) return; this.started = true;
    this.nextTime = this.ctx.currentTime + 0.15;
    this.e.musicBus.gain.setTargetAtTime(this.e.musicLevel(), this.ctx.currentTime, 2.5);
    this.timer = setInterval(() => this.schedule(), 180);
    this.schedule();
  }
  stop() { clearInterval(this.timer); this.started = false; }
  setMood(m) { this.mood = m; if (!this.e.ducked) this.e.musicBus.gain.setTargetAtTime(this.e.musicLevel(), this.ctx.currentTime, 1.5); }
  schedule() {
    if (this.ctx.state !== 'running') return;
    while (this.nextTime < this.ctx.currentTime + 0.7) {
      if (this.nextTime > this.ctx.currentTime - 0.5) this.playStep(this.step, this.nextTime);
      this.step++; this.nextTime += this.stepDur;
    }
  }
  playStep(step, t) {
    const ci = Math.floor(step / 8) % 4, s = step % 8;
    if (s === 0) this.pad(this.chords[ci], t, 4.3);
    const mel = this.melodies[ci];
    const joy = this.mood !== 'calm';
    const playProb = joy ? 0.92 : 0.62;
    if (Math.random() < playProb) this.e.bell(mel[s] + (joy && s % 4 === 2 ? 12 : 0), t, rand(0.35, 0.75), 2.0, this.bellOut);
    if (joy && s % 2 === 1 && Math.random() < 0.6) this.e.bell(mel[(s + 3) % 8] + 12, t + this.stepDur / 2, rand(0.2, 0.4), 1.4, this.bellOut);
    if (step % 16 === 12 && Math.random() < 0.8) this.e.bell(pick([93, 95, 98]), t + 0.25, 0.28, 2.5, this.bellOut);
  }
  pad(notes, t, dur) {
    const ctx = this.ctx;
    for (const m of notes) {
      for (const det of [-6, 6]) {
        const o = ctx.createOscillator(); o.type = det < 0 ? 'triangle' : 'sine'; o.frequency.value = midiHz(m); o.detune.value = det;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 720; lp.Q.value = 0.4;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5, t + 1.3); g.gain.setValueAtTime(0.5, t + dur - 1.6); g.gain.exponentialRampToValueAtTime(0.0005, t + dur);
        o.connect(lp).connect(g).connect(this.padOut); o.start(t); o.stop(t + dur + 0.1);
      }
    }
  }
}

/* --------------------------------------------------------- blow detector */
/* Real microphone breath detection: RMS level against a calibrated ambient floor, sustained for a
   minimum hold time, gated by spectral flatness so tonal speech is less likely to count. */
export class BlowDetector {
  constructor(engine) {
    this.engine = engine;
    this.cfg = {
      calibrate: 1.0,                                   // seconds of ambient sampling
      hold: (Number(params.get('hold')) || 320) / 1000, // sustained seconds above threshold
      minLevel: Number(params.get('blow')) || 0.045,    // absolute RMS floor for a blow
      ambientMul: Number(params.get('mul')) || 3.2,     // threshold = ambient * mul
      strong: Number(params.get('strong')) || 0.2,      // RMS that always counts, regardless of flatness
      flat: Number(params.get('flat')) || 0.16,         // spectral flatness gate (noise-like input)
    };
    this.running = false; this.bytes = new Uint8Array(64); this.level = 0; this.progress = 0; this.phase = 'idle';
  }
  async start({ onLevel } = {}) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('getUserMedia unavailable');
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
    const ctx = this.engine.ctx;
    await ctx.resume().catch(() => {});
    this.source = ctx.createMediaStreamSource(this.stream);
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048; this.analyser.smoothingTimeConstant = 0.35;
    this.source.connect(this.analyser); // analysis only; never routed to the speakers or anywhere else
    this.time = new Float32Array(this.analyser.fftSize);
    this.freq = new Float32Array(this.analyser.frequencyBinCount);
    this.bytes = new Uint8Array(this.analyser.frequencyBinCount);
    this.onLevel = onLevel;
    this.samples = []; this.ambient = null; this.hold = 0; this.t0 = performance.now(); this.last = this.t0;
    this.running = true; this.phase = 'calibrating';
    return new Promise((resolve) => { this.resolve = resolve; this.loop(); });
  }
  loop() {
    if (!this.running) return;
    requestAnimationFrame(() => this.loop());
    const now = performance.now(), dt = Math.min(0.1, (now - this.last) / 1000); this.last = now;
    const an = this.analyser, cfg = this.cfg;
    an.getFloatTimeDomainData(this.time);
    let sum = 0; for (let i = 0; i < this.time.length; i++) sum += this.time[i] * this.time[i];
    const rms = Math.sqrt(sum / this.time.length);
    an.getFloatFrequencyData(this.freq);
    an.getByteFrequencyData(this.bytes);
    const binHz = this.engine.ctx.sampleRate / an.fftSize;
    const b0 = Math.max(1, Math.round(80 / binHz)), b1 = Math.min(this.freq.length - 1, Math.round(4000 / binHz));
    let logSum = 0, linSum = 0, n = 0;
    for (let b = b0; b <= b1; b++) { const p = Math.pow(10, this.freq[b] / 10) + 1e-12; logSum += Math.log(p); linSum += p; n++; }
    const flat = Math.exp(logSum / n) / (linSum / n);
    this.level = rms;
    const elapsed = (now - this.t0) / 1000;
    if (elapsed < cfg.calibrate) { this.samples.push(rms); this.progress = 0; if (this.onLevel) this.onLevel(rms, 0, 'calibrating'); return; }
    if (this.ambient == null) {
      const s = this.samples.slice().sort((a, b) => a - b);
      this.ambient = s[Math.floor(s.length * 0.8)] || 0;
      this.threshold = Math.max(cfg.minLevel, this.ambient * cfg.ambientMul + 0.012);
      this.phase = 'listening';
    }
    const over = rms > this.threshold;
    const noisy = flat > cfg.flat || rms > cfg.strong;
    if (over && noisy) this.hold += dt; else this.hold = Math.max(0, this.hold - dt * 1.6);
    this.progress = clamp(this.hold / cfg.hold, 0, 1);
    if (this.onLevel) this.onLevel(rms, this.progress, 'listening', { flat, threshold: this.threshold });
    if (this.hold >= cfg.hold) { const r = this.resolve; this.stop(); if (r) r(true); }
  }
  stop() {
    this.running = false; this.phase = 'idle';
    try { if (this.source) this.source.disconnect(); } catch (e) {}
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null; this.source = null;
  }
}
