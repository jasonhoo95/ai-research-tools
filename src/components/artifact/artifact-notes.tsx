"use client"

import * as React from "react"
import type { Descendant } from "slate"

import { SlateEditor } from "@/components/slate/slate-editor"
import { markdownToSlateDocument } from "@/components/slate/lib/markdown-to-slate"
import { slateDocumentToMarkdown } from "@/components/slate/lib/slate-to-markdown"
import type { NotesArtifact } from "@/lib/chat-types"
import { useArtifactStore } from "@/store/artifact-stores"
import type { MessageArtifactResult } from "@/lib/chat-repo"
import { chatRepo } from "@/lib/chat-repo"

const SAVE_DELAY_MS = 600

/** Raw chatbot_message row returned by the message-artifact endpoint. */
type StoredArtifactRow = {
    id: string
    parent_chatbot_id: string
    content: { id: string; artifact: NotesArtifact }
}

function toArtifactData(row: StoredArtifactRow, content: unknown) {
    return {
        id: row.content.id,
        artifact: {
            ...row.content.artifact,
            content,
        },
    }
}

function NotesMarkdownEditor({ data, markdown }: { data: MessageArtifactResult, markdown: string | Descendant[] }) {
    const row = data as unknown as StoredArtifactRow
    // Content is markdown until the note is first edited, then a Slate document.
    const document = React.useMemo<Descendant[]>(
        () => (Array.isArray(markdown) ? markdown : markdownToSlateDocument(markdown.trim())),
        [markdown],
    )
    const valueRef = React.useRef<Descendant[] | null>(null)
    const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
    const lastSavedRef = React.useRef<string | null>(null)

    const saveNow = React.useCallback(() => {
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current)
            saveTimerRef.current = null
        }
        if (!valueRef.current) return

        const artifactData = toArtifactData(row, valueRef.current)
        const serialized = JSON.stringify(artifactData)
        if (serialized === lastSavedRef.current) return
        lastSavedRef.current = serialized

        chatRepo
            .updateMessageArtifact(row.parent_chatbot_id, row.id, artifactData as never)
            .catch((err) => {
                lastSavedRef.current = null
                console.error("Failed to save notes", err)
            })
    }, [row])

    // Content last loaded or saved — selection-only changes match it.
    const baselineRef = React.useRef(JSON.stringify(document))

    const handleChange = React.useCallback((value: Descendant[]) => {
        // Slate fires onChange for clicks and caret moves with a fresh array,
        // so compare content rather than identity.
        const serialized = JSON.stringify(value)
        if (serialized === baselineRef.current) return
        baselineRef.current = serialized
        valueRef.current = value
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(saveNow, SAVE_DELAY_MS)
    }, [saveNow])

    // Flush any pending edit when leaving the page.
    React.useEffect(
        () => () => {
            if (saveTimerRef.current) saveNow()
        },
        [saveNow],
    )

    return (
        <SlateEditor
            value={document}
            onChange={handleChange}
            showToolbar={false}
            enableSlashCommands={false}
            enableFloatingToolbar={false}
            className="bg-transparent shadow-none"
            editableClassName="prose prose-sm max-w-none px-0 py-0 min-h-[200px] outline-none text-sm text-foreground/90 [&_ul]:my-2 [&_ol]:my-2 [&_p]:my-1 [&_h1]:text-xl [&_h2]:text-lg"
        />
    )
}

export function ArtifactNotes({ data, artifact }: { data: MessageArtifactResult, artifact: NotesArtifact }) {
    const artifactId = useArtifactStore((state) => state.currentArtifactId)

    return (
        <div className="min-h-[240px] rounded-xl bg-muted/20 p-4 sm:p-6">
            <NotesMarkdownEditor data={data} key={artifactId ?? "notes"} markdown={artifact.content} />
        </div>
    )
}
