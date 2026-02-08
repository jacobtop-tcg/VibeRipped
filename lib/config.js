/**
 * Configuration Module
 *
 * Manages user equipment configuration with fail-safe defaults.
 * All functions are pure or gracefully recover from errors.
 */

const fs = require('fs');
const path = require('path');
const writeFileAtomic = require('write-file-atomic');
const { getStateDir } = require('./state');

/**
 * Equipment type constants - used across config and exercise database
 */
const EQUIPMENT_KEYS = {
  KETTLEBELL: 'kettlebell',
  DUMBBELLS: 'dumbbells',
  PULL_UP_BAR: 'pullUpBar',
  PARALLETTES: 'parallettes'
};

/**
 * Default configuration - all equipment disabled (bodyweight-only)
 */
const DEFAULT_CONFIG = {
  equipment: {
    kettlebell: false,
    dumbbells: false,
    pullUpBar: false,
    parallettes: false
  }
};

/**
 * Validates configuration structure.
 *
 * Accepts:
 * - Valid complete config
 * - Partial config (missing equipment keys treated as false)
 *
 * Rejects:
 * - null/undefined/non-object
 * - Missing equipment field
 * - Non-boolean equipment values
 *
 * @param {*} config - Configuration object to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateConfig(config) {
  // Reject null/undefined/non-object
  if (!config || typeof config !== 'object') {
    return false;
  }

  // Reject missing equipment field
  if (!config.equipment || typeof config.equipment !== 'object') {
    return false;
  }

  // Check that all provided equipment values are booleans
  const validKeys = Object.values(EQUIPMENT_KEYS);
  for (const key of validKeys) {
    const value = config.equipment[key];
    // If key exists, it must be boolean
    if (value !== undefined && typeof value !== 'boolean') {
      return false;
    }
  }

  return true;
}

/**
 * Loads configuration from file with fail-safe defaults.
 *
 * Recovery behaviors:
 * - File missing: Return DEFAULT_CONFIG
 * - Invalid JSON: Return DEFAULT_CONFIG
 * - Invalid structure: Return DEFAULT_CONFIG
 *
 * NEVER throws - always returns valid config.
 *
 * @param {string} configPath - Path to configuration file
 * @returns {Object} Valid configuration object
 */
function loadConfig(configPath) {
  try {
    // Try to read file
    const content = fs.readFileSync(configPath, 'utf8');

    // Try to parse JSON
    let config;
    try {
      config = JSON.parse(content);
    } catch (e) {
      console.error(`Config parse error: ${e.message}, using defaults`);
      return DEFAULT_CONFIG;
    }

    // Validate structure
    if (!validateConfig(config)) {
      console.error('Config invalid, using defaults');
      return DEFAULT_CONFIG;
    }

    // Fill in missing equipment keys with false
    const normalized = {
      equipment: {
        kettlebell: config.equipment.kettlebell || false,
        dumbbells: config.equipment.dumbbells || false,
        pullUpBar: config.equipment.pullUpBar || false,
        parallettes: config.equipment.parallettes || false
      }
    };

    return normalized;

  } catch (e) {
    // File not found or read error
    if (e.code === 'ENOENT') {
      console.error('Config file not found, using defaults');
    } else {
      console.error(`Config load error: ${e.message}, using defaults`);
    }
    return DEFAULT_CONFIG;
  }
}

/**
 * Saves configuration atomically to file.
 *
 * Uses atomic write-rename for crash safety.
 * Creates directory with secure permissions if needed.
 *
 * Does NOT throw - logs errors to stderr.
 *
 * @param {string} configPath - Path to configuration file
 * @param {Object} config - Configuration object to save
 */
function saveConfig(configPath, config) {
  try {
    // Create directory with secure permissions (user-only)
    const configDir = path.dirname(configPath);
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });

    // Atomic write with secure file permissions
    writeFileAtomic.sync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });

  } catch (e) {
    // Log but don't throw - caller should continue even if save fails
    console.error(`Config save error: ${e.message}`);
  }
}

/**
 * Gets the standard configuration file path.
 *
 * Uses XDG Base Directory specification via getStateDir() from state module.
 *
 * @returns {string} Path to configuration.json
 */
function getConfigPath() {
  return path.join(getStateDir(), 'configuration.json');
}

module.exports = {
  EQUIPMENT_KEYS,
  DEFAULT_CONFIG,
  validateConfig,
  loadConfig,
  saveConfig,
  getConfigPath
};
