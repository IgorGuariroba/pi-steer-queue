import type { Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { QueueView } from "./steer-queue.ts";

const TITLE = "steer queue";

/** Draws the steer queue box: a titled border, one line per pending instruction, and the key hint. */
export function renderQueueBox(view: QueueView, width: number, theme: Theme): string[] {
	if (width < 8) return [];
	const border = (text: string) => theme.fg("warning", text);
	const inner = width - 4;
	const row = (text: string) => {
		const cut = truncateToWidth(text, inner, "…");
		return `${border("│")} ${cut}${" ".repeat(Math.max(0, inner - visibleWidth(cut)))} ${border("│")}`;
	};

	const title = ` ${TITLE} `;
	const lines = [border(`┌─${title}${"─".repeat(Math.max(0, width - 3 - title.length))}┐`)];
	for (const item of view.items) {
		const text = item.text.replace(/\s+/g, " ").trim();
		const marker = item.selected ? theme.fg("accent", "▸") : "○";
		const tag =
			item.state === "steering" ? " · steering" : item.state === "interrupting" ? " · interrupting" : "";
		const body = item.selected ? theme.fg("accent", text) : text;
		lines.push(row(`${marker} ${body}${theme.fg("dim", tag)}`));
	}
	lines.push(row(theme.fg("dim", view.hint)));
	lines.push(border(`└${"─".repeat(width - 2)}┘`));
	return lines;
}
