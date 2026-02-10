---
name: settings
description: View and change VibeRipped settings — difficulty, environment, detection sensitivity
---

<objective>
Show current VibeRipped configuration and let the user change settings conversationally.
</objective>

<process>

1. **Show current config**:
   ```bash
   viberipped config show
   ```

2. **Ask what to change** — use AskUserQuestion:
   - Difficulty (harder/softer/set specific)
   - Environment (home/office/coworking/anywhere)
   - Detection sensitivity (strict/normal/relaxed)
   - Equipment (add/remove gear)
   - Nothing — just viewing

3. **Apply changes** using CLI commands:

   **Difficulty:**
   ```bash
   viberipped harder          # +0.25x
   viberipped softer          # -0.25x
   viberipped config set multiplier <value>   # exact value (0.5-2.5)
   ```

   **Environment:**
   ```bash
   viberipped config set environment <value>
   ```

   **Detection sensitivity:**
   ```bash
   viberipped config set detection.sensitivity <value>
   ```

   **Equipment:** Read current config, toggle the equipment flag, write config back using the Write tool, then verify with `viberipped config show`.

4. **Verify** — show updated config after changes:
   ```bash
   viberipped config show
   ```

5. **Loop** — ask if they want to change anything else.

</process>

<rules>
- Always show current config first
- After any change, show updated config to confirm
- Difficulty multiplier range: 0.5 to 2.5 in 0.25 increments
- Valid environments: home, office, coworking, anywhere (or custom)
- Valid sensitivities: strict (50ms), normal (100ms), relaxed (500ms)
</rules>
