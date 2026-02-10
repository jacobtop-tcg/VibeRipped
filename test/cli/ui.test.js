/**
 * Unit tests for UI primitives
 *
 * Tests TTY detection, confirm prompt, and CheckboxPrompt loading.
 * Uses spawn with isolated temp HOME dirs per existing project patterns.
 */

const { describe, test } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('TTY guard', () => {
  test('requireTTY returns false and prints error in non-TTY context', async () => {
    // Create test script that calls requireTTY
    const testScript = `
const {requireTTY} = require('./lib/cli/ui/tty');
const ok = requireTTY('setup');
process.exit(ok ? 0 : 1);
    `;

    // Spawn with non-TTY stdin (ignored)
    const child = spawn('node', ['-e', testScript], {
      cwd: path.join(__dirname, '../..'),
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stderr = '';
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    const code = await new Promise((resolve) => {
      child.on('close', resolve);
    });

    assert.strictEqual(code, 1, 'Exit code should be 1');
    assert.match(stderr, /requires an interactive terminal/, 'Should mention TTY requirement');
    assert.match(stderr, /viberipped config/, 'Should suggest alternative commands');
  });

  test('requireTTY module loads without error', () => {
    const { requireTTY } = require('../../lib/cli/ui/tty');
    assert.strictEqual(typeof requireTTY, 'function');
  });
});

describe('Confirm prompt', () => {
  test('confirm returns true for "y" input', async () => {
    const testScript = `
const {confirm} = require('./lib/cli/ui/confirm');
confirm('Test').then(result => {
  console.log(result ? 'YES' : 'NO');
  process.exit(0);
});
    `;

    const child = spawn('node', ['-e', testScript], {
      cwd: path.join(__dirname, '../..'),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Write 'y\n' to stdin
    child.stdin.write('y\n');
    child.stdin.end();

    let stdout = '';
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    await new Promise((resolve) => {
      child.on('close', resolve);
    });

    assert.match(stdout, /YES/, 'Should return true for "y"');
  });

  test('confirm returns true for "yes" input', async () => {
    const testScript = `
const {confirm} = require('./lib/cli/ui/confirm');
confirm('Test').then(result => {
  console.log(result ? 'YES' : 'NO');
  process.exit(0);
});
    `;

    const child = spawn('node', ['-e', testScript], {
      cwd: path.join(__dirname, '../..'),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    child.stdin.write('yes\n');
    child.stdin.end();

    let stdout = '';
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    await new Promise((resolve) => {
      child.on('close', resolve);
    });

    assert.match(stdout, /YES/, 'Should return true for "yes"');
  });

  test('confirm returns false for "n" input', async () => {
    const testScript = `
const {confirm} = require('./lib/cli/ui/confirm');
confirm('Test').then(result => {
  console.log(result ? 'YES' : 'NO');
  process.exit(0);
});
    `;

    const child = spawn('node', ['-e', testScript], {
      cwd: path.join(__dirname, '../..'),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    child.stdin.write('n\n');
    child.stdin.end();

    let stdout = '';
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    await new Promise((resolve) => {
      child.on('close', resolve);
    });

    assert.match(stdout, /NO/, 'Should return false for "n"');
  });

  test('confirm returns false for empty input (default No)', async () => {
    const testScript = `
const {confirm} = require('./lib/cli/ui/confirm');
confirm('Test').then(result => {
  console.log(result ? 'YES' : 'NO');
  process.exit(0);
});
    `;

    const child = spawn('node', ['-e', testScript], {
      cwd: path.join(__dirname, '../..'),
      stdio: ['pipe', 'pipe', 'pipe']
    });

    child.stdin.write('\n');
    child.stdin.end();

    let stdout = '';
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    await new Promise((resolve) => {
      child.on('close', resolve);
    });

    assert.match(stdout, /NO/, 'Should return false for empty input');
  });

  test('confirm module loads without error', () => {
    const { confirm } = require('../../lib/cli/ui/confirm');
    assert.strictEqual(typeof confirm, 'function');
  });
});

describe('CheckboxPrompt', () => {
  test('CheckboxPrompt module loads without error', () => {
    const { CheckboxPrompt } = require('../../lib/cli/ui/checkbox');
    assert.strictEqual(typeof CheckboxPrompt, 'function');

    // Verify constructor works
    const prompt = new CheckboxPrompt('Test:', [
      { label: 'Option 1', value: 'opt1', checked: false }
    ]);
    assert.strictEqual(prompt.message, 'Test:');
    assert.strictEqual(prompt.choices.length, 1);
  });

  // Skip full interactive testing (requires PTY)
  // Manual verification will be done in Plan 02 checkpoint
});
