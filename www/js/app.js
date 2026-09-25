import { EXERCISES } from './exercises/index.js';
import { buildMannequin, resetPose } from './avatar.js';
import { readHands } from './tracking.js';

// Show or hide a panel or button. A-Frame raycasters ignore `visible`, so a
// hidden button would still catch the laser (and its clicks) in front of a
// visible one. Buttons (class "button") are therefore only raycast targets
// (class "clickable") while shown.
function setShown(el, shown) {
  el.setAttribute('visible', shown);
  const buttons = [...el.querySelectorAll('.button')];
  if (el.classList.contains('button')) buttons.push(el);
  buttons.forEach(b => b.classList.toggle('clickable', shown));
}

// Seconds to wait after entering AR/VR before recentering, so the headset
// pose has settled.
const RECENTER_DELAY = 0.5;

// The gym-app component (on #stage): builds the menu, switches between the
// menu and exercise screens, drives the current exercise every frame, and
// recenters the stage in front of the user.
export const gymApp = {
  init: function () {
    this.camera = document.querySelector('#camera');
    this.rHand = document.querySelector('#rightHand');
    this.lHand = document.querySelector('#leftHand');
    this.menuPanel = document.querySelector('#menuPanel');
    this.exercisePanel = document.querySelector('#exercisePanel');
    this.titleText = document.querySelector('#exerciseTitle');
    this.instrText = document.querySelector('#instrText');
    this.repText = document.querySelector('#repText');
    this.toggleBtn = document.querySelector('#btnToggle');
    this.mannequin = buildMannequin(this.el);
    this.current = null;
    this.clock = 0;
    this.hands = readHands(this.el.sceneEl);

    const menuButtons = document.querySelector('#menuButtons');
    EXERCISES.forEach((ex, i) => {
      const btn = document.createElement('a-entity');
      btn.setAttribute('class', 'button');
      btn.setAttribute('geometry', 'primitive: plane; width: 1.8; height: 0.3');
      btn.setAttribute('material', 'color:' + ex.color);
      btn.setAttribute('position', '0 ' + (0.25 - i * 0.4) + ' 0.01');
      const label = document.createElement('a-text');
      label.setAttribute('value', ex.name + ' — ' + ex.muscle);
      label.setAttribute('align', 'center');
      label.setAttribute('color', '#fff');
      label.setAttribute('width', '3.2');
      label.setAttribute('position', '0 0 0.01');
      btn.appendChild(label);
      btn.addEventListener('click', () => this.startExercise(ex));
      menuButtons.appendChild(btn);
    });

    document.querySelector('#btnBack').addEventListener('click', () => this.showMenu());
    this.toggleBtn.addEventListener('click', () => this.toggleTimer());
    // A (right) / X (left) also toggle the timer: easier than aiming at the
    // panel while holding a plank on the floor.
    this.rHand.addEventListener('abuttondown', () => this.toggleTimer());
    this.lHand.addEventListener('xbuttondown', () => this.toggleTimer());

    // Recenter: panel buttons, B (right) / Y (left), and on entering AR/VR.
    document.querySelectorAll('.recenter').forEach(b => b.addEventListener('click', () => this.recenter()));
    this.rHand.addEventListener('bbuttondown', () => this.recenter());
    this.lHand.addEventListener('ybuttondown', () => this.recenter());
    this.recenterIn = null;
    this.el.sceneEl.addEventListener('enter-vr', () => { this.recenterIn = RECENTER_DELAY; });
    this.el.sceneEl.addEventListener('exit-vr', () => {
      // Back on the flat page the camera is at the origin again.
      this.recenterIn = null;
      this.el.object3D.position.set(0, 0, 0);
      this.el.object3D.rotation.set(0, 0, 0);
    });

    this.showMenu();
  },
  // Move the stage (panels + mannequin) to the user: onto the floor under
  // their head, turned to face where they look. In AR the session origin is
  // wherever the user happened to start, possibly facing a wall.
  recenter: function () {
    const head = this.camera.object3D;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(head.quaternion);
    if (Math.hypot(dir.x, dir.z) < 0.3) {
      // Looking (nearly) straight down, e.g. in a plank: use the direction the
      // top of the head points instead.
      dir.set(0, 1, 0).applyQuaternion(head.quaternion);
    }
    this.el.object3D.position.set(head.position.x, 0, head.position.z);
    this.el.object3D.rotation.set(0, Math.atan2(-dir.x, -dir.z), 0);
  },
  toggleTimer: function () {
    if (this.current && this.current.ex.manual) this.current.st.running = !this.current.st.running;
  },
  showMenu: function () {
    this.current = null;
    setShown(this.menuPanel, true);
    setShown(this.exercisePanel, false);
    this.mannequin.root.setAttribute('visible', false);
  },
  startExercise: function (ex) {
    this.current = { ex, st: ex.state() };
    this.clock = 0;
    setShown(this.menuPanel, false);
    setShown(this.exercisePanel, true);
    this.titleText.setAttribute('value', ex.name.toUpperCase() + ' — ' + ex.muscle);
    this.instrText.setAttribute('value', ex.instructions);
    setShown(this.toggleBtn, !!ex.manual);
    this.mannequin.root.setAttribute('visible', true);
    this.repText.setAttribute('value', ex.label(this.current.st));
  },
  tick: function (t, delta) {
    if (this.recenterIn !== null) {
      this.recenterIn -= delta / 1000;
      if (this.recenterIn <= 0) { this.recenterIn = null; this.recenter(); }
    }
    if (!this.current) return;
    this.clock += delta / 1000;
    const scene = this.el.sceneEl;
    const ctx = { scene, camera: this.camera, hands: readHands(scene, this.hands) };
    this.current.ex.update(ctx, this.current.st, delta);
    this.repText.setAttribute('value', this.current.ex.label(this.current.st));
    resetPose(this.mannequin);
    this.current.ex.demo(this.mannequin, this.clock);
  }
};
