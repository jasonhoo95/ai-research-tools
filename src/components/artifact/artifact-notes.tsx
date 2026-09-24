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
function NotesMarkdownEditor({ data, markdown }: { data: MessageArtifactResult, markdown: string }) {
    // const document = React.useMemo<Descendant[]>(
    //     () => markdownToSlateDocument(markdown),
    //     [markdown],
    // )

    const handleChange = React.useCallback((value: Descendant[]) => {
        const next = value
        console.log("next", next);
        const artifactData = {
            id: data.content.id,
            artifact: {
                ...data.content.artifact,
                content: next,
            }

        }
        console.log("data content", artifactData);
        chatRepo.updateMessageArtifact(data.parent_chatbot_id, data.id, {
            ...artifactData,
        })
        // const { currentArtifactId, artifacts, updateArtifact } =
        //     useArtifactStore.getState()
        // if (!currentArtifactId) return

        // const entry = artifacts[currentArtifactId]
        // if (!entry || entry.artifact.kind !== "notes") return
        // if (entry.artifact.content === next) return

        // updateArtifact(currentArtifactId, {
        //     ...entry.artifact,
        //     content: next,
        // })

        // console.log("artifact notes", artifacts)
    }, [])

    return (
        <SlateEditor
            value={markdown}
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
    const markdown = artifact.content.length > 0 ? artifact.content : markdownToSlateDocument(artifact.content.trim())

    return (
        <div className="min-h-[240px] rounded-xl bg-muted/20 p-4 sm:p-6">
            <NotesMarkdownEditor data={data} key={artifactId ?? "notes"} markdown={markdown} />
        </div>
    )
}
