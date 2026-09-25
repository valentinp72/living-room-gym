import { EXERCISES } from './exercises/index.js';
import { buildMannequin } from './avatar.js';

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
      btn.setAttribute('class', 'clickable');
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
    this.toggleBtn.addEventListener('click', () => {
      if (this.current && this.current.ex.manual) this.current.st.running = !this.current.st.running;
    });
  },
  showMenu: function () {
    this.current = null;
    this.menuPanel.setAttribute('visible', true);
    this.exercisePanel.setAttribute('visible', false);
    this.mannequin.root.setAttribute('visible', false);
  },
  startExercise: function (ex) {
    this.current = { ex, st: ex.state() };
    this.clock = 0;
    this.menuPanel.setAttribute('visible', false);
    this.exercisePanel.setAttribute('visible', true);
    this.titleText.setAttribute('value', ex.name.toUpperCase() + ' — ' + ex.muscle);
    this.instrText.setAttribute('value', ex.instructions);
    this.toggleBtn.setAttribute('visible', !!ex.manual);
    this.mannequin.root.setAttribute('visible', true);
    this.repText.setAttribute('value', ex.label(this.current.st));
  },
  tick: function (t, delta) {
    if (!this.current) return;
    this.clock += delta / 1000;
    const ctx = { camera: this.camera, rHand: this.rHand, lHand: this.lHand };
    this.current.ex.update(ctx, this.current.st, delta);
    this.repText.setAttribute('value', this.current.ex.label(this.current.st));
    this.current.ex.demo(this.mannequin, this.clock);
  }
};
