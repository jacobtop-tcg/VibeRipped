---
name: exercises
description: View and manage your VibeRipped exercise pool — list, add, remove exercises through conversation
---

<objective>
Show the user's exercise pool and let them manage it conversationally. Wraps `viberipped pool` CLI commands.
</objective>

<process>

1. **Show current pool**:
   ```bash
   viberipped pool list
   ```

2. **Ask what they want to do** — use AskUserQuestion:
   - View exercises (already shown)
   - Add exercises
   - Remove exercises
   - Done

3. **If adding:**
   Ask the user what exercises to add. They can provide:
   - Single: "Burpees 12"
   - Batch: "Burpees 12, Mountain climbers 20, Plank 30s"
   - Timed: "Plank 30" with type timed

   For each exercise, run:
   ```bash
   viberipped pool add "<name>" <reps>
   ```
   Or for batch:
   ```bash
   viberipped pool add "<comma-separated list>"
   ```
   For timed exercises:
   ```bash
   viberipped pool add "<name>" <duration> --type timed
   ```

   After adding, show updated pool with `viberipped pool list`.

4. **If removing:**
   Show the pool list and ask which exercise(s) to remove.
   ```bash
   viberipped pool remove "<name>"
   ```
   After removing, show updated pool.

5. **Loop** — after each action, ask if they want to do more or are done.

</process>

<rules>
- Always show the current pool first so the user has context
- After any change, show the updated pool to confirm
- Exercise names are case-sensitive — match exactly what's in the pool
- Batch format: comma-separated "Name reps, Name reps"
- Timed exercises use --type timed flag
</rules>
