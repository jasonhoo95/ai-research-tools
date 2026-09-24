import type { TableCellData, TableElement, TableRowData } from "./types";

export const DEFAULT_COL_WIDTH = 120;
export const DEFAULT_HEADER_HEIGHT = 44;
export const DEFAULT_BODY_HEIGHT = 72;
export const MIN_COL_WIDTH = 60;
export const MIN_ROW_HEIGHT = 32;

function createId() {
  return crypto.randomUUID();
}

export function createEmptyCell(): TableCellData {
  return {
    id: createId(),
    content: [{ type: "paragraph", children: [{ text: "" }] }],
  };
}

export function createEmptyRow(colCount: number, isHeader = false): TableRowData {
  return {
    id: createId(),
    isHeader,
    cells: Array.from({ length: colCount }, createEmptyCell),
  };
}

export function getColumnCount(table: TableElement): number {
  return table.rows[0]?.cells.length ?? 0;
}

export function getColumnWidths(table: TableElement): number[] {
  const count = getColumnCount(table);
  if (table.columnWidths?.length === count) return [...table.columnWidths];
  return Array.from({ length: count }, () => DEFAULT_COL_WIDTH);
}

export function getRowHeights(table: TableElement): number[] {
  if (table.rowHeights?.length === table.rows.length) return [...table.rowHeights];
  return table.rows.map((row) =>
    row.isHeader ? DEFAULT_HEADER_HEIGHT : DEFAULT_BODY_HEIGHT
  );
}

export function insertColumn(
  table: TableElement,
  atIndex: number
): Pick<TableElement, "rows" | "columnWidths"> {
  const widths = getColumnWidths(table);
  const referenceWidth = widths[atIndex] ?? widths[atIndex - 1] ?? DEFAULT_COL_WIDTH;
  const columnWidths = [
    ...widths.slice(0, atIndex),
    referenceWidth,
    ...widths.slice(atIndex),
  ];

  const rows = table.rows.map((row) => ({
    ...row,
    cells: [
      ...row.cells.slice(0, atIndex),
      createEmptyCell(),
      ...row.cells.slice(atIndex),
    ],
  }));

  return { rows, columnWidths };
}

export function insertRow(
  table: TableElement,
  atIndex: number
): Pick<TableElement, "rows" | "rowHeights"> {
  const colCount = getColumnCount(table);
  const heights = getRowHeights(table);
  const referenceHeight = heights[atIndex] ?? heights[atIndex - 1] ?? DEFAULT_BODY_HEIGHT;
  const rowHeights = [
    ...heights.slice(0, atIndex),
    referenceHeight,
    ...heights.slice(atIndex),
  ];

  const rows = [
    ...table.rows.slice(0, atIndex),
    createEmptyRow(colCount, false),
    ...table.rows.slice(atIndex),
  ];

  return { rows, rowHeights };
}

export function setColumnWidth(
  table: TableElement,
  colIndex: number,
  width: number
): Pick<TableElement, "columnWidths"> {
  const columnWidths = getColumnWidths(table);
  columnWidths[colIndex] = Math.max(MIN_COL_WIDTH, width);
  return { columnWidths };
}

export function setRowHeight(
  table: TableElement,
  rowIndex: number,
  height: number
): Pick<TableElement, "rowHeights"> {
  const rowHeights = getRowHeights(table);
  rowHeights[rowIndex] = Math.max(MIN_ROW_HEIGHT, height);
  return { rowHeights };
}
