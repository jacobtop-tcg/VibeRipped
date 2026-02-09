/**
 * format.js - ANSI color formatting for exercise prompts
 *
 * Wraps exercise names and reps in cyan bold ANSI codes.
 * Takes primitive arguments (name, reps) to stay decoupled from engine types.
 */

const ANSI = {
  reset: '\x1b[0m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function formatExercise(name, reps, options = {}) {
  if (!name) return '';

  const prefix = options.prefix || '';

  if (reps === undefined || reps === null) {
    return `${ANSI.cyan}${ANSI.bold}${prefix}${name}${ANSI.reset}`;
  }

  return `${ANSI.cyan}${ANSI.bold}${prefix}${name} x${reps}${ANSI.reset}`;
}

module.exports = { formatExercise, ANSI };
