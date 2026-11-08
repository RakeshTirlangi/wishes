import * as THREE from 'three';
import { isMobile, clamp, lerp, rand, tweens, ease, noise1 } from './util.js';
import { Particles, glowTexture, smokeTexture, sparkleTexture, cloudTexture, makeCanvas, canvasTexture } from './sprites.js';

const FLAME_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FLAME_FRAG = `
precision highp float;
uniform float uTime; uniform float uSeed; uniform float uIntensity; varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
void main(){
  vec2 p = vUv * 2.0 - 1.0;
  float yy = vUv.y;
  float n = noise(vec2(p.x * 2.0 + uSeed * 7.0, yy * 4.0 - uTime * 3.2 + uSeed * 3.0));
  float n2 = noise(vec2(p.x * 5.0 - uSeed * 5.0, yy * 9.0 - uTime * 6.5));
  float wob = (n - 0.5) * 0.55 * yy + (n2 - 0.5) * 0.18 * yy;
  float x = p.x + wob;
  float width = mix(0.62, 0.04, pow(yy, 0.85)) * (0.85 + 0.15 * uIntensity);
  float d = abs(x) / width;
  float vert = smoothstep(0.0, 0.1, yy) * smoothstep(1.0, 0.72, yy);
  float body = (1.0 - smoothstep(0.55, 1.0, d)) * vert;
  float core = (1.0 - smoothstep(0.0, 0.55, d)) * smoothstep(0.04, 0.35, yy) * smoothstep(0.92, 0.35, yy);
  vec3 col = mix(vec3(1.0, 0.32, 0.04), vec3(1.0, 0.82, 0.32), body);
  col = mix(col, vec3(1.0, 0.98, 0.85), core);
  float blue = (1.0 - smoothstep(0.0, 0.18, yy)) * (1.0 - smoothstep(0.2, 0.9, d));
  col = mix(col, vec3(0.35, 0.55, 1.0), blue * 0.8);
  float a = clamp(body * 1.15, 0.0, 1.0) * uIntensity;
  gl_FragColor = vec4(col * a, a);
}`;

function stripeTexture(colorA, colorB) {
  const c = makeCanvas(64, 64), g = c.getContext('2d');
  g.fillStyle = colorA; g.fillRect(0, 0, 64, 64);
  g.fillStyle = colorB;
  for (let i = -64; i < 128; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 8, 0); g.lineTo(i + 8 + 24, 64); g.lineTo(i + 24, 64); g.closePath(); g.fill(); }
  const t = canvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2); return t;
}

function heartShape(s = 1) {
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.55 * s);
  sh.bezierCurveTo(-0.9 * s, 0.1 * s, -0.55 * s, 0.95 * s, 0, 0.45 * s);
  sh.bezierCurveTo(0.55 * s, 0.95 * s, 0.9 * s, 0.1 * s, 0, -0.55 * s);
  return sh;
}

export class Cake {
  constructor(world) {
    this.world = world;
    this.group = new THREE.Group();
    this.lit = 1;
    this.smokeT = 0;
    this.flames = [];
    this.build();
    world.add(this.group);
  }

  build() {
    const g = this.group;
    const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.02, ...extra });
    const gold = new THREE.MeshStandardMaterial({ color: 0xf2c56a, roughness: 0.28, metalness: 0.85 });

    // cloud bed
    const cloudTex = cloudTexture(256);
    for (let i = 0; i < 10; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: 0xd9ccff, transparent: true, opacity: 0.55, depthWrite: false }));
      const a = (i / 10) * Math.PI * 2;
      s.position.set(Math.cos(a) * rand(1.5, 4.5), -1.2 + rand(-0.4, 0.4), Math.sin(a) * rand(1.5, 4.5));
      s.scale.set(rand(7, 10), rand(3.5, 5), 1);
      g.add(s);
    }
    // plate
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 4.9, 0.28, 72), std(0xece6ff, { roughness: 0.35, metalness: 0.15 }));
    plate.position.y = 0.14; g.add(plate);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(5.15, 0.09, 12, 90), gold);
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.29; g.add(rim);

    const tier = (r, h, y, color, icing) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 72), std(color));
      m.position.y = y + h / 2; g.add(m);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.1, r + 0.1, 0.3, 72), std(icing, { roughness: 0.45 }));
      top.position.y = y + h + 0.15; g.add(top);
      const drip = new THREE.Mesh(new THREE.TorusGeometry(r + 0.02, 0.2, 14, 72), std(icing, { roughness: 0.45 }));
      drip.rotation.x = Math.PI / 2; drip.position.y = y + h - 0.02; g.add(drip);
      // scalloped drips
      for (let i = 0; i < 14; i++) {
        const a = (i / 14) * Math.PI * 2;
        const d = new THREE.Mesh(new THREE.SphereGeometry(rand(0.16, 0.26), 14, 10), std(icing, { roughness: 0.45 }));
        d.position.set(Math.cos(a) * (r + 0.05), y + h - rand(0.25, 0.6), Math.sin(a) * (r + 0.05));
        d.scale.y = 1.6; g.add(d);
      }
      return y + h + 0.3;
    };
    const t1 = tier(3.6, 2.1, 0.28, 0xf7b9d2, 0xfff2e4);
    const t2 = tier(2.5, 1.9, t1, 0xf9cde0, 0xfff5ea);
    this.topY = t2;

    // pearls along tier bases and hearts on tier 1
    const pearl = new THREE.SphereGeometry(0.14, 14, 10);
    const white = std(0xfff8f0, { roughness: 0.25, metalness: 0.2 });
    for (let i = 0; i < 30; i++) { const a = (i / 30) * Math.PI * 2; const p = new THREE.Mesh(pearl, i % 2 ? gold : white); p.position.set(Math.cos(a) * 3.65, 0.42, Math.sin(a) * 3.65); g.add(p); }
    for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2; const p = new THREE.Mesh(pearl, i % 2 ? gold : white); p.position.set(Math.cos(a) * 2.55, t1 + 0.12, Math.sin(a) * 2.55); g.add(p); }
    const heartGeo = new THREE.ExtrudeGeometry(heartShape(0.26), { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3;
      const h = new THREE.Mesh(heartGeo, std(i % 2 ? 0xff7fa6 : 0xffd27a, { roughness: 0.4 }));
      h.position.set(Math.cos(a) * 3.15, t1 + 0.18, Math.sin(a) * 3.15);
      h.rotation.x = -Math.PI / 2; h.rotation.z = -a + Math.PI / 2; g.add(h);
    }
    // sprinkles on the sides
    const sprinkleGeo = new THREE.SphereGeometry(0.07, 8, 6);
    const sprinkleCols = [0xffffff, 0xffd27a, 0xc9b8ff, 0x9fe3ff, 0xffb3d1];
    for (let i = 0; i < 70; i++) {
      const a = rand(Math.PI * 2), big = i % 2 === 0;
      const r = big ? 3.62 : 2.52, y = big ? rand(0.5, 2.1) : rand(t1 + 0.3, t1 + 1.7);
      const s = new THREE.Mesh(sprinkleGeo, std(sprinkleCols[i % sprinkleCols.length], { roughness: 0.3 }));
      s.position.set(Math.cos(a) * r, y, Math.sin(a) * r); g.add(s);
    }

    // candles
    const colors = [['#ffd1dc', '#fff6f8'], ['#cde7ff', '#f4faff'], ['#fff2b3', '#fffbe6'], ['#d9ffd1', '#f3fff0'], ['#e8d1ff', '#f9f3ff'], ['#ffe0c2', '#fff7ef'], ['#c8f7f0', '#effffd']];
    this.candleTop = this.topY + 1.3;
    const flameGeo = new THREE.PlaneGeometry(0.62, 1.15);
    const glowTex = glowTexture(128, 'rgba(255,200,120,1)', 'rgba(255,150,60,0.35)');
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * 1.45, z = Math.sin(a) * 1.45;
      const cm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.3, 18), new THREE.MeshStandardMaterial({ map: stripeTexture(colors[i][0], colors[i][1]), roughness: 0.5 }));
      cm.position.set(x, this.topY + 0.65, z); g.add(cm);
      const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.18, 6), std(0x2a2020));
      wick.position.set(x, this.candleTop + 0.07, z); g.add(wick);
      const mat = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uSeed: { value: rand(10) }, uIntensity: { value: 1 } },
        vertexShader: FLAME_VERT, fragmentShader: FLAME_FRAG, transparent: true, depthWrite: false,
        blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
      });
      const flame = new THREE.Mesh(flameGeo, mat);
      flame.position.set(x, this.candleTop + 0.62, z);
      flame.renderOrder = 5;
      g.add(flame);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb060, transparent: true, blending: THREE.AdditiveBlending, opacity: 0.55, depthWrite: false }));
      glow.scale.set(2.2, 2.2, 1); glow.position.set(x, this.candleTop + 0.55, z); glow.renderOrder = 4; g.add(glow);
      this.flames.push({ mesh: flame, mat, glow, x, z, seed: rand(100) });
    }
    this.light = new THREE.PointLight(0xffb366, 38, 30, 2);
    this.light.position.set(0, this.candleTop + 1.2, 0);
    g.add(this.light);
    this.fill = new THREE.PointLight(0xffc48a, 10, 20, 2);
    this.fill.position.set(0, this.topY - 1, 4);
    g.add(this.fill);

    // sparkles & smoke
    this.sparkles = new Particles(70, sparkleTexture(64), { blending: THREE.AdditiveBlending, fade: 'inout' });
    this.sparkles.mesh.renderOrder = 3;
    this.smoke = new Particles(isMobile ? 220 : 320, smokeTexture(128), { gravity: 0.12, drag: 0.985, swayAmp: 0.5, fade: 'inout' });
    this.smoke.mesh.renderOrder = 6;
    g.add(this.sparkles.mesh, this.smoke.mesh);
    // soft shadow under the plate
    const sh = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(128, 'rgba(0,0,0,0.5)', 'rgba(0,0,0,0.2)'), color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
    sh.scale.set(13, 6, 1); sh.position.y = -0.3; g.add(sh);
  }

  /* World-space point the camera should frame for the candles. */
  get flamePoint() { return new THREE.Vector3(0, this.candleTop + 0.5, 0); }

  async extinguish() {
    const from = this.lit;
    this.smokeT = 4.2;
    await tweens.add(0.28, (t) => { this.lit = lerp(from, 0, t); }, ease.outCubic);
  }

  relight() { this.lit = 1; this.smokeT = 0; }

  update(dt, t, camera) {
    const lit = this.lit;
    for (const f of this.flames) {
      const flick = 0.82 + 0.18 * (0.5 + 0.5 * noise1(t * 9 + f.seed, f.seed)) + 0.06 * Math.sin(t * 23 + f.seed);
      f.mat.uniforms.uTime.value = t;
      f.mat.uniforms.uIntensity.value = lit * flick;
      f.mesh.quaternion.copy(camera.quaternion);
      f.mesh.scale.set(1, 0.92 + 0.12 * flick, 1);
      f.glow.material.opacity = 0.55 * lit * flick;
    }
    const flick = 0.88 + 0.12 * (0.5 + 0.5 * noise1(t * 7, 42));
    this.light.intensity = 38 * lit * flick;
    this.fill.intensity = 10 * lit;

    // smoke after extinguishing
    if (this.smokeT > 0) {
      this.smokeT -= dt;
      const rate = this.smokeT > 3.4 ? 2 : 1;
      for (const f of this.flames) for (let q = 0; q < rate; q++) if (Math.random() < 0.55)
        this.smoke.emit(f.x + rand(-0.05, 0.05), this.candleTop + 0.25, f.z + rand(-0.05, 0.05), { vx: rand(-0.12, 0.12), vy: rand(0.75, 1.15), vz: rand(-0.12, 0.12), ttl: rand(2.4, 3.8), size0: 0.12, size1: rand(0.9, 1.4), alpha: 0.32, spin: rand(-0.6, 0.6), rot: rand(6), r: 0.78, g: 0.75, b: 0.88, sway: rand(10) });
    }
    this.smoke.update(dt, t);

    // ambient sparkles around the cake
    if (this.sparkles.count < this.sparkles.max && Math.random() < 0.5) {
      const a = rand(Math.PI * 2), r = rand(2.5, 6.5);
      const col = [[1, 0.9, 0.6], [1, 0.75, 0.85], [0.9, 0.85, 1], [1, 1, 1]][Math.floor(rand(4))];
      this.sparkles.emit(Math.cos(a) * r, rand(0.2, this.candleTop + 1.5), Math.sin(a) * r, { vy: rand(0.1, 0.35), ttl: rand(1.4, 2.8), size0: rand(0.15, 0.4), size1: rand(0.1, 0.3), alpha: rand(0.5, 1), spin: rand(-1, 1), r: col[0], g: col[1], b: col[2] });
    }
    this.sparkles.update(dt, t);
  }
}
