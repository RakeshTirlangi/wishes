import * as THREE from 'three';
import { isMobile, clamp, lerp, rand } from './util.js';
import { Particles, glowTexture } from './sprites.js';

const SKY_VERT = `varying vec3 vDir; void main(){ vDir = (modelMatrix * vec4(position,1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const SKY_FRAG = `
precision highp float;
uniform float uTime; uniform float uBright; varying vec3 vDir;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<OCT;i++){ v+=a*noise(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return v; }
void main(){
  vec3 d = normalize(vDir);
  float h = d.y*0.5+0.5;
  vec3 bottom = vec3(0.20,0.10,0.34);
  vec3 mid = vec3(0.07,0.09,0.27);
  vec3 top = vec3(0.02,0.03,0.11);
  vec3 col = mix(bottom, mid, smoothstep(0.22,0.55,h));
  col = mix(col, top, smoothstep(0.62,1.0,h));
  vec2 uv = vec2(atan(d.z,d.x)*1.2, d.y*2.5);
  float n1 = fbm(uv*1.5 + uTime*0.01);
  float n2 = fbm(uv*2.5 - uTime*0.013 + 5.0);
  float n3 = fbm(uv*3.0 + 2.0 + uTime*0.008);
  vec3 pink = vec3(0.95,0.45,0.75), violet = vec3(0.55,0.42,0.95), gold = vec3(1.0,0.82,0.55);
  col += pink * smoothstep(0.52,0.85,n1) * 0.34 * (1.0-h*0.5);
  col += violet * smoothstep(0.50,0.82,n2) * 0.30;
  col += gold * smoothstep(0.60,0.90,n3) * 0.14 * (1.0-h);
  float c = fbm(vec2(uv.x*2.0, d.y*8.0) + uTime*0.02);
  col += vec3(0.55,0.5,0.75) * smoothstep(0.55,0.8,c) * smoothstep(0.5,0.0,abs(d.y-0.05)) * 0.22;
  col = mix(col, col*1.55 + vec3(0.14,0.11,0.24), uBright);
  gl_FragColor = vec4(col, 1.0);
}`;

const BG_VERT = `attribute float aPhase; attribute float aSize; uniform float uTime; uniform float uPixelRatio; varying float vA;
void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); float tw = 0.55 + 0.45*sin(uTime*(1.2+aPhase*0.7)+aPhase*20.0); vA = tw; gl_PointSize = aSize * uPixelRatio * (0.7+0.3*tw); gl_Position = projectionMatrix*mv; }`;
const BG_FRAG = `varying float vA; void main(){ vec2 p = gl_PointCoord-0.5; float d = length(p); float a = smoothstep(0.5,0.1,d); gl_FragColor = vec4(1.0,0.97,0.9, a*vA); }`;

export class World {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);
    this.rig = { pos: new THREE.Vector3(0, 12, 75), look: new THREE.Vector3(0, 14, -30), fov: 55, swayAmp: 1 };
    this.parallax = new THREE.Vector2();
    this.parallaxTarget = new THREE.Vector2();
    this.time = 0;
    this.bright = 0;
    this.updaters = [];
    this.buildSky();
    this.buildBackgroundStars();
    this.buildDust();
    this.buildLights();
    this.bindParallax();
    this.resize();
  }

  buildSky() {
    this.skyMat = new THREE.ShaderMaterial({ defines: { OCT: isMobile ? 3 : 4 }, uniforms: { uTime: { value: 0 }, uBright: { value: 0 } }, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 32), this.skyMat);
    sky.frustumCulled = false;
    this.scene.add(sky);
  }

  buildBackgroundStars() {
    const n = isMobile ? 1200 : 2200;
    const pos = new Float32Array(n * 3), phase = new Float32Array(n), size = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = rand(), v = rand();
      const th = u * Math.PI * 2, ph = Math.acos(2 * v - 1);
      const r = 440;
      let y = r * Math.cos(ph);
      if (y < -60) y = -y * 0.3; // few stars below horizon
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = y; pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      phase[i] = rand(); size[i] = rand(1.2, 3.2);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    this.bgMat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uPixelRatio: { value: this.renderer.getPixelRatio() } }, vertexShader: BG_VERT, fragmentShader: BG_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const pts = new THREE.Points(g, this.bgMat);
    pts.frustumCulled = false;
    this.scene.add(pts);
  }

  buildDust() {
    this.dust = new Particles(isMobile ? 220 : 400, glowTexture(64), { blending: THREE.AdditiveBlending, fade: 'inout', drag: 1 });
    this.scene.add(this.dust.mesh);
  }

  buildLights() {
    this.hemi = new THREE.HemisphereLight(0x9a8cff, 0x2a1a4a, 0.55);
    this.moonLight = new THREE.DirectionalLight(0xdfe4ff, 1.4);
    this.moonLight.position.set(12, 36, 26);
    this.keyLight = new THREE.DirectionalLight(0xffe2c0, 0.5);
    this.keyLight.position.set(-20, 10, 40);
    this.scene.add(this.hemi, this.moonLight, this.keyLight);
  }

  bindParallax() {
    const onMove = (x, y) => {
      this.parallaxTarget.set((x / window.innerWidth - 0.5) * 2, -(y / window.innerHeight - 0.5) * 2);
    };
    window.addEventListener('pointermove', (e) => onMove(e.clientX, e.clientY), { passive: true });
    if (window.DeviceOrientationEvent && typeof DeviceOrientationEvent.requestPermission !== 'function') {
      window.addEventListener('deviceorientation', (e) => {
        if (e.gamma == null) return;
        this.parallaxTarget.set(clamp(e.gamma / 30, -1, 1), clamp((e.beta - 45) / -30, -1, 1));
      }, { passive: true });
    }
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.applyFov();
  }

  applyFov() {
    const a = this.camera.aspect;
    const fov = a >= 1 ? this.rig.fov : clamp(this.rig.fov + (1 - a) * 42, this.rig.fov, this.rig.fov + 34);
    if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
  }

  setBright(v) { this.bright = v; }

  add(...objs) { this.scene.add(...objs); }
  onUpdate(fn) { this.updaters.push(fn); }

  update(dt) {
    this.time += dt;
    const t = this.time;
    this.skyMat.uniforms.uTime.value = t;
    this.skyMat.uniforms.uBright.value = lerp(this.skyMat.uniforms.uBright.value, this.bright, dt * 0.8);
    this.bgMat.uniforms.uTime.value = t;
    this.hemi.intensity = 0.55 + this.skyMat.uniforms.uBright.value * 0.5;

    // dust: keep the volume around the camera populated
    const d = this.dust;
    if (d.count < d.max && Math.random() < 0.6) {
      const c = this.camera.position;
      d.emit(c.x + rand(-45, 45), c.y + rand(-25, 30), c.z + rand(-70, 10), { vx: rand(-0.3, 0.3), vy: rand(0.05, 0.35), vz: rand(-0.2, 0.2), ttl: rand(6, 12), size0: rand(0.08, 0.3), size1: rand(0.1, 0.35), alpha: rand(0.25, 0.7), r: 1, g: rand(0.85, 1), b: rand(0.7, 1), sway: rand(10) });
    }
    d.swayAmp = 0.3;
    d.update(dt, t);

    for (const fn of this.updaters) fn(dt, t);

    // camera: rig + gentle handheld sway + parallax
    this.parallax.lerp(this.parallaxTarget, Math.min(1, dt * 2.5));
    const sw = this.rig.swayAmp;
    const sx = Math.sin(t * 0.37) * 0.35 * sw, sy = Math.sin(t * 0.53 + 1) * 0.25 * sw;
    const cam = this.camera;
    cam.position.set(this.rig.pos.x + sx + this.parallax.x * 0.9 * sw, this.rig.pos.y + sy + this.parallax.y * 0.5 * sw, this.rig.pos.z);
    this._look = this._look || new THREE.Vector3();
    this._look.set(this.rig.look.x + sx * 0.4, this.rig.look.y + sy * 0.4, this.rig.look.z);
    cam.lookAt(this._look);
    this.applyFov();
  }

  render() { this.renderer.render(this.scene, this.camera); }
}
