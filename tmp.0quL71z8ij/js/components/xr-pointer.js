// Pointing ray + click for one hand, whether it holds a controller or is a
// tracked bare hand. Put one per hand on an entity inside #rig:
// <a-entity xr-pointer="hand: right">.
//
// The ray follows that hand's WebXR target ray and only shows while it is
// tracked. The session's 'select' event (trigger pull, or pinch) clicks the
// first .clickable the ray hits, once.
//
// This is the only click path in XR. A-Frame's `cursor` (and so
// laser-controls) also listens to the session's selectstart/selectend from
// every hand at once, which clicked whatever the head, or the other hand,
// was pointing at. Don't add cursors that aren't rayOrigin: mouse.
export const xrPointer = {
  schema: { hand: { default: 'right', oneOf: ['left', 'right'] } },
  init: function () {
    this.el.setAttribute('raycaster', { objects: '.clickable', far: 20, showLine: true, enabled: false });
    this.el.setAttribute('visible', false);
    this.active = false;
    this.session = null;
    this.onSelect = this.onSelect.bind(this);
  },
  remove: function () {
    if (this.session) this.session.removeEventListener('select', this.onSelect);
  },
  tick: function () {
    const scene = this.el.sceneEl;
    const session = scene.xrSession, frame = scene.frame;
    if (session !== this.session) {
      if (this.session) this.session.removeEventListener('select', this.onSelect);
      if (session) session.addEventListener('select', this.onSelect);
      this.session = session;
    }
    let pose = null;
    const ref = session && frame && scene.renderer.xr.getReferenceSpace();
    if (ref) {
      for (const src of session.inputSources) {
        if (src.handedness === this.data.hand) { pose = frame.getPose(src.targetRaySpace, ref); break; }
      }
    }
    if (!!pose !== this.active) {
      this.active = !!pose;
      this.el.setAttribute('visible', this.active);
      this.el.setAttribute('raycaster', 'enabled', this.active);
    }
    if (pose) {
      const o = this.el.object3D;
      o.matrix.fromArray(pose.transform.matrix);
      o.matrix.decompose(o.position, o.quaternion, o.scale);
    }
  },
  onSelect: function (evt) {
    if (!this.active || evt.inputSource.handedness !== this.data.hand) return;
    const rc = this.el.components.raycaster;
    // Use the ray as it is now, not as of the last raycaster refresh.
    this.el.object3D.updateMatrixWorld(true);
    rc.checkIntersections();
    const hit = rc.intersectedEls[0];
    if (hit) hit.emit('click');
  }
};
