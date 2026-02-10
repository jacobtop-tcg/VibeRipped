---
name: setup
description: Interactive VibeRipped setup — choose equipment, environment, and difficulty through conversation
---

<objective>
Guide the user through VibeRipped configuration using conversational prompts. Run CLI commands to apply their choices. No TTY needed — Claude Code handles the interaction.
</objective>

<process>

1. **Read current config** (if exists):
   ```bash
   cat ~/.config/viberipped/configuration.json 2>/dev/null
   ```
   If config exists, show current settings and ask if they want to reconfigure or just adjust specific settings.

2. **Equipment selection** — use AskUserQuestion with multiSelect:
   - Kettlebell
   - Dumbbells
   - Pull-up bar
   - Parallettes
   - Bodyweight only (no equipment)

3. **Environment selection** — use AskUserQuestion:
   - Home (all exercises)
   - Office (quiet, low-impact exercises)
   - Coworking (minimal space, no floor exercises)
   - Anywhere (universal exercises only)

4. **Difficulty** — use AskUserQuestion:
   - Easy (0.75x multiplier)
   - Normal (1.0x — recommended)
   - Hard (1.5x)
   - Beast mode (2.0x)

5. **Detection sensitivity** — use AskUserQuestion:
   - Normal (100ms threshold — recommended)
   - Strict (50ms — triggers more often)
   - Relaxed (500ms — triggers less often)

6. **Apply settings** by running CLI commands:
   ```bash
   # Set equipment (run viberipped setup non-interactively by writing config directly)
   # Or use individual config set commands:
   viberipped config set environment <chosen>
   viberipped config set detection.sensitivity <chosen>
   ```

   For equipment changes, the cleanest approach is to write configuration.json directly using the Write tool, then run `viberipped pool list` to verify the pool assembled correctly.

   Equipment config format:
   ```json
   {
     "equipment": {
       "kettlebell": true/false,
       "dumbbells": true/false,
       "pullUpBar": true/false,
       "parallettes": true/false
     },
     "difficulty": { "multiplier": <number> },
     "environment": "<string>",
     "detection": { "sensitivity": "<string>" },
     "schemaVersion": "1.1"
   }
   ```

7. **Verify** — run `viberipped pool list` and `viberipped config show` to confirm settings applied.

8. **Show summary** of what was configured.

</process>

<rules>
- Always read existing config first to preserve settings the user doesn't change
- Use AskUserQuestion for each choice — don't assume defaults without asking
- After applying, always verify with `viberipped config show`
- Config lives at ~/.config/viberipped/configuration.json
</rules>
