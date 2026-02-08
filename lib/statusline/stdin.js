/**
 * stdin.js - JSON stdin buffering and parsing
 *
 * Safely parses JSON strings from stdin without throwing on invalid input.
 * Returns parsed object or null on any error condition.
 */

function parseStdin(raw) {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

module.exports = { parseStdin };
