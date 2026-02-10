/**
 * Exercise Pool Module
 *
 * Defines the default set of bodyweight exercises and provides pool hashing
 * for change detection.
 *
 * Extended in Phase 2 with full equipment-tagged exercise database and
 * pool assembly logic.
 */

const crypto = require('crypto');

/**
 * Equipment type constants - duplicated here to avoid circular dependency.
 * These must match EQUIPMENT_KEYS in config.js.
 */
const EQUIPMENT_KEYS = {
  KETTLEBELL: 'kettlebell',
  DUMBBELLS: 'dumbbells',
  PULL_UP_BAR: 'pullUpBar',
  PARALLETTES: 'parallettes'
};

/**
 * Valid exercise categories (v1.1 schema extension)
 */
const VALID_CATEGORIES = ['push', 'pull', 'legs', 'core'];

/**
 * Valid exercise types (v1.1 schema extension)
 */
const VALID_TYPES = ['reps', 'timed'];

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
 * Full exercise database with equipment tags.
 *
 * Each exercise has:
 * - name: string
 * - reps: number (seconds for isometric holds)
 * - equipment: array of EQUIPMENT_KEYS values (empty for bodyweight)
 *
 * Equipment categories:
 * - Bodyweight: equipment = []
 * - Kettlebell: equipment = [EQUIPMENT_KEYS.KETTLEBELL]
 * - Dumbbells: equipment = [EQUIPMENT_KEYS.DUMBBELLS]
 * - Pull-up bar: equipment = [EQUIPMENT_KEYS.PULL_UP_BAR]
 * - Parallettes: equipment = [EQUIPMENT_KEYS.PARALLETTES]
 *
 * All exercises selected for:
 * - Quick execution (finishable in 30-60 seconds)
 * - Low sweat (preserve coding ability)
 * - Cognitive preservation (no exhaustion)
 */
const FULL_EXERCISE_DATABASE = [
  // Bodyweight exercises (identical to DEFAULT_POOL for backward compatibility)
  { name: "Pushups", reps: 15, equipment: [], category: "push", type: "reps", environments: ["anywhere"] },
  { name: "Bodyweight squats", reps: 20, equipment: [], category: "legs", type: "reps", environments: ["anywhere"] },
  { name: "Desk pushups", reps: 15, equipment: [], category: "push", type: "reps", environments: ["anywhere"] },
  { name: "Lunges", reps: 10, equipment: [], category: "legs", type: "reps", environments: ["anywhere"] },
  { name: "Calf raises", reps: 25, equipment: [], category: "legs", type: "reps", environments: ["anywhere"] },
  { name: "Tricep dips", reps: 12, equipment: [], category: "core", type: "reps", environments: ["anywhere"] },
  { name: "Wall sit", reps: 30, equipment: [], category: "core", type: "timed", environments: ["anywhere"] },
  { name: "High knees", reps: 30, equipment: [], category: "legs", type: "reps", environments: ["anywhere"] },
  { name: "Glute bridges", reps: 15, equipment: [], category: "legs", type: "reps", environments: ["anywhere"] },
  { name: "Plank", reps: 30, equipment: [], category: "core", type: "timed", environments: ["anywhere"] },

  // Kettlebell exercises
  { name: "Kettlebell swings", reps: 15, equipment: [EQUIPMENT_KEYS.KETTLEBELL], category: "core", type: "reps", environments: ["anywhere"] },
  { name: "Goblet squats", reps: 12, equipment: [EQUIPMENT_KEYS.KETTLEBELL], category: "legs", type: "reps", environments: ["anywhere"] },
  { name: "Kettlebell deadlifts", reps: 12, equipment: [EQUIPMENT_KEYS.KETTLEBELL], category: "legs", type: "reps", environments: ["anywhere"] },
  { name: "Turkish get-up", reps: 3, equipment: [EQUIPMENT_KEYS.KETTLEBELL], category: "core", type: "reps", environments: ["anywhere"] },

  // Dumbbell exercises
  { name: "Dumbbell rows", reps: 12, equipment: [EQUIPMENT_KEYS.DUMBBELLS], category: "pull", type: "reps", environments: ["anywhere"] },
  { name: "Overhead press", reps: 10, equipment: [EQUIPMENT_KEYS.DUMBBELLS], category: "push", type: "reps", environments: ["anywhere"] },
  { name: "Dumbbell curls", reps: 12, equipment: [EQUIPMENT_KEYS.DUMBBELLS], category: "pull", type: "reps", environments: ["anywhere"] },
  { name: "Lateral raises", reps: 12, equipment: [EQUIPMENT_KEYS.DUMBBELLS], category: "pull", type: "reps", environments: ["anywhere"] },

  // Pull-up bar exercises
  { name: "Pull-ups", reps: 8, equipment: [EQUIPMENT_KEYS.PULL_UP_BAR], category: "pull", type: "reps", environments: ["anywhere"] },
  { name: "Chin-ups", reps: 8, equipment: [EQUIPMENT_KEYS.PULL_UP_BAR], category: "pull", type: "reps", environments: ["anywhere"] },
  { name: "Hanging knee raises", reps: 10, equipment: [EQUIPMENT_KEYS.PULL_UP_BAR], category: "core", type: "reps", environments: ["anywhere"] },
  { name: "Dead hangs", reps: 20, equipment: [EQUIPMENT_KEYS.PULL_UP_BAR], category: "pull", type: "timed", environments: ["anywhere"] },

  // Parallettes exercises
  { name: "L-sit", reps: 20, equipment: [EQUIPMENT_KEYS.PARALLETTES], category: "core", type: "timed", environments: ["anywhere"] },
  { name: "Parallette pushups", reps: 12, equipment: [EQUIPMENT_KEYS.PARALLETTES], category: "push", type: "reps", environments: ["anywhere"] },
  { name: "Tuck planche", reps: 10, equipment: [EQUIPMENT_KEYS.PARALLETTES], category: "push", type: "reps", environments: ["anywhere"] },
  { name: "Parallette dips", reps: 10, equipment: [EQUIPMENT_KEYS.PARALLETTES], category: "core", type: "reps", environments: ["anywhere"] }
];

/**
 * Assembles exercise pool based on available equipment.
 *
 * Filtering logic:
 * - Always include bodyweight exercises (equipment = [])
 * - Include equipment exercise if ALL required equipment is available (AND logic)
 * - If result is empty (should never happen), fall back to DEFAULT_POOL
 *
 * @param {Object} equipmentConfig - Equipment configuration object with equipment field
 * @returns {Array<{name: string, reps: number, equipment: Array<string>}>} Filtered exercise pool
 */
function assemblePool(equipmentConfig) {
  // Extract list of available equipment
  const availableEquipment = [];
  if (equipmentConfig && equipmentConfig.equipment) {
    for (const [key, value] of Object.entries(equipmentConfig.equipment)) {
      if (value === true) {
        availableEquipment.push(key);
      }
    }
  }

  // Filter exercises: include if bodyweight OR all required equipment available
  const pool = FULL_EXERCISE_DATABASE.filter(exercise => {
    // Bodyweight exercises (no equipment required)
    if (exercise.equipment.length === 0) {
      return true;
    }

    // Equipment exercises: ALL required equipment must be available (AND logic)
    return exercise.equipment.every(requiredEquip =>
      availableEquipment.includes(requiredEquip)
    );
  });

  // Fail-safe: should never happen since bodyweight exercises always included
  if (pool.length === 0) {
    console.error('Pool assembly resulted in empty pool, falling back to DEFAULT_POOL');
    return DEFAULT_POOL;
  }

  return pool;
}

/**
 * Validates exercise object structure and v1.1 optional fields.
 *
 * Required fields:
 * - name: non-empty string
 * - reps: positive integer
 *
 * Optional fields (v1.0 backward compatible):
 * - equipment: array of strings
 *
 * Optional fields (v1.1):
 * - category: one of VALID_CATEGORIES or null (uncategorized)
 * - type: one of VALID_TYPES
 * - environments: array of non-empty strings
 *
 * @param {*} exercise - Exercise object to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateExercise(exercise) {
  // Reject null/undefined/non-object
  if (!exercise || typeof exercise !== 'object') {
    return false;
  }

  // Required: name (non-empty string)
  if (typeof exercise.name !== 'string' || exercise.name.length === 0) {
    return false;
  }

  // Required: reps (positive integer)
  if (!Number.isInteger(exercise.reps) || exercise.reps <= 0) {
    return false;
  }

  // Optional: equipment (array of strings)
  if (exercise.equipment !== undefined) {
    if (!Array.isArray(exercise.equipment)) {
      return false;
    }
    for (const item of exercise.equipment) {
      if (typeof item !== 'string') {
        return false;
      }
    }
  }

  // Optional: category (one of VALID_CATEGORIES or null)
  if (exercise.category !== undefined) {
    if (exercise.category !== null && !VALID_CATEGORIES.includes(exercise.category)) {
      return false;
    }
  }

  // Optional: type (one of VALID_TYPES)
  if (exercise.type !== undefined) {
    if (!VALID_TYPES.includes(exercise.type)) {
      return false;
    }
  }

  // Optional: environments (array of non-empty strings)
  if (exercise.environments !== undefined) {
    if (!Array.isArray(exercise.environments)) {
      return false;
    }
    for (const env of exercise.environments) {
      if (typeof env !== 'string' || env.length === 0) {
        return false;
      }
    }
  }

  // Optional: duration (positive integer, only validated if present)
  if (exercise.duration !== undefined) {
    if (!Number.isInteger(exercise.duration) || exercise.duration <= 0) {
      return false;
    }
  }

  return true;
}

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
  FULL_EXERCISE_DATABASE,
  assemblePool,
  computePoolHash,
  validateExercise,
  VALID_CATEGORIES,
  VALID_TYPES
};
