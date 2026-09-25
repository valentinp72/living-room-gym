export function buildMannequin(sceneEl) {
  const root = document.createElement('a-entity');
  root.setAttribute('id', 'mannequin');
  root.setAttribute('position', '1.6 1.1 -2');
  root.setAttribute('visible', false);

  function part(tag, attrs, parent) {
    const e = document.createElement(tag);
    Object.keys(attrs).forEach(k => e.setAttribute(k, attrs[k]));
    (parent || root).appendChild(e);
    return e;
  }
  part('a-box', { color: '#e0e0e0', width: 0.3, height: 0.5, depth: 0.18, position: '0 0 0' });
  part('a-sphere', { color: '#e0e0e0', radius: 0.13, position: '0 0.38 0' });
  const shoulderL = part('a-entity', { position: '-0.22 0.2 0' });
  part('a-box', { color: '#c0c0c0', width: 0.09, height: 0.4, depth: 0.09, position: '0 -0.2 0' }, shoulderL);
  const shoulderR = part('a-entity', { position: '0.22 0.2 0' });
  part('a-box', { color: '#c0c0c0', width: 0.09, height: 0.4, depth: 0.09, position: '0 -0.2 0' }, shoulderR);
  const hipL = part('a-entity', { position: '-0.1 -0.25 0' });
  part('a-box', { color: '#9e9e9e', width: 0.11, height: 0.45, depth: 0.11, position: '0 -0.22 0' }, hipL);
  const hipR = part('a-entity', { position: '0.1 -0.25 0' });
  part('a-box', { color: '#9e9e9e', width: 0.11, height: 0.45, depth: 0.11, position: '0 -0.22 0' }, hipR);

  sceneEl.appendChild(root);
  return { root, shoulderL, shoulderR, hipL, hipR };
}
