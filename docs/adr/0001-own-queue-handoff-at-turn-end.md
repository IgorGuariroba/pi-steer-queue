# The extension owns the steer queue and hands a steering instruction to pi only at `turn_end`

Pi's native queue can't be read, edited or cleared from the extension API, yet the steer queue must show, edit and reorder pending instructions. So the extension captures interactive input during a run (the `input` event returns `handled`) and takes over Enter, Alt+Enter, ↑, Alt+↑ and Esc-while-editing through a `CustomEditor`.

A pending instruction in the **steering** state also stays in the extension. It is passed to pi with `sendUserMessage(..., { deliverAs: "steer" })` only inside the `turn_end` handler, which pi awaits right before its steering poll. If the extension handed it over at promotion time, an **interrupt** (`abort` and then resend) would leave a copy in pi's steering queue. The next run's initial steering poll would pick up that copy, and the instruction would be delivered twice.

## Consequences

- When an instruction is in **steering**, pi's own "pending messages" area does not show it. The steer queue is the only place where it appears.
- `ctx.abort()` does not clear pi's queues. A user abort through Esc runs pi's native path, which returns pi's (empty) queue to the editor. The steering instruction stays in the paused steer queue.
