export type BannerColor =
	| "blue"
	| "green"
	| "yellow"
	| "orange"
	| "red"
	| "purple"
	| "gray";

export type BannerText = {
	text: string;
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	code?: boolean;
};

export type BannerParagraphElement = {
	type: "paragraph";
	children: BannerText[];
};

export type BannerElement = {
	type: "banner";
	color: BannerColor;
	children: BannerParagraphElement[];
};

export const DEFAULT_BANNER_COLOR: BannerColor = "blue";

export type BannerColorOption = {
	value: BannerColor;
	label: string;
	swatch: string;
	container: string;
};

export const BANNER_COLOR_OPTIONS: BannerColorOption[] = [
	{
		value: "blue",
		label: "Blue",
		swatch: "bg-blue-500",
		container:
			"border-blue-200/80 bg-blue-50 text-blue-950 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-100",
	},
	{
		value: "green",
		label: "Green",
		swatch: "bg-emerald-500",
		container:
			"border-emerald-200/80 bg-emerald-50 text-emerald-950 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100",
	},
	{
		value: "yellow",
		label: "Yellow",
		swatch: "bg-amber-400",
		container:
			"border-amber-200/80 bg-amber-50 text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100",
	},
	{
		value: "orange",
		label: "Orange",
		swatch: "bg-orange-500",
		container:
			"border-orange-200/80 bg-orange-50 text-orange-950 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-100",
	},
	{
		value: "red",
		label: "Red",
		swatch: "bg-red-500",
		container:
			"border-red-200/80 bg-red-50 text-red-950 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100",
	},
	{
		value: "purple",
		label: "Purple",
		swatch: "bg-violet-500",
		container:
			"border-violet-200/80 bg-violet-50 text-violet-950 dark:border-violet-900/50 dark:bg-violet-950/40 dark:text-violet-100",
	},
	{
		value: "gray",
		label: "Gray",
		swatch: "bg-zinc-400",
		container:
			"border-zinc-200/80 bg-zinc-100 text-zinc-900 dark:border-zinc-700/50 dark:bg-zinc-900/50 dark:text-zinc-100",
	},
];

export function getBannerColorStyles(color: BannerColor) {
	return (
		BANNER_COLOR_OPTIONS.find(
			(option) => option.value === color,
		) ?? BANNER_COLOR_OPTIONS[0]
	);
}
