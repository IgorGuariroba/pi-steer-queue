/**
 * pi-steer-queue: type ahead while pi works.
 *
 *   Enter (with text)   → queue the instruction in the "steer queue" box
 *   Enter (empty)       → steer: the first instruction reaches the agent at the next safe point
 *   Enter (empty) again → interrupt the run and send it now
 *   ↑ / ↓               → select and edit a queued instruction (Enter done, Esc cancel)
 *   Alt+↑               → take queued instructions back into the editor
 *
 * Queued instructions become the next prompt when a run ends normally; after Esc the queue pauses.
 */
import { CustomEditor, type ExtensionAPI, type ExtensionContext } from "@earendil-works/pi-coding-agent";
import { matchesKey } from "@earendil-works/pi-tui";
import { createSteerQueueExtension, type SteerQueueController } from "../src/extension.ts";
import { renderQueueBox } from "../src/render.ts";

const WIDGET = "steer-queue";

class SteerQueueEditor extends CustomEditor {
	constructor(
		tui: ConstructorParameters<typeof CustomEditor>[0],
		theme: ConstructorParameters<typeof CustomEditor>[1],
		keybindings: ConstructorParameters<typeof CustomEditor>[2],
		private readonly kb: ConstructorParameters<typeof CustomEditor>[2],
		private readonly queue: SteerQueueController,
		private readonly ctx: () => ExtensionContext,
	) {
		super(tui, theme, keybindings);
	}

	override handleInput(data: string): void {
		const q = this.queue;
		const kb = this.kb;
		const empty = this.getText().trim() === "";

		if (kb.matches(data, "tui.input.submit") && !this.isShowingAutocomplete()) {
			if (q.isEditing()) {
				q.saveEdit(this.getText(), this.ctx());
				this.setText("");
				return;
			}
			if (empty && q.hasItems()) {
				this.setText("");
				q.emptyEnter(this.ctx());
				return;
			}
		}

		if (q.isEditing() && kb.matches(data, "app.interrupt") && !this.isShowingAutocomplete()) {
			q.cancelEdit(this.ctx());
			this.setText("");
			return;
		}

		if (matchesKey(data, "up") && (q.isEditing() || (empty && q.hasItems()))) {
			const text = q.selectPrevious();
			if (text !== undefined) {
				this.setText(text);
				return;
			}
		}

		if (matchesKey(data, "down") && q.isEditing()) {
			const text = q.selectNext();
			if (text !== undefined) this.setText(text);
			return;
		}

		if (kb.matches(data, "app.message.dequeue") && q.hasItems() && !q.isEditing()) {
			const text = q.dequeueAll();
			if (text) {
				this.setText([text, this.getText()].filter((t) => t.trim()).join("\n\n"));
				return;
			}
		}

		super.handleInput(data);
	}
}

export default function steerQueue(pi: ExtensionAPI) {
	let ctx: ExtensionContext | undefined;

	const refresh = () => {
		if (!ctx || ctx.mode !== "tui") return;
		const view = queue.view();
		if (!view) {
			ctx.ui.setWidget(WIDGET, undefined);
			return;
		}
		ctx.ui.setWidget(WIDGET, (_tui, theme) => ({
			render: (width: number) => {
				const current = queue.view();
				return current ? renderQueueBox(current, width, theme) : [];
			},
			invalidate() {},
		}));
	};

	const queue = createSteerQueueExtension(pi, refresh);

	pi.on("session_start", (_event, sessionCtx) => {
		ctx = sessionCtx;
		if (sessionCtx.mode !== "tui") return;
		sessionCtx.ui.setEditorComponent(
			(tui, theme, keybindings) =>
				new SteerQueueEditor(tui, theme, keybindings, keybindings, queue, () => ctx ?? sessionCtx),
		);
	});

	pi.on("session_shutdown", () => {
		ctx = undefined;
	});
}
