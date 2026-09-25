# XR Muscle Gym

A WebXR bodybuilding trainer for **Meta Quest**, built with [A-Frame](https://aframe.io).
Pick an exercise (legs, arms, abs, …), watch a demo avatar perform the movement, and let
the app count your reps (or time your holds) using headset and controller tracking.

It is a plain static web app. There is no build step and nothing to install beyond Python 3,
so it runs directly in the Quest Browser.

## Status

Early prototype. It works in VR on Quest and in a desktop browser (mouse look + click),
but has several known issues. See [Known issues](#known-issues).

## Exercises

| Exercise    | Muscle group | Tracking                                              |
|-------------|--------------|-------------------------------------------------------|
| Squats      | Legs         | Automatic: headset height drop vs. a baseline         |
| Bicep Curls | Arms         | Automatic, per arm: controller height relative to the headset |
| Plank Hold  | Abs          | Manual timer (Start / Stop button)                    |

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
  `https://<your-computer-LAN-IP>:8443`, accept the certificate warning, then tap **Enter VR**.

> `key.pem` is a private key. Never commit it or publish it.

## Project structure

```
.
├── server.py                  # Minimal HTTPS static server for ./www (port 8443)
├── cert.pem / key.pem         # Self-signed TLS cert + private key (local dev only, not committed)
└── www/
    ├── index.html             # A-Frame scene markup (rig, floor, lights, UI panels)
    ├── css/app.css            # Page styles
    └── js/
        ├── main.js            # Entry point: registers A-Frame components
        ├── app.js             # gym-app component: menu, exercise screen, per-frame loop
        ├── avatar.js          # Demo mannequin with shoulder / hip pivots
        ├── tracking.js        # Shared tracking helpers (is a controller tracked?)
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
export default {
  id: 'lunges', name: 'Lunges', muscle: 'Legs', color: '#6a1b9a',
  instructions: 'Step forward and lower your back knee…',
  state: () => ({ reps: 0 }),            // fresh state per session
  update(ctx, st, dtMs) { /* read ctx.camera / ctx.rHand / ctx.lHand */ },
  label: st => 'Reps: ' + st.reps,       // live counter text
  demo(parts, t) { /* pose parts.root / shoulderL/R / hipL/R */ },
  // manual: true                         // show Start/Stop instead of auto-detection
};
```

Then import it in `www/js/exercises/index.js` and add it to the `EXERCISES` array.

## Known issues

1. **VR only, no AR / passthrough.** The scene never asks for an `immersive-ar` session,
   draws an opaque background and a floor plane, and has no AR entry button, so Quest
   passthrough can't be used.
2. **Squat rep counting can be wrong.** The standing height is taken from the first frame
   after selecting the exercise. If that happens before entering VR, or while the user is
   moving, every later rep is measured against the wrong height.
3. **The demo avatar is misplaced and animates incorrectly:**
   - Its feet float about 40 cm above the floor (the torso sits at y = 1.1, and the
     hip pivot plus leg length only reach down to about y = 0.4).
   - It has no elbow or knee joints. The "curl" swings the whole straight arm (a front raise),
     and the "squat" rotates straight legs.
   - The hip rotation goes the wrong way: in the squat the legs swing backward instead
     of the thighs coming forward.
   - The plank rotation puts the avatar on its back (face up) instead of face down on
     its forearms.
   - The pose is never reset between exercises. After the plank, other demos inherit the
     lying-down rotation, and joint angles from earlier exercises carry over.

## Roadmap

- [x] Split the code into ES modules (exercises, avatar, UI, rep-detection helpers) while
      keeping the no-build setup
- [ ] AR / passthrough mode on Quest (with VR as a fallback)
- [ ] A jointed avatar (elbows, knees, spine) that is placed on the floor, faces the user,
      and resets its pose per exercise
- [x] Robust Bicep Curls counting: per-arm counts, movement-based thresholds, ignores
      untracked controllers
- [ ] Robust squat detection: calibrate standing height once in VR
- [ ] More exercises (push-ups, lunges, shoulder press, crunches, …)
- [ ] Sets, rest timers, and session history

## Tech

- [A-Frame 1.5.0](https://aframe.io/docs/1.5.0/) (loaded from jsDelivr)
- WebXR Device API (Meta Quest Browser)
- Python 3 standard library for the dev server
