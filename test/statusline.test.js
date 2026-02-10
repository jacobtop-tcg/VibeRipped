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

  test('formatExercise with prefix option prepends prefix inside ANSI codes', () => {
    const result = formatExercise('Push-ups', 10, { prefix: '💪 ' });
    assert.strictEqual(result, '\x1b[36m\x1b[1m💪 Push-ups x10\x1b[0m');
  });

  test('formatExercise without prefix option produces identical output to current behavior', () => {
    const withoutPrefix = formatExercise('Push-ups', 10);
    const withEmptyOptions = formatExercise('Push-ups', 10, {});
    assert.strictEqual(withoutPrefix, '\x1b[36m\x1b[1mPush-ups x10\x1b[0m');
    assert.strictEqual(withEmptyOptions, '\x1b[36m\x1b[1mPush-ups x10\x1b[0m');
    assert.strictEqual(withoutPrefix, withEmptyOptions);
  });

  test('formatExercise with empty prefix string produces same output as no prefix', () => {
    const withoutPrefix = formatExercise('Push-ups', 10);
    const withEmptyPrefix = formatExercise('Push-ups', 10, { prefix: '' });
    assert.strictEqual(withoutPrefix, withEmptyPrefix);
  });
});

describe('formatExercise type-aware display', () => {
  test('formatExercise with type="timed" renders "30s" not "x30"', () => {
    const result = formatExercise('Plank', 30, 'timed');
    assert.match(result, /Plank 30s/);
    assert.ok(!result.includes('x30'));
  });

  test('formatExercise with type="reps" renders "x15" (backward compat)', () => {
    const result = formatExercise('Pushups', 15, 'reps');
    assert.match(result, /Pushups x15/);
  });

  test('formatExercise without type defaults to "reps" format', () => {
    const result = formatExercise('Pushups', 15);
    assert.match(result, /Pushups x15/);
  });

  test('formatExercise with type="timed" and prefix option', () => {
    const result = formatExercise('Wall sit', 30, 'timed', { prefix: '💪 ' });
    assert.match(result, /💪 Wall sit 30s/);
  });

  test('formatExercise with type="timed" and null value returns just name', () => {
    const result = formatExercise('Plank', null, 'timed');
    assert.match(result, /Plank/);
    assert.ok(!result.includes('null'));
    assert.ok(!result.includes('x'));
    assert.ok(!result.includes('s'));
  });
});

// Integration tests for statusline.js entry point
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('statusline.js integration', () => {
  let tmpDir;

  // Create isolated state directory before each test
  function createTmpStateDir() {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberipped-test-'));
    return tmpDir;
  }

  // Clean up temp directory after each test
  function cleanupTmpStateDir() {
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  test('outputs ANSI-formatted exercise when valid processing JSON piped to stdin', () => {
    const tmpHome = createTmpStateDir();
    const input = JSON.stringify({
      context_window: {
        current_usage: {
          input_tokens: 500,
          cache_read_input_tokens: 0
        }
      }
    });

    try {
      const result = execSync(
        `echo '${input}' | node ${path.join(__dirname, '..', 'statusline.js')}`,
        {
          encoding: 'utf8',
          env: { ...process.env, HOME: tmpHome, VIBERIPPED_BYPASS_COOLDOWN: '1' }
        }
      );

      // Should contain ANSI codes (cyan bold) and exercise format
      assert.match(result, /\x1b\[36m\x1b\[1m/); // cyan bold ANSI codes
      assert.match(result, / x\d+/); // " x{reps}" format
      assert.match(result, /\x1b\[0m/); // reset code
    } finally {
      cleanupTmpStateDir();
    }
  });

  test('outputs empty when non-processing JSON (current_usage: null) piped to stdin', () => {
    const tmpHome = createTmpStateDir();
    const input = JSON.stringify({
      context_window: {
        current_usage: null
      }
    });

    try {
      const result = execSync(
        `echo '${input}' | node ${path.join(__dirname, '..', 'statusline.js')}`,
        {
          encoding: 'utf8',
          env: { ...process.env, HOME: tmpHome, VIBERIPPED_BYPASS_COOLDOWN: '1' }
        }
      );

      assert.strictEqual(result, '');
    } finally {
      cleanupTmpStateDir();
    }
  });

  test('outputs empty and exits 0 when invalid JSON piped to stdin', () => {
    const tmpHome = createTmpStateDir();

    try {
      const result = execSync(
        `echo 'invalid json' | node ${path.join(__dirname, '..', 'statusline.js')}; echo $?`,
        {
          encoding: 'utf8',
          env: { ...process.env, HOME: tmpHome, VIBERIPPED_BYPASS_COOLDOWN: '1' },
          shell: '/bin/bash'
        }
      );

      // Should contain exit code 0
      assert.match(result, /0/);
    } finally {
      cleanupTmpStateDir();
    }
  });

  test('outputs empty and exits 0 when empty stdin', () => {
    const tmpHome = createTmpStateDir();

    try {
      const result = execSync(
        `echo '' | node ${path.join(__dirname, '..', 'statusline.js')}; echo $?`,
        {
          encoding: 'utf8',
          env: { ...process.env, HOME: tmpHome, VIBERIPPED_BYPASS_COOLDOWN: '1' },
          shell: '/bin/bash'
        }
      );

      // Should contain exit code 0
      assert.match(result, /0/);
    } finally {
      cleanupTmpStateDir();
    }
  });

  test('displays timed exercise as "30s" not "x30" in statusline output', () => {
    const tmpHome = createTmpStateDir();

    // Create pool with a timed exercise
    const stateDir = path.join(tmpHome, '.config', 'viberipped');
    fs.mkdirSync(stateDir, { recursive: true });

    const pool = [
      { name: 'Plank', reps: 30, type: 'timed', duration: 30, equipment: [] }
    ];
    fs.writeFileSync(path.join(stateDir, 'pool.json'), JSON.stringify(pool, null, 2));

    // Create configuration.json with no equipment (empty pool, will be overridden by pool.json)
    // The key is that configPoolHash must match what assemblePool() produces
    const config = { equipment: { kettlebell: false, dumbbells: false, pullUpBar: false, parallettes: false } };
    fs.writeFileSync(path.join(stateDir, 'configuration.json'), JSON.stringify(config, null, 2));

    // Compute configPoolHash from the default bodyweight pool (what assemblePool produces with no equipment)
    const { assemblePool, computePoolHash } = require('../lib/pool');
    const assembledPool = assemblePool(config);
    const configPoolHash = computePoolHash(assembledPool);

    // Create state with poolHash and configPoolHash to prevent engine from reinitializing
    const crypto = require('crypto');
    const poolHash = crypto.createHash('sha256').update(JSON.stringify(pool)).digest('hex');
    const state = {
      poolHash: poolHash,
      configPoolHash: configPoolHash, // Must match assembled pool hash
      currentIndex: 0,
      lastTriggerTime: 0,
      totalTriggered: 0
    };
    fs.writeFileSync(path.join(stateDir, 'state.json'), JSON.stringify(state, null, 2));

    const input = JSON.stringify({
      context_window: {
        current_usage: {
          input_tokens: 500,
          cache_read_input_tokens: 0
        }
      }
    });

    try {
      const result = execSync(
        `echo '${input}' | node ${path.join(__dirname, '..', 'statusline.js')}`,
        {
          encoding: 'utf8',
          env: { ...process.env, HOME: tmpHome, VIBERIPPED_BYPASS_COOLDOWN: '1' }
        }
      );

      // Should display "30s" not "x30" for timed exercises
      assert.match(result, /Plank 30s/);
      assert.ok(!result.includes('x30'), 'Should not contain "x30" for timed exercise');
      assert.match(result, /\x1b\[36m\x1b\[1m/); // cyan bold ANSI codes
      assert.match(result, /💪 /); // prefix emoji
    } finally {
      cleanupTmpStateDir();
    }
  });

  test('displays rep exercise as "x15" not "15s" in statusline output', () => {
    const tmpHome = createTmpStateDir();

    // Create pool with a rep exercise
    const stateDir = path.join(tmpHome, '.config', 'viberipped');
    fs.mkdirSync(stateDir, { recursive: true });

    const pool = [
      { name: 'Pushups', reps: 15, type: 'reps', equipment: [] }
    ];
    fs.writeFileSync(path.join(stateDir, 'pool.json'), JSON.stringify(pool, null, 2));

    // Create configuration.json with no equipment (empty pool, will be overridden by pool.json)
    const config = { equipment: { kettlebell: false, dumbbells: false, pullUpBar: false, parallettes: false } };
    fs.writeFileSync(path.join(stateDir, 'configuration.json'), JSON.stringify(config, null, 2));

    // Compute configPoolHash from the default bodyweight pool
    const { assemblePool, computePoolHash } = require('../lib/pool');
    const assembledPool = assemblePool(config);
    const configPoolHash = computePoolHash(assembledPool);

    // Create state with poolHash and configPoolHash to prevent engine from reinitializing
    const crypto = require('crypto');
    const poolHash = crypto.createHash('sha256').update(JSON.stringify(pool)).digest('hex');
    const state = {
      poolHash: poolHash,
      configPoolHash: configPoolHash, // Must match assembled pool hash
      currentIndex: 0,
      lastTriggerTime: 0,
      totalTriggered: 0
    };
    fs.writeFileSync(path.join(stateDir, 'state.json'), JSON.stringify(state, null, 2));

    const input = JSON.stringify({
      context_window: {
        current_usage: {
          input_tokens: 500,
          cache_read_input_tokens: 0
        }
      }
    });

    try {
      const result = execSync(
        `echo '${input}' | node ${path.join(__dirname, '..', 'statusline.js')}`,
        {
          encoding: 'utf8',
          env: { ...process.env, HOME: tmpHome, VIBERIPPED_BYPASS_COOLDOWN: '1' }
        }
      );

      // Should display "x15" not "15s" for rep exercises
      assert.match(result, /Pushups x15/);
      assert.ok(!result.includes('15s'), 'Should not contain "15s" for rep exercise');
      assert.match(result, /\x1b\[36m\x1b\[1m/); // cyan bold ANSI codes
      assert.match(result, /💪 /); // prefix emoji
    } finally {
      cleanupTmpStateDir();
    }
  });
});
