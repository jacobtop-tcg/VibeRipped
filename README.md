# VibeRipped

[![npm version](https://img.shields.io/npm/v/viberipped.svg)](https://www.npmjs.com/package/viberipped)
[![license](https://img.shields.io/npm/l/viberipped.svg)](LICENSE)
[![Node.js](https://img.shields.io/node/v/viberipped.svg)](https://nodejs.org)

Deterministic micro-exercise rotation engine for Claude Code. Converts model thinking time into movement.

## Features

- Sequential rotation through equipment-aware exercise pool
- Adaptive difficulty scaling based on API latency duration
- User-controlled difficulty multiplier (harder/softer)
- Claude Code statusline integration with processing detection
- GSD workflow coexistence via bash orchestrator
- Equipment-configurable pool (kettlebell, dumbbells, pull-up bar, parallettes, bodyweight)
- Zero-friction: one command per prompt, no decisions required

## Installation

```bash
npm install -g viberipped
```

Requires Node.js >= 18.

## Quick Start

Get VibeRipped running in three steps:

**Step 1: Configure equipment**

```bash
vibripped config --kettlebell --dumbbells
```

This generates an exercise pool based on your available equipment. Omit flags for bodyweight-only mode.

**Step 2: Test it works**

```bash
vibripped test
```

You should see the next exercise that would be displayed (e.g., "Pushups x15").

**Step 3: Add to Claude Code**

Configure VibeRipped as a statusline provider in your Claude Code settings. See the [Claude Code Integration](#claude-code-integration) section below for complete setup instructions.

## Claude Code Integration

VibeRipped integrates with Claude Code via a statusline provider script that detects when the model is actively processing and displays the next exercise.

### Statusline Provider Setup

Add the following to your Claude Code `settings.json`:

```json
{
  "statuslineProviders": [
    {
      "name": "VibeRipped",
      "path": "/path/to/statusline.js",
      "enabled": true
    }
  ]
}
```

The `statusline.js` script is installed globally with the npm package. Find it at:

```bash
npm root -g
# Then: <npm-root>/viberipped/statusline.js
```

Or use the local path if you cloned the repo:

```bash
# If installed from source
~/path/to/viberipped/statusline.js
```

### GSD Coexistence

If you use the GSD (Get Shit Done) workflow with Claude Code, VibeRipped provides a bash orchestrator to prevent conflicts between statusline providers.

Use `statusline-orchestrator.sh` as your statusline provider instead:

```json
{
  "statuslineProviders": [
    {
      "name": "VibeRipped + GSD",
      "path": "/path/to/statusline-orchestrator.sh",
      "enabled": true
    }
  ]
}
```

The orchestrator detects GSD context and delegates to the appropriate provider.

### How Detection Works

The statusline provider reads JSON from stdin (provided by Claude Code) and uses a token-based heuristic to detect when the model is actively processing. When processing is detected, it triggers the exercise rotation engine and outputs a formatted exercise prompt.

When not processing, on cooldown, or on error, the provider exits silently (no output).

## CLI Reference

### `vibripped config [options]`

Configure equipment flags and generate exercise pool.

**Options:**

- `--kettlebell` / `--no-kettlebell` - Enable/disable kettlebell exercises
- `--dumbbells` / `--no-dumbbells` - Enable/disable dumbbell exercises
- `--pull-up-bar` / `--no-pull-up-bar` - Enable/disable pull-up bar exercises
- `--parallettes` / `--no-parallettes` - Enable/disable parallettes exercises

**Example:**

```bash
# Enable kettlebell and dumbbells, disable parallettes
vibripped config --kettlebell --dumbbells --no-parallettes

# Bodyweight-only mode (disable all equipment)
vibripped config --no-kettlebell --no-dumbbells --no-pull-up-bar --no-parallettes
```

### `vibripped pool list`

List exercises in current pool.

**Example:**

```bash
vibripped pool list
# Output:
# Pushups x15
# Bodyweight squats x20
# Kettlebell swings x15
# ...
```

### `vibripped pool add <name> <reps>`

Add custom exercise to pool.

**Example:**

```bash
vibripped pool add "Burpees" 10
```

Custom exercises are appended to the pool and persist across config regeneration.

### `vibripped pool remove <name>`

Remove exercise from pool.

**Example:**

```bash
vibripped pool remove "Burpees"
```

### `vibripped test`

Preview next exercise without advancing rotation.

**Example:**

```bash
vibripped test
# Output: Pushups x15
```

Use this to verify your pool configuration and difficulty settings.

### `vibripped harder`

Increase difficulty multiplier by one step (0.25 increment).

**Example:**

```bash
vibripped harder
# Multiplier: 1.0 -> 1.25
```

Maximum multiplier: 2.5x. Difficulty multiplier scales all rep counts in the pool.

### `vibripped softer`

Decrease difficulty multiplier by one step (0.25 increment).

**Example:**

```bash
vibripped softer
# Multiplier: 1.0 -> 0.75
```

Minimum multiplier: 0.5x.

## Configuration

VibeRipped stores all configuration and state in `~/.config/viberipped/`.

**Files:**

- `configuration.json` - Equipment flags and difficulty settings
- `pool.json` - Exercise list (auto-generated from equipment config, can be manually edited)
- `state.json` - Rotation index and cooldown tracking (updated automatically)

The pool is auto-generated when you run `vibripped config`, but you can manually edit `pool.json` to customize exercises. Use `vibripped pool add` and `vibripped pool remove` for safer pool modifications.

## How It Works

VibeRipped uses a sequential rotation engine triggered by Claude Code statusline updates. When the model is actively processing, the statusline provider picks the next exercise from the rotation, scales reps based on API latency and user difficulty settings, and displays a compact prompt (e.g., "Pushups x15"). The rotation index advances after each exercise.

Latency-based rep scaling multiplies baseline reps by a factor between 1.0x and 1.5x based on how long the model has been processing. Longer waits produce more reps (up to the 1.5x cap).

User difficulty multiplier ranges from 0.5x to 2.5x and can be adjusted with `vibripped harder` and `vibripped softer`.

All rep counts are clamped to [5, 60] to ensure exercises remain quick and safe.

## Demo

<!-- TODO: Add terminal recording (asciinema/GIF) showing setup and exercise rotation -->

**Example statusline output during a Claude Code session:**

```
Pushups x15
```

After completing the exercise, the next prompt might trigger:

```
Kettlebell swings x18
```

The exercises rotate sequentially through your configured pool. No randomness, no decisions - just the next exercise in line.

## License

MIT - see [LICENSE](LICENSE) file.
