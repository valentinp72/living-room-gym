import { EXERCISES } from './exercises/index.js';
import { WORKOUTS } from './workouts.js';
import { validateWorkout, createRun, updateRun, skip, currentStep, nextStep, targetOf,
  describeStep, exerciseById } from './workout-runner.js';
import { buildMannequin, resetPose, idle, HOME, setHome } from './avatar.js';
import { readHands, gazeY, readSurfaces, xrMode } from './tracking.js';
import { buildRoom, isEmpty, placeStage } from './room.js';
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

function makeButton(label, color, width, height, textWidth = 3.2) {
  const btn = document.createElement('a-entity');
  btn.setAttribute('class', 'button');
  btn.setAttribute('geometry', { primitive: 'plane', width, height });
  btn.setAttribute('material', 'color', color);
  const text = document.createElement('a-text');
  text.setAttribute('value', label);
  text.setAttribute('align', 'center');
  text.setAttribute('color', '#fff');
  text.setAttribute('width', textWidth);
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

// Height of the middle of the menu panel above the floor (m).
const MENU_CENTER_Y = 1.45;

// Menu tab colors: selected / not selected.
const TAB = { on: '#0277bd', off: '#37474f' };

// Seconds to wait after entering AR/VR before recentering, so the headset
// pose has settled.
const RECENTER_DELAY = 0.5;

// Room scan (AR): read every ROOM_EVERY seconds. With none after
// ROOM_WAIT seconds, the menu suggests setting one up.
const ROOM_EVERY = 1;
const ROOM_WAIT = 3;
// Where the mannequin may stand (stage frame), best first, when HOME is
// cramped: all right of the exercise panel, out of the way of its view.
// Its demo space is a capsule across the line of sight: lying poses are
// ~1.9 m long.
const MANNEQUIN_SPOTS = [{ ...HOME }, { x: 1.4, z: -1.9 }, { x: 1.0, z: -2.9 }, { x: 1.5, z: -1.4 }, { x: 1.7, z: -0.9 }];
const MANNEQUIN_SPACE = { half: 0.95, r: 0.3 };

// Floor counter: shown while the head is below FLOOR_HEAD_Y during an
// exercise, FLOOR_AHEAD meters ahead of the head along the floor. Lying on
// the back (looking up, gaze y above FACE_UP), it floats CEILING_AHEAD
// meters in front of the face instead, facing it.
const FLOOR_HEAD_Y = 0.9;
const FLOOR_AHEAD = 0.2;
const FACE_UP = 0.5;
const CEILING_AHEAD = 0.7;

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
    this.roomText = document.querySelector('#roomText');
    this.resetRoom();

    this.buildMenu();
    onClick(document.querySelector('#btnBack'), () => this.showMenu());
    onClick(this.skipBtn, () => this.handleEvents(skip(this.run)));
    // Recenter: panel buttons, B (right) / Y (left), and on entering AR/VR.
    document.querySelectorAll('.recenter').forEach(b => onClick(b, () => this.recenter()));
    this.rHand.addEventListener('bbuttondown', () => this.recenter());
    this.lHand.addEventListener('ybuttondown', () => this.recenter());
    this.recenterIn = null;
    this.el.sceneEl.addEventListener('enter-vr', () => {
      unlockAudio(); this.recenterIn = RECENTER_DELAY; this.resetRoom();
    });
    this.el.sceneEl.addEventListener('exit-vr', () => {
      // Back on the flat page the camera is at the origin again.
      this.recenterIn = null;
      this.resetRoom();
      setHome(HOME);
      this.el.object3D.position.set(0, 0, 0);
      this.el.object3D.rotation.set(0, 0, 0);
    });

    this.showMenu();
  },
  // Menu: a top row with two tabs, "Training sets" and "Single exercises"
  // (each shows its page of buttons) plus Recenter, then the page, then the
  // room status line. The background fits the longest page, so switching
  // tabs doesn't resize it, and the panel is raised or lowered so its middle
  // is at MENU_CENTER_Y: it never reaches into the floor.
  buildMenu: function () {
    const TOP = 1.0;       // top edge of the panel, relative to the panel entity
    const ROW_Y = 0.45;    // tabs + recenter row
    const PAGE_Y = 0.28;   // top of the pages
    const ROW = 0.27;      // page row height
    this.pages = {
      sets: {
        tab: makeButton('Training sets', TAB.off, 0.95, 0.24, 2.2),
        container: document.querySelector('#workoutButtons'),
        items: WORKOUTS, cols: 1, width: 2.4, textWidth: 3.2,
        label: w => `${w.name} (${w.level})`, start: w => this.startWorkout(w),
      },
      single: {
        tab: makeButton('Single exercises', TAB.off, 0.95, 0.24, 2.2),
        container: document.querySelector('#menuButtons'),
        items: EXERCISES, cols: 3, width: 0.8, textWidth: 2.0,
        label: ex => ex.name, start: ex => this.startExercise(ex),
      },
    };
    let rows = 0;
    Object.entries(this.pages).forEach(([name, page], i) => {
      page.tab.id = name === 'sets' ? 'tabSets' : 'tabSingle';
      page.tab.setAttribute('position', `${-0.775 + i * 1.0} ${ROW_Y} 0.01`);
      this.menuPanel.appendChild(page.tab);   // not in the container: it only holds buttons
      onClick(page.tab, () => this.showTab(name));
      page.items.forEach((item, j) => {
        const btn = makeButton(page.label(item), item.color, page.width, 0.22, page.textWidth);
        const col = j % page.cols, row = Math.floor(j / page.cols);
        const x = (col - (page.cols - 1) / 2) * (page.width + 0.06);
        btn.setAttribute('position', `${x} ${PAGE_Y - ROW / 2 - row * ROW} 0.01`);
        onClick(btn, () => page.start(item));
        page.container.appendChild(btn);
      });
      rows = Math.max(rows, Math.ceil(page.items.length / page.cols));
    });
    document.querySelector('#btnRecenterMenu').setAttribute('position', `1.0 ${ROW_Y} 0.01`);
    // Room status line (up to 2 lines) under the pages.
    const pagesBottom = PAGE_Y - rows * ROW;
    this.roomText.setAttribute('position', `0 ${pagesBottom - 0.14} 0.01`);
    const bottom = pagesBottom - 0.3;
    const bg = document.querySelector('#menuBg');
    bg.setAttribute('height', TOP - bottom);
    bg.setAttribute('position', `0 ${(TOP + bottom) / 2} 0`);
    this.menuPanel.object3D.position.y = MENU_CENTER_Y - (TOP + bottom) / 2;
    this.tab = 'sets';
  },
  showTab: function (name) {
    this.tab = name;
    for (const [n, page] of Object.entries(this.pages)) {
      setShown(page.container, n === name);
      page.tab.setAttribute('material', 'color', n === name ? TAB.on : TAB.off);
    }
  },
  // Head-top direction on the floor (unit x/z), for someone facing down;
  // falls back to the gaze direction when upright.
  headingOnFloor: function (head) {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(head.quaternion);
    if (Math.hypot(dir.x, dir.z) < 0.3) dir.set(0, 1, 0).applyQuaternion(head.quaternion);
    dir.y = 0;
    return dir.normalize();
  },
  // Keep the floor counter in sight while the user's head is low: on the
  // floor under the face, or above it when lying on the back.
  updateFloorLabel: function (text) {
    const head = this.camera.object3D;
    const show = head.position.y < FLOOR_HEAD_Y;
    if (show !== this.floorLabel.getAttribute('visible')) this.floorLabel.setAttribute('visible', show);
    if (!show) return;
    this.floorLabelText.setAttribute('value', text);
    const o = this.floorLabel.object3D;
    if (gazeY(head) > FACE_UP) {
      o.position.set(0, 0, -CEILING_AHEAD).applyQuaternion(head.quaternion).add(head.position);
      o.quaternion.copy(head.quaternion);
      return;
    }
    const dir = this.headingOnFloor(head);
    o.position.set(head.position.x + dir.x * FLOOR_AHEAD, 0.01, head.position.z + dir.z * FLOOR_AHEAD);
    // Lie flat, with the top of the text pointing away from the user.
    o.rotation.set(-Math.PI / 2, Math.atan2(-dir.x, -dir.z), 0, 'YXZ');
  },
  // Move the stage (panels + mannequin) to the user: onto the floor under
  // their head, turned to face where they look. In AR the session origin is
  // wherever the user happened to start, possibly facing a wall. With a room
  // scan, placeStage() turns it a little and / or brings it closer when a
  // wall or furniture is in the way (see room.js).
  recenter: function () {
    const head = this.camera.object3D;
    // Looking (nearly) straight down, e.g. in a plank, this uses the
    // direction the top of the head points.
    const dir = this.headingOnFloor(head);
    const at = { x: head.position.x, z: head.position.z, yaw: Math.atan2(-dir.x, -dir.z) };
    // Each screen is placed on its own: they're never shown together, and in
    // a small room they may not fit in the same spot.
    this.spots = Object.fromEntries(Object.entries(this.screenLayouts())
      .map(([name, layout]) => [name, placeStage(this.room, at, layout)]));
    this.placeScreen();
    this.showRoomStatus();
  },
  // Move the stage to the spot of the screen on show (see recenter()).
  placeScreen: function (screen = this.screen) {
    this.screen = screen;
    if (!this.spots) return;
    const spot = this.spots[screen];
    this.el.object3D.position.set(spot.x, 0, spot.z);
    this.el.object3D.rotation.set(0, spot.yaw, 0);
    if (spot.spot) setHome(spot.spot, spot.scale);
  },
  // What must stay clear of walls and furniture on each screen, in stage
  // coordinates: each panel's footprint (a segment) and, during exercises,
  // the mannequin's demo space.
  screenLayouts: function () {
    const footprint = sel => {
      const panel = document.querySelector(sel), o = panel.object3D;
      const half = panel.querySelector('a-plane').getAttribute('width') / 2;
      const c = Math.cos(o.rotation.y), s = Math.sin(o.rotation.y);
      return { a: { x: o.position.x - half * c, z: o.position.z + half * s },
        b: { x: o.position.x + half * c, z: o.position.z - half * s } };
    };
    return {
      menu: { panels: [footprint('#menuPanel')] },
      exercise: { panels: [footprint('#exercisePanel')], mannequin: { spots: MANNEQUIN_SPOTS, ...MANNEQUIN_SPACE } },
    };
  },
  resetRoom: function () {
    this.room = null;
    this.roomKey = '';
    this.roomClock = 0;
    this.roomWait = 0;
    this.spots = null;
    this.showRoomStatus();
  },
  // Reread the room scan now and then (it can arrive or be refined after the
  // session starts). The first time there is one, recenter with it.
  updateRoom: function (dt) {
    if (!this.el.sceneEl.xrSession) return;
    this.roomClock += dt;
    if (this.roomClock < ROOM_EVERY) return;
    this.roomWait += this.roomClock;
    this.roomClock = 0;
    const surfaces = readSurfaces(this.el.sceneEl);
    // Changes under 2 cm don't count.
    const key = JSON.stringify(surfaces, (k, v) => typeof v === 'number' ? Math.round(v * 50) : v);
    if (key !== this.roomKey) {
      const hadRoom = !isEmpty(this.room);
      this.roomKey = key;
      this.room = surfaces ? buildRoom(surfaces) : null;
      if (!hadRoom && !isEmpty(this.room) && this.recenterIn === null) this.recenter();
    }
    this.showRoomStatus();
  },
  // Status line on the menu, in AR only (in VR the real room is out of sight).
  showRoomStatus: function () {
    let text = '';
    if (xrMode(this.el.sceneEl) === 'ar') {
      if (isEmpty(this.room)) {
        if (this.roomWait >= ROOM_WAIT) text = 'No room scan found. Run Space Setup on your Quest to keep panels clear of walls and furniture.';
      } else if (this.spots && !Object.values(this.spots).every(s => s.panelsClear)) {
        text = 'Not enough free space here. Move to a clearer spot, then press Recenter.';
      } else if (this.spots && !Object.values(this.spots).every(s => s.clear)) {
        text = 'Tight space: the demo avatar may overlap walls or furniture.';
      } else {
        const { walls, obstacles } = this.room;
        text = `Room scan: ${walls.length} walls and ${obstacles.length} objects avoided`;
      }
    }
    if (this.roomText.getAttribute('value') !== text) this.roomText.setAttribute('value', text);
  },
  showMenu: function () {
    this.current = null;
    this.run = null;
    setShown(this.menuPanel, true);
    this.placeScreen('menu');
    this.showTab(this.tab);
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
    this.placeScreen('exercise');
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
    this.updateRoom(delta / 1000);
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
