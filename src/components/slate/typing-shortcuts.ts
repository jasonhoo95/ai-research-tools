import {
  Editor,
  Element as SlateElement,
  Node,
  Path,
  Range,
  Transforms,
} from "slate";

const LIST_TYPES = ["numbered-list", "bulleted-list"] as const;
type ListType = (typeof LIST_TYPES)[number];

function isListType(type: string): type is ListType {
  return (LIST_TYPES as readonly string[]).includes(type);
}

function continueNumberedList(editor: Editor, blockPath: number[]) {
  // A first-child block ([...,0]) has no previous sibling. Calling
  // Path.previous on it throws ("negative index"), which — because it happened
  // outside the try below — aborted the whole shortcut and silently broke
  // numbering on the first line (no dev overlay on Android to reveal it).
  if (!Path.hasPrevious(blockPath)) return false;

  try {
    const prevPath = Path.previous(blockPath);
    const prevNode = Node.get(editor, prevPath);
    if (!SlateElement.isElement(prevNode) || prevNode.type !== "numbered-list") {
      return false;
    }

    const text = Editor.string(editor, blockPath);
    Transforms.removeNodes(editor, { at: blockPath });

    const insertPath = [...prevPath, prevNode.children.length];
    Transforms.insertNodes(
      editor,
      { type: "list-item", children: [{ text }] },
      { at: insertPath },
    );
    Transforms.select(editor, Editor.end(editor, insertPath));
    return true;
  } catch {
    return false;
  }
}

function wrapAsList(editor: Editor, listType: ListType) {
  Transforms.setNodes(editor, { type: "list-item" });
  Transforms.wrapNodes(editor, { type: listType, children: [] } as never);
}

function applyNumberedList(editor: Editor, blockPath: number[]) {
  if (!continueNumberedList(editor, blockPath)) {
    wrapAsList(editor, "numbered-list");
  }
}

function applyBulletedList(editor: Editor) {
  wrapAsList(editor, "bulleted-list");
}

function applySimpleBlock(
  editor: Editor,
  type: "heading-one" | "heading-two" | "block-quote",
) {
  Transforms.setNodes(editor, { type });
}

const BATCH_SHORTCUTS: {
  test: (text: string) => boolean;
  apply: (editor: Editor, blockPath: number[]) => void;
}[] = [
  {
    test: (text) => /^(\d+)[.)]\s$/.test(text),
    apply: (editor, blockPath) => applyNumberedList(editor, blockPath),
  },
  {
    test: (text) => /^[-*•]\s$/.test(text),
    apply: (editor) => applyBulletedList(editor),
  },
  {
    test: (text) => /^##\s$/.test(text),
    apply: (editor) => applySimpleBlock(editor, "heading-two"),
  },
  {
    test: (text) => /^#\s$/.test(text),
    apply: (editor) => applySimpleBlock(editor, "heading-one"),
  },
  {
    test: (text) => /^>\s$/.test(text),
    apply: (editor) => applySimpleBlock(editor, "block-quote"),
  },
];

const PREFIX_SHORTCUTS: {
  test: (text: string) => boolean;
  apply: (editor: Editor, blockPath: number[]) => void;
}[] = [
  {
    test: (text) => /^(\d+)[.)]$/.test(text),
    apply: (editor, blockPath) => applyNumberedList(editor, blockPath),
  },
  {
    test: (text) => /^[-*•]$/.test(text),
    apply: (editor) => applyBulletedList(editor),
  },
  {
    test: (text) => /^##$/.test(text),
    apply: (editor) => applySimpleBlock(editor, "heading-two"),
  },
  {
    test: (text) => /^#$/.test(text),
    apply: (editor) => applySimpleBlock(editor, "heading-one"),
  },
  {
    test: (text) => /^>$/.test(text),
    apply: (editor) => applySimpleBlock(editor, "block-quote"),
  },
];

function isSpaceChar(text: string) {
  return text === " " || text === "\u00a0";
}

export function tryApplyTypingShortcut(
  editor: Editor,
  insertedText: string,
): boolean {
  const { selection } = editor;
  if (!selection || !Range.isCollapsed(selection)) return false;

  const blockEntry = Editor.above(editor, {
    match: (n) =>
      !Editor.isEditor(n) &&
      SlateElement.isElement(n) &&
      Editor.isBlock(editor, n),
  });
  if (!blockEntry) return false;

  const [block, blockPath] = blockEntry;
  if (!SlateElement.isElement(block) || block.type !== "paragraph") return false;

  const start = Editor.start(editor, blockPath);
  const beforeRange = { anchor: start, focus: selection.anchor };
  const beforeText = Editor.string(editor, beforeRange);
  const combined = beforeText + insertedText;

  for (const shortcut of BATCH_SHORTCUTS) {
    if (shortcut.test(combined)) {
      if (beforeText.length > 0) {
        Transforms.select(editor, beforeRange);
        Transforms.delete(editor);
      }
      shortcut.apply(editor, blockPath);
      return true;
    }
  }

  if (isSpaceChar(insertedText)) {
    for (const shortcut of PREFIX_SHORTCUTS) {
      if (shortcut.test(beforeText)) {
        Transforms.select(editor, beforeRange);
        Transforms.delete(editor);
        shortcut.apply(editor, blockPath);
        return true;
      }
    }
  }

  return false;
}

// NOTE: Typing shortcuts are applied ONLY through the `editor.insertText`
// override below. Do NOT re-add onKeyDown / onDOMBeforeInput interception:
// on Android soft keyboards, input arrives via composition/beforeInput events
// (event.key is "Unidentified") and Slate's AndroidInputManager reconciles
// DOM mutations through insertText. Calling preventDefault() in a beforeInput
// handler mid-composition desyncs that reconciliation and breaks shortcuts
// (numbering, bullets, headings). The insertText path works on every platform.
export function withTypingShortcuts<T extends Editor>(editor: T): T {
  const { insertText } = editor;

  editor.insertText = (text) => {
    if (tryApplyTypingShortcut(editor, text)) return;
    insertText(text);
  };

  return editor;
}

export { isListType, LIST_TYPES };
