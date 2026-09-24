"use client";

import { useCallback, useState } from "react";

import { cn } from "@/lib/utils";

type Orientation = "vertical" | "horizontal";

export interface TableBorderHandleProps {
  orientation: Orientation;
  edge: "start" | "end";
  onResizeStart?: () => void;
  onResizeDelta: (delta: number) => void;
  onResizeEnd: () => void;
  onInsert: () => void;
  resizeEnabled?: boolean;
  className?: string;
}

export function TableBorderHandle({
  orientation,
  edge,
  onResizeStart,
  onResizeDelta,
  onResizeEnd,
  onInsert,
  resizeEnabled = true,
  className,
}: TableBorderHandleProps) {
  const [hovered, setHovered] = useState(false);

  const isVertical = orientation === "vertical";

  const startResize = useCallback(
    (event: React.MouseEvent) => {
      if (event.button !== 0 || !resizeEnabled) return;
      event.preventDefault();
      event.stopPropagation();
      onResizeStart?.();

      const startPos = isVertical ? event.clientX : event.clientY;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const current = isVertical ? moveEvent.clientX : moveEvent.clientY;
        const delta = current - startPos;
        onResizeDelta(delta);
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        onResizeEnd();
      };

      document.body.style.cursor = isVertical ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [isVertical, onResizeDelta, onResizeEnd, onResizeStart, resizeEnabled]
  );

  const handleInsert = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onInsert();
  };

  return (
    <div
      className={cn(
        "group/handle absolute z-20",
        isVertical
          ? cn(
              "top-0 bottom-0 w-3",
              resizeEnabled ? "cursor-col-resize" : "cursor-default",
              edge === "start" ? "left-0 -translate-x-1/2" : "right-0 translate-x-1/2"
            )
          : cn(
              "left-0 right-0 h-3",
              resizeEnabled ? "cursor-row-resize" : "cursor-default",
              edge === "start" ? "top-0 -translate-y-1/2" : "bottom-0 translate-y-1/2"
            ),
        className
      )}
      onMouseDown={startResize}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        aria-label={isVertical ? "Insert column" : "Insert row"}
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={handleInsert}
        className={cn(
          "absolute left-1/2 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-all",
          "opacity-0 scale-75 group-hover/handle:opacity-100 group-hover/handle:scale-100",
          hovered && "opacity-100 scale-100",
        )}
      >
        <span className="h-2 w-2 rounded-full bg-primary shadow-sm ring-2 ring-background transition-transform hover:scale-125" />
      </button>
    </div>
  );
}
