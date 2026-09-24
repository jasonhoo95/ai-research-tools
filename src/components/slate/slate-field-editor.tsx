"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Heading1,
  Heading2,
  Quote,
  Code,
  Table as TableIcon,
} from "lucide-react";
import {
  createEditor,
  Editor,
  Element as SlateElement,
  Transforms,
  Range,
  Point,
  Path,
  Node,
  Text,
  type Descendant,
  type BaseEditor,
} from "slate";
import { withHistory, type HistoryEditor } from "slate-history";
import {
  Editable,
  Slate,
  useSlate,
  withReact,
  type ReactEditor,
  type RenderElementProps,
  type RenderLeafProps,
} from "slate-react";
import { cn } from "@/lib/utils";
import type { TableElement } from "@/components/slate/table/types";
import type { ImageElement } from "@/components/slate/img/types";
import type { BannerElement } from "@/components/slate/banner/types";
import type { EmbedElement } from "@/components/slate/embed/types";
import type { KatexElement } from "@/components/slate/katex/types";
import type { LinkElement } from "@/components/slate/link/types";
import { FloatingToolbar } from "@/components/slate/floating-toolbar";
import { getTextColorStyle } from "@/components/slate/floating-toolbar/types";
import { LinkWrapper } from "@/components/slate/link";
import { useSlashCommands } from "@/components/slate/slash-command";
import {
  insertTable,
  isBlockActive,
  isMarkActive,
  toggleBlock,
  toggleMark,
} from "@/components/slate/editor-commands";
import {
  isListType,
  withTypingShortcuts,
} from "@/components/slate/typing-shortcuts";

type CustomText = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  code?: boolean;
  color?: string;
};

type InlineDescendant = CustomText | LinkElement;

type ParagraphElement = { type: "paragraph"; children: InlineDescendant[] };
type HeadingOneElement = { type: "heading-one"; children: InlineDescendant[] };
type HeadingTwoElement = { type: "heading-two"; children: InlineDescendant[] };
type BlockQuoteElement = { type: "block-quote"; children: InlineDescendant[] };
type ListItemElement = { type: "list-item"; children: InlineDescendant[] };
type BulletedListElement = {
  type: "bulleted-list";
  children: ListItemElement[];
};
type NumberedListElement = {
  type: "numbered-list";
  children: ListItemElement[];
};

type CustomElement =
  | ParagraphElement
  | HeadingOneElement
  | HeadingTwoElement
  | BlockQuoteElement
  | BannerElement
  | ListItemElement
  | BulletedListElement
  | NumberedListElement
  | TableElement
  | ImageElement
  | KatexElement
  | EmbedElement
  | LinkElement;

declare module "slate" {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor & HistoryEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}

type TextMark = Exclude<keyof Omit<CustomText, "text">, "color">;

const HOTKEYS: {
  keys: (e: React.KeyboardEvent) => boolean;
  mark: TextMark;
}[] = [
  { keys: (e) => (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b", mark: "bold" },
  { keys: (e) => (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i", mark: "italic" },
  { keys: (e) => (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "u", mark: "underline" },
  { keys: (e) => (e.metaKey || e.ctrlKey) && e.key === "`", mark: "code" },
];

const MARK_FORMATS: (keyof Omit<CustomText, "text">)[] = [
  "bold",
  "italic",
  "underline",
  "code",
];

const STYLED_BLOCK_TYPES = [
  "heading-one",
  "heading-two",
  "block-quote",
] as const;

function clearActiveMarks(editor: Editor) {
  const blockEntry = getBlockEntry(editor);
  if (!blockEntry) return;

  const [block, path] = blockEntry;
  if (!SlateElement.isElement(block)) return;
  if (Editor.string(editor, path) !== "") return;

  if ((STYLED_BLOCK_TYPES as readonly string[]).includes(block.type)) {
    Transforms.setNodes(editor, { type: "paragraph" } as never, { at: path });
  }

  Transforms.unsetNodes(editor, MARK_FORMATS, {
    at: path,
    match: (n) => Text.isText(n),
  });
}

function getBlockEntry(editor: Editor): [Node, Path] | undefined {
  const { selection } = editor;
  if (!selection) return undefined;

  const [match] = Editor.nodes(editor, {
    at: selection.anchor,
    mode: "lowest",
    match: (n) =>
      !Editor.isEditor(n) &&
      SlateElement.isElement(n) &&
      Editor.isBlock(editor, n),
  });

  return match;
}

function mergeWithPreviousListItem(editor: Editor, path: number[]) {
  const prevPath = Path.previous(path);
  const currentText = Editor.string(editor, path);

  Transforms.removeNodes(editor, { at: path });

  if (currentText) {
    const prevEnd = Editor.end(editor, prevPath);
    Transforms.select(editor, prevEnd);
    Transforms.insertText(editor, currentText);
  } else {
    Transforms.select(editor, Editor.end(editor, prevPath));
  }
}

function mergeWithPreviousBannerParagraph(
  editor: Editor,
  path: number[],
) {
  mergeWithPreviousListItem(editor, path);
}

function isInsideBanner(editor: Editor, at: Path) {
  const [match] = Editor.nodes(editor, {
    at,
    match: (n) =>
      !Editor.isEditor(n) &&
      SlateElement.isElement(n) &&
      n.type === "banner",
  });

  return Boolean(match);
}

function isBlockEmpty(editor: Editor, path: Path) {
  return Editor.string(editor, path).trim() === "";
}

function getBannerParagraphEntry(
  editor: Editor,
): [Node, Path] | undefined {
  const { selection } = editor;
  if (!selection) return undefined;

  const blockEntry = getBlockEntry(editor);
  if (!blockEntry) return undefined;

  const [block, path] = blockEntry;
  if (
    !SlateElement.isElement(block) ||
    block.type !== "paragraph" ||
    !isInsideBanner(editor, path)
  ) {
    return undefined;
  }

  return blockEntry;
}

function exitBanner(editor: Editor) {
  Transforms.unwrapNodes(editor, {
    match: (n) =>
      !Editor.isEditor(n) &&
      SlateElement.isElement(n) &&
      n.type === "banner",
    split: true,
  });
}

function tryMergeWithPreviousBanner(
  editor: Editor,
  bannerPath: number[],
) {
  try {
    const prevBannerPath = Path.previous(bannerPath);
    const prevBanner = Node.get(editor, prevBannerPath);
    if (
      SlateElement.isElement(prevBanner) &&
      prevBanner.type === "banner"
    ) {
      Transforms.mergeNodes(editor, { at: bannerPath });
      return true;
    }
  } catch {
    // no previous banner sibling
  }

  return false;
}

function normalizeBannerChildren(
  editor: Editor,
  entry: [Node, Path],
): boolean {
  const [node, path] = entry;
  if (
    !SlateElement.isElement(node) ||
    node.type !== "banner"
  ) {
    return false;
  }

  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    if (
      SlateElement.isElement(child) &&
      (child as { type: string }).type === "banner-line"
    ) {
      Transforms.setNodes(
        editor,
        { type: "paragraph" } as never,
        { at: [...path, i] },
      );
      return true;
    }
  }

  const hasInvalidChild = node.children.some(
    (child) => !SlateElement.isElement(child),
  );

  if (!hasInvalidChild) return false;

  const text = Node.string(node);
  Transforms.setNodes(
    editor,
    {
      type: "banner",
      color: (node as BannerElement).color,
      children: [
        {
          type: "paragraph",
          children: [{ text }],
        },
      ],
    } as never,
    { at: path },
  );

  return true;
}

function normalizeAdjacentBanners(
  editor: Editor,
  entry: [Node, Path],
): boolean {
  const [node, path] = entry;

  if (Editor.isEditor(node)) {
    for (let i = 0; i < node.children.length - 1; i++) {
      const current = node.children[i];
      const next = node.children[i + 1];
      if (
        SlateElement.isElement(current) &&
        SlateElement.isElement(next) &&
        current.type === "banner" &&
        next.type === "banner"
      ) {
        Transforms.mergeNodes(editor, { at: [i + 1] });
        return true;
      }
    }
  }

  if (
    SlateElement.isElement(node) &&
    node.type === "banner" &&
    path.length > 0
  ) {
    try {
      const nextPath = Path.next(path);
      const nextNode = Node.get(editor, nextPath);
      if (
        SlateElement.isElement(nextNode) &&
        nextNode.type === "banner"
      ) {
        Transforms.mergeNodes(editor, { at: nextPath });
        return true;
      }
    } catch {
      // no next sibling
    }
  }

  return false;
}

function normalizeAdjacentNumberedLists(
  editor: Editor,
  entry: [Node, Path]
): boolean {
  const [node, path] = entry;

  if (Editor.isEditor(node)) {
    for (let i = 0; i < node.children.length - 1; i++) {
      const current = node.children[i];
      const next = node.children[i + 1];
      if (
        SlateElement.isElement(current) &&
        SlateElement.isElement(next) &&
        current.type === "numbered-list" &&
        next.type === "numbered-list"
      ) {
        Transforms.mergeNodes(editor, { at: [i + 1] });
        return true;
      }
    }
  }

  if (
    SlateElement.isElement(node) &&
    node.type === "numbered-list" &&
    path.length > 0
  ) {
    try {
      const nextPath = Path.next(path);
      const nextNode = Node.get(editor, nextPath);
      if (SlateElement.isElement(nextNode) && nextNode.type === "numbered-list") {
        Transforms.mergeNodes(editor, { at: nextPath });
        return true;
      }
    } catch {
      // no next sibling
    }
  }

  return false;
}

function withLinks(editor: Editor) {
  const { isInline } = editor;

  editor.isInline = (element) =>
    element.type === "link" ? true : isInline(element);

  return editor;
}

function withLists(editor: Editor) {
  const { normalizeNode, insertBreak, deleteBackward } = editor;

  editor.normalizeNode = (entry) => {
    if (normalizeAdjacentNumberedLists(editor, entry)) return;
    if (normalizeAdjacentBanners(editor, entry)) return;
    if (normalizeBannerChildren(editor, entry)) return;
    normalizeNode(entry);
  };

  editor.insertBreak = () => {
    const { selection } = editor;
    if (!selection) {
      insertBreak();
      return;
    }

    const blockEntry = getBlockEntry(editor);
    if (blockEntry) {
      const [block, path] = blockEntry;

      if (SlateElement.isElement(block) && block.type === "list-item") {
        if (Editor.string(editor, path) === "") {
          exitList(editor);
          clearActiveMarks(editor);
          return;
        }

        Transforms.splitNodes(editor, { always: true });
        return;
      }

      if (
        SlateElement.isElement(block) &&
        block.type === "paragraph" &&
        isInsideBanner(editor, path)
      ) {
        if (isBlockEmpty(editor, path)) {
          exitBanner(editor);
          clearActiveMarks(editor);
          return;
        }

        Transforms.splitNodes(editor, { always: true });
        return;
      }

      if (
        SlateElement.isElement(block) &&
        (STYLED_BLOCK_TYPES as readonly string[]).includes(block.type) &&
        Editor.string(editor, path) === ""
      ) {
        clearActiveMarks(editor);
        return;
      }
    }

    insertBreak();
    clearActiveMarks(editor);
  };

  editor.deleteBackward = (unit) => {
    const { selection } = editor;
    if (selection && Range.isCollapsed(selection)) {
      const [listItemMatch] = Editor.nodes(editor, {
        match: (n) =>
          !Editor.isEditor(n) &&
          SlateElement.isElement(n) &&
          n.type === "list-item",
      });

      if (listItemMatch) {
        const [, path] = listItemMatch;
        const start = Editor.start(editor, path);

        if (Point.equals(selection.anchor, start)) {
          const itemIndex = path[path.length - 1];

          if (itemIndex > 0) {
            mergeWithPreviousListItem(editor, path);
            return;
          }

          if (Editor.string(editor, path) === "") {
            exitList(editor);
            return;
          }

          Transforms.setNodes(editor, { type: "paragraph" });
          Transforms.unwrapNodes(editor, {
            match: (n) =>
              !Editor.isEditor(n) &&
              SlateElement.isElement(n) &&
              isListType(n.type),
            split: true,
          });
          return;
        }
      }

      const bannerParagraphEntry =
        getBannerParagraphEntry(editor);

      if (bannerParagraphEntry) {
        const [, path] = bannerParagraphEntry;
        const start = Editor.start(editor, path);

        if (Point.equals(selection.anchor, start)) {
          const lineIndex = path[path.length - 1];
          const bannerPath = Path.parent(path);

          if (lineIndex > 0) {
            mergeWithPreviousBannerParagraph(
              editor,
              path,
            );
            return;
          }

          if (isBlockEmpty(editor, path)) {
            const bannerNode = Node.get(editor, bannerPath);
            if (
              SlateElement.isElement(bannerNode) &&
              bannerNode.children.length === 1
            ) {
              if (
                tryMergeWithPreviousBanner(
                  editor,
                  bannerPath,
                )
              ) {
                return;
              }
            }

            exitBanner(editor);
            return;
          }

          if (
            tryMergeWithPreviousBanner(
              editor,
              bannerPath,
            )
          ) {
            return;
          }
        }
      }
    }

    deleteBackward(unit);
  };

  return editor;
}

function exitList(editor: Editor) {
  Transforms.unwrapNodes(editor, {
    match: (n) =>
      !Editor.isEditor(n) &&
      SlateElement.isElement(n) &&
      isListType(n.type),
    split: true,
  });
  Transforms.setNodes(editor, { type: "paragraph" });
}

function handleSoftBreak(
  editor: Editor,
  event: React.KeyboardEvent
): boolean {
  if (event.key !== "Enter" || !event.shiftKey) return false;

  event.preventDefault();
  Editor.insertText(editor, "\n");
  return true;
}

export interface SlateFieldEditorProps {
  value: Descendant[];
  onChange: (value: Descendant[]) => void;
  placeholder?: string;
  className?: string;
  showToolbar?: boolean;
  editableClassName?: string;
  renderElement?: (props: RenderElementProps) => React.ReactElement;
  enhanceEditor?: (
    editor: BaseEditor & ReactEditor & HistoryEditor
  ) => BaseEditor & ReactEditor & HistoryEditor;
  enableTableInsert?: boolean;
  enableSlashCommands?: boolean;
  enableFloatingToolbar?: boolean;
  controlledBackwardDelete?: boolean;
}

export function SlateFieldEditor({
  value,
  onChange,
  placeholder = "Start writing your template…",
  className,
  showToolbar = true,
  editableClassName = "prose prose-sm max-w-none px-4 py-3 min-h-[280px] outline-none [&_h1]:mb-3 [&_h2]:mb-2",
  renderElement,
  enhanceEditor,
  enableTableInsert = false,
  enableSlashCommands = true,
  enableFloatingToolbar = true,
  controlledBackwardDelete = false,
}: SlateFieldEditorProps) {
  const editor = useMemo(() => {
    let next = withTypingShortcuts(
      withLinks(withLists(withHistory(withReact(createEditor()))))
    );
    if (enhanceEditor) next = enhanceEditor(next);
    return next;
  }, [enhanceEditor]);

  const defaultRenderElement = useCallback(
    (props: RenderElementProps) => {
      if (props.element.type === "link") {
        return (
          <LinkWrapper
            attributes={props.attributes}
            element={props.element as LinkElement}
          >
            {props.children}
          </LinkWrapper>
        );
      }

      return <DefaultElement {...props} />;
    },
    []
  );
  const renderElementFn = renderElement ?? defaultRenderElement;
  const renderLeaf = useCallback(
    (props: RenderLeafProps) => <Leaf {...props} />,
    []
  );
  const [initialDocument] = useState(() => structuredClone(value));

  return (
    <div
      className={cn(
        "overflow-hidden",
        className
      )}
    >
      <Slate editor={editor} initialValue={initialDocument} onChange={onChange}>
        <SlateEditable
          editableClassName={editableClassName}
          renderElementFn={renderElementFn}
          renderLeaf={renderLeaf}
          placeholder={placeholder}
          showToolbar={showToolbar}
          enableTableInsert={enableTableInsert}
          enableSlashCommands={enableSlashCommands}
          enableFloatingToolbar={enableFloatingToolbar}
          controlledBackwardDelete={controlledBackwardDelete}
        />
      </Slate>
    </div>
  );
}

function SlateEditable({
  editableClassName,
  renderElementFn,
  renderLeaf,
  placeholder,
  showToolbar,
  enableTableInsert,
  enableSlashCommands,
  enableFloatingToolbar,
  controlledBackwardDelete,
}: {
  editableClassName: string;
  renderElementFn: (props: RenderElementProps) => React.ReactElement;
  renderLeaf: (props: RenderLeafProps) => React.ReactElement;
  placeholder: string;
  showToolbar: boolean;
  enableTableInsert: boolean;
  enableSlashCommands: boolean;
  enableFloatingToolbar: boolean;
  controlledBackwardDelete: boolean;
}) {
  const editor = useSlate();
  const slash = useSlashCommands(enableTableInsert && enableSlashCommands);

  return (
    <>
      {showToolbar ? <Toolbar enableTableInsert={enableTableInsert} /> : null}
      {enableSlashCommands ? slash.menu : null}
      {enableFloatingToolbar ? <FloatingToolbar /> : null}
      <Editable
        className={editableClassName}
        renderElement={renderElementFn}
        renderLeaf={renderLeaf}
        placeholder={placeholder}
        spellCheck
        onDOMBeforeInput={(event) => {
          if (
            !controlledBackwardDelete ||
            event.inputType !== "deleteContentBackward"
          ) {
            return;
          }

          event.preventDefault();

          const { selection } = editor;
          if (!selection) return;
          if (!Range.isCollapsed(selection)) {
            Transforms.delete(editor);
            return;
          }

          const isEmptyRoot =
            editor.children.length === 1 &&
            Editor.string(editor, []) === "" &&
            Point.equals(selection.anchor, Editor.start(editor, []));

          if (!isEmptyRoot) {
            editor.deleteBackward("character");
          }

          return true;
        }}
        onKeyDown={(event) => {
          if (enableSlashCommands && slash.handleKeyDown(event)) return;
          if (handleSoftBreak(editor, event)) return;

          for (const h of HOTKEYS) {
            if (h.keys(event)) {
              event.preventDefault();
              toggleMark(editor, h.mark);
              break;
            }
          }
        }}
      />
    </>
  );
}

function Toolbar({ enableTableInsert }: { enableTableInsert: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b bg-muted/40 px-2 py-1.5">
      <MarkButton format="bold" icon={Bold} />
      <MarkButton format="italic" icon={Italic} />
      <MarkButton format="underline" icon={Underline} />
      <MarkButton format="code" icon={Code} />
      <Divider />
      <BlockButton format="heading-one" icon={Heading1} />
      <BlockButton format="heading-two" icon={Heading2} />
      <BlockButton format="block-quote" icon={Quote} />
      {enableTableInsert ? <InsertTableButton /> : null}
      <Divider />
      <BlockButton format="bulleted-list" icon={List} />
      <BlockButton format="numbered-list" icon={ListOrdered} />
    </div>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-border" aria-hidden />;
}

function MarkButton({
  format,
  icon: Icon,
}: {
  format: keyof Omit<CustomText, "text" | "color">;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const editor = useSlate();
  const active = isMarkActive(editor, format);
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        toggleMark(editor, format);
      }}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground",
        active && "bg-background text-foreground shadow-sm"
      )}
      aria-pressed={active}
      aria-label={format}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function InsertTableButton() {
  const editor = useSlate();

  return (
    <button
      type="button"
      onMouseDown={(event) => {
        event.preventDefault();
        insertTable(editor);
      }}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground"
      aria-label="Insert table"
    >
      <TableIcon className="h-4 w-4" />
    </button>
  );
}

function BlockButton({
  format,
  icon: Icon,
}: {
  format: CustomElement["type"];
  icon: React.ComponentType<{ className?: string }>;
}) {
  const editor = useSlate();
  const active = isBlockActive(editor, format);
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        toggleBlock(editor, format);
      }}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-background hover:text-foreground",
        active && "bg-background text-foreground shadow-sm"
      )}
      aria-pressed={active}
      aria-label={format}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export type { CustomText, InlineDescendant };

export function DefaultElement({
  attributes,
  children,
  element,
}: RenderElementProps) {
  const softBreakClass = "whitespace-pre-wrap break-words";

  switch (element.type) {
    case "heading-one":
      return (
        <h1
          {...attributes}
          className={cn("text-2xl font-semibold tracking-tight", softBreakClass)}
        >
          {children}
        </h1>
      );
    case "heading-two":
      return (
        <h2
          {...attributes}
          className={cn("text-xl font-semibold tracking-tight", softBreakClass)}
        >
          {children}
        </h2>
      );
    case "block-quote":
      return (
        <blockquote
          {...attributes}
          className={cn(
            "border-l-2 border-primary/50 pl-3 italic text-muted-foreground",
            softBreakClass
          )}
        >
          {children}
        </blockquote>
      );
    case "bulleted-list":
      return (
        <ul {...attributes} className="list-disc pl-6">
          {children}
        </ul>
      );
    case "numbered-list":
      return (
        <ol {...attributes} className="list-decimal pl-6">
          {children}
        </ol>
      );
    case "list-item":
      return (
        <li {...attributes} className={softBreakClass}>
          {children}
        </li>
      );
    default:
      return (
        <p {...attributes} className={cn("leading-7", softBreakClass)}>
          {children}
        </p>
      );
  }
}

function Leaf({ attributes, children, leaf }: RenderLeafProps) {
  let node = children;
  if (leaf.bold) node = <strong>{node}</strong>;
  if (leaf.italic) node = <em>{node}</em>;
  if (leaf.underline) node = <u>{node}</u>;
  if (leaf.code)
    node = (
      <code className="rounded bg-muted px-1 py-0.5 text-[0.85em] font-mono">
        {node}
      </code>
    );

  const colorStyle = getTextColorStyle(
    leaf.color as Parameters<typeof getTextColorStyle>[0],
  );

  return (
    <span
      {...attributes}
      style={colorStyle ? { color: colorStyle } : undefined}
    >
      {node}
    </span>
  );
}
