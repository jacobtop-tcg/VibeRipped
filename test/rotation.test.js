/**
 * Unit tests for rotation.js - Category-Aware Exercise Selection
 *
 * Tests cover:
 * - Sequential selection with category filtering
 * - Ring buffer bounds for recentCategories
 * - Null/undefined category passthrough
 * - Single-category pool fallback
 * - v1.0 backward compatibility (pools without categories)
 * - Determinism (same state produces same result)
 */

const { describe, test, beforeEach } = require('node:test');
const assert = require('node:assert');

// Module under test
const { getNextExercise, MAX_RECENT_CATEGORIES } = require('../lib/rotation.js');

describe('Rotation Module - Category-Aware Selection', () => {
  test('filters out exercises from recently-used categories', () => {
    const pool = [
      { name: "Pushups", reps: 15, category: "push" },
      { name: "Pull-ups", reps: 8, category: "pull" },
      { name: "Squats", reps: 20, category: "legs" },
      { name: "Plank", reps: 30, category: "core" }
    ];

    const state = {
      currentIndex: 0,
      recentCategories: ["push"]
    };

    // Should skip push exercises and select from pull/legs/core
    const result = getNextExercise(state, pool);
    assert.notStrictEqual(result.exercise.category, "push", "Should not select push exercise when push is in recentCategories");
  });

  test('uncategorized exercises (category=null) always pass category filter', () => {
    const pool = [
      { name: "Pushups", reps: 15, category: "push" },
      { name: "Mystery move", reps: 10, category: null },
      { name: "Pull-ups", reps: 8, category: "pull" }
    ];

    const state = {
      currentIndex: 0,
      recentCategories: ["push", "pull"]
    };

    // With push and pull blocked, only null category exercise should be available
    const result = getNextExercise(state, pool);
    assert.strictEqual(result.exercise.category, null, "Should select uncategorized exercise when all categorized exercises blocked");
  });

  test('uncategorized exercises (category=undefined) always pass category filter', () => {
    const pool = [
      { name: "Pushups", reps: 15, category: "push" },
      { name: "Old exercise", reps: 10 }, // No category field (v1.0 compat)
      { name: "Pull-ups", reps: 8, category: "pull" }
    ];

    const state = {
      currentIndex: 0,
      recentCategories: ["push", "pull"]
    };

    // With push and pull blocked, only undefined category exercise should be available
    const result = getNextExercise(state, pool);
    assert.strictEqual(result.exercise.category, undefined, "Should select v1.0 exercise without category field");
  });

  test('single-category pool falls back to full pool instead of crashing', () => {
    const pool = [
      { name: "Pushups", reps: 15, category: "push" },
      { name: "Bench press", reps: 10, category: "push" },
      { name: "Dips", reps: 12, category: "push" }
    ];

    const state = {
      currentIndex: 0,
      recentCategories: []
    };

    // First rotation: should work normally
    const first = getNextExercise(state, pool);
    assert.strictEqual(first.exercise.category, "push");
    assert.deepStrictEqual(state.recentCategories, ["push"], "Should track first category");

    // Second rotation: all exercises are push, filter would be empty, should fallback
    const second = getNextExercise(state, pool);
    assert.strictEqual(second.exercise.category, "push", "Should select push exercise via fallback when filter is empty");
  });

  test('ring buffer bounds recentCategories to MAX_RECENT_CATEGORIES', () => {
    const pool = [
      { name: "Pushups", reps: 15, category: "push" },
      { name: "Pull-ups", reps: 8, category: "pull" },
      { name: "Squats", reps: 20, category: "legs" },
      { name: "Plank", reps: 30, category: "core" }
    ];

    const state = {
      currentIndex: 0,
      recentCategories: []
    };

    // Rotate through several exercises
    for (let i = 0; i < 5; i++) {
      getNextExercise(state, pool);
    }

    // recentCategories should never exceed MAX_RECENT_CATEGORIES
    assert.ok(
      state.recentCategories.length <= MAX_RECENT_CATEGORIES,
      `recentCategories length (${state.recentCategories.length}) should not exceed MAX_RECENT_CATEGORIES (${MAX_RECENT_CATEGORIES})`
    );
  });

  test('ring buffer maintains only most recent categories', () => {
    const pool = [
      { name: "Pushups", reps: 15, category: "push" },
      { name: "Pull-ups", reps: 8, category: "pull" },
      { name: "Squats", reps: 20, category: "legs" },
      { name: "Plank", reps: 30, category: "core" }
    ];

    const state = {
      currentIndex: 0,
      recentCategories: []
    };

    // Rotate through multiple exercises naturally (let index advance)
    const first = getNextExercise(state, pool); // push
    assert.deepStrictEqual(state.recentCategories, ["push"]);

    const second = getNextExercise(state, pool); // Should skip push, get pull
    assert.strictEqual(second.exercise.category, "pull");
    assert.deepStrictEqual(state.recentCategories, ["push", "pull"]);

    const third = getNextExercise(state, pool); // Should skip push and pull, get legs
    assert.strictEqual(third.exercise.category, "legs");
    // Should shift off "push" and keep ["pull", "legs"]
    assert.deepStrictEqual(state.recentCategories, ["pull", "legs"], "Should shift oldest category when exceeding MAX_RECENT_CATEGORIES");
  });

  test('null categories are never added to recentCategories', () => {
    const pool = [
      { name: "Pushups", reps: 15, category: "push" },
      { name: "Mystery move", reps: 10, category: null },
      { name: "Pull-ups", reps: 8, category: "pull" }
    ];

    const state = {
      currentIndex: 1, // Start with null category exercise
      recentCategories: []
    };

    getNextExercise(state, pool); // Selects null category
    assert.deepStrictEqual(state.recentCategories, [], "Null category should not be tracked");
  });

  test('undefined categories are never added to recentCategories', () => {
    const pool = [
      { name: "Pushups", reps: 15, category: "push" },
      { name: "Old exercise", reps: 10 }, // No category field
      { name: "Pull-ups", reps: 8, category: "pull" }
    ];

    const state = {
      currentIndex: 1, // Start with undefined category exercise
      recentCategories: []
    };

    getNextExercise(state, pool); // Selects undefined category
    assert.deepStrictEqual(state.recentCategories, [], "Undefined category should not be tracked");
  });

  test('v1.0 backward compatibility: pool without categories works normally', () => {
    const pool = [
      { name: "Pushups", reps: 15 },
      { name: "Squats", reps: 20 },
      { name: "Plank", reps: 30 }
    ];

    const state = {
      currentIndex: 0,
      recentCategories: [] // v1.1 field present but unused
    };

    // Should rotate sequentially through pool
    const first = getNextExercise(state, pool);
    assert.strictEqual(first.exercise.name, "Pushups");
    assert.strictEqual(state.currentIndex, 1);

    const second = getNextExercise(state, pool);
    assert.strictEqual(second.exercise.name, "Squats");
    assert.strictEqual(state.currentIndex, 2);

    const third = getNextExercise(state, pool);
    assert.strictEqual(third.exercise.name, "Plank");
    assert.strictEqual(state.currentIndex, 0); // Wrap around
  });

  test('v1.0 backward compatibility: state without recentCategories field works', () => {
    const pool = [
      { name: "Pushups", reps: 15, category: "push" },
      { name: "Pull-ups", reps: 8, category: "pull" }
    ];

    const state = {
      currentIndex: 0
      // No recentCategories field (v1.0 state)
    };

    // Should not crash, should select first exercise
    const result = getNextExercise(state, pool);
    assert.strictEqual(result.exercise.name, "Pushups");

    // Should initialize recentCategories
    assert.ok(Array.isArray(state.recentCategories), "Should initialize recentCategories array");
    assert.deepStrictEqual(state.recentCategories, ["push"]);
  });

  test('determinism: same state + same pool = same exercise', () => {
    const pool = [
      { name: "Pushups", reps: 15, category: "push" },
      { name: "Pull-ups", reps: 8, category: "pull" },
      { name: "Squats", reps: 20, category: "legs" }
    ];

    const state1 = {
      currentIndex: 1,
      recentCategories: ["push"]
    };

    const state2 = {
      currentIndex: 1,
      recentCategories: ["push"]
    };

    const result1 = getNextExercise(state1, pool);
    const result2 = getNextExercise(state2, pool);

    assert.strictEqual(result1.exercise.name, result2.exercise.name, "Same state should produce same exercise");
    assert.strictEqual(result1.exercise.category, result2.exercise.category);
  });

  test('currentIndex advances in full pool space, not filtered pool', () => {
    const pool = [
      { name: "Pushups", reps: 15, category: "push" },
      { name: "Pull-ups", reps: 8, category: "pull" },
      { name: "Squats", reps: 20, category: "legs" },
      { name: "Plank", reps: 30, category: "core" }
    ];

    const state = {
      currentIndex: 0,
      recentCategories: []
    };

    // First rotation
    const first = getNextExercise(state, pool);
    assert.strictEqual(state.currentIndex, 1, "Index should advance by 1");

    // Second rotation
    const second = getNextExercise(state, pool);
    assert.strictEqual(state.currentIndex, 2, "Index should advance by 1 again");

    // Third rotation
    const third = getNextExercise(state, pool);
    assert.strictEqual(state.currentIndex, 3, "Index should advance by 1 again");

    // Fourth rotation
    const fourth = getNextExercise(state, pool);
    assert.strictEqual(state.currentIndex, 0, "Index should wrap at pool.length");
  });

  test('previousIndex reflects index before advancement', () => {
    const pool = [
      { name: "Pushups", reps: 15, category: "push" },
      { name: "Pull-ups", reps: 8, category: "pull" }
    ];

    const state = {
      currentIndex: 0,
      recentCategories: []
    };

    const result = getNextExercise(state, pool);
    assert.strictEqual(result.previousIndex, 0, "previousIndex should be 0 before advancement");
    assert.strictEqual(state.currentIndex, 1, "currentIndex should be 1 after advancement");
  });

  test('return signature unchanged for backward compatibility', () => {
    const pool = [
      { name: "Pushups", reps: 15, category: "push" }
    ];

    const state = {
      currentIndex: 0,
      recentCategories: []
    };

    const result = getNextExercise(state, pool);

    // Check return structure
    assert.ok(result.exercise, "Should return exercise property");
    assert.ok(typeof result.previousIndex === 'number', "Should return previousIndex property");
    assert.strictEqual(Object.keys(result).length, 2, "Should only have exercise and previousIndex properties");
  });

  test('MAX_RECENT_CATEGORIES constant is exported', () => {
    assert.ok(typeof MAX_RECENT_CATEGORIES === 'number', "MAX_RECENT_CATEGORIES should be exported as number");
    assert.strictEqual(MAX_RECENT_CATEGORIES, 2, "MAX_RECENT_CATEGORIES should default to 2");
  });
});

describe('Rotation Module - Edge Cases', () => {
  test('empty pool throws clear error', () => {
    const pool = [];
    const state = { currentIndex: 0, recentCategories: [] };

    assert.throws(
      () => getNextExercise(state, pool),
      /empty/i,
      "Should throw error for empty pool"
    );
  });

  test('pool with all exercises from same category eventually allows repetition', () => {
    const pool = [
      { name: "Pushup variant 1", reps: 10, category: "push" },
      { name: "Pushup variant 2", reps: 12, category: "push" },
      { name: "Pushup variant 3", reps: 15, category: "push" }
    ];

    const state = {
      currentIndex: 0,
      recentCategories: []
    };

    // First selection works
    const first = getNextExercise(state, pool);
    assert.strictEqual(first.exercise.category, "push");

    // Second selection should fallback to full pool (filter is empty)
    const second = getNextExercise(state, pool);
    assert.strictEqual(second.exercise.category, "push", "Should allow push via fallback");
  });

  test('mixed categorized and uncategorized pool handles filtering correctly', () => {
    const pool = [
      { name: "Pushups", reps: 15, category: "push" },
      { name: "Old exercise 1", reps: 10 },
      { name: "Pull-ups", reps: 8, category: "pull" },
      { name: "Old exercise 2", reps: 12, category: null }
    ];

    const state = {
      currentIndex: 0,
      recentCategories: ["push", "pull"]
    };

    // Should select uncategorized exercise (null or undefined)
    const result = getNextExercise(state, pool);
    assert.ok(
      result.exercise.category === null || result.exercise.category === undefined,
      "Should select uncategorized exercise when categorized ones are blocked"
    );
  });
});
