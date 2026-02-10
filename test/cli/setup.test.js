/**
 * Integration tests for setup command
 *
 * Tests the vibripped setup CLI command end-to-end using child_process.
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
 * @param {Object} options - Spawn options (e.g., stdio configuration)
 * @returns {Promise<{code: number, stdout: string, stderr: string}>}
 */
function runCLI(args, options = {}) {
  return new Promise((resolve, reject) => {
    // Create isolated temp directory for this test
    const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempHome, { recursive: true });

    const env = {
      ...process.env,
      HOME: tempHome,
      XDG_CONFIG_HOME: path.join(tempHome, '.config')
    };

    const binPath = path.join(__dirname, '../../bin/vibripped.js');
    const child = spawn('node', [binPath, ...args], {
      env,
      ...options
    });

    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    child.on('close', (code) => {
      // Cleanup temp directory
      try {
        fs.rmSync(tempHome, { recursive: true, force: true });
      } catch (e) {
        // Ignore cleanup errors
      }

      resolve({ code, stdout, stderr });
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

describe('setup command', () => {
  test('setup command appears in help', async () => {
    const { code, stdout } = await runCLI(['--help']);

    assert.strictEqual(code, 0);
    assert.match(stdout, /setup/);
  });

  test('setup fails gracefully in non-TTY mode', async () => {
    const { code, stderr } = await runCLI(['setup'], {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    assert.strictEqual(code, 1);
    assert.match(stderr, /requires an interactive terminal/);
    assert.match(stderr, /vibripped config/);
  });

  test('setup fails gracefully when stdout is not TTY', async () => {
    const { code, stderr } = await runCLI(['setup'], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    assert.strictEqual(code, 1);
    assert.match(stderr, /requires an interactive terminal/);
  });

  test('setup module exports a function', async () => {
    const setupModule = require(path.join(__dirname, '../../lib/cli/commands/setup.js'));

    assert.strictEqual(typeof setupModule, 'function');
  });

  test('setup --help shows description', async () => {
    const { code, stdout } = await runCLI(['setup', '--help']);

    assert.strictEqual(code, 0);
    assert.match(stdout, /interactive setup wizard|first-time/i);
  });

  test('setup module loads without error', async () => {
    // This test verifies the module can be required and doesn't have syntax errors
    assert.doesNotThrow(() => {
      require(path.join(__dirname, '../../lib/cli/commands/setup.js'));
    });
  });
});
