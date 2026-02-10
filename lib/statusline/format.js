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

function formatExercise(name, value, typeOrOptions, options) {
  if (!name) return '';

  // Backward compatibility: if third arg is object, it's options (old signature)
  let type = 'reps';
  let opts = {};

  if (typeof typeOrOptions === 'object' && typeOrOptions !== null) {
    opts = typeOrOptions;
  } else if (typeof typeOrOptions === 'string') {
    type = typeOrOptions;
    opts = options || {};
  }

  const prefix = opts.prefix || '';

  if (value === undefined || value === null) {
    return `${ANSI.cyan}${ANSI.bold}${prefix}${name}${ANSI.reset}`;
  }

  // Type-aware formatting
  const valueFormat = type === 'timed' ? `${value}s` : `x${value}`;
  return `${ANSI.cyan}${ANSI.bold}${prefix}${name} ${valueFormat}${ANSI.reset}`;
}

module.exports = { formatExercise, ANSI };
