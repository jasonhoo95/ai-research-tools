"use client";

import { useCallback } from "react";
import type { BaseEditor } from "slate";
import { withHistory, type HistoryEditor } from "slate-history";
import { withReact, type ReactEditor, type RenderElementProps } from "slate-react";

import { BannerWrapper } from "@/components/slate/banner";
import type { BannerElement } from "@/components/slate/banner/types";
import { EmbedWrapper } from "@/components/slate/embed";
import type { EmbedElement } from "@/components/slate/embed/types";
import { ImageWrapper } from "@/components/slate/img";
import type { ImageElement } from "@/components/slate/img/types";
import { KatexWrapper } from "@/components/slate/katex";
import type { KatexElement } from "@/components/slate/katex/types";
import { LinkWrapper } from "@/components/slate/link";
import type { LinkElement } from "@/components/slate/link/types";
import { Table } from "@/components/slate/table";
import type { TableElement } from "@/components/slate/table/types";
import {
  DefaultElement,
  SlateFieldEditor,
  type SlateFieldEditorProps,
} from "@/components/slate/slate-field-editor";

function withVoidElements<T extends BaseEditor & ReactEditor & HistoryEditor>(
  editor: T
) {
  const { isVoid, isInline } = editor;

  editor.isVoid = (element) =>
    element.type === "table" ||
    element.type === "image" ||
    element.type === "katex" ||
    element.type === "embed"
      ? true
      : isVoid(element);

  editor.isInline = (element) =>
    element.type === "katex" ? true : isInline(element);

  return editor;
}

export type SlateEditorProps = SlateFieldEditorProps;

export function SlateEditor(props: SlateEditorProps) {
  const enhanceEditor = useCallback(
    (editor: BaseEditor & ReactEditor & HistoryEditor) =>
      withVoidElements(editor),
    []
  );

  const renderElement = useCallback((elementProps: RenderElementProps) => {
    if (elementProps.element.type === "table") {
      return (
        <Table
          attributes={elementProps.attributes}
          element={elementProps.element as TableElement}
        >
          {elementProps.children}
        </Table>
      );
    }

    if (elementProps.element.type === "banner") {
      return (
        <BannerWrapper
          attributes={elementProps.attributes}
          element={elementProps.element as BannerElement}
        >
          {elementProps.children}
        </BannerWrapper>
      );
    }

    if (elementProps.element.type === "image") {
      return (
        <ImageWrapper
          attributes={elementProps.attributes}
          element={elementProps.element as ImageElement}
        >
          {elementProps.children}
        </ImageWrapper>
      );
    }

    if (elementProps.element.type === "katex") {
      return (
        <KatexWrapper
          attributes={elementProps.attributes}
          element={elementProps.element as KatexElement}
        >
          {elementProps.children}
        </KatexWrapper>
      );
    }

    if (elementProps.element.type === "embed") {
      return (
        <EmbedWrapper
          attributes={elementProps.attributes}
          element={elementProps.element as EmbedElement}
        >
          {elementProps.children}
        </EmbedWrapper>
      );
    }

    if (elementProps.element.type === "link") {
      return (
        <LinkWrapper
          attributes={elementProps.attributes}
          element={elementProps.element as LinkElement}
        >
          {elementProps.children}
        </LinkWrapper>
      );
    }

    return <DefaultElement {...elementProps} />;
  }, []);

  return (
    <SlateFieldEditor
      {...props}
      enableTableInsert
      enableSlashCommands
      enableFloatingToolbar
      enhanceEditor={enhanceEditor}
      renderElement={renderElement}
    />
  );
}
