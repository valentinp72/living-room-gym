import { EXERCISES } from './exercises/index.js';
import { WORKOUTS } from './workouts.js';
import { validateWorkout, createRun, updateRun, skip, currentStep, nextStep, targetOf,
  describeStep, exerciseById } from './workout-runner.js';
import { buildMannequin, resetPose, idle } from './avatar.js';
import { readHands } from './tracking.js';
import { play, unlockAudio } from './sound.js';

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

// Click handler that also unlocks audio (browsers need a user gesture).
function onClick(el, fn) {
  el.addEventListener('click', () => { unlockAudio(); fn(); });
}

function makeButton(label, color, width, height) {
  const btn = document.createElement('a-entity');
  btn.setAttribute('class', 'button');
  btn.setAttribute('geometry', { primitive: 'plane', width, height });
  btn.setAttribute('material', 'color', color);
  const text = document.createElement('a-text');
  text.setAttribute('value', label);
  text.setAttribute('align', 'center');
  text.setAttribute('color', '#fff');
  text.setAttribute('width', 3.2);
  text.setAttribute('position', '0 0 0.01');
  btn.appendChild(text);
  return btn;
}

function makeText(value, color, width) {
  const text = document.createElement('a-text');
  text.setAttribute('value', value);
  text.setAttribute('align', 'center');
  text.setAttribute('color', color);
  text.setAttribute('width', width);
  return text;
}

// Seconds to wait after entering AR/VR before recentering, so the headset
// pose has settled.
const RECENTER_DELAY = 0.5;

// Floor counter: shown while the head is below FLOOR_HEAD_Y during an
// exercise, FLOOR_AHEAD meters ahead of the head along the floor.
const FLOOR_HEAD_Y = 0.9;
const FLOOR_AHEAD = 0.2;

// Exercise vs rest look: rest gets a blue panel and a cyan countdown so it
// can't be mistaken for an exercise.
const LOOK = {
  exercise: { bg: '#000000', opacity: 0.65, counter: '#ffeb3b' },
  rest: { bg: '#0b3d5c', opacity: 0.85, counter: '#80deea' },
};
// Seconds before the end of a rest when the title turns to "GET READY"
// (together with the countdown beeps).
const GET_READY = 3;

// "4 / 10" or "12 / 30 s"
function progressText(ex, st, step) {
  const target = targetOf(step);
  const done = Math.min(Math.floor(ex.count(st)), target);
  return done + ' / ' + target + (ex.unit === 'seconds' ? ' s' : '');
}

// The gym-app component (on #stage): builds the menu, runs single exercises
// and training sets (see workouts.js), and recenters the stage in front of
// the user.
//   this.current  the exercise on screen: { ex, st } ({ ex: null } while
//                 resting, null on the menu)
//   this.run      the training set being run (see workout-runner.js), or null
export const gymApp = {
  init: function () {
    WORKOUTS.forEach(validateWorkout);

    this.camera = document.querySelector('#camera');
    this.rHand = document.querySelector('#rightHand');
    this.lHand = document.querySelector('#leftHand');
    this.menuPanel = document.querySelector('#menuPanel');
    this.exercisePanel = document.querySelector('#exercisePanel');
    this.titleText = document.querySelector('#exerciseTitle');
    this.instrText = document.querySelector('#instrText');
    this.repText = document.querySelector('#repText');
    this.skipBtn = document.querySelector('#btnSkip');
    this.exerciseBg = document.querySelector('#exerciseBg');
    this.floorLabel = document.querySelector('#floorLabel');
    this.floorLabelText = document.querySelector('#floorLabelText');
    this.mannequin = buildMannequin(this.el);
    this.current = null;
    this.run = null;
    this.clock = 0;
    this.lastCount = 0;
    this.hands = readHands(this.el.sceneEl);

    this.buildMenu();
    onClick(document.querySelector('#btnBack'), () => this.showMenu());
    onClick(this.skipBtn, () => this.handleEvents(skip(this.run)));
    // Recenter: panel buttons, B (right) / Y (left), and on entering AR/VR.
    document.querySelectorAll('.recenter').forEach(b => onClick(b, () => this.recenter()));
    this.rHand.addEventListener('bbuttondown', () => this.recenter());
    this.lHand.addEventListener('ybuttondown', () => this.recenter());
    this.recenterIn = null;
    this.el.sceneEl.addEventListener('enter-vr', () => { unlockAudio(); this.recenterIn = RECENTER_DELAY; });
    this.el.sceneEl.addEventListener('exit-vr', () => {
      // Back on the flat page the camera is at the origin again.
      this.recenterIn = null;
      this.el.object3D.position.set(0, 0, 0);
      this.el.object3D.rotation.set(0, 0, 0);
    });

    this.showMenu();
  },
  // Menu: "Training sets" then "Single exercises", laid out top to bottom,
  // with the background sized to fit.
  buildMenu: function () {
    const TOP = 1.0;   // top edge of the panel, relative to its center
    let y = 0.55;      // below the title
    const put = (el, height) => { el.setAttribute('position', `0 ${y - height / 2} 0.01`); y -= height; };
    const section = (container, title, items, label, start) => {
      const header = makeText(title, '#999', 2);
      this.menuPanel.appendChild(header);   // not in `container`: it only holds buttons
      put(header, 0.2);
      items.forEach(item => {
        const btn = makeButton(label(item), item.color, 1.8, 0.26);
        onClick(btn, () => start(item));
        container.appendChild(btn);
        put(btn, 0.32);
      });
      y -= 0.08;
    };
    section(document.querySelector('#workoutButtons'), 'Training sets', WORKOUTS,
      w => `${w.name} (${w.level})`, w => this.startWorkout(w));
    section(document.querySelector('#menuButtons'), 'Single exercises', EXERCISES,
      ex => `${ex.name} - ${ex.muscle}`, ex => this.startExercise(ex));
    put(document.querySelector('#btnRecenterMenu'), 0.3);
    y -= 0.1;
    const bg = document.querySelector('#menuBg');
    bg.setAttribute('height', TOP - y);
    bg.setAttribute('position', `0 ${(TOP + y) / 2} 0`);
  },
  // Head-top direction on the floor (unit x/z), for someone facing down;
  // falls back to the gaze direction when upright.
  headingOnFloor: function (head) {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(head.quaternion);
    if (Math.hypot(dir.x, dir.z) < 0.3) dir.set(0, 1, 0).applyQuaternion(head.quaternion);
    dir.y = 0;
    return dir.normalize();
  },
  // Keep the floor counter under the user's face while their head is low.
  updateFloorLabel: function (text) {
    const head = this.camera.object3D;
    const show = head.position.y < FLOOR_HEAD_Y;
    if (show !== this.floorLabel.getAttribute('visible')) this.floorLabel.setAttribute('visible', show);
    if (!show) return;
    const dir = this.headingOnFloor(head);
    const o = this.floorLabel.object3D;
    o.position.set(head.position.x + dir.x * FLOOR_AHEAD, 0.01, head.position.z + dir.z * FLOOR_AHEAD);
    // Lie flat, with the top of the text pointing away from the user.
    o.rotation.set(-Math.PI / 2, Math.atan2(-dir.x, -dir.z), 0, 'YXZ');
    this.floorLabelText.setAttribute('value', text);
  },
  // Move the stage (panels + mannequin) to the user: onto the floor under
  // their head, turned to face where they look. In AR the session origin is
  // wherever the user happened to start, possibly facing a wall.
  recenter: function () {
    const head = this.camera.object3D;
    // Looking (nearly) straight down, e.g. in a plank, this uses the
    // direction the top of the head points.
    const dir = this.headingOnFloor(head);
    this.el.object3D.position.set(head.position.x, 0, head.position.z);
    this.el.object3D.rotation.set(0, Math.atan2(-dir.x, -dir.z), 0);
  },
  showMenu: function () {
    this.current = null;
    this.run = null;
    setShown(this.menuPanel, true);
    setShown(this.exercisePanel, false);
    this.mannequin.root.setAttribute('visible', false);
    this.floorLabel.setAttribute('visible', false);
  },
  setLook: function (name) {
    const look = LOOK[name];
    this.exerciseBg.setAttribute('material', { color: look.bg, opacity: look.opacity });
    this.repText.setAttribute('color', look.counter);
    this.floorLabelText.setAttribute('color', look.counter);
  },
  // Exercise screen, shared by single exercises and training sets.
  showExerciseScreen: function (skippable) {
    this.setLook('exercise');
    this.clock = 0;
    this.lastCount = 0;
    setShown(this.menuPanel, false);
    setShown(this.exercisePanel, true);
    setShown(this.skipBtn, skippable);
    this.mannequin.root.setAttribute('visible', true);
  },
  startExercise: function (ex) {
    this.run = null;
    this.current = { ex, st: ex.state() };
    this.showExerciseScreen(false);
    this.titleText.setAttribute('value', ex.name.toUpperCase() + ' - ' + ex.muscle);
    this.instrText.setAttribute('value', ex.instructions);
    this.repText.setAttribute('value', ex.label(this.current.st));
  },
  startWorkout: function (workout) {
    this.run = createRun(workout);
    this.showExerciseScreen(true);
    this.showStep();
  },
  // Panel texts for the training set's current phase.
  showStep: function () {
    const run = this.run;
    const steps = run.workout.steps;
    this.clock = 0;
    this.lastCount = 0;
    this.setLook(run.phase === 'rest' ? 'rest' : 'exercise');
    if (run.phase === 'exercise') {
      this.current = { ex: run.ex, st: run.st };
      this.titleText.setAttribute('value', `${run.index + 1}/${steps.length}  ${run.ex.name.toUpperCase()}`);
      this.instrText.setAttribute('value', `${describeStep(currentStep(run))}. ${run.ex.instructions}`);
      this.skipBtn.querySelector('a-text').setAttribute('value', 'Skip');
    } else if (run.phase === 'rest') {
      // No exercise demo during rest: the mannequin idles (see tick).
      const next = exerciseById(nextStep(run).exercise);
      this.current = { ex: null, st: null };
      this.titleText.setAttribute('value', 'REST');
      this.instrText.setAttribute('value',
        `Relax. Next: ${next.name}, ${describeStep(nextStep(run))}. It starts after the countdown.`);
      this.skipBtn.querySelector('a-text').setAttribute('value', 'Skip rest');
    } else {
      this.current = null;
      this.titleText.setAttribute('value', 'TRAINING COMPLETE');
      this.instrText.setAttribute('value', `${run.workout.name} (${run.workout.level}): ${steps.length} exercises done.`);
      this.repText.setAttribute('value', 'Well done!');
      setShown(this.skipBtn, false);
      this.mannequin.root.setAttribute('visible', false);
      this.floorLabel.setAttribute('visible', false);
    }
  },
  // Sounds + screen changes for the runner's events.
  handleEvents: function (events) {
    if (!events.length) return;
    for (const e of events) {
      if (e === 'stepDone' && !events.includes('finished')) play('done');
      else if (e === 'finished') play('finish');
      else if (e === 'count') play('count');
      else if (e === 'go') play('go');
    }
    if (events.some(e => e !== 'count')) this.showStep();
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

    let text;
    if (this.run) {
      const run = this.run;
      const phase = run.phase, ex = run.ex, st = run.st, step = currentStep(run);
      const events = updateRun(run, ctx, delta);
      if (phase === 'exercise') {
        this.tickPaced(ex, st);
        text = ex.label(st) + '\n' + progressText(ex, st, step);
      } else if (phase === 'rest') {
        text = Math.ceil(run.restLeft) + 's';
        if (run.restLeft <= GET_READY && this.titleText.getAttribute('value') === 'REST') {
          this.titleText.setAttribute('value', 'GET READY');
        }
      }
      this.handleEvents(events);
      if (!this.current) return;   // training set finished
    } else {
      const { ex, st } = this.current;
      ex.update(ctx, st, delta);
      this.tickPaced(ex, st);
      text = ex.label(st);
    }
    this.repText.setAttribute('value', text);
    this.updateFloorLabel(text);
    resetPose(this.mannequin);
    if (this.current.ex) this.current.ex.demo(this.mannequin, this.clock);
    else idle(this.mannequin, this.clock);
  },
  // Paced exercises: a tick for every rep the app counts.
  tickPaced: function (ex, st) {
    if (!ex.paced) return;
    const n = Math.floor(ex.count(st));
    if (n > this.lastCount) play('rep');
    this.lastCount = n;
  }
};
