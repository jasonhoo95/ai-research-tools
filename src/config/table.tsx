import {
  Calculator,
  Calendar,
  Copy,
  Edit,
  Hash,
  Plus,
  Settings,
  Trash2,
  Type,
} from "lucide-react"
import type { ReactNode } from "react"

export type TableConfigItem = {
  name: string
  label: string
  icon: ReactNode
}

export const headerConfig: TableConfigItem[] = [
  { name: "edit", label: "Edit field", icon: <Edit className="size-4" /> },
  { name: "property", label: "Change property", icon: <Settings className="size-4" /> },
  { name: "add-left", label: "Insert left", icon: <Plus className="size-4" /> },
  { name: "add-right", label: "Insert right", icon: <Plus className="size-4" /> },
  { name: "duplicate", label: "Duplicate", icon: <Copy className="size-4" /> },
  { name: "delete", label: "Delete", icon: <Trash2 className="size-4 text-red-500" /> },
]

export const propertyConfig: TableConfigItem[] = [
  { name: "text", label: "Text", icon: <Type className="size-4" /> },
  { name: "number", label: "Number", icon: <Hash className="size-4" /> },
  { name: "date", label: "Date", icon: <Calendar className="size-4" /> },
  { name: "formula", label: "Formula", icon: <Calculator className="size-4" /> },
  { name: "description", label: "Description", icon: <Type className="size-4" /> },
]

export const formulaTypes = [
  { value: "sum", label: "Sum" },
  { value: "average", label: "Average" },
  { value: "count", label: "Count" },
  { value: "min", label: "Min" },
  { value: "max", label: "Max" },
]

export const fieldTypes: TableConfigItem[] = [
  { name: "text", label: "Text", icon: <Type className="size-4" /> },
  { name: "number", label: "Number", icon: <Hash className="size-4" /> },
  { name: "date", label: "Date", icon: <Calendar className="size-4" /> },
]

export const fieldProperties: TableConfigItem[] = [
  { name: "edit", label: "Edit name", icon: <Edit className="size-4" /> },
  { name: "delete", label: "Delete", icon: <Trash2 className="size-4 text-red-500" /> },
]

export const columnInfo = {
  title: "Import columns",
  description: "Upload a CSV file to define your table columns and rows.",
}
