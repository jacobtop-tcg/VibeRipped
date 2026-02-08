/**
 * VibeRipped Rotation Engine
 *
 * Main entry point orchestrating rotation, cooldown, state, and output.
 * Transforms triggers into exercise prompts with zero friction.
 */

const { DEFAULT_POOL } = require('./lib/pool');
const { loadState, saveState } = require('./lib/state');
const { getNextExercise } = require('./lib/rotation');
const { checkCooldown, formatRemaining, COOLDOWN_MS } = require('./lib/cooldown');

/**
 * Formats exercise as crisp command prompt.
 *
 * Format: "{name} x{reps}"
 * Examples: "Pushups x15", "Wall sit x30"
 *
 * Zero motivational language, zero optionality, zero explanation.
 *
 * @param {{name: string, reps: number}} exercise - Exercise object
 * @returns {string} Crisp command string
 */
function formatPrompt(exercise) {
  return `${exercise.name} x${exercise.reps}`;
}

/**
 * Triggers the rotation engine.
 *
 * Flow:
 * 1. Load state from disk
 * 2. Check cooldown - if blocked, return cooldown response
 * 3. Get next exercise from pool
 * 4. Update state (lastTriggerTime, totalTriggered)
 * 5. Save state atomically
 * 6. Return exercise response
 *
 * @param {Array<{name: string, reps: number}>} [pool=DEFAULT_POOL] - Exercise pool
 * @param {Object} [options={}] - Options
 * @param {string} [options.statePath] - Override state path for testing
 * @param {boolean} [options.bypassCooldown] - Bypass cooldown check (for testing rotation)
 * @returns {Object} Exercise response or cooldown response
 */
function trigger(pool = DEFAULT_POOL, options = {}) {
  const fs = require('fs');
  const path = require('path');
  const { computePoolHash } = require('./lib/pool');
  const { createDefaultState } = require('./lib/state');

  // Determine state path
  const statePath = options.statePath || require('./lib/state').getStatePath();

  // Load state with custom path
  let state;
  try {
    const content = fs.readFileSync(statePath, 'utf8');
    state = JSON.parse(content);

    // Detect pool change
    const currentPoolHash = computePoolHash(pool);
    if (state.poolHash !== currentPoolHash) {
      console.error('Pool changed, resetting index');
      state.currentIndex = 0;
      state.poolHash = currentPoolHash;
    }

    // Bounds check
    if (state.currentIndex >= pool.length) {
      console.error('Index out of bounds, resetting');
      state.currentIndex = 0;
    }

    // Validate state structure
    if (typeof state.currentIndex !== 'number' ||
        typeof state.lastTriggerTime !== 'number' ||
        typeof state.poolHash !== 'string' ||
        typeof state.totalTriggered !== 'number') {
      console.error('State invalid, resetting');
      state = createDefaultState(pool);
    }
  } catch (e) {
    if (e.code === 'ENOENT') {
      console.error('No state file, initializing');
    } else {
      console.error('State corrupted, resetting');
    }
    state = createDefaultState(pool);
  }

  // Check cooldown (unless bypassed for testing)
  if (!options.bypassCooldown) {
    const cooldownStatus = checkCooldown(state.lastTriggerTime, COOLDOWN_MS);

    if (!cooldownStatus.allowed) {
      // Cooldown active - return remaining time (do NOT advance rotation)
      return {
        type: 'cooldown',
        remainingMs: cooldownStatus.remainingMs,
        remainingHuman: formatRemaining(cooldownStatus.remainingMs)
      };
    }
  }

  // Get next exercise (mutates state.currentIndex)
  const { exercise, previousIndex } = getNextExercise(state, pool);

  // Update state
  state.lastTriggerTime = Date.now();
  state.totalTriggered++;

  // Save state
  try {
    fs.mkdirSync(path.dirname(statePath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
  } catch (e) {
    console.error(`State save error: ${e.message}`);
  }

  // Return exercise response
  return {
    type: 'exercise',
    prompt: formatPrompt(exercise),
    exercise,
    position: {
      current: previousIndex,
      total: pool.length
    },
    totalTriggered: state.totalTriggered
  };
}

// CLI mode: if running directly, trigger and output JSON
if (require.main === module) {
  const result = trigger();
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = 0;
}

module.exports = {
  trigger
};
