import { wait, tweens, ease, params, rand } from './util.js';
import { ui } from './ui.js';
import { BlowDetector } from './audio.js';

// Camera shots: the view always contains w x h world units (m caps how far a narrow screen may stretch to fit w).
const SHOT = {
  milky: { cx: 1000, cy: -420, w: 1500, h: 1300 },
  wide: { cx: 1000, cy: 980, w: 2400, h: 1950 },
  moon: { cx: 1000, cy: 690, w: 560, h: 700 },
  reflect: { cx: 1000, cy: 1300, w: 1300, h: 1150 },
  cake: { cx: 1000, cy: 1830, w: 560, h: 620, m: 3 },
  candles: { cx: 1000, cy: 1835, w: 320, h: 360, m: 3 },
  celebrate: { cx: 1000, cy: 1180, w: 2200, h: 1850 },
  collect: { cx: 1000, cy: 1180, w: 1900, h: 1750 },
  seal: { cx: 1000, cy: 1530, w: 560, h: 560, m: 2 },
  final: { cx: 1000, cy: 900, w: 3000, h: 2500 },
};

export class Director {
  constructor({ scene, confetti, audio }) {
    Object.assign(this, { scene, confetti, audio });
    this.state = 'BOOT';
    this.auto = params.get('auto') === '1';
  }

  setState(s) { this.state = s; console.log('[scene]', s); }

  cam(shot, dur, easeFn = ease.inOutSine) {
    const c = this.scene.cam, from = { ...c }, to = { m: 1.35, ...shot };
    return tweens.add(dur, (e) => { for (const k of ['cx', 'cy', 'w', 'h', 'm']) c[k] = from[k] + (to[k] - from[k]) * e; }, easeFn);
  }

  async begin() {
    await this.audio.init();
    ui.hide('start');
    document.getElementById('mute').classList.add('show');
    await this.run();
  }

  async run() {
    const { scene, audio } = this;

    /* INTRO: the Milky Way, then down to the moon over the sea */
    this.setState('INTRO');
    scene.setCam(SHOT.milky);
    audio.music.start(); audio.swell(5);
    await wait(1200);
    ui.message('Tonight, the universe has a little secret…', 4200, 'title');
    await wait(2600);
    scene.nextMeteor = 0.4;
    await wait(1600);
    await this.cam(SHOT.wide, 12, ease.inOutSine);
    await wait(1200);

    this.setState('MOON');
    await this.cam(SHOT.moon, 7, ease.inOutCubic);
    await wait(2600);

    /* CAKE REVEAL: follow the moonlight down the water to the pier */
    this.setState('CAKE_REVEAL');
    await this.cam(SHOT.reflect, 6, ease.inOutSine);
    await this.cam(SHOT.cake, 6, ease.inOutSine);
    audio.twinkle();
    await wait(1600);
    await this.cam(SHOT.candles, 4, ease.inOutSine);

    /* WISH INVITATION */
    this.setState('WISH_INVITATION');
    ui.show('wish');
    if (this.auto) setTimeout(() => document.getElementById('mic').click(), 800);
    await ui.waitClick('mic');
    ui.hide('wish');

    /* MICROPHONE LISTENING */
    this.setState('MICROPHONE_LISTENING');
    const detected = await this.listen();
    console.log('[blow]', detected ? 'detected by microphone' : 'manual fallback');

    /* CANDLES EXTINGUISHED */
    this.setState('CANDLES_EXTINGUISHED');
    ui.hide('listen');
    audio.extinguish();
    scene.extinguish();
    await wait(3000);

    /* CELEBRATION: the sky lights up */
    this.setState('CELEBRATION');
    scene.celebrate(); audio.celebrate(); audio.music.setMood('joy');
    this.cam(SHOT.celebrate, 6, ease.inOutCubic);
    await wait(2400);
    await ui.message('You made a wish! ✨ Now let the universe take care of it.', 4200);

    /* STARS COLLECT WISHES */
    this.setState('STARS_COLLECT_WISHES');
    this.cam(SHOT.collect, 4, ease.inOutSine);
    audio.swell(2.5);
    await scene.appearEnvelope();
    await wait(600);
    ui.message('Every little star carries one of your wishes…', 4400);
    let last = 0;
    await scene.collect({ stagger: 0.05, dur: 2.7, onArrive: () => { const n = performance.now(); if (n - last > 140) { last = n; audio.ping(); } } });

    /* ENVELOPE SEALED */
    this.setState('ENVELOPE_SEALED');
    await this.cam(SHOT.seal, 3, ease.inOutSine);
    await scene.sealEnvelope();
    audio.thump();
    await wait(1800);

    /* ENVELOPE SENT: rises past the moon into the sky, camera follows */
    this.setState('ENVELOPE_SENT');
    audio.whoosh(3.5); audio.swell(6);
    const c = scene.cam, from = { ...c };
    const launch = scene.launchEnvelope(20, (raw) => {
      const k = ease.inOutSine(Math.min(1, raw * 1.6));
      c.w = from.w + (1300 - from.w) * k; c.h = from.h + (1300 - from.h) * k; c.m = 1.35;
      c.cy = from.cy + (scene.env.y + 120 - from.cy) * k;
    });
    await wait(2500);
    for (const m of ['Your wishes are being sent somewhere beyond the stars…', 'To someone special, who can turn your dreams into reality.', 'Until then, keep believing. The universe is listening. ❤️']) await ui.message(m, 3600);
    await launch;
    audio.twinkle();
    await scene.vanishEnvelope();
    await wait(800);

    /* FINAL BIRTHDAY GREETING */
    this.setState('FINAL_BIRTHDAY_GREETING');
    scene.restoreStars();
    this.cam(SHOT.final, 12, ease.inOutSine);
    await wait(2500);
    audio.celebrate(); audio.music.setMood('finale');
    this.confetti.start();
    this.fireworks = true;
    this.fireworkLoop();
    await ui.showFinal(() => this.replay());
  }

  async listen() {
    const detector = new BlowDetector(this.audio);
    ui.listenText("Take a deep breath and blow towards your phone's microphone.");
    ui.fallback(false); ui.ring(0);
    ui.show('listen');
    let detection = null;
    try {
      detection = detector.start({
        onLevel: (level, progress, phase) => {
          ui.drawWave(detector.bytes, level, phase);
          ui.ring(progress);
          if (phase === 'calibrating') ui.listenText('Shh… listening to the night for a moment.');
          else if (progress > 0.3) ui.listenText('Keep going… the flames are flickering!');
          else ui.listenText("Take a deep breath and blow towards your phone's microphone.");
        },
      });
    } catch (e) { detection = null; }
    const armFallback = (text) => { ui.listenText(text); ui.fallback(true); };
    const timer = setTimeout(() => ui.fallback(true), 14000);
    let mic = new Promise(() => {});
    if (detection) mic = detection.then(() => true, (err) => { console.warn('mic unavailable', err); armFallback("The microphone isn't available right now, but the magic still works."); return new Promise(() => {}); });
    else armFallback("This phone can't share its microphone, but the magic still works.");
    if (this.auto) setTimeout(() => { if (detector.running || !detection) document.getElementById('fallback').click(); }, 7000);
    const result = await Promise.race([mic, ui.waitClick('fallback').then(() => false)]);
    clearTimeout(timer);
    detector.stop();
    return result;
  }

  async fireworkLoop() {
    while (this.fireworks) {
      const x = 1000 + rand(-900, 900), y = rand(250, 900);
      this.scene.rocket(x, y, () => this.audio.pop());
      await wait(rand(900, 2200));
    }
  }

  async replay() {
    this.fireworks = false;
    ui.resetFinal();
    this.confetti.stop();
    this.scene.reset();
    this.audio.music.setMood('calm');
    await wait(600);
    this.run();
  }
}
