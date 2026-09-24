import type { LucideIcon } from "lucide-react";
import {
  Bold,
  Code,
  Frame,
  FunctionSquare,
  Heading1,
  Heading2,
  Image as ImageIcon,
  Italic,
  List,
  ListOrdered,
  PanelTop,
  Pilcrow,
  Quote,
  Table as TableIcon,
  Underline,
} from "lucide-react";
import type { Editor, Range } from "slate";

import {
  insertBanner,
  insertTable,
  pickImageAndInsert,
  promptAndInsertEmbed,
  promptAndInsertKatex,
  setParagraph,
  toggleBlock,
  toggleMark,
  type EditorCommandEditor,
} from "@/components/slate/editor-commands";

export type SlashCommandGroup = "blocks" | "inline";

export type SlashCommand = {
  id: string;
  title: string;
  description: string;
  keywords: string[];
  icon: LucideIcon;
  group: SlashCommandGroup;
  requiresTableInsert?: boolean;
  run: (editor: EditorCommandEditor) => void;
};

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "paragraph",
    title: "Text",
    description: "Plain paragraph block",
    keywords: ["text", "paragraph", "plain", "p"],
    icon: Pilcrow,
    group: "blocks",
    run: (editor) => setParagraph(editor),
  },
  {
    id: "heading-one",
    title: "Heading 1",
    description: "Large section heading",
    keywords: ["heading", "h1", "title", "large"],
    icon: Heading1,
    group: "blocks",
    run: (editor) => toggleBlock(editor, "heading-one"),
  },
  {
    id: "heading-two",
    title: "Heading 2",
    description: "Medium section heading",
    keywords: ["heading", "h2", "subtitle", "medium"],
    icon: Heading2,
    group: "blocks",
    run: (editor) => toggleBlock(editor, "heading-two"),
  },
  {
    id: "block-quote",
    title: "Quote",
    description: "Capture a quote",
    keywords: ["quote", "blockquote", "callout"],
    icon: Quote,
    group: "blocks",
    run: (editor) => toggleBlock(editor, "block-quote"),
  },
  {
    id: "banner",
    title: "Banner",
    description: "Colored callout banner",
    keywords: ["banner", "callout", "alert", "notice", "highlight", "info"],
    icon: PanelTop,
    group: "blocks",
    run: (editor) => insertBanner(editor),
  },
  {
    id: "bulleted-list",
    title: "Bulleted list",
    description: "Create a simple list",
    keywords: ["bullet", "list", "unordered", "ul"],
    icon: List,
    group: "blocks",
    run: (editor) => toggleBlock(editor, "bulleted-list"),
  },
  {
    id: "numbered-list",
    title: "Numbered list",
    description: "Create a numbered list",
    keywords: ["numbered", "ordered", "list", "ol"],
    icon: ListOrdered,
    group: "blocks",
    run: (editor) => toggleBlock(editor, "numbered-list"),
  },
  {
    id: "table",
    title: "Table",
    description: "Insert a table",
    keywords: ["table", "grid", "rows", "columns"],
    icon: TableIcon,
    group: "blocks",
    requiresTableInsert: true,
    run: (editor) => insertTable(editor),
  },
  {
    id: "image",
    title: "Image",
    description: "Insert an image from URL or file",
    keywords: ["image", "img", "photo", "picture", "upload", "media"],
    icon: ImageIcon,
    group: "blocks",
    run: (editor) => pickImageAndInsert(editor),
  },
  {
    id: "katex",
    title: "KaTeX",
    description: "Insert a LaTeX math formula",
    keywords: ["katex", "latex", "math", "formula", "equation"],
    icon: FunctionSquare,
    group: "blocks",
    run: (editor) => promptAndInsertKatex(editor),
  },
  {
    id: "embed",
    title: "Embed",
    description: "Embed iframe content from a URL",
    keywords: ["embed", "iframe", "youtube", "spotify", "video", "frame"],
    icon: Frame,
    group: "blocks",
    run: (editor) => promptAndInsertEmbed(editor),
  },
  {
    id: "bold",
    title: "Bold",
    description: "Make text bold",
    keywords: ["bold", "strong", "b"],
    icon: Bold,
    group: "inline",
    run: (editor) => toggleMark(editor, "bold"),
  },
  {
    id: "italic",
    title: "Italic",
    description: "Make text italic",
    keywords: ["italic", "emphasis", "i"],
    icon: Italic,
    group: "inline",
    run: (editor) => toggleMark(editor, "italic"),
  },
  {
    id: "underline",
    title: "Underline",
    description: "Underline text",
    keywords: ["underline", "u"],
    icon: Underline,
    group: "inline",
    run: (editor) => toggleMark(editor, "underline"),
  },
  {
    id: "code",
    title: "Code",
    description: "Inline code formatting",
    keywords: ["code", "mono", "inline"],
    icon: Code,
    group: "inline",
    run: (editor) => toggleMark(editor, "code"),
  },
];

export type SlashCommandContext = {
  query: string;
  range: Range;
};

export function filterSlashCommands(
  commands: SlashCommand[],
  query: string,
  enableTableInsert: boolean
) {
  const normalized = query.trim().toLowerCase();

  return commands.filter((command) => {
    if (command.requiresTableInsert && !enableTableInsert) return false;
    if (!normalized) return true;

    const haystack = [
      command.title,
      command.description,
      ...command.keywords,
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalized);
  });
}
