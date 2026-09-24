import {
	Editor,
	Range,
	Text,
	Transforms,
} from "slate";

import type { SlateEditor } from "@/components/slate/lib/editor-types";
import type { LinkElement } from "./types";
import { normalizeLinkUrl } from "./utils";

export function insertLinkAtSelection(
	editor: SlateEditor,
	url: string,
	selection?: Range | null,
) {
	const normalized = normalizeLinkUrl(url);
	if (!normalized) return false;

	const target = selection ?? editor.selection;
	if (!target) return false;

	Transforms.select(editor, target);

	if (Range.isCollapsed(target)) {
		const link: LinkElement = {
			type: "link",
			url: normalized,
			children: [{ text: normalized }],
		};
		Transforms.insertNodes(editor, link);
	} else {
		const link: LinkElement = {
			type: "link",
			url: normalized,
			children: [{ text: "" }],
		};

		Transforms.wrapNodes(editor, link, {
			split: true,
			match: (n) => Text.isText(n),
		});
	}

	Transforms.collapse(editor, { edge: "end" });
	return true;
}

export function unwrapLinkAtSelection(editor: SlateEditor) {
	const { selection } = editor;
	if (!selection) return false;

	Transforms.unwrapNodes(editor, {
		at: selection,
		match: (n) =>
			!Editor.isEditor(n) &&
			"type" in n &&
			n.type === "link",
	});
	return true;
}
