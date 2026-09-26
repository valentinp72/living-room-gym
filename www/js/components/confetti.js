// Confetti bursts (on #confetti, directly in the scene: bursts are placed
// in world space, from the head pose). burst(center, count) throws `count`
// paper pieces up from `center` (THREE.Vector3, world meters); they flutter
// down, land flat on the floor (y = 0) and shrink away. One instanced mesh
// draws every piece, so a burst is a single draw call.
const MAX = 300;
const LIFE = 3.2;          // seconds a piece lives
const SHRINK = 0.6;        // it shrinks away over its last seconds
const GRAVITY = 4.5;       // m/s², damped by DRAG so pieces flutter
const DRAG = 2.2;
const COLORS = ['#ffeb3b', '#ff5252', '#40c4ff', '#69f0ae', '#e040fb', '#ffab40', '#ffffff'];

export const confetti = {
  init: function () {
    this.pieces = [];
    for (let i = 0; i < MAX; i++) {
      this.pieces.push({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), axis: new THREE.Vector3(),
        quat: new THREE.Quaternion(), spin: 0, age: LIFE, landed: false });
    }
    this.next = 0;
    this.active = 0;
    const geo = new THREE.PlaneGeometry(0.03, 0.018);
    const mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;   // pieces fly anywhere; bounds would go stale
    const color = new THREE.Color();
    for (let i = 0; i < MAX; i++) this.mesh.setColorAt(i, color.set(COLORS[i % COLORS.length]));
    this.hideAll();
    this.el.setObject3D('mesh', this.mesh);
  },
  remove: function () { this.el.removeObject3D('mesh'); },
  burst: function (center, count) {
    for (let n = 0; n < Math.min(count, MAX); n++) {
      const p = this.pieces[this.next];
      this.next = (this.next + 1) % MAX;
      p.pos.copy(center).add(randomIn(0.12));
      // Mostly up and outwards, like a party popper.
      p.vel.set(rand(-1.4, 1.4), rand(1.2, 2.6), rand(-1.4, 1.4));
      p.axis.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize();
      p.quat.setFromAxisAngle(p.axis, rand(0, Math.PI * 2));
      p.spin = rand(6, 14);
      p.age = 0;
      p.landed = false;
    }
    this.active = LIFE;
    this.mesh.visible = true;
  },
  tick: function (t, delta) {
    if (this.active <= 0) return;
    // Lifetimes follow the clock; only the motion is stepped at most 50 ms
    // at a time, so a slow frame doesn't throw pieces through the floor.
    const real = delta / 1000;
    const dt = Math.min(real, 0.05);
    this.active -= real;
    for (let i = 0; i < MAX; i++) {
      const p = this.pieces[i];
      if (p.age >= LIFE) { this.mesh.setMatrixAt(i, HIDDEN); continue; }
      p.age += real;
      if (!p.landed) {
        p.vel.y -= GRAVITY * dt;
        p.vel.multiplyScalar(Math.exp(-DRAG * dt));
        p.pos.addScaledVector(p.vel, dt);
        p.quat.multiply(STEP.setFromAxisAngle(p.axis, p.spin * dt));
        if (p.pos.y <= 0.003) {
          // Lie flat on the floor.
          p.pos.y = 0.003;
          p.landed = true;
          p.quat.setFromEuler(FLAT.set(-Math.PI / 2, 0, rand(0, Math.PI * 2)));
        }
      }
      const s = Math.max(0, Math.min(1, (LIFE - p.age) / SHRINK));
      this.mesh.setMatrixAt(i, M.compose(p.pos, p.quat, SCALE.setScalar(s)));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.active <= 0) this.hideAll();
  },
  hideAll: function () {
    for (let i = 0; i < MAX; i++) this.mesh.setMatrixAt(i, HIDDEN);
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.visible = false;
  },
  // Pieces currently flying or lying on the floor (tests).
  live: function () { return this.pieces.filter(p => p.age < LIFE); }
};

const rand = (a, b) => a + Math.random() * (b - a);
const randomIn = r => new THREE.Vector3(rand(-r, r), rand(-r, r), rand(-r, r));
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const M = new THREE.Matrix4();
const STEP = new THREE.Quaternion();
const FLAT = new THREE.Euler();
const SCALE = new THREE.Vector3();
