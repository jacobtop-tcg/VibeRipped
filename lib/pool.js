/**
 * Exercise Pool Module
 *
 * Defines the default set of bodyweight exercises and provides pool hashing
 * for change detection.
 */

const crypto = require('crypto');

/**
 * Default exercise pool - bodyweight exercises optimized for:
 * - Quick execution (30-60 seconds max)
 * - Low sweat, low recovery (preserve coding ability)
 * - No equipment required
 * - Diverse muscle groups to avoid repetitive strain
 *
 * Note: "reps" for isometric holds (wall sit, plank) represents seconds.
 */
const DEFAULT_POOL = [
  { name: "Pushups", reps: 15 },
  { name: "Bodyweight squats", reps: 20 },
  { name: "Desk pushups", reps: 15 },
  { name: "Lunges", reps: 10 },
  { name: "Calf raises", reps: 25 },
  { name: "Tricep dips", reps: 12 },
  { name: "Wall sit", reps: 30 },
  { name: "High knees", reps: 30 },
  { name: "Glute bridges", reps: 15 },
  { name: "Plank", reps: 30 }
];

/**
 * Computes SHA256 hash of exercise pool for change detection.
 *
 * Hash is deterministic - same pool produces same hash.
 * Array order matters (rotation order = pool order).
 *
 * @param {Array<{name: string, reps: number}>} pool - Exercise pool to hash
 * @returns {string} 64-character hex SHA256 digest
 */
function computePoolHash(pool) {
  const poolJson = JSON.stringify(pool);
  return crypto.createHash('sha256').update(poolJson, 'utf8').digest('hex');
}

module.exports = {
  DEFAULT_POOL,
  computePoolHash
};
