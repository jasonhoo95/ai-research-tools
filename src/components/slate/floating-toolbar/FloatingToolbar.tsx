"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bold, Link2, Palette } from "lucide-react";
import { Range, type Range as SlateRange } from "slate";
import {
	ReactEditor,
	useFocused,
	useSlate,
} from "slate-react";

import { Button } from "@/components/ui/button";
import {
	getActiveTextColor,
	isMarkActive,
	setTextColor,
	toggleMark,
} from "@/components/slate/editor-commands";
import {
	insertLinkAtSelection,
	LinkInputPanel,
} from "@/components/slate/link";
import { cn } from "@/lib/utils";

import {
	TEXT_COLOR_OPTIONS,
	type TextColor,
} from "./types";
import {
	getFloatingToolbarPosition,
	getFloatingToolbarPositionForRange,
} from "./utils";

export function FloatingToolbar() {
	const editor = useSlate();
	const focused = useFocused();
	const { selection } = editor;

	const savedSelectionRef = useRef<SlateRange | null>(
		null,
	);
	const [position, setPosition] = useState<{
		top: number;
		left: number;
	} | null>(null);
	const [showLinkInput, setShowLinkInput] = useState(false);
	const [showColors, setShowColors] = useState(false);

	const hasSelection =
		Boolean(selection) &&
		!Range.isCollapsed(selection!);

	const isToolbarOpen =
		(focused && hasSelection) || showLinkInput;

	useLayoutEffect(() => {
		if (showLinkInput && savedSelectionRef.current) {
			const next = getFloatingToolbarPositionForRange(
				editor,
				savedSelectionRef.current,
			);
			setPosition(next);
			return;
		}

		if (!focused || !hasSelection) {
			if (!showLinkInput) {
				setPosition(null);
				setShowColors(false);
			}
			return;
		}

		const measure = () => {
			const next = getFloatingToolbarPosition(editor);
			setPosition(next);
		};

		measure();
		const frame = requestAnimationFrame(measure);
		return () => cancelAnimationFrame(frame);
	}, [
		editor,
		focused,
		hasSelection,
		showLinkInput,
		selection,
	]);

	if (
		typeof document === "undefined" ||
		!isToolbarOpen ||
		!position
	) {
		return null;
	}

	const activeColor = getActiveTextColor(editor);
	const boldActive = isMarkActive(editor, "bold");

	const openLinkInput = () => {
		savedSelectionRef.current = editor.selection;
		setShowLinkInput(true);
		setShowColors(false);
	};

	const closeLinkInput = () => {
		setShowLinkInput(false);
		savedSelectionRef.current = null;
	};

	const applyLink = (url: string) => {
		insertLinkAtSelection(
			editor,
			url,
			savedSelectionRef.current,
		);
		closeLinkInput();
		ReactEditor.focus(editor);
	};

	return createPortal(
		<div
			className="fixed z-[200]"
			style={{
				top: position.top,
				left: position.left,
				transform: "translate(-50%, -100%)",
			}}
			onMouseDown={(event) => event.preventDefault()}
		>
			<div className="overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl ring-1 ring-foreground/10">
				{showLinkInput ? (
					<LinkInputPanel
						onSubmit={applyLink}
						onCancel={closeLinkInput}
					/>
				) : (
					<div className="flex items-center gap-0.5 p-1">
						<Button
							type="button"
							size="sm"
							variant={
								boldActive ? "secondary" : "ghost"
							}
							className="size-8 p-0"
							aria-label="Bold"
							onClick={() =>
								toggleMark(editor, "bold")
							}
						>
							<Bold className="size-4" />
						</Button>

						<div className="relative">
							<Button
								type="button"
								size="sm"
								variant={
									showColors
										? "secondary"
										: "ghost"
								}
								className="size-8 p-0"
								aria-label="Text color"
								onClick={() =>
									setShowColors(
										(current) => !current,
									)
								}
							>
								<Palette className="size-4" />
							</Button>

							{showColors ? (
								<div className="absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-lg border bg-popover p-1.5 shadow-md">
									<div className="flex items-center gap-1">
										{TEXT_COLOR_OPTIONS.map(
											(option) => (
												<button
													key={
														option.value
													}
													type="button"
													title={
														option.label
													}
													aria-label={
														option.label
													}
													onClick={() => {
														setTextColor(
															editor,
															option.value as TextColor,
														);
														setShowColors(
															false,
														);
														ReactEditor.focus(
															editor,
														);
													}}
													className={cn(
														"flex size-7 items-center justify-center rounded-md transition-transform hover:scale-110",
														activeColor ===
															option.value &&
															"ring-2 ring-primary ring-offset-1",
													)}
												>
													<span
														className={cn(
															"size-4 rounded-full border border-border/50",
															option.swatch,
															option.value ===
																"default" &&
																"bg-background",
														)}
													/>
												</button>
											),
										)}
									</div>
								</div>
							) : null}
						</div>

						<Button
							type="button"
							size="sm"
							variant="ghost"
							className="size-8 p-0"
							aria-label="Insert link"
							onClick={openLinkInput}
						>
							<Link2 className="size-4" />
						</Button>
					</div>
				)}
			</div>
		</div>,
		document.body,
	);
}
