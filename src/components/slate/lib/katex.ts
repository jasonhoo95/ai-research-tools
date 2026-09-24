import "katex/dist/katex.min.css";

import katex from "katex";

export function renderKatexHtml(formula: string, displayMode = true) {
	if (!formula.trim()) {
		return "";
	}

	try {
		return katex.renderToString(formula, {
			throwOnError: false,
			displayMode,
			output: "html",
		});
	} catch {
		return `<span class="text-destructive text-sm">Invalid LaTeX formula</span>`;
	}
}
