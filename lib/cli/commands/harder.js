/**
 * Harder Command Handler
 *
 * Increments difficulty multiplier by one discrete step and persists to configuration.
 */

const path = require('path');
const { loadConfig, saveConfig, getConfigPath } = require(path.join(__dirname, '../../config'));
const { incrementDifficulty, getDifficultyLabel } = require(path.join(__dirname, '../../difficulty'));
const { success, info } = require(path.join(__dirname, '../output'));

/**
 * Handles harder command - increases difficulty multiplier by one step.
 */
function harderHandler() {
  const configPath = getConfigPath();
  const config = loadConfig(configPath);
  const currentMultiplier = config.difficulty?.multiplier || 1.0;
  const newMultiplier = incrementDifficulty(currentMultiplier);

  // Check if already at maximum
  if (newMultiplier === currentMultiplier) {
    info('Already at maximum difficulty: ' + getDifficultyLabel(currentMultiplier));
    process.exitCode = 0;
    return;
  }

  // Ensure difficulty object exists
  if (!config.difficulty) {
    config.difficulty = {};
  }

  // Update multiplier
  config.difficulty.multiplier = newMultiplier;

  // Save config
  saveConfig(configPath, config);

  // Output success message
  success('Difficulty increased: ' + getDifficultyLabel(currentMultiplier) + ' -> ' + getDifficultyLabel(newMultiplier));
  process.exitCode = 0;
}

module.exports = harderHandler;
