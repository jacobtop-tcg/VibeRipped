#!/usr/bin/env bash
set -euo pipefail

# Resolve paths relative to this script's location
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Provider paths: GSD from user's Claude hooks, VibeRipped from this project
GSD_STATUSLINE="${GSD_STATUSLINE:-$HOME/.claude/hooks/gsd-statusline.js}"
VR_STATUSLINE="${SCRIPT_DIR}/statusline.js"
SEPARATOR="${VR_SEPARATOR:- │ }"

# Read stdin once into variable (stdin consumed only once)
STDIN_DATA=$(cat)

# Call each provider, suppress errors (one failing must not break the other)
GSD_OUTPUT=""
if [ -f "$GSD_STATUSLINE" ]; then
  GSD_OUTPUT=$(echo "$STDIN_DATA" | node "$GSD_STATUSLINE" 2>/dev/null || echo "")
fi

VR_OUTPUT=$(echo "$STDIN_DATA" | node "$VR_STATUSLINE" 2>/dev/null || echo "")

# Conditional concatenation: no orphaned separators
if [ -n "$GSD_OUTPUT" ] && [ -n "$VR_OUTPUT" ]; then
  printf "%s%s%s" "$GSD_OUTPUT" "$SEPARATOR" "$VR_OUTPUT"
elif [ -n "$GSD_OUTPUT" ]; then
  printf "%s" "$GSD_OUTPUT"
elif [ -n "$VR_OUTPUT" ]; then
  printf "%s" "$VR_OUTPUT"
fi

exit 0
