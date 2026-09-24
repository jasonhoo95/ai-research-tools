import { Range, type BaseEditor, type Range as SlateRange } from "slate";
import type { HistoryEditor } from "slate-history";
import {
	ReactEditor,
	type ReactEditor as ReactEditorType,
} from "slate-react";

type ToolbarEditor = BaseEditor & ReactEditorType & HistoryEditor;

const MENU_WIDTH = 280;
const MENU_HEIGHT = 44;

function rectToPosition(rect: DOMRect | undefined) {
	if (!rect) return null;
	if (
		rect.top === 0 &&
		rect.left === 0 &&
		rect.width === 0 &&
		rect.height === 0
	) {
		return null;
	}

	return {
		top: rect.top - 8,
		left: rect.left + rect.width / 2,
	};
}

export function getFloatingToolbarPositionForRange(
	editor: ToolbarEditor,
	selection: SlateRange,
) {
	if (Range.isCollapsed(selection)) return null;

	try {
		const domRange = ReactEditor.toDOMRange(
			editor,
			selection,
		);
		const fromDom = rectToPosition(
			domRange.getBoundingClientRect(),
		);
		if (fromDom) return clampPosition(fromDom);
	} catch {
		// DOM may not be ready yet.
	}

	return null;
}

export function getFloatingToolbarPosition(editor: ToolbarEditor) {
	const { selection } = editor;
	if (!selection || Range.isCollapsed(selection)) return null;

	return getFloatingToolbarPositionForRange(
		editor,
		selection,
	);
}

function clampPosition(position: { top: number; left: number }) {
	const maxLeft = Math.max(
		8 + MENU_WIDTH / 2,
		window.innerWidth - MENU_WIDTH / 2 - 8,
	);
	const minTop = 8 + MENU_HEIGHT;

	return {
		top: Math.max(minTop, position.top),
		left: Math.min(
			Math.max(8 + MENU_WIDTH / 2, position.left),
			maxLeft,
		),
	};
}
