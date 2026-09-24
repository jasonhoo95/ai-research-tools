import {
	Editor,
	Element as SlateElement,
	Transforms,
} from "slate";
import type { TextColor } from "@/components/slate/floating-toolbar/types";
import type { SlateEditor as EditorCommandEditor } from "@/components/slate/lib/editor-types";
import { ReactEditor } from "slate-react";

import {
	DEFAULT_BANNER_COLOR,
	type BannerElement,
} from "@/components/slate/banner/types";
import {
	DEFAULT_EMBED_HEIGHT,
	type EmbedElement,
} from "@/components/slate/embed/types";
import { normalizeEmbedUrl } from "@/components/slate/embed/utils";
import {
	DEFAULT_KATEX_FORMULA,
	type KatexElement,
} from "@/components/slate/katex/types";
import {
	DEFAULT_IMAGE_ALIGN,
	type ImageElement,
} from "@/components/slate/img/types";
import { createDefaultTable } from "@/components/slate/table/utils";
// import { uploadImageFile } from "@/lib/uploadImage";

type CustomText = {
	text: string;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	code?: boolean;
	color?: TextColor;
};

const LIST_TYPES = [
	"numbered-list",
	"bulleted-list",
] as const;

export function toggleMark(
	editor: Editor,
	format: keyof Omit<
		CustomText,
		"text" | "color"
	>,
) {
	const active = isMarkActive(editor, format);
	if (active) Editor.removeMark(editor, format);
	else Editor.addMark(editor, format, true);
}

export function isMarkActive(
	editor: Editor,
	format: keyof Omit<
		CustomText,
		"text" | "color"
	>,
) {
	const marks = Editor.marks(
		editor,
	) as CustomText | null;
	return marks ? Boolean(marks[format]) : false;
}

export function getActiveTextColor(
	editor: Editor,
): TextColor {
	const marks = Editor.marks(
		editor,
	) as CustomText | null;
	return marks?.color ?? "default";
}

export function setTextColor(
	editor: Editor,
	color: TextColor,
) {
	if (color === "default") {
		Editor.removeMark(editor, "color");
		return;
	}

	Editor.addMark(editor, "color", color);
}

export function toggleBlock(
	editor: Editor,
	format: string,
) {
	const isActive = isBlockActive(
		editor,
		format,
	);
	const isList = (
		LIST_TYPES as readonly string[]
	).includes(format);

	Transforms.unwrapNodes(editor, {
		match: (n) =>
			!Editor.isEditor(n) &&
			SlateElement.isElement(n) &&
			(
				LIST_TYPES as readonly string[]
			).includes(n.type),
		split: true,
	});

	const newType = isActive
		? "paragraph"
		: isList
			? "list-item"
			: format;

	Transforms.setNodes(
		editor,
		{ type: newType } as never,
		{
			match: (n) =>
				SlateElement.isElement(n) &&
				Editor.isBlock(editor, n),
		},
	);

	if (!isActive && isList) {
		Transforms.wrapNodes(
			editor,
			{
				type: format,
				children: [],
			} as never,
			{
				match: (n) =>
					!Editor.isEditor(n) &&
					SlateElement.isElement(n) &&
					Editor.isBlock(editor, n),
			},
		);
	}
}

export function isBlockActive(
	editor: Editor,
	format: string,
) {
	const { selection } = editor;
	if (!selection) return false;

	const [match] = Array.from(
		Editor.nodes(editor, {
			at: Editor.unhangRange(
				editor,
				selection,
			),
			match: (n) =>
				!Editor.isEditor(n) &&
				SlateElement.isElement(n) &&
				n.type === format,
		}),
	);

	return Boolean(match);
}

export function insertBanner(editor: Editor) {
	const { selection } = editor;
	if (!selection) return;

	const blockEntry = Editor.above(editor, {
		at: selection,
		match: (n) =>
			SlateElement.isElement(n) &&
			Editor.isBlock(editor, n),
		mode: "lowest",
	});

	if (!blockEntry) return;

	const [, path] = blockEntry;

	Transforms.setNodes(
		editor,
		{ type: "paragraph" } as never,
		{ at: path },
	);

	Transforms.wrapNodes(
		editor,
		{
			type: "banner",
			color: DEFAULT_BANNER_COLOR,
			children: [],
		} as never,
		{ at: path },
	);
}

export function insertTable(editor: Editor) {
	Transforms.insertNodes(
		editor,
		createDefaultTable(),
	);
}

export function insertImage(
	editor: Editor,
	url: string,
	alt?: string,
) {
	const image: ImageElement = {
		type: "image",
		url,
		alt,
		align: DEFAULT_IMAGE_ALIGN,
		children: [{ text: "" }],
	};

	Transforms.insertNodes(editor, image);
	Transforms.insertNodes(editor, {
		type: "paragraph",
		children: [{ text: "" }],
	});
}

// function openImageFilePicker(
// 	editor: EditorCommandEditor,
// ) {
// 	const input = document.createElement("input");
// 	input.type = "file";
// 	input.accept = "image/*";

// 	input.onchange = async () => {
// 		const file = input.files?.[0];
// 		if (!file) return;

// 		try {
// 			const url = await uploadImageFile(file);
// 			insertImage(editor, url, file.name);
// 			ReactEditor.focus(editor);
// 		} catch (error) {
// 			console.error(
// 				"Failed to upload image",
// 				error,
// 			);
// 			window.alert(
// 				error instanceof Error
// 					? error.message
// 					: "Could not upload this image.",
// 			);
// 		}
// 	};

// 	input.click();
// }

function insertVoidBlock(
	editor: Editor,
	node: Record<string, unknown>,
) {
	Transforms.insertNodes(editor, node as never);
	Transforms.insertNodes(editor, {
		type: "paragraph",
		children: [{ text: "" }],
	});
}

export function insertKatex(
	editor: Editor,
	formula = DEFAULT_KATEX_FORMULA,
	displayMode = false,
) {
	const katex: KatexElement = {
		type: "katex",
		formula,
		displayMode,
		children: [{ text: "" }],
	};

	Transforms.insertNodes(editor, katex);
	Transforms.move(editor);
}

export function promptAndInsertKatex(
	editor: EditorCommandEditor,
) {
	insertKatex(editor, DEFAULT_KATEX_FORMULA);
	ReactEditor.focus(editor);
}

export function insertEmbed(
	editor: Editor,
	url: string,
	height = DEFAULT_EMBED_HEIGHT,
) {
	const embed: EmbedElement = {
		type: "embed",
		url,
		height,
		children: [{ text: "" }],
	};

	insertVoidBlock(editor, embed);
}

export function promptAndInsertEmbed(
	editor: EditorCommandEditor,
) {
	const raw = window.prompt(
		"Paste embed URL (YouTube, Spotify, Vimeo, or iframe src)",
	);

	if (raw === null || !raw.trim()) return;

	const url = normalizeEmbedUrl(raw);
	if (!url) {
		window.alert(
			"Could not parse that embed URL.",
		);
		return;
	}

	insertEmbed(editor, url);
	ReactEditor.focus(editor);
}

export function pickImageAndInsert(
	editor: EditorCommandEditor,
) {
	// const url = window.prompt(
	// 	"Paste an image URL (leave empty to upload a file)",
	// );
	// if (url === null) return;
	// if (url.trim()) {
	// 	insertImage(editor, url.trim());
	// 	ReactEditor.focus(editor);
	// 	return;
	// }
	// openImageFilePicker(editor);
}

export function setParagraph(editor: Editor) {
	toggleBlock(editor, "paragraph");
}

export type { EditorCommandEditor };
