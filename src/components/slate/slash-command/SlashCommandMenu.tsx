"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Transforms } from "slate";
import { ReactEditor, useSlate, useSlateSelector } from "slate-react";

import {
  filterSlashCommands,
  SLASH_COMMANDS,
  type SlashCommand,
  type SlashCommandContext,
} from "@/components/slate/slash-command/commands";
import {
  getSlashCommandContext,
  getSlashMenuPosition,
} from "@/components/slate/slash-command/utils";
import type { EditorCommandEditor } from "@/components/slate/editor-commands";
import { cn } from "@/lib/utils";

const GROUP_LABELS = {
  blocks: "Blocks",
  inline: "Inline",
} as const;

const MENU_WIDTH = 320;
const MENU_ESTIMATED_HEIGHT = 320;

export function useSlashCommands(enableTableInsert = false) {
  const editor = useSlate() as EditorCommandEditor;
  const context = useSlateSelector((currentEditor) =>
    getSlashCommandContext(currentEditor as EditorCommandEditor),
  );
  const contextKey = useSlateSelector((currentEditor) => {
    const slashContext = getSlashCommandContext(
      currentEditor as EditorCommandEditor,
    );
    return slashContext
      ? `${slashContext.query}:${slashContext.range.anchor.path.join(".")}:${slashContext.range.anchor.offset}`
      : "";
  });

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dismissedKey, setDismissedKey] = useState("");
  const [position, setPosition] = useState<{ top: number; left: number } | null>(
    null
  );
  const prevQueryRef = useRef(context?.query);

  if (prevQueryRef.current !== context?.query) {
    prevQueryRef.current = context?.query;
    setSelectedIndex(0);
  }

  const filteredCommands = filterSlashCommands(
    SLASH_COMMANDS,
    context?.query ?? "",
    enableTableInsert
  );

  const isOpen = Boolean(
    context && filteredCommands.length > 0 && dismissedKey !== contextKey
  );

  useLayoutEffect(() => {
    if (!isOpen) return;

    const measure = () => {
      const next = getSlashMenuPosition(editor);
      if (!next) return;

      const maxLeft = Math.max(8, window.innerWidth - MENU_WIDTH - 8);
      const maxTop = Math.max(8, window.innerHeight - MENU_ESTIMATED_HEIGHT - 8);

      setPosition({
        top: Math.min(next.top, maxTop),
        left: Math.min(Math.max(8, next.left), maxLeft),
      });
    };

    measure();
    const frame = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(frame);
  }, [editor, isOpen, contextKey]);

  const runCommand = (command: SlashCommand) => {
    if (!context) return;

    Transforms.select(editor, context.range);
    Transforms.delete(editor);
    command.run(editor);
    ReactEditor.focus(editor);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!isOpen || !context) return false;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedIndex((current) => (current + 1) % filteredCommands.length);
      return true;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedIndex(
        (current) =>
          (current - 1 + filteredCommands.length) % filteredCommands.length
      );
      return true;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const command = filteredCommands[selectedIndex];
      if (command) runCommand(command);
      return true;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setDismissedKey(contextKey);
      return true;
    }

    return false;
  };

  const menu =
    typeof document !== "undefined" && isOpen && position ? (
      <SlashCommandMenuPanel
        commands={filteredCommands}
        context={context}
        position={position}
        selectedIndex={selectedIndex}
        onHover={setSelectedIndex}
        onSelect={runCommand}
      />
    ) : null;

  return {
    handleKeyDown,
    menu,
    isOpen,
  };
}

function SlashCommandMenuPanel({
  commands,
  context,
  position,
  selectedIndex,
  onHover,
  onSelect,
}: {
  commands: SlashCommand[];
  context: SlashCommandContext | null;
  position: { top: number; left: number };
  selectedIndex: number;
  onHover: (index: number) => void;
  onSelect: (command: SlashCommand) => void;
}) {
  const grouped = commands.reduce<Record<string, SlashCommand[]>>(
    (acc, command) => {
      acc[command.group] ??= [];
      acc[command.group].push(command);
      return acc;
    },
    {}
  );

  let itemIndex = -1;

  return createPortal(
    <div
      className="fixed z-[200] w-[min(320px,calc(100vw-1.5rem))] overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-xl ring-1 ring-foreground/10"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <div className="border-b px-3 py-2">
        <p className="text-xs font-medium text-muted-foreground">
          {context?.query
            ? `Commands matching “${context.query}”`
            : "Type a command"}
        </p>
      </div>

      <div className="max-h-72 overflow-y-auto p-1">
        {Object.entries(grouped).map(([group, groupCommands]) => (
          <div key={group} className="py-1">
            <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {GROUP_LABELS[group as keyof typeof GROUP_LABELS] ?? group}
            </p>
            {groupCommands.map((command) => {
              itemIndex += 1;
              const active = itemIndex === selectedIndex;
              const Icon = command.icon;

              return (
                <button
                  key={command.id}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors",
                    active ? "bg-accent text-accent-foreground" : "hover:bg-muted"
                  )}
                  onMouseEnter={() => onHover(itemIndex)}
                  onClick={() => onSelect(command)}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">
                      {command.title}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {command.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
}

export function SlashCommandMenu({
  enableTableInsert = false,
}: {
  enableTableInsert?: boolean;
}) {
  const { menu } = useSlashCommands(enableTableInsert);
  return menu;
}
