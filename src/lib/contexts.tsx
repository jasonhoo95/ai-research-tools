"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export type StepperItems = {
  name: string
  description: string
  tableData: Record<string, string>[]
}

export type StepperContextValue = {
  index: number
  setIndex: (index: number) => void
  stepCount: number
  items: StepperItems
  setItems: (items: StepperItems) => void
  submit: () => void
  setSubmit: (handler: () => void) => void
}

const defaultItems: StepperItems = {
  name: "",
  description: "",
  tableData: [],
}

export const StepperContext = createContext<StepperContextValue | null>(null)

export function StepperProvider({
  children,
  stepCount = 3,
  initialItems = defaultItems,
}: {
  children: ReactNode
  stepCount?: number
  initialItems?: StepperItems
}) {
  const [index, setIndex] = useState(0)
  const [items, setItems] = useState<StepperItems>(initialItems)
  const [submitHandler, setSubmitHandler] = useState<(() => void) | null>(null)

  const setSubmit = useCallback((handler: () => void) => {
    setSubmitHandler(() => handler)
  }, [])

  const submit = useCallback(() => {
    submitHandler?.()
  }, [submitHandler])

  const value = useMemo(
    () => ({
      index,
      setIndex,
      stepCount,
      items,
      setItems,
      submit,
      setSubmit,
    }),
    [index, stepCount, items, submit, setSubmit]
  )

  return (
    <StepperContext.Provider value={value}>{children}</StepperContext.Provider>
  )
}

export function useStepperContext(): StepperContextValue {
  const ctx = useContext(StepperContext)
  if (!ctx) {
    throw new Error("useStepperContext must be used within StepperProvider")
  }
  return ctx
}
