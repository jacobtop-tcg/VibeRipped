/**
 * Tests for Difficulty Module
 *
 * Tests cover scaling algorithms, difficulty steps, and bounds enforcement.
 * Uses Node.js built-in test runner.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert');

// Module under test
const {
  DIFFICULTY_STEPS,
  MIN_REPS,
  MAX_REPS,
  scaleRepsForLatency,
  incrementDifficulty,
  decrementDifficulty,
  getDifficultyLabel
} = require('../lib/difficulty.js');

describe('Difficulty Module - Constants', () => {
  test('DIFFICULTY_STEPS contains correct discrete values', () => {
    const expected = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5];
    assert.deepStrictEqual(DIFFICULTY_STEPS, expected);
  });

  test('MIN_REPS is 5', () => {
    assert.strictEqual(MIN_REPS, 5);
  });

  test('MAX_REPS is 60', () => {
    assert.strictEqual(MAX_REPS, 60);
  });
});

describe('Difficulty Module - scaleRepsForLatency', () => {
  test('no latency bonus with default multiplier', () => {
    const result = scaleRepsForLatency(10, 0, 1.0);
    assert.strictEqual(result, 10);
  });

  test('min latency (2000ms) equals factor 1.0', () => {
    const result = scaleRepsForLatency(10, 2000, 1.0);
    assert.strictEqual(result, 10);
  });

  test('max latency (30000ms) equals factor 1.5', () => {
    const result = scaleRepsForLatency(10, 30000, 1.0);
    assert.strictEqual(result, 15);
  });

  test('mid latency (16000ms) equals factor ~1.25', () => {
    const result = scaleRepsForLatency(10, 16000, 1.0);
    assert.strictEqual(result, 13); // 10 * 1.25 = 12.5 -> 13 rounded
  });

  test('no latency with 2x multiplier', () => {
    const result = scaleRepsForLatency(10, 0, 2.0);
    assert.strictEqual(result, 20);
  });

  test('max latency with 2.5x multiplier', () => {
    const result = scaleRepsForLatency(10, 30000, 2.5);
    assert.strictEqual(result, 38); // 10 * 1.5 * 2.5 = 37.5 -> 38 rounded
  });

  test('below min clamped up to 5', () => {
    const result = scaleRepsForLatency(3, 0, 1.0);
    assert.strictEqual(result, 5);
  });

  test('above max clamped down to 60', () => {
    const result = scaleRepsForLatency(50, 30000, 2.5);
    assert.strictEqual(result, 60); // 50 * 1.5 * 2.5 = 187.5 -> clamped to 60
  });

  test('negative latency treated as 0/min', () => {
    const result = scaleRepsForLatency(10, -500, 1.0);
    assert.strictEqual(result, 10);
  });

  test('latency beyond max capped at 30000', () => {
    const result = scaleRepsForLatency(10, 100000, 1.0);
    assert.strictEqual(result, 15); // Same as 30000ms
  });
});

describe('Difficulty Module - incrementDifficulty', () => {
  test('increment from default 1.0 to 1.25', () => {
    const result = incrementDifficulty(1.0);
    assert.strictEqual(result, 1.25);
  });

  test('increment at max stays at max (2.5)', () => {
    const result = incrementDifficulty(2.5);
    assert.strictEqual(result, 2.5);
  });

  test('increment from min 0.5 to 0.75', () => {
    const result = incrementDifficulty(0.5);
    assert.strictEqual(result, 0.75);
  });

  test('invalid value resets to default (no increment)', () => {
    const result = incrementDifficulty(0.99);
    assert.strictEqual(result, 1.0);
  });
});

describe('Difficulty Module - decrementDifficulty', () => {
  test('decrement from default 1.0 to 0.75', () => {
    const result = decrementDifficulty(1.0);
    assert.strictEqual(result, 0.75);
  });

  test('decrement at min stays at min (0.5)', () => {
    const result = decrementDifficulty(0.5);
    assert.strictEqual(result, 0.5);
  });

  test('decrement from max 2.5 to 2.25', () => {
    const result = decrementDifficulty(2.5);
    assert.strictEqual(result, 2.25);
  });

  test('invalid value resets to default', () => {
    const result = decrementDifficulty(0.99);
    assert.strictEqual(result, 1.0);
  });
});

describe('Difficulty Module - getDifficultyLabel', () => {
  test('default 1.0 shows as "1.0x (default)"', () => {
    const result = getDifficultyLabel(1.0);
    assert.strictEqual(result, '1.0x (default)');
  });

  test('min 0.5 shows as "0.5x (easiest)"', () => {
    const result = getDifficultyLabel(0.5);
    assert.strictEqual(result, '0.5x (easiest)');
  });

  test('max 2.5 shows as "2.5x (hardest)"', () => {
    const result = getDifficultyLabel(2.5);
    assert.strictEqual(result, '2.5x (hardest)');
  });

  test('mid value 1.5 shows as "1.5x"', () => {
    const result = getDifficultyLabel(1.5);
    assert.strictEqual(result, '1.5x');
  });
});
