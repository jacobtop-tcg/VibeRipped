const { describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { isProcessing } = require('../lib/statusline/detection');

// Helper to create isolated temp directory
function createTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'viberipped-detection-test-'));
}

// Helper to cleanup temp directory
function cleanupTmpDir(tmpDir) {
  if (tmpDir) {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

describe('isProcessing - Delta Detection (new behavior)', () => {
  test('returns true when cost.total_api_duration_ms increases by >= threshold (default 100ms)', () => {
    const tmpDir = createTmpDir();
    const statePath = path.join(tmpDir, 'detection-state.json');

    try {
      // First call - establishes baseline (should return false - no previous state)
      const data1 = {
        cost: { total_api_duration_ms: 0 },
        session_id: 'session-1'
      };
      const result1 = isProcessing(data1, { statePath });
      assert.strictEqual(result1, false);

      // Second call - API duration increased by 150ms (above 100ms threshold)
      const data2 = {
        cost: { total_api_duration_ms: 150 },
        session_id: 'session-1'
      };
      const result2 = isProcessing(data2, { statePath });
      assert.strictEqual(result2, true);
    } finally {
      cleanupTmpDir(tmpDir);
    }
  });

  test('returns false when cost.total_api_duration_ms unchanged between calls', () => {
    const tmpDir = createTmpDir();
    const statePath = path.join(tmpDir, 'detection-state.json');

    try {
      // First call - establishes baseline
      const data1 = {
        cost: { total_api_duration_ms: 500 },
        session_id: 'session-1'
      };
      isProcessing(data1, { statePath });

      // Second call - duration unchanged
      const data2 = {
        cost: { total_api_duration_ms: 500 },
        session_id: 'session-1'
      };
      const result = isProcessing(data2, { statePath });
      assert.strictEqual(result, false);
    } finally {
      cleanupTmpDir(tmpDir);
    }
  });

  test('returns false when cost.total_api_duration_ms increase < threshold', () => {
    const tmpDir = createTmpDir();
    const statePath = path.join(tmpDir, 'detection-state.json');

    try {
      // First call - baseline
      const data1 = {
        cost: { total_api_duration_ms: 100 },
        session_id: 'session-1'
      };
      isProcessing(data1, { statePath });

      // Second call - increased by only 50ms (below 100ms threshold)
      const data2 = {
        cost: { total_api_duration_ms: 150 },
        session_id: 'session-1'
      };
      const result = isProcessing(data2, { statePath });
      assert.strictEqual(result, false);
    } finally {
      cleanupTmpDir(tmpDir);
    }
  });

  test('returns false on first invocation of new session (state reset)', () => {
    const tmpDir = createTmpDir();
    const statePath = path.join(tmpDir, 'detection-state.json');

    try {
      // Very first call ever
      const data = {
        cost: { total_api_duration_ms: 200 },
        session_id: 'session-1'
      };
      const result = isProcessing(data, { statePath });
      assert.strictEqual(result, false);
    } finally {
      cleanupTmpDir(tmpDir);
    }
  });
});

describe('isProcessing - Session Tracking', () => {
  test('resets delta tracking when session_id changes (new Claude Code session)', () => {
    const tmpDir = createTmpDir();
    const statePath = path.join(tmpDir, 'detection-state.json');

    try {
      // First session - establish state
      const data1 = {
        cost: { total_api_duration_ms: 500 },
        session_id: 'session-1'
      };
      isProcessing(data1, { statePath });

      // Session changes - duration is higher but this is first call of new session
      const data2 = {
        cost: { total_api_duration_ms: 700 },
        session_id: 'session-2'
      };
      const result = isProcessing(data2, { statePath });
      assert.strictEqual(result, false); // First call after session change returns false
    } finally {
      cleanupTmpDir(tmpDir);
    }
  });

  test('returns false on first call after session change (no false positive on restart)', () => {
    const tmpDir = createTmpDir();
    const statePath = path.join(tmpDir, 'detection-state.json');

    try {
      // Establish session 1
      isProcessing({ cost: { total_api_duration_ms: 300 }, session_id: 'sess-1' }, { statePath });

      // New session starts at lower duration (session reset)
      const data = {
        cost: { total_api_duration_ms: 50 },
        session_id: 'sess-2'
      };
      const result = isProcessing(data, { statePath });
      assert.strictEqual(result, false);
    } finally {
      cleanupTmpDir(tmpDir);
    }
  });

  test('handles missing session_id gracefully (treat as same session)', () => {
    const tmpDir = createTmpDir();
    const statePath = path.join(tmpDir, 'detection-state.json');

    try {
      // First call without session_id
      const data1 = {
        cost: { total_api_duration_ms: 100 }
      };
      isProcessing(data1, { statePath });

      // Second call - duration increased, no session_id
      const data2 = {
        cost: { total_api_duration_ms: 250 }
      };
      const result = isProcessing(data2, { statePath });
      assert.strictEqual(result, true); // Should detect increase
    } finally {
      cleanupTmpDir(tmpDir);
    }
  });
});

describe('isProcessing - Configurable Sensitivity', () => {
  test('strict sensitivity uses 50ms threshold', () => {
    const tmpDir = createTmpDir();
    const statePath = path.join(tmpDir, 'detection-state.json');
    const config = { detection: { sensitivity: 'strict' } };

    try {
      // Baseline
      isProcessing({ cost: { total_api_duration_ms: 0 }, session_id: 's1' }, { statePath, config });

      // Increase by 60ms (above strict 50ms threshold)
      const result = isProcessing({ cost: { total_api_duration_ms: 60 }, session_id: 's1' }, { statePath, config });
      assert.strictEqual(result, true);
    } finally {
      cleanupTmpDir(tmpDir);
    }
  });

  test('normal sensitivity uses 100ms threshold (default)', () => {
    const tmpDir = createTmpDir();
    const statePath = path.join(tmpDir, 'detection-state.json');
    const config = { detection: { sensitivity: 'normal' } };

    try {
      // Baseline
      isProcessing({ cost: { total_api_duration_ms: 0 }, session_id: 's1' }, { statePath, config });

      // Increase by 90ms (below normal 100ms threshold)
      let result = isProcessing({ cost: { total_api_duration_ms: 90 }, session_id: 's1' }, { statePath, config });
      assert.strictEqual(result, false);

      // Increase to 200ms total (110ms delta - above threshold)
      result = isProcessing({ cost: { total_api_duration_ms: 200 }, session_id: 's1' }, { statePath, config });
      assert.strictEqual(result, true);
    } finally {
      cleanupTmpDir(tmpDir);
    }
  });

  test('relaxed sensitivity uses 500ms threshold', () => {
    const tmpDir = createTmpDir();
    const statePath = path.join(tmpDir, 'detection-state.json');
    const config = { detection: { sensitivity: 'relaxed' } };

    try {
      // Baseline
      isProcessing({ cost: { total_api_duration_ms: 0 }, session_id: 's1' }, { statePath, config });

      // Increase by 400ms (below relaxed 500ms threshold)
      let result = isProcessing({ cost: { total_api_duration_ms: 400 }, session_id: 's1' }, { statePath, config });
      assert.strictEqual(result, false);

      // Increase to 900ms total (500ms delta - meets threshold)
      result = isProcessing({ cost: { total_api_duration_ms: 900 }, session_id: 's1' }, { statePath, config });
      assert.strictEqual(result, true);
    } finally {
      cleanupTmpDir(tmpDir);
    }
  });

  test('custom durationThreshold overrides sensitivity preset', () => {
    const tmpDir = createTmpDir();
    const statePath = path.join(tmpDir, 'detection-state.json');
    const config = {
      detection: {
        sensitivity: 'strict', // Would normally be 50ms
        durationThreshold: 200 // Custom threshold overrides
      }
    };

    try {
      // Baseline
      isProcessing({ cost: { total_api_duration_ms: 0 }, session_id: 's1' }, { statePath, config });

      // Increase by 150ms (above strict 50ms, below custom 200ms)
      let result = isProcessing({ cost: { total_api_duration_ms: 150 }, session_id: 's1' }, { statePath, config });
      assert.strictEqual(result, false);

      // Increase to 350ms total (200ms delta - meets custom threshold)
      result = isProcessing({ cost: { total_api_duration_ms: 350 }, session_id: 's1' }, { statePath, config });
      assert.strictEqual(result, true);
    } finally {
      cleanupTmpDir(tmpDir);
    }
  });

  test('missing config defaults to normal sensitivity (100ms)', () => {
    const tmpDir = createTmpDir();
    const statePath = path.join(tmpDir, 'detection-state.json');

    try {
      // No config provided
      isProcessing({ cost: { total_api_duration_ms: 0 }, session_id: 's1' }, { statePath });

      // Increase by 99ms (below default 100ms)
      let result = isProcessing({ cost: { total_api_duration_ms: 99 }, session_id: 's1' }, { statePath });
      assert.strictEqual(result, false);

      // Increase to 199ms total (100ms delta - meets default threshold)
      result = isProcessing({ cost: { total_api_duration_ms: 199 }, session_id: 's1' }, { statePath });
      assert.strictEqual(result, true);
    } finally {
      cleanupTmpDir(tmpDir);
    }
  });
});

describe('isProcessing - Fallback to v1.0', () => {
  test('falls back to token-based heuristic when cost field is missing', () => {
    const tmpDir = createTmpDir();
    const statePath = path.join(tmpDir, 'detection-state.json');

    try {
      // No cost field - should use v1.0 token heuristic
      const data = {
        context_window: {
          current_usage: {
            input_tokens: 500,
            cache_read_input_tokens: 0
          }
        }
      };
      const result = isProcessing(data, { statePath });
      assert.strictEqual(result, true); // v1.0 behavior: tokens > 0
    } finally {
      cleanupTmpDir(tmpDir);
    }
  });

  test('falls back when total_api_duration_ms is undefined', () => {
    const tmpDir = createTmpDir();
    const statePath = path.join(tmpDir, 'detection-state.json');

    try {
      // cost exists but total_api_duration_ms is undefined
      const data = {
        cost: { something_else: 123 },
        context_window: {
          current_usage: {
            input_tokens: 200,
            cache_read_input_tokens: 0
          }
        }
      };
      const result = isProcessing(data, { statePath });
      assert.strictEqual(result, true); // v1.0 fallback
    } finally {
      cleanupTmpDir(tmpDir);
    }
  });

  test('fallback returns true when input_tokens > 0 (v1.0 behavior)', () => {
    const tmpDir = createTmpDir();
    const statePath = path.join(tmpDir, 'detection-state.json');

    try {
      const data = {
        context_window: {
          current_usage: {
            input_tokens: 100,
            cache_read_input_tokens: 0
          }
        }
      };
      const result = isProcessing(data, { statePath });
      assert.strictEqual(result, true);
    } finally {
      cleanupTmpDir(tmpDir);
    }
  });

  test('fallback returns false when current_usage is null', () => {
    const tmpDir = createTmpDir();
    const statePath = path.join(tmpDir, 'detection-state.json');

    try {
      const data = {
        context_window: {
          current_usage: null
        }
      };
      const result = isProcessing(data, { statePath });
      assert.strictEqual(result, false);
    } finally {
      cleanupTmpDir(tmpDir);
    }
  });
});

describe('isProcessing - State Persistence', () => {
  test('detection state file written after each call', () => {
    const tmpDir = createTmpDir();
    const statePath = path.join(tmpDir, 'detection-state.json');

    try {
      const data = {
        cost: { total_api_duration_ms: 100 },
        session_id: 'test-session'
      };

      isProcessing(data, { statePath });

      // State file should exist
      assert.ok(fs.existsSync(statePath));

      // State file should contain sessionId and lastApiDuration
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      assert.strictEqual(state.sessionId, 'test-session');
      assert.strictEqual(state.lastApiDuration, 100);
    } finally {
      cleanupTmpDir(tmpDir);
    }
  });

  test('state loads correctly on next invocation', () => {
    const tmpDir = createTmpDir();
    const statePath = path.join(tmpDir, 'detection-state.json');

    try {
      // First call creates state
      isProcessing({ cost: { total_api_duration_ms: 200 }, session_id: 's1' }, { statePath });

      // Second call should read previous state
      const result = isProcessing({ cost: { total_api_duration_ms: 350 }, session_id: 's1' }, { statePath });
      assert.strictEqual(result, true); // 150ms increase detected
    } finally {
      cleanupTmpDir(tmpDir);
    }
  });

  test('corrupt state file resets to defaults (no crash)', () => {
    const tmpDir = createTmpDir();
    const statePath = path.join(tmpDir, 'detection-state.json');

    try {
      // Write corrupt JSON
      fs.writeFileSync(statePath, '{invalid json content');

      // Should not crash, should use default state
      const data = {
        cost: { total_api_duration_ms: 100 },
        session_id: 's1'
      };
      const result = isProcessing(data, { statePath });
      assert.strictEqual(result, false); // First call with fresh state
    } finally {
      cleanupTmpDir(tmpDir);
    }
  });

  test('missing state file creates fresh state', () => {
    const tmpDir = createTmpDir();
    const statePath = path.join(tmpDir, 'detection-state.json');

    try {
      // No state file exists yet
      const data = {
        cost: { total_api_duration_ms: 100 },
        session_id: 's1'
      };
      const result = isProcessing(data, { statePath });

      assert.strictEqual(result, false); // First call
      assert.ok(fs.existsSync(statePath)); // File created
    } finally {
      cleanupTmpDir(tmpDir);
    }
  });
});

describe('isProcessing - Edge Cases', () => {
  test('null claudeData returns false', () => {
    const tmpDir = createTmpDir();
    const statePath = path.join(tmpDir, 'detection-state.json');

    try {
      const result = isProcessing(null, { statePath });
      assert.strictEqual(result, false);
    } finally {
      cleanupTmpDir(tmpDir);
    }
  });

  test('undefined claudeData returns false', () => {
    const tmpDir = createTmpDir();
    const statePath = path.join(tmpDir, 'detection-state.json');

    try {
      const result = isProcessing(undefined, { statePath });
      assert.strictEqual(result, false);
    } finally {
      cleanupTmpDir(tmpDir);
    }
  });

  test('empty object returns false (falls back to v1.0 which returns false for missing current_usage)', () => {
    const tmpDir = createTmpDir();
    const statePath = path.join(tmpDir, 'detection-state.json');

    try {
      const result = isProcessing({}, { statePath });
      assert.strictEqual(result, false);
    } finally {
      cleanupTmpDir(tmpDir);
    }
  });
});
