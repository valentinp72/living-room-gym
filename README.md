# XR Muscle Gym

A WebXR bodybuilding trainer for **Meta Quest**, built with [A-Frame](https://aframe.io).
Pick a **training set** (a fixed sequence of exercises with rep or time targets and rests
in between), or a single exercise. A demo avatar shows each movement, and the app counts
your reps (or times your holds) using headset tracking and either Touch controllers or
bare-hand tracking. Sounds confirm each finished exercise.

It is made for **AR (mixed reality)**: you train in your own room with Quest passthrough,
and the UI panels and demo avatar appear in it. A VR mode (virtual gym) is kept as a fallback.

It is a plain static web app. There is no build step and nothing to install beyond Python 3,
so it runs directly in the Quest Browser.

## Status

Early prototype. It runs in AR and VR on Quest and in a desktop browser (mouse look + click)
for testing. See [Known issues](#known-issues).

## Training sets

A training set runs its steps in order. Each step has a target in reps or seconds, and
there is a fixed rest between steps. Difficulty is configuration: an easier or harder
variant of a set is another entry with different reps, seconds and rest.

| Training set      | Level | Rest | Steps                                        |
|-------------------|-------|------|----------------------------------------------|
| Full body starter | Easy  | 20 s | 10 squats, 10 bicep curls (each arm), 20 s plank |

During a set, the panel shows the step (`1/3  SQUATS`) and progress (`4 / 10`). Rest looks
different on purpose: a blue panel with a cyan countdown, and the avatar just stands and
breathes. The title turns to `GET READY` for the last 3 seconds, and the next exercise's
demo appears only when it starts. **Skip** jumps to the next step or ends the rest early. Sounds:

| Sound           | When                                                     |
|-----------------|----------------------------------------------------------|
| Two-tone chime  | A step's target is reached                               |
| 3 short beeps   | The last 3 seconds of a rest                             |
| High beep       | The next step starts                                     |
| Fanfare         | The training set is complete                             |
| Tick            | Each rep of a *paced* exercise (see below)               |

Single exercises stay available in the menu, with no target, which is handy for testing
and debugging detection.

## Exercises

| Exercise    | Muscle group | Tracking                                              |
|-------------|--------------|-------------------------------------------------------|
| Squats      | Legs         | Automatic: headset height drop vs. calibrated standing height |
| Bicep Curls | Arms         | Automatic, per arm: hand / controller height relative to the headset |
| Plank Hold  | Abs          | Automatic timer: detects the plank from head height and tilt |

Exercises the headset and hands can't track (for example fire hydrants: on all fours,
only a leg moves) are **paced**: the app counts reps at a fixed tempo with a tick for each
one, and you follow along. See `www/js/exercises/paced.js`.

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
  button (bottom right) to train in your room. The **VR** button next to it opens the virtual
  gym instead. The panels and avatar appear 2 to 3 m in front of you. Whenever you move
  (for example to a free patch of floor), press **B / Y** or **Recenter** to bring them in
  front of you again.
- **Controllers or bare hands:** point with the controller laser and pull the trigger, or,
  with hand tracking on (Quest settings), put the controllers down, point with your hand and
  pinch your thumb and index finger to click. B / Y don't exist without controllers, so use
  the Recenter button on the panel instead.

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
        ├── avatar.js          # Jointed demo mannequin + posing helpers
        ├── tracking.js        # Shared tracking helpers (hand / controller poses, AR/VR/flat)
        ├── components/
        │   ├── xr-environment.js  # AR passthrough: transparent background, hides VR-only scenery
        │   └── xr-pointer.js      # XR pointing ray + click (controller trigger or pinch)
        └── exercises/
            ├── index.js       # EXERCISES registry (defines menu order)
            ├── paced.js       # Helper for untracked exercises: app-paced reps
            ├── squats.js
            ├── curls.js
            └── plank.js
```

The JavaScript uses native ES modules, so the page has to be served over HTTP(S).
Opening `index.html` directly from disk won't work.

### Adding a training set

Add an entry to `WORKOUTS` in `www/js/workouts.js`:

```js
{
  id: 'full-body-normal', name: 'Full body', level: 'Normal', color: '#00695c',
  rest: 15,
  steps: [
    { exercise: 'squats', reps: 15 },
    { exercise: 'curls', reps: 12 },
    { exercise: 'plank', seconds: 40 },
  ],
}
```

Steps use `reps` for exercises counted in reps and `seconds` for timed ones. A mistake
(unknown exercise, wrong unit, target ≤ 0) stops the app on load with an error that names
the set and step.

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
`label`.

The mannequin is reset to standing before every `demo` call, so a demo only sets the
joints that move. `www/js/avatar.js` lists the joints and the rotation directions.

## Known issues

1. **The plank is detected from the headset only.** Your head must be 25 to 80 cm above the
   floor and facing down. A knee plank, or kneeling on all fours with your face down, also
   counts.
2. **Only tested in simulation for AR.** AR mode has been checked in a desktop browser by
   simulating an AR session, not yet on a Quest.

## Roadmap

- [x] Split the code into ES modules (exercises, avatar, UI, rep-detection helpers) while
      keeping the no-build setup
- [x] AR / passthrough mode on Quest (with VR as a fallback)
- [x] Recenter the panels and avatar in front of the user (B / Y, panel button, on entering
      AR / VR)
- [x] Hand tracking: pinch to click, curls counted from bare hands
- [x] Automatic plank timer (no Start / Stop), with the counter shown on the floor under
      your face
- [ ] Room awareness in AR: keep the panels and avatar clear of real walls and furniture
- [x] A jointed avatar (elbows, knees, ankles, spine) standing on the floor next to the
      exercise panel, with its pose reset every frame
- [x] Robust Bicep Curls counting: per-arm counts, movement-based thresholds, ignores
      untracked controllers
- [x] Robust squat detection: calibrates standing height once still, recalibrates on
      entering / leaving VR or AR
- [ ] More exercises (push-ups, lunges, shoulder press, crunches, …)
- [x] Training sets with rep / time targets, rests, skip and sounds
- [ ] More training sets and difficulty levels, and new exercises (lunges, push-ups,
      fire hydrants, ...)
- [ ] Session history
- [x] Automated tests (headless browser, fake WebXR session)

## Tech

- [A-Frame 1.5.0](https://aframe.io/docs/1.5.0/) (loaded from jsDelivr)
- WebXR Device API (Meta Quest Browser)
- Python 3 standard library for the dev server
