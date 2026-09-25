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
| Bicep Curls | Arms         | Automatic: controller height relative to the headset  |
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
├── server.py        # Minimal HTTPS static server for ./www (port 8443)
├── cert.pem         # Self-signed TLS certificate (local dev only)
├── key.pem          # TLS private key (local dev only, keep secret)
└── www/
    └── index.html   # The entire app: A-Frame scene, exercise registry, avatar, UI logic
```

Inside `www/index.html`:

- **`EXERCISES`**: the exercise registry. Each entry defines `state()`, `update()`,
  `label()`, `demo()` and optionally `manual`.
- **`buildMannequin()`**: builds the box/sphere demo avatar with pivots for shoulders and hips.
- **`gym-app` component**: builds the menu, switches between the menu and exercise screens,
  and drives `update` / `demo` every frame.
- **Scene markup**: camera rig, left/right `laser-controls`, floor, lights, and the menu
  and exercise panels.

### Adding an exercise

Push a new object into `EXERCISES`:

```js
{
  id: 'lunges', name: 'Lunges', muscle: 'Legs', color: '#6a1b9a',
  instructions: 'Step forward and lower your back knee…',
  state: () => ({ reps: 0 }),            // fresh state per session
  update(ctx, st, dtMs) { /* read ctx.camera / ctx.rHand / ctx.lHand */ },
  label: st => 'Reps: ' + st.reps,       // live counter text
  demo(parts, t) { /* pose parts.root / shoulderL/R / hipL/R */ },
  // manual: true                         // show Start/Stop instead of auto-detection
}
```

## Known issues

1. **VR only, no AR / passthrough.** The scene never asks for an `immersive-ar` session,
   draws an opaque background and a floor plane, and has no AR entry button, so Quest
   passthrough can't be used.
2. **Rep counting is unreliable** (reported for the arm exercise):
   - Curls: each hand is tracked separately and both increment the same `reps` counter,
     so curling both arms counts 2 reps.
   - Curls: the "up" threshold (hand within 15 cm below the eyes) is higher than a real
     curl reaches (hand at shoulder height, about 25 to 30 cm below the eyes), so reps can
     be missed.
   - Curls: an untracked controller sits at position `0,0,0`, which is read as "arm down".
   - Squats: the baseline height is taken from the first frame after selecting the
     exercise. If that happens before entering VR, or while the user is moving, every later
     rep is measured against the wrong height.
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
4. **Everything is in one file** (`www/index.html`). This makes it hard to navigate, test
   or extend.

## Roadmap

- [ ] Split the code into ES modules (exercises, avatar, UI, rep-detection helpers) while
      keeping the no-build setup
- [ ] AR / passthrough mode on Quest (with VR as a fallback)
- [ ] A jointed avatar (elbows, knees, spine) that is placed on the floor, faces the user,
      and resets its pose per exercise
- [ ] Robust rep detection: per-exercise calibration, hysteresis, per-arm counting,
      ignoring untracked controllers
- [ ] More exercises (push-ups, lunges, shoulder press, crunches, …)
- [ ] Sets, rest timers, and session history

## Tech

- [A-Frame 1.5.0](https://aframe.io/docs/1.5.0/) (loaded from jsDelivr)
- WebXR Device API (Meta Quest Browser)
- Python 3 standard library for the dev server
