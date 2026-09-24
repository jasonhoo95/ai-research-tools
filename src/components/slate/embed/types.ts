export type EmbedElement = {
	type: "embed";
	url: string;
	height?: number;
	title?: string;
	children: [{ text: "" }];
};

export const DEFAULT_EMBED_HEIGHT = 352;
export const MIN_EMBED_HEIGHT = 160;
export const MAX_EMBED_HEIGHT = 720;
