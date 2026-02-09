/**
 * CLI Difficulty Commands Tests
 *
 * Tests for `vibripped harder` and `vibripped softer` commands.
 * Uses isolated HOME directories to prevent config pollution.
 */

const { describe, test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

/**
 * Creates a temporary HOME directory for isolated test runs
 */
function createTempHomeDir() {
  const tmpBase = os.tmpdir();
  const uniqueSuffix = crypto.randomBytes(8).toString('hex');
  const tmpHome = path.join(tmpBase, `viberipped-cli-test-${uniqueSuffix}`);
  fs.mkdirSync(tmpHome, { recursive: true, mode: 0o700 });
  return tmpHome;
}

/**
 * Removes temporary HOME directory and contents
 */
function cleanupTempHomeDir(tmpHome) {
  try {
    if (fs.existsSync(tmpHome)) {
      // Recursively delete directory
      const configDir = path.join(tmpHome, '.config', 'viberipped');
      if (fs.existsSync(configDir)) {
        const files = fs.readdirSync(configDir);
        for (const file of files) {
          fs.unlinkSync(path.join(configDir, file));
        }
        fs.rmdirSync(configDir);
        fs.rmdirSync(path.join(tmpHome, '.config'));
      }
      fs.rmdirSync(tmpHome);
    }
  } catch (e) {
    // Cleanup is best-effort
  }
}

/**
 * Executes vibripped CLI command with isolated HOME
 */
function execVibripped(args, tmpHome) {
  const cliPath = path.join(__dirname, '../../bin/vibripped.js');
  const env = { ...process.env, HOME: tmpHome };

  try {
    const output = execFileSync('node', [cliPath, ...args], {
      env,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { stdout: output, stderr: '', exitCode: 0 };
  } catch (error) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.status || 1
    };
  }
}

/**
 * Reads config file from isolated HOME
 */
function readConfig(tmpHome) {
  const configPath = path.join(tmpHome, '.config', 'viberipped', 'configuration.json');
  if (!fs.existsSync(configPath)) {
    return null;
  }
  const content = fs.readFileSync(configPath, 'utf8');
  return JSON.parse(content);
}

describe('CLI - harder command', () => {
  let tmpHome;

  beforeEach(() => {
    tmpHome = createTempHomeDir();
  });

  afterEach(() => {
    cleanupTempHomeDir(tmpHome);
  });

  test('vibripped harder from default (1.0x) changes config to 1.25x', () => {
    const result = execVibripped(['harder'], tmpHome);

    assert.strictEqual(result.exitCode, 0, 'Command should exit with 0');
    assert.ok(result.stdout.includes('Difficulty increased'), 'Should output success message');
    assert.ok(result.stdout.includes('1.0x'), 'Should show current difficulty');
    assert.ok(result.stdout.includes('1.25x'), 'Should show new difficulty');

    const config = readConfig(tmpHome);
    assert.strictEqual(config.difficulty.multiplier, 1.25, 'Config should have 1.25x multiplier');
  });

  test('vibripped harder repeated from 1.0x to 1.25x to 1.5x', () => {
    // First harder: 1.0 -> 1.25
    const first = execVibripped(['harder'], tmpHome);
    assert.strictEqual(first.exitCode, 0);
    let config = readConfig(tmpHome);
    assert.strictEqual(config.difficulty.multiplier, 1.25);

    // Second harder: 1.25 -> 1.5
    const second = execVibripped(['harder'], tmpHome);
    assert.strictEqual(second.exitCode, 0);
    assert.ok(second.stdout.includes('1.25x'));
    assert.ok(second.stdout.includes('1.5x'));
    config = readConfig(tmpHome);
    assert.strictEqual(config.difficulty.multiplier, 1.5);
  });

  test('vibripped harder at max (2.5x) outputs "Already at maximum" message', () => {
    // Manually set config to max
    const configDir = path.join(tmpHome, '.config', 'viberipped');
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
    const configPath = path.join(configDir, 'configuration.json');
    const maxConfig = {
      equipment: { kettlebell: false, dumbbells: false, pullUpBar: false, parallettes: false },
      difficulty: { multiplier: 2.5 }
    };
    fs.writeFileSync(configPath, JSON.stringify(maxConfig, null, 2));

    const result = execVibripped(['harder'], tmpHome);
    assert.strictEqual(result.exitCode, 0, 'Should exit 0 even at max');
    assert.ok(result.stdout.includes('Already at maximum'), 'Should output max message');
    assert.ok(result.stdout.includes('2.5x'), 'Should show current max difficulty');

    const config = readConfig(tmpHome);
    assert.strictEqual(config.difficulty.multiplier, 2.5, 'Should remain at 2.5x');
  });
});

describe('CLI - softer command', () => {
  let tmpHome;

  beforeEach(() => {
    tmpHome = createTempHomeDir();
  });

  afterEach(() => {
    cleanupTempHomeDir(tmpHome);
  });

  test('vibripped softer from default (1.0x) changes config to 0.75x', () => {
    const result = execVibripped(['softer'], tmpHome);

    assert.strictEqual(result.exitCode, 0, 'Command should exit with 0');
    assert.ok(result.stdout.includes('Difficulty decreased'), 'Should output success message');
    assert.ok(result.stdout.includes('1.0x'), 'Should show current difficulty');
    assert.ok(result.stdout.includes('0.75x'), 'Should show new difficulty');

    const config = readConfig(tmpHome);
    assert.strictEqual(config.difficulty.multiplier, 0.75, 'Config should have 0.75x multiplier');
  });

  test('vibripped softer at min (0.5x) outputs "Already at minimum" message', () => {
    // Manually set config to min
    const configDir = path.join(tmpHome, '.config', 'viberipped');
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
    const configPath = path.join(configDir, 'configuration.json');
    const minConfig = {
      equipment: { kettlebell: false, dumbbells: false, pullUpBar: false, parallettes: false },
      difficulty: { multiplier: 0.5 }
    };
    fs.writeFileSync(configPath, JSON.stringify(minConfig, null, 2));

    const result = execVibripped(['softer'], tmpHome);
    assert.strictEqual(result.exitCode, 0, 'Should exit 0 even at min');
    assert.ok(result.stdout.includes('Already at minimum'), 'Should output min message');
    assert.ok(result.stdout.includes('0.5x'), 'Should show current min difficulty');

    const config = readConfig(tmpHome);
    assert.strictEqual(config.difficulty.multiplier, 0.5, 'Should remain at 0.5x');
  });

  test('vibripped harder then softer returns to original', () => {
    // Start with default (1.0x)
    // Run harder: 1.0 -> 1.25
    const harder = execVibripped(['harder'], tmpHome);
    assert.strictEqual(harder.exitCode, 0);
    let config = readConfig(tmpHome);
    assert.strictEqual(config.difficulty.multiplier, 1.25);

    // Run softer: 1.25 -> 1.0
    const softer = execVibripped(['softer'], tmpHome);
    assert.strictEqual(softer.exitCode, 0);
    assert.ok(softer.stdout.includes('1.25x'));
    assert.ok(softer.stdout.includes('1.0x'));
    config = readConfig(tmpHome);
    assert.strictEqual(config.difficulty.multiplier, 1.0, 'Should return to default 1.0x');
  });
});
