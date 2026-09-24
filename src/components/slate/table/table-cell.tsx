"use client";

import type { Descendant } from "slate";

import { SlateFieldEditor } from "@/components/slate/slate-field-editor";
import { cn } from "@/lib/utils";

import { TableBorderHandle } from "./table-border-handle";

export interface TableCellProps {
  value: Descendant[];
  onChange: (value: Descendant[]) => void;
  className?: string;
  isHeader?: boolean;
  minHeight?: number;
  isFirstColumn?: boolean;
  isFirstRow?: boolean;
  isLastColumn?: boolean;
  isLastRow?: boolean;
  onColumnResizeStart?: () => void;
  onColumnResizeDelta?: (delta: number) => void;
  onColumnResizeEnd?: () => void;
  onRowResizeStart?: () => void;
  onRowResizeDelta?: (delta: number) => void;
  onRowResizeEnd?: () => void;
  onInsertColumnBefore?: () => void;
  onInsertColumnAfter?: () => void;
  onInsertRowBefore?: () => void;
  onInsertRowAfter?: () => void;
}

export function TableCell({
  value,
  onChange,
  className,
  isHeader = false,
  minHeight,
  isFirstColumn = false,
  isFirstRow = false,
  isLastColumn = false,
  isLastRow = false,
  onColumnResizeStart,
  onColumnResizeDelta,
  onColumnResizeEnd,
  onRowResizeStart,
  onRowResizeDelta,
  onRowResizeEnd,
  onInsertColumnBefore,
  onInsertColumnAfter,
  onInsertRowBefore,
  onInsertRowAfter,
}: TableCellProps) {
  const CellTag = isHeader ? "th" : "td";

  return (
    <CellTag
      contentEditable={false}
      className={cn(
        "relative min-w-0 border border-border align-top p-0",
        isHeader && "border-black/20 bg-black text-white",
        className
      )}
      style={minHeight ? { height: minHeight } : undefined}
    >
      {isFirstColumn && onColumnResizeDelta && onColumnResizeEnd && onInsertColumnBefore ? (
        <TableBorderHandle
          orientation="vertical"
          edge="start"
          resizeEnabled={false}
          onResizeStart={onColumnResizeStart}
          onResizeDelta={onColumnResizeDelta}
          onResizeEnd={onColumnResizeEnd}
          onInsert={onInsertColumnBefore}
        />
      ) : null}

      {onColumnResizeDelta && onColumnResizeEnd && onInsertColumnAfter ? (
        <TableBorderHandle
          orientation="vertical"
          edge="end"
          onResizeStart={onColumnResizeStart}
          onResizeDelta={onColumnResizeDelta}
          onResizeEnd={onColumnResizeEnd}
          onInsert={onInsertColumnAfter}
        />
      ) : null}

      {isFirstRow && onRowResizeDelta && onRowResizeEnd && onInsertRowBefore ? (
        <TableBorderHandle
          orientation="horizontal"
          edge="start"
          resizeEnabled={false}
          onResizeStart={onRowResizeStart}
          onResizeDelta={onRowResizeDelta}
          onResizeEnd={onRowResizeEnd}
          onInsert={onInsertRowBefore}
        />
      ) : null}

      {onRowResizeDelta && onRowResizeEnd && onInsertRowAfter ? (
        <TableBorderHandle
          orientation="horizontal"
          edge="end"
          onResizeStart={onRowResizeStart}
          onResizeDelta={onRowResizeDelta}
          onResizeEnd={onRowResizeEnd}
          onInsert={onInsertRowAfter}
        />
      ) : null}

      <div
        data-table-cell-editor
        className="h-full min-h-0"
        style={minHeight ? { minHeight: minHeight - 2 } : undefined}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <SlateFieldEditor
          value={value}
          onChange={onChange}
          showToolbar={false}
          controlledBackwardDelete
          placeholder={isHeader ? "Header…" : "Cell…"}
          editableClassName={cn(
            "prose prose-sm max-w-none px-2 py-1.5 outline-none h-full",
            isHeader
              ? "min-h-[40px] text-white prose-invert [&_*]:text-white"
              : "min-h-[68px]"
          )}
          className="h-full rounded-none border-0 bg-transparent shadow-none"
        />
      </div>
    </CellTag>
  );
}
