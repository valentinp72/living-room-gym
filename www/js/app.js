import { EXERCISES } from './exercises/index.js';
import { buildMannequin, resetPose } from './avatar.js';

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

// The gym-app component: builds the menu, switches between the menu and
// exercise screens, and drives the current exercise every frame.
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
    this.mannequin = buildMannequin(this.el.sceneEl);
    this.current = null;
    this.clock = 0;

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

    this.showMenu();
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
    if (!this.current) return;
    this.clock += delta / 1000;
    const ctx = { scene: this.el.sceneEl, camera: this.camera, rHand: this.rHand, lHand: this.lHand };
    this.current.ex.update(ctx, this.current.st, delta);
    this.repText.setAttribute('value', this.current.ex.label(this.current.st));
    resetPose(this.mannequin);
    this.current.ex.demo(this.mannequin, this.clock);
  }
};
