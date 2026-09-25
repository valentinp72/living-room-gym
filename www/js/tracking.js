// Shared helpers for reading headset / controller tracking.

// Per-side hand state read from the WebXR session, for Touch controllers and
// tracked hands alike:
//   { left: { tracked, kind, position, emulated, rayTracked, ray }, right: { ... } }
// kind is 'controller', 'hand' or null; position (THREE.Vector3, meters) is
// the palm / controller grip, in the same space as the #camera position.
// Outside XR, or when a hand isn't seen this frame, tracked is false.
// emulated is true when the headset only estimates the position (a controller
// out of the cameras' view): it lags or freezes, so don't detect moves with it.
// ray (unit THREE.Vector3) is where the hand points, the same direction as the
// laser. For controllers it comes from their motion sensors, so it stays
// accurate even when the position is only estimated. rayTracked says if it's
// valid this frame.
export function readHands(sceneEl, out = { left: emptyHand(), right: emptyHand() }) {
  out.left.tracked = out.right.tracked = false;
  out.left.kind = out.right.kind = null;
  out.left.rayTracked = out.right.rayTracked = false;
  const session = sceneEl.xrSession, frame = sceneEl.frame;
  const ref = session && frame && sceneEl.renderer.xr.getReferenceSpace();
  if (!ref) return out;
  for (const src of session.inputSources) {
    const hand = out[src.handedness];
    if (!hand) continue;
    const ray = frame.getPose(src.targetRaySpace, ref);
    if (ray) {
      const q = ray.transform.orientation;
      hand.ray.set(0, 0, -1).applyQuaternion(tmpQuat.set(q.x, q.y, q.z, q.w));
      hand.rayTracked = true;
    }
    let pose = null;
    if (src.gripSpace) pose = frame.getPose(src.gripSpace, ref);
    else if (src.hand && frame.getJointPose) pose = frame.getJointPose(src.hand.get('wrist'), ref);
    if (!pose) continue;   // not tracked this frame
    const p = pose.transform.position;
    hand.position.set(p.x, p.y, p.z);
    hand.tracked = true;
    hand.emulated = !!pose.emulatedPosition;
    hand.kind = src.hand ? 'hand' : 'controller';
  }
  return out;
}

function emptyHand() {
  return { tracked: false, kind: null, position: new THREE.Vector3(), emulated: false,
    rayTracked: false, ray: new THREE.Vector3(0, 0, -1) };
}
const tmpQuat = new THREE.Quaternion();

// Which immersive mode the scene is in: 'vr', 'ar' or null (flat page).
// Head positions from different modes aren't comparable (on the flat page
// the camera sits at a fixed 1.6 m), so calibrations should be redone when
// this changes.
export function xrMode(sceneEl) {
  if (sceneEl.is('ar-mode')) return 'ar';
  if (sceneEl.is('vr-mode')) return 'vr';
  return null;
}
