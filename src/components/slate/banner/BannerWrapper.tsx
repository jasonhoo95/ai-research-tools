"use client";

import { PanelTop } from "lucide-react";
import { useCallback, useState } from "react";
import { Transforms } from "slate";
import {
	ReactEditor,
	useFocused,
	useSelected,
	useSlateStatic,
	type RenderElementProps,
} from "slate-react";

import { cn } from "@/lib/utils";

import {
	BANNER_COLOR_OPTIONS,
	DEFAULT_BANNER_COLOR,
	getBannerColorStyles,
	type BannerColor,
	type BannerElement,
} from "./types";

export function BannerWrapper({
	attributes,
	children,
	element,
}: RenderElementProps & { element: BannerElement }) {
	const editor = useSlateStatic();
	const selected = useSelected();
	const focused = useFocused();
	const isActive = selected && focused;

	const [hovered, setHovered] = useState(false);
	const showControls = isActive || hovered;

	const color = element.color ?? DEFAULT_BANNER_COLOR;
	const colorStyles = getBannerColorStyles(color);

	const updateBanner = useCallback(
		(patch: Partial<BannerElement>) => {
			const path = ReactEditor.findPath(editor, element);
			Transforms.setNodes(editor, patch, { at: path });
		},
		[editor, element],
	);

	return (
		<div
			{...attributes}
			className="relative my-3"
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => setHovered(false)}
		>
			<div
				className={cn(
					"pointer-events-none absolute inset-x-0 bottom-full z-20 flex justify-center pb-1.5 transition-opacity duration-150",
					showControls ? "opacity-100" : "opacity-0",
				)}
			>
				<div
					className={cn(
						"flex items-center gap-2 rounded-lg border bg-background px-2 py-1.5 shadow-md",
						showControls
							? "pointer-events-auto"
							: "pointer-events-none",
					)}
					onMouseDown={(event) => event.preventDefault()}
				>
					<span className="flex items-center gap-1.5 border-r pr-2 text-xs font-medium text-muted-foreground">
						<PanelTop className="size-3.5" />
						Banner
					</span>
					<div className="flex items-center gap-1">
						{BANNER_COLOR_OPTIONS.map((option) => (
							<button
								key={option.value}
								type="button"
								title={option.label}
								aria-label={`${option.label} banner`}
								onMouseDown={(event) =>
									event.preventDefault()
								}
								onClick={() =>
									updateBanner({
										color: option.value,
									})
								}
								className={cn(
									"relative flex size-6 items-center justify-center rounded-md transition-transform hover:scale-110",
									color === option.value &&
										"ring-2 ring-primary ring-offset-1",
								)}
							>
								<span
									className={cn(
										"size-4 rounded-full",
										option.swatch,
									)}
								/>
							</button>
						))}
					</div>
				</div>
			</div>

			{showControls ? (
				<div
					aria-hidden
					className="absolute inset-x-0 bottom-full h-12"
				/>
			) : null}

			<div
				className={cn(
					"rounded-lg border px-4 py-3 text-sm transition-shadow",
					colorStyles.container,
					"[&_p]:leading-7 [&_p:not(:last-child)]:mb-1",
					"[&_ol]:my-1 [&_ul]:my-1",
					isActive &&
						"ring-2 ring-primary/30 ring-offset-2 ring-offset-background",
				)}
			>
				{children}
			</div>
		</div>
	);
}
