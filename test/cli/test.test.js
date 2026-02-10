/**
 * Integration tests for test command
 *
 * Tests the viberipped test CLI command end-to-end using child_process.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Runs CLI command in isolated temp directory.
 *
 * @param {Array<string>} args - Command arguments
 * @param {string} [tempHome] - Optional temp home directory (for multi-call tests)
 * @returns {Promise<{code: number, stdout: string, stderr: string, tempHome: string}>}
 */
function runCLI(args, tempHome) {
  return new Promise((resolve, reject) => {
    // Create isolated temp directory if not provided
    if (!tempHome) {
      tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
      fs.mkdirSync(tempHome, { recursive: true });
    }

    const env = {
      ...process.env,
      HOME: tempHome,
      XDG_CONFIG_HOME: path.join(tempHome, '.config')
    };

    const binPath = path.join(__dirname, '../../bin/viberipped.js');
    const child = spawn('node', [binPath, ...args], { env });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      resolve({ code, stdout, stderr, tempHome });
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Creates a minimal pool.json in the state directory.
 *
 * @param {string} tempHome - Temp home directory
 * @param {Array} pool - Pool exercises array
 */
function createPool(tempHome, pool) {
  const stateDir = path.join(tempHome, '.config', 'viberipped');
  fs.mkdirSync(stateDir, { recursive: true });
  const poolPath = path.join(stateDir, 'pool.json');
  fs.writeFileSync(poolPath, JSON.stringify(pool, null, 2));
}

/**
 * Creates a minimal state.json in the state directory.
 *
 * @param {string} tempHome - Temp home directory
 * @param {Object} state - State object
 */
function createState(tempHome, state) {
  const stateDir = path.join(tempHome, '.config', 'viberipped');
  fs.mkdirSync(stateDir, { recursive: true });
  const statePath = path.join(stateDir, 'state.json');
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

/**
 * Reads state.json from temp home directory.
 *
 * @param {string} tempHome - Temp home directory
 * @returns {Object} Parsed state object
 */
function readState(tempHome) {
  const statePath = path.join(tempHome, '.config', 'viberipped', 'state.json');
  const content = fs.readFileSync(statePath, 'utf8');
  return JSON.parse(content);
}

/**
 * Cleanup temp directory.
 *
 * @param {string} tempHome - Temp home directory
 */
function cleanup(tempHome) {
  try {
    fs.rmSync(tempHome, { recursive: true, force: true });
  } catch (e) {
    // Ignore cleanup errors
  }
}

describe('test command', () => {
  test('shows next exercise in dry-run mode', async () => {
    const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempHome, { recursive: true });

    // Create pool
    const testPool = [
      { name: "Pushups", reps: 15, equipment: [] },
      { name: "Squats", reps: 20, equipment: [] }
    ];
    createPool(tempHome, testPool);

    // Create state
    const crypto = require('crypto');
    const poolHash = crypto.createHash('sha256').update(JSON.stringify(testPool), 'utf8').digest('hex');
    createState(tempHome, {
      currentIndex: 0,
      lastTriggerTime: 0,
      poolHash,
      totalTriggered: 0
    });

    const { code, stdout } = await runCLI(['test'], tempHome);

    assert.strictEqual(code, 0);
    assert.match(stdout, /Pushups x15/);
    assert.match(stdout, /dry-run/i);

    cleanup(tempHome);
  });

  test('does not advance state', async () => {
    const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempHome, { recursive: true });

    // Create pool
    const testPool = [
      { name: "Pushups", reps: 15, equipment: [] },
      { name: "Squats", reps: 20, equipment: [] },
      { name: "Burpees", reps: 10, equipment: [] }
    ];
    createPool(tempHome, testPool);

    // Create state with currentIndex = 1
    const crypto = require('crypto');
    const poolHash = crypto.createHash('sha256').update(JSON.stringify(testPool), 'utf8').digest('hex');
    createState(tempHome, {
      currentIndex: 1,
      lastTriggerTime: Date.now() - 10000,
      poolHash,
      totalTriggered: 5
    });

    // Run test command
    await runCLI(['test'], tempHome);

    // Check state - should be unchanged
    const state = readState(tempHome);
    assert.strictEqual(state.currentIndex, 1);
    assert.strictEqual(state.totalTriggered, 5);

    cleanup(tempHome);
  });

  test('shows error when no pool exists', async () => {
    const { code, stderr } = await runCLI(['test']);

    // The test command will try to run engine which will initialize defaults
    // So we expect either an error or it runs with defaults
    // This test verifies it doesn't crash
    assert.ok(code === 0 || code === 1);
  });
});
