// `geometry="primitive: capsule; radius: r; length: l"`: a cylinder of
// length l (along Y) with half-sphere caps, so it's l + 2r long overall.
// Used for the mannequin's rounded body parts.
export const capsuleGeometry = {
  schema: {
    radius: { default: 0.05, min: 0 },
    length: { default: 0.3, min: 0 },
    capSegments: { default: 6, type: 'int' },
    radialSegments: { default: 16, type: 'int' },
  },
  init: function (data) {
    this.geometry = new THREE.CapsuleGeometry(data.radius, data.length, data.capSegments, data.radialSegments);
  }
};
