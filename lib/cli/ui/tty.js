/**
 * TTY Detection Guard
 *
 * Utility to ensure commands run only in interactive terminals.
 * Provides helpful error messages with non-interactive alternatives.
 */

/**
 * Checks if both stdin and stdout are TTY (interactive terminal).
 * If not, prints helpful error message to stderr with alternative commands.
 *
 * @param {string} commandName - Name of command requiring TTY
 * @returns {boolean} - true if TTY, false otherwise
 */
function requireTTY(commandName) {
  const hasStdinTTY = process.stdin.isTTY;
  const hasStdoutTTY = process.stdout.isTTY;

  if (!hasStdinTTY || !hasStdoutTTY) {
    console.error(`Error: ${commandName} requires an interactive terminal`);
    console.error('');
    console.error('This command cannot run in piped or non-interactive contexts.');
    console.error('');
    console.error('To configure non-interactively, use:');
    console.error('  viberipped config --kettlebell --dumbbells');
    console.error('  viberipped pool add "Exercise name" 15');
    console.error('  viberipped config set environment home');

    process.exitCode = 1;
    return false;
  }

  return true;
}

module.exports = { requireTTY };
