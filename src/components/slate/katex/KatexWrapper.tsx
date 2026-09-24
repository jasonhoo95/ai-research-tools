"use client";

import { FunctionSquare, Pencil } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { Transforms } from "slate";
import {
	ReactEditor,
	useFocused,
	useSelected,
	useSlateStatic,
	type RenderElementProps,
} from "slate-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import type { KatexElement } from "./types";
import { renderKatexHtml } from "./utils";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuCheckboxItem } from "@/components/ui/dropdown-menu";

export function KatexWrapper({
	attributes,
	children,
	element,
}: RenderElementProps & { element: KatexElement }) {
	const editor = useSlateStatic();
	const selected = useSelected();
	const focused = useFocused();
	const isActive = selected && focused;

	const [hovered, setHovered] = useState(false);
	const [editing, setEditing] = useState(false);
	const [draftFormula, setDraftFormula] = useState(
		element.formula,
	);

	const showControls = isActive || hovered;
	const displayMode = element.displayMode ?? false;

	const html = useMemo(
		() => renderKatexHtml(element.formula, displayMode),
		[element.formula, displayMode],
	);

	const updateKatex = useCallback(
		(patch: Partial<KatexElement>) => {
			const path = ReactEditor.findPath(editor, element);
			Transforms.setNodes(editor, patch, { at: path });
		},
		[editor, element],
	);

	const saveFormula = useCallback(() => {
		const next = draftFormula.trim();
		if (!next) return;
		updateKatex({ formula: next });
		setEditing(false);
	}, [draftFormula, updateKatex]);

	return (
		<span
			{...attributes}
			contentEditable={false}
			className="relative inline-block align-middle"
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => {
				setHovered(false);
			}}
		>
			<div
				className={cn(
					"pointer-events-none absolute inset-x-0 bottom-full z-20 flex justify-center pb-1.5 transition-opacity duration-150",
					showControls ? "opacity-100" : "opacity-0",
				)}
			>
				{/* <div
					className={cn(
						"flex items-center gap-1 rounded-lg border bg-background p-1 shadow-md",
						showControls
							? "pointer-events-auto"
							: "pointer-events-none",
					)}
					onMouseDown={(event) =>
						event.preventDefault()
					}
				>
					<Button
						type="button"
						size="sm"
						variant={
							displayMode ? "secondary" : "ghost"
						}
						className="h-7 px-2 text-xs"
						onClick={() =>
							updateKatex({ displayMode: true })
						}
					>
						Block
					</Button>
					<Button
						type="button"
						size="sm"
						variant={
							!displayMode ? "secondary" : "ghost"
						}
						className="h-7 px-2 text-xs"
						onClick={() =>
							updateKatex({ displayMode: false })
						}
					>
						Inline
					</Button>
					<Button
						type="button"
						size="sm"
						variant="ghost"
						className="size-7 p-0"
						aria-label="Edit formula"
						onClick={() => {
							setDraftFormula(element.formula);
							setEditing(true);
						}}
					>
						<Pencil className="size-3.5" />
					</Button>
				</div> */}
			</div>

			<DropdownMenu open={editing} onOpenChange={setEditing}>
				<DropdownMenuTrigger>
					<span
						onClick={() => setEditing(true)}
						className={cn(
							"inline-block rounded px-1 py-0.5 transition-shadow",
							displayMode && "block px-2 py-1 text-center",
							isActive &&
								"ring-2 ring-primary/30 ring-offset-1 ring-offset-background",
						)}
					>


						{html ? (
							<span
								className={cn(
									"katex-wrapper inline-block",
									displayMode && "mx-auto block",
								)}
								dangerouslySetInnerHTML={{
									__html: html,
								}}
							/>
						) : null}
					</span>
				</DropdownMenuTrigger>
				<DropdownMenuContent>
					<Input
						autoFocus
						value={draftFormula}
						onBlur={() => saveFormula()}
						onChange={(event) =>
							setDraftFormula(
								event.target.value,
							)
						}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								saveFormula();
							}
							if (event.key === "Escape") {
								event.preventDefault();
								setEditing(false);
								setDraftFormula(
									element.formula,
								);
							}
						}}
						className="h-8 font-mono text-xs"
						placeholder="Enter LaTeX, e.g. E = mc^2"
					/>
				</DropdownMenuContent>
			</DropdownMenu>


			<span className="hidden">{children}</span>
		</span>
	);
}
