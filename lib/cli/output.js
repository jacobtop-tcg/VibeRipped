/**
 * CLI Output Module
 *
 * Formatted output helpers for CLI commands.
 * Provides consistent success/error/info formatting.
 */

/**
 * Prints success message to stdout with checkmark prefix.
 *
 * @param {string} message - Success message to display
 */
function success(message) {
  console.log('\u2713 ' + message);
}

/**
 * Prints error message to stderr with optional usage hint.
 * Sets process.exitCode to 1 (does not exit immediately).
 *
 * @param {string} message - Error message to display
 * @param {string} [usage] - Optional usage hint
 */
function error(message, usage) {
  console.error('Error: ' + message);
  if (usage) {
    console.error('Usage: ' + usage);
  }
  process.exitCode = 1;
}

/**
 * Prints informational message to stdout (no prefix).
 *
 * @param {string} message - Info message to display
 */
function info(message) {
  console.log(message);
}

module.exports = {
  success,
  error,
  info
};
