import * as THREE from 'three';
import { tweens, params, pacing } from './util.js';
import { World } from './world.js';
import { Moon } from './moon.js';
import { Stars } from './stars.js';
import { Cake } from './cake.js';
import { Envelope } from './envelope.js';
import { Confetti } from './confetti.js';
import { AudioEngine } from './audio.js';
import { Director } from './director.js';
import { ui } from './ui.js';

const canvas = document.getElementById('gl');
const fast = Number(params.get('fast'));
if (fast > 0) pacing.speed = fast;

function hasWebGL() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; }
}

function boot() {
  if (!hasWebGL()) { ui.hide('loading'); ui.show('nogl'); return; }
  let world;
  try { world = new World(canvas); } catch (e) { console.error(e); ui.hide('loading'); ui.show('nogl'); return; }
  const moon = new Moon(world); world.add(moon.group);
  const stars = new Stars(world);
  const cake = new Cake(world);
  const envelope = new Envelope(world);
  const confetti = new Confetti(world);
  const audio = new AudioEngine();
  const director = new Director({ world, moon, stars, cake, envelope, confetti, audio });
  window.__scene = { world, moon, stars, cake, envelope, director, audio }; // handy for testing in devtools

  // mute
  const muteBtn = document.getElementById('mute');
  let muted = false;
  muteBtn.addEventListener('click', () => {
    muted = !muted; audio.setMuted(muted); director.narrator.setMuted(muted);
    muteBtn.textContent = muted ? '🔇' : '🔊'; muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
  });

  // render loop
  const clock = new THREE.Clock();
  let running = true, raf = 0;
  const frame = () => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta()) * (pacing.speed > 1 ? 1 : 1);
    const t = world.time + dt;
    tweens.update(dt);
    moon.update(dt, t, world.camera);
    stars.update(dt, t);
    cake.update(dt, t, world.camera);
    envelope.update(dt, t);
    confetti.update(dt, t);
    world.update(dt);
    world.render();
  };
  window.addEventListener('resize', () => world.resize());
  window.addEventListener('orientationchange', () => setTimeout(() => world.resize(), 300));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { running = false; cancelAnimationFrame(raf); audio.suspend(); }
    else { running = true; clock.getDelta(); audio.resume(); frame(); }
  });

  // warm up a couple of frames so the first visible frame is smooth
  world.update(0.016); world.render();
  frame();

  ui.hide('loading');
  const begin = document.getElementById('begin');
  if (params.get('to')) document.querySelector('#start .eyebrow').textContent = `For ${params.get('to')}, who is very special`;
  setTimeout(() => ui.show('start'), 300);
  begin.addEventListener('click', () => {
    begin.disabled = true;
    // iOS only lets speech synthesis start from a tap, so unlock it here with an empty utterance.
    try { if (window.speechSynthesis) window.speechSynthesis.speak(new SpeechSynthesisUtterance('')); } catch (e) {}
    director.begin().catch((e) => console.error(e));
  }, { once: true });
  if (params.get('auto') === '1') setTimeout(() => begin.click(), 600);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
