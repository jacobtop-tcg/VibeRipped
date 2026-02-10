/**
 * detection.js - Process detection heuristic
 *
 * v1.1: Delta-based API detection using total_api_duration_ms tracking
 * Falls back to v1.0 token-based heuristic when cost field unavailable
 *
 * Delta Detection:
 * - Tracks cost.total_api_duration_ms changes between invocations
 * - Returns true only when duration increases by >= threshold
 * - Handles session restarts gracefully (no false positives)
 * - Configurable sensitivity: strict (50ms), normal (100ms), relaxed (500ms)
 *
 * Fallback (v1.0):
 * - Returns true when current_usage.input_tokens > 0 (token accumulation)
 * - Used when cost field missing or detection fails
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Get threshold from config, mapping sensitivity to milliseconds.
 *
 * @param {Object} config - Configuration object
 * @returns {number} Threshold in milliseconds
 */
function getThreshold(config) {
  const SENSITIVITY_MAP = {
    strict: 50,
    normal: 100,
    relaxed: 500
  };

  const detection = config?.detection || {};

  // Custom durationThreshold overrides sensitivity preset
  if (typeof detection.durationThreshold === 'number') {
    return detection.durationThreshold;
  }

  // Map sensitivity string to ms, default to 'normal' (100ms)
  return SENSITIVITY_MAP[detection.sensitivity] || SENSITIVITY_MAP.normal;
}

/**
 * Get detection state file path.
 * Uses XDG Base Directory specification via HOME env var.
 *
 * @param {string} [statePath] - Optional override path for testing
 * @returns {string} Path to detection-state.json
 */
function getDetectionStatePath(statePath) {
  if (statePath) return statePath;
  const homeDir = process.env.HOME || os.homedir();
  return path.join(homeDir, '.config', 'viberipped', 'detection-state.json');
}

/**
 * Load detection state from file.
 * Handles missing or corrupt files gracefully.
 *
 * @param {string} statePath - Path to state file
 * @returns {Object} Detection state or empty default state
 */
function loadDetectionState(statePath) {
  try {
    const content = fs.readFileSync(statePath, 'utf8');
    return JSON.parse(content);
  } catch {
    // First run, corrupt state, or file missing - return empty state
    return {
      sessionId: null,
      lastApiDuration: 0,
      lastUpdate: Date.now()
    };
  }
}

/**
 * Save detection state to file atomically.
 * Uses write-rename pattern to prevent corruption.
 *
 * @param {string} statePath - Path to state file
 * @param {Object} state - State object to save
 */
function saveDetectionState(statePath, state) {
  const stateDir = path.dirname(statePath);

  // Ensure directory exists
  fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });

  // Atomic write (write-rename pattern from engine.js)
  const tmpPath = `${statePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(tmpPath, statePath);
}

/**
 * Detect API processing using delta-based duration tracking.
 *
 * @param {Object} claudeData - Statusline JSON from Claude Code
 * @param {Object} options - Options object
 * @param {string} [options.statePath] - Override state file path (for testing)
 * @param {Object} [options.config] - Configuration object
 * @returns {boolean} True if API call detected, false otherwise
 */
function isProcessing(claudeData, options = {}) {
  if (!claudeData) return false;

  const statePath = getDetectionStatePath(options.statePath);
  const config = options.config || {};

  // Try delta-based detection if cost field available
  if (claudeData.cost?.total_api_duration_ms !== undefined) {
    try {
      const currentApiDuration = claudeData.cost.total_api_duration_ms;
      const sessionId = claudeData.session_id;

      // Load previous state
      const state = loadDetectionState(statePath);

      // Detect session restart - reset deltas
      if (state.sessionId !== sessionId) {
        const newState = {
          sessionId: sessionId,
          lastApiDuration: currentApiDuration,
          lastUpdate: Date.now()
        };
        saveDetectionState(statePath, newState);
        return false; // First statusline update of new session, no API call yet
      }

      // Get configurable threshold
      const threshold = getThreshold(config);

      // Calculate delta
      const durationDelta = currentApiDuration - state.lastApiDuration;
      const apiCallDetected = durationDelta >= threshold;

      // Update state for next check
      const newState = {
        sessionId: sessionId,
        lastApiDuration: currentApiDuration,
        lastUpdate: Date.now()
      };
      saveDetectionState(statePath, newState);

      return apiCallDetected;
    } catch (error) {
      // Detection error - fall through to v1.0 fallback
      if (config.detection?.fallbackOnError !== false) {
        console.error('VibeRipped detection error:', error.message);
        console.error('Falling back to v1.0 token-based heuristic');
      }
    }
  }

  // Fallback: v1.0 token-based heuristic
  const currentUsage = claudeData.context_window?.current_usage;

  // Explicit null and undefined checks (not just falsy)
  if (currentUsage === null || currentUsage === undefined) return false;

  // Zero tokens means session started but no processing yet
  return (currentUsage.input_tokens > 0 || currentUsage.cache_read_input_tokens > 0);
}

module.exports = { isProcessing };
