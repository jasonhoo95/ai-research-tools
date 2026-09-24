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
import { cn } from "@/lib/utils"

export type AppDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description?: string
    children?: React.ReactNode
    /** Footer content — omit to use default cancel/confirm buttons. */
    footer?: React.ReactNode
    cancelLabel?: string
    confirmLabel?: string
    onCancel?: () => void
    onConfirm?: () => void | Promise<void>
    submitting?: boolean
    confirmDisabled?: boolean
    hideFooter?: boolean
    /** When set, confirm button becomes `type="submit"` for this form id. */
    formId?: string
    size?: "sm" | "md" | "lg"
    className?: string
    showCloseButton?: boolean
}

const sizeClass: Record<NonNullable<AppDialogProps["size"]>, string> = {
    sm: "sm:max-w-sm",
    md: "sm:max-w-md",
    lg: "sm:max-w-lg",
}

export function AppDialog({
    open,
    onOpenChange,
    title,
    description,
    children,
    footer,
    cancelLabel = "Cancel",
    confirmLabel = "Confirm",
    onCancel,
    onConfirm,
    submitting = false,
    confirmDisabled = false,
    hideFooter = false,
    formId,
    size = "md",
    className,
    showCloseButton = true,
}: AppDialogProps) {
    const handleCancel = () => {
        onCancel?.()
        onOpenChange(false)
    }

    const handleConfirm = async () => {
        if (submitting || confirmDisabled) return
        await onConfirm?.()
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className={cn(sizeClass[size], className)}
                showCloseButton={showCloseButton}
            >
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description ? (
                        <DialogDescription>{description}</DialogDescription>
                    ) : null}
                </DialogHeader>

                {children ? <div className="py-1">{children}</div> : null}


            </DialogContent>
        </Dialog>
    )
}


export {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
