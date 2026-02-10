/**
 * Config Command Handler
 *
 * Manages equipment configuration and triggers pool generation.
 */

const fs = require('fs');
const path = require('path');
const writeFileAtomic = require('write-file-atomic');
const { loadConfig, saveConfig, getConfigPath, validateConfig } = require(path.join(__dirname, '../../config'));
const { assemblePool, computePoolHash } = require(path.join(__dirname, '../../pool'));
const { getStateDir } = require(path.join(__dirname, '../../state'));
const { success, error, info } = require(path.join(__dirname, '../output'));

/**
 * Show command - displays current equipment configuration.
 *
 * @param {Object} options - Commander options object with equipment flags
 */
function show(options) {
  const configPath = getConfigPath();

  // Check if any equipment flags were specified
  const hasKettlebell = options.kettlebell !== undefined;
  const hasDumbbells = options.dumbbells !== undefined;
  const hasPullUpBar = options.pullUpBar !== undefined;
  const hasParallettes = options.parallettes !== undefined;

  const isSetMode = hasKettlebell || hasDumbbells || hasPullUpBar || hasParallettes;

  if (!isSetMode) {
    // Show mode: display current equipment configuration
    const config = loadConfig(configPath);

    info('Current equipment configuration:');
    info('  Kettlebell:   ' + (config.equipment.kettlebell ? 'enabled' : 'disabled'));
    info('  Dumbbells:    ' + (config.equipment.dumbbells ? 'enabled' : 'disabled'));
    info('  Pull-up bar:  ' + (config.equipment.pullUpBar ? 'enabled' : 'disabled'));
    info('  Parallettes:  ' + (config.equipment.parallettes ? 'enabled' : 'disabled'));
    info('  Environment:  ' + (config.environment || 'anywhere'));

    process.exitCode = 0;
    return;
  }

  // Set mode: update equipment configuration
  const currentConfig = loadConfig(configPath);

  // Merge: use CLI option if specified, otherwise keep current value
  const newConfig = {
    equipment: {
      kettlebell: hasKettlebell ? options.kettlebell : currentConfig.equipment.kettlebell,
      dumbbells: hasDumbbells ? options.dumbbells : currentConfig.equipment.dumbbells,
      pullUpBar: hasPullUpBar ? options.pullUpBar : currentConfig.equipment.pullUpBar,
      parallettes: hasParallettes ? options.parallettes : currentConfig.equipment.parallettes
    }
  };

  // Validate merged config
  if (!validateConfig(newConfig)) {
    error('Invalid configuration');
    process.exitCode = 1;
    return;
  }

  // Save config
  saveConfig(configPath, newConfig);

  // Generate pool immediately after saving config
  try {
    const assembledPool = assemblePool(newConfig);
    const configPoolHash = computePoolHash(assembledPool);
    const poolHash = computePoolHash(assembledPool);

    // Write pool.json
    const stateDir = getStateDir();
    fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });

    const poolPath = path.join(stateDir, 'pool.json');
    writeFileAtomic.sync(poolPath, JSON.stringify(assembledPool, null, 2), { mode: 0o600 });

    // Update state.json if it exists
    const statePath = path.join(stateDir, 'state.json');
    try {
      const stateContent = fs.readFileSync(statePath, 'utf8');
      const state = JSON.parse(stateContent);

      // Update state with new hashes and reset rotation
      state.configPoolHash = configPoolHash;
      state.poolHash = poolHash;
      state.currentIndex = 0;

      writeFileAtomic.sync(statePath, JSON.stringify(state, null, 2), { mode: 0o600 });
    } catch (e) {
      // State file doesn't exist or is corrupt - that's fine, it will initialize on next trigger
    }

    // Print confirmation
    const enabledEquipment = [];
    if (newConfig.equipment.kettlebell) enabledEquipment.push('kettlebell');
    if (newConfig.equipment.dumbbells) enabledEquipment.push('dumbbells');
    if (newConfig.equipment.pullUpBar) enabledEquipment.push('pull-up bar');
    if (newConfig.equipment.parallettes) enabledEquipment.push('parallettes');

    success('Configuration updated: ' + (enabledEquipment.length > 0 ? enabledEquipment.join(', ') : 'bodyweight only'));
    info('Pool generated with ' + assembledPool.length + ' exercises.');

    process.exitCode = 0;
  } catch (e) {
    // Pool generation failed - log warning but don't fail command
    console.error('Warning: Pool generation failed: ' + e.message);
    success('Configuration updated (pool will regenerate on next trigger)');
    process.exitCode = 0;
  }
}

/**
 * Set command - sets a configuration value.
 *
 * @param {string} key - Configuration key
 * @param {string} value - Configuration value
 */
function set(key, value) {
  if (key === 'environment') {
    // Validate value is non-empty string
    if (!value || typeof value !== 'string' || value.trim().length === 0) {
      error('Environment value cannot be empty');
      process.exitCode = 1;
      return;
    }

    const configPath = getConfigPath();
    const config = loadConfig(configPath);
    config.environment = value;
    saveConfig(configPath, config);

    success('Environment set to: ' + value);
    process.exitCode = 0;
  } else {
    error('Unknown config key: ' + key + '. Settable keys: environment');
    process.exitCode = 1;
  }
}

/**
 * Get command - gets a configuration value.
 *
 * @param {string} key - Configuration key
 */
function get(key) {
  if (key === 'environment') {
    const configPath = getConfigPath();
    const config = loadConfig(configPath);
    info(config.environment || 'anywhere');
    process.exitCode = 0;
  } else {
    error('Unknown config key: ' + key + '. Gettable keys: environment');
    process.exitCode = 1;
  }
}

module.exports = { show, set, get };
