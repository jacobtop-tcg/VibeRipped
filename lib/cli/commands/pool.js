/**
 * Pool Management Commands
 *
 * CLI handlers for listing, adding, and removing exercises from the pool.
 */

const fs = require('fs');
const path = require('path');
const writeFileAtomic = require('write-file-atomic');
const { computePoolHash } = require(path.join(__dirname, '../../pool'));
const { getStateDir } = require(path.join(__dirname, '../../state'));
const { validateExerciseName, validateReps } = require(path.join(__dirname, '../validation'));
const { success, error, info } = require(path.join(__dirname, '../output'));

/**
 * Gets path to pool.json.
 *
 * @returns {string} Pool file path
 */
function getPoolPath() {
  return path.join(getStateDir(), 'pool.json');
}

/**
 * Gets path to state.json.
 *
 * @returns {string} State file path
 */
function getStatePath() {
  return path.join(getStateDir(), 'state.json');
}

/**
 * Loads pool.json from disk.
 *
 * @returns {Array|null} Pool array if successful, null on error
 */
function loadPool() {
  const poolPath = getPoolPath();

  try {
    const content = fs.readFileSync(poolPath, 'utf8');
    const pool = JSON.parse(content);

    if (!Array.isArray(pool)) {
      error('Pool file is invalid (not an array)');
      return null;
    }

    if (pool.length === 0) {
      error('Pool is empty');
      return null;
    }

    return pool;
  } catch (e) {
    if (e.code === 'ENOENT') {
      error('No pool found. Run setup first: vibripped config --kettlebell');
    } else {
      error(`Failed to load pool: ${e.message}`);
    }
    return null;
  }
}

/**
 * Saves pool.json atomically.
 *
 * @param {Array} pool - Pool array to save
 * @returns {boolean} True if successful, false on error
 */
function savePool(pool) {
  const poolPath = getPoolPath();

  try {
    writeFileAtomic.sync(poolPath, JSON.stringify(pool, null, 2), { mode: 0o600 });
    return true;
  } catch (e) {
    error(`Failed to save pool: ${e.message}`);
    return false;
  }
}

/**
 * Updates state.json with new pool hash and resets rotation index.
 *
 * @param {string} newPoolHash - New pool hash
 */
function updateStateHash(newPoolHash) {
  const statePath = getStatePath();

  try {
    // Load existing state
    let state = {};
    try {
      const content = fs.readFileSync(statePath, 'utf8');
      state = JSON.parse(content);
    } catch (e) {
      // If state doesn't exist or is invalid, that's fine - it will initialize on next trigger
      if (e.code !== 'ENOENT') {
        console.error(`Warning: Could not load state.json: ${e.message}`);
      }
    }

    // Update hash and reset index
    state.poolHash = newPoolHash;
    state.currentIndex = 0;

    // Save state atomically
    writeFileAtomic.sync(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });

  } catch (e) {
    // Non-fatal - state will be corrected on next trigger
    console.error(`Warning: Could not update state.json: ${e.message}`);
  }
}

/**
 * List command - displays all exercises in pool.
 */
function list() {
  const pool = loadPool();
  if (!pool) {
    process.exit(1);
  }

  info(`Exercise pool (${pool.length} exercises):\n`);

  pool.forEach((exercise, i) => {
    let equipment = 'bodyweight';
    if (exercise.equipment && Array.isArray(exercise.equipment) && exercise.equipment.length > 0) {
      equipment = exercise.equipment.join(', ');
    }

    // Environment display
    const envs = exercise.environments
      ? exercise.environments.join(', ')
      : 'anywhere';

    // Type-aware display
    const display = exercise.type === 'timed'
      ? `${exercise.name} ${exercise.duration ?? exercise.reps}s`
      : `${exercise.name} x${exercise.reps}`;

    info(`  ${i + 1}. ${display} [${equipment}] (${envs})`);
  });

  process.exit(0);
}

/**
 * Add command - adds exercise to pool.
 *
 * @param {string} name - Exercise name
 * @param {string} repsStr - Reps value as string
 * @param {Object} [options={}] - Options
 * @param {string} [options.type='reps'] - Exercise type: 'reps' or 'timed'
 * @param {string} [options.duration] - Duration in seconds (for timed exercises)
 */
function add(name, repsStr, options = {}) {
  // Validate name
  const validatedName = validateExerciseName(name);
  if (validatedName === null) {
    error('Invalid exercise name (must be 1-50 characters)', 'vibripped pool add "Exercise name" <reps>');
    process.exit(1);
  }

  // Validate reps
  const validatedReps = validateReps(repsStr);
  if (validatedReps === null) {
    error('Invalid reps (must be integer 1-999)', 'vibripped pool add "Exercise name" <reps>');
    process.exit(1);
  }

  // Validate type option
  const exerciseType = options.type || 'reps';
  if (exerciseType !== 'reps' && exerciseType !== 'timed') {
    error('Invalid type (must be "reps" or "timed")', 'vibripped pool add "Exercise name" <reps> --type <reps|timed>');
    process.exit(1);
  }

  // Validate duration option if provided
  let validatedDuration = null;
  if (options.duration !== undefined) {
    const parsed = parseInt(options.duration, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 999) {
      error('Invalid duration (must be integer 1-999)', 'vibripped pool add "Exercise name" <reps> --duration <seconds>');
      process.exit(1);
    }
    validatedDuration = parsed;
  }

  // Parse environments option
  let environments = ['anywhere'];  // default
  if (options.environments !== undefined) {
    // Check for empty string
    if (options.environments === '' || options.environments.trim().length === 0) {
      error('Invalid environments (provide comma-separated list)', 'vibripped pool add "Exercise" 15 --environments "home,office"');
      process.exit(1);
    }
    const parsed = options.environments.split(',').map(e => e.trim()).filter(e => e.length > 0);
    if (parsed.length === 0) {
      error('Invalid environments (provide comma-separated list)', 'vibripped pool add "Exercise" 15 --environments "home,office"');
      process.exit(1);
    }
    environments = parsed;
  }

  // Load pool
  const pool = loadPool();
  if (!pool) {
    process.exit(1);
  }

  // Check for duplicate (case-insensitive)
  const nameLower = validatedName.toLowerCase();
  const duplicate = pool.find(ex => ex.name.toLowerCase() === nameLower);
  if (duplicate) {
    error(`Exercise "${validatedName}" already exists in pool`);
    process.exit(1);
  }

  // Build new exercise object
  const newExercise = {
    name: validatedName,
    reps: validatedReps,
    equipment: [],
    environments: environments
  };

  // Add type-specific fields
  if (exerciseType === 'timed') {
    newExercise.type = 'timed';
    if (validatedDuration !== null) {
      newExercise.duration = validatedDuration;
    }
  } else {
    newExercise.type = 'reps';
  }

  // Add to pool
  pool.push(newExercise);

  // Compute new hash
  const newPoolHash = computePoolHash(pool);

  // Save pool
  if (!savePool(pool)) {
    process.exit(1);
  }

  // Update state hash and reset index
  updateStateHash(newPoolHash);

  // Type-aware success message
  if (exerciseType === 'timed') {
    const displayValue = validatedDuration !== null ? validatedDuration : validatedReps;
    success(`Added "${validatedName}" ${displayValue}s to pool`);
  } else {
    success(`Added "${validatedName}" x${validatedReps} to pool`);
  }
  info('Rotation index reset to beginning.');

  process.exit(0);
}

/**
 * Remove command - removes exercise from pool.
 *
 * @param {string} name - Exercise name to remove
 */
function remove(name) {
  // Validate name is non-empty
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    error('Exercise name required', 'vibripped pool remove "Exercise name"');
    process.exit(1);
  }

  // Load pool
  const pool = loadPool();
  if (!pool) {
    process.exit(1);
  }

  // Find exercise (case-insensitive)
  const nameLower = name.trim().toLowerCase();
  const index = pool.findIndex(ex => ex.name.toLowerCase() === nameLower);

  if (index === -1) {
    error(`Exercise "${name.trim()}" not found in pool`);
    process.exit(1);
  }

  // Check if removing last exercise
  if (pool.length === 1) {
    error('Cannot remove last exercise from pool');
    process.exit(1);
  }

  // Store matched name for confirmation message
  const matchedName = pool[index].name;

  // Remove exercise
  pool.splice(index, 1);

  // Compute new hash
  const newPoolHash = computePoolHash(pool);

  // Save pool
  if (!savePool(pool)) {
    process.exit(1);
  }

  // Update state hash and reset index
  updateStateHash(newPoolHash);

  success(`Removed "${matchedName}" from pool`);
  info('Rotation index reset to beginning.');

  process.exit(0);
}

module.exports = {
  list,
  add,
  remove
};
