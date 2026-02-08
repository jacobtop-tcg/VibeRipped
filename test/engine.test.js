/**
 * Integration tests for rotation engine
 *
 * Tests cover rotation, cooldown, corruption recovery, and output format.
 * Uses Node.js built-in test runner (node:test) with temporary state directories.
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// Module under test
const { trigger } = require('../engine.js');
const { DEFAULT_POOL } = require('../lib/pool.js');

/**
 * Creates a temporary state directory for isolated test runs
 */
function createTempStateDir() {
  const tmpBase = os.tmpdir();
  const uniqueSuffix = crypto.randomBytes(8).toString('hex');
  const tmpDir = path.join(tmpBase, `viberipped-test-${uniqueSuffix}`);
  fs.mkdirSync(tmpDir, { recursive: true, mode: 0o700 });
  return tmpDir;
}

/**
 * Removes temporary state directory and contents
 */
function cleanupTempStateDir(tmpDir) {
  try {
    if (fs.existsSync(tmpDir)) {
      const files = fs.readdirSync(tmpDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tmpDir, file));
      }
      fs.rmdirSync(tmpDir);
    }
  } catch (e) {
    // Cleanup is best-effort
  }
}

describe('Rotation Engine - Sequential Rotation', () => {
  let tmpDir;
  let statePath;

  beforeEach(() => {
    tmpDir = createTempStateDir();
    statePath = path.join(tmpDir, 'state.json');
  });

  afterEach(() => {
    cleanupTempStateDir(tmpDir);
  });

  test('sequential rotation advances through pool', () => {
    // Trigger N times and verify exercises match pool order
    const results = [];
    for (let i = 0; i < DEFAULT_POOL.length; i++) {
      const result = trigger(DEFAULT_POOL, { statePath });
      assert.strictEqual(result.type, 'exercise');
      results.push(result.exercise);
    }

    // Verify order matches pool
    for (let i = 0; i < DEFAULT_POOL.length; i++) {
      assert.strictEqual(results[i].name, DEFAULT_POOL[i].name);
      assert.strictEqual(results[i].reps, DEFAULT_POOL[i].reps);
    }
  });

  test('rotation wraps around at end of pool', () => {
    // Trigger pool.length + 1 times
    for (let i = 0; i < DEFAULT_POOL.length; i++) {
      trigger(DEFAULT_POOL, { statePath });
    }

    // Next trigger should wrap to index 0
    const result = trigger(DEFAULT_POOL, { statePath });
    assert.strictEqual(result.type, 'exercise');
    assert.strictEqual(result.exercise.name, DEFAULT_POOL[0].name);
    assert.strictEqual(result.position.current, 0);
  });

  test('state persists across trigger calls', () => {
    // First trigger
    const first = trigger(DEFAULT_POOL, { statePath });
    assert.strictEqual(first.exercise.name, DEFAULT_POOL[0].name);

    // Second trigger (separate call, should load state from disk)
    const second = trigger(DEFAULT_POOL, { statePath });
    assert.strictEqual(second.exercise.name, DEFAULT_POOL[1].name);
    assert.strictEqual(second.position.current, 1);
  });
});

describe('Rotation Engine - Cooldown Enforcement', () => {
  let tmpDir;
  let statePath;

  beforeEach(() => {
    tmpDir = createTempStateDir();
    statePath = path.join(tmpDir, 'state.json');
  });

  afterEach(() => {
    cleanupTempStateDir(tmpDir);
  });

  test('first trigger always allowed (sentinel 0)', () => {
    // Fresh state has lastTriggerTime = 0 (sentinel)
    const result = trigger(DEFAULT_POOL, { statePath });
    assert.strictEqual(result.type, 'exercise');
    assert.strictEqual(result.totalTriggered, 1);
  });

  test('cooldown blocks trigger within interval', () => {
    // First trigger
    const first = trigger(DEFAULT_POOL, { statePath });
    assert.strictEqual(first.type, 'exercise');

    // Immediate second trigger (within cooldown window)
    const second = trigger(DEFAULT_POOL, { statePath });
    assert.strictEqual(second.type, 'cooldown');
    assert.ok(second.remainingMs > 0);
    assert.ok(second.remainingMs <= 300000); // 5 minutes in ms
    assert.ok(second.remainingHuman.match(/\d+m \d+s|\d+s/));
  });

  test('cooldown allows trigger after interval', () => {
    // First trigger
    const first = trigger(DEFAULT_POOL, { statePath });
    assert.strictEqual(first.type, 'exercise');

    // Manually manipulate state to simulate time passage
    const stateContent = fs.readFileSync(statePath, 'utf8');
    const state = JSON.parse(stateContent);
    state.lastTriggerTime = Date.now() - 301000; // 5 minutes + 1 second ago
    fs.writeFileSync(statePath, JSON.stringify(state, null, 2));

    // Second trigger should be allowed
    const second = trigger(DEFAULT_POOL, { statePath });
    assert.strictEqual(second.type, 'exercise');
    assert.strictEqual(second.exercise.name, DEFAULT_POOL[1].name);
  });
});

describe('Rotation Engine - Output Format', () => {
  let tmpDir;
  let statePath;

  beforeEach(() => {
    tmpDir = createTempStateDir();
    statePath = path.join(tmpDir, 'state.json');
  });

  afterEach(() => {
    cleanupTempStateDir(tmpDir);
  });

  test('prompt format is crisp command', () => {
    const result = trigger(DEFAULT_POOL, { statePath });
    assert.strictEqual(result.type, 'exercise');

    // Format: "{name} x{reps}"
    assert.ok(result.prompt.match(/^.+ x\d+$/), `Expected crisp format, got: ${result.prompt}`);

    // Should match exercise name and reps
    const expected = `${result.exercise.name} x${result.exercise.reps}`;
    assert.strictEqual(result.prompt, expected);
  });

  test('prompt has zero motivational language', () => {
    const result = trigger(DEFAULT_POOL, { statePath });
    assert.strictEqual(result.type, 'exercise');

    // Banned words/phrases
    const banned = ['try', 'great', 'nice', 'keep', 'good', "let's", '!'];
    const lowerPrompt = result.prompt.toLowerCase();

    for (const word of banned) {
      assert.ok(!lowerPrompt.includes(word), `Prompt contains banned word "${word}": ${result.prompt}`);
    }
  });
});

describe('Rotation Engine - Corruption Recovery', () => {
  let tmpDir;
  let statePath;

  beforeEach(() => {
    tmpDir = createTempStateDir();
    statePath = path.join(tmpDir, 'state.json');
  });

  afterEach(() => {
    cleanupTempStateDir(tmpDir);
  });

  test('corrupt state recovers and still returns exercise', () => {
    // Write garbage to state file
    fs.writeFileSync(statePath, 'GARBAGE{not valid json}', 'utf8');

    // Trigger should recover gracefully
    const result = trigger(DEFAULT_POOL, { statePath });
    assert.strictEqual(result.type, 'exercise');
    assert.strictEqual(result.exercise.name, DEFAULT_POOL[0].name);
    assert.strictEqual(result.totalTriggered, 1);
  });

  test('pool change resets index', () => {
    // Trigger 3 times with default pool
    trigger(DEFAULT_POOL, { statePath });
    trigger(DEFAULT_POOL, { statePath });
    const third = trigger(DEFAULT_POOL, { statePath });
    assert.strictEqual(third.exercise.name, DEFAULT_POOL[2].name);

    // Create a different pool
    const newPool = [
      { name: "Jumping jacks", reps: 20 },
      { name: "Mountain climbers", reps: 15 }
    ];

    // Trigger with new pool - should reset to index 0
    const afterChange = trigger(newPool, { statePath });
    assert.strictEqual(afterChange.type, 'exercise');
    assert.strictEqual(afterChange.exercise.name, newPool[0].name);
    assert.strictEqual(afterChange.position.current, 0);
  });
});
