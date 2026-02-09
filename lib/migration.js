/**
 * Migration Module
 *
 * Handles automatic schema migration from v1.0 to v1.1 with backup creation.
 * Migration is idempotent and safe to run multiple times.
 */

const fs = require('fs');
const path = require('path');
const writeFileAtomic = require('write-file-atomic');

/**
 * Creates backup of file if backup doesn't already exist.
 *
 * @param {string} filePath - Path to file to back up
 * @returns {string} Path to backup file
 */
function createBackup(filePath) {
  const backupPath = filePath + '.v1.0.backup';

  if (!fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
  }

  return backupPath;
}

/**
 * Migrates configuration file from v1.0 to v1.1 schema.
 *
 * v1.0 -> v1.1 changes:
 * - Add environment: "anywhere" (default)
 * - Add schemaVersion: "1.1"
 *
 * Creates .v1.0.backup before migration.
 * Idempotent - safe to run multiple times.
 *
 * @param {string} configPath - Path to configuration.json
 * @returns {Object|null} Migrated config object, or null if file missing/invalid
 */
function migrateConfigIfNeeded(configPath) {
  try {
    // Read file
    const content = fs.readFileSync(configPath, 'utf8');

    // Parse JSON
    let config;
    try {
      config = JSON.parse(content);
    } catch (e) {
      // Invalid JSON - return null, let loadConfig handle recovery
      return null;
    }

    // Check if already migrated
    if (config.schemaVersion === '1.1') {
      // Already v1.1, return unchanged
      return config;
    }

    // Create backup before migration
    createBackup(configPath);

    // Add v1.1 fields with defaults
    config.environment = config.environment || 'anywhere';
    config.schemaVersion = '1.1';

    // Write migrated config
    writeFileAtomic.sync(configPath, JSON.stringify(config, null, 2));

    console.error('Migrated configuration.json to v1.1 schema');

    return config;

  } catch (e) {
    // File not found or other error
    if (e.code === 'ENOENT') {
      return null;
    }
    // Other errors also return null
    return null;
  }
}

/**
 * Migrates pool file from v1.0 to v1.1 schema.
 *
 * v1.0 -> v1.1 changes:
 * - Add type: "reps" to exercises missing it
 * - Add environments: ["anywhere"] to exercises missing it
 * - Do NOT add category (category assignment is user/Phase 11 concern)
 *
 * Creates .v1.0.backup before migration.
 * Idempotent - safe to run multiple times.
 *
 * @param {string} poolPath - Path to pool.json
 * @returns {Array|null} Migrated pool array, or null if file missing/invalid
 */
function migratePoolIfNeeded(poolPath) {
  try {
    // Read file
    const content = fs.readFileSync(poolPath, 'utf8');

    // Parse JSON
    let pool;
    try {
      pool = JSON.parse(content);
    } catch (e) {
      // Invalid JSON - return null
      return null;
    }

    // Validate it's an array
    if (!Array.isArray(pool)) {
      return null;
    }

    // Check if already migrated (first exercise has type field)
    if (pool.length > 0 && pool[0].type !== undefined) {
      // Already v1.1, return unchanged
      return pool;
    }

    // Create backup before migration
    createBackup(poolPath);

    // Migrate each exercise
    for (const exercise of pool) {
      // Add type if missing (default to reps)
      if (exercise.type === undefined) {
        exercise.type = 'reps';
      }

      // Add environments if missing (default to anywhere)
      if (exercise.environments === undefined) {
        exercise.environments = ['anywhere'];
      }

      // Do NOT add category - leave undefined
      // Category assignment is a Phase 11 concern for user pools
    }

    // Write migrated pool
    writeFileAtomic.sync(poolPath, JSON.stringify(pool, null, 2));

    return pool;

  } catch (e) {
    // File not found or other error
    if (e.code === 'ENOENT') {
      return null;
    }
    return null;
  }
}

/**
 * Migrates state file from v1.0 to v1.1 schema.
 *
 * v1.0 -> v1.1 changes:
 * - Add recentCategories: [] (default)
 * - Add schemaVersion: "1.1"
 *
 * Creates .v1.0.backup before migration.
 * Idempotent - safe to run multiple times.
 *
 * @param {string} statePath - Path to state.json
 * @returns {Object|null} Migrated state object, or null if file missing/invalid
 */
function migrateStateIfNeeded(statePath) {
  try {
    // Read file
    const content = fs.readFileSync(statePath, 'utf8');

    // Parse JSON
    let state;
    try {
      state = JSON.parse(content);
    } catch (e) {
      // Invalid JSON - return null
      return null;
    }

    // Check if already migrated
    if (state.schemaVersion === '1.1') {
      // Already v1.1, return unchanged
      return state;
    }

    // Create backup before migration
    createBackup(statePath);

    // Add v1.1 fields with defaults
    state.recentCategories = state.recentCategories || [];
    state.schemaVersion = '1.1';

    // Write migrated state
    writeFileAtomic.sync(statePath, JSON.stringify(state, null, 2));

    return state;

  } catch (e) {
    // File not found or other error
    if (e.code === 'ENOENT') {
      return null;
    }
    return null;
  }
}

module.exports = {
  migrateConfigIfNeeded,
  migratePoolIfNeeded,
  migrateStateIfNeeded
};
