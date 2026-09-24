"use client";

import { useCallback, useRef, useState } from "react";
import { Editor, Transforms, type Descendant } from "slate";
import { HistoryEditor } from "slate-history";
import {
  ReactEditor,
  useSlateStatic,
  type RenderElementProps,
} from "slate-react";

import { cn } from "@/lib/utils";

import {
  getColumnCount,
  getColumnWidths,
  getRowHeights,
  insertColumn,
  insertRow,
  MIN_COL_WIDTH,
  MIN_ROW_HEIGHT,
} from "./mutations";
import { TableCell } from "./table-cell";
import { TableRow } from "./table-row";
import type { TableElement } from "./types";

type ResizeSession = {
  columnWidths: number[];
  rowHeights: number[];
  colIndex?: number;
  rowIndex?: number;
};

export function Table({
  attributes,
  children,
  element,
}: RenderElementProps & { element: TableElement }) {
  const editor = useSlateStatic();
  const [preview, setPreview] = useState<{
    columnWidths?: number[];
    rowHeights?: number[];
  } | null>(null);
  const previewRef = useRef<typeof preview>(null);
  const resizeSessionRef = useRef<ResizeSession | null>(null);

  const columnWidths = preview?.columnWidths ?? getColumnWidths(element);
  const rowHeights = preview?.rowHeights ?? getRowHeights(element);
  const colCount = getColumnCount(element);

  const getCurrentTable = useCallback(
    (): TableElement => ({
      ...element,
      columnWidths,
      rowHeights,
    }),
    [columnWidths, element, rowHeights]
  );

  const updateTable = useCallback(
    (patch: Partial<TableElement>) => {
      const path = ReactEditor.findPath(editor, element);
      Transforms.setNodes(editor, patch, { at: path });
    },
    [editor, element]
  );

  const handleCellChange = useCallback(
    (rowIndex: number, cellIndex: number, content: Descendant[]) => {
      const path = ReactEditor.findPath(editor, element);
      const newRows = element.rows.map((row, ri) =>
        ri !== rowIndex
          ? row
          : {
            ...row,
            cells: row.cells.map((cell, ci) =>
              ci !== cellIndex ? cell : { ...cell, content }
            ),
          }
      );

      HistoryEditor.withoutSaving(editor, () => {
        Transforms.setNodes(editor, { rows: newRows }, { at: path });
      });
    },
    [editor, element]
  );

  const selectTable = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest("[data-table-cell-editor]")
    ) {
      return;
    }

    const path = ReactEditor.findPath(editor, element);
    Transforms.select(editor, Editor.range(editor, path));
  }, [editor, element]);

  const beginColumnResize = useCallback(
    (colIndex: number) => {
      resizeSessionRef.current = {
        columnWidths:
          previewRef.current?.columnWidths ?? getColumnWidths(element),
        rowHeights: previewRef.current?.rowHeights ?? getRowHeights(element),
        colIndex,
      };
    },
    [element]
  );

  const beginRowResize = useCallback(
    (rowIndex: number) => {
      resizeSessionRef.current = {
        columnWidths:
          previewRef.current?.columnWidths ?? getColumnWidths(element),
        rowHeights: previewRef.current?.rowHeights ?? getRowHeights(element),
        rowIndex,
      };
    },
    [element]
  );

  const handleColumnResizeDelta = useCallback(
    (colIndex: number, delta: number) => {
      const session = resizeSessionRef.current;
      if (!session || session.colIndex !== colIndex) return;

      const nextWidths = [...session.columnWidths];
      nextWidths[colIndex] = Math.max(
        MIN_COL_WIDTH,
        session.columnWidths[colIndex] + delta
      );

      const nextPreview = {
        columnWidths: nextWidths,
        rowHeights: previewRef.current?.rowHeights ?? session.rowHeights,
      };
      previewRef.current = nextPreview;
      setPreview(nextPreview);
    },
    []
  );

  const handleRowResizeDelta = useCallback(
    (rowIndex: number, delta: number) => {
      const session = resizeSessionRef.current;
      if (!session || session.rowIndex !== rowIndex) return;

      const nextHeights = [...session.rowHeights];
      nextHeights[rowIndex] = Math.max(
        MIN_ROW_HEIGHT,
        session.rowHeights[rowIndex] + delta
      );

      const nextPreview = {
        columnWidths:
          previewRef.current?.columnWidths ?? session.columnWidths,
        rowHeights: nextHeights,
      };
      previewRef.current = nextPreview;
      setPreview(nextPreview);
    },
    []
  );

  const commitPreview = useCallback(() => {
    const currentPreview = previewRef.current;
    if (currentPreview) {
      updateTable({
        ...(currentPreview.columnWidths
          ? { columnWidths: currentPreview.columnWidths }
          : {}),
        ...(currentPreview.rowHeights
          ? { rowHeights: currentPreview.rowHeights }
          : {}),
      });
      previewRef.current = null;
      setPreview(null);
    }
    resizeSessionRef.current = null;
  }, [updateTable]);

  const insertColumnAt = useCallback(
    (atIndex: number) => {
      previewRef.current = null;
      setPreview(null);
      resizeSessionRef.current = null;
      updateTable(insertColumn(getCurrentTable(), atIndex));
    },
    [getCurrentTable, updateTable]
  );

  const insertRowAt = useCallback(
    (atIndex: number) => {
      previewRef.current = null;
      setPreview(null);
      resizeSessionRef.current = null;
      updateTable(insertRow(getCurrentTable(), atIndex));
    },
    [getCurrentTable, updateTable]
  );

  const indexedRows = element.rows.map((row, rowIndex) => ({ row, rowIndex }));
  const headerRows = indexedRows.filter(({ row }) => row.isHeader);
  const bodyRows = indexedRows.filter(({ row }) => !row.isHeader);

  function renderRow(row: (typeof element.rows)[number], rowIndex: number) {
    const isFirstRow = rowIndex === 0;
    const isLastRow = rowIndex === element.rows.length - 1;

    return (
      <TableRow key={row.id}>
        {row.cells.map((cell, cellIndex) => (
          <TableCell
            key={cell.id}
            isHeader={row.isHeader}
            value={cell.content}
            minHeight={rowHeights[rowIndex]}
            isFirstColumn={cellIndex === 0}
            isFirstRow={isFirstRow}
            isLastColumn={cellIndex === colCount - 1}
            isLastRow={isLastRow}
            onChange={(content) =>
              handleCellChange(rowIndex, cellIndex, content)
            }
            onInsertColumnBefore={() => insertColumnAt(cellIndex)}
            onInsertColumnAfter={() => insertColumnAt(cellIndex + 1)}
            onInsertRowBefore={() => insertRowAt(rowIndex)}
            onInsertRowAfter={() => insertRowAt(rowIndex + 1)}
            onColumnResizeStart={() => beginColumnResize(cellIndex)}
            onColumnResizeDelta={(delta) =>
              handleColumnResizeDelta(cellIndex, delta)
            }
            onColumnResizeEnd={commitPreview}
            onRowResizeStart={() => beginRowResize(rowIndex)}
            onRowResizeDelta={(delta) => handleRowResizeDelta(rowIndex, delta)}
            onRowResizeEnd={commitPreview}
          />
        ))}
      </TableRow>
    );
  }

  return (
    <div
      {...attributes}
      contentEditable={false}
      className={cn("my-4 overflow-x-auto overflow-y-hidden")}
      onClick={selectTable}
    >
      <table
        className="table-fixed border-collapse text-sm"
        style={{ width: columnWidths.reduce((total, width) => total + width, 0) }}
      >
        <colgroup>
          {columnWidths.map((width, index) => (
            <col key={index} style={{ width }} />
          ))}
        </colgroup>
        {headerRows.length > 0 ? (
          <thead>
            {headerRows.map(({ row, rowIndex }) => renderRow(row, rowIndex))}
          </thead>
        ) : null}
        <tbody>
          {bodyRows.map(({ row, rowIndex }) => renderRow(row, rowIndex))}
        </tbody>
      </table>
      {children}
    </div>
  );
}
