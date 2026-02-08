/**
 * Cooldown Enforcement Module
 *
 * Handles wall-clock cooldown checking and time formatting.
 * Does NOT handle state persistence or rotation logic.
 */

/**
 * Cooldown interval in milliseconds (5 minutes for Phase 1)
 */
const COOLDOWN_MS = 300000; // 5 minutes = 300,000 milliseconds

/**
 * Checks if a trigger is allowed based on cooldown interval.
 *
 * Special case: lastTriggerTime === 0 (sentinel) always allows (never triggered).
 *
 * @param {number} lastTriggerTime - Unix timestamp of last trigger (ms), or 0 for never
 * @param {number} cooldownMs - Cooldown interval in milliseconds
 * @returns {{allowed: boolean, remainingMs: number}} Cooldown status
 */
function checkCooldown(lastTriggerTime, cooldownMs) {
  // Sentinel 0 means never triggered - always allow
  if (lastTriggerTime === 0) {
    return { allowed: true, remainingMs: 0 };
  }

  const now = Date.now();
  const elapsed = now - lastTriggerTime;

  if (elapsed >= cooldownMs) {
    return { allowed: true, remainingMs: 0 };
  } else {
    const remainingMs = cooldownMs - elapsed;
    return { allowed: false, remainingMs };
  }
}

/**
 * Formats milliseconds to human-readable string.
 *
 * Examples: "3m 0s", "45s", "1m 30s"
 *
 * @param {number} ms - Milliseconds to format
 * @returns {string} Human-readable time string
 */
function formatRemaining(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
}

module.exports = {
  COOLDOWN_MS,
  checkCooldown,
  formatRemaining
};
