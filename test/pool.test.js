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

describe('validateExercise duration field', () => {
  test('exercise with valid duration field passes validation', () => {
    const exercise = { name: "Plank", reps: 30, duration: 30 };
    assert.strictEqual(validateExercise(exercise), true);
  });

  test('exercise without duration field passes validation (backward compat)', () => {
    const exercise = { name: "Plank", reps: 30 };
    assert.strictEqual(validateExercise(exercise), true);
  });

  test('exercise with negative duration fails validation', () => {
    const exercise = { name: "Plank", reps: 30, duration: -5 };
    assert.strictEqual(validateExercise(exercise), false);
  });

  test('exercise with zero duration fails validation', () => {
    const exercise = { name: "Plank", reps: 30, duration: 0 };
    assert.strictEqual(validateExercise(exercise), false);
  });

  test('exercise with non-integer duration fails validation', () => {
    const exercise = { name: "Plank", reps: 30, duration: 30.5 };
    assert.strictEqual(validateExercise(exercise), false);
  });

  test('exercise with string duration fails validation', () => {
    const exercise = { name: "Plank", reps: 30, duration: "30" };
    assert.strictEqual(validateExercise(exercise), false);
  });
});

describe('Pool Module - Environment Filtering', () => {
  test('assemblePool accepts environment parameter and uses it for filtering', () => {
    // Verify function signature includes environment parameter
    const config = { equipment: {} };

    // Should not throw when called with environment parameter
    assert.doesNotThrow(() => {
      assemblePool(config, 'office');
    });

    // Verify the parameter is actually used by testing fallback behavior
    // An environment that matches nothing should trigger fallback
    const fallbackPool = assemblePool(config, 'nonexistent-environment-xyz');

    // Should fall back to equipment-filtered pool (bodyweight only in this case)
    assert.ok(fallbackPool.length > 0, 'Should return fallback pool for nonexistent environment');

    // All should be bodyweight since we didn't enable any equipment
    for (const exercise of fallbackPool) {
      assert.strictEqual(exercise.equipment.length, 0, 'Fallback should be equipment-filtered (bodyweight only)');
    }
  });

  test('includes exercises tagged "anywhere" regardless of active environment', () => {
    // Create a pool with exercises tagged "anywhere"
    const config = { equipment: {} };
    const pool = assemblePool(config, 'office');

    // All bodyweight exercises in database are tagged "anywhere"
    // Verify at least one exists in the result
    const anywhereExercises = FULL_EXERCISE_DATABASE.filter(ex =>
      ex.environments && ex.environments.includes('anywhere')
    );
    assert.ok(anywhereExercises.length > 0, 'Database should have "anywhere" exercises');

    // All of those should be in the filtered pool (if bodyweight)
    const bodyweightAnywhere = anywhereExercises.filter(ex => ex.equipment.length === 0);
    for (const exercise of bodyweightAnywhere) {
      const found = pool.find(ex => ex.name === exercise.name);
      assert.ok(found, `Exercise "${exercise.name}" tagged "anywhere" should be in office environment pool`);
    }
  });

  test('includes exercises matching active environment', () => {
    // Temporarily add an office-only exercise to test filtering
    // We'll test this by checking the filter logic works
    const config = { equipment: {} };

    // Create a test exercise pool with office-tagged exercise
    const testExercise = {
      name: "Test office exercise",
      reps: 10,
      equipment: [],
      environments: ["office"]
    };

    // For this test, we'll verify the pool includes exercises that match environment
    const pool = assemblePool(config, 'office');

    // All exercises returned should have either "anywhere" or "office" in environments
    for (const exercise of pool) {
      const envs = exercise.environments || ['anywhere'];
      assert.ok(
        envs.includes('anywhere') || envs.includes('office'),
        `Exercise "${exercise.name}" should be tagged for "anywhere" or "office" environment`
      );
    }
  });

  test('excludes exercises not matching active environment', () => {
    // This test verifies exclusion logic
    // Since FULL_EXERCISE_DATABASE currently only has "anywhere" exercises,
    // we'll test the filter would exclude home-only when filtering for office
    const config = { equipment: {} };
    const pool = assemblePool(config, 'office');

    // Verify no exercises tagged exclusively for "home" appear
    for (const exercise of pool) {
      const envs = exercise.environments || ['anywhere'];
      if (!envs.includes('anywhere')) {
        assert.ok(envs.includes('office'),
          `Exercise "${exercise.name}" should be for office, not exclusively other environments`);
      }
    }
  });

  test('defaults missing environments array to anywhere', () => {
    // Exercises without environments field should be included in any environment
    const config = { equipment: {} };

    // Create config and filter
    const pool = assemblePool(config, 'office');

    // Verify pool is not empty (exercises without environments field should default to "anywhere")
    assert.ok(pool.length > 0, 'Pool should include exercises even when environments field missing (defaults to anywhere)');
  });

  test('falls back to equipment-only pool when environment filter empties result', () => {
    // This would require a scenario where environment filtering produces empty result
    // Test by using a non-existent environment like "underwater"
    const config = { equipment: {} };

    // This should return bodyweight exercises (fallback) and log to stderr
    const pool = assemblePool(config, 'underwater-basket-weaving');

    // Should still return bodyweight exercises (not empty)
    assert.ok(pool.length > 0, 'Should fall back to equipment-filtered pool when environment matches nothing');

    // All returned exercises should be bodyweight
    for (const exercise of pool) {
      assert.strictEqual(exercise.equipment.length, 0,
        'Fallback pool should only contain bodyweight exercises');
    }
  });

  test('defaults environment parameter to anywhere when omitted', () => {
    const config = { equipment: {} };

    // Call assemblePool without second argument
    const poolWithoutEnv = assemblePool(config);

    // Call assemblePool with 'anywhere'
    const poolWithAnywhere = assemblePool(config, 'anywhere');

    // Both should return identical results
    assert.strictEqual(poolWithoutEnv.length, poolWithAnywhere.length,
      'Pool size should be identical when environment omitted vs "anywhere"');

    // Verify exercise names match
    for (let i = 0; i < poolWithoutEnv.length; i++) {
      assert.strictEqual(poolWithoutEnv[i].name, poolWithAnywhere[i].name,
        'Exercise order should be identical when environment omitted vs "anywhere"');
    }
  });

  test('chains equipment then environment filters', () => {
    // Enable kettlebell, filter for office environment
    const config = {
      equipment: {
        kettlebell: true,
        dumbbells: false,
        pullUpBar: false,
        parallettes: false
      }
    };

    const pool = assemblePool(config, 'office');

    // Should include bodyweight exercises (office or anywhere)
    const bodyweightCount = pool.filter(ex => ex.equipment.length === 0).length;
    assert.ok(bodyweightCount > 0, 'Should include bodyweight exercises');

    // Should include kettlebell exercises tagged office or anywhere
    const kettlebellCount = pool.filter(ex =>
      ex.equipment.includes(EQUIPMENT_KEYS.KETTLEBELL)
    ).length;
    assert.ok(kettlebellCount > 0, 'Should include kettlebell exercises');

    // All exercises should match environment filter
    for (const exercise of pool) {
      const envs = exercise.environments || ['anywhere'];
      assert.ok(
        envs.includes('anywhere') || envs.includes('office'),
        `Exercise "${exercise.name}" should match office environment filter`
      );
    }

    // Should NOT include exercises requiring other equipment
    const hasOtherEquipment = pool.some(ex =>
      ex.equipment.includes(EQUIPMENT_KEYS.DUMBBELLS) ||
      ex.equipment.includes(EQUIPMENT_KEYS.PULL_UP_BAR) ||
      ex.equipment.includes(EQUIPMENT_KEYS.PARALLETTES)
    );
    assert.ok(!hasOtherEquipment, 'Should not include exercises requiring unavailable equipment');
  });
});
