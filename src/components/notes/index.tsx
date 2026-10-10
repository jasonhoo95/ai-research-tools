"use client"

import GridLayout, {
    useContainerWidth,
    verticalCompactor,
    type Layout,
    type LayoutItem,
    type ResizeHandleAxis,
} from "react-grid-layout"
import { GripVertical, Minus, Plus, Trash2 } from "lucide-react"
import type { Ref } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { Descendant } from "slate"

import { SlateEditor } from "@/components/slate/slate-editor"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import "react-grid-layout/css/styles.css"
import "react-resizable/css/styles.css"

const DEFAULT_BODY: Descendant[] = [
    {
        type: "paragraph",
        children: [{ text: "" }],
    },
]

function createDefaultBody(): Descendant[] {
    return structuredClone(DEFAULT_BODY)
}

function cloneBody(body: Descendant[]): Descendant[] {
    return structuredClone(body)
}

export type MasonryItem = {
    id: string
    heightClass?: string
    shadeClass?: string
    label?: string
    body?: Descendant[]
    className?: string

    // Grid position / size
    w?: number
    h?: number
    x?: number
    y?: number
}

type MasonryGridProps = {
    items: MasonryItem[]
    onReorder?: (items: MasonryItem[]) => void
    onLayoutChange?: (layout: Layout, items: MasonryItem[]) => void
    onColumnsChange?: (columnCount: number) => void
    /** Fired after a drag/resize finishes or a column is removed. */
    onLayoutCommit?: (items: MasonryItem[]) => void
    /** Fired when a card's title or body is edited. */
    onItemChange?: (
        id: string,
        patch: Pick<MasonryItem, "label" | "body">,
    ) => void
    /** When set, shows an "Add note" button in the toolbar. */
    onAddItem?: () => void
    /** When set, each card shows a delete button on hover. */
    onRemoveItem?: (id: string) => void
    initialColumnCount?: number
    rowHeight?: number
    className?: string
}

const ROW_HEIGHT = 52

const GRID_MARGIN: [number, number] = [16, 16]

const MIN_GRID_ROWS = 3

const MAX_EDITOR_HEIGHT = 500

const CARD_VERTICAL_PADDING = 32

const HEADER_GAP = 8

/**
 * Convert an actual pixel height into react-grid-layout rows.
 */
function pixelsToGridRows(
    pixelHeight: number,
    rowHeight: number,
    marginY: number,
) {
    return Math.max(
        MIN_GRID_ROWS,
        Math.ceil(
            (pixelHeight + marginY) /
            (rowHeight + marginY),
        ),
    )
}

/**
 * Maximum number of rows a card can occupy.
 */
function getMaxGridRows(rowHeight: number) {
    const maxCardHeight =
        MAX_EDITOR_HEIGHT +
        CARD_VERTICAL_PADDING +
        56 +
        HEADER_GAP

    return pixelsToGridRows(
        maxCardHeight,
        rowHeight,
        GRID_MARGIN[1],
    )
}

const HEIGHT_TO_ROWS: Record<string, number> = {
    "h-52": 4,
    "h-56": 4,
    "h-60": 5,
    "h-64": 5,
    "h-72": 6,
    "h-80": 7,
}

function getItemRows(item: MasonryItem) {
    return (
        item.h ??
        HEIGHT_TO_ROWS[item.heightClass ?? ""] ??
        4
    )
}

/**
 * Custom bottom-right resize handle.
 *
 * Even though the handle itself is at the bottom-right,
 * react-grid-layout/react-resizable gives us the resize axis.
 *
 * We use the axis to provide the correct cursor:
 *
 *  e  = horizontal
 *  s  = vertical
 *  se = horizontal + vertical
 */
function PinResizeHandle(
    axis: ResizeHandleAxis,
    ref: Ref<HTMLElement>,
) {
    const cursorClass =
        axis === "e"
            ? "cursor-e-resize"
            : axis === "s"
                ? "cursor-s-resize"
                : "cursor-se-resize"

    return (
        <div
            ref={ref as Ref<HTMLDivElement>}
            aria-label="Resize pin"
            className={cn(
                "pin-resize-handle absolute bottom-2 right-2 z-20",
                "size-5 rounded-sm",
                "text-muted-foreground/70",
                "hover:text-foreground",
                "touch-none select-none",
                cursorClass,
            )}
            onMouseDown={(event) => {
                event.stopPropagation()
            }}
            onPointerDown={(event) => {
                event.stopPropagation()
            }}
        >
            <svg
                viewBox="0 0 10 10"
                className="size-full"
                aria-hidden="true"
            >
                <path
                    d="M9 1v8H1"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                />

                <path
                    d="M6 4v5H1"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1"
                    strokeLinecap="round"
                    opacity="0.5"
                />
            </svg>
        </div>
    )
}

/**
 * Create initial grid layout.
 */
function createLayout(
    items: MasonryItem[],
    columnCount: number,
): Layout {
    const columnHeights = Array.from(
        { length: columnCount },
        () => 0,
    )

    const maxRows = getMaxGridRows(ROW_HEIGHT)

    return items.map((item) => {
        const h = Math.min(
            getItemRows(item),
            maxRows,
        )

        const w = Math.min(
            Math.max(item.w ?? 1, 1),
            columnCount,
        )

        const hasPosition =
            item.x !== undefined &&
            item.y !== undefined

        if (hasPosition) {
            return {
                i: item.id,

                x: Math.min(
                    item.x!,
                    Math.max(0, columnCount - w),
                ),

                y: item.y!,

                w,
                h,

                minW: 1,
                maxW: columnCount,

                minH: MIN_GRID_ROWS,
                maxH: maxRows,
            }
        }

        /**
         * Find the shortest column.
         */
        const columnIndex =
            columnHeights.indexOf(
                Math.min(...columnHeights),
            )

        /**
         * Make sure a multi-column card still fits.
         */
        const safeX = Math.min(
            columnIndex,
            Math.max(0, columnCount - w),
        )

        const layoutItem: LayoutItem = {
            i: item.id,

            x: safeX,

            y: columnHeights[columnIndex],

            w,
            h,

            minW: 1,
            maxW: columnCount,

            minH: MIN_GRID_ROWS,
            maxH: maxRows,
        }

        /**
         * Reserve the occupied vertical space.
         */
        columnHeights[columnIndex] += h

        return layoutItem
    })
}

/**
 * Merge react-grid-layout's x/y/w/h back into our items.
 */
function mergeItemsWithLayout(
    items: MasonryItem[],
    layout: Layout,
): MasonryItem[] {
    const itemsById = new Map(
        items.map((item) => [
            item.id,
            item,
        ]),
    )

    const layoutIds = new Set(
        layout.map((entry) => entry.i),
    )

    const ordered = layout.flatMap(
        (entry) => {
            const item =
                itemsById.get(entry.i)

            if (!item) {
                return []
            }

            return [
                {
                    ...item,

                    x: entry.x,
                    y: entry.y,
                    w: entry.w,
                    h: entry.h,
                },
            ]
        },
    )

    const trailing = items.filter(
        (item) =>
            !layoutIds.has(item.id),
    )

    return [
        ...ordered,
        ...trailing,
    ]
}

/**
 * Place items that aren't in the layout yet (e.g. newly added notes)
 * at the bottom of the shortest column.
 */
function appendMissingToLayout(
    layout: Layout,
    items: MasonryItem[],
    columnCount: number,
): Layout {
    const known = new Set(
        layout.map((entry) => entry.i),
    )

    const missing = items.filter(
        (item) => !known.has(item.id),
    )

    if (missing.length === 0) {
        return layout
    }

    const columnHeights = Array.from(
        { length: columnCount },
        (_, column) =>
            layout.reduce(
                (bottom, entry) =>
                    column >= entry.x &&
                        column < entry.x + entry.w
                        ? Math.max(
                            bottom,
                            entry.y + entry.h,
                        )
                        : bottom,
                0,
            ),
    )

    const added = createLayout(
        missing,
        columnCount,
    ).map((entry) => {
        const columnIndex =
            columnHeights.indexOf(
                Math.min(...columnHeights),
            )

        const x = Math.min(
            columnIndex,
            Math.max(0, columnCount - entry.w),
        )

        const y = Math.max(
            ...columnHeights.slice(
                x,
                x + entry.w,
            ),
        )

        for (
            let column = x;
            column < x + entry.w;
            column++
        ) {
            columnHeights[column] =
                y + entry.h
        }

        return { ...entry, x, y }
    })

    return [...layout, ...added]
}

/**
 * When reducing the number of columns,
 * make sure every item still fits.
 */
function clampLayoutToColumns(
    layout: Layout,
    columnCount: number,
): Layout {
    return layout.map((entry) => {
        const w = Math.min(
            Math.max(entry.w, 1),
            columnCount,
        )

        return {
            ...entry,

            x: Math.min(
                entry.x,
                Math.max(0, columnCount - w),
            ),

            w,

            minW: 1,
            maxW: columnCount,
        }
    })
}

/** Sticky-note colours; `shadeClass` on an item can override these vars. */
export const NOTE_DEFAULT_SHADE =
    "[--note-bg:#d4eff1] [--note-fold-bg:#9fd3d9] [--note-ink:#1f3136] [--note-fold:26px] dark:[--note-bg:#1d3a3e] dark:[--note-fold-bg:#2c585e] dark:[--note-ink:#e3f4f5]"

/**
 * Individual pin card.
 */
function PinCard({
    item,
    onItemChange,
    onRemove,
}: {
    item: MasonryItem
    onItemChange?: MasonryGridProps["onItemChange"]
    onRemove?: () => void
}) {
    // Delete takes two clicks: the first arms it (red), the second deletes.
    const [confirmingDelete, setConfirmingDelete] =
        useState(false)

    useEffect(() => {
        if (!confirmingDelete) return
        const timer = setTimeout(
            () => setConfirmingDelete(false),
            3000,
        )
        return () => clearTimeout(timer)
    }, [confirmingDelete])

    const [label, setLabel] =
        useState(item.label ?? "")

    const [isEditing, setIsEditing] =
        useState(false)

    const [body, setBody] =
        useState<Descendant[]>(
            () =>
                item.body
                    ? cloneBody(item.body)
                    : createDefaultBody(),
        )

    const labelRef =
        useRef<HTMLSpanElement>(null)

    const handleBodyChange =
        useCallback(
            (value: Descendant[]) => {
                setBody(cloneBody(value))
                onItemChange?.(item.id, {
                    body: cloneBody(value),
                })
            },
            [item.id, onItemChange],
        )

    useEffect(() => {
        if (
            labelRef.current &&
            !isEditing
        ) {
            labelRef.current.textContent =
                label
        }
    }, [label, isEditing])

    const handleFocus = () => {
        setIsEditing(true)
    }

    const handleBlur = (
        event: React.FocusEvent<HTMLSpanElement>,
    ) => {
        const nextLabel =
            event.currentTarget.innerText

        setIsEditing(false)
        setLabel(nextLabel)

        if (nextLabel !== label) {
            onItemChange?.(item.id, {
                label: nextLabel,
            })
        }
    }

    return (
        // Sticky note with a folded top-right corner. The shadow is a
        // drop-shadow filter on this wrapper because the card itself is
        // clipped (box-shadow would be clipped with it).
        <div
            className={cn(
                "group/pin relative h-full min-h-0",
                "[filter:drop-shadow(0_1px_1.5px_rgb(0_0_0/0.10))_drop-shadow(0_4px_10px_rgb(0_0_0/0.05))]",
                "transition-[filter] hover:[filter:drop-shadow(0_2px_3px_rgb(0_0_0/0.12))_drop-shadow(0_10px_20px_rgb(0_0_0/0.08))]",
                item.shadeClass ?? NOTE_DEFAULT_SHADE,
                item.className,
            )}
        >
            <div
                className={cn(
                    "flex h-full min-h-0 flex-col rounded-lg p-4",
                    "bg-(--note-bg) text-(--note-ink)",
                    "[clip-path:polygon(0_0,calc(100%-var(--note-fold))_0,100%_var(--note-fold),100%_100%,0_100%)]",
                )}
            >
                {/* Header — keep clear of the folded corner */}
                <div className="flex shrink-0 items-start pr-4">
                    <span
                        ref={labelRef}
                        contentEditable={isEditing}
                        suppressContentEditableWarning
                        onClick={handleFocus}
                        onBlur={handleBlur}
                        onMouseDown={(event) =>
                            event.stopPropagation()
                        }
                        onKeyDown={(event) =>
                            event.stopPropagation()
                        }
                        className={cn(
                            "min-w-0 flex-1",
                            "whitespace-pre-wrap",
                            "break-words",
                            "text-base font-semibold leading-snug",
                            "outline-none",
                            !isEditing &&
                            "cursor-text",
                        )}
                    />
                </div>

                {/* Slate editor */}
                <div
                    className={cn(
                        "mt-2 min-h-0 flex-1",
                        "overflow-y-auto",
                    )}
                    onMouseDown={(event) =>
                        event.stopPropagation()
                    }
                    onPointerDown={(event) =>
                        event.stopPropagation()
                    }
                >
                    <SlateEditor
                        key={item.id}
                        value={body}
                        onChange={
                            handleBodyChange
                        }
                        placeholder="Add notes…"
                        showToolbar={false}
                        className={cn(
                            "rounded-lg border-0",
                            "bg-transparent",
                            "shadow-none",
                        )}
                        editableClassName={cn(
                            "prose prose-sm",
                            "max-w-none",
                            "px-0 py-1",
                            "min-h-[72px]",
                            "outline-none",
                            "text-sm leading-relaxed",
                            "text-(--note-ink)/85",
                            "[&_:is(h1,h2,h3,strong,a)]:text-(--note-ink)",
                            "[&_h1]:text-lg",
                            "[&_h2]:text-base",
                            // Bullets as hollow circles, like a checklist.
                            "[&_ul]:list-none [&_ul]:pl-0",
                            "[&_ul>li]:relative [&_ul>li]:my-1 [&_ul>li]:pl-6",
                            "[&_ul>li]:before:absolute [&_ul>li]:before:left-0 [&_ul>li]:before:top-[0.3em]",
                            "[&_ul>li]:before:size-3.5 [&_ul>li]:before:rounded-full [&_ul>li]:before:content-['']",
                            "[&_ul>li]:before:border-[1.5px] [&_ul>li]:before:border-(--note-ink)/40",
                        )}
                    />
                </div>
            </div>

            {/* Hover controls, tucked under the fold so they don't take
                title space: delete, then the drag handle. */}
            <div className="absolute right-1 top-[calc(var(--note-fold)+2px)] z-10 flex flex-col items-center gap-0.5">
                <button
                    type="button"


                    onMouseDown={(event) =>
                        event.stopPropagation()
                    }
                    onClick={() => {
                        onRemove()
                    }}
                    className={cn(
                        "rounded-md p-1 transition-[opacity,color,background-color] bg-(--note-bg) text-(--note-ink) opacity-0 group-hover/pin:opacity-60 hover:!opacity-100  hover:text-red-600",
                        "focus-visible:opacity-100 opacity-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--note-ink)/30",

                    )}
                >
                    <Trash2 className="pointer-events-none size-4" />
                </button>

                {/* Do not stopPropagation here; RGL needs the mousedown. */}
                <div
                    role="button"
                    tabIndex={0}
                    aria-label={`Drag ${item.label ?? item.id}`}
                    className={cn(
                        "drag-handle",
                        "cursor-grab touch-none select-none",
                        "rounded-md bg-(--note-bg) p-1 text-(--note-ink)",
                        "opacity-0 transition-opacity group-hover/pin:opacity-50 focus-visible:opacity-100",
                        "hover:!opacity-100 hover:bg-black/5",
                        "active:cursor-grabbing",
                    )}
                >
                    <GripVertical className="pointer-events-none size-4" />
                </div>
            </div>

            {/* Folded corner */}
            <div
                aria-hidden
                className={cn(
                    "pointer-events-none absolute right-0 top-0",
                    "size-(--note-fold) rounded-bl-md",
                    "bg-[linear-gradient(225deg,transparent_50%,var(--note-fold-bg)_50%)]",
                    "shadow-[-1px_1px_2px_rgb(0_0_0/0.08)]",
                    "[clip-path:polygon(0_0,100%_100%,0_100%)]",
                )}
            />
        </div>
    )
}

/**
 * Main masonry grid.
 */
export function NotesGrid({
    items,
    onReorder,
    onLayoutChange,
    onColumnsChange,
    onLayoutCommit,
    onItemChange,
    onAddItem,
    onRemoveItem,
    initialColumnCount = 4,
    rowHeight = ROW_HEIGHT,
    className,
}: MasonryGridProps) {
    const {
        width,
        containerRef,
        mounted,
    } = useContainerWidth()

    const [columnCount, setColumnCount] =
        useState(
            Math.max(
                1,
                initialColumnCount,
            ),
        )

    const [layout, setLayout] =
        useState<Layout>(() =>
            createLayout(
                items,
                Math.max(
                    1,
                    initialColumnCount,
                ),
            ),
        )

    /**
     * Give newly added items a slot in the grid.
     */
    useEffect(() => {
        const ids = new Set(
            items.map((item) => item.id),
        )
        setLayout((prev) =>
            appendMissingToLayout(
                // Drop slots of removed items.
                prev.filter((entry) =>
                    ids.has(entry.i),
                ),
                items,
                columnCount,
            ),
        )
    }, [items, columnCount])

    const itemMap = useMemo(
        () =>
            new Map(
                items.map((item) => [
                    item.id,
                    item,
                ]),
            ),
        [items],
    )

    /**
     * Publish layout changes.
     */
    const publishLayout =
        useCallback(
            (nextLayout: Layout) => {
                const mergedItems =
                    mergeItemsWithLayout(
                        items,
                        nextLayout,
                    )

                onLayoutChange?.(
                    nextLayout,
                    mergedItems,
                )

                onReorder?.(
                    mergedItems,
                )
            },
            [
                items,
                onLayoutChange,
                onReorder,
            ],
        )

    /**
     * Called after dragging or resizing.
     *
     * react-grid-layout gives us:
     *
     * x = column
     * y = row
     * w = width in columns
     * h = height in rows
     */
    function handleLayoutChange(
        nextLayout: Layout,
    ) {
        setLayout(nextLayout)
        publishLayout(nextLayout)
    }

    /**
     * Drag / resize finished — the final layout is ready to persist.
     */
    function handleInteractionStop(
        nextLayout: Layout,
    ) {
        onLayoutCommit?.(
            mergeItemsWithLayout(
                items,
                nextLayout,
            ),
        )
    }

    /**
     * Add a column.
     */
    function addColumn() {
        const nextCount =
            columnCount + 1

        setColumnCount(nextCount)

        onColumnsChange?.(
            nextCount,
        )
    }

    /**
     * Remove a column.
     */
    function removeColumn() {
        if (columnCount === 1) {
            return
        }

        const nextCount =
            columnCount - 1

        const nextLayout =
            clampLayoutToColumns(
                layout,
                nextCount,
            )

        setColumnCount(
            nextCount,
        )

        setLayout(nextLayout)

        onColumnsChange?.(
            nextCount,
        )

        publishLayout(
            nextLayout,
        )

        onLayoutCommit?.(
            mergeItemsWithLayout(
                items,
                nextLayout,
            ),
        )
    }

    return (
        <div
            className={cn(
                "space-y-3",
                className,
            )}
        >
            {/* Column controls */}
            <div className="flex items-center justify-end gap-2">
                {onAddItem ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mr-auto"
                        onClick={onAddItem}
                    >
                        <Plus className="size-4" />
                        Add note
                    </Button>
                ) : null}

                <span className="mr-1 text-sm text-muted-foreground">
                    {columnCount}{" "}
                    {columnCount === 1
                        ? "column"
                        : "columns"}
                </span>

                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Remove column"
                    disabled={
                        columnCount === 1
                    }
                    onClick={
                        removeColumn
                    }
                >
                    <Minus className="size-4" />
                </Button>

                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Add column"
                    onClick={addColumn}
                >
                    <Plus className="size-4" />
                </Button>
            </div>

            {/* Grid */}
            <div
                ref={containerRef}
                className={cn(
                    "masonry-grid",
                    "min-h-40",
                    "rounded-2xl",
                    "border border-dashed",
                    "border-border/70",
                    "bg-muted/10",
                    "p-2",

                    /*
                     * Animate position/size changes.
                     */
                    "[&_.react-grid-item]:transition-[transform,width,height]",
                    "[&_.react-grid-item]:duration-200",

                    /*
                     * Placeholder shown while dragging.
                     */
                    "[&_.react-grid-item.react-grid-placeholder]:rounded-2xl",
                    "[&_.react-grid-item.react-grid-placeholder]:border",
                    "[&_.react-grid-item.react-grid-placeholder]:border-dashed",
                    "[&_.react-grid-item.react-grid-placeholder]:border-primary/30",

                    /*
                     * Hide react-grid-layout's default handle.
                     * We use our own bottom-right handle.
                     */
                    "[&_.react-grid-item>.react-resizable-handle]:hidden",

                    /*
                     * Show our custom handle on hover.
                     */
                    "[&_.react-grid-item>.pin-resize-handle]:opacity-0",
                    "[&_.react-grid-item:hover>.pin-resize-handle]:opacity-100",
                )}
            >
                {mounted &&
                    width > 0 ? (
                    <GridLayout
                        width={width}
                        layout={layout}
                        compactor={
                            verticalCompactor
                        }
                        gridConfig={{
                            cols: columnCount,

                            rowHeight,

                            containerPadding:
                                [8, 8],

                            margin:
                                GRID_MARGIN,
                        }}
                        dragConfig={{
                            enabled: true,
                            bounded: false,
                            handle: ".drag-handle",
                            cancel:
                                "[contenteditable='true'], .pin-resize-handle",
                        }}
                        resizeConfig={{
                            enabled: true,

                            /*
                             * All three resize axes.
                             *
                             * e:
                             *   horizontal
                             *
                             * s:
                             *   vertical
                             *
                             * se:
                             *   horizontal + vertical
                             */
                            handles: [
                                "e",
                                "s",
                                "se",
                            ],

                            handleComponent:
                                PinResizeHandle,
                        }}
                        onLayoutChange={
                            handleLayoutChange
                        }
                        onDragStop={
                            handleInteractionStop
                        }
                        onResizeStop={
                            handleInteractionStop
                        }
                    >
                        {layout.map(
                            (entry) => {
                                const item =
                                    itemMap.get(
                                        entry.i,
                                    )

                                if (
                                    !item
                                ) {
                                    return null
                                }

                                return (
                                    <div
                                        key={
                                            entry.i
                                        }
                                        className="h-full"
                                    >
                                        <PinCard
                                            item={
                                                item
                                            }
                                            onItemChange={
                                                onItemChange
                                            }
                                            onRemove={
                                                onRemoveItem
                                                    ? () =>
                                                        onRemoveItem(
                                                            item.id,
                                                        )
                                                    : undefined
                                            }
                                        />
                                    </div>
                                )
                            },
                        )}
                    </GridLayout>
                ) : (
                    <div className="flex min-h-36 items-center justify-center text-sm text-muted-foreground">
                        Loading grid...
                    </div>
                )}
            </div>
        </div>
    )
}
