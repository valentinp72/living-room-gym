// Entry point. Module scripts run before the page finishes loading, and
// A-Frame waits for readyState 'complete' before initializing entities,
// so registering components here is early enough for the scene markup.
import { gymApp } from './app.js';

AFRAME.registerComponent('gym-app', gymApp);
