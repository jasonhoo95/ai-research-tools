"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ImageOff,
  Loader2,
  Pencil,
  Trash2,
} from "lucide-react";
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
import { chooseImageFile, uploadEditorImage } from "./upload";

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

type Corner = "left" | "right";

function ResizeHandle({
  corner,
  onResizeStart,
}: {
  corner: Corner;
  onResizeStart: (event: React.PointerEvent, corner: Corner) => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize image"
      onPointerDown={(event) => onResizeStart(event, corner)}
      className={cn(
        "absolute bottom-0 z-30 flex size-6 touch-none select-none items-end p-1",
        corner === "right"
          ? "right-0 cursor-nwse-resize justify-end"
          : "left-0 cursor-nesw-resize justify-start"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none block size-3 border-b-2 border-primary",
          corner === "right" ? "border-r-2" : "border-l-2"
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
  const [resizing, setResizing] = useState(false);
  const [previewWidth, setPreviewWidth] = useState<number | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const align = element.align ?? DEFAULT_IMAGE_ALIGN;
  const displayWidth = previewWidth ?? element.width;
  const uploading = Boolean(element.uploadId) || replacing;
  const broken = failedUrl === element.url;
  const showControls = (isActive || hovered || resizing) && !element.uploadId;

  const updateImage = useCallback(
    (patch: Partial<ImageElement>) => {
      const path = ReactEditor.findPath(editor, element);
      Transforms.setNodes(editor, patch, { at: path });
    },
    [editor, element]
  );

  const selectImage = useCallback(() => {
    const path = ReactEditor.findPath(editor, element);
    Transforms.select(editor, path);
    ReactEditor.focus(editor);
  }, [editor, element]);

  const replaceImage = useCallback(async () => {
    const file = await chooseImageFile();
    if (!file) return;
    setReplacing(true);
    try {
      const url = await uploadEditorImage(file);
      // Keep width/alignment; only swap the source.
      updateImage({ url, alt: file.name });
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Could not upload this image."
      );
    } finally {
      setReplacing(false);
    }
  }, [updateImage]);

  const removeImage = useCallback(() => {
    const path = ReactEditor.findPath(editor, element);
    Transforms.removeNodes(editor, { at: path });
  }, [editor, element]);

  const startResize = useCallback(
    (event: React.PointerEvent, corner: Corner) => {
      event.preventDefault();
      event.stopPropagation();

      const handle = event.currentTarget as HTMLElement;
      handle.setPointerCapture(event.pointerId);

      const startX = event.clientX;
      const startWidth =
        figureRef.current?.getBoundingClientRect().width ??
        element.width ??
        MIN_IMAGE_WIDTH;
      const maxWidth = Math.min(
        wrapperRef.current?.parentElement?.clientWidth ?? MAX_IMAGE_WIDTH,
        MAX_IMAGE_WIDTH
      );
      // Centered images grow on both sides, so double the drag distance to
      // keep the handle under the pointer; the left handle drags the other way.
      const factor = (align === "center" ? 2 : 1) * (corner === "left" ? -1 : 1);
      let latest = Math.round(startWidth);

      setResizing(true);

      const onMove = (moveEvent: PointerEvent) => {
        const delta = (moveEvent.clientX - startX) * factor;
        latest = Math.max(
          MIN_IMAGE_WIDTH,
          Math.min(maxWidth, Math.round(startWidth + delta))
        );
        setPreviewWidth(latest);
      };

      const onUp = () => {
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setResizing(false);
        setPreviewWidth(null);
        if (latest !== element.width) updateImage({ width: latest });
      };

      document.body.style.cursor =
        corner === "right" ? "nwse-resize" : "nesw-resize";
      document.body.style.userSelect = "none";
      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
    },
    [align, element.width, updateImage]
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
        {/* Alignment toolbar above the image */}
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
          <div aria-hidden className="absolute inset-x-0 bottom-full h-12" />
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
            onMouseDown={(event) => {
              // Clicking the image selects it so the controls stay visible.
              if ((event.target as HTMLElement).closest("button,[role=separator]")) return;
              event.preventDefault();
              selectImage();
            }}
            className={cn(
              "relative overflow-hidden rounded-lg border border-transparent bg-muted/10 transition-[border-color,box-shadow] cursor-default",
              showControls && "border-border/70",
              (isActive || resizing) && "border-primary/40 ring-2 ring-primary/20"
            )}
          >
            {broken ? (
              <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-muted text-sm text-muted-foreground">
                <ImageOff className="size-6" />
                Image unavailable
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={replaceImage}
                >
                  Replace image
                </Button>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={element.url}
                alt={element.alt ?? ""}
                onError={() => setFailedUrl(element.url)}
                className={cn(
                  "block h-auto w-full select-none",
                  uploading && "opacity-60"
                )}
                draggable={false}
              />
            )}

            {uploading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium shadow-sm">
                  <Loader2 className="size-3.5 animate-spin" />
                  Uploading…
                </span>
              </div>
            ) : null}

            {showControls && !broken ? (
              <div
                className="absolute right-2 top-2 z-30 flex gap-1"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  title="Change image"
                  aria-label="Change image"
                  disabled={uploading}
                  className="size-8 bg-background/90 shadow-sm backdrop-blur hover:bg-background"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={replaceImage}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  title="Remove image"
                  aria-label="Remove image"
                  className="size-8 bg-background/90 shadow-sm backdrop-blur hover:bg-background"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={removeImage}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ) : null}

            {showControls && !broken ? (
              <>
                <ResizeHandle corner="left" onResizeStart={startResize} />
                <ResizeHandle corner="right" onResizeStart={startResize} />
              </>
            ) : null}

            {resizing && displayWidth ? (
              <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] tabular-nums text-white">
                {displayWidth}px
              </span>
            ) : null}
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
