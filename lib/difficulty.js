/**
 * Difficulty Module
 *
 * Manages adaptive difficulty scaling with latency-based rep adjustment
 * and user-controlled difficulty multipliers.
 *
 * Two-stage scaling:
 * 1. Map latency (2000-30000ms) to scale factor (1.0-1.5x)
 * 2. Apply user difficulty multiplier (0.5x-2.5x)
 * 3. Clamp to absolute bounds (5-60 reps)
 */

/**
 * Discrete difficulty steps for user-controlled multiplier
 */
const DIFFICULTY_STEPS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5];

/**
 * Absolute rep count bounds for work-environment safety
 */
const MIN_REPS = 5;
const MAX_REPS = 60;

/**
 * Latency bounds for scaling factor calculation
 */
const MIN_LATENCY = 2000;   // 2 seconds
const MAX_LATENCY = 30000;  // 30 seconds

/**
 * Scaling factor bounds (applied to base reps before multiplier)
 */
const MIN_FACTOR = 1.0;   // No bonus for short waits
const MAX_FACTOR = 1.5;   // 50% increase for long waits

/**
 * Linear interpolation between two values
 *
 * @param {number} start - Start value
 * @param {number} end - End value
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number} Interpolated value
 */
function lerp(start, end, t) {
  return start + (end - start) * t;
}

/**
 * Clamps a value between min and max bounds
 *
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @returns {number} Clamped value
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Maps latency duration to scaling factor using linear interpolation
 *
 * @param {number} latencyMs - API latency in milliseconds
 * @returns {number} Scale factor (1.0-1.5)
 */
function latencyToScaleFactor(latencyMs) {
  // Clamp latency to valid range
  const clampedLatency = clamp(latencyMs, MIN_LATENCY, MAX_LATENCY);

  // Normalize to 0-1 range
  const t = (clampedLatency - MIN_LATENCY) / (MAX_LATENCY - MIN_LATENCY);

  // Interpolate between min and max factors
  return lerp(MIN_FACTOR, MAX_FACTOR, t);
}

/**
 * Scales exercise reps based on latency and difficulty multiplier
 *
 * Two-stage scaling:
 * 1. Apply latency-based scaling factor (1.0-1.5x)
 * 2. Apply user difficulty multiplier (0.5-2.5x)
 * 3. Clamp to absolute bounds (5-60 reps)
 *
 * @param {number} baseReps - Base rep count for exercise
 * @param {number} latencyMs - API latency in milliseconds
 * @param {number} multiplier - User difficulty multiplier
 * @returns {number} Scaled rep count (integer, clamped to 5-60)
 */
function scaleRepsForLatency(baseReps, latencyMs, multiplier) {
  // Stage 1: Map latency to scaling factor
  const latencyFactor = latencyToScaleFactor(latencyMs);

  // Stage 2: Apply latency scaling to base reps
  const latencyScaledReps = baseReps * latencyFactor;

  // Stage 3: Apply user difficulty multiplier
  const multipliedReps = latencyScaledReps * multiplier;

  // Stage 4: Clamp to absolute practical bounds and round
  return Math.round(clamp(multipliedReps, MIN_REPS, MAX_REPS));
}

/**
 * Increments difficulty multiplier by one step
 *
 * @param {number} currentMultiplier - Current difficulty multiplier
 * @returns {number} Next difficulty multiplier (clamped to max)
 */
function incrementDifficulty(currentMultiplier) {
  const currentIndex = DIFFICULTY_STEPS.indexOf(currentMultiplier);

  // Invalid value - reset to default
  if (currentIndex === -1) {
    return 1.0;
  }

  // Already at max - stay at max
  const nextIndex = Math.min(currentIndex + 1, DIFFICULTY_STEPS.length - 1);
  return DIFFICULTY_STEPS[nextIndex];
}

/**
 * Decrements difficulty multiplier by one step
 *
 * @param {number} currentMultiplier - Current difficulty multiplier
 * @returns {number} Previous difficulty multiplier (clamped to min)
 */
function decrementDifficulty(currentMultiplier) {
  const currentIndex = DIFFICULTY_STEPS.indexOf(currentMultiplier);

  // Invalid value - reset to default
  if (currentIndex === -1) {
    return 1.0;
  }

  // Already at min - stay at min
  const prevIndex = Math.max(currentIndex - 1, 0);
  return DIFFICULTY_STEPS[prevIndex];
}

/**
 * Gets human-readable label for difficulty multiplier
 *
 * @param {number} multiplier - Difficulty multiplier
 * @returns {string} Formatted label
 */
function getDifficultyLabel(multiplier) {
  if (multiplier === 0.5) {
    return '0.5x (easiest)';
  }
  if (multiplier === 2.5) {
    return '2.5x (hardest)';
  }
  if (multiplier === 1.0) {
    return '1.0x (default)';
  }
  return `${multiplier}x`;
}

module.exports = {
  DIFFICULTY_STEPS,
  MIN_REPS,
  MAX_REPS,
  scaleRepsForLatency,
  incrementDifficulty,
  decrementDifficulty,
  getDifficultyLabel
};
