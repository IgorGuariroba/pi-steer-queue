# pi-steer-queue

Lets the user type the next instructions while the agent is still working, keep them visible, and decide per instruction whether it waits, steers the current run, or interrupts it.

## Language

**Pending instruction** (instrução pendente):
A message (text and optional images) the user submitted while the agent was running and that has not yet reached the agent.
_Avoid_: follow-up, queued message, draft

**Steer queue**:
The ordered, visible list of pending instructions; the first item is the only one that can be promoted.
_Avoid_: follow-ups box, pending list, native queue

**Delivery state**:
Where a pending instruction stands on its way to the agent: `queued`, `steering`, or `interrupting`.
_Avoid_: status, mode

**Queued**:
Delivery state of a pending instruction that waits for the current run to end normally and then becomes the next prompt.
_Avoid_: follow-up, waiting

**Steering**:
Delivery state of a pending instruction handed to the current run, to be read at the next safe point without cutting off in-flight work. Cannot be edited or cancelled.
_Avoid_: steer-queued, redirecting

**Interrupt**:
Stopping the current run on purpose in order to send the first pending instruction immediately.
_Avoid_: abort (reserved for user abort), force-send

**User abort**:
Stopping the current run without sending anything (Esc / cancel turn); it pauses the steer queue.
_Avoid_: interrupt, cancel

**Paused queue**:
A steer queue that does not auto-deliver after a user abort, until an empty Enter sends the first item or a run ends normally.
_Avoid_: stopped queue, frozen

**Promote**:
Advance the first pending instruction to the next delivery state with an empty Enter (`queued` → `steering` → interrupt).
_Avoid_: escalate, bump

**Auto-consume**:
When a run ends normally and the queue is not paused, the first `queued` instruction is sent as a new prompt.
_Avoid_: drain, flush
