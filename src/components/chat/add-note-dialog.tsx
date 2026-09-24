"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { noteTitleFromMarkdown } from "@/lib/chat-notesboard"
import type { ChatBubbleMessage } from "@/components/chat/message-bubble"

export type AddNoteDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    message: ChatBubbleMessage | null
    onSubmit: (input: { title: string; description: string }) => void | Promise<void>
    submitting?: boolean
}

export function AddNoteDialog({
    open,
    onOpenChange,
    message,
    onSubmit,
    submitting = false,
}: AddNoteDialogProps) {
    const [title, setTitle] = React.useState("")
    const [description, setDescription] = React.useState("")

    React.useEffect(() => {
        if (!open || !message) return
        setTitle(noteTitleFromMarkdown(message.content, message.role))
        setDescription(message.content)
    }, [open, message])

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        const trimmedTitle = title.trim()
        const trimmedDescription = description.trim()
        if (!trimmedTitle || !trimmedDescription || submitting) return
        await onSubmit({ title: trimmedTitle, description: trimmedDescription })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <form onSubmit={handleSubmit}>
                    <DialogHeader>
                        <DialogTitle>Add to notes</DialogTitle>
                        <DialogDescription>
                            Save this message as a note. Edit the title and description before
                            adding.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="note-title">Title</Label>
                            <Input
                                id="note-title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Note title"
                                autoFocus
                                required
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="note-description">Description</Label>
                            <Textarea
                                id="note-description"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Note content (markdown supported)"
                                className="min-h-[160px]"
                                required
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={submitting}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={submitting || !title.trim() || !description.trim()}>
                            {submitting ? "Adding…" : "Add note"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
