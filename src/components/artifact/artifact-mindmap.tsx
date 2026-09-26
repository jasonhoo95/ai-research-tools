"use client"

import "@xyflow/react/dist/style.css"

import * as React from "react"
import dagre from "@dagrejs/dagre"
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  ConnectionMode,
  Controls,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  getBezierPath,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type OnConnectEnd,
} from "@xyflow/react"
import {
  ArrowRight,
  LayoutGrid,
  Maximize2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react"

import { Markdown } from "@/components/markdown"
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import type { MessageArtifactResult } from "@/lib/chat-repo"
import type { MindmapArtifact } from "@/lib/chat-types"
import { cn } from "@/lib/utils"
import { useSaveArtifact } from "@/components/artifact/artifact-document"

const SAVE_DELAY_MS = 600
/** Nodes are a fixed width so the auto layout can predict their size. */
const NODE_WIDTH = 208
const NODE_HEIGHT = 56
const ACCENT = "#f97316"
/** Bigger maps open on the start of the sequence instead of fitting all. */
const FIT_ALL_MAX_NODES = 8
const START_ZOOM = 0.9

/** Raw row returned by the message-artifact endpoint. */
type StoredArtifactRow = {
  id: string
  parent_chatbot_id: string
  content: { id: string; artifact: MindmapArtifact }
}

type TopicData = { title: string; description: string }
type TopicNode = Node<TopicData, "topic">
type RelationEdge = Edge<{ label?: string }, "relation">

// ---------------------------------------------------------------------------
// Conversion and layout
// ---------------------------------------------------------------------------

function relationEdge(id: string, source: string, target: string, label?: string): RelationEdge {
  return {
    id,
    source,
    target,
    type: "relation",
    data: { label },
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: "#a1a1aa" },
  }
}

/** Left-to-right layered layout, so the sequence reads like a timeline. */
function layoutNodes(nodes: TopicNode[], edges: RelationEdge[]): TopicNode[] {
  const graph = new dagre.graphlib.Graph()
  graph.setGraph({ rankdir: "LR", nodesep: 36, ranksep: 120, marginx: 24, marginy: 24 })
  graph.setDefaultEdgeLabel(() => ({}))
  for (const node of nodes) {
    graph.setNode(node.id, {
      width: node.measured?.width ?? NODE_WIDTH,
      height: node.measured?.height ?? NODE_HEIGHT,
    })
  }
  for (const edge of edges) graph.setEdge(edge.source, edge.target)
  dagre.layout(graph)

  return nodes.map((node) => {
    const point = graph.node(node.id)
    const width = node.measured?.width ?? NODE_WIDTH
    const height = node.measured?.height ?? NODE_HEIGHT
    return { ...node, position: { x: point.x - width / 2, y: point.y - height / 2 } }
  })
}

function toFlow(artifact: MindmapArtifact) {
  const edges = artifact.edges.map((e) => relationEdge(e.id, e.source, e.target, e.label))
  const nodes: TopicNode[] = artifact.nodes.map((n) => ({
    id: n.id,
    type: "topic",
    position: n.position ?? { x: 0, y: 0 },
    data: { title: n.title, description: n.description },
  }))
  // Generated maps have no positions yet — lay them out.
  const laidOut = artifact.nodes.some((n) => !n.position) ? layoutNodes(nodes, edges) : nodes
  return { nodes: laidOut, edges }
}

function toArtifact(
  base: MindmapArtifact,
  nodes: TopicNode[],
  edges: RelationEdge[],
): MindmapArtifact {
  return {
    ...base,
    nodes: nodes.map((n) => ({
      id: n.id,
      title: n.data.title,
      description: n.data.description,
      position: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      ...(e.data?.label ? { label: e.data.label } : {}),
    })),
  }
}

// ---------------------------------------------------------------------------
// Canvas pieces
// ---------------------------------------------------------------------------

type MindmapActions = {
  rootIds: ReadonlySet<string>
  editingId: string | null
  setEditingId: (id: string | null) => void
  rename: (id: string, title: string) => void
  remove: (id: string) => void
}

const MindmapActionsContext = React.createContext<MindmapActions | null>(null)

function useMindmapActions() {
  const actions = React.useContext(MindmapActionsContext)
  if (!actions) throw new Error("Mind map node rendered outside its canvas")
  return actions
}

/** Title editor shown in place of the node label. */
function NodeTitleInput({
  value,
  onDone,
}: {
  value: string
  onDone: (title: string | null) => void
}) {
  const [draft, setDraft] = React.useState(value)
  const doneRef = React.useRef(false)
  const finish = (title: string | null) => {
    if (doneRef.current) return
    doneRef.current = true
    onDone(title)
  }

  return (
    <textarea
      autoFocus
      rows={2}
      value={draft}
      aria-label="Node title"
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => finish(draft)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === "Enter") {
          e.preventDefault()
          finish(draft)
        } else if (e.key === "Escape") {
          e.preventDefault()
          finish(null)
        }
      }}
      className="nodrag nopan nowheel block w-full resize-none rounded-md bg-white px-1.5 py-0.5 text-center text-sm leading-snug font-medium text-[#27272a] ring-2 ring-[#f97316]/40 outline-none"
    />
  )
}

function TopicNodeView({ id, data, selected }: NodeProps<TopicNode>) {
  const { rootIds, editingId, setEditingId, rename, remove } = useMindmapActions()
  const isRoot = rootIds.has(id)
  const editing = editingId === id

  // `.valid` marks the dot a dragged line will snap to.
  const handleClass =
    "!size-3 !border-2 !border-[#f97316] !bg-white transition-transform hover:!scale-125 [&.valid]:!scale-150 [&.valid]:!bg-[#f97316]"

  return (
    <div
      className={cn(
        "group/node relative rounded-xl border px-4 py-3 text-center text-sm leading-snug font-medium shadow-sm transition-shadow hover:shadow-md",
        isRoot
          ? "border-transparent bg-[#f97316] text-white"
          : "border-(--border) bg-(--card) text-(--card-foreground)",
        selected && "ring-2 ring-[#f97316]/50 ring-offset-2 ring-offset-(--background)",
      )}
      style={{ width: NODE_WIDTH }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        setEditingId(id)
      }}
    >
      {/* Incoming (from the parent): only receives, never starts a line. */}
      <Handle
        type="target"
        position={Position.Left}
        isConnectableStart={false}
        // React Flow turns pointer events off on a dot that can't start a
        // line, so a press would fall through and drag the node. Catch it
        // (the handle is nodrag) so pressing this dot does nothing.
        className={cn(handleClass, "!pointer-events-auto !cursor-default")}
      />

      {editing ? (
        <NodeTitleInput
          value={data.title}
          onDone={(title) => {
            setEditingId(null)
            if (title !== null) rename(id, title)
          }}
        />
      ) : (
        <span className="line-clamp-3 break-words">{data.title || "Untitled"}</span>
      )}

      {!editing ? (
        // Above the node, clear of the edges and their labels at its sides.
        // The bottom padding bridges the gap so hover isn't lost on the way.
        <div className="nodrag nopan absolute bottom-full left-1/2 flex -translate-x-1/2 gap-1 pb-1.5 opacity-0 transition-opacity group-hover/node:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            aria-label={`Rename ${data.title}`}
            title="Rename"
            onClick={(e) => {
              e.stopPropagation()
              setEditingId(id)
            }}
            className="flex size-6 items-center justify-center rounded-full border border-(--border) bg-(--card) text-(--muted-foreground) shadow-sm hover:text-(--foreground)"
          >
            <Pencil className="size-3" />
          </button>
          <button
            type="button"
            aria-label={`Delete ${data.title}`}
            title="Delete"
            onClick={(e) => {
              e.stopPropagation()
              remove(id)
            }}
            className="flex size-6 items-center justify-center rounded-full border border-(--border) bg-(--card) text-(--muted-foreground) shadow-sm hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="size-3" />
          </button>
        </div>
      ) : null}

      {/* Outgoing (to children): drag from here to a child's left dot. */}
      <Handle
        type="source"
        position={Position.Right}
        isConnectableEnd={false}
        className={cn(handleClass, "!cursor-crosshair")}
      />
    </div>
  )
}

function RelationEdgeView({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  selected,
  data,
}: EdgeProps<RelationEdge>) {
  const { deleteElements } = useReactFlow()
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        markerEnd={markerEnd}
        interactionWidth={24}
        style={{
          stroke: selected ? ACCENT : "#a1a1aa",
          strokeWidth: selected ? 2.25 : 1.5,
        }}
      />
      {data?.label || selected ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto absolute flex items-center gap-1"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            {data?.label ? (
              <span className="max-w-36 truncate rounded-full border border-(--border) bg-(--card) px-2 py-0.5 text-[11px] text-(--muted-foreground) shadow-xs">
                {data.label}
              </span>
            ) : null}
            {selected ? (
              <button
                type="button"
                aria-label="Delete connection"
                title="Delete connection"
                onClick={() => deleteElements({ edges: [{ id }] })}
                className="flex size-5 items-center justify-center rounded-full bg-[#f97316] text-white shadow-sm hover:bg-[#ea580c]"
              >
                <X className="size-3" />
              </button>
            ) : null}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}

const nodeTypes = { topic: TopicNodeView }
const edgeTypes = { relation: RelationEdgeView }

// ---------------------------------------------------------------------------
// Sheet and dialog
// ---------------------------------------------------------------------------

function NodeDetailsSheet({
  open,
  node,
  step,
  total,
  incoming,
  outgoing,
  onClose,
  onChange,
  onDelete,
  onOpenNode,
}: {
  open: boolean
  /** Kept after closing so the sheet doesn't empty while sliding out. */
  node: TopicNode | null
  step: number
  total: number
  incoming: Array<{ node: TopicNode; label?: string }>
  outgoing: Array<{ node: TopicNode; label?: string }>
  onClose: () => void
  onChange: (id: string, patch: Partial<TopicData>) => void
  onDelete: (id: string) => void
  onOpenNode: (id: string) => void
}) {
  const [editingDescription, setEditingDescription] = React.useState(false)
  const [titleDraft, setTitleDraft] = React.useState("")
  const [descriptionDraft, setDescriptionDraft] = React.useState("")

  // Reset the drafts each time a node is opened.
  const [draftFor, setDraftFor] = React.useState<string | null>(null)
  if (!open && draftFor !== null) setDraftFor(null)
  if (open && node && draftFor !== node.id) {
    setDraftFor(node.id)
    setTitleDraft(node.data.title)
    setDescriptionDraft(node.data.description)
    setEditingDescription(false)
  }

  const commitTitle = () => {
    if (!node) return
    const title = titleDraft.replace(/\s+/g, " ").trim()
    if (!title) setTitleDraft(node.data.title)
    else if (title !== node.data.title) onChange(node.id, { title })
  }

  const commitDescription = () => {
    if (!node) return
    const description = descriptionDraft.trim()
    if (description !== node.data.description) onChange(node.id, { description })
    setEditingDescription(false)
  }

  const renderLinks = (
    heading: string,
    links: Array<{ node: TopicNode; label?: string }>,
  ) =>
    links.length ? (
      <div>
        <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {heading}
        </p>
        <ul className="flex flex-col gap-1.5">
          {links.map((link) => (
            <li key={link.node.id}>
              <button
                type="button"
                onClick={() => onOpenNode(link.node.id)}
                className="flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
              >
                <span className="min-w-0 flex-1 truncate">{link.node.data.title}</span>
                {link.label ? (
                  <span className="shrink-0 text-xs text-muted-foreground">{link.label}</span>
                ) : null}
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    ) : null

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent>
        {node ? (
          <>
            <SheetHeader>
              <SheetDescription>
                Step {step} of {total}
              </SheetDescription>
              <SheetTitle render={<div />}>
                <Input
                  value={titleDraft}
                  aria-label="Title"
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur()
                  }}
                  className="h-auto border-transparent px-2 py-1 text-lg font-semibold shadow-none hover:border-(--border) focus-visible:border-(--border)"
                />
              </SheetTitle>
            </SheetHeader>

            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-5">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    Details
                  </p>
                  {editingDescription ? null : (
                    <Button variant="ghost" size="sm" onClick={() => setEditingDescription(true)}>
                      <Pencil className="size-3.5" />
                      Edit
                    </Button>
                  )}
                </div>
                {editingDescription ? (
                  <div className="flex flex-col gap-2">
                    <Textarea
                      autoFocus
                      onFocus={(e) => {
                        const end = e.currentTarget.value.length
                        e.currentTarget.setSelectionRange(end, end)
                      }}
                      rows={10}
                      value={descriptionDraft}
                      aria-label="Details"
                      onChange={(e) => setDescriptionDraft(e.target.value)}
                      placeholder="What happened, when, and why it matters. Markdown works."
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDescriptionDraft(node.data.description)
                          setEditingDescription(false)
                        }}
                      >
                        Cancel
                      </Button>
                      <Button size="sm" onClick={commitDescription}>
                        Save
                      </Button>
                    </div>
                  </div>
                ) : node.data.description ? (
                  <div className="text-sm text-foreground/90">
                    <Markdown>{node.data.description}</Markdown>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingDescription(true)}
                    className="w-full rounded-lg border border-dashed px-3 py-6 text-sm text-muted-foreground hover:bg-muted"
                  >
                    Add details
                  </button>
                )}
              </div>

              {renderLinks("Comes from", incoming)}
              {renderLinks("Leads to", outgoing)}
            </div>

            <SheetFooter>
              <Button
                variant="ghost"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => onDelete(node.id)}
              >
                <Trash2 className="size-4" />
                Delete node
              </Button>
            </SheetFooter>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

function AddNodeDialog({
  open,
  onOpenChange,
  connectFrom,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectFrom: string | null
  onAdd: (input: TopicData) => void
}) {
  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = title.replace(/\s+/g, " ").trim()
    if (!trimmed) return
    onAdd({ title: trimmed, description: description.trim() })
    setTitle("")
    setDescription("")
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Add node</DialogTitle>
            <DialogDescription>
              {connectFrom
                ? `It will be connected after "${connectFrom}".`
                : "Drag from its dots afterwards to connect it."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="mindmap-node-title">Title</Label>
            <Input
              id="mindmap-node-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Battle of the Somme"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mindmap-node-description">Description</Label>
            <Textarea
              id="mindmap-node-description"
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What happened, when, and why it matters. Markdown works."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              Add node
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------

function MindmapCanvas({
  artifact,
  data,
}: {
  artifact: MindmapArtifact
  data?: MessageArtifactResult
}) {
  const initial = React.useMemo(() => toFlow(artifact), [artifact])
  const [nodes, setNodes, onNodesChange] = useNodesState<TopicNode>(initial.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<RelationEdge>(initial.edges)
  const { deleteElements, fitView, screenToFlowPosition, getNode, setViewport } = useReactFlow<
    TopicNode,
    RelationEdge
  >()
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  const [editingId, setEditingId] = React.useState<string | null>(null)
  // The sheet's node stays set after closing, while it slides out.
  const [openId, setOpenId] = React.useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = React.useState(false)
  const [addOpen, setAddOpen] = React.useState(false)

  // --- saving -------------------------------------------------------------
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = React.useRef<string | null>(null)
  const latestRef = React.useRef({ nodes, edges })

  const saveArtifact = useSaveArtifact()

  const saveNow = React.useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    if (!data) return
    const row = data as unknown as StoredArtifactRow
    const next = toArtifact(artifact, latestRef.current.nodes, latestRef.current.edges)
    const artifactData = {
      id: row.content.id,
      artifact: { ...row.content.artifact, ...next },
    }
    const serialized = JSON.stringify(artifactData)
    if (serialized === lastSavedRef.current) return
    lastSavedRef.current = serialized
    saveArtifact(row.parent_chatbot_id, row.id, artifactData as never)
      .catch((err) => {
        lastSavedRef.current = null
        console.error("Failed to save mind map", err)
      })
  }, [artifact, data, saveArtifact])

  // Opening a map is not an edit: its laid-out state counts as saved, so
  // only real changes write back.
  React.useEffect(() => {
    if (!data) return
    const row = data as unknown as StoredArtifactRow
    lastSavedRef.current = JSON.stringify({
      id: row.content?.id,
      artifact: {
        ...row.content?.artifact,
        ...toArtifact(artifact, initial.nodes, initial.edges),
      },
    })
  }, [artifact, data, initial])

  React.useEffect(() => {
    setNodes(initial.nodes)
    setEdges(initial.edges)
  }, [initial, setNodes, setEdges])

  // Positions, titles, links… any change lands here; unchanged state is
  // skipped by the JSON comparison in saveNow.
  const didMountRef = React.useRef(false)
  React.useEffect(() => {
    latestRef.current = { nodes, edges }
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(saveNow, SAVE_DELAY_MS)
  }, [nodes, edges, saveNow])

  // Flush a pending save when leaving the page.
  React.useEffect(
    () => () => {
      if (saveTimerRef.current) saveNow()
    },
    [saveNow],
  )

  // --- graph edits --------------------------------------------------------
  const rootIds = React.useMemo(() => {
    const targets = new Set(edges.map((e) => e.target))
    return new Set(nodes.filter((n) => !targets.has(n.id)).map((n) => n.id))
  }, [nodes, edges])

  const updateNode = React.useCallback(
    (id: string, patch: Partial<TopicData>) =>
      setNodes((current) =>
        current.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
      ),
    [setNodes],
  )

  const rename = React.useCallback(
    (id: string, title: string) => {
      const next = title.replace(/\s+/g, " ").trim()
      if (next) updateNode(id, { title: next })
    },
    [updateNode],
  )

  const remove = React.useCallback(
    (id: string) => {
      if (openId === id) setSheetOpen(false)
      // Also removes the node's connections.
      void deleteElements({ nodes: [{ id }] })
    },
    [deleteElements, openId],
  )

  // Parent → child only: no self-links, no duplicates, and no loops (a node
  // can't become the parent of one of its own ancestors).
  const canLink = React.useCallback(
    (source: string, target: string) => {
      if (source === target) return false
      if (edges.some((e) => e.source === source && e.target === target)) return false
      const children = new Map<string, string[]>()
      for (const e of edges) children.set(e.source, [...(children.get(e.source) ?? []), e.target])
      const stack = [target]
      const seen = new Set<string>()
      while (stack.length) {
        const id = stack.pop()!
        if (id === source) return false
        if (seen.has(id)) continue
        seen.add(id)
        stack.push(...(children.get(id) ?? []))
      }
      return true
    },
    [edges],
  )

  const isValidConnection = React.useCallback(
    (connection: Connection | RelationEdge) => canLink(connection.source, connection.target),
    [canLink],
  )

  const onConnect = React.useCallback(
    (connection: Connection) => {
      const { source, target } = connection
      if (!canLink(source, target)) return
      setEdges((current) =>
        addEdge(relationEdge(`edge_${crypto.randomUUID()}`, source, target), current),
      )
    },
    [canLink, setEdges],
  )

  // Dropping a new line anywhere on a node connects to it, not only on its dot.
  const onConnectEnd = React.useCallback<OnConnectEnd>(
    (event, state) => {
      if (state.isValid || !state.fromNode) return
      const point = "changedTouches" in event ? event.changedTouches[0] : event
      const targetId = document
        .elementFromPoint(point.clientX, point.clientY)
        ?.closest(".react-flow__node")
        ?.getAttribute("data-id")
      if (!targetId || state.fromHandle?.type !== "source") return
      // The dropped-on node becomes the child.
      onConnect({
        source: state.fromNode.id,
        target: targetId,
        sourceHandle: null,
        targetHandle: null,
      })
    },
    [onConnect],
  )

  const selectedNode = nodes.find((n) => n.selected) ?? null

  const addNode = React.useCallback(
    (input: TopicData) => {
      const id = `node_${crypto.randomUUID()}`
      const anchor = selectedNode ? getNode(selectedNode.id) : undefined
      let position: { x: number; y: number }
      if (anchor) {
        // Right of the selected node, below anything already there.
        const x = anchor.position.x + (anchor.measured?.width ?? NODE_WIDTH) + 120
        const siblings = nodes.filter((n) => Math.abs(n.position.x - x) < NODE_WIDTH / 2)
        const lowest = Math.max(
          anchor.position.y - NODE_HEIGHT - 36,
          ...siblings.map((n) => n.position.y),
        )
        position = { x, y: lowest + NODE_HEIGHT + 36 }
      } else {
        const rect = wrapperRef.current?.getBoundingClientRect()
        const center = screenToFlowPosition({
          x: (rect?.left ?? 0) + (rect?.width ?? 0) / 2,
          y: (rect?.top ?? 0) + (rect?.height ?? 0) / 2,
        })
        position = { x: center.x - NODE_WIDTH / 2, y: center.y - NODE_HEIGHT / 2 }
      }

      const node: TopicNode = { id, type: "topic", position, data: input, selected: true }
      setNodes((current) => {
        // Keep the sequence: insert right after the node it follows.
        const deselected = current.map((n) => (n.selected ? { ...n, selected: false } : n))
        const at = anchor ? deselected.findIndex((n) => n.id === anchor.id) + 1 : deselected.length
        return [...deselected.slice(0, at), node, ...deselected.slice(at)]
      })
      if (anchor) {
        setEdges((current) => [
          ...current,
          relationEdge(`edge_${crypto.randomUUID()}`, anchor.id, id),
        ])
      }
      setAddOpen(false)
      window.setTimeout(() => {
        void fitView({ nodes: [{ id }], maxZoom: 1, duration: 300, padding: 0.6 })
      }, 50)
    },
    [selectedNode, getNode, nodes, screenToFlowPosition, setNodes, setEdges, fitView],
  )

  const tidyUp = React.useCallback(() => {
    setNodes((current) => layoutNodes(current, edges))
    window.setTimeout(() => void fitView({ duration: 300, padding: 0.15 }), 50)
  }, [edges, setNodes, fitView])

  const openNode = React.useCallback(
    (id: string) => {
      setOpenId(id)
      setSheetOpen(true)
      setNodes((current) => current.map((n) => ({ ...n, selected: n.id === id })))
      void fitView({ nodes: [{ id }], maxZoom: 1, duration: 300, padding: 0.8 })
    },
    [setNodes, fitView],
  )

  // Fitting a long flow makes every title unreadable, so bigger maps open at
  // a readable zoom on the first node, like the start of a timeline; "Fit"
  // still shows everything.
  const showStart = React.useCallback(() => {
    const current = latestRef.current.nodes
    const rect = wrapperRef.current?.getBoundingClientRect()
    const first = current[0]
    if (current.length <= FIT_ALL_MAX_NODES || !rect || !first) {
      void fitView({ padding: 0.15, maxZoom: 1 })
      return
    }
    const left = Math.min(...current.map((n) => n.position.x))
    const firstCenterY = first.position.y + (first.measured?.height ?? NODE_HEIGHT) / 2
    void setViewport({
      x: 48 - left * START_ZOOM,
      y: rect.height / 2 - firstCenterY * START_ZOOM,
      zoom: START_ZOOM,
    })
  }, [fitView, setViewport])

  const actions = React.useMemo<MindmapActions>(
    () => ({ rootIds, editingId, setEditingId, rename, remove }),
    [rootIds, editingId, rename, remove],
  )

  // --- sheet data ---------------------------------------------------------
  const openNodeIndex = openId ? nodes.findIndex((n) => n.id === openId) : -1
  const sheetNode = openNodeIndex >= 0 ? nodes[openNodeIndex] : null
  const byId = React.useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes])
  const links = (direction: "in" | "out") =>
    edges
      .filter((e) => (direction === "in" ? e.target === openId : e.source === openId))
      .map((e) => ({
        node: byId.get(direction === "in" ? e.source : e.target),
        label: e.data?.label,
      }))
      .filter((l): l is { node: TopicNode; label: string | undefined } => Boolean(l.node))

  return (
    <MindmapActionsContext.Provider value={actions}>
      <div
        ref={wrapperRef}
        className="h-full min-h-[560px] overflow-hidden rounded-2xl border border-(--border) bg-(--muted)/30"
      >
        <ReactFlow<TopicNode, RelationEdge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectEnd={onConnectEnd}
          connectionRadius={32}
          onNodeClick={(_, node) => {
            if (editingId === node.id) return
            setOpenId(node.id)
            setSheetOpen(true)
          }}
          // Strict: lines run from a right (outgoing) dot to a left
          // (incoming) dot only.
          connectionMode={ConnectionMode.Strict}
          isValidConnection={isValidConnection}
          connectionLineStyle={{ stroke: ACCENT, strokeWidth: 2 }}
          deleteKeyCode={["Backspace", "Delete"]}
          onInit={showStart}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
          className="[&_.react-flow\_\_controls-button]:border-(--border)"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1.2} color="#d4d4d8" />
          <Controls showInteractive={false} position="bottom-left" />
          <MiniMap
            position="bottom-right"
            pannable
            zoomable
            nodeColor={(node) => (rootIds.has(node.id) ? ACCENT : "#d4d4d8")}
            nodeBorderRadius={8}
            className="!rounded-lg !border !border-(--border) !shadow-sm"
          />
          <Panel position="top-left" className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setAddOpen(true)} className="shadow-sm">
              <Plus className="size-4" />
              Add node
            </Button>
            <Button size="sm" variant="outline" onClick={tidyUp} className="bg-(--card) shadow-sm">
              <LayoutGrid className="size-4" />
              Tidy up
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void fitView({ duration: 300, padding: 0.15 })}
              className="bg-(--card) shadow-sm"
            >
              <Maximize2 className="size-4" />
              Fit
            </Button>
          </Panel>
          <Panel
            position="top-right"
            className="hidden rounded-lg border border-(--border) bg-(--card)/90 px-3 py-1.5 text-xs text-(--muted-foreground) shadow-sm md:block"
          >
            Click a node for details · drag from a right dot to a child · select a line to delete it
          </Panel>
        </ReactFlow>
      </div>

      <NodeDetailsSheet
        open={sheetOpen && sheetNode !== null}
        node={sheetNode}
        step={openNodeIndex + 1}
        total={nodes.length}
        incoming={sheetNode ? links("in") : []}
        outgoing={sheetNode ? links("out") : []}
        onClose={() => setSheetOpen(false)}
        onChange={updateNode}
        onDelete={remove}
        onOpenNode={openNode}
      />

      <AddNodeDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        connectFrom={selectedNode?.data.title ?? null}
        onAdd={addNode}
      />
    </MindmapActionsContext.Provider>
  )
}

/**
 * Generated mind map on a React Flow canvas: click a node for its details,
 * rename or delete nodes, drag between dots to connect them, and add new
 * nodes. Edits are saved back to the chat.
 */
export function ArtifactMindmap({
  artifact,
  data,
}: {
  artifact: MindmapArtifact
  data?: MessageArtifactResult
}) {
  return (
    <ReactFlowProvider>
      <MindmapCanvas artifact={artifact} data={data} />
    </ReactFlowProvider>
  )
}
