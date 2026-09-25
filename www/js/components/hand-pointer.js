// Pointing ray + pinch-to-click for tracked hands (no controllers), the
// hand-tracking counterpart of laser-controls. Put one per hand on an entity
// inside #rig: <a-entity hand-pointer="hand: right">.
//
// The ray follows the hand's WebXR target ray (the system pointing ray) and
// only shows while that hand is tracked. A pinch fires the session's
// 'select' event, which clicks the first .clickable the ray hits.
// Controllers are left to laser-controls (their sources have no `hand`).
export const handPointer = {
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
  isOurs: function (src) {
    return !!src.hand && src.handedness === this.data.hand;
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
        if (this.isOurs(src)) { pose = frame.getPose(src.targetRaySpace, ref); break; }
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
    if (!this.active || !this.isOurs(evt.inputSource)) return;
    const hit = this.el.components.raycaster.intersectedEls[0];
    if (hit) hit.emit('click');
  }
};
