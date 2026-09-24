export type KatexElement = {
	type: "katex";
	formula: string;
	displayMode?: boolean;
	children: [{ text: "" }];
};

export const DEFAULT_KATEX_FORMULA = "E = mc^2";
