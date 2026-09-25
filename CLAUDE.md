# CLAUDE.md

Guidance for Claude Code when working in this repository. See `README.md` for the user-facing overview.

## What this is

A WebXR bodybuilding trainer for Meta Quest, built with A-Frame and served as static files. Target device: **Meta Quest Browser**. Secondary target: a desktop browser for quick testing (mouse look + click).

## Commands

```sh
python3 server.py          # HTTPS static server for ./www on https://0.0.0.0:8443
```

There is no build step, no package manager, and no test suite (yet). Do not add a bundler or npm toolchain unless the user asks for one.

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
  js/app.js                # gym-app component: menu / exercise flow, per-frame tick
  js/avatar.js             # buildMannequin(): demo avatar + joint pivots
  js/tracking.js           # shared tracking helpers (isHandTracked)
  js/exercises/index.js    # EXERCISES registry (menu order)
  js/exercises/<name>.js   # one exercise per file, default export
```

- Exercise object: `id, name, muscle, color, instructions`, plus:
  - `state()` returns a fresh per-session state
  - `update(ctx, st, dtMs)` runs each frame; `ctx = { camera, rHand, lHand }` (A-Frame entities)
  - `label(st)` returns the counter text
  - `demo(parts, tSeconds)` poses the mannequin
  - `manual`: if true, shows the Start/Stop button instead of automatic detection
- `buildMannequin(sceneEl)` returns `{ root, shoulderL, shoulderR, hipL, hipR }` pivot entities.
- `gym-app` component (attached to `#menuPanel` in the markup) owns the UI state and the per-frame `tick`.
- Rig: `#rig > #camera` (with a gaze cursor), `#rightHand` and `#leftHand` (`laser-controls`). Interactive meshes use class `.clickable`.
- Shared tracking and rep-detection helpers go in `js/tracking.js`. Use `isHandTracked(handEl)` before reading a controller's position: it checks for a live WebXR pose (`tracked-controls-webxr` has a `controller` and a non-null `pose`).
- Bicep Curls (`js/exercises/curls.js`) counts each arm separately. A rep = the hand rises 30 cm above its lowest point to at least chest height (45 cm below the eyes), then drops 30 cm. The thresholds are relative, so they work across body sizes.

**Component registration timing:** A-Frame 1.5 delays entity initialization until `document.readyState === 'complete'`, and module scripts run before that, so registering components from `js/main.js` works with components declared in the markup. Keep all `AFRAME.registerComponent` calls in modules imported by `main.js`, not in code that runs lazily after load.

**Module scripts need HTTP(S).** Opening `index.html` via `file://` fails. Always use `server.py` (or `python3 -m http.server --directory www` for desktop-only testing).

## Coordinate and pose conventions (A-Frame / three.js)

- Units are meters. +Y is up, and the user starts looking toward **−Z**. An object in front of the user at `z = -2` faces the user through its **+Z** side.
- `rotation` is in **degrees** (XYZ Euler). For a limb hanging along −Y from a pivot, a positive X rotation swings it toward **−Z**, which is *away* from a user facing the avatar. Check the sign whenever you pose limbs.
- In an XR session with the default `local-floor` reference space, the camera's `position.y` is the real head height above the floor. On desktop it is the fixed `1.6`. Don't compute a calibration baseline until the session has started and the pose has settled.
- Controller entities report `0,0,0` until they are tracked. Treat that as "no data", not as a valid position.

## Known problems (to fix, see README "Known issues")

1. No AR: needs an `immersive-ar` session (`xr-mode-ui` / `webxr` settings), the background and floor hidden in AR (`hide-on-enter-ar`), and passthrough.
2. Squat rep counting: the standing baseline is captured on the first frame, possibly before entering VR.
3. Mannequin: floats about 40 cm above the floor, has no elbows or knees, hip rotation sign is reversed, plank lies face-up, and the pose isn't reset between exercises.

## Working style

- Match the existing code: plain modern JavaScript (no TypeScript), small functions, short explanatory comments, 2-space indent.
- Keep the "add an exercise = add one registry entry" property. New exercises should not require changes elsewhere.
- Test on desktop first (`https://localhost:8443`). Say clearly what can only be verified on a real Quest (tracking, AR, rep thresholds) instead of claiming it works.
