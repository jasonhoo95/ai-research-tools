import {
  Editor,
  Element as SlateElement,
  Range,
  type BaseEditor,
} from "slate";
import type { HistoryEditor } from "slate-history";
import { ReactEditor, type ReactEditor as ReactEditorType } from "slate-react";

import type { SlashCommandContext } from "@/components/slate/slash-command/commands";

type SlashEditor = BaseEditor & ReactEditorType & HistoryEditor;

export function getSlashCommandContext(
  editor: SlashEditor
): SlashCommandContext | null {
  const { selection } = editor;
  if (!selection || !Range.isCollapsed(selection)) return null;

  const blockEntry = Editor.above(editor, {
    match: (n) =>
      !Editor.isEditor(n) &&
      SlateElement.isElement(n) &&
      Editor.isBlock(editor, n),
    mode: "lowest",
  });

  if (!blockEntry) return null;

  const [, blockPath] = blockEntry;
  const start = Editor.start(editor, blockPath);
  const beforeRange = { anchor: start, focus: selection.anchor };
  const beforeText = Editor.string(editor, beforeRange);
  const match = beforeText.match(/(\/[^\s]*)$/);

  if (!match?.[1]) return null;

  const token = match[1];
  // Walk back from the caret over the token itself. Counting forward from the
  // block start breaks when an inline void (e.g. a formula) sits earlier in
  // the line: it adds a position but no characters to Editor.string.
  const tokenStart = Editor.before(editor, selection.anchor, {
    unit: "character",
    distance: token.length,
  });

  if (!tokenStart) return null;

  return {
    query: token.slice(1),
    range: { anchor: tokenStart, focus: selection.anchor },
  };
}

function rectToPosition(rect: DOMRect | undefined) {
  if (!rect) return null;
  if (rect.top === 0 && rect.left === 0 && rect.width === 0 && rect.height === 0) {
    return null;
  }

  return {
    top: rect.bottom + 6,
    left: rect.left,
  };
}

export function getSlashMenuPosition(editor: SlashEditor) {
  const { selection } = editor;

  if (selection) {
    try {
      const fromSlate = rectToPosition(
        ReactEditor.toDOMRange(editor, selection).getBoundingClientRect()
      );
      if (fromSlate) return fromSlate;
    } catch {
      // DOM may not be committed yet; fall through to native selection.
    }
  }

  const native = window.getSelection();
  if (native && native.rangeCount > 0) {
    const fromNative = rectToPosition(
      native.getRangeAt(0).getBoundingClientRect()
    );
    if (fromNative) return fromNative;
  }

  try {
    const editorEl = ReactEditor.toDOMNode(editor, editor);
    return rectToPosition(editorEl.getBoundingClientRect());
  } catch {
    return null;
  }
}
