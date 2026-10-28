import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { setImmediate as nextTick } from "node:timers/promises";
import { type Command, type Message, SteerQueue } from "./steer-queue.ts";

function content(message: Message) {
	return message.images?.length ? [{ type: "text" as const, text: message.text }, ...message.images] : message.text;
}

export type SteerQueueController = ReturnType<typeof createSteerQueueExtension>;

/**
 * Wires the steer queue to pi's lifecycle. Returns the key actions the editor routes here.
 * `onChange` is called after anything that may change what the steer queue box shows.
 */
export function createSteerQueueExtension(pi: ExtensionAPI, onChange: () => void = () => {}) {
	const queue = new SteerQueue();

	const run = (commands: Command[], ctx: ExtensionContext) => {
		onChange();
		for (const command of commands) {
			if (command.type === "send") pi.sendUserMessage(content(command.message), { expandPromptTemplates: true });
			else if (command.type === "handOffSteer")
				pi.sendUserMessage(content(command.message), { deliverAs: "steer", expandPromptTemplates: true });
			else ctx.abort();
		}
	};

	/**
	 * pi awaits turn_end handlers right before its steering poll, but sendUserMessage queues asynchronously.
	 * Wait (bounded) until pi reports the message as pending so the poll picks it up this turn. See ADR 0001.
	 */
	const waitUntilQueued = async (ctx: ExtensionContext) => {
		const deadline = Date.now() + 1000;
		while (!ctx.hasPendingMessages() && Date.now() < deadline) await nextTick();
	};

	pi.on("input", (event) => {
		if (event.source !== "interactive" || !event.streamingBehavior) return { action: "continue" };
		queue.submit({ text: event.text, images: event.images });
		onChange();
		return { action: "handled" };
	});

	pi.on("agent_start", () => {
		queue.runStarted();
		onChange();
	});

	pi.on("turn_end", async (event, ctx) => {
		const aborted = event.message.role === "assistant" && event.message.stopReason === "aborted";
		const commands = queue.turnEnd({ aborted });
		if (commands.length === 0) return;
		onChange();
		run(commands, ctx);
		await waitUntilQueued(ctx);
	});

	pi.on("agent_settled", (event, ctx) => run(queue.settled({ aborted: event.aborted }), ctx));

	/** Key actions the editor routes to the steer queue. */
	return {
		view: () => queue.view(),
		hasItems: () => queue.view() !== undefined,
		isEditing: () => queue.isEditing(),
		/** Enter on an empty editor: promote the first instruction (or send it now when idle). */
		emptyEnter(ctx: ExtensionContext) {
			run(queue.emptyEnter({ running: !ctx.isIdle() }), ctx);
		},
		/** ↑: start editing or move to the previous queued instruction. Returns the text to load. */
		selectPrevious() {
			const text = queue.selectPrevious();
			onChange();
			return text;
		},
		/** ↓ while editing. Returns the text to load. */
		selectNext() {
			const text = queue.selectNext();
			onChange();
			return text;
		},
		saveEdit(text: string, ctx: ExtensionContext) {
			run(queue.saveEdit(text), ctx);
		},
		cancelEdit(ctx: ExtensionContext) {
			run(queue.cancelEdit(), ctx);
		},
		/** Alt+↑: take every queued instruction back as editor text. */
		dequeueAll() {
			const text = queue.dequeueAll();
			onChange();
			return text;
		},
	};
}
