export type TextColor =
	| "default"
	| "red"
	| "orange"
	| "yellow"
	| "green"
	| "blue"
	| "purple"
	| "gray";

export type TextColorOption = {
	value: TextColor;
	label: string;
	swatch: string;
	style?: string;
};

export const TEXT_COLOR_OPTIONS: TextColorOption[] = [
	{
		value: "default",
		label: "Default",
		swatch: "bg-foreground",
	},
	{
		value: "red",
		label: "Red",
		swatch: "bg-red-500",
		style: "#dc2626",
	},
	{
		value: "orange",
		label: "Orange",
		swatch: "bg-orange-500",
		style: "#ea580c",
	},
	{
		value: "yellow",
		label: "Yellow",
		swatch: "bg-amber-400",
		style: "#ca8a04",
	},
	{
		value: "green",
		label: "Green",
		swatch: "bg-emerald-500",
		style: "#059669",
	},
	{
		value: "blue",
		label: "Blue",
		swatch: "bg-blue-500",
		style: "#2563eb",
	},
	{
		value: "purple",
		label: "Purple",
		swatch: "bg-violet-500",
		style: "#7c3aed",
	},
	{
		value: "gray",
		label: "Gray",
		swatch: "bg-zinc-400",
		style: "#71717a",
	},
];

export function getTextColorStyle(color: TextColor | undefined) {
	if (!color || color === "default") return undefined;
	return TEXT_COLOR_OPTIONS.find(
		(option) => option.value === color,
	)?.style;
}
