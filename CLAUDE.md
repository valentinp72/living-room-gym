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

## Architecture (current: single file `www/index.html`)

- `EXERCISES` array: the registry. Each entry has `id, name, muscle, color, instructions`, plus:
  - `state()` returns a fresh per-session state
  - `update(ctx, st, dtMs)` runs each frame; `ctx = { camera, rHand, lHand }` (A-Frame entities)
  - `label(st)` returns the counter text
  - `demo(parts, tSeconds)` poses the mannequin
  - `manual`: if true, shows the Start/Stop button instead of automatic detection
- `buildMannequin(sceneEl)` returns `{ root, shoulderL, shoulderR, hipL, hipR }` pivot entities.
- `gym-app` component (attached to `#menuPanel`) owns the UI state and the per-frame `tick`.
- Rig: `#rig > #camera` (with a gaze cursor), `#rightHand` and `#leftHand` (`laser-controls`). Interactive meshes use class `.clickable`.

The user wants this split into modules. Planned layout (not implemented yet; confirm before restructuring):

```
www/
  index.html            # scene markup only
  css/app.css
  js/main.js            # registers components, boots the app
  js/app.js             # gym-app component: menu / exercise flow
  js/avatar.js          # mannequin build + pose reset + joint helpers
  js/exercises/index.js # registry
  js/exercises/*.js     # one file per exercise
  js/tracking.js        # shared rep-detection helpers (calibration, hysteresis)
```

When splitting into ES modules, A-Frame components must be registered **before** the `<a-scene>` initializes. Module scripts are deferred, so either register components from a classic script placed before the scene, or check in the browser that the components still initialize.

## Coordinate and pose conventions (A-Frame / three.js)

- Units are meters. +Y is up, and the user starts looking toward **−Z**. An object in front of the user at `z = -2` faces the user through its **+Z** side.
- `rotation` is in **degrees** (XYZ Euler). For a limb hanging along −Y from a pivot, a positive X rotation swings it toward **−Z**, which is *away* from a user facing the avatar. Check the sign whenever you pose limbs.
- In an XR session with the default `local-floor` reference space, the camera's `position.y` is the real head height above the floor. On desktop it is the fixed `1.6`. Don't compute a calibration baseline until the session has started and the pose has settled.
- Controller entities report `0,0,0` until they are tracked. Treat that as "no data", not as a valid position.

## Known problems (to fix, see README "Known issues")

1. No AR: needs an `immersive-ar` session (`xr-mode-ui` / `webxr` settings), the background and floor hidden in AR (`hide-on-enter-ar`), and passthrough.
2. Curl rep counting: both hands share one counter (double counting), the "up" threshold is too high, and untracked controllers aren't ignored. Squat baseline is captured too early.
3. Mannequin: floats about 40 cm above the floor, has no elbows or knees, hip rotation sign is reversed, plank lies face-up, and the pose isn't reset between exercises.
4. Single-file codebase.

When the user says "bar push up" they mean the **Bicep Curls** exercise.

## Working style

- Match the existing code: plain modern JavaScript (no TypeScript), small functions, short explanatory comments, 2-space indent.
- Keep the "add an exercise = add one registry entry" property. New exercises should not require changes elsewhere.
- Test on desktop first (`https://localhost:8443`). Say clearly what can only be verified on a real Quest (tracking, AR, rep thresholds) instead of claiming it works.
