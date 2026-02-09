const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('statusline-orchestrator.sh', () => {
  let tmpDir;

  // Create isolated state directory before each test
  function createTmpStateDir() {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'viberipped-orch-test-'));
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

  test('orchestrator outputs both GSD and VibeRipped with separator when processing', () => {
    const tmpHome = createTmpStateDir();

    // Create mock GSD statusline that outputs a simple string
    const mockGsdPath = path.join(tmpHome, 'gsd-statusline.js');
    fs.writeFileSync(mockGsdPath, `
      const data = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
      if (data.context_window?.current_usage?.input_tokens > 0) {
        process.stdout.write('GSD Output');
      }
    `);

    const input = JSON.stringify({
      context_window: {
        current_usage: {
          input_tokens: 100
        }
      }
    });

    try {
      const result = execSync(
        `echo '${input}' | bash ${path.join(__dirname, '..', 'statusline-orchestrator.sh')}`,
        {
          encoding: 'utf8',
          env: {
            ...process.env,
            HOME: tmpHome,
            GSD_STATUSLINE: mockGsdPath,
            VIBERIPPED_BYPASS_COOLDOWN: '1'
          }
        }
      );

      // Should contain both outputs with separator
      assert.match(result, /GSD Output/);
      assert.match(result, /│/); // Unicode separator
      assert.match(result, /💪/); // VibeRipped prefix
    } finally {
      cleanupTmpStateDir();
    }
  });

  test('orchestrator outputs only GSD when VibeRipped is silent (non-processing)', () => {
    const tmpHome = createTmpStateDir();

    // Create mock GSD statusline that always outputs
    const mockGsdPath = path.join(tmpHome, 'gsd-statusline.js');
    fs.writeFileSync(mockGsdPath, `
      process.stdout.write('GSD Always On');
    `);

    // Non-processing JSON (current_usage: null)
    const input = JSON.stringify({
      context_window: {
        current_usage: null
      }
    });

    try {
      const result = execSync(
        `echo '${input}' | bash ${path.join(__dirname, '..', 'statusline-orchestrator.sh')}`,
        {
          encoding: 'utf8',
          env: {
            ...process.env,
            HOME: tmpHome,
            GSD_STATUSLINE: mockGsdPath,
            VIBERIPPED_BYPASS_COOLDOWN: '1'
          }
        }
      );

      // Should contain GSD output but no separator
      assert.match(result, /GSD Always On/);
      assert.doesNotMatch(result, /│/);
      assert.doesNotMatch(result, /💪/);
    } finally {
      cleanupTmpStateDir();
    }
  });

  test('orchestrator outputs only VibeRipped when GSD_STATUSLINE points to nonexistent file', () => {
    const tmpHome = createTmpStateDir();

    const input = JSON.stringify({
      context_window: {
        current_usage: {
          input_tokens: 100
        }
      }
    });

    try {
      const result = execSync(
        `echo '${input}' | bash ${path.join(__dirname, '..', 'statusline-orchestrator.sh')}`,
        {
          encoding: 'utf8',
          env: {
            ...process.env,
            HOME: tmpHome,
            GSD_STATUSLINE: '/nonexistent/path',
            VIBERIPPED_BYPASS_COOLDOWN: '1'
          }
        }
      );

      // Should contain VibeRipped output but no separator
      assert.match(result, /💪/);
      assert.doesNotMatch(result, /│/);
    } finally {
      cleanupTmpStateDir();
    }
  });

  test('orchestrator exits 0 and produces no output when both providers silent', () => {
    const tmpHome = createTmpStateDir();

    // Non-processing JSON
    const input = JSON.stringify({
      context_window: {
        current_usage: null
      }
    });

    try {
      const result = execSync(
        `echo '${input}' | bash ${path.join(__dirname, '..', 'statusline-orchestrator.sh')}; echo "EXIT:$?"`,
        {
          encoding: 'utf8',
          env: {
            ...process.env,
            HOME: tmpHome,
            GSD_STATUSLINE: '/nonexistent/path',
            VIBERIPPED_BYPASS_COOLDOWN: '1'
          },
          shell: '/bin/bash'
        }
      );

      // Should have exit code 0 and no output from providers
      assert.match(result, /EXIT:0/);
      assert.doesNotMatch(result, /💪/);
      assert.doesNotMatch(result, /│/);
    } finally {
      cleanupTmpStateDir();
    }
  });

  test('orchestrator handles empty stdin gracefully', () => {
    const tmpHome = createTmpStateDir();

    try {
      const result = execSync(
        `echo '' | bash ${path.join(__dirname, '..', 'statusline-orchestrator.sh')}; echo "EXIT:$?"`,
        {
          encoding: 'utf8',
          env: {
            ...process.env,
            HOME: tmpHome,
            GSD_STATUSLINE: '/nonexistent/path',
            VIBERIPPED_BYPASS_COOLDOWN: '1'
          },
          shell: '/bin/bash'
        }
      );

      // Should exit 0 with no provider output
      assert.match(result, /EXIT:0/);
    } finally {
      cleanupTmpStateDir();
    }
  });
});
