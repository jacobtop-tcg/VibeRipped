#!/usr/bin/env node
/**
 * statusline.js - VibeRipped Claude Code Statusline Provider
 *
 * Entry point script invoked by Claude Code as a statusline provider.
 * Reads JSON from stdin, detects processing, triggers engine, outputs ANSI-formatted exercise.
 *
 * Flow:
 * 1. Buffer stdin JSON chunks
 * 2. Parse via parseStdin (safe, null-on-error)
 * 3. Check isProcessing (token-based heuristic)
 * 4. Trigger engine (config-driven mode)
 * 5. Handle cooldown (silent exit)
 * 6. Format and output exercise (process.stdout.write)
 * 7. Exit 0 on all paths
 *
 * Silent operation: No output when not processing, on cooldown, or on error.
 * All diagnostic output goes to stderr only.
 */

const { parseStdin } = require('./lib/statusline/stdin');
const { isProcessing } = require('./lib/statusline/detection');
const { formatExercise } = require('./lib/statusline/format');
const { trigger } = require('./engine');

// Main execution wrapped in top-level try/catch
(function main() {
  try {
    // Buffer all stdin chunks into a string
    let stdinBuffer = '';

    // Set encoding before attaching listeners
    process.stdin.setEncoding('utf8');

    // Collect data chunks
    process.stdin.on('data', (chunk) => {
      stdinBuffer += chunk;
    });

    // Process when stdin ends
    process.stdin.on('end', () => {
      try {
        // Parse stdin JSON
        const data = parseStdin(stdinBuffer);
        if (!data) {
          // Parse failed or empty - exit silently
          process.exit(0);
        }

        // Check if Claude Code is processing
        if (!isProcessing(data)) {
          // Not processing - exit silently (no output)
          process.exit(0);
        }

        // Extract latency from stdin JSON for difficulty scaling
        const latencyMs = data?.cost?.total_api_duration_ms || 0;

        // Trigger the engine (config-driven mode)
        // Check for bypass cooldown env var (useful for testing)
        const bypassCooldown = process.env.VIBERIPPED_BYPASS_COOLDOWN === '1';
        const result = trigger(null, { bypassCooldown, latencyMs });

        // Handle cooldown - keep showing last exercise so it stays visible
        if (result.type === 'cooldown') {
          if (result.lastExercise) {
            const ex = result.lastExercise;
            const value = ex.type === 'timed'
              ? (ex.duration ?? ex.reps)
              : ex.reps;
            const formatted = formatExercise(ex.name, value, ex.type || 'reps', { prefix: '💪 ' });
            process.stdout.write(formatted);
          }
          process.exit(0);
        }

        // Handle exercise - format and output to stdout
        if (result.type === 'exercise') {
          const exercise = result.exercise;
          const value = exercise.type === 'timed'
            ? (exercise.duration ?? exercise.reps)
            : exercise.reps;
          const formatted = formatExercise(exercise.name, value, exercise.type || 'reps', { prefix: '💪 ' });
          process.stdout.write(formatted);
          process.exit(0);
        }

        // Unknown result type - exit silently
        process.exit(0);
      } catch (error) {
        // Error during processing - log to stderr, exit silently
        console.error(`VibeRipped error: ${error.message}`);
        process.exit(0);
      }
    });

    // Error handler for stdin errors
    process.stdin.on('error', (error) => {
      console.error(`VibeRipped stdin error: ${error.message}`);
      process.exit(0);
    });
  } catch (error) {
    // Top-level error - log to stderr, exit silently
    console.error(`VibeRipped fatal error: ${error.message}`);
    process.exit(0);
  }
})();
