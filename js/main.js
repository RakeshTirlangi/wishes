import { tweens, params, pacing } from './util.js';
import { Scene } from './scene.js';
import { Confetti } from './confetti.js';
import { AudioEngine } from './audio.js';
import { Director } from './director.js';
import { ui } from './ui.js';

const fast = Number(params.get('fast'));
if (fast > 0) pacing.speed = fast;

function boot() {
  const scene = new Scene(document.getElementById('world'));
  const confetti = new Confetti(document.getElementById('overlay'));
  const audio = new AudioEngine();
  const director = new Director({ scene, confetti, audio });
  window.__scene = { scene, director, audio }; // handy for testing in devtools

  const muteBtn = document.getElementById('mute');
  let muted = false;
  muteBtn.addEventListener('click', () => {
    muted = !muted; audio.setMuted(muted);
    muteBtn.textContent = muted ? '🔇' : '🔊'; muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
  });

  let last = performance.now(), t = 0, running = true, raf = 0;
  const frame = (now) => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now; t += dt;
    tweens.update(dt);
    scene.update(dt, t);
    confetti.update(dt, t);
  };
  window.addEventListener('resize', () => { scene.resize(); confetti.resize(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { running = false; cancelAnimationFrame(raf); audio.suspend(); }
    else { running = true; last = performance.now(); audio.resume(); raf = requestAnimationFrame(frame); }
  });
  scene.update(0.016, 0);
  raf = requestAnimationFrame(frame);

  ui.hide('loading');
  if (params.get('to')) document.querySelector('#start .eyebrow').textContent = `For ${params.get('to')}, who is very special`;
  setTimeout(() => ui.show('start'), 300);
  const begin = document.getElementById('begin');
  begin.addEventListener('click', () => { begin.disabled = true; director.begin().catch((e) => console.error(e)); }, { once: true });
  if (params.get('auto') === '1') setTimeout(() => begin.click(), 600);
}

// let the loading screen paint before the scene is generated
const go = () => setTimeout(boot, 60);
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go); else go();
