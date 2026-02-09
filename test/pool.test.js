/**
 * Tests for Pool Module
 *
 * Tests cover exercise database structure, equipment filtering, pool assembly,
 * and backward compatibility with DEFAULT_POOL.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert');

// Module under test
const {
  DEFAULT_POOL,
  FULL_EXERCISE_DATABASE,
  assemblePool,
  computePoolHash,
  validateExercise,
  VALID_CATEGORIES,
  VALID_TYPES
} = require('../lib/pool.js');

const { EQUIPMENT_KEYS, DEFAULT_CONFIG } = require('../lib/config.js');

describe('Pool Module - Exercise Database Structure', () => {
  test('FULL_EXERCISE_DATABASE contains bodyweight exercises', () => {
    const bodyweightExercises = FULL_EXERCISE_DATABASE.filter(ex => ex.equipment.length === 0);
    assert.ok(bodyweightExercises.length >= 5, `Should have at least 5 bodyweight exercises, found ${bodyweightExercises.length}`);
  });

  test('FULL_EXERCISE_DATABASE contains equipment exercises', () => {
    const equipmentTypes = [
      EQUIPMENT_KEYS.KETTLEBELL,
      EQUIPMENT_KEYS.DUMBBELLS,
      EQUIPMENT_KEYS.PULL_UP_BAR,
      EQUIPMENT_KEYS.PARALLETTES
    ];

    for (const equipType of equipmentTypes) {
      const exercises = FULL_EXERCISE_DATABASE.filter(ex =>
        ex.equipment.includes(equipType)
      );
      assert.ok(exercises.length > 0, `Should have exercises for ${equipType}`);
    }
  });

  test('all exercises in FULL_EXERCISE_DATABASE have required fields', () => {
    for (const exercise of FULL_EXERCISE_DATABASE) {
      assert.strictEqual(typeof exercise.name, 'string', `Exercise should have name: ${JSON.stringify(exercise)}`);
      assert.ok(exercise.name.length > 0, 'Exercise name should not be empty');

      assert.strictEqual(typeof exercise.reps, 'number', `Exercise ${exercise.name} should have numeric reps`);
      assert.ok(exercise.reps > 0, `Exercise ${exercise.name} should have positive reps`);

      assert.ok(Array.isArray(exercise.equipment), `Exercise ${exercise.name} should have equipment array`);
    }
  });

  test('all equipment tags in database match EQUIPMENT_KEYS values', () => {
    const validEquipmentValues = new Set(Object.values(EQUIPMENT_KEYS));

    for (const exercise of FULL_EXERCISE_DATABASE) {
      for (const equipTag of exercise.equipment) {
        assert.ok(
          validEquipmentValues.has(equipTag),
          `Exercise ${exercise.name} has invalid equipment tag: ${equipTag}`
        );
      }
    }
  });
});

describe('Pool Module - Pool Assembly', () => {
  test('assemblePool with no equipment returns only bodyweight exercises', () => {
    const pool = assemblePool(DEFAULT_CONFIG);

    for (const exercise of pool) {
      assert.strictEqual(
        exercise.equipment.length,
        0,
        `Exercise ${exercise.name} should be bodyweight-only (no equipment)`
      );
    }

    assert.ok(pool.length >= 5, 'Bodyweight pool should have at least 5 exercises');
  });

  test('assemblePool with kettlebell returns bodyweight + kettlebell exercises', () => {
    const config = {
      equipment: {
        kettlebell: true,
        dumbbells: false,
        pullUpBar: false,
        parallettes: false
      }
    };

    const pool = assemblePool(config);

    // Should include bodyweight exercises
    const bodyweightCount = pool.filter(ex => ex.equipment.length === 0).length;
    assert.ok(bodyweightCount > 0, 'Should include bodyweight exercises');

    // Should include kettlebell exercises
    const kettlebellCount = pool.filter(ex =>
      ex.equipment.includes(EQUIPMENT_KEYS.KETTLEBELL)
    ).length;
    assert.ok(kettlebellCount > 0, 'Should include kettlebell exercises');

    // Should NOT include other equipment
    const otherEquipment = pool.filter(ex =>
      ex.equipment.includes(EQUIPMENT_KEYS.DUMBBELLS) ||
      ex.equipment.includes(EQUIPMENT_KEYS.PULL_UP_BAR) ||
      ex.equipment.includes(EQUIPMENT_KEYS.PARALLETTES)
    );
    assert.strictEqual(otherEquipment.length, 0, 'Should not include other equipment types');
  });

  test('assemblePool with all equipment returns all exercises', () => {
    const allTrueConfig = {
      equipment: {
        kettlebell: true,
        dumbbells: true,
        pullUpBar: true,
        parallettes: true
      }
    };

    const pool = assemblePool(allTrueConfig);
    assert.strictEqual(pool.length, FULL_EXERCISE_DATABASE.length, 'Should return all exercises when all equipment available');
  });

  test('assemblePool never returns empty pool', () => {
    const emptyConfig = { equipment: {} };
    const pool = assemblePool(emptyConfig);
    assert.ok(pool.length > 0, 'Should always return at least bodyweight exercises');
  });

  test('assemblePool uses AND logic for multi-equipment exercises', () => {
    // If we have an exercise that requires both kettlebell and dumbbells,
    // it should only appear when BOTH are available

    // First, check if such an exercise exists in the database
    const multiEquipExercise = FULL_EXERCISE_DATABASE.find(ex =>
      ex.equipment.length > 1
    );

    if (multiEquipExercise) {
      // Create a config with only one of the required equipment
      const partialConfig = {
        equipment: {
          kettlebell: multiEquipExercise.equipment.includes(EQUIPMENT_KEYS.KETTLEBELL),
          dumbbells: false,
          pullUpBar: false,
          parallettes: false
        }
      };

      const partialPool = assemblePool(partialConfig);
      const found = partialPool.find(ex => ex.name === multiEquipExercise.name);

      if (multiEquipExercise.equipment.length > 1 && !multiEquipExercise.equipment.every(eq => partialConfig.equipment[eq])) {
        assert.ok(!found, `Multi-equipment exercise ${multiEquipExercise.name} should not appear when not all equipment available`);
      }
    }

    // This test passes if no multi-equipment exercises exist (edge case)
    assert.ok(true);
  });
});

describe('Pool Module - Backward Compatibility', () => {
  test('DEFAULT_POOL is preserved for backward compatibility', () => {
    assert.ok(DEFAULT_POOL, 'DEFAULT_POOL should still be exported');
    assert.ok(Array.isArray(DEFAULT_POOL), 'DEFAULT_POOL should be an array');
    assert.ok(DEFAULT_POOL.length >= 10, 'DEFAULT_POOL should have at least 10 exercises');

    // Verify DEFAULT_POOL structure (from Phase 1)
    for (const exercise of DEFAULT_POOL) {
      assert.ok(exercise.name, 'DEFAULT_POOL exercise should have name');
      assert.ok(exercise.reps, 'DEFAULT_POOL exercise should have reps');
    }
  });

  test('computePoolHash produces different hashes for different pools', () => {
    const pool1 = assemblePool(DEFAULT_CONFIG);

    const pool2Config = {
      equipment: {
        kettlebell: true,
        dumbbells: false,
        pullUpBar: false,
        parallettes: false
      }
    };
    const pool2 = assemblePool(pool2Config);

    const hash1 = computePoolHash(pool1);
    const hash2 = computePoolHash(pool2);

    // Different pools should produce different hashes
    if (pool1.length !== pool2.length) {
      assert.notStrictEqual(hash1, hash2, 'Different pools should have different hashes');
    }
  });
});

describe('Pool Module - v1.1 Exercise Schema', () => {
  test('v1.0 exercise with name and reps passes validateExercise', () => {
    const v10Exercise = { name: "Pushups", reps: 15 };
    assert.strictEqual(validateExercise(v10Exercise), true);
  });

  test('v1.0 exercise with equipment passes validateExercise', () => {
    const v10WithEquipment = { name: "Pull-ups", reps: 8, equipment: ["pullUpBar"] };
    assert.strictEqual(validateExercise(v10WithEquipment), true);
  });

  test('v1.1 exercise with all fields passes validateExercise', () => {
    const v11Exercise = {
      name: "Pushups",
      reps: 15,
      category: "push",
      type: "reps",
      environments: ["anywhere"]
    };
    assert.strictEqual(validateExercise(v11Exercise), true);
  });

  test('v1.1 timed exercise passes validateExercise', () => {
    const timedExercise = {
      name: "Plank",
      reps: 30,
      category: "core",
      type: "timed",
      environments: ["anywhere", "office"]
    };
    assert.strictEqual(validateExercise(timedExercise), true);
  });

  test('invalid category rejected by validateExercise', () => {
    const invalidCategory = { name: "X", reps: 10, category: "invalid" };
    assert.strictEqual(validateExercise(invalidCategory), false);
  });

  test('valid categories accepted by validateExercise', () => {
    const categories = ["push", "pull", "legs", "core"];
    for (const category of categories) {
      const exercise = { name: "X", reps: 10, category };
      assert.strictEqual(validateExercise(exercise), true, `Category "${category}" should be valid`);
    }
  });

  test('invalid type rejected by validateExercise', () => {
    const invalidType = { name: "X", reps: 10, type: "invalid" };
    assert.strictEqual(validateExercise(invalidType), false);
  });

  test('valid types accepted by validateExercise', () => {
    const types = ["reps", "timed"];
    for (const type of types) {
      const exercise = { name: "X", reps: 10, type };
      assert.strictEqual(validateExercise(exercise), true, `Type "${type}" should be valid`);
    }
  });

  test('invalid environments rejected by validateExercise (not array)', () => {
    const invalidEnvironments = { name: "X", reps: 10, environments: "not-array" };
    assert.strictEqual(validateExercise(invalidEnvironments), false);
  });

  test('empty string in environments rejected by validateExercise', () => {
    const emptyString = { name: "X", reps: 10, environments: [""] };
    assert.strictEqual(validateExercise(emptyString), false);
  });

  test('valid environments accepted by validateExercise', () => {
    const validEnvironments = { name: "X", reps: 10, environments: ["home", "office", "anywhere"] };
    assert.strictEqual(validateExercise(validEnvironments), true);
  });

  test('null category is valid (uncategorized exercise)', () => {
    const uncategorized = { name: "X", reps: 10, category: null };
    assert.strictEqual(validateExercise(uncategorized), true);
  });

  test('VALID_CATEGORIES constant exported', () => {
    assert.ok(Array.isArray(VALID_CATEGORIES), 'VALID_CATEGORIES should be an array');
    assert.deepStrictEqual(VALID_CATEGORIES, ["push", "pull", "legs", "core"]);
  });

  test('VALID_TYPES constant exported', () => {
    assert.ok(Array.isArray(VALID_TYPES), 'VALID_TYPES should be an array');
    assert.deepStrictEqual(VALID_TYPES, ["reps", "timed"]);
  });
});
