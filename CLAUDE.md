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

**Tests** (`tests/`): each suite is a standalone script `node <suite>.mjs <url> [screenshotPrefix]` that exits non-zero on failure; `run.mjs` serves `www/` on a free port and runs them (list in `SUITES`). `lib.mjs` launches headless Chrome with software WebGL (`$CHROME` overrides the path). `fakexr.mjs` installs a fake WebXR session on the scene (`window.fakeXR.hands.{left,right}` = kind, pos, ray, lost; `fakeSelect(side)` = trigger / pinch); `fakeXR.ref` is the reference space, which can dispatch `reset` like the Quest's recenter. AR is entered as A-Frame does: `addState('ar-mode')` then `emit('enter-vr')` (A-Frame uses that event for AR too). `ar.mjs` also enters VR, only to check it gets refused. Suites read panel text and joint transforms directly, so renaming ids or labels means updating them. Run `npm test` after every change and add a suite (or checks) for new behaviour, including a regression check for each bug fix. They don't replace a real Quest: say what was only simulated.

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
  js/exercises/head-dip.js # headDip(): head goes down and up from a still top (squats, lunges, dips)
  js/exercises/hold.js     # hold(): timed holds (plank, side plank, wall sit), with "what's off" hints
  js/exercises/calibration.js # standing head height once still (headDip, hold with calibrate: true)
  js/exercises/all-fours.js   # allFours(): demo base pose (fire hydrants, bird dogs, donkey kicks)
```

- Exercise object: `id, name, muscle, color, instructions, unit ('reps' | 'seconds')`, plus:
  - `state()` returns a fresh per-session state
  - `update(ctx, st, dtMs)` runs each frame; `ctx = { scene, camera, hands }` (`camera` is the A-Frame entity; `hands` comes from `readHands()`)
  - `count(st)` returns progress toward a training-set target, in `unit` (curls: one rep = one curl with each arm; plank: total seconds held)
  - `label(st)` returns the counter text
  - `paced: true` (from `paced()`) marks untracked exercises: the app counts reps at a fixed tempo and plays a tick per rep
  - `equipment` (optional): `'chair' | 'band' | 'weights'`; `floor: true` for floor exercises. Together they give the menu group (`groupOf()` / `GROUPS` in `exercises/index.js`: Standing, Floor, Chair, Band, Weights). Everything must be doable at home with at most a chair, an elastic band or dumbbells. With a band or dumbbells in the hands the controllers can't be held, so those exercises must not rely on controllers (headset-tracked or paced).
  - `demo(parts, tSeconds)` poses the mannequin; it's reset to standing before every call
- Training sets (`js/workouts.js`): `{ id, name, level, color, rest, steps: [{ exercise, reps } | { exercise, seconds }] }`, validated on load by `validateWorkout()`. `level` is one of `LEVELS` (`Easy`, `Medium`, `Hard`): harder = more reps, longer holds, shorter rests (`workout.mjs` checks the averages go that way). The equipment a set needs comes from its exercises (`equipmentOf()` in `workout-runner.js`) and shows on its menu button. The product direction is **training sets first, with configurable difficulty** (same exercises, other targets / rest). Single exercises stay for testing and debugging. `workout-runner.js` is pure logic: `updateRun()` / `skip()` return events (`stepDone`, `count`, `go`, `finished`, and `skipped` from `skip()`, so skipping into a rest still refreshes the screen), and `app.js` turns them into sounds (`sound.js`) and panel updates. Rest must never look like an exercise: blue panel and cyan countdown (`LOOK` / `setLook()` in `app.js`), the mannequin idles (`idle()` in `avatar.js`) instead of demoing the next exercise, and the title turns to `GET READY` for the last 3 s together with the countdown beeps. The next exercise's demo only appears when its step starts.
- Sounds (`js/sound.js`): every finished step plays a sound (a fanfare for the last one), paced reps tick, and the rest counts down 3-2-1. Every other counted move plays a `ding` and pops the counter (`tickMoves()` / `popCounter()` in `app.js`). A move is what `movesOf()` in `exercises/index.js` returns: whole reps, 10 s of a hold, or an exercise's own `moves(st)` (curls: each arm's curl). A step's last move gets the step's sound instead of a ding. Browsers need a user gesture before audio plays, so handlers go through `onClick()` in `app.js`, which calls `unlockAudio()`.
- Confetti (`js/components/confetti.js`, on `#confetti`, directly in the scene since it's placed in world space from the head pose): `throwConfetti()` in `app.js` bursts it 80 cm along the gaze on every `stepDone` (not on skips), with more pieces on `finished` (also when the last step was skipped: the set is still done). The pieces land and lie flat on the floor (y = 0), then shrink away. One `InstancedMesh`, so it stays cheap on a Quest.
- Panels are nearly opaque (0.88; rest 0.92): the user found 0.65 too see-through over passthrough.
- Menu (`buildMenu()` / `showTab()` / `showGroup()` in `app.js`): a top row with two tabs (`#tabSets`, `#tabSingle`) and `#btnRecenterMenu`, a row of group chips for the current tab (`#group-easy` / `-medium` / `-hard`; `#group-standing` / `-floor` / `-chair` / `-band` / `-weights`), then that group's buttons. The "Training sets" page (`#workoutButtons`) is a 2-column grid, the "Single exercises" page (`#menuButtons`) a 3-column grid; long exercise names wrap to two lines. Each container holds all its page's buttons in list order (tests index them; keep squats, curls and plank as the first three), laid out per group; `page.buttons[i].group` says which. Hidden tabs and groups go through `setShown()` so their buttons can't catch clicks. Tests that click for real (mouse, rays) must pick the group first.
  - The background fits the largest group (currently 4 rows).
  - `buildMenu()` sets the panel's height so its middle is at `MENU_CENTER_Y`. `textfit` checks that it stays above the floor.
  - Beyond about 5 rows in a group, split the group.
  - Equipment setting (`#kit-chair`, `#kit-band`, `#kit-weights`, the last row of the Training sets page): toggles what the user has, saved in `localStorage` (`xr-muscle-equipment`, per headset, all yes by default). `showGroup()` hides sets needing missing equipment and lays out the rest from the first slot, so button positions depend on it. Single exercises aren't filtered (they're for testing).
- Text: A-Frame's default font only has basic Latin characters. An em dash (—), middle dot (·) or similar just disappears, so use plain `-`, `:` or `,`. Keep `a-text` `width` (its wrap width) inside the panel.
- Mannequin (`js/avatar.js`): joint tree `root > pelvis > spine > head / shoulderL,R > elbowL,R` and `pelvis > hipL,R > kneeL,R > ankleL,R`. `root` sits on the floor (y = 0) between the feet; `pelvis` is at `PELVIS_Y` when standing. Segment lengths are in `BODY`. Pose with `rot(el, x, y, z)` (degrees, writes `object3D` directly), `place(el, x, y, z)` and `turn(parts, deg)` (0 = facing the viewer, 90 = side view). `app.js` calls `resetPose()` every frame before `demo()`.
  - Look: rounded and friendly (the user found the old boxy one chunky and a bit scary). Body parts are capsules (`geometry="primitive: capsule"`, defined in `js/components/capsule.js` and registered by `avatar.js` itself, its only user) and spheres, in soft colors, with small eyes. Every body part has class `part` (tests measure them). Keep it slim, and keep the torso `BODY.torsoDepth` deep (lying poses rest on it).
  - `buildMannequin(holder, id)` builds one inside any holder entity, which places and scales it. There are two: `#demoAvatar` (45% size, in the exercise panel's frame, root id `mannequin`) and `#floorAvatar` (on the floor counter, root id `floorMannequin`). Both show the same pose. Demos always pose a full-size body standing on the holder's y = 0, seen from the holder's +Z.
  - `centerDemo()` shifts each demo sideways (`parts.shiftX`) so all its poses are centered in the frame, since lying poses stick out further on the legs' side. `app.js` calls it when the pose changes (`centerAvatars()`).
  - Props (`showChair()`, `showDumbbells()`, `showBand()`, `showWall()` in `avatar.js`): a chair (seat top at `CHAIR_SEAT_Y`), dumbbells in the hands, an elastic band stretched between two body points (`handOf()`, `kneeOf()`, `footOf()`; call it after posing), a wall. They have class `prop` (not `part`). `resetPose()` hides them all by taking their `object3D` out of the scene graph (invisible objects still count in `Box3.setFromObject()`), so a demo shows the ones it needs every frame.
  - `resetPose()` also resets each joint's Euler order to `XYZ`, so a demo may change it.
  - Side-view IK helpers work in the mannequin's own y/z plane: `legTo()` (ankle to a point, foot angle), `armTo()` (hand to a point), `along()`, `limbAngle()`, `lieOnBack()`, `onToesY()`. Use them to keep feet, hands and knees planted instead of hand-tuning angles.
  - Check a pose from the side, not only from the user's spot: `node tests/views.mjs <url> <prefix> [index:seconds ...]`.
  - `tests/avatar.mjs` checks that nothing goes below the floor and which parts touch it (and, for chair exercises, that hands / hips / feet are on the seat, never through it). Boxes against props are measured in the mannequin's own frame (`minZ` / `maxZ`), from the vertices: a world box rotated into that frame would grow. Add checks for any new demo.
  - Contact sheet of demos while working on them: see how `views.mjs` freezes the clock; screenshot from in front of the panel, the demos are turned to be seen from there.
- Display modes (`js/components/xr-environment.js`, on `<a-scene>`): in AR the scene background turns transparent (passthrough), and elements with class `flat-only` (the virtual floor, controller models) are hidden. A VR session is ended at once (`scene.exitVR()`). Don't set `background` on the scene directly; use `xr-environment="color: ..."`.
- Layout during an exercise: the exercise panel is straight ahead, facing the user (no tilt). Texts are in a column on the left (instructions, then the counter), and the demo avatar stands in a frame (`#demoFrame`) on the right, 30 cm in front of the panel so poses seen from the side don't cut through it.
  - `tests/avatar.mjs` checks that every demo, as seen from the user's eyes, stays inside the frame.
  - `tests/textfit.mjs` checks that the text column stays clear of the frame.
  - The menu panel is centered too.
- `gym-app` component (on `#stage` in the markup) owns the UI state, the per-frame `tick`, and `recenter()`.
- `#stage` holds everything placed relative to the user: both panels and the mannequin. Positions inside it assume the user stands at the stage origin looking toward −Z. `recenter()` moves the stage under the head and turns it to the head's yaw (or to where the top of the head points when looking down). It runs 0.5 s after entering AR, on B / Y, from `.recenter` buttons, and after the Quest's own recenter (the reference space's `reset` event, `watchSystemRecenter()`); leaving XR resets the stage. On the menu screen in AR, the menu also follows: turned more than 60° away from it or walked more than 1.5 m, for 1.5 s, and it recenters (`followMenu()`; a bare hand can't easily point at a menu behind you). Never during exercises, where people turn on the floor. Put new user-facing content inside `#stage`, not directly in the scene.
- Rig: `#rig > #camera`, `#rightPointer` / `#leftPointer` (`xr-pointer`), `#rightHand` / `#leftHand` (controller models + button events), `#floorLabel`. Buttons get class `button`; raycasters target `.clickable`, which `setShown()` in `app.js` adds only while a button is visible. A-Frame raycasters ignore `visible`, so hidden buttons would otherwise steal clicks. Always show or hide UI with `setShown()`, never with `setAttribute('visible')` alone.
- Shared tracking and rep-detection helpers go in `js/tracking.js`. Exercises get `ctx.hands = readHands(scene)`: `{ left, right }`, each `{ tracked, kind: 'controller' | 'hand' | null, position, emulated, rayTracked, ray }`. `emulated` = position only estimated (don't detect moves with it), and `ray` = pointing direction (the laser). It is read straight from the WebXR session (grip space, or the wrist joint for hands without one), so controllers and bare hands work the same. Never read hand positions from the `#rightHand` / `#leftHand` entities: they only cover controllers, and they freeze at their last position when tracking is lost.
- Plank (`js/exercises/plank.js`) is automatic, with no buttons. A hold starts when the head is 15 to 60 cm above the floor and the face points at least 40° down. Its average height over that first second becomes the reference, and the hold then continues while the head stays within 10 cm below and 12 cm above it, with the face at least 30° down. History: a fixed 25 to 80 cm / 60° window missed real planks (the floor height is the Quest's estimate, and a forearm plank puts the headset only 25 to 45 cm up). A loose fixed window for holds (5 to 95 cm) kept counting when the user lay down or almost sat up. The window relative to the start height fixes both. Looking up (lying on the back) never counts. The timer starts after 1 s in position (and counts it) and stops after 1 s out of position (without counting it). Below 90 cm, when not in position, the counter says what's off with the measured value (`Head lower (85 cm)`, `Face the floor (10 deg)`), so the user can report numbers for tuning. Keep exercises hands-free and automatic; the user asked for no Start/Stop.
- Face counter (`#floorLabel` in `#rig`, `updateFloorLabel()` in `app.js`): during any exercise, while the head is below 0.9 m or less than 0.9 m from the exercise panel's plane (leaning toward it over a chair: the panel is then too close to read), the counter shows near the face, with the small demo avatar (`#floorAvatar`) on its right. Low and facing the floor (gaze y < -0.5: plank, push-ups), it lies on the floor 20 cm ahead of the face, reading away from the user. Otherwise (lying on the back, side plank, near the panel) it floats 70 cm in front of the face, facing it. Don't put it where the user must look down during an exercise that needs the head up: on the Quest the side plank failed because the user looked down at the floor counter. Keep counter labels short, since this label is small (`textfit` checks every exercise's counter fits left of the avatar).
- Input: there is exactly **one click path per mode**. In XR, `xr-pointer` (`js/components/xr-pointer.js`, `#rightPointer` / `#leftPointer`) handles both controllers and bare hands. Its ray follows the hand's WebXR target ray, and the session `select` event (trigger or pinch) from that hand clicks the first `.clickable` hit, once. On desktop, `cursor="rayOrigin: mouse"` on `<a-scene>` handles clicks. **Never add another A-Frame `cursor` (and so no `laser-controls`)**: in A-Frame 1.5, every cursor that isn't `rayOrigin: mouse` subscribes to the XR session's selectstart/selectend from *all* hands on enter-vr. A leftover head-gaze cursor made every trigger or pinch also click whatever the head was facing. `#rightHand` / `#leftHand` (`oculus-touch-controls`) are only for A/B/X/Y events (their models are `flat-only`, so hidden in AR). There are no hand models: in AR the real hands show. Every action must be reachable without controllers (B / Y are only shortcuts).
- Bicep Curls (`js/exercises/curls.js`) counts each arm separately, with two detectors per arm, and a rep counts when either one sees a full curl. When a rep counts, both restart, so one curl never counts twice.
  - **Height:** the hand rises 30 cm above its lowest point to at least chest height (45 cm below the eyes), then drops 30 cm. The thresholds are relative, so they work across body sizes.
  - **Tilt (controllers only):** the laser's angle above the horizontal, measured toward where the head faces, rises 70° to at least 30°, then drops 70°.
  - Why two: Quest tracks controller *position* with the headset cameras. Out of view (arms at the sides, not looking at the hands), the position is only estimated (`emulated`) and lags or freezes, so the height detector ignores it. *Orientation* comes from the controllers' own sensors and stays right.
  - Bare hands have only the height detector and must stay in view. A rep in progress survives tracking gaps up to 1 s.
- Head-dip exercises (`headDip()` in `js/exercises/head-dip.js`) calibrate the top head height once the head stays within 3 cm for 1 s (`calibration.js`), and recalibrate whenever `xrMode(scene)` changes (flat page or `ar`). At the top, the baseline only moves up (so calibrating while sitting on the chair before dips corrects itself). A rep = head `down` below the baseline, then back within `up` (8 cm by default). Depths: squats, lunges, goblet squats 25 cm; chair squats, Romanian deadlifts 30 cm; split squats 20 cm; chair dips 15 cm (back within 6 cm, "Hold still at the top...").
- Timed holds (`hold()` in `js/exercises/hold.js`): `start(head, st)` / `keep(head, st)` return null or a short hint; once holding, `st.ref` is the average head height over the first second and `keep` allows only a small drift from it. `calibrate: true` first measures the standing height (`st.standY`).
  - Side plank: head 25 to 80 cm up, head tilted sideways (its up vector's y < 0.8, 37°) and looking ahead (|gaze y| < 0.6), so a plank (face down) or lying on the back doesn't count. Holding: within 10 cm below / 12 cm above the start, up y < 0.9, |gaze y| < 0.75. The first limits (53°, |gaze y| < 0.5) never started on a Quest.
  - Wall sit: head 30 to 80 cm below standing height, not bent over (gaze y > -0.6); holding: within 10 cm. Sitting on a chair counts too.
- Incline push-ups use `pushUpReps({ maxY: 1.3, faceDown: -0.4, down: 0.12, up: 0.09 })`: the head is higher and moves less than on the floor.
- Crunches (`js/exercises/crunches.js`): "lying" means the head is below 45 cm and looking up (`gazeY()` > 0.5). A rep = the head rises 12 cm above its lowest lying height, then drops 8 cm. Above 80 cm (sitting up) the rep in progress is dropped.
- Push-ups and knee push-ups (`pushUpReps()` in `js/exercises/push-ups.js`): face down (`gazeY()` < -0.5) with the head below 90 cm. A rep = the head drops 15 cm below its highest point, then rises 12 cm. Being out of position for less than 0.5 s keeps the rep in progress.
- Paced (untracked): leg raises, calf raises (the head only rises a few cm), glute bridges, fire hydrants, jumping jacks (hands overhead are out of view), mountain climbers, bird dogs, donkey kicks, band pull-aparts, band rows, band side steps, shoulder press, bent-over rows, lateral raises. A demo's cycle should match `secondsPerRep`, so the mannequin moves with the beat. For alternating exercises each side is one beat and one rep.

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
2. The plank is detected from the head only, so a knee plank or all-fours with the face down also counts. Push-ups, crunches and every exercise added with equipment are head-only too, and their thresholds are estimates not yet tried on a Quest. The wall sit counts sitting on a chair; the side plank only checks a low, sideways-tilted head.
3. AR has only been tested by simulating the session (`addState('ar-mode')` + `enter-vr`), not on a Quest.

## Working style

- Match the existing code: plain modern JavaScript (no TypeScript), small functions, short explanatory comments, 2-space indent.
- Keep the "add an exercise = add one registry entry" property. New exercises should not require changes elsewhere.
- Run `npm test` in `tests/`, then check on desktop (`https://localhost:8443`). Say clearly what can only be verified on a real Quest (tracking, AR, rep thresholds) instead of claiming it works.
