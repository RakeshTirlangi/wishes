import { wait } from './util.js';

const $ = (id) => document.getElementById(id);

export const ui = {
  show(id) { $(id).classList.add('show'); },
  hide(id) { $(id).classList.remove('show'); },

  subtitle(text) {
    const box = $('subtitle'), span = box.querySelector('span');
    if (!text) { box.classList.remove('show'); return; }
    span.textContent = text; box.classList.add('show');
  },

  /* Center text that fades in, holds, fades out. */
  async message(text, holdMs = 3200, id = 'message') {
    const el = $(id);
    el.textContent = text; el.classList.add('show');
    await wait(holdMs);
    el.classList.remove('show');
    await wait(600);
  },

  waitClick(id) { return new Promise((res) => $(id).addEventListener('click', () => res(), { once: true })); },

  listenText(text) { $('listenText').textContent = text; },
  fallback(visible) { $('fallback').hidden = !visible; },
  ring(progress) { $('ringFill').style.strokeDashoffset = String(276.5 * (1 - progress)); $('ringIcon').textContent = progress > 0.05 ? '💨' : '🌬️'; },

  drawWave(bytes, level, phase) {
    const c = $('wave'), g = c.getContext('2d'), W = c.width, H = c.height;
    g.clearRect(0, 0, W, H);
    const bars = 36, step = Math.max(1, Math.floor(Math.min(bytes.length, 200) / bars));
    const grad = g.createLinearGradient(0, 0, W, 0); grad.addColorStop(0, '#c9b8ff'); grad.addColorStop(0.5, '#fff1c8'); grad.addColorStop(1, '#ffb3d1');
    g.fillStyle = grad;
    for (let i = 0; i < bars; i++) {
      let v = 0; for (let k = 0; k < step; k++) v = Math.max(v, bytes[i * step + k] || 0);
      let h = (v / 255) * (H - 8);
      if (phase === 'calibrating') h = 3 + Math.sin(performance.now() / 180 + i * 0.5) * 2;
      h = Math.max(2, h);
      const x = (i / bars) * W + 2, w = W / bars - 4;
      g.beginPath(); g.roundRect(x, H / 2 - h / 2, w, h, 3); g.fill();
    }
  },

  async showFinal(replayHandler) {
    $('final').classList.add('show');
    const msgs = $('final').querySelectorAll('.msg');
    await wait(1800);
    for (const m of msgs) { m.classList.add('in'); await wait(2400); }
    await wait(1200);
    $('closing').classList.add('in');
    await wait(4000);
    const r = $('replay'); r.hidden = false; r.onclick = replayHandler;
  },
  resetFinal() {
    $('final').classList.remove('show');
    $('final').querySelectorAll('.msg').forEach((m) => m.classList.remove('in'));
    $('closing').classList.remove('in'); $('replay').hidden = true;
  },
};
