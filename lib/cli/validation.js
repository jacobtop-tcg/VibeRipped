/**
 * CLI Validation Module
 *
 * Input validation helpers for CLI commands.
 * All validators return parsed values or null - they do NOT call process.exit.
 */

/**
 * Validates and normalizes exercise name.
 *
 * Rules:
 * - Must be non-empty string
 * - Max 50 characters
 * - Trimmed of leading/trailing whitespace
 *
 * @param {string} name - Exercise name to validate
 * @returns {string|null} Trimmed name if valid, null otherwise
 */
function validateExerciseName(name) {
  // Check type
  if (typeof name !== 'string') {
    return null;
  }

  // Trim whitespace
  const trimmed = name.trim();

  // Check non-empty
  if (trimmed.length === 0) {
    return null;
  }

  // Check max length
  if (trimmed.length > 50) {
    return null;
  }

  return trimmed;
}

/**
 * Validates and parses reps value.
 *
 * Rules:
 * - Must parse to valid integer
 * - Range: 1-999
 *
 * @param {string} repsStr - Reps string to validate
 * @returns {number|null} Parsed integer if valid, null otherwise
 */
function validateReps(repsStr) {
  // Parse to integer
  const parsed = parseInt(repsStr, 10);

  // Check if parsing succeeded (not NaN)
  if (isNaN(parsed)) {
    return null;
  }

  // Check if input was actually integer-like (no decimals, etc)
  if (parsed.toString() !== repsStr.toString()) {
    return null;
  }

  // Check range
  if (parsed < 1 || parsed > 999) {
    return null;
  }

  return parsed;
}

module.exports = {
  validateExerciseName,
  validateReps
};
