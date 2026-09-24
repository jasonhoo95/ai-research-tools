import { create } from "zustand"

import type { StepperItems } from "@/lib/contexts"

type TableCreateState = {
  draft: StepperItems
  setDraft: (draft: Partial<StepperItems>) => void
  resetDraft: () => void
}

const emptyDraft: StepperItems = {
  name: "",
  description: "",
  tableData: [],
}

export const useTableCreateStore = create<TableCreateState>((set) => ({
  draft: emptyDraft,
  setDraft(draft) {
    set((state) => ({ draft: { ...state.draft, ...draft } }))
  },
  resetDraft() {
    set({ draft: emptyDraft })
  },
}))
