const { describe, test } = require('node:test');
const assert = require('node:assert/strict');

// Import modules that will be created in the GREEN phase
const { parseStdin } = require('../lib/statusline/stdin');
const { isProcessing } = require('../lib/statusline/detection');
const { formatExercise, ANSI } = require('../lib/statusline/format');

describe('parseStdin', () => {
  test('parses valid JSON string into object', () => {
    const input = '{"context_window": {"current_usage": {"input_tokens": 100}}}';
    const result = parseStdin(input);
    assert.deepStrictEqual(result, { context_window: { current_usage: { input_tokens: 100 } } });
  });

  test('returns null for empty string input', () => {
    const result = parseStdin('');
    assert.strictEqual(result, null);
  });

  test('returns null for malformed JSON without throwing', () => {
    const result = parseStdin('{invalid json}');
    assert.strictEqual(result, null);
  });

  test('returns null for non-string input (undefined)', () => {
    const result = parseStdin(undefined);
    assert.strictEqual(result, null);
  });

  test('returns null for non-string input (null)', () => {
    const result = parseStdin(null);
    assert.strictEqual(result, null);
  });

  test('returns null for non-string input (number)', () => {
    const result = parseStdin(123);
    assert.strictEqual(result, null);
  });
});

describe('isProcessing', () => {
  test('returns true when current_usage has input_tokens > 0', () => {
    const data = { context_window: { current_usage: { input_tokens: 50, cache_read_input_tokens: 0 } } };
    assert.strictEqual(isProcessing(data), true);
  });

  test('returns true when current_usage has cache_read_input_tokens > 0', () => {
    const data = { context_window: { current_usage: { input_tokens: 0, cache_read_input_tokens: 200 } } };
    assert.strictEqual(isProcessing(data), true);
  });

  test('returns false when current_usage is null (pre-first-API-call state)', () => {
    const data = { context_window: { current_usage: null } };
    assert.strictEqual(isProcessing(data), false);
  });

  test('returns false when current_usage is undefined', () => {
    const data = { context_window: { current_usage: undefined } };
    assert.strictEqual(isProcessing(data), false);
  });

  test('returns false when context_window is missing entirely', () => {
    const data = { some_other_field: 'value' };
    assert.strictEqual(isProcessing(data), false);
  });

  test('returns false when current_usage has all zero tokens', () => {
    const data = { context_window: { current_usage: { input_tokens: 0, cache_read_input_tokens: 0 } } };
    assert.strictEqual(isProcessing(data), false);
  });

  test('returns false for null input data', () => {
    assert.strictEqual(isProcessing(null), false);
  });

  test('returns false for undefined input data', () => {
    assert.strictEqual(isProcessing(undefined), false);
  });
});

describe('formatExercise', () => {
  test('wraps exercise name and reps in cyan bold ANSI codes', () => {
    const result = formatExercise('Push-ups', 10);
    assert.strictEqual(result, '\x1b[36m\x1b[1mPush-ups x10\x1b[0m');
  });

  test('returns empty string when exercise is null', () => {
    const result = formatExercise(null, 10);
    assert.strictEqual(result, '');
  });

  test('returns empty string when exercise is undefined', () => {
    const result = formatExercise(undefined, 10);
    assert.strictEqual(result, '');
  });

  test('handles exercise with only name (no reps) gracefully', () => {
    const result = formatExercise('Jumping Jacks');
    assert.strictEqual(result, '\x1b[36m\x1b[1mJumping Jacks\x1b[0m');
  });

  test('exported ANSI object contains reset, cyan, bold keys', () => {
    assert.ok(ANSI.reset);
    assert.ok(ANSI.cyan);
    assert.ok(ANSI.bold);
    assert.strictEqual(ANSI.reset, '\x1b[0m');
    assert.strictEqual(ANSI.cyan, '\x1b[36m');
    assert.strictEqual(ANSI.bold, '\x1b[1m');
  });
});
