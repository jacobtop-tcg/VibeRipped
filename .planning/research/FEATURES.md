# Feature Landscape: Latency-Coupled Movement Prompt System

**Domain:** Developer-tooling-integrated micro-exercise rotation system
**Researched:** 2026-02-08
**Confidence:** MEDIUM

## Table Stakes

Features users expect. Missing = product feels incomplete or annoying.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Deterministic exercise rotation | Sequential rotation prevents repetitive exercises and ensures variety without requiring decision-making | Low | Bounded pool with index tracking. Research shows deterministic systems reduce cognitive load vs random selection |
| Equipment configuration | Users have different equipment available (kettlebell, dumbbells, pull-up bar, parallettes, bodyweight) | Low | Filter exercise pool by available equipment at startup. Standard pattern in fitness apps |
| Cooldown prevention | Don't spam exercises during rapid successive model calls | Low | Track last emission timestamp, enforce minimum interval (e.g., 30s). Prevents user annoyance |
| Crisp command-style output | "10 push-ups" not "Great job! Let's energize with 10 amazing push-ups!" | Low | Research: motivational messaging creates short-term interest but cognitive load. Commands enable action without friction |
| Latency-triggered display | Only show exercise during active model processing (call in flight) | Medium | Requires Claude Code session state access. Core differentiator from timer-based apps |
| Statusline integration | Display in Claude Code statusline without conflicting with other providers | Medium | Follow Claude Code statusline conventions: JSON stdin, text stdout, handle null fields |
| Silent operation | No notifications, sounds, or interruptions outside statusline | Low | Research: notification overload and guilt-tripping are top annoyance factors. Passive display only |

## Differentiators

Features that set product apart. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Latency-coupling primitive | Converts "dead time" (waiting for Claude) into movement cues | High | **Core innovation**: exercises only during actual wait time, not arbitrary timers. Aligns movement with natural workflow pauses |
| No tracking/gamification/streaks | Zero guilt, zero FOMO, zero addiction mechanics | Low | **Anti-feature as differentiator**: research shows streak mechanics and guilt-tripping cause abandonment. Boring systems get used |
| Rotation state persistence | Resume rotation across sessions without repeating recent exercises | Low | Minimal state file (~50 bytes): rotation index + cooldown timestamp. Prevents "always push-ups on first call" problem |
| Exercise pool transparency | Users can inspect and modify exercise list (text file or config) | Low | Trust through visibility. Power users can customize without rebuilding |
| Multi-equipment profiles | Switch equipment context (home office with kettlebell vs coworking with bodyweight only) | Medium | `--equipment` flag or profile names. Common use case: different locations have different gear |
| Duration-aware prompts | Longer latency = longer exercise (e.g., "20 squats" for 30s+ waits vs "5 push-ups" for quick calls) | Medium | Requires latency duration measurement. More sophisticated than static prompts |
| Rep count calibration | Adjust exercise difficulty to match user fitness level | Medium | Per-exercise multiplier or global difficulty setting. "10 push-ups" becomes "5 push-ups" for beginners or "20 push-ups" for advanced |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Motivational messaging | Research: emotional resonance generates short-term interest but fails to foster sustained action. Adds cognitive load and feels patronizing | Crisp commands: "10 push-ups" not "You've got this! Let's do 10 energizing push-ups!" |
| Streak tracking | Research: perfectionism kills habits, but most tracking systems are designed around perfect consistency. Creates guilt and anxiety | No tracking at all. Each prompt is independent. Missing a session has zero consequences |
| Progress/analytics dashboard | Adds complexity and maintenance burden. Users who want analytics can use dedicated fitness apps | Keep state minimal (rotation index + cooldown timestamp). No historical data |
| Exercise completion confirmation | Requires user interaction, breaking flow. Assumes compliance needed | Trust user autonomy. Display prompt, move on. No "Did you do it?" or checkboxes |
| Adaptive difficulty via ML | Over-engineered for use case. Adds complexity and failure modes | Manual difficulty calibration (if any). Fitness is personal, let users set their own bar |
| Video/image instructions | Scope creep into exercise education app. Users know exercises or can Google | Text-only prompts. Assumes user competence. Link to external resources if needed |
| Notification spam outside statusline | Research: over-tracking and notification overload fuel anxiety and app deletion | Statusline-only display. Disappears when latency ends. No popups, sounds, or badges |
| Social features (sharing, leaderboards) | Misaligned with "boring systems get used" philosophy. Adds social pressure and comparison anxiety | Single-player experience. Your rotation, your equipment, your pace |
| Exercise history/calendar | Scope creep into fitness logging app. Maintenance burden for marginal value | If user wants history, they can use dedicated logging tools. VibeRipped is a prompt primitive, not a tracker |

## Feature Dependencies

```
Equipment configuration
    └──requires──> Exercise pool definition

Deterministic rotation
    └──requires──> Rotation state persistence
    └──requires──> Exercise pool definition

Cooldown prevention
    └──requires──> Cooldown state persistence

Latency-triggered display
    └──requires──> Statusline integration
    └──requires──> Claude Code session state access

Duration-aware prompts
    └──requires──> Latency duration measurement
    └──requires──> Latency-triggered display
    └──enhances──> Deterministic rotation

Rep count calibration
    └──requires──> Exercise pool definition with metadata
    └──enhances──> Deterministic rotation

Multi-equipment profiles
    └──requires──> Equipment configuration
    └──conflicts──> Minimal state (profiles add config complexity)
```

### Dependency Notes

- **Equipment configuration requires Exercise pool definition**: Can't filter exercises without knowing what exercises exist
- **Deterministic rotation requires Rotation state**: Need to persist index across sessions
- **Duration-aware prompts require Latency duration measurement**: Need to know how long Claude has been processing to scale exercise difficulty
- **Multi-equipment profiles conflict with Minimal state**: Profiles add configuration complexity, may defer to v2+

## MVP Recommendation

### Launch With (v1.0)

Minimum viable product — validate core concept before adding sophistication.

- **Deterministic exercise rotation** — Core user expectation: variety without repetition
- **Equipment configuration** — Essential: not all users have same gear available
- **Cooldown prevention** — Critical: prevents spam during rapid model calls
- **Crisp command-style output** — Core philosophy: low-friction prompts
- **Latency-triggered display** — Core differentiator: exercises during wait time only
- **Statusline integration** — Required: must coexist with Claude Code ecosystem
- **Silent operation** — Core philosophy: passive display, zero interruption

**Why this set**: Validates core hypothesis (latency-coupled movement prompts are useful) with minimal complexity. All features are table stakes or core differentiators. No nice-to-haves.

### Add After Validation (v1.x)

Features to add once core is working and users confirm utility.

- **Rotation state persistence** — Trigger: Users complain about "always push-ups on first call"
- **Exercise pool transparency** — Trigger: Users request customization
- **Duration-aware prompts** — Trigger: Users report prompts feel wrong for very short/long waits
- **Rep count calibration** — Trigger: Users report exercises too hard or too easy

### Defer to Future (v2+)

Features that add complexity without validating core concept.

- **Multi-equipment profiles** — Why defer: Adds config complexity. Most users have one primary environment. Can validate demand first
- **Exercise history/analytics** — Why defer: Scope creep. Validate prompt primitive works before considering tracking

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Latency-triggered display | HIGH | MEDIUM | P1 |
| Deterministic rotation | HIGH | LOW | P1 |
| Equipment configuration | HIGH | LOW | P1 |
| Cooldown prevention | HIGH | LOW | P1 |
| Crisp command output | HIGH | LOW | P1 |
| Statusline integration | HIGH | MEDIUM | P1 |
| Silent operation | HIGH | LOW | P1 |
| Rotation state persistence | MEDIUM | LOW | P2 |
| Exercise pool transparency | MEDIUM | LOW | P2 |
| Duration-aware prompts | MEDIUM | MEDIUM | P2 |
| Rep count calibration | MEDIUM | MEDIUM | P2 |
| Multi-equipment profiles | LOW | MEDIUM | P3 |

**Priority key:**
- **P1**: Must have for launch (validates core concept)
- **P2**: Should have, add when possible (improves UX after validation)
- **P3**: Nice to have, future consideration (adds complexity without core validation)

## Domain-Specific Feature Insights

### What Makes Exercise Reminder Systems Annoying

Research shows top annoyance factors:

1. **Emotional manipulation**: Guilt-tripping ("We miss you"), FOMO ("Your goals miss you"), shame mechanics
2. **Streak addiction**: Breaking streaks feels like failure, creates anxiety rather than motivation
3. **Notification overload**: Generic or promotional alerts lead to app deletion
4. **Context ignorance**: Reminders during meetings, while away from home, or at inappropriate times
5. **Motivational padding**: "Amazing!" "You've got this!" language adds cognitive load and feels patronizing

**VibeRipped mitigation strategy**: Silent statusline display (no notifications), zero guilt mechanics (no streaks/tracking), command-style prompts (no motivational padding), context-aware triggering (only during latency, built-in cooldown).

### What Makes Developer-Tooling Integration Work

Research on IDE extensions and developer productivity tools:

1. **Solve real problems**: Tools must address actual workflow pain points, not theoretical needs
2. **Clean integration**: Must work with existing tools without forcing workflow changes
3. **Respect cognitive load**: Developers have limited attention during code context
4. **Performance matters**: Slow extensions get disabled. Status line scripts must be fast
5. **Minimal configuration**: Complex setup = low adoption

**VibeRipped design alignment**: Solves real problem (sedentary work), integrates into existing tool (Claude Code statusline), respects cognitive load (passive display, no interaction required), fast (minimal state, no API calls), simple setup (equipment config, done).

### Latency-Coupling as Execution Primitive

Build time research reveals key insight: **developers decide whether to go off-task based on expected wait time**. Threshold for context switching typically occurs around 45 seconds.

**Implications for VibeRipped**:
- Claude Code model calls range from 3-30+ seconds depending on complexity
- This is long enough for micro-exercises (5-20 reps) but not long enough to lose context
- **Latency-coupling converts "too short to task-switch but too long to stay still" into movement opportunity**
- Duration-aware prompts can scale exercise to wait time: quick call = quick exercise, long call = longer exercise

### Command vs. Motivational Prompts

Research on fitness messaging effectiveness:

- **Motivational messaging** generates short-term interest but fails to foster sustained action
- **Time markers** (like "10 push-ups now") provide "just-in-time prompting," reducing cognitive load and decision fatigue
- **Combining "why" and "how"** is more effective than either alone
- **Action-planning** (specific, concrete instructions) converts engagement into habits

**VibeRipped approach**: Command-style prompts ("10 push-ups") provide concrete action instructions with zero motivational padding. The "why" is implicit (latency = opportunity to move). The "how" is explicit (specific exercise + rep count).

### Habit Formation Without Tracking

Research paradox: **tracking increases adherence but perfectionism kills habits**.

Most habit tracking systems are designed around perfect consistency (streaks, calendars, completion percentages), exactly the opposite of what research shows works. Additionally, over-tracking fuels anxiety, obsession, and perfectionism.

**VibeRipped resolution**: Provide structure (deterministic rotation, consistent prompting) without accountability (no tracking, no streaks, no guilt). Each prompt is independent. Missing a session has zero consequences. **Boring systems get used**.

## Competitor Feature Analysis

| Feature | General Exercise Reminder Apps | Pomodoro Timer Extensions | VibeRipped Approach |
|---------|-------------------------------|---------------------------|---------------------|
| **Trigger mechanism** | Time-based intervals (hourly, every 30min) | Fixed work/break cycles (25min work, 5min break) | Latency-based (only during Claude Code processing) |
| **Exercise prompts** | Guided routines, videos, full-screen takeovers | No exercise prompts (break time is user-directed) | Command-style prompts in statusline |
| **Customization** | Exercise difficulty, break duration, reminder style | Timer duration, notification settings | Equipment configuration, rep calibration |
| **Tracking** | Daily/weekly/monthly activity breakdowns, streak counts | Pomodoro completion stats, daily totals | No tracking (zero state beyond rotation index) |
| **Notifications** | Push notifications, sounds, full-screen reminders | Audio alerts, popup notifications | Silent statusline display only |
| **Integration** | Standalone apps or OS-level notifications | VSCode/IDE extensions, taskbar indicators | Claude Code statusline provider |
| **Context awareness** | Location-based (disable at lunch), manual snooze | Manual pause/resume | Automatic (only during latency, built-in cooldown) |
| **Motivational elements** | Guilt-tripping, streaks, "we miss you" messages | Productivity guilt ("you broke your flow") | Zero motivational language, no guilt mechanics |

**Key differentiation**: VibeRipped is the only system that couples movement prompts to actual workflow latency rather than arbitrary timers. It's a **deterministic execution primitive** that converts wait time into movement opportunity, not a coach or productivity system.

## Sources

### Exercise Reminder Apps & Features
- [Activity and break apps to help you move at work | University of Missouri System](https://www.umsystem.edu/totalrewards/wellness/activity_and_break_apps)
- [Moova: Hourly Activity Breaks App](https://apps.apple.com/us/app/moova-hourly-activity-breaks/id1518522560)
- [Big Stretch Reminder](https://monkeymatt.com/bigstretch/)
- [Top 5 Stretch Reminder Apps for Mac & Windows | Motion Minute Blog](https://motionminute.app/blog/top-5-stretch-apps)

### What Makes Reminders Annoying
- [Notifications: How Apps Emotionally Manipulate You](https://bitskingdom.com/blog/app-notifications-reminders-guilt-trap/)
- [2 Ways to Avoid Notification Overload and Digital Fatigue | Psychology Today](https://www.psychologytoday.com/us/blog/social-instincts/202309/2-ways-to-avoid-notification-overload-and-digital-fatigue)

### Developer Productivity & Latency
- [Build Times and Developer Productivity](https://www.linkedin.com/pulse/build-times-developer-productivity-abi-noda)
- [Maximizing Developer Effectiveness](https://martinfowler.com/articles/developer-effectiveness.html)
- [Why Reducing Your Project's Build Time Matters | by Steven Lemon | Medium](https://steven-lemon182.medium.com/a-guide-to-reducing-development-wait-time-part-1-why-9dcbbfdc1224)

### Habit Tracking Effectiveness
- [The Science Behind Habit Tracking | Psychology Today](https://www.psychologytoday.com/us/blog/parenting-from-a-neuroscience-perspective/202512/the-science-behind-habit-tracking)
- [Habit trackers: does tracking your habits actually work?](https://nesslabs.com/habit-trackers)
- [The Complete Science of Habit Tracking and Measurement | Cohorty Blog](https://www.cohorty.app/blog/the-complete-science-of-habit-tracking-and-measurement)

### Fitness Messaging Research
- [Motivational Message Framing Effects on Physical Activity Dynamics in a Digital Messaging Intervention - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC10163402/)
- [Motivating Adherence to Exercise Plans Through a Personalized Mobile Health App - PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC8209532/)
- [Get the message? A scoping review of physical activity messaging | International Journal of Behavioral Nutrition and Physical Activity](https://ijbnpa.biomedcentral.com/articles/10.1186/s12966-020-00954-3)

### Claude Code Statusline
- [Customize your status line - Claude Code Docs](https://code.claude.com/docs/en/statusline)
- [ClaudeLog - ccstatusline](https://claudelog.com/claude-code-mcps/ccstatusline/)
- [GitHub - nvim-lualine/lualine.nvim](https://github.com/nvim-lualine/lualine.nvim)

### Pomodoro Extensions
- [Pomodoro Timer - Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=lkytal.pomodoro)
- [Pomodoro for Dev - Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=mbparvezme.pomodoro-for-dev)

### Equipment & Exercise Systems
- [Workout Rotations – 2 Lazy 4 the Gym](https://2lazy4gym.com/workout-rotations/)
- [Best Core Exercises Equipment (2026) | Garage Gym Reviews](https://www.garagegymreviews.com/core-exercises-equipment)

---
*Feature research for: VibeRipped - Claude Code statusline exercise provider*
*Researched: 2026-02-08*
*Confidence: MEDIUM (WebSearch findings verified across multiple sources)*
