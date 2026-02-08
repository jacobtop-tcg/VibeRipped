# Pitfalls Research

**Domain:** Claude Code statusline provider + latency-coupled exercise rotation system
**Researched:** 2026-02-08
**Confidence:** MEDIUM-HIGH

## Critical Pitfalls

### Pitfall 1: Statusline Race Condition / Last Write Wins Crosstalk

**What goes wrong:**
Multiple statusline providers or concurrent Claude Code instances overwrite each other's outputs. The rendering logic follows a "Last Write Wins" pattern where any update from any active background session overwrites the global status bar variable, causing crosstalk, flickering, and one provider completely obliterating another's output.

**Why it happens:**
- Statusline implementations often use global terminal state without instance-specific markers
- Update timing is debounced at 300ms, creating overlap windows where competing writes collide
- Escape sequences for cursor positioning can interfere when multiple sources write to the same terminal row
- No coordination protocol between providers means they're unaware of each other

**How to avoid:**
- Use instance-specific session markers (e.g., `CLAUDE_INSTANCE_ID=VIBERIPPED` for identification)
- Implement atomic operations with random backoff under concurrent access
- Coordinate with other statusline providers (GSD) through shared state file with lock mechanism
- Register as a provider rather than attempting to be the sole status writer
- Test with GSD statusline active to verify coexistence

**Warning signs:**
- Status disappears randomly during use
- Flicker when other processes update their status
- Status shows data from wrong context/session
- ANSI escape codes appear as literal text (indicates sequence collision)

**Phase to address:**
Phase 1 (Core Integration) - Must establish coexistence protocol before any exercise logic

---

### Pitfall 2: Over-Triggering Leading to User Disablement

**What goes wrong:**
Exercise prompts trigger so frequently that users experience notification fatigue, perceive the system as spam, and disable it entirely. Research shows throttling must limit to 2-3 notifications per week unless users explicitly opt in, yet latency-coupled systems may trigger every few minutes during active work sessions.

**Why it happens:**
- Claude Code API calls can happen every 30-60 seconds during active conversation
- No cooldown leads to prompt saturation: "Just did pushups, now you want squats?"
- Rate limiting that's too lax (e.g., "once per minute") becomes background noise
- Gamification fatigue: badge complexity and feature richness create alert overload

**How to avoid:**
- Implement aggressive cooldown: minimum 15-30 minutes between prompts (configurable)
- Track "last prompt time" in state, enforce cooldown even across restarts
- Cooldown should be per-session, not global (multiple projects = independent timers)
- Priority-based delivery: only trigger on API calls that exceed X seconds (filter out quick calls)
- User control: `/viberipped cooldown 45m` or config setting for personal tolerance
- Respect existing "Do Not Disturb" signals if terminal provides them

**Warning signs:**
- User comments like "this is annoying" or "how do I turn this off"
- Prompts appearing within 5 minutes of each other
- Trigger rate scales with typing speed rather than actual latency
- No visible "time until next prompt" feedback

**Phase to address:**
Phase 1 (Core Integration) - Cooldown is table stakes, not optional enhancement

---

### Pitfall 3: State File Corruption on Concurrent Access

**What goes wrong:**
State file becomes corrupted due to half-writes when process crashes after truncation but before finishing JSON write, or when multiple processes access simultaneously. Next read triggers `JSONDecodeError`, rotation index is lost, user gets same exercise repeatedly or system fails silently.

**Why it happens:**
- Naive file writes truncate first, then write JSON (crash window = corrupt file)
- Multiple Claude Code sessions in different directories could share global state path
- Network issues during write to remote-mounted home directory
- Manual edits while system is running

**How to avoid:**
- Atomic write-rename pattern: write to `.viberipped-state.tmp`, then `mv` to `.viberipped-state.json`
- Forensic-safe recovery: if main is corrupted, return default state without writing (preserve broken file for debug)
- File locking mechanism or optimistic concurrency with retry
- Version state format (`{"version": 1, "data": {...}}`) for graceful migration
- Regular backups: keep `.viberipped-state.json.bak` on successful writes
- State validation on read: JSON schema check before trusting contents

**Warning signs:**
- `JSONDecodeError` in logs
- State file is empty or contains partial JSON
- User reports "it keeps giving me the same exercise"
- State file timestamp shows write happened during known crash

**Phase to address:**
Phase 1 (Core Integration) - State persistence must be bulletproof from day one

---

### Pitfall 4: Process Detection False Positives/Negatives

**What goes wrong:**
Latency monitoring either (A) triggers on non-AI events (file saves, git operations) flooding user with false positives, or (B) misses actual AI calls due to incorrect detection pattern, making system seem broken.

**Why it happens:**
- Assuming all bash commands are AI-triggered (false positive: `git status` via statusline caching)
- Hardcoded latency threshold (e.g., ">2 seconds") doesn't account for network variance
- Detection relies on process name which varies across Claude Code versions
- Background MCP servers create latency spikes unrelated to user actions

**How to avoid:**
- Hook into Claude Code's JSON data stream (statusline already receives `cost.total_api_duration_ms`)
- Track delta between `total_api_duration_ms` readings to detect new API calls
- Only trigger when `total_api_duration_ms` increases AND delta exceeds threshold
- Threshold should be configurable and adaptive (learn user's typical latency profile)
- Ignore updates where `context_window.current_usage` is null (pre-API state)

**Warning signs:**
- Exercise prompts during file operations with no Claude interaction
- No prompts despite long Claude responses (>5 seconds)
- Trigger rate correlates with terminal activity rather than AI activity
- Prompts during silent periods (no user input)

**Phase to address:**
Phase 1 (Core Integration) - Detection accuracy determines entire system's credibility

---

### Pitfall 5: Cognitive Friction from Verbose/Clever Prompts

**What goes wrong:**
Exercise prompts become micro-decisions rather than instant actions. Verbose instructions ("Please perform 10 repetitions of bodyweight squats with proper form"), clever/motivational language ("Time to crush those gains!"), or emoji spam creates parsing overhead that makes user hesitate or skip.

**Why it happens:**
- Designer assumes coaching language is helpful/motivating
- Copying fitness app patterns (gamification, encouragement) into crisp command context
- Over-specifying details that user already configured ("with the dumbbells you selected")
- Trying to make it "fun" when user wants it to be invisible

**How to avoid:**
- Command-style output: "Pushups x15" not "It's time for 15 pushups!"
- No emojis, no exclamation points, no motivation speak
- Configuration happens once (pool setup), prompts assume user knows their exercises
- Test prompt: Can user execute without re-reading? If not, too verbose.
- Philosophy: boring execution primitive, not a coach

**Warning signs:**
- Prompts exceed 20 characters
- User needs to parse prompt before acting
- Feedback mentions "annoying" or "patronizing" tone
- Prompts include instructions user has seen 50 times

**Phase to address:**
Phase 2 (Exercise Logic) - Prompt format is UX core, not cosmetic polish

---

### Pitfall 6: Intensity Creep Making Users Resist Commands

**What goes wrong:**
Exercise pool contains progressively harder variants (pushups → diamond pushups → one-arm pushups) that user configured during optimistic setup. Over time, rotation reaches exercises user can't/won't do mid-workday, creating resistance: "I'll do it after this" → never happens → system becomes guilt generator rather than behavior primitive.

**Why it happens:**
- User configures pool in "ideal state" mindset, not "2pm in jeans at standing desk" reality
- No mechanism to skip impossible exercises without breaking rotation determinism
- Pool includes equipment user doesn't always have access to
- Intensity appropriate for gym but not for work environment

**How to avoid:**
- Configuration wizard should ask context: "These exercises during work hours?"
- Equipment tags: mark exercises requiring specific gear, filter based on availability
- Escape hatch: `/viberipped skip` advances rotation but logs skip (determinism intact)
- Pool design guidance: "If you wouldn't do this in front of a coworker, don't add it"
- Review mechanism: weekly summary shows skip rate per exercise, prompts pool cleanup

**Warning signs:**
- Skip rate above 30% for any exercise
- User edits pool to remove "advanced" variants shortly after adding them
- Time-to-completion drops (user starts ignoring prompts)
- Exercises require more than 60 seconds to complete

**Phase to address:**
Phase 2 (Exercise Logic) - Pool design prevents this, skip mechanism recovers from it

---

### Pitfall 7: Loss of Determinism Eroding Trust

**What goes wrong:**
User expects sequential rotation (Squats → Pushups → Planks → repeat) but system behaves unpredictably due to state loss, incorrect index increment, or edge cases. User gets Squats three times in a row, then Pushups never appears. Unpredictable behavior makes system feel "broken" even if technically functional.

**Why it happens:**
- State file corruption (see Pitfall 3) resets index to 0
- Modulo arithmetic bug when pool size changes mid-rotation
- Multiple concurrent sessions don't share state, each maintains own index
- Index increment happens before exercise shown (user sees wrong exercise if crash occurs)

**How to avoid:**
- State includes both `rotation_index` and `pool_hash` (detect pool changes)
- If pool hash changes: reset index to 0 with explicit "Pool updated, starting fresh" message
- Increment index AFTER successful prompt, not before
- State file includes `last_exercise` as sanity check (detect skips)
- Determinism test: user should be able to predict next exercise from history

**Warning signs:**
- Same exercise appears twice in a row (unless pool size = 1)
- User reports "random" behavior
- Rotation doesn't loop cleanly (misses exercises)
- Changing pool order causes unexpected jumps

**Phase to address:**
Phase 2 (Exercise Logic) - Rotation correctness is core contract with user

---

### Pitfall 8: Embarrassment/Impracticality in Public Settings

**What goes wrong:**
System suggests exercises that are socially awkward in workplace/public setting: burpees in open office, loud exercises during video calls, movements requiring floor space user doesn't have, exercises causing visible sweat/breathlessness before meetings.

**Why it happens:**
- Pool design doesn't consider social context (home gym mindset)
- No awareness of user's calendar, meeting status, or location
- Exercises designed for effectiveness, not discretion
- User doesn't pre-filter pool for "can do in public" criteria

**How to avoid:**
- Pool tagging: `public-safe: true/false` for each exercise
- Default pool should be conservative (desk-friendly only)
- Configuration guidance: "Will you be comfortable doing this at work?"
- Avoid: floor exercises, high-noise movements (jumping jacks), anything requiring lying down
- Prioritize: standing desk stretches, isometrics, resistance bands, doorframe exercises
- Context detection: if on video call (mic active?), suppress or switch to silent exercises

**Warning signs:**
- User creates separate "work" and "home" pools
- Skip rate spikes during business hours vs. evenings
- User reports "can't do this here"
- Exercises require changing clothes or cleanup afterward

**Phase to address:**
Phase 2 (Exercise Logic) - Default pool must be workplace-appropriate

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Global state file in `~/.viberipped-state.json` | Simple path, works immediately | Can't run different pools per project, state conflicts | Never - use `.viberipped/state.json` per project |
| Polling for process activity instead of event hooks | Easy to implement without Claude Code API knowledge | CPU waste, detection lag, false triggers | Only for MVP prototype, must replace in Phase 1 |
| Hardcoded cooldown (15 minutes) instead of config | Ships faster, avoids config UI | User can't adjust to their tolerance, one-size-fits-none | Acceptable for Phase 1 if clearly documented as next-phase feature |
| String-based exercise pool instead of structured data | Quick to parse, human-editable | No metadata (tags, equipment), can't filter/search | Never - use JSON from start |
| Synchronous file writes without atomic rename | Fewer lines of code | State corruption risk on crash | Never - atomic writes are 3 extra lines |
| Single statusline format instead of themes | Avoids complexity | Can't customize verbosity, clashes with user aesthetics | Acceptable for Phase 1, add themes in Phase 3 |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Claude Code statusline | Assuming you're the only provider, writing directly to terminal | Register via `statusLine.command`, coordinate with existing providers (GSD) |
| Statusline JSON parsing | Using `jq` without null fallbacks (`// 0`) | All fields can be null pre-API-call, always provide defaults |
| Multi-instance detection | Using `process.pid` for cache filenames | Use stable session ID or project-based paths |
| Escape sequences | Using `echo -e` which varies by shell | Use `printf '%b'` for reliable escape handling |
| Git command latency | Running `git status` on every statusline update | Cache results with 5-second TTL in fixed temp file location |
| Context window percentage | Using `total_input_tokens` for percentage | Use `current_usage.input_tokens` for accurate context state |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| No caching on statusline calls | Prompt appears instantly at first, then 2-6 second lag develops | Cache state reads, debounce updates, lazy-load pool | After ~50 exercises in pool or slow filesystem |
| Synchronous file I/O in statusline script | Blocking terminal during state save | Async I/O or write-behind queue | When state file grows or on network-mounted home dir |
| Full pool validation on every trigger | JSON schema check on every rotation | Validate on load, trust in-memory state during session | Pool with 100+ exercises |
| Grepping logs for history | Works fine for first week | Indexed database or bounded log rotation | After 1000+ prompts (depends on query frequency) |
| Shell subprocesses for every statusline update | Fast on modern systems initially | Keep process warm, batch operations | 10+ statusline updates/second (streaming output) |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| No "time until next prompt" indicator | User doesn't know if system is working, anxiety about surprise prompts | Show countdown in statusline: "Next exercise: 12m" |
| Prompt disappears after 5 seconds | User misses prompt if not watching terminal | Keep visible until acknowledged OR user sends next command |
| No skip count visibility | User doesn't realize they're skipping 80% of prompts (system failure signal) | Weekly report: "Completed 12, skipped 3, acceptance rate 80%" |
| Editing pool requires JSON knowledge | User avoids pool maintenance, keeps bad exercises | CLI commands: `/viberipped pool add "Squats x20"` |
| No dry-run mode | User afraid to enable, unsure of behavior | `--dry-run` flag shows what WOULD happen without state changes |
| Silent failures | System stops working, user doesn't know why | Error states visible in statusline: "⚠️ State file corrupt" |
| No feedback on completion | User does exercise, system is silent, feels like shouting into void | Acknowledge action: "✓ Pushups x15 (3/10 in rotation)" |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Statusline integration:** Often missing multi-instance safety — verify works when running two Claude Code sessions simultaneously
- [ ] **State persistence:** Often missing corruption recovery — verify behavior when state file is manually deleted mid-session
- [ ] **Cooldown logic:** Often missing cross-restart persistence — verify cooldown survives if Claude Code restarts during cooldown period
- [ ] **Exercise rotation:** Often missing pool-size-change handling — verify index behavior when pool shrinks from 10 to 5 exercises with index=7
- [ ] **Detection accuracy:** Often missing non-AI-call filtering — verify doesn't trigger on `git status`, file saves, or other background processes
- [ ] **Prompt formatting:** Often missing length testing — verify all exercises fit in single line without wrapping on 80-char terminal
- [ ] **Skip mechanism:** Often missing determinism preservation — verify rotation order unchanged after skipping 3 exercises in a row
- [ ] **Configuration:** Often missing validation — verify behavior when pool is empty array, cooldown is negative, or invalid JSON

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| State file corruption | LOW | Delete state file, system auto-regenerates with index=0; user sees "Pool reset" message |
| Statusline conflict | MEDIUM | Check `ps aux | grep statusline`, identify competing provider, coordinate or disable one |
| Over-triggering user disablement | HIGH | User already frustrated; must re-enable manually with improved cooldown; trust damaged |
| Pool with impossible exercises | LOW | `/viberipped pool remove "One-arm pushups"` or edit JSON directly; index adjusts automatically |
| Detection false positives | MEDIUM | Adjust threshold via config, clear cooldown state to reset trigger timing |
| Prompt verbosity annoyance | MEDIUM | Update prompt templates, existing rotation continues with new format |
| Lost determinism | LOW | Reset index to 0 explicitly, document as "known reset event" |
| Embarrassment incident | HIGH | Immediate skip command + pool cleanup; damage to workplace reputation already done |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Statusline race condition | Phase 1: Core Integration | Run two Claude Code instances simultaneously, verify no crosstalk |
| Over-triggering | Phase 1: Core Integration | Simulate 20 rapid API calls, verify only 1-2 prompts appear |
| State file corruption | Phase 1: Core Integration | Kill process during write, verify recovery on next run |
| Process detection false positives | Phase 1: Core Integration | Run non-AI commands (git, file saves), verify no triggers |
| Cognitive friction from verbose prompts | Phase 2: Exercise Logic | User can execute prompt without re-reading it |
| Intensity creep | Phase 2: Exercise Logic | Skip rate analysis shows <30% for all exercises |
| Loss of determinism | Phase 2: Exercise Logic | Predict next 5 exercises, verify rotation matches |
| Embarrassment/impracticality | Phase 2: Exercise Logic | Default pool contains only desk-friendly exercises |

## User-Identified Failure Modes: Validation

The user identified 6 failure modes before research. Here's validation + additions:

| User's Mode | Research Validates? | Additional Findings |
|-------------|---------------------|---------------------|
| 1. UI conflict — overwrites other status outputs, causes flicker | **YES** — Critical pitfall. Claude Code has known "Last Write Wins" race condition causing crosstalk between statusline providers. | Must use instance-specific markers, atomic operations. DEC mode 2026 (synchronized output) eliminates flicker entirely. |
| 2. Cognitive friction — verbose/clever prompts become decisions | **YES** — Critical pitfall. Research shows gamification fatigue and alert overload when prompts require parsing. | Command-style output mandatory: "Pushups x15" not coaching language. |
| 3. Intensity creep — harder sets make user resist sending commands | **YES** — Moderate pitfall. Research on workplace fitness shows exercises must consider social context and physical ability diversity. | Need skip mechanism, equipment tags, context-aware filtering. |
| 4. Spam — triggers too often, becomes background noise | **YES** — Critical pitfall. Notification fatigue research shows 2-3/week limit; throttling mandatory; 43% lower opt-out with user control. | 15-30 minute cooldown minimum, priority-based delivery, engagement thresholds. |
| 5. Embarrassment/impracticality — suggests awkward actions | **YES** — Critical pitfall. Workplace exercise research emphasizes gradual progress, peer observation anxiety, inclusive design for public settings. | Pool tagging (`public-safe`), default to desk-friendly only, avoid floor/noise. |
| 6. Loss of determinism — unpredictable behavior erodes trust | **YES** — Critical pitfall. State corruption, concurrent access, pool changes all threaten sequential rotation contract. | Atomic writes, pool hash tracking, increment-after-prompt, sanity checks. |

**Additional failure modes discovered through research:**

7. **State file corruption** — Not explicitly called out, but implied by determinism concern. Research shows this is common pattern causing JSONDecodeError, requires atomic write-rename.
8. **Process detection false positives/negatives** — New finding. Idle time monitoring research shows pattern detection creates false alarms; must hook into actual API duration data.
9. **Multi-instance conflicts** — Variant of UI conflict but specific to state management rather than display. Cache filename patterns, session markers critical.
10. **Performance degradation** — Not in user's list. Research shows statusline scripts causing 2-6 second lag without caching, 4,000-6,700 scroll events/second creating jitter.

## Sources

### Statusline & Terminal Rendering
- [Claude Code Statusline Documentation](https://code.claude.com/docs/en/statusline) - MEDIUM confidence (official docs, describes debouncing, update timing, escape sequences)
- [Bug: Status Bar Crosstalk in Multi-Session Environments](https://github.com/anthropics/claude-code/issues/15226) - HIGH confidence (official issue tracker, describes Last Write Wins race condition)
- [Claude Chill: Fix Claude Code's flickering in terminal](https://news.ycombinator.com/item?id=46699072) - MEDIUM confidence (community discussion, DEC mode 2026 synchronized output solution)
- [Excessive scroll events causing UI jitter](https://github.com/anthropics/claude-code/issues/9935) - HIGH confidence (official issue, microsecond-precision logging showing 4,000-6,700 scrolls/second)
- [Crash-safe JSON at scale: atomic writes + recovery without a DB](https://dev.to/constanta/crash-safe-json-at-scale-atomic-writes-recovery-without-a-db-3aic) - MEDIUM confidence (technical blog, atomic write-rename pattern)

### State Management & Corruption
- [Top 6 Terraform State Management Issues](https://www.xavor.com/blog/terraform-state-management/) - MEDIUM confidence (infrastructure tool patterns applicable to local state files)
- [Safe atomic file writes for JSON and YAML in Python 3](https://gist.github.com/therightstuff/cbdcbef4010c20acc70d2175a91a321f) - MEDIUM confidence (code example, forensic-safe recovery approach)

### Notification Fatigue & Rate Limiting
- [How to Reduce Notification Fatigue: 7 Proven Product Strategies](https://www.courier.com/blog/how-to-reduce-notification-fatigue-7-proven-product-strategies-for-saas) - MEDIUM confidence (SaaS research, 43% lower opt-out with preference controls, 2-3/week limit)
- [Understanding and Managing Alert Fatigue](https://www.suprsend.com/post/alert-fatigue) - MEDIUM confidence (describes throttling, priority-based delivery, intelligent suppression)
- [What Is Alert Fatigue & How to Combat It?](https://www.ninjaone.com/blog/what-is-alert-fatigue/) - LOW confidence (general alerting guidance)

### Cognitive Friction & Gamification Fatigue
- [Cognitive Friction, when AI breaks the flow](https://medium.com/design-bootcamp/cognitive-friction-when-ai-breaks-the-flow-64f4f07e0e30) - MEDIUM confidence (UX research, describes tension from affordance mismatches)
- [Understanding the failing of social gamification: A perspective of user fatigue](https://www.sciencedirect.com/science/article/abs/pii/S1567422324000140) - HIGH confidence (academic research, badge complexity → gamification burnout → app abandonment)
- [Is more always better? S-shaped impact of gamification feature richness](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2025.1671543/full) - HIGH confidence (2025 research, satiation and overload thresholds, non-linear trajectory)
- [Why Gamification Fails: New Findings for 2026](https://medium.com/design-bootcamp/why-gamification-fails-new-findings-for-2026-fff0d186722f) - MEDIUM confidence (2026 trends, over-featured systems become controlling/incoherent)

### Process Detection & Monitoring
- [Idle Time: What It Is, How to Measure & Reduce It](https://meramonitor.com/idle-time/) - MEDIUM confidence (describes keyboard/mouse activity monitoring, 5-10 minute thresholds)
- [How does a high false positive rate affect process plants?](https://precog.co/glossary/false-positive-rate/) - MEDIUM confidence (false positive impact on productivity, pattern recognition issues)
- [Reducing False Positives with AI](https://lucinity.com/blog/understanding-false-positives-in-transaction-monitoring-what-causes-them-and-how-can-ai-can-reduce-operational-waste) - LOW confidence (ML approaches, stale data causing false positives)

### Workplace Exercise & Embarrassment
- [57+ Proven Office Exercise Challenges [2025 Guide]](https://matterapp.com/blog/office-exercise-challenges) - MEDIUM confidence (peer observation anxiety, gradual progress emphasis, 2-5 minute micro-challenges)
- [63+ Office Fitness Challenges for Every Workplace in 2026](https://matterapp.com/blog/office-fitness-challenges) - MEDIUM confidence (inclusive design, multiple participation options, beginners focus)
- [Why Exercise at Work: Development of the Office Exercise Behavior Determinants Scale](https://pmc.ncbi.nlm.nih.gov/articles/PMC7967457/) - HIGH confidence (academic research, intrinsic motivation + social environment + work environment factors)
- [Embarrassment as a public vs. private emotion](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2024.1437298/full) - MEDIUM confidence (psychological research on public embarrassment contexts)

### CLI Tools & Configuration
- [7 Modern CLI Tools You Must Try in 2026](https://medium.com/the-software-journal/7-modern-cli-tools-you-must-try-in-2026-c4ecab6a9928) - LOW confidence (trends toward beautiful, intelligent, opinionated tools with minimal config)
- [Sequential Workflow — AutoGen](https://microsoft.github.io/autogen/stable//user-guide/core-user-guide/design-patterns/sequential-workflow.html) - HIGH confidence (deterministic sequence pattern, pre-specified sub-tasks)

---
*Pitfalls research for: VibeRipped - Claude Code statusline provider + micro-exercise rotation system*
*Researched: 2026-02-08*
