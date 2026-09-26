# Developing Living Room Gym

Notes for working on the app. For what it is and how to use it, see the [README](README.md).
[CLAUDE.md](CLAUDE.md) has the detailed conventions and the reasons behind them (it's written
for coding agents, but it's the most complete reference for humans too).

The app is plain static files in `www/`: native ES modules and [A-Frame](https://aframe.io)
from a CDN, with no build step and no package manager. `tests/` is the only part with a
`package.json`.

## Running locally


WebXR only works in a **secure context**, so the Quest must load the page over HTTPS.
`server.py` serves `www/` over HTTPS using a self-signed certificate.

```sh
# 1. (Once) generate a self-signed certificate, if cert.pem / key.pem don't exist yet
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout key.pem -out cert.pem -subj "/CN=living-room-gym"

# 2. Start the server (serves ./www on port 8443)
python3 server.py
```

Then open `https://localhost:8443` on the computer, or `https://<your-computer-LAN-IP>:8443`
in the Quest Browser (same network), and accept the certificate warning. `server.py` tells
browsers not to cache, so a normal reload picks up your changes.

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
a screenshot prefix as second argument). `screenshots.mjs` regenerates the README's pictures in `docs/screenshots/` (serve `www/`, then
`node tests/screenshots.mjs <url> docs/screenshots`; it needs ImageMagick). `views.mjs` isn't a test either: it screenshots every demo
pose from several sides.

`LOW_FPS=8 npm test` renders pages at about 8 frames per second, like a slow CI runner:
suites must pass that way too (GitHub's runners are much slower than a desktop).

`WWW=/path/to/copy npm test` runs the suites against another copy of the app (the deploy
workflow uses it to test exactly what it publishes).

What they can't check: real tracking and passthrough, and whether the rep thresholds suit
a real body. Those still need a Quest.

## Deployment

`.github/workflows/pages.yml` publishes the app on GitHub Pages. On every push to `main`, it
copies `www/` and adds the commit id to every local file link (`app.js?v=1a2b3c4`, see
`.github/scripts/cache-bust.mjs`), so browsers never mix modules from two versions. It then
runs the whole test suite against that copy and deploys it only if everything passes. Pull
requests are built and tested but not deployed.

To set it up on a fork: repository **Settings > Pages > Source: GitHub Actions**, then push to
`main` (or run the workflow by hand from the **Actions** tab).

## Project structure

```
.
├── .github/                   # Deploy workflow (tests + GitHub Pages) and its cache-busting script
├── LICENSE                    # MIT
├── DEVELOPMENT.md             # This file
├── docs/screenshots/          # README pictures (tests/screenshots.mjs)
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

## How detection works

Everything is detected from the headset's position and orientation, plus the hands or
controllers for curls. Nothing uses the cameras (web pages can't).

- **Standing reps** (squats, lunges, chair and dumbbell squats, Romanian deadlifts, chair
  dips): the app measures your head height once you stand still for a second, then counts a
  rep each time your head drops by the exercise's depth (15 to 30 cm) and comes back up.
- **Floor reps:** push-ups count the head going down and up while you face the floor;
  crunches count it rising while you lie on your back, looking up.
- **Curls:** each arm separately, from the hand's height relative to your head, and with
  controllers also from how much the controller tilts (so it works with your hands out of view).
- **Timed holds** (plank, side plank, wall sit): the timer starts after 1 s in position and
  stops after 1 s out of it. A hold remembers the head height it started at, and stops if the
  head drops about 10 cm or rises about 12 cm from it. The plank starts with the head 15 to
  60 cm above the floor and the face at least 40 degrees down.
- **Paced exercises:** anything the headset can't see (only the legs moving, arms overhead,
  a band in the hands) is counted at a fixed tempo instead, with a tick per rep.

Thresholds were tuned by one person on a Quest 3. When something isn't counted, the counter's
hint (like `Head lower (85 cm)`) gives the numbers to report in an issue.

## Tech

- [A-Frame 1.5.0](https://aframe.io/docs/1.5.0/) (loaded from jsDelivr)
- WebXR Device API (Meta Quest Browser)
- Python 3 standard library for the dev server

## Ideas

- Session history: finished sets, streaks, progress over time.
- Custom training sets, built in the headset.
- Rep quality feedback (depth, tempo).
