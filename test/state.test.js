/**
 * Tests for State Module
 *
 * Tests cover state validation, creation, load/save with graceful recovery,
 * and v1.1 schema extensions.
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// Module under test
const {
  getStatePath,
  getStateDir,
  createDefaultState,
  loadState,
  saveState,
  validateState
} = require('../lib/state.js');

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

describe('State Module - v1.1 state schema', () => {
  const testPool = [
    { name: "Pushups", reps: 15 },
    { name: "Squats", reps: 20 }
  ];

  test('v1.0 state without recentCategories passes validateState', () => {
    const v10State = {
      currentIndex: 0,
      lastTriggerTime: 0,
      poolHash: "abc123",
      totalTriggered: 0
    };
    assert.strictEqual(validateState(v10State), true);
  });

  test('v1.1 state with recentCategories: ["push", "pull"] passes validateState', () => {
    const v11State = {
      currentIndex: 0,
      lastTriggerTime: 0,
      poolHash: "abc123",
      totalTriggered: 0,
      recentCategories: ["push", "pull"]
    };
    assert.strictEqual(validateState(v11State), true);
  });

  test('non-array recentCategories rejected', () => {
    const invalidState = {
      currentIndex: 0,
      lastTriggerTime: 0,
      poolHash: "abc123",
      totalTriggered: 0,
      recentCategories: "push"
    };
    assert.strictEqual(validateState(invalidState), false);
  });

  test('non-string entries in recentCategories rejected', () => {
    const invalidEntries = {
      currentIndex: 0,
      lastTriggerTime: 0,
      poolHash: "abc123",
      totalTriggered: 0,
      recentCategories: [123]
    };
    assert.strictEqual(validateState(invalidEntries), false);
  });

  test('createDefaultState includes empty recentCategories array', () => {
    const defaultState = createDefaultState(testPool);
    assert.ok(Array.isArray(defaultState.recentCategories), 'recentCategories should be an array');
    assert.strictEqual(defaultState.recentCategories.length, 0, 'recentCategories should be empty by default');
  });

  test('v1.0 state with schemaVersion: "1.0" passes validateState', () => {
    const v10State = {
      currentIndex: 0,
      lastTriggerTime: 0,
      poolHash: "abc123",
      totalTriggered: 0,
      schemaVersion: "1.0"
    };
    assert.strictEqual(validateState(v10State), true);
  });

  test('non-string schemaVersion rejected in state', () => {
    const invalidSchema = {
      currentIndex: 0,
      lastTriggerTime: 0,
      poolHash: "abc123",
      totalTriggered: 0,
      schemaVersion: 1.1
    };
    assert.strictEqual(validateState(invalidSchema), false);
  });

  test('createDefaultState includes schemaVersion field', () => {
    const defaultState = createDefaultState(testPool);
    assert.strictEqual(defaultState.schemaVersion, "1.0", 'schemaVersion should be "1.0" by default');
  });
});
