import * as THREE from 'three';
import { clamp, lerp, rand, tweens, ease } from './util.js';
import { Particles, glowTexture, sparkleTexture } from './sprites.js';

const BEAM_VERT = `varying vec2 vUv; varying float vEdge; void main(){ vUv = uv; vec3 n = normalize(normalMatrix * normal); vEdge = abs(n.z); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const BEAM_FRAG = `
uniform float uTime; uniform float uOn; varying vec2 vUv; varying float vEdge;
void main(){
  float streak = 0.7 + 0.3 * sin(vUv.x * 40.0 + uTime * 3.0) * sin(vUv.y * 30.0 - uTime * 6.0);
  float soft = vEdge * vEdge * vEdge;
  float a = pow(vUv.y, 2.6) * 0.28 * uOn * streak * soft;
  vec3 col = mix(vec3(1.0, 0.72, 0.3), vec3(1.0, 0.95, 0.8), vUv.y);
  gl_FragColor = vec4(col * a, a);
}`;

function heartShape(s = 1) {
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.55 * s);
  sh.bezierCurveTo(-0.9 * s, 0.1 * s, -0.55 * s, 0.95 * s, 0, 0.45 * s);
  sh.bezierCurveTo(0.55 * s, 0.95 * s, 0.9 * s, 0.1 * s, 0, -0.55 * s);
  return sh;
}

export class Envelope {
  constructor(world) {
    this.world = world;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.group.scale.setScalar(0.001);
    this.home = new THREE.Vector3(0, 6.5, -6);
    this.group.position.copy(this.home);
    this.fill = 0;
    this.pulse = 0;
    this.bob = 1;
    this.closed = false;
    this.build();
    world.add(this.group);
  }

  build() {
    const g = this.group, W = (this.W = 3.4), H = (this.H = 2.2), D = (this.D = 0.12);
    const paper = new THREE.MeshStandardMaterial({ color: 0xfbf1d8, roughness: 0.65, metalness: 0 });
    const paperLight = new THREE.MeshStandardMaterial({ color: 0xfff8e6, roughness: 0.6, side: THREE.DoubleSide });
    const inner = new THREE.MeshStandardMaterial({ color: 0xf4d9a6, roughness: 0.7, side: THREE.DoubleSide });
    const goldLine = new THREE.LineBasicMaterial({ color: 0xf5c66b, transparent: true, opacity: 0.9 });

    const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), paper);
    g.add(back);
    // inner golden lining visible through the open top
    const lining = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.1, H - 0.1), inner);
    lining.position.z = -D / 2 + 0.01; g.add(lining);

    // front pocket: left, right, bottom triangles meeting a little below center
    const tri = (pts) => { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath(); return s; };
    const cp = [0, -0.2];
    const shapes = [tri([[-W / 2, H / 2], [-W / 2, -H / 2], cp]), tri([[W / 2, H / 2], [W / 2, -H / 2], cp]), tri([[-W / 2, -H / 2], [W / 2, -H / 2], cp])];
    for (const s of shapes) {
      const m = new THREE.Mesh(new THREE.ShapeGeometry(s), paperLight);
      m.position.z = D / 2 + 0.004; g.add(m);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), goldLine);
      e.position.z = D / 2 + 0.008; g.add(e);
    }
    // flap
    this.flap = new THREE.Group();
    this.flap.position.set(0, H / 2, D / 2 + 0.01);
    const flapMesh = new THREE.Mesh(new THREE.ShapeGeometry(tri([[-W / 2, 0], [W / 2, 0], [0, -H * 0.6]])), paperLight);
    this.flap.add(flapMesh);
    const fe = new THREE.LineSegments(new THREE.EdgesGeometry(flapMesh.geometry), goldLine);
    fe.position.z = 0.004; this.flap.add(fe);
    this.flap.rotation.x = -2.6; // open, folded back
    g.add(this.flap);

    // wax seal
    this.seal = new THREE.Group();
    const wax = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.08, 28), new THREE.MeshStandardMaterial({ color: 0xc0294a, roughness: 0.45, metalness: 0.1 }));
    wax.rotation.x = Math.PI / 2; this.seal.add(wax);
    const heart = new THREE.Mesh(new THREE.ExtrudeGeometry(heartShape(0.24), { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 }), new THREE.MeshStandardMaterial({ color: 0xe8476b, roughness: 0.35, metalness: 0.15 }));
    heart.position.set(0, -0.02, 0.04); this.seal.add(heart);
    this.seal.position.set(0, -0.12, D / 2 + 0.06);
    this.seal.scale.setScalar(0.001);
    g.add(this.seal);

    // glows
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(256, 'rgba(255,230,170,1)', 'rgba(255,200,120,0.35)'), color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending, opacity: 0.3, depthWrite: false }));
    this.glow.scale.set(8, 8, 1); this.glow.position.z = -0.4; g.add(this.glow);
    this.innerGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(128), color: 0xffe9b0, transparent: true, blending: THREE.AdditiveBlending, opacity: 0, depthWrite: false }));
    this.innerGlow.scale.set(2.6, 1.6, 1); this.innerGlow.position.set(0, 0.6, 0.1); g.add(this.innerGlow);
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(256), color: 0xfff1c8, transparent: true, blending: THREE.AdditiveBlending, opacity: 0, depthWrite: false }));
    this.flash.scale.set(1, 1, 1); g.add(this.flash);

    // orbiting sparkles
    this.sparks = new Particles(90, sparkleTexture(64), { blending: THREE.AdditiveBlending, fade: 'inout' });
    this.sparks.mesh.renderOrder = 3;
    g.add(this.sparks.mesh);

    // beam
    this.beamMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uOn: { value: 0 } }, vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor });
    this.beam = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 2.4, 60, 32, 1, true), this.beamMat);
    this.beam.position.y = -30; this.beam.renderOrder = 1; g.add(this.beam);
  }

  async appear() {
    this.group.visible = true;
    this.burst(40);
    await tweens.add(1.3, (t) => { this.group.scale.setScalar(Math.max(0.001, t)); }, ease.outBack);
  }

  absorb() {
    this.fill = Math.min(1, this.fill + 1 / 260);
    this.pulse = 1;
    this.burst(3, 0.6);
  }

  burst(n, speed = 1.2) {
    for (let i = 0; i < n; i++) {
      const a = rand(Math.PI * 2), b = rand(-1, 1);
      this.sparks.emit(0, 0.2, 0.2, { vx: Math.cos(a) * speed * rand(0.5, 1.5), vy: b * speed * rand(0.5, 1.5) + 0.4, vz: Math.sin(a) * speed * rand(0.2, 0.8), ttl: rand(0.6, 1.3), size0: rand(0.2, 0.45), size1: 0.05, alpha: 1, spin: rand(-3, 3), r: 1, g: rand(0.8, 0.95), b: rand(0.4, 0.7) });
    }
  }

  async seal_() {
    this.closed = true;
    const from = this.flap.rotation.x;
    await tweens.add(1.4, (t) => { this.flap.rotation.x = lerp(from, 0, t); }, ease.inOutCubic);
    this.burst(24, 1.6);
    await tweens.add(0.6, (t) => { this.seal.scale.setScalar(Math.max(0.001, t)); }, ease.outBack);
  }

  /* Rise into the sky. onProgress(k) lets the camera follow. */
  async launch(duration, onProgress) {
    this.bob = 0;
    this.beamMat.uniforms.uOn.value = 0;
    tweens.add(1.2, (t) => { this.beamMat.uniforms.uOn.value = t; this.glow.material.opacity = 0.3 + t * 0.5; this.glow.scale.setScalar(8 + t * 4); }, ease.outCubic);
    const from = this.group.position.clone();
    const to = new THREE.Vector3(0, 95, -40);
    await tweens.add(duration, (t, k) => {
      this.group.position.lerpVectors(from, to, t);
      this.group.rotation.z = Math.sin(k * Math.PI * 2) * 0.08;
      if (onProgress) onProgress(k, t);
    }, ease.inCubic);
  }

  async vanish() {
    const s0 = this.group.scale.x;
    this.burst(60, 3);
    await tweens.add(0.9, (t) => {
      this.flash.material.opacity = Math.sin(t * Math.PI);
      this.flash.scale.setScalar(1 + t * 30);
      this.group.scale.setScalar(Math.max(0.001, s0 * (1 - t)));
    }, ease.outCubic);
    this.group.visible = false;
  }

  reset() {
    this.group.visible = false; this.group.scale.setScalar(0.001); this.group.position.copy(this.home); this.group.rotation.set(0, 0, 0);
    this.flap.rotation.x = -2.6; this.seal.scale.setScalar(0.001); this.fill = 0; this.closed = false; this.bob = 1;
    this.beamMat.uniforms.uOn.value = 0; this.glow.material.opacity = 0.3; this.glow.scale.set(8, 8, 1); this.flash.material.opacity = 0; this.flash.scale.setScalar(1);
  }

  update(dt, t) {
    if (!this.group.visible) return;
    const g = this.group;
    if (this.bob) { g.position.y = this.home.y + Math.sin(t * 1.1) * 0.25 * this.bob; g.rotation.y = Math.sin(t * 0.6) * 0.12; g.rotation.z = Math.sin(t * 0.8) * 0.03; }
    this.pulse = Math.max(0, this.pulse - dt * 3);
    this.innerGlow.material.opacity = this.closed ? 0 : clamp(this.fill * 0.9 + this.pulse * 0.6, 0, 1);
    this.innerGlow.scale.set(2.6 + this.pulse, 1.6 + this.pulse * 0.6, 1);
    if (!this.beamMat.uniforms.uOn.value) this.glow.material.opacity = 0.3 + this.fill * 0.35 + this.pulse * 0.25 + Math.sin(t * 2) * 0.05;
    this.beamMat.uniforms.uTime.value = t;
    // ambient orbiting sparkles
    if (this.sparks.count < this.sparks.max - 10 && Math.random() < 0.35) {
      const a = rand(Math.PI * 2), r = rand(2.2, 3.4);
      this.sparks.emit(Math.cos(a) * r, rand(-1.6, 1.8), Math.sin(a) * r * 0.5, { vx: -Math.sin(a) * 0.5, vz: Math.cos(a) * 0.25, vy: rand(-0.1, 0.25), ttl: rand(1.2, 2.4), size0: rand(0.12, 0.3), size1: 0.08, alpha: rand(0.5, 1), spin: rand(-2, 2), r: 1, g: rand(0.85, 0.95), b: rand(0.5, 0.8) });
    }
    this.sparks.update(dt, t);
  }
}
