"use client";

import { ExternalLink, Link2, Pencil, Unlink, X } from "lucide-react";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Editor, Transforms } from "slate";
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

import type { LinkElement } from "./types";
import {
  getLinkLabel,
  normalizeLinkUrl as normalizeUrl,
} from "./utils";

const POPOVER_WIDTH = 320;
const POPOVER_GAP = 4;
const HIDE_DELAY_MS = 200;
const HOVER_BRIDGE_HEIGHT = 16;

function clampPopoverPosition(position: {
  top: number;
  left: number;
}) {
  const maxLeft = Math.max(
    8,
    window.innerWidth - POPOVER_WIDTH - 8,
  );
  const minTop = 8;

  return {
    top: Math.max(minTop, position.top),
    left: Math.min(
      Math.max(8, position.left),
      maxLeft,
    ),
  };
}

export function LinkWrapper({
  attributes,
  children,
  element,
}: RenderElementProps & { element: LinkElement }) {
  const editor = useSlateStatic();
  const selected = useSelected();
  const focused = useFocused();
  const isActive = selected && focused;

  const anchorRef = useRef<HTMLAnchorElement>(null);
  const hideTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [anchorHovered, setAnchorHovered] = useState(false);
  const [popoverHovered, setPopoverHovered] =
    useState(false);
  const [editing, setEditing] = useState(false);
  const [draftUrl, setDraftUrl] = useState(element.url);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cancelHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    cancelHide();
    hideTimerRef.current = setTimeout(() => {
      setAnchorHovered(false);
      setPopoverHovered(false);
      setEditing(false);
      hideTimerRef.current = null;
    }, HIDE_DELAY_MS);
  }, [cancelHide]);

  const showPopover =
    anchorHovered || popoverHovered || isActive;

  const handleAnchorEnter = useCallback(() => {
    cancelHide();
    setAnchorHovered(true);
  }, [cancelHide]);

  const handleAnchorLeave = useCallback(() => {
    scheduleHide();
  }, [scheduleHide]);

  const handlePopoverEnter = useCallback(() => {
    cancelHide();
    setPopoverHovered(true);
  }, [cancelHide]);

  const handlePopoverLeave = useCallback(() => {
    scheduleHide();
  }, [scheduleHide]);
  const showEditing = editing && showPopover;
  const label = getLinkLabel(element.url);

  const updateUrl = useCallback(
    (url: string) => {
      const path = ReactEditor.findPath(editor, element);
      Transforms.setNodes(editor, { url }, { at: path });
    },
    [editor, element],
  );

  const removeLink = useCallback(() => {
    const path = ReactEditor.findPath(editor, element);
    Transforms.unwrapNodes(editor, {
      at: path,
      match: (n) =>
        !Editor.isEditor(n) &&
        "type" in n &&
        n.type === "link",
    });
  }, [editor, element]);

  const openLink = useCallback(() => {
    const url = normalizeUrl(element.url);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [element.url]);

  const saveUrl = useCallback(() => {
    const next = normalizeUrl(draftUrl);
    if (next) updateUrl(next);
    setEditing(false);
  }, [draftUrl, updateUrl]);

  useLayoutEffect(() => {
    return () => {
      cancelHide();
    };
  }, [cancelHide]);

  useLayoutEffect(() => {
    if (!showPopover || !anchorRef.current) {
      return;
    }

    const measure = () => {
      const anchor = anchorRef.current;
      if (!anchor) return;

      const rect = anchor.getBoundingClientRect();
      setPosition(
        clampPopoverPosition({
          top: rect.top - POPOVER_GAP,
          left: rect.left,
        }),
      );
    };

    measure();
    const frame = requestAnimationFrame(measure);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [showPopover, element.url, editing]);

  const popover =
    typeof document !== "undefined" &&
      showPopover &&
      position
      ? createPortal(
        <div
          className="fixed z-[200]"
          style={{
            top: position.top,
            left: position.left,
            transform: "translateY(-100%)",
            width: `min(${POPOVER_WIDTH}px, calc(100vw - 1rem))`,
          }}
          onMouseEnter={handlePopoverEnter}
          onMouseLeave={handlePopoverLeave}
          onMouseDown={(event) =>
            event.preventDefault()
          }
        >
          <div className="relative flex min-w-[240px] flex-col gap-2 rounded-lg border bg-popover p-2 text-popover-foreground shadow-md ring-1 ring-foreground/10">
            {showEditing ? (
              <div className="flex items-center gap-1">
                <Input
                  ref={inputRef}
                  value={draftUrl}
                  onChange={(event) =>
                    setDraftUrl(
                      event.target.value,
                    )
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key === "Enter"
                    ) {
                      event.preventDefault();
                      saveUrl();
                    }
                    if (
                      event.key === "Escape"
                    ) {
                      event.preventDefault();
                      setEditing(false);
                      setDraftUrl(
                        element.url,
                      );
                    }
                  }}
                  className="h-8 text-xs"
                  placeholder="Paste a link"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label="Cancel edit"
                  onClick={() => {
                    setEditing(false);
                    setDraftUrl(
                      element.url,
                    );
                  }}
                >
                  <X className="size-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  aria-label="Save link"
                  onClick={saveUrl}
                >
                  <Link2 className="size-3.5" />
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 px-0.5">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Link2 className="size-3.5 text-muted-foreground" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium">
                      {label}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {element.url}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 border-t pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 flex-1 justify-start gap-1.5 px-2 text-xs"
                    onClick={openLink}
                  >
                    <ExternalLink className="size-3.5" />
                    Open
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Edit link"
                    onClick={() => {
                      setDraftUrl(
                        element.url,
                      );
                      setEditing(true);
                      requestAnimationFrame(
                        () => {
                          inputRef.current?.focus();
                          inputRef.current?.select();
                        },
                      );
                    }}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Remove link"
                    onClick={removeLink}
                  >
                    <Unlink className="size-3.5" />
                  </Button>
                </div>
              </>
            )}
            <div
              aria-hidden
              className="pointer-events-auto absolute inset-x-0 top-full"
              style={{ height: HOVER_BRIDGE_HEIGHT }}
            />
          </div>
        </div>,
        document.body,
      )
      : null;

  return (
    <span
      {...attributes}
      className="relative inline"
      onMouseEnter={handleAnchorEnter}
      onMouseLeave={handleAnchorLeave}
    >
      <a
        ref={anchorRef}
        href={element.url}
        className={cn(
          "cursor-pointer text-primary underline decoration-primary/40 underline-offset-[3px] transition-colors",
          "hover:decoration-primary/70",
          isActive &&
          "rounded-sm bg-primary/10 decoration-primary/80",
        )}
        onClick={(event) => {
          window.open(element.url, "_blank", "noopener,noreferrer");
          event.preventDefault();
          event.stopPropagation();
        }}
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        {children}
      </a>
      {popover}
    </span>
  );
}
