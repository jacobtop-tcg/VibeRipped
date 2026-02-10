# VibeRipped

[![npm version](https://img.shields.io/npm/v/viberipped.svg)](https://www.npmjs.com/package/viberipped)
[![license](https://img.shields.io/npm/l/viberipped.svg)](LICENSE)
[![Node.js](https://img.shields.io/node/v/viberipped.svg)](https://nodejs.org)

**Turn AI thinking time into exercise.** VibeRipped is a micro-exercise engine for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) that detects when the model is processing and tells you what to do while you wait.

```
💪 Pushups x15
```

No decisions. No apps. Just the next exercise, right in your terminal.

## Install

```bash
npm install -g viberipped
```

Requires Node.js 18+.

## Get Started

### 1. Run setup

```bash
viberipped setup
```

The interactive wizard walks you through equipment selection, environment, and difficulty.

### 2. Test it

```bash
viberipped test
```

You should see something like `Pushups x15` — your next exercise in the rotation.

### 3. Done

The installer automatically registers VibeRipped as a Claude Code statusline provider. Every time Claude thinks, you move.

If you need to configure it manually, see [Claude Code Integration](#claude-code-integration).

## Features

- **26 exercises** across 5 equipment categories (bodyweight, kettlebell, dumbbells, pull-up bar, parallettes)
- **Adaptive difficulty** — reps scale with API response time and your chosen multiplier
- **Smart detection** — delta-based processing detection with configurable sensitivity
- **Sequential rotation** — predictable order, no randomness, no repeated muscle groups back-to-back
- **Environment filtering** — tag exercises for home, office, coworking, or anywhere
- **Zero decisions** — one exercise per prompt, just do it and get back to work
- **Zero external dependencies** — runs on Node.js built-ins (plus Commander for CLI)

## CLI Reference

### `viberipped setup`

Interactive first-time setup. Walks through equipment, environment, and difficulty.

### `viberipped test`

Preview the next exercise without advancing rotation.

### `viberipped harder` / `viberipped softer`

Adjust difficulty multiplier up or down by 0.25x. Range: 0.5x to 2.5x.

```bash
viberipped harder
# Multiplier: 1.0x -> 1.25x
```

### `viberipped config`

Show current configuration: equipment, environment, difficulty, and detection sensitivity.

### `viberipped config set <key> <value>`

Set a configuration value directly.

| Key | Values | Default |
|-----|--------|---------|
| `multiplier` | `0.5` to `2.5` (in 0.25 steps) | `1.0` |
| `sensitivity` | `strict`, `normal`, `relaxed` | `normal` |
| `environment` | any string (`home`, `office`, etc.) | `anywhere` |

```bash
viberipped config set multiplier 1.5
viberipped config set sensitivity strict
viberipped config set environment office
```

### `viberipped config get <key>`

Get a single configuration value.

### `viberipped config --kettlebell --dumbbells ...`

Toggle equipment flags. Each flag has a `--no-` variant. Regenerates the exercise pool.

```bash
# Enable kettlebell and dumbbells
viberipped config --kettlebell --dumbbells

# Bodyweight only
viberipped config --no-kettlebell --no-dumbbells --no-pull-up-bar --no-parallettes
```

### `viberipped pool list`

List all exercises in your current pool with reps/duration.

### `viberipped pool add <name> [reps]`

Add a custom exercise. Use `--type timed --duration <seconds>` for timed exercises.

```bash
viberipped pool add "Burpees" 10
viberipped pool add "Handstand hold" --type timed --duration 20
```

### `viberipped pool remove <name>`

Remove an exercise from the pool.

### `viberipped pool manage`

Interactive checklist to toggle exercises on/off.

## Configuration

All config lives in `~/.config/viberipped/`:

| File | Purpose |
|------|---------|
| `config.json` | Equipment flags, difficulty, environment, sensitivity |
| `pool.json` | Exercise list (auto-generated, safe to hand-edit) |
| `state.json` | Rotation index and cooldown tracking (managed automatically) |

Run `viberipped config` to see your current settings at a glance.

## How It Works

1. Claude Code invokes `statusline.js` on each update, passing session data via stdin
2. VibeRipped checks if the model is actively processing using delta-based API duration tracking
3. If processing, it picks the next exercise from the rotation and scales reps:
   - **Latency factor** (1.0x–1.5x): longer API calls = more reps
   - **User multiplier** (0.5x–2.5x): your chosen difficulty
   - **Clamped** to 5–60 reps to keep exercises quick and safe
4. The formatted exercise displays in your Claude Code statusline
5. A cooldown prevents the same exercise from firing again immediately

Detection sensitivity controls how responsive the trigger is:

| Sensitivity | Threshold | Best for |
|-------------|-----------|----------|
| `strict` | 50ms delta | Fast connections, maximum triggers |
| `normal` | 100ms delta | Most users (default) |
| `relaxed` | 500ms delta | Slow connections, fewer false triggers |

## Claude Code Integration

### Automatic (default)

`npm install -g viberipped` adds VibeRipped to `~/.claude/settings.json` automatically. Uninstalling removes it.

### Manual

If auto-configuration didn't run (e.g. Claude Code was installed after VibeRipped), add it yourself:

```json
{
  "statuslineProviders": [
    {
      "name": "VibeRipped",
      "path": "/path/to/viberipped/statusline.js",
      "enabled": true
    }
  ]
}
```

Find the installed path with `npm root -g` and append `/viberipped/statusline.js`.

### With GSD Workflow

If you use the [GSD](https://github.com/gsd-framework/gsd) workflow, VibeRipped ships a bash orchestrator that runs both providers side-by-side:

```json
{
  "statuslineProviders": [
    {
      "name": "VibeRipped + GSD",
      "path": "/path/to/viberipped/statusline-orchestrator.sh",
      "enabled": true
    }
  ]
}
```

The orchestrator pipes stdin to both providers and concatenates their output with a separator. If either provider has no output, the separator is omitted.

## Exercise Database

26 built-in exercises across 5 categories:

### Bodyweight (always available)

| Exercise | Reps/Duration | Category |
|----------|---------------|----------|
| Pushups | 15 reps | push |
| Bodyweight squats | 20 reps | legs |
| Desk pushups | 15 reps | push |
| Lunges | 10 reps | legs |
| Calf raises | 25 reps | legs |
| Tricep dips | 12 reps | core |
| Wall sit | 30 seconds | core |
| High knees | 30 reps | legs |
| Glute bridges | 15 reps | legs |
| Plank | 30 seconds | core |

### Kettlebell

| Exercise | Reps | Category |
|----------|------|----------|
| Kettlebell swings | 15 | core |
| Goblet squats | 12 | legs |
| Kettlebell deadlifts | 12 | legs |
| Turkish get-up | 3 | core |

### Dumbbells

| Exercise | Reps | Category |
|----------|------|----------|
| Dumbbell rows | 12 | pull |
| Overhead press | 10 | push |
| Dumbbell curls | 12 | pull |
| Lateral raises | 12 | pull |

### Pull-up Bar

| Exercise | Reps/Duration | Category |
|----------|---------------|----------|
| Pull-ups | 8 reps | pull |
| Chin-ups | 8 reps | pull |
| Hanging knee raises | 10 reps | core |
| Dead hangs | 20 seconds | pull |

### Parallettes

| Exercise | Reps/Duration | Category |
|----------|---------------|----------|
| L-sit | 20 seconds | core |
| Parallette pushups | 12 reps | push |
| Tuck planche | 10 reps | push |
| Parallette dips | 10 reps | core |

Add your own with `viberipped pool add` or edit `~/.config/viberipped/pool.json` directly.

## License

MIT — see [LICENSE](LICENSE).
