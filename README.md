# pi-steer-queue

Type your next instruction while [pi](https://pi.dev) is still working, see it in a box, and choose how it reaches the agent:

![pi-steer-queue](https://raw.githubusercontent.com/IgorGuariroba/pi-steer-queue/main/docs/images/cover.png)

| You press | What happens |
|---|---|
| **Enter** (with text) | The instruction is added to the **steer queue** box. The current run is not affected. |
| **Enter** (empty editor) | **Steer**: the first instruction reaches the agent at the next safe point, after the current tool calls. Nothing in progress is cut off. |
| **Enter** (empty) again | **Interrupt**: the run stops and the instruction is sent right away. |
| **↑ / ↓** (empty editor) | Select a queued instruction and edit it. **Enter** saves; an empty text removes the item. **Esc** cancels the edit. |
| **Alt+↑** | Moves the queued instructions back into the editor. |

**Queued**: the instruction waits in the box while the run continues.

![queued instruction](https://raw.githubusercontent.com/IgorGuariroba/pi-steer-queue/main/docs/images/queue.png)

**Steering**: after an empty Enter, the instruction is delivered when the current command finishes.

![steering instruction](https://raw.githubusercontent.com/IgorGuariroba/pi-steer-queue/main/docs/images/steering.png)

**Several queued**: each one becomes the next prompt, in order, when a run ends normally.

![several queued instructions](https://raw.githubusercontent.com/IgorGuariroba/pi-steer-queue/main/docs/images/queued.png)

- If you never promote an instruction, it stays in the queue. When the run ends normally, it becomes the next prompt. Several instructions are consumed one at a time, in order.
- After you stop the run with **Esc**, the queue pauses. Instructions stay in the box until you press Enter on an empty editor (sends the first one now) or until a later run ends normally.
- Known `/commands` still run immediately. Attached images travel with the instruction.
- Pending instructions are not saved when you quit or switch sessions.

## Install

```bash
pi install npm:pi-steer-queue
# or
pi install git:github.com/IgorGuariroba/pi-steer-queue
```

## How it works

The extension keeps its own queue, because pi's native queue can't be read or edited from an extension. An instruction you promote to steering is handed to pi only at `turn_end`, right before pi polls for steering messages. This way an interrupt never delivers it twice. See [`docs/adr/0001`](docs/adr/0001-own-queue-handoff-at-turn-end.md) and [`GLOSSARY.md`](GLOSSARY.md).

## Develop

```bash
npm install
npm test          # vitest
npm run typecheck
pi -e ./extensions/steer-queue.ts
```

## License

MIT
