/**
 * Softer Command Handler
 *
 * Decrements difficulty multiplier by one discrete step and persists to configuration.
 */

const path = require('path');
const { loadConfig, saveConfig, getConfigPath } = require(path.join(__dirname, '../../config'));
const { decrementDifficulty, getDifficultyLabel } = require(path.join(__dirname, '../../difficulty'));
const { success, info } = require(path.join(__dirname, '../output'));

/**
 * Handles softer command - decreases difficulty multiplier by one step.
 */
function softerHandler() {
  const configPath = getConfigPath();
  const config = loadConfig(configPath);
  const currentMultiplier = config.difficulty?.multiplier || 1.0;
  const newMultiplier = decrementDifficulty(currentMultiplier);

  // Check if already at minimum
  if (newMultiplier === currentMultiplier) {
    info('Already at minimum difficulty: ' + getDifficultyLabel(currentMultiplier));
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
  success('Difficulty decreased: ' + getDifficultyLabel(currentMultiplier) + ' -> ' + getDifficultyLabel(newMultiplier));
  process.exitCode = 0;
}

module.exports = softerHandler;
