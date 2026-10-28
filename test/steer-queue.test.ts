import { describe, expect, it } from "vitest";
import { SteerQueue } from "../src/steer-queue.ts";

describe("steer queue", () => {
	it("a message submitted during a run becomes a queued pending instruction", () => {
		const q = new SteerQueue();
		q.submit({ text: "meu mr está aprovado?" });

		expect(q.view()).toEqual({
			items: [{ text: "meu mr está aprovado?", state: "queued", selected: false }],
			hint: "enter steer · ↑ select/edit · esc cancel",
		});
	});

	it("an empty Enter during a run promotes the first instruction to steering without sending yet", () => {
		const q = new SteerQueue();
		q.submit({ text: "faz X, não Y" });
		q.submit({ text: "depois roda os testes" });

		expect(q.emptyEnter({ running: true })).toEqual([]);
		expect(q.view()).toEqual({
			items: [
				{ text: "faz X, não Y", state: "steering", selected: false },
				{ text: "depois roda os testes", state: "queued", selected: false },
			],
			hint: "enter interrupt and send · ↑ select/edit · esc cancel",
		});
	});

	it("a steering instruction is handed to pi at the end of a normal turn and leaves the queue", () => {
		const q = new SteerQueue();
		q.submit({ text: "faz X, não Y" });
		q.submit({ text: "depois roda os testes" });
		q.emptyEnter({ running: true });

		expect(q.turnEnd({ aborted: false })).toEqual([{ type: "handOffSteer", message: { text: "faz X, não Y" } }]);
		expect(q.view()?.items).toEqual([{ text: "depois roda os testes", state: "queued", selected: false }]);
	});

	it("a queued (not steering) instruction is not handed over at turn end", () => {
		const q = new SteerQueue();
		q.submit({ text: "depois roda os testes" });

		expect(q.turnEnd({ aborted: false })).toEqual([]);
		expect(q.view()?.items).toHaveLength(1);
	});

	it("an aborted turn does not hand the steering instruction over", () => {
		const q = new SteerQueue();
		q.submit({ text: "faz X" });
		q.emptyEnter({ running: true });

		expect(q.turnEnd({ aborted: true })).toEqual([]);
		expect(q.view()?.items[0]?.state).toBe("steering");
	});

	it("an empty Enter on a steering instruction interrupts the run and sends it once the run settles", () => {
		const q = new SteerQueue();
		q.submit({ text: "para, muda pra Z" });
		q.submit({ text: "depois roda os testes" });
		q.emptyEnter({ running: true });

		expect(q.emptyEnter({ running: true })).toEqual([{ type: "abort" }]);
		expect(q.turnEnd({ aborted: true })).toEqual([]);
		expect(q.settled({ aborted: true })).toEqual([{ type: "send", message: { text: "para, muda pra Z" } }]);
		expect(q.view()?.items).toEqual([{ text: "depois roda os testes", state: "queued", selected: false }]);
	});

	it("when a run ends normally the first queued instruction is auto-consumed, one per run", () => {
		const q = new SteerQueue();
		q.submit({ text: "primeiro" });
		q.submit({ text: "segundo" });

		expect(q.settled({ aborted: false })).toEqual([{ type: "send", message: { text: "primeiro" } }]);
		expect(q.settled({ aborted: false })).toEqual([{ type: "send", message: { text: "segundo" } }]);
		expect(q.settled({ aborted: false })).toEqual([]);
		expect(q.view()).toBeUndefined();
	});

	it("a user abort pauses the queue: nothing is auto-consumed and Enter on an empty editor sends now", () => {
		const q = new SteerQueue();
		q.submit({ text: "primeiro" });
		q.submit({ text: "segundo" });

		expect(q.settled({ aborted: true })).toEqual([]);
		expect(q.view()?.hint).toBe("enter send now · ↑ select/edit");
		expect(q.emptyEnter({ running: false })).toEqual([{ type: "send", message: { text: "primeiro" } }]);
		expect(q.view()?.items.map((i) => i.text)).toEqual(["segundo"]);
	});

	it("while a new run is active, a paused queue offers steer again", () => {
		const q = new SteerQueue();
		q.submit({ text: "pendente" });
		q.settled({ aborted: true });
		q.runStarted();

		expect(q.view()?.hint).toBe("enter steer · ↑ select/edit · esc cancel");
		expect(q.emptyEnter({ running: true })).toEqual([]);
		expect(q.view()?.items[0]?.state).toBe("steering");
	});

	describe("editing", () => {
		it("↑ selects the last queued instruction and loads its text for editing", () => {
			const q = new SteerQueue();
			q.submit({ text: "primeiro" });
			q.submit({ text: "segundo" });

			expect(q.selectPrevious()).toBe("segundo");
			expect(q.view()).toEqual({
				items: [
					{ text: "primeiro", state: "queued", selected: false },
					{ text: "segundo", state: "queued", selected: true },
				],
				hint: "editing · enter done · ↑↓ switch · esc cancel",
			});
		});

		it("Enter saves the edited text into the instruction and leaves editing", () => {
			const q = new SteerQueue();
			q.submit({ text: "faz Y" });
			q.selectPrevious();
			q.saveEdit("faz X");

			expect(q.view()?.items).toEqual([{ text: "faz X", state: "queued", selected: false }]);
			expect(q.view()?.hint).toBe("enter steer · ↑ select/edit · esc cancel");
		});

		it("saving an empty text removes the instruction", () => {
			const q = new SteerQueue();
			q.submit({ text: "primeiro" });
			q.submit({ text: "segundo" });
			q.selectPrevious();
			q.saveEdit("   ");

			expect(q.view()?.items.map((i) => i.text)).toEqual(["primeiro"]);
		});

		it("Esc cancels the edit and keeps the instruction unchanged", () => {
			const q = new SteerQueue();
			q.submit({ text: "original" });
			q.selectPrevious();
			q.cancelEdit();

			expect(q.view()?.items).toEqual([{ text: "original", state: "queued", selected: false }]);
		});

		it("↑/↓ switch between queued instructions and never reach a steering one", () => {
			const q = new SteerQueue();
			q.submit({ text: "steer me" });
			q.submit({ text: "dois" });
			q.submit({ text: "três" });
			q.emptyEnter({ running: true });

			expect(q.selectPrevious()).toBe("três");
			expect(q.selectPrevious()).toBe("dois");
			expect(q.selectPrevious()).toBe("dois");
			expect(q.selectNext()).toBe("três");
			expect(q.selectNext()).toBe("três");
		});

		it("an instruction under edit is not auto-consumed; it is sent once the edit is saved", () => {
			const q = new SteerQueue();
			q.submit({ text: "rascunho" });
			q.selectPrevious();

			expect(q.settled({ aborted: false })).toEqual([]);
			expect(q.saveEdit("versão final")).toEqual([{ type: "send", message: { text: "versão final" } }]);
		});

		it("there is nothing to edit when only a steering instruction is pending", () => {
			const q = new SteerQueue();
			q.submit({ text: "steer me" });
			q.emptyEnter({ running: true });

			expect(q.selectPrevious()).toBeUndefined();
			expect(q.isEditing()).toBe(false);
		});
	});

	it("Alt+↑ returns every queued instruction to the editor and keeps the steering one", () => {
		const q = new SteerQueue();
		q.submit({ text: "steer me" });
		q.submit({ text: "dois" });
		q.submit({ text: "três" });
		q.emptyEnter({ running: true });

		expect(q.dequeueAll()).toBe("dois\n\ntrês");
		expect(q.view()?.items.map((i) => i.text)).toEqual(["steer me"]);
	});

	it("attached images travel with the instruction until it is delivered", () => {
		const q = new SteerQueue();
		const image = { type: "image" as const, data: "aGk=", mimeType: "image/png" };
		q.submit({ text: "olha isso", images: [image] });
		q.emptyEnter({ running: true });

		expect(q.turnEnd({ aborted: false })).toEqual([
			{ type: "handOffSteer", message: { text: "olha isso", images: [image] } },
		]);
	});

	it("a paused queue resumes auto-consuming after a run that ends normally", () => {
		const q = new SteerQueue();
		q.submit({ text: "pendente" });
		q.settled({ aborted: true });

		expect(q.settled({ aborted: false })).toEqual([{ type: "send", message: { text: "pendente" } }]);
	});

	it("a steering instruction left by a user abort is sent by Enter on an empty editor", () => {
		const q = new SteerQueue();
		q.submit({ text: "faz X" });
		q.emptyEnter({ running: true });
		q.turnEnd({ aborted: true });
		q.settled({ aborted: true });

		expect(q.emptyEnter({ running: false })).toEqual([{ type: "send", message: { text: "faz X" } }]);
	});
});
