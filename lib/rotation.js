/**
 * Rotation Logic Module
 *
 * Handles sequential rotation through exercise pool with modulo wrap.
 * Pure function (except for state mutation) - does NOT handle cooldown or persistence.
 */

/**
 * Gets the next exercise from the pool and advances rotation index.
 *
 * Mutates state.currentIndex in place (advances by 1 mod pool.length).
 *
 * @param {Object} state - State object containing currentIndex
 * @param {Array<{name: string, reps: number}>} pool - Exercise pool
 * @returns {{exercise: Object, previousIndex: number}} Exercise and index before advancement
 */
function getNextExercise(state, pool) {
  const previousIndex = state.currentIndex;
  const exercise = pool[previousIndex];

  // Advance index with modulo wrap
  state.currentIndex = (state.currentIndex + 1) % pool.length;

  return {
    exercise,
    previousIndex
  };
}

module.exports = {
  getNextExercise
};
