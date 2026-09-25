// Building block for exercises the headset and hands can't track (e.g.
// fire hydrants: on all fours, only a leg moves). The app sets the tempo:
// one rep every `secondsPerRep`, each marked by a tick sound (the app plays
// it for any exercise with `paced: true`), and the user follows along.
//   export default { ...paced({ secondsPerRep: 2.5 }), id, name, muscle,
//     color, instructions, demo }
export function paced({ secondsPerRep }) {
  return {
    paced: true,
    unit: 'reps',
    state: () => ({ time: 0, reps: 0 }),
    update(ctx, st, dt) {
      st.time += dt / 1000;
      st.reps = Math.floor(st.time / secondsPerRep);
    },
    count: st => st.reps,
    label: st => 'Follow the beat: ' + st.reps,
  };
}
