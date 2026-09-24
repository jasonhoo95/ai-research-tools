"use client";

import { ExternalLink, Frame, Pencil } from "lucide-react";
import { useCallback, useState } from "react";
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

import type { EmbedElement } from "./types";
import { DEFAULT_EMBED_HEIGHT } from "./types";
import {
	getEmbedLabel,
	normalizeEmbedUrl,
} from "./utils";

export function EmbedWrapper({
	attributes,
	children,
	element,
}: RenderElementProps & { element: EmbedElement }) {
	const editor = useSlateStatic();
	const selected = useSelected();
	const focused = useFocused();
	const isActive = selected && focused;

	const [hovered, setHovered] = useState(false);
	const [editing, setEditing] = useState(false);
	const [draftUrl, setDraftUrl] = useState(element.url);

	const showControls = isActive || hovered;
	const height = element.height ?? DEFAULT_EMBED_HEIGHT;
	const label = getEmbedLabel(element.url);

	const updateEmbed = useCallback(
		(patch: Partial<EmbedElement>) => {
			const path = ReactEditor.findPath(editor, element);
			Transforms.setNodes(editor, patch, { at: path });
		},
		[editor, element],
	);

	const saveUrl = useCallback(() => {
		const next = normalizeEmbedUrl(draftUrl);
		if (!next) return;
		updateEmbed({ url: next, title: getEmbedLabel(next) });
		setEditing(false);
	}, [draftUrl, updateEmbed]);

	const openEmbed = useCallback(() => {
		if (!element.url) return;
		window.open(element.url, "_blank", "noopener,noreferrer");
	}, [element.url]);

	return (
		<div
			{...attributes}
			contentEditable={false}
			className="relative my-4"
			onMouseEnter={() => setHovered(true)}
			onMouseLeave={() => {
				setHovered(false);
				setEditing(false);
			}}
		>
			<div
				className={cn(
					"pointer-events-none absolute inset-x-0 bottom-full z-20 flex justify-center pb-1.5 transition-opacity duration-150",
					showControls ? "opacity-100" : "opacity-0",
				)}
			>
				<div
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
						variant="ghost"
						className="h-7 gap-1.5 px-2 text-xs"
						onClick={openEmbed}
					>
						<ExternalLink className="size-3.5" />
						Open
					</Button>
					<Button
						type="button"
						size="sm"
						variant="ghost"
						className="size-7 p-0"
						aria-label="Edit embed URL"
						onClick={() => {
							setDraftUrl(element.url);
							setEditing(true);
						}}
					>
						<Pencil className="size-3.5" />
					</Button>
				</div>
			</div>

			<figure
				className={cn(
					"overflow-hidden rounded-xl border bg-muted/10 transition-shadow",
					isActive &&
						"ring-2 ring-primary/30 ring-offset-2 ring-offset-background",
				)}
			>
				{editing ? (
					<div
						className="flex items-center gap-2 border-b bg-background p-3"
						onMouseDown={(event) =>
							event.preventDefault()
						}
					>
						<Frame className="size-4 shrink-0 text-muted-foreground" />
						<Input
							autoFocus
							value={draftUrl}
							onChange={(event) =>
								setDraftUrl(event.target.value)
							}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault();
									saveUrl();
								}
								if (event.key === "Escape") {
									event.preventDefault();
									setEditing(false);
									setDraftUrl(element.url);
								}
							}}
							className="h-8 text-xs"
							placeholder="Paste embed URL or iframe src"
						/>
						<Button
							type="button"
							size="sm"
							onClick={saveUrl}
						>
							Save
						</Button>
					</div>
				) : (
					<div className="flex items-center gap-2 border-b bg-background/80 px-3 py-2 text-xs text-muted-foreground">
						<Frame className="size-3.5" />
						<span className="truncate">{label}</span>
					</div>
				)}

				{element.url ? (
					<iframe
						src={element.url}
						title={element.title ?? label}
						className="block w-full border-0 bg-black/5"
						style={{ height }}
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
						allowFullScreen
						loading="lazy"
						referrerPolicy="strict-origin-when-cross-origin"
					/>
				) : (
					<div
						className="flex items-center justify-center bg-muted/20 text-sm text-muted-foreground"
						style={{ height }}
					>
						Add an embed URL to preview content
					</div>
				)}
			</figure>
			<span className="hidden">{children}</span>
		</div>
	);
}
