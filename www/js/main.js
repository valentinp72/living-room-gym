// Entry point. Module scripts run before the page finishes loading, and
// A-Frame waits for readyState 'complete' before initializing entities,
// so registering components here is early enough for the scene markup.
import { gymApp } from './app.js';
import { xrEnvironment } from './components/xr-environment.js';
import { xrPointer } from './components/xr-pointer.js';
import { confetti } from './components/confetti.js';

AFRAME.registerComponent('gym-app', gymApp);
AFRAME.registerComponent('xr-environment', xrEnvironment);
AFRAME.registerComponent('xr-pointer', xrPointer);
AFRAME.registerComponent('confetti', confetti);
