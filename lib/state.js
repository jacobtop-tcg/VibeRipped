/**
 * State Persistence Module
 *
 * Provides atomic state persistence with graceful corruption recovery.
 * State survives crashes, restarts, and pool changes.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const writeFileAtomic = require('write-file-atomic');
const { computePoolHash } = require('./pool');

/**
 * Gets the directory for state storage (XDG Base Directory compliant).
 *
 * @returns {string} State directory path
 */
function getStateDir() {
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(configHome, 'viberipped');
}

/**
 * Gets the full path to state.json.
 *
 * @returns {string} State file path
 */
function getStatePath() {
  return path.join(getStateDir(), 'state.json');
}

/**
 * Creates a fresh default state object.
 *
 * @param {Array<{name: string, reps: number}>} pool - Exercise pool
 * @returns {Object} Default state with zeroed counters
 */
function createDefaultState(pool) {
  return {
    currentIndex: 0,
    lastTriggerTime: 0,
    poolHash: computePoolHash(pool),
    totalTriggered: 0,
    recentCategories: [],
    schemaVersion: "1.0"
  };
}

/**
 * Validates state object structure and field types.
 *
 * @param {*} state - State object to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateState(state) {
  if (!state || typeof state !== 'object') {
    return false;
  }

  // Check required fields exist and have correct types
  if (!Number.isInteger(state.currentIndex) || state.currentIndex < 0) {
    return false;
  }

  if (!Number.isInteger(state.lastTriggerTime) || state.lastTriggerTime < 0) {
    return false;
  }

  if (typeof state.poolHash !== 'string' || state.poolHash.length === 0) {
    return false;
  }

  if (!Number.isInteger(state.totalTriggered) || state.totalTriggered < 0) {
    return false;
  }

  // Validate optional recentCategories field (v1.1 schema extension)
  if (state.recentCategories !== undefined) {
    if (!Array.isArray(state.recentCategories)) {
      return false;
    }
    for (const category of state.recentCategories) {
      if (typeof category !== 'string') {
        return false;
      }
    }
  }

  // Validate optional schemaVersion field (v1.1 schema extension)
  if (state.schemaVersion !== undefined) {
    if (typeof state.schemaVersion !== 'string') {
      return false;
    }
  }

  return true;
}

/**
 * Loads state from disk with graceful recovery.
 *
 * Recovery behaviors:
 * - Missing file: Initialize with defaults
 * - Corrupt JSON: Reset to defaults
 * - Invalid fields: Reset to defaults
 * - Pool changed: Reset index, update hash
 * - Index out of bounds: Reset to 0
 *
 * NEVER throws - always returns a valid state.
 *
 * @param {Array<{name: string, reps: number}>} pool - Current exercise pool
 * @returns {Object} Valid state object
 */
function loadState(pool) {
  const statePath = getStatePath();
  const currentPoolHash = computePoolHash(pool);

  try {
    // Try to read state file
    const content = fs.readFileSync(statePath, 'utf8');

    // Try to parse JSON
    let state;
    try {
      state = JSON.parse(content);
    } catch (e) {
      console.error('State corrupted, resetting');
      return createDefaultState(pool);
    }

    // Validate structure
    if (!validateState(state)) {
      console.error('State invalid, resetting');
      return createDefaultState(pool);
    }

    // Detect pool change
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

    return state;

  } catch (e) {
    // ENOENT (file not found) or other read errors
    if (e.code === 'ENOENT') {
      console.error('No state file, initializing');
    } else {
      console.error(`State load error: ${e.message}, initializing`);
    }
    return createDefaultState(pool);
  }
}

/**
 * Saves state atomically to disk.
 *
 * Uses write-rename for crash safety. Creates state directory if needed.
 * Synchronous write is acceptable for Phase 1 (single trigger events).
 *
 * Does NOT throw - logs errors to stderr but continues.
 *
 * @param {Object} state - State object to persist
 */
function saveState(state) {
  try {
    // Create state directory with secure permissions (user-only)
    const stateDir = getStateDir();
    fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });

    // Atomic write with secure file permissions
    const statePath = getStatePath();
    writeFileAtomic.sync(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });

  } catch (e) {
    // Log but don't throw - engine should still return output even if save fails
    console.error(`State save error: ${e.message}`);
  }
}

module.exports = {
  getStatePath,
  getStateDir,
  createDefaultState,
  loadState,
  saveState,
  validateState
};
