import { describe, expect, it } from "vitest";
import { createSteerQueueExtension } from "../src/extension.ts";

/** A minimal stand-in for pi's extension host: records handlers and what the extension asks pi to do. */
function fakePi() {
	const handlers = new Map<string, (event: any, ctx: any) => any>();
	const sent: { content: unknown; options?: unknown }[] = [];
	const state = { aborted: 0, pending: false, idle: false };
	const ctx = {
		mode: "tui",
		hasUI: true,
		isIdle: () => state.idle,
		abort: () => {
			state.aborted++;
		},
		hasPendingMessages: () => state.pending,
		ui: { setWidget() {}, setEditorComponent() {}, notify() {} },
	};
	const pi = {
		on(event: string, handler: (event: any, ctx: any) => any) {
			handlers.set(event, handler);
			return () => handlers.delete(event);
		},
		sendUserMessage(content: unknown, options?: { deliverAs?: string }) {
			sent.push({ content, options });
			if (options?.deliverAs) setTimeout(() => (state.pending = true), 1);
		},
	};
	const emit = (event: string, payload: object = {}) => handlers.get(event)?.({ type: event, ...payload }, ctx);
	return { pi: pi as any, ctx, sent, state, emit };
}

const typed = (text: string) => ({ text, source: "interactive", streamingBehavior: "steer" });

describe("steer queue extension wired to pi", () => {
	it("interactive input during a run is captured, and sent as the next prompt when the run ends normally", async () => {
		const host = fakePi();
		createSteerQueueExtension(host.pi);

		expect(await host.emit("input", typed("e roda os testes"))).toEqual({ action: "handled" });
		expect(host.sent).toEqual([]);

		await host.emit("agent_settled", { aborted: false });
		expect(host.sent).toEqual([{ content: "e roda os testes", options: { expandPromptTemplates: true } }]);
	});

	it("input sent by the extension itself, or typed while idle, is left to pi", async () => {
		const host = fakePi();
		createSteerQueueExtension(host.pi);

		expect(await host.emit("input", { text: "x", source: "extension", streamingBehavior: "steer" })).toEqual({
			action: "continue",
		});
		expect(await host.emit("input", { text: "x", source: "interactive" })).toEqual({ action: "continue" });
	});

	it("a steering instruction is handed to pi at turn end, and the handler waits until pi has queued it", async () => {
		const host = fakePi();
		const steerQueue = createSteerQueueExtension(host.pi);
		await host.emit("input", typed("faz X, não Y"));
		steerQueue.emptyEnter(host.ctx as any);

		await host.emit("turn_end", { message: { role: "assistant", stopReason: "toolUse" } });

		expect(host.sent).toEqual([
			{ content: "faz X, não Y", options: { deliverAs: "steer", expandPromptTemplates: true } },
		]);
		expect(host.state.pending).toBe(true);
	});

	it("Enter on a steering instruction aborts the run and sends it once the run settles", async () => {
		const host = fakePi();
		const steerQueue = createSteerQueueExtension(host.pi);
		await host.emit("input", typed("para, muda pra Z"));
		steerQueue.emptyEnter(host.ctx as any);
		steerQueue.emptyEnter(host.ctx as any);

		expect(host.state.aborted).toBe(1);
		await host.emit("turn_end", { message: { role: "assistant", stopReason: "aborted" } });
		await host.emit("agent_settled", { aborted: true });
		expect(host.sent).toEqual([{ content: "para, muda pra Z", options: { expandPromptTemplates: true } }]);
	});
});
