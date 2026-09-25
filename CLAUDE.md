# CLAUDE.md

Guidance for Claude Code when working in this repository. See `README.md` for the user-facing overview.

## What this is

A WebXR bodybuilding trainer for Meta Quest, built with A-Frame and served as static files. Target device: **Meta Quest Browser**. Secondary target: a desktop browser for quick testing (mouse look + click).

**AR (passthrough) is the main mode; VR is only a fallback.** Design and test features for a user training in their real room: nothing should depend on the virtual floor or background, content must stay readable over passthrough, and anything that only works in VR is a bug.

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
  js/avatar.js             # jointed demo mannequin, resetPose + rot/place/turn helpers
  js/tracking.js           # shared tracking helpers (isHandTracked, xrMode)
  js/components/*.js       # other A-Frame components (registered in main.js)
  js/exercises/index.js    # EXERCISES registry (menu order)
  js/exercises/<name>.js   # one exercise per file, default export
```

- Exercise object: `id, name, muscle, color, instructions`, plus:
  - `state()` returns a fresh per-session state
  - `update(ctx, st, dtMs)` runs each frame; `ctx = { scene, camera, rHand, lHand }` (A-Frame entities)
  - `label(st)` returns the counter text
  - `demo(parts, tSeconds)` poses the mannequin; it's reset to standing before every call
  - `manual`: if true, shows the Start/Stop button instead of automatic detection
- Mannequin (`js/avatar.js`): joint tree `root > pelvis > spine > head / shoulderL,R > elbowL,R` and `pelvis > hipL,R > kneeL,R > ankleL,R`. `root` sits on the floor (y = 0) between the feet; `pelvis` is at `PELVIS_Y` when standing. Segment lengths are in `BODY`. Pose with `rot(el, x, y, z)` (degrees, writes `object3D` directly), `place(el, x, y, z)` and `turn(parts, deg)` (0 = facing the user). `app.js` calls `resetPose()` every frame before `demo()`. Keep the feet on the floor by computing the pelvis position from the leg angles (see squats), and check a pose from the side, not only from the user's spot.
- Display modes (`js/components/xr-environment.js`, on `<a-scene>`): in AR the scene background turns transparent (passthrough), and elements with class `vr-only` (the virtual floor) are hidden. In any headset mode, elements with class `flat-only` (the desktop gaze cursor) are hidden. Don't set `background` on the scene directly; use `xr-environment="color: ..."`. `xr-mode-ui="XRMode: xr"` shows both the AR and VR buttons.
- Layout during an exercise: the exercise panel is left of center and turned toward the user (`index.html`), and the mannequin stands to its right (`HOME` in `avatar.js`). The menu panel stays centered.
- `gym-app` component (attached to `#menuPanel` in the markup) owns the UI state and the per-frame `tick`.
- Rig: `#rig > #camera` (with a gaze cursor), `#rightHand` and `#leftHand` (`laser-controls`). Buttons get class `button`; raycasters target `.clickable`, which `setShown()` in `app.js` adds only while a button is visible. A-Frame raycasters ignore `visible`, so hidden buttons would otherwise steal clicks. Always show or hide UI with `setShown()`, never with `setAttribute('visible')` alone.
- Shared tracking and rep-detection helpers go in `js/tracking.js`. Use `isHandTracked(handEl)` before reading a controller's position: it checks for a live WebXR pose (`tracked-controls-webxr` has a `controller` and a non-null `pose`).
- Bicep Curls (`js/exercises/curls.js`) counts each arm separately. A rep = the hand rises 30 cm above its lowest point to at least chest height (45 cm below the eyes), then drops 30 cm. The thresholds are relative, so they work across body sizes.
- Squats (`js/exercises/squats.js`) calibrates standing head height once the head stays within 3 cm for 1 s, and recalibrates whenever `xrMode(scene)` changes (flat, `vr`, `ar`). While standing, the baseline only moves up. A rep = head 25 cm below the baseline, then back within 8 cm.

**Component registration timing:** A-Frame 1.5 delays entity initialization until `document.readyState === 'complete'`, and module scripts run before that, so registering components from `js/main.js` works with components declared in the markup. Keep all `AFRAME.registerComponent` calls in modules imported by `main.js`, not in code that runs lazily after load.

**Module scripts need HTTP(S).** Opening `index.html` via `file://` fails. Always use `server.py` (or `python3 -m http.server --directory www` for desktop-only testing).

## Coordinate and pose conventions (A-Frame / three.js)

- Units are meters. +Y is up, and the user starts looking toward **−Z**. An object in front of the user at `z = -2` faces the user through its **+Z** side.
- `rotation` is in **degrees** (XYZ Euler). For a limb hanging along −Y from a pivot, a positive X rotation swings it toward **−Z**. The mannequin faces its own +Z, so for it, negative X = forward (hip flexion, raising an arm, bending the elbow) and positive X at the knee bends the shin back. For the spine (pointing +Y), positive X leans forward.
- In an XR session with the default `local-floor` reference space, the camera's `position.y` is the real head height above the floor. On desktop it is the fixed `1.6`. Don't compute a calibration baseline until the session has started and the pose has settled.
- Controller entities sit at `0,0,0` until first tracked, and freeze at their last position when tracking is lost. Check `isHandTracked()` before trusting a position.

## Known problems (see README "Known issues")

1. AR content is placed relative to where the session starts (the `local-floor` origin), with no recentering and no awareness of the real floor or walls.
2. AR has only been tested by simulating the session (`addState('ar-mode')` + `enter-vr`), not on a Quest.

## Working style

- Match the existing code: plain modern JavaScript (no TypeScript), small functions, short explanatory comments, 2-space indent.
- Keep the "add an exercise = add one registry entry" property. New exercises should not require changes elsewhere.
- Test on desktop first (`https://localhost:8443`). Say clearly what can only be verified on a real Quest (tracking, AR, rep thresholds) instead of claiming it works.
