"use client";

import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import { useCallback, useRef, useState } from "react";
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

import type { ImageAlign, ImageElement } from "./types";
import { DEFAULT_IMAGE_ALIGN, MAX_IMAGE_WIDTH, MIN_IMAGE_WIDTH } from "./types";

const ALIGN_OPTIONS: {
  value: ImageAlign;
  label: string;
  icon: typeof AlignLeft;
}[] = [
  { value: "left", label: "Align left", icon: AlignLeft },
  { value: "center", label: "Align center", icon: AlignCenter },
  { value: "right", label: "Align right", icon: AlignRight },
];

function alignContainerClass(align: ImageAlign) {
  switch (align) {
    case "left":
      return "justify-start";
    case "right":
      return "justify-end";
    default:
      return "justify-center";
  }
}

function captionClass(align: ImageAlign) {
  switch (align) {
    case "left":
      return "text-left";
    case "right":
      return "text-right";
    default:
      return "text-center";
  }
}

function ResizeHandle({
  onResizeStart,
}: {
  onResizeStart: (event: React.MouseEvent) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={-1}
      aria-label="Resize image"
      onMouseDown={onResizeStart}
      className={cn(
        "absolute bottom-0 right-0 z-30 h-5 w-5 cursor-nwse-resize",
        "touch-none select-none"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-1.5 right-1.5 block h-3 w-3",
          "border-b-2 border-r-2 border-primary"
        )}
      />
    </div>
  );
}

export function ImageWrapper({
  attributes,
  children,
  element,
}: RenderElementProps & { element: ImageElement }) {
  const editor = useSlateStatic();
  const selected = useSelected();
  const focused = useFocused();
  const isActive = selected && focused;

  const wrapperRef = useRef<HTMLDivElement>(null);
  const figureRef = useRef<HTMLElement>(null);
  const [hovered, setHovered] = useState(false);
  const [previewWidth, setPreviewWidth] = useState<number | null>(null);

  const align = element.align ?? DEFAULT_IMAGE_ALIGN;
  const displayWidth = previewWidth ?? element.width;
  const showControls = isActive || hovered;

  const updateImage = useCallback(
    (patch: Partial<ImageElement>) => {
      const path = ReactEditor.findPath(editor, element);
      Transforms.setNodes(editor, patch, { at: path });
    },
    [editor, element]
  );

  const startResize = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startWidth =
        figureRef.current?.getBoundingClientRect().width ??
        element.width ??
        MIN_IMAGE_WIDTH;
      const maxWidth =
        wrapperRef.current?.parentElement?.clientWidth ?? MAX_IMAGE_WIDTH;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const next = Math.max(
          MIN_IMAGE_WIDTH,
          Math.min(maxWidth, Math.round(startWidth + delta))
        );
        setPreviewWidth(next);
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";

        setPreviewWidth((current) => {
          if (current !== null) {
            updateImage({ width: current });
          }
          return null;
        });
      };

      document.body.style.cursor = "nwse-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [element.width, updateImage]
  );

  return (
    <div
      {...attributes}
      contentEditable={false}
      className={cn("my-4 flex w-full", alignContainerClass(align))}
    >
      <div
        ref={wrapperRef}
        className="relative max-w-full"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-full z-20 flex justify-center pb-1 transition-opacity duration-150",
            showControls ? "opacity-100" : "opacity-0"
          )}
        >
          <div
            className={cn(
              "flex items-center gap-0.5 rounded-lg border bg-background p-1 shadow-md",
              showControls ? "pointer-events-auto" : "pointer-events-none"
            )}
            onMouseDown={(event) => event.stopPropagation()}
          >
            {ALIGN_OPTIONS.map(({ value, label, icon: Icon }) => (
              <Button
                key={value}
                type="button"
                title={label}
                variant={align === value ? "secondary" : "ghost"}
                size="sm"
                aria-label={label}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => updateImage({ align: value })}
              >
                <Icon className="size-4" />
              </Button>
            ))}
          </div>
        </div>

        {showControls ? (
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-full h-12"
          />
        ) : null}

        <figure
          ref={figureRef}
          className="relative max-w-full"
          style={
            displayWidth
              ? { width: `${displayWidth}px` }
              : { width: "min(100%, 720px)" }
          }
        >
          <div
            className={cn(
              "relative overflow-hidden rounded-lg border border-transparent bg-muted/10 transition-all cursor-default",
              showControls && "border-border/70",
              isActive && "border-primary/40 ring-2 ring-primary/20"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={element.url}
              alt={element.alt ?? ""}
              className="block h-auto w-full select-none"
              draggable={false}
            />

            {showControls ? <ResizeHandle onResizeStart={startResize} /> : null}
          </div>

          {element.caption ? (
            <figcaption
              className={cn(
                "mt-2 px-1 text-sm text-muted-foreground",
                captionClass(align)
              )}
            >
              {element.caption}
            </figcaption>
          ) : null}
        </figure>
      </div>
      <span className="hidden">{children}</span>
    </div>
  );
}
