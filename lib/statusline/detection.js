/**
 * detection.js - Process detection heuristic
 *
 * Determines if Claude Code is currently processing based on token usage.
 * Returns true only when current_usage exists and has positive token counts.
 *
 * Heuristic: MEDIUM confidence
 * - null current_usage = pre-first-API-call state (not processing)
 * - zero tokens = session started but no processing yet (not processing)
 * - positive tokens = active/recent processing (processing)
 */

function isProcessing(claudeData) {
  if (!claudeData) return false;

  const currentUsage = claudeData.context_window?.current_usage;

  // Explicit null and undefined checks (not just falsy)
  if (currentUsage === null || currentUsage === undefined) return false;

  // Zero tokens means session started but no processing yet
  return (currentUsage.input_tokens > 0 || currentUsage.cache_read_input_tokens > 0);
}

module.exports = { isProcessing };
