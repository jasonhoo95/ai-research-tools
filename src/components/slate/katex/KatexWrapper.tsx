"use client";

import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Transforms } from "slate";
import {
	ReactEditor,
	useFocused,
	useSelected,
	useSlateStatic,
	type RenderElementProps,
} from "slate-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { KatexElement } from "./types";
import { renderKatexHtml } from "./utils";

const PANEL_WIDTH = 360;

/**
 * Floating formula editor, portalled to <body> so its textarea never
 * receives Slate's key/selection handling.
 */
function FormulaPanel({
	anchor,
	formula,
	displayMode,
	onSave,
	onCancel,
	onDelete,
}: {
	anchor: HTMLElement;
	formula: string;
	displayMode: boolean;
	onSave: (formula: string, displayMode: boolean) => void;
	onCancel: () => void;
	onDelete: () => void;
}) {
	const panelRef = useRef<HTMLDivElement>(null);
	const [draft, setDraft] = useState(formula);
	const [block, setBlock] = useState(displayMode);
	const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

	const preview = useMemo(() => renderKatexHtml(draft, block), [draft, block]);

	// Place below the formula (above if there's no room), clamped to the viewport.
	useLayoutEffect(() => {
		const place = () => {
			const rect = anchor.getBoundingClientRect();
			const height = panelRef.current?.offsetHeight ?? 220;
			const below = rect.bottom + 8;
			const top =
				below + height > window.innerHeight - 8 ? Math.max(8, rect.top - height - 8) : below;
			const left = Math.min(
				Math.max(8, rect.left + rect.width / 2 - PANEL_WIDTH / 2),
				window.innerWidth - PANEL_WIDTH - 8,
			);
			setPosition({ top, left });
		};
		place();
		window.addEventListener("resize", place);
		window.addEventListener("scroll", place, true);
		return () => {
			window.removeEventListener("resize", place);
			window.removeEventListener("scroll", place, true);
		};
	}, [anchor]);

	// Clicking outside cancels (the formula stays as it was).
	useEffect(() => {
		const onPointerDown = (event: PointerEvent) => {
			const target = event.target as Node;
			if (panelRef.current?.contains(target) || anchor.contains(target)) return;
			onCancel();
		};
		document.addEventListener("pointerdown", onPointerDown);
		return () => document.removeEventListener("pointerdown", onPointerDown);
	}, [anchor, onCancel]);

	const save = () => {
		const next = draft.trim();
		if (!next) return;
		onSave(next, block);
	};

	return createPortal(
		<div
			ref={panelRef}
			role="dialog"
			aria-label="Edit formula"
			style={{
				top: position?.top ?? -9999,
				left: position?.left ?? -9999,
				width: PANEL_WIDTH,
			}}
			className="fixed z-[200] flex flex-col gap-3 rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg"
		>
			<div className="flex items-center justify-between">
				<span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
					LaTeX
				</span>
				<div className="inline-flex rounded-md bg-muted p-0.5 text-xs">
					{[
						{ value: false, label: "Inline" },
						{ value: true, label: "Block" },
					].map((option) => (
						<button
							key={option.label}
							type="button"
							onClick={() => setBlock(option.value)}
							aria-pressed={block === option.value}
							className={cn(
								"rounded px-2 py-0.5 font-medium transition-colors",
								block === option.value
									? "bg-background text-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							{option.label}
						</button>
					))}
				</div>
			</div>

			<textarea
				autoFocus
				value={draft}
				onChange={(event) => setDraft(event.target.value)}
				onKeyDown={(event) => {
					// Enter saves; Shift+Enter adds a line for long formulas.
					if (event.key === "Enter" && !event.shiftKey) {
						event.preventDefault();
						save();
					}
					if (event.key === "Escape") {
						event.preventDefault();
						onCancel();
					}
				}}
				rows={3}
				spellCheck={false}
				placeholder="e.g. \frac{a}{b} = \sqrt{x^2 + y^2}"
				className="min-h-[72px] w-full resize-y rounded-md border bg-background px-2.5 py-2 font-mono text-xs outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
			/>

			<div className="flex min-h-12 items-center justify-center overflow-x-auto rounded-md bg-muted/50 px-3 py-2">
				{preview ? (
					<span dangerouslySetInnerHTML={{ __html: preview }} />
				) : (
					<span className="text-xs text-muted-foreground">Preview</span>
				)}
			</div>

			<div className="flex items-center justify-between">
				<Button
					type="button"
					size="sm"
					variant="ghost"
					onClick={onDelete}
					className="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
				>
					<Trash2 className="size-3.5" />
					Delete
				</Button>
				<div className="flex gap-2">
					<Button type="button" size="sm" variant="outline" onClick={onCancel}>
						Cancel
					</Button>
					<Button type="button" size="sm" onClick={save} disabled={!draft.trim()}>
						Save
					</Button>
				</div>
			</div>
		</div>,
		document.body,
	);
}

export function KatexWrapper({
	attributes,
	children,
	element,
}: RenderElementProps & { element: KatexElement }) {
	const editor = useSlateStatic();
	const selected = useSelected();
	const focused = useFocused();
	const isActive = selected && focused;

	const anchorRef = useRef<HTMLSpanElement>(null);
	const [editing, setEditing] = useState(false);

	const displayMode = element.displayMode ?? false;
	const html = useMemo(
		() => renderKatexHtml(element.formula, displayMode),
		[element.formula, displayMode],
	);

	const path = useCallback(() => ReactEditor.findPath(editor, element), [editor, element]);

	const close = useCallback(() => {
		setEditing(false);
		// Put the caret right after the formula so typing can continue.
		try {
			Transforms.select(editor, path());
			Transforms.move(editor);
			ReactEditor.focus(editor);
		} catch {
			// Node was removed meanwhile.
		}
	}, [editor, path]);

	const save = useCallback(
		(formula: string, nextDisplayMode: boolean) => {
			Transforms.setNodes(
				editor,
				{ formula, displayMode: nextDisplayMode } as Partial<KatexElement>,
				{ at: path() },
			);
			close();
		},
		[editor, path, close],
	);

	const remove = useCallback(() => {
		setEditing(false);
		Transforms.removeNodes(editor, { at: path() });
		ReactEditor.focus(editor);
	}, [editor, path]);

	return (
		<span
			{...attributes}
			contentEditable={false}
			className={cn(
				"relative align-middle",
				displayMode ? "my-2 flex justify-center" : "inline-block",
			)}
		>
			<span
				ref={anchorRef}
				role="button"
				tabIndex={0}
				title="Click to edit formula"
				onMouseDown={(event) => {
					// Keep Slate from moving the selection into the void.
					event.preventDefault();
					setEditing(true);
				}}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						setEditing(true);
					}
				}}
				className={cn(
					"cursor-pointer rounded px-1 py-0.5 transition-shadow hover:bg-muted/60",
					displayMode ? "block px-3 py-1.5" : "inline-block",
					(isActive || editing) && "ring-2 ring-primary/30 ring-offset-1 ring-offset-background",
				)}
			>
				{html ? (
					<span
						className={cn("katex-wrapper", displayMode ? "block" : "inline-block")}
						dangerouslySetInnerHTML={{ __html: html }}
					/>
				) : (
					<span className="font-mono text-xs text-muted-foreground">empty formula</span>
				)}
			</span>

			{editing && anchorRef.current ? (
				<FormulaPanel
					anchor={anchorRef.current}
					formula={element.formula}
					displayMode={displayMode}
					onSave={save}
					onCancel={close}
					onDelete={remove}
				/>
			) : null}

			{children}
		</span>
	);
}
