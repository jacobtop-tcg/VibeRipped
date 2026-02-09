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
    info(`  ${i + 1}. ${exercise.name} x${exercise.reps} [${equipment}]`);
  });

  process.exit(0);
}

/**
 * Add command - adds exercise to pool.
 *
 * @param {string} name - Exercise name
 * @param {string} repsStr - Reps value as string
 */
function add(name, repsStr) {
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

  // Add new exercise (custom exercises have no equipment tag)
  pool.push({
    name: validatedName,
    reps: validatedReps,
    equipment: []
  });

  // Compute new hash
  const newPoolHash = computePoolHash(pool);

  // Save pool
  if (!savePool(pool)) {
    process.exit(1);
  }

  // Update state hash and reset index
  updateStateHash(newPoolHash);

  success(`Added "${validatedName}" x${validatedReps} to pool`);
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
