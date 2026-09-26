import { EXERCISES, GROUPS, groupOf, EQUIPMENT_NAMES, movesOf } from './exercises/index.js';
import { WORKOUTS, LEVELS } from './workouts.js';
import { validateWorkout, createRun, updateRun, skip, currentStep, nextStep, targetOf,
  describeStep, exerciseById, equipmentOf } from './workout-runner.js';
import { buildMannequin, resetPose, idle, centerDemo } from './avatar.js';
import { readHands, gazeY } from './tracking.js';
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

// wrapCount: characters per line (a-text's default is 40 per `textWidth`),
// so long labels go on two lines.
function makeButton(label, color, width, height, textWidth = 3.2, wrapCount = null) {
  const btn = document.createElement('a-entity');
  btn.setAttribute('class', 'button');
  btn.setAttribute('geometry', { primitive: 'plane', width, height });
  btn.setAttribute('material', 'color', color);
  const text = document.createElement('a-text');
  text.setAttribute('value', label);
  text.setAttribute('align', 'center');
  text.setAttribute('color', '#fff');
  text.setAttribute('width', textWidth);
  if (wrapCount) text.setAttribute('wrap-count', wrapCount);
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

// Menu tab colors: selected / not selected. Group chips (the row under the
// tabs) have their own, so the two rows don't look alike.
const TAB = { on: '#0277bd', off: '#37474f' };
const CHIP = { on: '#00897b', off: '#263238' };

// Seconds to wait after entering AR before recentering, so the headset
// pose has settled.
const RECENTER_DELAY = 0.5;

// Counter near the face (#floorLabel), during an exercise, when the panel
// is out of sight or unreadable: the head is below FLOOR_HEAD_Y, or closer
// than NEAR_PANEL to the panel's plane (or behind it), e.g. leaning over a
// chair. Low and facing the floor (gaze y below FACE_DOWN: plank,
// push-ups), it lies on the floor FLOOR_AHEAD meters ahead of the head.
// Otherwise (lying on the back, side plank, near the panel) it floats
// FACE_AHEAD meters in front of the face, facing it.
const FLOOR_HEAD_Y = 0.9;
const NEAR_PANEL = 0.9;
const FLOOR_AHEAD = 0.2;
const FACE_DOWN = -0.5;
const FACE_AHEAD = 0.7;

// Menu follow (XR only): when the menu is on screen and the user has turned
// more than FOLLOW_ANGLE degrees away from it, or walked more than
// FOLLOW_DISTANCE meters from where it was placed, for FOLLOW_SECONDS, it
// recenters in front of them. Pointing at a menu behind you with a bare hand
// is awkward (Quest test). Not during exercises: people turn on the floor.
const FOLLOW_ANGLE = 60;
const FOLLOW_DISTANCE = 1.5;
const FOLLOW_SECONDS = 1.5;

// Equipment the user has (menu setting, kept in this browser): training
// sets that need something they don't have are hidden.
const KIT_KEY = 'xr-muscle-equipment';
function loadKit() {
  const kit = { chair: true, band: true, weights: true };
  try { Object.assign(kit, JSON.parse(localStorage.getItem(KIT_KEY)) || {}); } catch (e) { /* storage blocked */ }
  return kit;
}
function saveKit(kit) {
  try { localStorage.setItem(KIT_KEY, JSON.stringify(kit)); } catch (e) { /* storage blocked */ }
}
const KIT_LABELS = { chair: 'Chair', band: 'Band', weights: 'Dumbbells' };
const PANEL_HEAD = new THREE.Vector3();

// Exercise vs rest look: rest gets a blue panel and a cyan countdown so it
// can't be mistaken for an exercise. Panels are nearly opaque: over
// passthrough, a see-through panel is hard to read (Quest test).
const LOOK = {
  exercise: { bg: '#000000', opacity: 0.88, counter: '#ffeb3b' },
  rest: { bg: '#0b3d5c', opacity: 0.92, counter: '#80deea' },
};
// Seconds before the end of a rest when the title turns to "GET READY"
// (together with the countdown beeps).
const GET_READY = 3;
// Counter pop on every move: how long (s) and how much bigger at first.
const POP = 0.35;
const POP_SCALE = 0.35;
// Confetti pieces for a step done, and for the last one.
const CONFETTI_STEP = 90;
const CONFETTI_FINISH = 260;
const CONFETTI_AT = new THREE.Vector3();
const CONFETTI_DIR = new THREE.Vector3();

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
    // Demo avatars: on the exercise panel, and a small one on the floor
    // counter (floor exercises). Both show the same pose.
    this.mannequin = buildMannequin(document.querySelector('#demoAvatar'), 'mannequin');
    this.floorMannequin = buildMannequin(document.querySelector('#floorAvatar'), 'floorMannequin');
    this.current = null;
    this.run = null;
    this.clock = 0;
    this.lastMoves = 0;
    this.pop = POP;   // seconds since the counter last popped (see popCounter)
    this.confetti = document.querySelector('#confetti').components.confetti;
    this.hands = readHands(this.el.sceneEl);

    this.buildMenu();
    onClick(document.querySelector('#btnBack'), () => this.showMenu());
    onClick(this.skipBtn, () => this.handleEvents(skip(this.run)));
    // Recenter: panel buttons, B (right) / Y (left), and on entering AR.
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
  // Menu: a top row with two tabs, "Training sets" and "Single exercises",
  // plus Recenter. Under it, a row of group chips for the current tab
  // (training sets by level, exercises by position / equipment), then that
  // group's buttons. Each page's container holds all its buttons, in list
  // order (tests index them); only the current group's are shown, laid out
  // in order (showGroup()). The training sets page ends with the equipment
  // setting ("I have: Chair: yes ..."): sets needing missing equipment are
  // hidden. The
  // background fits the largest group, so switching doesn't resize it, and
  // the panel is raised or lowered so its middle is at MENU_CENTER_Y: it
  // never reaches into the floor.
  buildMenu: function () {
    const TOP = 1.0;       // top edge of the panel, relative to the panel entity
    const ROW_Y = 0.45;    // tabs + recenter row
    const CHIP_Y = 0.17;   // group chips row
    const PAGE_Y = 0.03;   // top of the pages
    const ROW = 0.27;      // page row height
    const WIDTH = 2.4;     // usable width
    const equipment = w => equipmentOf(w).map(e => EQUIPMENT_NAMES[e]).join(', ');
    this.pages = {
      sets: {
        tab: makeButton('Training sets', TAB.off, 0.95, 0.24, 2.2),
        container: document.querySelector('#workoutButtons'),
        items: WORKOUTS, cols: 2, width: 1.17, height: 0.24, textWidth: 2.0,
        groups: LEVELS.map(l => ({ id: l.toLowerCase(), name: l })), groupOf: w => w.level.toLowerCase(),
        label: w => equipment(w) ? `${w.name}\nwith ${equipment(w)}` : w.name,
        start: w => this.startWorkout(w),
        usable: w => equipmentOf(w).every(e => this.kit[e]),
      },
      single: {
        tab: makeButton('Single exercises', TAB.off, 0.95, 0.24, 2.2),
        container: document.querySelector('#menuButtons'),
        items: EXERCISES, cols: 3, width: 0.8, height: 0.22, textWidth: 0.74, wrapCount: 16,
        groups: GROUPS, groupOf,
        label: ex => ex.name, start: ex => this.startExercise(ex),
        usable: () => true,
      },
    };
    this.kit = loadKit();
    this.layout = { PAGE_Y, ROW };
    let rows = 0;
    Object.entries(this.pages).forEach(([name, page], i) => {
      page.tab.id = name === 'sets' ? 'tabSets' : 'tabSingle';
      page.tab.setAttribute('position', `${-0.775 + i * 1.0} ${ROW_Y} 0.01`);
      this.menuPanel.appendChild(page.tab);   // not in the container: it only holds buttons
      onClick(page.tab, () => this.showTab(name));
      // Group chips, across the full width.
      page.chips = document.createElement('a-entity');
      this.menuPanel.appendChild(page.chips);
      const chipW = (WIDTH - (page.groups.length - 1) * 0.06) / page.groups.length;
      page.chipButtons = page.groups.map((g, j) => {
        const chip = makeButton(g.name, CHIP.off, chipW, 0.18, 1.6);
        chip.id = 'group-' + g.id;
        chip.setAttribute('position', `${-WIDTH / 2 + chipW / 2 + j * (chipW + 0.06)} ${CHIP_Y} 0.01`);
        onClick(chip, () => this.showGroup(name, g.id));
        page.chips.appendChild(chip);
        return { chip, id: g.id };
      });
      // Buttons (placed by showGroup()).
      const counts = {};
      page.buttons = page.items.map(item => {
        const group = page.groupOf(item);
        counts[group] = (counts[group] || 0) + 1;
        const btn = makeButton(page.label(item), item.color, page.width, page.height, page.textWidth, page.wrapCount);
        onClick(btn, () => page.start(item));
        page.container.appendChild(btn);
        return { btn, group, item };
      });
      page.rows = Math.max(...Object.values(counts).map(n => Math.ceil(n / page.cols)));
      page.group = page.groups[0].id;
    });
    // Equipment setting, under the training sets.
    const sets = this.pages.sets;
    sets.kit = document.createElement('a-entity');
    this.menuPanel.appendChild(sets.kit);
    const kitY = PAGE_Y - ROW / 2 - sets.rows * ROW;
    const have = makeText('I have:', '#ccc', 1.6);
    have.setAttribute('position', `${-WIDTH / 2 + 0.2} ${kitY} 0.01`);
    sets.kit.appendChild(have);
    const kitW = 0.6;   // three buttons after the label, ending with the chips row
    sets.kitButtons = Object.keys(KIT_LABELS).map((k, j) => {
      const btn = makeButton('', CHIP.off, kitW, 0.2, 1.5);
      btn.id = 'kit-' + k;
      btn.setAttribute('position', `${WIDTH / 2 - kitW / 2 - (2 - j) * (kitW + 0.06)} ${kitY} 0.01`);
      onClick(btn, () => { this.kit[k] = !this.kit[k]; saveKit(this.kit); this.showGroup('sets', sets.group); });
      sets.kit.appendChild(btn);
      return { btn, k };
    });
    rows = Math.max(this.pages.single.rows, sets.rows + 1);
    document.querySelector('#btnRecenterMenu').setAttribute('position', `1.0 ${ROW_Y} 0.01`);
    const bottom = PAGE_Y - rows * ROW - 0.08;
    const bg = document.querySelector('#menuBg');
    bg.setAttribute('height', TOP - bottom);
    bg.setAttribute('position', `0 ${(TOP + bottom) / 2} 0`);
    this.menuPanel.object3D.position.y = MENU_CENTER_Y - (TOP + bottom) / 2;
    this.tab = 'sets';
  },
  showTab: function (name) {
    this.tab = name;
    for (const [n, page] of Object.entries(this.pages)) {
      const on = n === name;
      page.tab.setAttribute('material', 'color', on ? TAB.on : TAB.off);
      setShown(page.chips, on);
      if (page.kit) setShown(page.kit, on);
      if (on) this.showGroup(n, page.group);
      else setShown(page.container, false);
    }
  },
  // Show one group of a page (the page's tab must be the current one): its
  // usable buttons, in order, row by row.
  showGroup: function (pageName, groupId) {
    const page = this.pages[pageName];
    const { PAGE_Y, ROW } = this.layout;
    page.group = groupId;
    page.container.setAttribute('visible', true);
    let j = 0;
    for (const { btn, group, item } of page.buttons) {
      const shown = group === groupId && page.usable(item);
      setShown(btn, shown);
      if (!shown) continue;
      const col = j % page.cols, row = Math.floor(j / page.cols);
      btn.setAttribute('position', `${(col - (page.cols - 1) / 2) * (page.width + 0.06)} ${PAGE_Y - ROW / 2 - row * ROW} 0.01`);
      j++;
    }
    for (const { chip, id } of page.chipButtons) chip.setAttribute('material', 'color', id === groupId ? CHIP.on : CHIP.off);
    for (const { btn, k } of page.kitButtons || []) {
      btn.setAttribute('material', 'color', this.kit[k] ? CHIP.on : CHIP.off);
      btn.querySelector('a-text').setAttribute('value', `${KIT_LABELS[k]}: ${this.kit[k] ? 'yes' : 'no'}`);
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
    const low = head.position.y < FLOOR_HEAD_Y;
    const show = low || this.nearPanel(head);
    if (show !== this.floorLabel.getAttribute('visible')) this.floorLabel.setAttribute('visible', show);
    if (!show) return;
    this.floorLabelText.setAttribute('value', text);
    const o = this.floorLabel.object3D;
    if (!low || gazeY(head) > FACE_DOWN) {
      o.position.set(0, 0, -FACE_AHEAD).applyQuaternion(head.quaternion).add(head.position);
      o.quaternion.copy(head.quaternion);
      return;
    }
    const dir = this.headingOnFloor(head);
    o.position.set(head.position.x + dir.x * FLOOR_AHEAD, 0.01, head.position.z + dir.z * FLOOR_AHEAD);
    // Lie flat, with the top of the text pointing away from the user.
    o.rotation.set(-Math.PI / 2, Math.atan2(-dir.x, -dir.z), 0, 'YXZ');
  },
  // Is the head too close to the exercise panel to read it (or behind it)?
  nearPanel: function (head) {
    head.getWorldPosition(PANEL_HEAD);
    this.exercisePanel.object3D.worldToLocal(PANEL_HEAD);
    return PANEL_HEAD.z < NEAR_PANEL;
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
  // The Quest's own recenter (hold the Meta button, or the palm-up pinch
  // gesture with bare hands) resets the reference space: recenter the stage
  // too, a moment later, once the head pose has jumped.
  watchSystemRecenter: function () {
    const ref = this.el.sceneEl.xrSession && this.el.sceneEl.renderer.xr.getReferenceSpace();
    if (!ref || ref === this.watchedRef || !ref.addEventListener) return;
    this.watchedRef = ref;
    ref.addEventListener('reset', () => { this.recenterIn = 0.1; });
  },
  // See FOLLOW_ANGLE.
  followMenu: function (delta) {
    if (!this.el.sceneEl.is('ar-mode') || this.recenterIn !== null) { this.awayFor = 0; return; }
    const head = this.camera.object3D, stage = this.el.object3D;
    const dir = this.headingOnFloor(head);
    const turned = Math.abs(THREE.MathUtils.radToDeg(
      Math.atan2(Math.sin(Math.atan2(-dir.x, -dir.z) - stage.rotation.y), Math.cos(Math.atan2(-dir.x, -dir.z) - stage.rotation.y))));
    const moved = Math.hypot(head.position.x - stage.position.x, head.position.z - stage.position.z);
    this.awayFor = turned > FOLLOW_ANGLE || moved > FOLLOW_DISTANCE ? (this.awayFor || 0) + delta / 1000 : 0;
    if (this.awayFor >= FOLLOW_SECONDS) { this.awayFor = 0; this.recenter(); }
  },
  showMenu: function () {
    this.current = null;
    this.run = null;
    setShown(this.menuPanel, true);
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
    this.lastMoves = 0;
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
    this.lastMoves = 0;
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
    // Confetti for every step done (not skipped), and more when the whole
    // set is done, even if its last step was skipped.
    if (events.includes('finished')) this.throwConfetti(CONFETTI_FINISH);
    else if (events.includes('stepDone')) this.throwConfetti(CONFETTI_STEP);
    for (const e of events) {
      if (e === 'stepDone' && !events.includes('finished')) play('done');
      else if (e === 'finished') play('finish');
      else if (e === 'count') play('count');
      else if (e === 'go') play('go');
    }
    if (events.some(e => e !== 'count')) this.showStep();
  },
  tick: function (t, delta) {
    this.watchSystemRecenter();
    if (this.recenterIn !== null) {
      this.recenterIn -= delta / 1000;
      if (this.recenterIn <= 0) { this.recenterIn = null; this.recenter(); }
    }
    if (!this.current) { this.followMenu(delta); return; }
    this.clock += delta / 1000;
    const scene = this.el.sceneEl;
    const ctx = { scene, camera: this.camera, hands: readHands(scene, this.hands) };

    let text;
    if (this.run) {
      const run = this.run;
      const phase = run.phase, ex = run.ex, st = run.st, step = currentStep(run);
      const events = updateRun(run, ctx, delta);
      if (phase === 'exercise') {
        this.tickMoves(ex, st, events.includes('stepDone'));
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
      this.tickMoves(ex, st, false);
      text = ex.label(st);
    }
    this.repText.setAttribute('value', text);
    this.updateFloorLabel(text);
    this.popCounter(delta);
    const pose = this.current.ex ? this.current.ex.demo : idle;
    if (pose !== this.centered) this.centerAvatars(pose);
    const avatars = this.floorLabel.getAttribute('visible') ? [this.mannequin, this.floorMannequin] : [this.mannequin];
    for (const parts of avatars) {
      resetPose(parts);
      pose(parts, this.clock);
    }
  },
  // Center the demo avatars on a new pose (see centerDemo() in avatar.js).
  centerAvatars: function (pose) {
    this.centered = pose;
    centerDemo(this.mannequin, pose);
    this.floorMannequin.shiftX = this.mannequin.shiftX;
  },
  // Every move done (see movesOf()): the counter pops, and a ding plays
  // (paced exercises tick instead: that sound is their beat). quiet: the
  // step's last move, which gets the step's sound instead of a ding.
  tickMoves: function (ex, st, quiet) {
    const n = movesOf(ex, st);
    if (n > this.lastMoves) {
      this.pop = 0;
      if (ex.paced) play('rep');
      else if (!quiet) play('ding');
    }
    this.lastMoves = n;
  },
  // The counter grows for a moment, then eases back (this.pop = 0 starts it).
  popCounter: function (delta) {
    this.pop = Math.min(this.pop + delta / 1000, POP);
    const k = 1 - this.pop / POP;
    const s = 1 + POP_SCALE * k * k;
    this.repText.object3D.scale.setScalar(s);
    this.floorLabelText.object3D.scale.setScalar(s);
  },
  // A confetti burst in front of the face, wherever it looks (standing,
  // face down in a plank, or up at the ceiling).
  throwConfetti: function (count) {
    const head = this.camera.object3D;
    head.getWorldPosition(CONFETTI_AT);
    head.getWorldDirection(CONFETTI_DIR).negate();   // the camera looks along -Z
    CONFETTI_AT.addScaledVector(CONFETTI_DIR, 0.8);
    CONFETTI_AT.y = Math.max(CONFETTI_AT.y, 0.3);
    this.confetti.burst(CONFETTI_AT, count);
  }
};
