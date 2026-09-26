# XR Muscle Gym

A WebXR bodybuilding trainer for **Meta Quest**, built with [A-Frame](https://aframe.io).
Pick a **training set** (a fixed sequence of exercises with rep or time targets and rests
in between), or a single exercise. A friendly demo avatar, framed on the exercise panel,
shows each movement (and a small one on the floor counter during floor exercises), and the app counts
your reps (or times your holds) using headset tracking and either Touch controllers or
bare-hand tracking. Every counted move gets a little ding and a pop of the counter, and each
finished exercise of a training set gets a chime and a burst of confetti.

It is made for **AR (mixed reality)**: you train in your own room with Quest passthrough,
and the UI panels and demo avatar appear in it. There is deliberately **no VR mode**:
exercising without seeing your surroundings could hurt you, so VR sessions are refused.

It is a plain static web app. There is no build step and nothing to install beyond Python 3,
so it runs directly in the Quest Browser.

## Status

Early prototype. It runs in AR on Quest, and in a desktop browser (mouse look + click)
for testing. See [Known issues](#known-issues).

## Training sets

A training set runs its steps in order. Each step has a target in reps or seconds, and
there is a fixed rest between steps. Sets come in three levels (a tab each in the menu):
harder levels have more reps, longer holds and shorter rests. Sets that need equipment say
so on their button (for example "with dumbbells, chair").

| Training set        | Level  | Rest | Equipment        | Steps |
|---------------------|--------|------|------------------|-------|
| Full body starter   | Easy   | 20 s |                  | 10 squats, 10 bicep curls (each arm), 20 s plank |
| Legs and glutes     | Easy   | 20 s |                  | 10 squats, 10 lunges, 10 fire hydrants, 10 glute bridges, 15 calf raises |
| Abs                 | Easy   | 20 s |                  | 10 crunches, 8 leg raises, 20 s plank, 10 crunches |
| Chest and arms      | Easy   | 25 s |                  | 8 knee push-ups, 10 curls, 8 knee push-ups, 10 curls |
| Chair basics        | Easy   | 25 s | chair            | 10 chair squats, 8 incline push-ups, 10 glute bridges, 6 chair dips, 8 bird dogs |
| Full body           | Medium | 15 s |                  | 15 squats, 10 push-ups, 16 lunges, 15 crunches, 15 glute bridges, 40 s plank |
| Core                | Medium | 15 s |                  | 15 crunches, 20 mountain climbers, 20 s side plank, 10 leg raises, 10 bird dogs, 40 s plank |
| Legs and glutes     | Medium | 15 s | (a wall)         | 15 squats, 16 lunges, 40 s wall sit, 16 donkey kicks, 15 glute bridges, 20 calf raises |
| Band workout        | Medium | 20 s | band             | 15 band pull-aparts, 16 band side steps, 15 band rows, 15 squats, 15 band pull-aparts, 15 glute bridges |
| Dumbbell full body  | Medium | 20 s | dumbbells        | 12 goblet squats, 10 shoulder presses, 12 bent-over rows, 12 Romanian deadlifts, 12 curls, 10 lateral raises |
| Full body challenge | Hard   | 12 s | chair            | 30 jumping jacks, 15 push-ups, 20 split squats, 30 mountain climbers, 15 chair dips, 60 s plank |
| Core crusher        | Hard   | 10 s |                  | 25 crunches, 15 leg raises, 40 s side plank, 40 mountain climbers, 16 bird dogs, 75 s plank |
| Leg day             | Hard   | 12 s | dumbbells, chair | 20 goblet squats, 15 Romanian deadlifts, 20 split squats, 60 s wall sit, 30 calf raises, 20 lunges |
| Upper body          | Hard   | 12 s | dumbbells, chair | 20 push-ups, 15 bent-over rows, 15 shoulder presses, 15 chair dips, 12 lateral raises, 15 curls |
| Cardio blast        | Hard   | 10 s |                  | 40 jumping jacks, 30 mountain climbers, 20 squats, 12 push-ups, 40 jumping jacks, 30 mountain climbers |

For exercises that alternate sides (mountain climbers, bird dogs, donkey kicks, fire
hydrants), each side counts as one rep.

During a set, the panel shows the step (`1/3  SQUATS`) and progress (`4 / 10`). Rest looks
different on purpose: a blue panel with a cyan countdown, and the avatar just stands and
breathes. The title turns to `GET READY` for the last 3 seconds, and the next exercise's
demo appears only when it starts. **Skip** jumps to the next step or ends the rest early. Sounds:

| Sound           | When                                                     |
|-----------------|----------------------------------------------------------|
| Ding            | A move is counted: a rep, one arm's curl, 10 s of a hold |
| Two-tone chime  | A step's target is reached (+ confetti)                  |
| 3 short beeps   | The last 3 seconds of a rest                             |
| High beep       | The next step starts                                     |
| Fanfare         | The training set is complete (+ more confetti)           |
| Tick            | Each rep of a *paced* exercise (see below)               |

The menu has two tabs: **Training sets** (by level: Easy, Medium, Hard), and **Single
exercises** (no target; by Standing, Floor, Chair, Band, Weights), which is handy for testing
and debugging detection.

## Exercises

All exercises can be done at home. Some need basic equipment: a sturdy **chair**, an
elastic **band**, or **dumbbells**. The demo avatar shows the equipment too.

| Exercise           | Muscle group | Equipment | Tracking |
|--------------------|--------------|-----------|----------|
| Squats             | Legs         |           | Automatic: headset height drop vs. calibrated standing height |
| Lunges             | Legs         |           | Automatic, like squats |
| Calf Raises        | Legs         |           | Paced, one every 2 s |
| Wall Sit           | Legs         | (a wall)  | Automatic timer: head 30 to 80 cm below the calibrated standing height, looking ahead |
| Jumping Jacks      | Cardio       |           | Paced, one every 1.5 s |
| Bicep Curls        | Arms         | (dumbbells optional, with bare hands) | Automatic, per arm: hand height relative to the headset, and controller tilt (works with the hands out of view) |
| Plank Hold         | Abs          |           | Automatic timer: detects the plank from head height and tilt |
| Side Plank         | Abs          |           | Automatic timer: head low, tilted sideways, looking ahead |
| Crunches           | Abs          |           | Automatic: lying on your back (head low, looking up), the head rises and comes back down |
| Leg Raises         | Abs          |           | Paced, one every 3 s |
| Mountain Climbers  | Abs          |           | Paced, one knee every 1 s |
| Push-ups           | Chest        |           | Automatic: face down with the head low, the head goes down and back up |
| Knee Push-ups      | Chest        |           | Automatic, like push-ups |
| Glute Bridges      | Glutes       |           | Paced, one every 3 s |
| Fire Hydrants      | Glutes       |           | Paced, one every 2.5 s, alternating legs |
| Donkey Kicks       | Glutes       |           | Paced, one every 2 s, alternating legs |
| Bird Dogs          | Back         |           | Paced, one every 3 s, alternating sides |
| Chair Dips         | Arms         | chair     | Automatic: calibrated at the top, the head drops 15 cm and comes back |
| Incline Push-ups   | Chest        | chair     | Automatic, like push-ups, with the head higher |
| Chair Squats       | Legs         | chair     | Automatic, like squats (the head drops 30 cm) |
| Split Squats       | Legs         | chair     | Automatic, like squats (20 cm) |
| Band Pull-Aparts   | Back         | band      | Paced, one every 2.5 s |
| Band Rows          | Back         | band      | Paced, one every 2.5 s |
| Band Side Steps    | Glutes       | band      | Paced, one step every 1.5 s |
| Goblet Squats      | Legs         | dumbbell  | Automatic, like squats |
| Romanian Deadlifts | Glutes       | dumbbells | Automatic, like squats (the head drops 30 cm) |
| Shoulder Press     | Shoulders    | dumbbells | Paced, one every 2.5 s |
| Bent-over Rows     | Back         | dumbbells | Paced, one every 2.5 s |
| Lateral Raises     | Shoulders    | dumbbells | Paced, one every 3 s |

With a band or dumbbells in your hands, controllers don't fit, so exercises that need them
don't use the controllers: put them down (or use hand tracking to click). Timed holds show
what's off when you're close but not in position (for example `Head lower (85 cm)`).

Exercises the headset and hands can't track (on the floor with only the legs moving, or a
head movement too small to tell apart) are **paced**: the app counts reps at a fixed tempo
with a tick for each one, and you follow along. See `www/js/exercises/paced.js`.

When the panels are out of sight or too close to read (on the floor, or leaning toward the
panel over a chair), the counter follows your face: on the floor under it when facing down
(plank, push-ups), or floating in front of it otherwise (lying on your back, side plank).

On the Training sets tab, the last row says which equipment you have (**Chair**, **Band**,
**Dumbbells**). Sets that need something you don't have are hidden. The headset remembers it.

## Running locally

WebXR only works in a **secure context**, so the Quest must load the page over HTTPS.
`server.py` serves `www/` over HTTPS using a self-signed certificate.

```sh
# 1. (Once) generate a self-signed certificate, if cert.pem / key.pem don't exist yet
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout key.pem -out cert.pem -subj "/CN=vr-muscle"

# 2. Start the server (serves ./www on port 8443)
python3 server.py
```

Then:

- **Desktop:** open `https://localhost:8443`, accept the certificate warning, look around
  with the mouse, and click the panels.
- **Meta Quest:** make sure the headset is on the same network, open the Quest Browser at
  `https://<your-computer-LAN-IP>:8443`, accept the certificate warning, then tap the **AR**
  button (bottom right) to train in your room. The panels appear about 2 m in front of you. Whenever you move
  (for example to a free patch of floor), press **B / Y** or **Recenter** to bring them in
  front of you again, or use the Quest's own recenter (hold the Meta button, or the palm-up
  pinch with bare hands). On the menu, the panel also follows you when you turn away or walk
  off for a moment.
- **Controllers or bare hands:** point with the controller laser and pull the trigger, or,
  with hand tracking on (Quest settings), put the controllers down, point with your hand and
  pinch your thumb and index finger to click. B / Y don't exist without controllers, so use
  the Recenter button on the panel or the Quest's recenter gesture instead.

> `key.pem` is a private key. Never commit it or publish it.

## Tests

`tests/` holds headless browser tests (Node 18+ and a local Chrome or Chromium; the app
itself still has no build step). They load the real page, simulate head poses and fake a
WebXR session with controllers or bare hands, then check rep counts, clicks, the avatar's
poses, AR display, recentering and training sets.

```sh
cd tests
npm install              # once: puppeteer-core only (it doesn't download a browser)
npm test                 # all suites; prints the details of failing ones
node run.mjs plank curls # some suites only (VERBOSE=1 prints every check)
```

The browser is found automatically (Chromium from snap or apt, Google Chrome, or the macOS
apps). Set `CHROME=/path/to/chrome` to pick another one. `run.mjs` serves `www/` itself on
a free port. To run one suite against a server that is already running, or to get
screenshots: `node tests/workout.mjs http://127.0.0.1:8000/ /tmp/shot` (several suites take
a screenshot prefix as second argument). `views.mjs` isn't a test: it screenshots every demo
pose from several sides.

What they can't check: real tracking and passthrough, and whether the rep thresholds suit
a real body. Those still need a Quest.

## Project structure

```
.
├── server.py                  # Minimal HTTPS static server for ./www (port 8443)
├── cert.pem / key.pem         # Self-signed TLS cert + private key (local dev only, not committed)
├── tests/                     # Headless browser tests (puppeteer-core), see "Tests"
└── www/
    ├── index.html             # A-Frame scene markup (rig, floor, lights, #stage with UI panels)
    ├── css/app.css            # Page styles
    └── js/
        ├── main.js            # Entry point: registers A-Frame components
        ├── app.js             # gym-app component: menu, exercise screen, per-frame loop
        ├── workouts.js        # WORKOUTS: the training sets (data only)
        ├── workout-runner.js  # Runs a training set: steps, targets, rests, events
        ├── sound.js           # Feedback sounds (Web Audio, no files)
        ├── avatar.js          # Rounded, jointed demo mannequin + posing helpers
        ├── tracking.js        # Shared tracking helpers (hand / controller poses, AR / flat page)
        ├── components/
        │   ├── xr-environment.js  # AR passthrough (transparent background), refuses VR
        │   ├── xr-pointer.js      # XR pointing ray + click (controller trigger or pinch)
        │   ├── capsule.js         # "capsule" geometry for the mannequin's rounded limbs
        │   └── confetti.js        # Confetti bursts when a step is done
        └── exercises/
            ├── index.js       # EXERCISES registry (defines menu order)
            ├── paced.js       # Helper for untracked exercises: app-paced reps
            ├── head-dip.js    # Helper for head-dip exercises (squats, lunges, dips)
            ├── hold.js        # Helper for timed holds (plank, side plank, wall sit)
            ├── calibration.js # Standing head height, measured once still
            ├── all-fours.js   # Demo pose on all fours (fire hydrants, bird dogs...)
            └── <exercise>.js  # One file per exercise (29)
```

The JavaScript uses native ES modules, so the page has to be served over HTTP(S).
Opening `index.html` directly from disk won't work.

### Adding a training set

Add an entry to `WORKOUTS` in `www/js/workouts.js`:

```js
{
  id: 'full-body-plus', name: 'Full body plus', level: 'Medium', color: '#00695c',
  rest: 15,
  steps: [
    { exercise: 'squats', reps: 15 },
    { exercise: 'curls', reps: 12 },
    { exercise: 'plank', seconds: 40 },
  ],
}
```

`level` is `Easy`, `Medium` or `Hard` (the menu tab it's listed under). Steps use `reps` for
exercises counted in reps and `seconds` for timed ones. A mistake (unknown exercise, wrong
unit, target ≤ 0, unknown level) stops the app on load with an error that names the set and
step. The equipment a set needs is worked out from its exercises.

### Adding an exercise

Create `www/js/exercises/<name>.js`:

```js
import { rot, place, turn } from '../avatar.js';

export default {
  id: 'lunges', name: 'Lunges', muscle: 'Legs', color: '#6a1b9a',
  instructions: 'Step forward and lower your back knee…',
  unit: 'reps',                          // or 'seconds' for timed exercises
  state: () => ({ reps: 0 }),            // fresh state per session
  update(ctx, st, dtMs) { /* read ctx.scene / camera / hands */ },
  count: st => st.reps,                  // progress toward a training-set target, in `unit`
  label: st => 'Reps: ' + st.reps,       // live counter text
  demo(parts, t) { rot(parts.kneeL, 40); /* see avatar.js for joints */ },
};
```

Then import it in `www/js/exercises/index.js` and add it to the `EXERCISES` array.

For an exercise that can't be tracked, spread `paced({ secondsPerRep })` from
`exercises/paced.js` into it instead of writing `unit` / `state` / `update` / `count` /
`label`. `headDip()` and `hold()` do the same for head-dip reps and timed holds.

Set `equipment: 'chair' | 'band' | 'weights'` if it needs any, or `floor: true` for a floor
exercise: that's the menu group it goes in. Demos can show the equipment with
`showChair()`, `showDumbbells()`, `showBand()` and `showWall()` from `avatar.js`.

The mannequin is reset to standing before every `demo` call, so a demo only sets the
joints that move. `www/js/avatar.js` lists the joints and the rotation directions.

## Known issues

1. **The plank is detected from the headset only.** Your head must be 15 to 60 cm above the
   floor and facing down (at least 40°) to start. The hold then stops if your head drops 10 cm
   (lying down) or rises 12 cm (sitting back). When you are low but not in position, the counter
   says what is off, with the measured height or angle. A knee plank, or kneeling on all
   fours with your face down, also counts.
2. **New exercise thresholds are estimates.** Crunches (head rises 12 cm), push-ups (head
   drops 15 cm), lunges, and the exercises added with equipment (chair dips 15 cm, incline
   push-ups, split squats, Romanian deadlifts, wall sit, side plank) have only been checked
   with a simulated headset, not on a Quest. The wall sit also counts sitting on a real chair,
   and the side plank only checks that the head is low and tilted sideways.
3. **Curl thresholds are unconfirmed on a real Quest.** Curls with controllers are also
   detected from how much the controller tilts (70°, up to at least 30° above horizontal).
   These values are estimates. Bare hands must stay in the headset's view.
4. **Only tested in simulation for AR.** AR mode has been checked in a desktop browser by
   simulating an AR session, not yet on a Quest.

## Roadmap

- [x] Split the code into ES modules (exercises, avatar, UI, rep-detection helpers) while
      keeping the no-build setup
- [x] AR / passthrough mode on Quest (VR removed: unsafe to exercise without seeing the room)
- [x] Recenter the panels and avatar in front of the user (B / Y, panel button, on entering
      AR)
- [x] Hand tracking: pinch to click, curls counted from bare hands
- [x] Automatic plank timer (no Start / Stop), with the counter shown on the floor under
      your face
- [ ] Room awareness in AR: keep the panels and avatar clear of real walls and furniture
- [x] A jointed avatar (elbows, knees, ankles, spine) standing on the floor next to the
      exercise panel, with its pose reset every frame
- [x] Robust Bicep Curls counting: per-arm counts, movement-based thresholds, ignores
      untracked controllers
- [x] Robust squat detection: calibrates standing height once still, recalibrates on
      entering / leaving AR
- [x] More exercises: crunches, leg raises, push-ups, knee push-ups, lunges, calf raises,
      glute bridges, fire hydrants
- [x] Training sets with rep / time targets, rests, skip and sounds
- [x] Training sets per body area (legs and glutes, abs, chest and arms, full body)
- [x] Three difficulty levels (Easy, Medium, Hard), 15 training sets
- [x] Exercises with basic home equipment (chair, band, dumbbells), shown by the avatar
- [ ] Session history
- [x] Automated tests (headless browser, fake WebXR session)

## Tech

- [A-Frame 1.5.0](https://aframe.io/docs/1.5.0/) (loaded from jsDelivr)
- WebXR Device API (Meta Quest Browser)
- Python 3 standard library for the dev server
