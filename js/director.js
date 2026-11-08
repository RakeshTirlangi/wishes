import * as THREE from 'three';
import { wait, tweens, tweenVec, ease, params, pacing } from './util.js';
import { ui } from './ui.js';
import { BlowDetector, Narrator } from './audio.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const MOON = V(0, 14, -30);
const LOOK = { cake: V(0, 4.5, 0), starsL: V(-30, 48, -70), starsR: V(30, 44, -70), up: V(0, 90, -40) };

export const LINES = {
  greet: 'Hello, beautiful! Do you know something? Tonight is not an ordinary night. The stars and I have gathered here for someone very special. And that someone is YOU.',
  candles: 'Look at those little candles! Each flame is waiting to carry a beautiful wish from your heart.',
  breathe: 'Put on your earphones, close your eyes, take a deep breath, and make your most beautiful wish.',
  secret: "Don't tell anyone what it is. Some wishes are meant to be whispered only to the universe.",
  yay: 'Yaaaaay! You did it! Look! You made the stars so happy!',
  collect1: "Every little star carries a wish from your heart. I've collected all of them, little one. Now let me send them somewhere magical...",
  collect2: "These aren't ordinary wishes. They're your dreams, your hopes, and all the beautiful things you deserve.",
  sealed: 'Every little wish is safely inside. I have collected them all, just for you.',
  send1: "I'm sending them beyond the clouds, beyond the moon, and beyond all these stars...",
  send2: 'Somewhere special, to someone who can help turn your dreams into reality.',
  final1: "And one last thing... you are someone's favourite reason to smile. Never forget how special you are.",
  final2: 'Keep smiling, keep dreaming, and never stop shining.',
};

export class Director {
  constructor({ world, moon, stars, cake, envelope, confetti, audio }) {
    Object.assign(this, { world, moon, stars, cake, envelope, confetti, audio });
    this.narrator = new Narrator(audio, ui, moon);
    this.state = 'BOOT';
    this.auto = params.get('auto') === '1';
    this.onState = null;
  }

  setState(s) { this.state = s; if (this.onState) this.onState(s); console.log('[scene]', s); }

  /* Camera move: position + look target, in seconds. */
  cam(pos, look, dur, easeFn = ease.inOutSine) {
    return Promise.all([tweenVec(this.world.rig.pos, pos, dur, easeFn), tweenVec(this.world.rig.look, look, dur, easeFn)]);
  }

  async begin() {
    // Audio can only start from a user gesture, so everything audible is created here.
    await this.audio.init();
    await this.narrator.init();
    ui.hide('start');
    document.getElementById('mute').classList.add('show');
    await this.run();
  }

  async run() {
    const { world, moon, stars, cake, envelope, audio } = this;
    const say = (k, o) => this.narrator.say(LINES[k], o);

    /* ---------------- INTRO ---------------- */
    this.setState('INTRO');
    world.rig.pos.set(0, 12, world.camera.aspect < 1 ? 70 : 85); world.rig.look.set(0, 12, -30);
    audio.music.start(); audio.swell(4);
    moon.express('curious'); moon.lookAt(LOOK.starsL);
    const dolly = this.cam(V(0, 11.5, 46), V(0, 13, -30), 11, ease.inOutSine);
    await wait(1200);
    ui.message('Tonight, the universe has a little secret…', 3600, 'title');
    await wait(3000); moon.lookAt(LOOK.starsR);
    await wait(2500); moon.lookAt(null); moon.blinkNow(); moon.express('happy');
    await dolly;

    /* ---------------- MOON GREETING ---------------- */
    this.setState('MOON_GREETING');
    await this.cam(V(0, 13.2, -3), MOON, 5, ease.inOutCubic);
    await wait(500);
    await say('greet');
    moon.nod();

    /* ---------------- CAKE REVEAL ---------------- */
    this.setState('CAKE_REVEAL');
    moon.express('curious'); moon.lookAt(LOOK.cake);
    await wait(900);
    moon.express('happy');
    await this.cam(V(0, 7, 17), V(0, 3.4, 0), 7, ease.inOutCubic);
    await wait(1200);
    audio.twinkle();
    await this.cam(V(0, 7.8, 8), V(0, 5.9, 0), 5.5, ease.inOutSine);
    await wait(900);

    /* ---------------- WISH INVITATION ---------------- */
    this.setState('WISH_INVITATION');
    await say('candles');
    await say('breathe');
    await say('secret');
    ui.show('wish');
    if (this.auto) setTimeout(() => document.getElementById('mic').click(), 800);
    await ui.waitClick('mic');
    ui.hide('wish');

    /* ---------------- MICROPHONE LISTENING ---------------- */
    this.setState('MICROPHONE_LISTENING');
    const detector = new BlowDetector(audio);
    ui.listenText("Take a deep breath and blow towards your phone's microphone.");
    ui.fallback(false); ui.ring(0);
    ui.show('listen');
    this.cam(V(0, 7.4, 6.2), V(0, 6.1, 0), 3.5, ease.inOutSine);
    let detection;
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
      detection.catch(() => {});
    } catch (e) { detection = null; }
    const fallbackClick = ui.waitClick('fallback');
    const armFallback = (text) => { ui.listenText(text); ui.fallback(true); };
    const fallbackTimer = setTimeout(() => ui.fallback(true), 14000);
    let detected = false;
    if (detection) {
      // Permission denied / no device => fallback immediately
      detection = detection.then(() => { detected = true; return true; }, (err) => { console.warn('mic unavailable', err); armFallback("The microphone isn't available right now, but the magic still works."); return new Promise(() => {}); });
    } else {
      armFallback("This phone can't share its microphone, but the magic still works.");
    }
    if (this.auto) setTimeout(() => { if (!detected) document.getElementById('fallback').click(); }, 7000);
    await Promise.race([detection || new Promise(() => {}), fallbackClick]);
    clearTimeout(fallbackTimer);
    detector.stop();
    console.log('[blow]', detected ? 'detected by microphone' : 'manual fallback');

    /* ---------------- CANDLES EXTINGUISHED ---------------- */
    this.setState('CANDLES_EXTINGUISHED');
    ui.hide('listen');
    audio.extinguish();
    cake.extinguish();
    moon.express('surprised');
    await wait(700);
    moon.express('excited');
    await wait(1700);

    /* ---------------- CELEBRATION ---------------- */
    this.setState('CELEBRATION');
    stars.setHappy(1); world.setBright(1);
    moon.express('joy'); moon.hop(4); moon.lookAt(null);
    audio.celebrate(); audio.music.setMood('joy');
    this.cam(V(0, 9.5, 30), V(0, 8, -12), 5.5, ease.inOutCubic);
    await wait(900);
    await say('yay');
    await ui.message('You made a wish! ✨ Now let the universe take care of it.', 3600);

    /* ---------------- STARS COLLECT WISHES ---------------- */
    this.setState('STARS_COLLECT_WISHES');
    moon.express('loving'); moon.lookAt(LOOK.starsR);
    await wait(600);
    say('collect1');
    await wait(2500); moon.lookAt(LOOK.starsL);
    await wait(3000); moon.lookAt(null);
    await wait(4500);
    envelope.appear(); audio.swell(2.5);
    this.cam(V(0, 8.5, 14), V(0, 7.2, -6), 4.5, ease.inOutCubic);
    await say('collect2');
    moon.lookAt(envelope.home); moon.express('happy');
    let lastPing = 0;
    stars.onArrive = () => { envelope.absorb(); const now = performance.now(); if (now - lastPing > 140) { lastPing = now; audio.ping(); } };
    await stars.collect(envelope.home, { stagger: 0.045, dur: 2.7 });

    /* ---------------- ENVELOPE SEALED ---------------- */
    this.setState('ENVELOPE_SEALED');
    this.cam(V(0, 7.2, 5.5), V(0, 6.4, -6), 3, ease.inOutSine);
    await wait(600);
    await envelope.seal_();
    audio.thump();
    moon.express('loving');
    await wait(400);
    await say('sealed');

    /* ---------------- ENVELOPE SENT ---------------- */
    this.setState('ENVELOPE_SENT');
    moon.express('happy'); moon.lookAt(LOOK.up);
    audio.whoosh(3.5); audio.swell(5);
    const camFrom = world.rig.pos.clone(), camTo = V(0, 34, 26);
    const launch = envelope.launch(22, (k) => {
      world.rig.look.lerp(envelope.group.position, 0.12);
      world.rig.pos.lerpVectors(camFrom, camTo, ease.inOutSine(k));
    });
    await wait(1500);
    await say('send1');
    moon.wave();
    await say('send2');
    const msgs = ['Every little star carries one of your wishes...', 'Your wishes are being sent somewhere beyond the stars...', 'To someone special, who can turn your dreams into reality.', 'Until then, keep believing. The universe is listening. ❤️'];
    for (const m of msgs) await ui.message(m, 2900);
    await launch;
    audio.twinkle();
    await envelope.vanish();
    await wait(800);

    /* ---------------- FINAL MESSAGE ---------------- */
    this.setState('FINAL_MESSAGE');
    moon.lookAt(null); moon.express('tender');
    await this.cam(V(0, 14.6, -9), MOON, 5, ease.inOutCubic);
    await wait(600);
    await say('final1');
    moon.express('joy');
    await say('final2');

    /* ---------------- FINAL BIRTHDAY GREETING ---------------- */
    this.setState('FINAL_BIRTHDAY_GREETING');
    stars.restore(); this.confetti.start();
    audio.celebrate(); audio.music.setMood('finale');
    moon.hop(5); moon.express('joy');
    this.cam(V(0, 11, 62), V(0, 10, -22), 14, ease.inOutSine);
    await wait(1200);
    await ui.showFinal(() => this.replay());
  }

  async replay() {
    ui.resetFinal();
    this.confetti.stop();
    this.envelope.reset();
    this.cake.relight();
    this.stars.setHappy(0); this.stars.restore();
    this.world.setBright(0);
    this.audio.music.setMood('calm');
    this.moon.express('neutral');
    await wait(800);
    this.run();
  }
}
