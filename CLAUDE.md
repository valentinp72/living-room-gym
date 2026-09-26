# CLAUDE.md

Guidance for Claude Code when working in this repository. See `README.md` for the user-facing overview.

## What this is

A WebXR bodybuilding trainer for Meta Quest, built with A-Frame and served as static files. Target device: **Meta Quest Browser**. Secondary target: a desktop browser for quick testing (mouse look + click).

**AR (passthrough) is the only immersive mode. There is no VR, on purpose:** exercising without seeing the real room could hurt the user. `xr-mode-ui="XRMode: ar"` offers only AR, and `xr-environment` ends any VR session that starts anyway. Don't add VR back. The flat desktop page stays for debugging. Design and test features for a user training in their real room: nothing should depend on the virtual floor or background, content must stay readable over passthrough, and anything that only works in VR is a bug.

## Commands

```sh
python3 server.py          # HTTPS static server for ./www on https://0.0.0.0:8443 (Cache-Control: no-cache)
```

```sh
cd tests && npm install    # once
cd tests && npm test       # all suites (node run.mjs <suite ...> for some)
```

The app has no build step and no package manager. `tests/` is the only place with a `package.json` (just `puppeteer-core`); never make `www/` depend on it, and don't add a bundler unless the user asks.

**Tests** (`tests/`): each suite is a standalone script `node <suite>.mjs <url> [screenshotPrefix]` that exits non-zero on failure; `run.mjs` serves `www/` on a free port and runs them (list in `SUITES`). `lib.mjs` launches headless Chrome with software WebGL (`$CHROME` overrides the path). `fakexr.mjs` installs a fake WebXR session on the scene (`window.fakeXR.hands.{left,right}` = kind, pos, ray, lost; `fakeSelect(side)` = trigger / pinch). AR is entered as A-Frame does: `addState('ar-mode')` then `emit('enter-vr')` (A-Frame uses that event for AR too). `ar.mjs` also enters VR, only to check it gets refused. Suites read panel text and joint transforms directly, so renaming ids or labels means updating them. Run `npm test` after every change and add a suite (or checks) for new behaviour, including a regression check for each bug fix. They don't replace a real Quest: say what was only simulated.

## Hard constraints

- **Static, no-build web app.** Everything under `www/` must work when served as-is. Load libraries from a CDN with an **exact pinned version** (currently `aframe@1.5.0`).
- **HTTPS is required** for WebXR on Quest; `server.py` handles that with `cert.pem` and `key.pem`.
- **Never commit, print or move `key.pem`.** If a git repo is initialized, `*.pem` must be in `.gitignore`.
- **A-Frame, not raw three.js**, for scene structure. Dropping down to `object3D` / `THREE` inside components is fine for math and performance.

## Architecture

Native ES modules, no bundler. `index.html` loads A-Frame (classic script), then `js/main.js` (module).

```
www/
  index.html               # scene markup only (rig, floor, lights, menu + exercise panels)
  css/app.css              # page styles (outside the 3D scene)
  js/main.js               # entry point: registers A-Frame components
  js/app.js                # gym-app component: menu, single exercises + training sets, per-frame tick
  js/workouts.js           # WORKOUTS: training sets, data only
  js/workout-runner.js     # runs a training set; pure logic returning events
  js/sound.js              # play(name) feedback sounds (Web Audio), unlockAudio()
  js/avatar.js             # jointed demo mannequin, resetPose + rot/place/turn helpers
  js/tracking.js           # shared tracking helpers (readHands, xrMode)
  js/components/*.js       # other A-Frame components (registered in main.js)
  js/exercises/index.js    # EXERCISES registry (menu order)
  js/exercises/<name>.js   # one exercise per file, default export
  js/exercises/paced.js    # paced(): building block for untracked exercises
  js/exercises/head-dip.js # headDip(): standing, head goes down and up (squats, lunges)
```

- Exercise object: `id, name, muscle, color, instructions, unit ('reps' | 'seconds')`, plus:
  - `state()` returns a fresh per-session state
  - `update(ctx, st, dtMs)` runs each frame; `ctx = { scene, camera, hands }` (`camera` is the A-Frame entity; `hands` comes from `readHands()`)
  - `count(st)` returns progress toward a training-set target, in `unit` (curls: one rep = one curl with each arm; plank: total seconds held)
  - `label(st)` returns the counter text
  - `paced: true` (from `paced()`) marks untracked exercises: the app counts reps at a fixed tempo and plays a tick per rep
  - `demo(parts, tSeconds)` poses the mannequin; it's reset to standing before every call
- Training sets (`js/workouts.js`): `{ id, name, level, color, rest, steps: [{ exercise, reps } | { exercise, seconds }] }`, validated on load by `validateWorkout()`. The product direction is **training sets first, with configurable difficulty** (same exercises, other targets / rest). Single exercises stay for testing and debugging. `workout-runner.js` is pure logic: `updateRun()` / `skip()` return events (`stepDone`, `count`, `go`, `finished`, and `skipped` from `skip()`, so skipping into a rest still refreshes the screen), and `app.js` turns them into sounds (`sound.js`) and panel updates. Rest must never look like an exercise: blue panel and cyan countdown (`LOOK` / `setLook()` in `app.js`), the mannequin idles (`idle()` in `avatar.js`) instead of demoing the next exercise, and the title turns to `GET READY` for the last 3 s together with the countdown beeps. The next exercise's demo only appears when its step starts.
- Sounds (`js/sound.js`): every finished step plays a sound (a fanfare for the last one), paced reps tick, and the rest counts down 3-2-1. Every other counted move plays a `ding` and pops the counter (`tickMoves()` / `popCounter()` in `app.js`). A move is what `movesOf()` in `exercises/index.js` returns: whole reps, 10 s of a hold, or an exercise's own `moves(st)` (curls: each arm's curl). A step's last move gets the step's sound instead of a ding.
- Confetti (`js/components/confetti.js`, on `#confetti`, directly in the scene since it's placed in world space from the head pose): `throwConfetti()` in `app.js` bursts it 80 cm along the gaze on every `stepDone` (not on skips), with more pieces on `finished`. The pieces land and lie flat on the floor (y = 0), then shrink away. One `InstancedMesh`, so it stays cheap on a Quest. Browsers need a user gesture before audio plays, so handlers go through `onClick()` in `app.js`, which calls `unlockAudio()`.
- Menu (`buildMenu()` / `showTab()` in `app.js`): a top row with two tabs (`#tabSets`, `#tabSingle`) and `#btnRecenterMenu`, then one page at a time. The "Training sets" page (`#workoutButtons`) is one column, and the "Single exercises" page (`#menuButtons`) is a 3-column grid in `EXERCISES` order. The containers hold only buttons (tests index them; keep squats, curls and plank as the first three). The hidden page goes through `setShown()` so its buttons can't catch clicks.
  - The background fits the longest page (currently 5 rows).
  - `buildMenu()` sets the panel's height so its middle is at `MENU_CENTER_Y`. `textfit` checks that it stays above the floor.
  - Beyond about 6 rows, add paging.
- Text: A-Frame's default font only has basic Latin characters. An em dash (—), middle dot (·) or similar just disappears, so use plain `-`, `:` or `,`. Keep `a-text` `width` (its wrap width) inside the panel.
- Mannequin (`js/avatar.js`): joint tree `root > pelvis > spine > head / shoulderL,R > elbowL,R` and `pelvis > hipL,R > kneeL,R > ankleL,R`. `root` sits on the floor (y = 0) between the feet; `pelvis` is at `PELVIS_Y` when standing. Segment lengths are in `BODY`. Pose with `rot(el, x, y, z)` (degrees, writes `object3D` directly), `place(el, x, y, z)` and `turn(parts, deg)` (0 = facing the viewer, 90 = side view). `app.js` calls `resetPose()` every frame before `demo()`.
  - Look: rounded and friendly (the user found the old boxy one chunky and a bit scary). Body parts are capsules (`geometry="primitive: capsule"`, defined in `js/components/capsule.js` and registered by `avatar.js` itself, its only user) and spheres, in soft colors, with small eyes. Every body part has class `part` (tests measure them). Keep it slim, and keep the torso `BODY.torsoDepth` deep (lying poses rest on it).
  - `buildMannequin(holder, id)` builds one inside any holder entity, which places and scales it. There are two: `#demoAvatar` (45% size, in the exercise panel's frame, root id `mannequin`) and `#floorAvatar` (on the floor counter, root id `floorMannequin`). Both show the same pose. Demos always pose a full-size body standing on the holder's y = 0, seen from the holder's +Z.
  - `centerDemo()` shifts each demo sideways (`parts.shiftX`) so all its poses are centered in the frame, since lying poses stick out further on the legs' side. `app.js` calls it when the pose changes (`centerAvatars()`).
  - Side-view IK helpers work in the mannequin's own y/z plane: `legTo()` (ankle to a point, foot angle), `armTo()` (hand to a point), `along()`, `limbAngle()`, `lieOnBack()`, `onToesY()`. Use them to keep feet, hands and knees planted instead of hand-tuning angles.
  - Check a pose from the side, not only from the user's spot: `node tests/views.mjs <url> <prefix> [index:seconds ...]`.
  - `tests/avatar.mjs` checks that nothing goes below the floor and which parts touch it. Add checks for any new demo.
- Display modes (`js/components/xr-environment.js`, on `<a-scene>`): in AR the scene background turns transparent (passthrough), and elements with class `flat-only` (the virtual floor, controller models) are hidden. A VR session is ended at once (`scene.exitVR()`). Don't set `background` on the scene directly; use `xr-environment="color: ..."`.
- Layout during an exercise: the exercise panel is straight ahead, facing the user (no tilt). Texts are in a column on the left (instructions, then the counter), and the demo avatar stands in a frame (`#demoFrame`) on the right, 30 cm in front of the panel so poses seen from the side don't cut through it.
  - `tests/avatar.mjs` checks that every demo, as seen from the user's eyes, stays inside the frame.
  - `tests/textfit.mjs` checks that the text column stays clear of the frame.
  - The menu panel is centered too.
- `gym-app` component (on `#stage` in the markup) owns the UI state, the per-frame `tick`, and `recenter()`.
- `#stage` holds everything placed relative to the user: both panels and the mannequin. Positions inside it assume the user stands at the stage origin looking toward −Z. `recenter()` moves the stage under the head and turns it to the head's yaw (or to where the top of the head points when looking down). It runs 0.5 s after entering AR, on B / Y, and from `.recenter` buttons, and leaving XR resets the stage. Put new user-facing content inside `#stage`, not directly in the scene.
- Rig: `#rig > #camera`, `#rightPointer` / `#leftPointer` (`xr-pointer`), `#rightHand` / `#leftHand` (controller models + button events), `#floorLabel`. Buttons get class `button`; raycasters target `.clickable`, which `setShown()` in `app.js` adds only while a button is visible. A-Frame raycasters ignore `visible`, so hidden buttons would otherwise steal clicks. Always show or hide UI with `setShown()`, never with `setAttribute('visible')` alone.
- Shared tracking and rep-detection helpers go in `js/tracking.js`. Exercises get `ctx.hands = readHands(scene)`: `{ left, right }`, each `{ tracked, kind: 'controller' | 'hand' | null, position, emulated, rayTracked, ray }`. `emulated` = position only estimated (don't detect moves with it), and `ray` = pointing direction (the laser). It is read straight from the WebXR session (grip space, or the wrist joint for hands without one), so controllers and bare hands work the same. Never read hand positions from the `#rightHand` / `#leftHand` entities: they only cover controllers, and they freeze at their last position when tracking is lost.
- Plank (`js/exercises/plank.js`) is automatic, with no buttons. A hold starts when the head is 15 to 60 cm above the floor and the face points at least 40° down. Its average height over that first second becomes the reference, and the hold then continues while the head stays within 10 cm below and 12 cm above it, with the face at least 30° down. History: a fixed 25 to 80 cm / 60° window missed real planks (the floor height is the Quest's estimate, and a forearm plank puts the headset only 25 to 45 cm up). A loose fixed window for holds (5 to 95 cm) kept counting when the user lay down or almost sat up. The window relative to the start height fixes both. Looking up (lying on the back) never counts. The timer starts after 1 s in position (and counts it) and stops after 1 s out of position (without counting it). Below 90 cm, when not in position, the counter says what's off with the measured value (`Head lower (85 cm)`, `Face the floor (10 deg)`), so the user can report numbers for tuning. Keep exercises hands-free and automatic; the user asked for no Start/Stop.
- Floor counter (`#floorLabel` in `#rig`, `updateFloorLabel()` in `app.js`): during any exercise, while the head is below 0.9 m, the counter text lies on the floor 20 cm ahead of the face, reading away from the user, with the small demo avatar (`#floorAvatar`) on its right. When the user looks up (lying on the back, gaze y > 0.5), it floats 70 cm in front of the face instead, facing it. Floor exercises need it because the panels are out of sight. Keep counter labels short, since this label is small (`textfit` checks every exercise's counter fits left of the avatar).
- Input: there is exactly **one click path per mode**. In XR, `xr-pointer` (`js/components/xr-pointer.js`, `#rightPointer` / `#leftPointer`) handles both controllers and bare hands. Its ray follows the hand's WebXR target ray, and the session `select` event (trigger or pinch) from that hand clicks the first `.clickable` hit, once. On desktop, `cursor="rayOrigin: mouse"` on `<a-scene>` handles clicks. **Never add another A-Frame `cursor` (and so no `laser-controls`)**: in A-Frame 1.5, every cursor that isn't `rayOrigin: mouse` subscribes to the XR session's selectstart/selectend from *all* hands on enter-vr. A leftover head-gaze cursor made every trigger or pinch also click whatever the head was facing. `#rightHand` / `#leftHand` (`oculus-touch-controls`) are only for A/B/X/Y events (their models are `flat-only`, so hidden in AR). There are no hand models: in AR the real hands show. Every action must be reachable without controllers (B / Y are only shortcuts).
- Bicep Curls (`js/exercises/curls.js`) counts each arm separately, with two detectors per arm, and a rep counts when either one sees a full curl. When a rep counts, both restart, so one curl never counts twice.
  - **Height:** the hand rises 30 cm above its lowest point to at least chest height (45 cm below the eyes), then drops 30 cm. The thresholds are relative, so they work across body sizes.
  - **Tilt (controllers only):** the laser's angle above the horizontal, measured toward where the head faces, rises 70° to at least 30°, then drops 70°.
  - Why two: Quest tracks controller *position* with the headset cameras. Out of view (arms at the sides, not looking at the hands), the position is only estimated (`emulated`) and lags or freezes, so the height detector ignores it. *Orientation* comes from the controllers' own sensors and stays right.
  - Bare hands have only the height detector and must stay in view. A rep in progress survives tracking gaps up to 1 s.
- Squats and lunges (`headDip()` in `js/exercises/head-dip.js`) calibrate standing head height once the head stays within 3 cm for 1 s, and recalibrate whenever `xrMode(scene)` changes (flat page or `ar`). While standing, the baseline only moves up. A rep = head 25 cm below the baseline, then back within 8 cm.
- Crunches (`js/exercises/crunches.js`): "lying" means the head is below 45 cm and looking up (`gazeY()` > 0.5). A rep = the head rises 12 cm above its lowest lying height, then drops 8 cm. Above 80 cm (sitting up) the rep in progress is dropped.
- Push-ups and knee push-ups (`pushUpReps()` in `js/exercises/push-ups.js`): face down (`gazeY()` < -0.5) with the head below 90 cm. A rep = the head drops 15 cm below its highest point, then rises 12 cm. Being out of position for less than 0.5 s keeps the rep in progress.
- Paced (untracked): leg raises, calf raises (the head only rises a few cm), glute bridges and fire hydrants. A demo's cycle should match `secondsPerRep`, so the mannequin moves with the beat.

**Component registration timing:** A-Frame 1.5 delays entity initialization until `document.readyState === 'complete'`, and module scripts run before that, so registering components from `js/main.js` works with components declared in the markup. Keep all `AFRAME.registerComponent` calls in modules imported by `main.js`, not in code that runs lazily after load.

**Browser cache:** the Quest Browser (and Firefox) cache each module separately. With a stale mix, a module that registers something (a geometry, a component) can be old while its user is new. `server.py` sends `Cache-Control: no-cache` for that reason, and whatever a module needs to be registered should be registered by that module (or one it imports), not only elsewhere.

**Module scripts need HTTP(S).** Opening `index.html` via `file://` fails. Always use `server.py` (or `python3 -m http.server --directory www` for desktop-only testing).

## Coordinate and pose conventions (A-Frame / three.js)

- Units are meters. +Y is up, and the user starts looking toward **−Z**. An object in front of the user at `z = -2` faces the user through its **+Z** side.
- `rotation` is in **degrees** (XYZ Euler). For a limb hanging along −Y from a pivot, a positive X rotation swings it toward **−Z**. The mannequin faces its own +Z, so for it, negative X = forward (hip flexion, raising an arm, bending the elbow) and positive X at the knee bends the shin back. For the spine (pointing +Y), positive X leans forward.
- In an XR session with the default `local-floor` reference space, A-Frame writes the headset pose straight into `#camera`'s `object3D` (`renderer.xr.setPoseTarget`), so `position.y` is the real head height above the floor and `quaternion` is the head orientation. On desktop it is the fixed `1.6`. Don't compute a calibration baseline until the session has started and the pose has settled.
- Hands and controllers can be untracked on any frame. Check `hand.tracked` before trusting a position.

## Known problems (see README "Known issues")

1. No awareness of real walls or furniture in AR. Recentering is manual (plus once on entering XR).
2. The plank is detected from the head only, so a knee plank or all-fours with the face down also counts. Push-ups and crunches are head-only too, and their thresholds are estimates not yet tried on a Quest.
3. AR has only been tested by simulating the session (`addState('ar-mode')` + `enter-vr`), not on a Quest.

## Working style

- Match the existing code: plain modern JavaScript (no TypeScript), small functions, short explanatory comments, 2-space indent.
- Keep the "add an exercise = add one registry entry" property. New exercises should not require changes elsewhere.
- Run `npm test` in `tests/`, then check on desktop (`https://localhost:8443`). Say clearly what can only be verified on a real Quest (tracking, AR, rep thresholds) instead of claiming it works.
