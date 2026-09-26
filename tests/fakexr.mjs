// Installs a fake WebXR session/frame on the page's <a-scene>, driven by
// window.fakeXR.hands = { left, right }, each:
//   { kind: 'controller' | 'hand', grip: bool (hands only: expose gripSpace),
//     pos: [x, y, z], ray: { from: [..], to: [..] } | null, lost: bool,
//     emulated: bool (position only estimated, like a controller out of view) }
export async function installFakeXR(page) {
  await page.evaluate(() => {
    const side = s => ({ kind: 'controller', grip: false, pos: [s * 0.2, 0.8, -0.2], ray: null, lost: true });
    window.fakeXR = { hands: { left: side(-1), right: side(1) } };
    const session = new EventTarget();
    const sources = () => Object.entries(fakeXR.hands).map(([handedness, h]) => ({
      handedness,
      // Real Touch controllers report 'oculus-touch-*'; a neutral id keeps
      // A-Frame's controller components from loading models for the fake.
      profiles: h.kind === 'hand' ? ['generic-hand'] : ['fake-controller'],
      hand: h.kind === 'hand' ? new Map([['wrist', { handedness, space: 'wrist' }]]) : null,
      gripSpace: h.kind === 'controller' || h.grip ? { handedness, space: 'grip' } : null,
      targetRaySpace: { handedness, space: 'ray' },
    }));
    Object.defineProperty(session, 'inputSources', { get: sources });
    session.requestReferenceSpace = () => Promise.resolve({ fake: true });
    const pose = space => {
      const h = fakeXR.hands[space.handedness];
      if (!h || h.lost) return null;
      if (space.space === 'ray') {
        if (!h.ray) return null;
        const from = new THREE.Vector3(...h.ray.from), to = new THREE.Vector3(...h.ray.to);
        const m = new THREE.Matrix4().lookAt(from, to, new THREE.Vector3(0, 1, 0)).setPosition(from);
        const q = new THREE.Quaternion().setFromRotationMatrix(m);
        return { transform: { matrix: Float32Array.from(m.elements), position: { x: from.x, y: from.y, z: from.z },
          orientation: { x: q.x, y: q.y, z: q.z, w: q.w } } };
      }
      return { emulatedPosition: !!h.emulated, transform: { position: { x: h.pos[0], y: h.pos[1], z: h.pos[2] } } };
    };
    // fillPoses / fillJointRadii: used by A-Frame's hand models if any; report no joint data.
    const frame = { getPose: pose, getJointPose: pose, fillPoses: () => false, fillJointRadii: () => false };
    const scene = document.querySelector('a-scene');
    Object.defineProperty(scene, 'xrSession', { get: () => session, set() {}, configurable: true });
    Object.defineProperty(scene, 'frame', { get: () => frame, set() {}, configurable: true });
    scene.renderer.xr.getReferenceSpace = () => ({ fake: true });
    // Pinch (or trigger) on one side: selectstart, select, selectend like a real session.
    window.fakeSelect = handedness => {
      const inputSource = sources().find(s => s.handedness === handedness);
      for (const type of ['selectstart', 'select', 'selectend']) {
        const e = new Event(type); e.inputSource = inputSource; e.frame = frame;
        session.dispatchEvent(e);
      }
    };
  });
}
