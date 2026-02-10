/**
 * Integration tests for config command
 *
 * Tests the viberipped config CLI command end-to-end using child_process.
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
 * @returns {Promise<{code: number, stdout: string, stderr: string}>}
 */
function runCLI(args) {
  return new Promise((resolve, reject) => {
    // Create isolated temp directory for this test
    const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempHome, { recursive: true });

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

describe('config command', () => {
  test('shows default config when no flags', async () => {
    const { code, stdout } = await runCLI(['config']);

    assert.strictEqual(code, 0);
    assert.match(stdout, /disabled[\s\S]*disabled[\s\S]*disabled[\s\S]*disabled/);
  });

  test('sets equipment flags', async () => {
    const { code, stdout } = await runCLI(['config', '--kettlebell', '--dumbbells']);

    assert.strictEqual(code, 0);
    assert.match(stdout, /Configuration updated/);
    assert.match(stdout, /kettlebell/);
  });

  test('persists config across calls', async () => {
    // Need to use same temp directory for both calls
    const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempHome, { recursive: true });

    const env = {
      ...process.env,
      HOME: tempHome,
      XDG_CONFIG_HOME: path.join(tempHome, '.config')
    };

    const binPath = path.join(__dirname, '../../bin/viberipped.js');

    // First call: set kettlebell
    await new Promise((resolve) => {
      const child = spawn('node', [binPath, 'config', '--kettlebell'], { env });
      child.on('close', resolve);
    });

    // Second call: read config
    const child = spawn('node', [binPath, 'config'], { env });

    let stdout = '';
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    await new Promise((resolve) => {
      child.on('close', (code) => {
        assert.strictEqual(code, 0);
        assert.match(stdout, /Kettlebell:\s+enabled/);

        // Cleanup
        fs.rmSync(tempHome, { recursive: true, force: true });
        resolve();
      });
    });
  });

  test('negates equipment with --no-flag', async () => {
    const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempHome, { recursive: true });

    const env = {
      ...process.env,
      HOME: tempHome,
      XDG_CONFIG_HOME: path.join(tempHome, '.config')
    };

    const binPath = path.join(__dirname, '../../bin/viberipped.js');

    // Set kettlebell
    await new Promise((resolve) => {
      const child = spawn('node', [binPath, 'config', '--kettlebell'], { env });
      child.on('close', resolve);
    });

    // Negate kettlebell
    await new Promise((resolve) => {
      const child = spawn('node', [binPath, 'config', '--no-kettlebell'], { env });
      child.on('close', resolve);
    });

    // Check result
    const child = spawn('node', [binPath, 'config'], { env });

    let stdout = '';
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    await new Promise((resolve) => {
      child.on('close', (code) => {
        assert.strictEqual(code, 0);
        assert.match(stdout, /disabled[\s\S]*disabled[\s\S]*disabled[\s\S]*disabled/);

        // Cleanup
        fs.rmSync(tempHome, { recursive: true, force: true });
        resolve();
      });
    });
  });

  test('shows help for config subcommand', async () => {
    const { code, stdout } = await runCLI(['config', '--help']);

    assert.strictEqual(code, 0);
    assert.match(stdout, /Show or manage configuration/);
    assert.match(stdout, /kettlebell/i);
  });

  test('config set environment office sets environment in configuration', async () => {
    const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempHome, { recursive: true });

    const env = {
      ...process.env,
      HOME: tempHome,
      XDG_CONFIG_HOME: path.join(tempHome, '.config')
    };

    const binPath = path.join(__dirname, '../../bin/viberipped.js');

    // Set environment
    const child = spawn('node', [binPath, 'config', 'set', 'environment', 'office'], { env });

    let stdout = '';
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    await new Promise((resolve) => {
      child.on('close', (code) => {
        assert.strictEqual(code, 0);
        assert.match(stdout, /Environment set to: office/);

        // Verify configuration file contains environment
        const configPath = path.join(tempHome, '.config', 'viberipped', 'configuration.json');
        const configContent = fs.readFileSync(configPath, 'utf8');
        const config = JSON.parse(configContent);
        assert.strictEqual(config.environment, 'office');

        // Cleanup
        fs.rmSync(tempHome, { recursive: true, force: true });
        resolve();
      });
    });
  });

  test('config get environment reads current environment', async () => {
    const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempHome, { recursive: true });

    const env = {
      ...process.env,
      HOME: tempHome,
      XDG_CONFIG_HOME: path.join(tempHome, '.config')
    };

    const binPath = path.join(__dirname, '../../bin/viberipped.js');

    // Set environment first
    await new Promise((resolve) => {
      const child = spawn('node', [binPath, 'config', 'set', 'environment', 'home'], { env });
      child.on('close', resolve);
    });

    // Get environment
    const child = spawn('node', [binPath, 'config', 'get', 'environment'], { env });

    let stdout = '';
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    await new Promise((resolve) => {
      child.on('close', (code) => {
        assert.strictEqual(code, 0);
        assert.match(stdout, /home/);

        // Cleanup
        fs.rmSync(tempHome, { recursive: true, force: true });
        resolve();
      });
    });
  });

  test('config set environment office then get returns office', async () => {
    const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempHome, { recursive: true });

    const env = {
      ...process.env,
      HOME: tempHome,
      XDG_CONFIG_HOME: path.join(tempHome, '.config')
    };

    const binPath = path.join(__dirname, '../../bin/viberipped.js');

    // Set environment
    await new Promise((resolve) => {
      const child = spawn('node', [binPath, 'config', 'set', 'environment', 'office'], { env });
      child.on('close', resolve);
    });

    // Get environment
    const child = spawn('node', [binPath, 'config', 'get', 'environment'], { env });

    let stdout = '';
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    await new Promise((resolve) => {
      child.on('close', (code) => {
        assert.strictEqual(code, 0);
        const trimmed = stdout.trim();
        assert.strictEqual(trimmed, 'office');

        // Cleanup
        fs.rmSync(tempHome, { recursive: true, force: true });
        resolve();
      });
    });
  });

  test('config set unknown-key fails', async () => {
    const { code, stderr } = await runCLI(['config', 'set', 'unknown-key', 'value']);

    assert.strictEqual(code, 1);
    assert.match(stderr, /Unknown config key/);
  });

  test('config get unknown-key fails', async () => {
    const { code, stderr } = await runCLI(['config', 'get', 'unknown-key']);

    assert.strictEqual(code, 1);
    assert.match(stderr, /Unknown config key/);
  });

  test('config show displays environment', async () => {
    const tempHome = path.join(os.tmpdir(), `viberipped-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    fs.mkdirSync(tempHome, { recursive: true });

    const env = {
      ...process.env,
      HOME: tempHome,
      XDG_CONFIG_HOME: path.join(tempHome, '.config')
    };

    const binPath = path.join(__dirname, '../../bin/viberipped.js');

    // Set environment
    await new Promise((resolve) => {
      const child = spawn('node', [binPath, 'config', 'set', 'environment', 'gym'], { env });
      child.on('close', resolve);
    });

    // Show config
    const child = spawn('node', [binPath, 'config'], { env });

    let stdout = '';
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    await new Promise((resolve) => {
      child.on('close', (code) => {
        assert.strictEqual(code, 0);
        assert.match(stdout, /Environment:\s+gym/);

        // Cleanup
        fs.rmSync(tempHome, { recursive: true, force: true });
        resolve();
      });
    });
  });

  test('config --kettlebell still works', async () => {
    const { code, stdout } = await runCLI(['config', '--kettlebell']);

    assert.strictEqual(code, 0);
    assert.match(stdout, /Configuration updated/);
    assert.match(stdout, /kettlebell/);
  });
});
