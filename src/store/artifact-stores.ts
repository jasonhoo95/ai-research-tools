"use client"

import { create } from "zustand"

import { chatRepo } from "@/lib/chat-repo"
import type { Artifact } from "@/lib/chat-types"

const AUTO_SAVE_DELAY_MS = 600
const SAVED_INDICATOR_MS = 2000

const saveTimers = new Map<string, ReturnType<typeof setTimeout>>()
const savedIndicatorTimers = new Map<string, ReturnType<typeof setTimeout>>()

export type StoredArtifact = {
  chatbotId: string
  artifactId: string
  artifact: Artifact
  dirty: boolean
}

type SaveStatus = "idle" | "pending" | "saving" | "saved" | "error"

type ArtifactStoreState = {
  artifacts: Record<string, StoredArtifact>
  currentArtifactId: string | null
  saving: boolean
  saveStatus: SaveStatus
  error: string | null
  setCurrentArtifact: (input: {
    chatbotId: string
    artifactId: string
    artifact: Artifact
  }) => void
  updateArtifact: (artifactId: string, artifact: Artifact) => void
  updateCurrentArtifact: (
    next: Artifact | ((current: Artifact) => Artifact),
  ) => void
  saveArtifact: (artifactId?: string) => Promise<void>
  scheduleAutoSave: (artifactId: string) => void
}

function clearSaveTimer(artifactId: string) {
  const timer = saveTimers.get(artifactId)
  if (timer) {
    clearTimeout(timer)
    saveTimers.delete(artifactId)
  }
}

function clearSavedIndicatorTimer(artifactId: string) {
  const timer = savedIndicatorTimers.get(artifactId)
  if (timer) {
    clearTimeout(timer)
    savedIndicatorTimers.delete(artifactId)
  }
}

export const useArtifactStore = create<ArtifactStoreState>((set, get) => ({
  artifacts: {},
  currentArtifactId: null,
  saving: false,
  saveStatus: "idle",
  error: null,

  setCurrentArtifact({ chatbotId, artifactId, artifact }) {
    clearSaveTimer(artifactId)
    clearSavedIndicatorTimer(artifactId)
    set((state) => ({
      currentArtifactId: artifactId,
      error: null,
      saveStatus: "idle",
      artifacts: {
        ...state.artifacts,
        [artifactId]: {
          chatbotId,
          artifactId,
          artifact,
          dirty: false,
        },
      },
    }))
  },

  updateArtifact(artifactId, artifact) {
    set((state) => {
      const existing = state.artifacts[artifactId]
      if (!existing) return state
      return {
        saveStatus: "pending",
        error: null,
        artifacts: {
          ...state.artifacts,
          [artifactId]: { ...existing, artifact, dirty: true },
        },
      }
    })
    get().scheduleAutoSave(artifactId)
  },

  updateCurrentArtifact(next) {
    const artifactId = get().currentArtifactId
    if (!artifactId) return
    const existing = get().artifacts[artifactId]
    if (!existing) return
    const artifact =
      typeof next === "function" ? next(existing.artifact) : next
    get().updateArtifact(artifactId, artifact)
  },

  scheduleAutoSave(artifactId) {
    clearSaveTimer(artifactId)
    saveTimers.set(
      artifactId,
      setTimeout(() => {
        saveTimers.delete(artifactId)
        void get()
          .saveArtifact(artifactId)
          .catch(() => {
            // Error state is stored on the store for UI.
          })
      }, AUTO_SAVE_DELAY_MS),
    )
  },

  async saveArtifact(artifactId) {
    const id = artifactId ?? get().currentArtifactId
    if (!id) return
    const entry = get().artifacts[id]
    if (!entry || !entry.dirty) return

    clearSaveTimer(id)
    set({ saving: true, saveStatus: "saving", error: null })

    try {
      await chatRepo.updateMessageArtifact(
        entry.chatbotId,
        entry.artifactId,
        entry.artifact,
      )
      set((state) => {
        const current = state.artifacts[id]
        if (!current) return { saving: false, saveStatus: "saved" as const }
        return {
          saving: false,
          saveStatus: "saved",
          artifacts: {
            ...state.artifacts,
            [id]: { ...current, dirty: false },
          },
        }
      })

      clearSavedIndicatorTimer(id)
      savedIndicatorTimers.set(
        id,
        setTimeout(() => {
          savedIndicatorTimers.delete(id)
          if (get().currentArtifactId === id && get().saveStatus === "saved") {
            set({ saveStatus: "idle" })
          }
        }, SAVED_INDICATOR_MS),
      )
    } catch (err) {
      set({
        saving: false,
        saveStatus: "error",
        error: err instanceof Error ? err.message : "Failed to update artifact",
      })
      throw err
    }
  },
}))
