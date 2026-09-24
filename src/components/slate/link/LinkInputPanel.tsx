"use client";

import { Link2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { normalizeLinkUrl } from "./utils";

interface LinkInputPanelProps {
	initialUrl?: string;
	placeholder?: string;
	onSubmit: (url: string) => void;
	onCancel: () => void;
}

export function LinkInputPanel({
	initialUrl = "",
	placeholder = "Paste a link",
	onSubmit,
	onCancel,
}: LinkInputPanelProps) {
	const [draftUrl, setDraftUrl] = useState(initialUrl);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		inputRef.current?.focus();
		inputRef.current?.select();
	}, []);

	const submit = () => {
		const url = normalizeLinkUrl(draftUrl);
		if (!url) return;
		onSubmit(url);
	};

	return (
		<div className="flex items-center gap-1 p-1.5">
			<Input
				ref={inputRef}
				value={draftUrl}
				onChange={(event) =>
					setDraftUrl(event.target.value)
				}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						submit();
					}
					if (event.key === "Escape") {
						event.preventDefault();
						onCancel();
					}
				}}
				className="h-8 w-56 text-xs"
				placeholder={placeholder}
			/>
			<Button
				type="button"
				size="sm"
				variant="ghost"
				className="size-8 p-0"
				aria-label="Cancel"
				onClick={onCancel}
			>
				<X className="size-3.5" />
			</Button>
			<Button
				type="button"
				size="sm"
				className="h-8 px-2"
				aria-label="Insert link"
				onClick={submit}
			>
				<Link2 className="size-3.5" />
			</Button>
		</div>
	);
}
