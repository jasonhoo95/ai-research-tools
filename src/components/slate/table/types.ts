import type { Descendant } from "slate";

export type TableCellData = {
  id: string;
  content: Descendant[];
};

export type TableRowData = {
  id: string;
  isHeader?: boolean;
  cells: TableCellData[];
};

export type TableElement = {
  type: "table";
  rows: TableRowData[];
  columnWidths?: number[];
  rowHeights?: number[];
  children: [{ text: "" }];
};
