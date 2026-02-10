---
name: status
description: Quick VibeRipped status — current exercise, config summary, pool size
---

<objective>
Show a quick snapshot of VibeRipped's current state.
</objective>

<process>

1. Run these commands and present a compact summary:

```bash
viberipped config show
viberipped pool list
viberipped test
```

2. Present as:

```
## VibeRipped Status

**Environment:** {env} | **Difficulty:** {multiplier}x | **Detection:** {sensitivity}
**Pool:** {N} exercises ({M} active for current environment)
**Next exercise:** {from test output}
```

</process>
