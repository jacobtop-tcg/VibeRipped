/**
 * Rotation Logic Module
 *
 * Handles sequential rotation through exercise pool with modulo wrap.
 * Extended in Phase 11 with category-aware filtering to prevent consecutive
 * same-muscle-group exercises.
 *
 * Pure function (except for state mutation) - does NOT handle cooldown or persistence.
 */

/**
 * Maximum number of recent categories to track (ring buffer size).
 * Prevents consecutive exercises from the same category.
 */
const MAX_RECENT_CATEGORIES = 2;

/**
 * Gets the next exercise from the pool and advances rotation index.
 *
 * Phase 11 enhancement: Filters pool to exclude exercises from recently-used
 * categories before selection. Falls back to full pool if filter empties it
 * (single-category pool edge case).
 *
 * Mutates state.currentIndex and state.recentCategories in place.
 *
 * @param {Object} state - State object containing currentIndex and recentCategories
 * @param {Array<{name: string, reps: number, category?: string}>} pool - Exercise pool
 * @returns {{exercise: Object, previousIndex: number}} Exercise and index before advancement
 */
function getNextExercise(state, pool) {
  // Validate pool is not empty
  if (!pool || pool.length === 0) {
    throw new Error('Cannot select exercise: pool is empty');
  }

  // Initialize recentCategories if missing (v1.0 backward compat)
  if (!state.recentCategories) {
    state.recentCategories = [];
  }

  const recentCategories = state.recentCategories;

  // STAGE 1: Build filter predicate for category exclusion
  const isCandidateExercise = (exercise) => {
    // Allow uncategorized exercises (category=null or undefined)
    if (exercise.category === null || exercise.category === undefined) {
      return true;
    }
    // Exclude if category was used recently
    return !recentCategories.includes(exercise.category);
  };

  // STAGE 2: Find next exercise starting from currentIndex that passes filter
  const previousIndex = state.currentIndex;
  let exercise = null;
  let attemptsRemaining = pool.length;

  // Search for next valid exercise (with wrap-around)
  let searchIndex = state.currentIndex;
  while (attemptsRemaining > 0) {
    const candidate = pool[searchIndex];
    if (isCandidateExercise(candidate)) {
      exercise = candidate;
      break;
    }
    searchIndex = (searchIndex + 1) % pool.length;
    attemptsRemaining--;
  }

  // STAGE 3: Fallback if no exercise passes filter (single-category edge case)
  if (exercise === null) {
    console.error('Category filter produced empty pool (single-category pool), falling back to full pool');
    exercise = pool[state.currentIndex];
  }

  // STAGE 4: Advance index in full pool space (not candidate pool space)
  state.currentIndex = (state.currentIndex + 1) % pool.length;

  // STAGE 5: Update recentCategories (ring buffer pattern)
  // Only track non-null/non-undefined categories
  if (exercise.category !== null && exercise.category !== undefined) {
    state.recentCategories.push(exercise.category);

    // Bound size to prevent unbounded growth
    if (state.recentCategories.length > MAX_RECENT_CATEGORIES) {
      state.recentCategories.shift(); // Remove oldest
    }
  }

  return {
    exercise,
    previousIndex
  };
}

module.exports = {
  getNextExercise,
  MAX_RECENT_CATEGORIES
};
