import { BODY, place, rot, turn, along, armTo, onToesY, showChair, CHAIR_SEAT_Y, CHAIR_SIZE, HAND, HAND_R } from '../avatar.js';
import { pushUpReps, tiltFor } from './push-ups.js';

// Push-ups with the hands on a chair: easier than on the floor. The head
// stays higher and moves less, and the user looks at the chair.
const HANDS_Y = CHAIR_SEAT_Y + HAND_R;
const TOP_Y = HANDS_Y + BODY.upperArm + HAND;   // shoulder heights
const BOTTOM_Y = HANDS_Y + 0.3;
const heightAt = deg => onToesY(deg) + BODY.shoulderY * Math.cos(deg * Math.PI / 180);
const TOP_TILT = tiltFor(TOP_Y, heightAt);
const HANDS_Z = along({ y: onToesY(TOP_TILT), z: 0 }, TOP_TILT, BODY.shoulderY).z;   // under the shoulders at the top

export default {
  ...pushUpReps({ maxY: 1.3, faceDown: -0.4, down: 0.12, up: 0.09 }),
  id: 'incline-push-ups', name: 'Incline Push-ups', muscle: 'Chest', color: '#c62828', equipment: 'chair',
  instructions: 'Put a sturdy chair against a wall. Hands on the front of the seat, body straight. Lower your chest to the seat, then push back up.',
  demo(parts, t) {
    const c = (1 - Math.cos(t * 2)) / 2;   // 0 = arms straight, 1 = chest low
    const tilt = tiltFor(TOP_Y + (BOTTOM_Y - TOP_Y) * c, heightAt);
    const pelvis = { y: onToesY(tilt), z: 0 };
    place(parts.pelvis, 0, pelvis.y, pelvis.z);
    rot(parts.pelvis, tilt);
    const shoulder = along(pelvis, tilt, BODY.shoulderY);
    for (const s of ['L', 'R']) armTo(parts, s, shoulder, tilt, { y: HANDS_Y, z: HANDS_Z }, -1);
    rot(parts.head, -20);
    showChair(parts, HANDS_Z + CHAIR_SIZE / 2 - 0.04, 180);   // front edge toward the user
    turn(parts, 90);
  }
};
