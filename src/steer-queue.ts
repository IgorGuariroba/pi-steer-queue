import type { ImageContent } from "@earendil-works/pi-ai";

/** What the user submitted: text plus optional attached images. */
export interface Message {
	text: string;
	images?: ImageContent[];
}

export type DeliveryState = "queued" | "steering" | "interrupting";

interface PendingInstruction {
	message: Message;
	state: DeliveryState;
}

export interface QueueView {
	items: { text: string; state: DeliveryState; selected: boolean }[];
	hint: string;
}

export type Command =
	| { type: "handOffSteer"; message: Message }
	| { type: "abort" }
	| { type: "send"; message: Message };

export class SteerQueue {
	private items: PendingInstruction[] = [];
	private paused = false;
	private running = false;
	private selected: PendingInstruction | undefined;
	/** A normal run ended while the head was under edit; consume once the edit ends. */
	private consumeAfterEdit = false;

	submit(message: Message): void {
		this.items.push({ message, state: "queued" });
	}

	emptyEnter(ctx: { running: boolean }): Command[] {
		const head = this.items[0];
		if (!head) return [];
		if (!ctx.running) return this.sendHead();
		if (head.state === "queued") {
			head.state = "steering";
			return [];
		}
		if (head.state === "steering") {
			head.state = "interrupting";
			return [{ type: "abort" }];
		}
		return [];
	}

	runStarted(): void {
		this.running = true;
		this.consumeAfterEdit = false;
	}

	turnEnd(ctx: { aborted: boolean }): Command[] {
		const head = this.items[0];
		if (ctx.aborted || head?.state !== "steering") return [];
		this.items.shift();
		return [{ type: "handOffSteer", message: head.message }];
	}

	settled(ctx: { aborted: boolean }): Command[] {
		this.running = false;
		const head = this.items[0];
		if (head?.state === "interrupting") return this.sendHead();
		if (ctx.aborted) {
			this.paused = true;
			return [];
		}
		this.paused = false;
		if (head && head === this.selected) {
			this.consumeAfterEdit = true;
			return [];
		}
		return head ? this.sendHead() : [];
	}

	/** ↑: enter editing on the last queued instruction, or move to the previous one. Returns the text to edit. */
	selectPrevious(): string | undefined {
		const editable = this.items.filter((i) => i.state === "queued");
		const at = this.selected ? editable.indexOf(this.selected) : editable.length;
		const target = editable[Math.max(0, at - 1)];
		if (!target) return undefined;
		this.selected = target;
		return target.message.text;
	}

	/** ↓ while editing: move to the next queued instruction. Returns the text to edit. */
	selectNext(): string | undefined {
		if (!this.selected) return undefined;
		const editable = this.items.filter((i) => i.state === "queued");
		const target = editable[Math.min(editable.length - 1, editable.indexOf(this.selected) + 1)];
		if (!target) return undefined;
		this.selected = target;
		return target.message.text;
	}

	/** Alt+↑: remove every queued instruction and return their text for the editor. */
	dequeueAll(): string {
		const queued = this.items.filter((i) => i.state === "queued");
		this.items = this.items.filter((i) => i.state !== "queued");
		this.selected = undefined;
		return queued.map((i) => i.message.text).join("\n\n");
	}

	isEditing(): boolean {
		return this.selected !== undefined;
	}

	/** Enter while editing: save the text; an empty text removes the instruction. */
	saveEdit(text: string): Command[] {
		const target = this.selected;
		if (target) {
			if (text.trim() === "") this.items = this.items.filter((i) => i !== target);
			else target.message = { ...target.message, text };
		}
		return this.endEdit();
	}

	/** Esc while editing: leave the instruction unchanged. */
	cancelEdit(): Command[] {
		return this.endEdit();
	}

	private endEdit(): Command[] {
		this.selected = undefined;
		if (!this.consumeAfterEdit) return [];
		this.consumeAfterEdit = false;
		return this.sendHead();
	}

	view(): QueueView | undefined {
		if (this.items.length === 0) return undefined;
		return {
			items: this.items.map((i) => ({ text: i.message.text, state: i.state, selected: i === this.selected })),
			hint: this.hint(),
		};
	}

	private hint(): string {
		if (this.selected) return "editing · enter done · ↑↓ switch · esc cancel";
		if (this.paused && !this.running) return "enter send now · ↑ select/edit";
		const enter = this.items[0]?.state === "queued" ? "enter steer" : "enter interrupt and send";
		return `${enter} · ↑ select/edit · esc cancel`;
	}

	private sendHead(): Command[] {
		const head = this.items.shift();
		return head ? [{ type: "send", message: head.message }] : [];
	}
}
