import type { TableElement } from "./types";
import {
  createEmptyRow,
  DEFAULT_BODY_HEIGHT,
  DEFAULT_COL_WIDTH,
  DEFAULT_HEADER_HEIGHT,
} from "./mutations";

export { createEmptyCell, createEmptyRow } from "./mutations";

export function createDefaultTable(
  bodyRowCount = 2,
  colCount = 2
): TableElement {
  const rows = [
    createEmptyRow(colCount, true),
    ...Array.from({ length: bodyRowCount }, () => createEmptyRow(colCount)),
  ];

  return {
    type: "table",
    rows,
    columnWidths: Array.from({ length: colCount }, () => DEFAULT_COL_WIDTH),
    rowHeights: [
      DEFAULT_HEADER_HEIGHT,
      ...Array.from({ length: bodyRowCount }, () => DEFAULT_BODY_HEIGHT),
    ],
    children: [{ text: "" }],
  };
}
