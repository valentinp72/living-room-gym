# XR Muscle Gym

A WebXR bodybuilding trainer for **Meta Quest**, built with [A-Frame](https://aframe.io).
Pick an exercise (legs, arms, abs, …), watch a demo avatar perform the movement, and let
the app count your reps (or time your holds) using headset and controller tracking.

It is made for **AR (mixed reality)**: you train in your own room with Quest passthrough,
and the UI panels and demo avatar appear in it. A VR mode (virtual gym) is kept as a fallback.

It is a plain static web app. There is no build step and nothing to install beyond Python 3,
so it runs directly in the Quest Browser.

## Status

Early prototype. It runs in AR and VR on Quest and in a desktop browser (mouse look + click)
for testing. See [Known issues](#known-issues).

## Exercises

| Exercise    | Muscle group | Tracking                                              |
|-------------|--------------|-------------------------------------------------------|
| Squats      | Legs         | Automatic: headset height drop vs. calibrated standing height |
| Bicep Curls | Arms         | Automatic, per arm: controller height relative to the headset |
| Plank Hold  | Abs          | Manual timer: Start / Stop button, or A / X on a controller |

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

> `key.pem` is a private key. Never commit it or publish it.

## Project structure

```
.
├── server.py                  # Minimal HTTPS static server for ./www (port 8443)
├── cert.pem / key.pem         # Self-signed TLS cert + private key (local dev only, not committed)
└── www/
    ├── index.html             # A-Frame scene markup (rig, floor, lights, #stage with UI panels)
    ├── css/app.css            # Page styles
    └── js/
        ├── main.js            # Entry point: registers A-Frame components
        ├── app.js             # gym-app component: menu, exercise screen, per-frame loop
        ├── avatar.js          # Jointed demo mannequin + posing helpers
        ├── tracking.js        # Shared tracking helpers (controller tracked? AR/VR/flat?)
        ├── components/
        │   └── xr-environment.js  # AR passthrough: transparent background, hides VR-only scenery
        └── exercises/
            ├── index.js       # EXERCISES registry (defines menu order)
            ├── squats.js
            ├── curls.js
            └── plank.js
```

The JavaScript uses native ES modules, so the page has to be served over HTTP(S).
Opening `index.html` directly from disk won't work.

### Adding an exercise

Create `www/js/exercises/<name>.js`:

```js
import { rot, place, turn } from '../avatar.js';

export default {
  id: 'lunges', name: 'Lunges', muscle: 'Legs', color: '#6a1b9a',
  instructions: 'Step forward and lower your back knee…',
  state: () => ({ reps: 0 }),            // fresh state per session
  update(ctx, st, dtMs) { /* read ctx.scene / camera / rHand / lHand */ },
  label: st => 'Reps: ' + st.reps,       // live counter text
  demo(parts, t) { rot(parts.kneeL, 40); /* see avatar.js for joints */ },
  // manual: true                         // show Start/Stop instead of auto-detection
};
```

Then import it in `www/js/exercises/index.js` and add it to the `EXERCISES` array.

The mannequin is reset to standing before every `demo` call, so a demo only sets the
joints that move. `www/js/avatar.js` lists the joints and the rotation directions.

## Known issues

1. **Only tested in simulation for AR.** AR mode has been checked in a desktop browser by
   simulating an AR session, not yet on a Quest.

## Roadmap

- [x] Split the code into ES modules (exercises, avatar, UI, rep-detection helpers) while
      keeping the no-build setup
- [x] AR / passthrough mode on Quest (with VR as a fallback)
- [x] Recenter the panels and avatar in front of the user (B / Y, panel button, on entering
      AR / VR)
- [ ] Room awareness in AR: keep the panels and avatar clear of real walls and furniture
- [x] A jointed avatar (elbows, knees, ankles, spine) standing on the floor next to the
      exercise panel, with its pose reset every frame
- [x] Robust Bicep Curls counting: per-arm counts, movement-based thresholds, ignores
      untracked controllers
- [x] Robust squat detection: calibrates standing height once still, recalibrates on
      entering / leaving VR or AR
- [ ] More exercises (push-ups, lunges, shoulder press, crunches, …)
- [ ] Sets, rest timers, and session history

## Tech

- [A-Frame 1.5.0](https://aframe.io/docs/1.5.0/) (loaded from jsDelivr)
- WebXR Device API (Meta Quest Browser)
- Python 3 standard library for the dev server
