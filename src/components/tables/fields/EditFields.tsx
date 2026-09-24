"use client"

import { useCallback, useEffect, useState } from "react"
import { v4 as uuidv4 } from "uuid"
import type { Descendant } from "slate"

import { SlateEditor } from "@/components/slate/slate-editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { fieldProperties, fieldTypes } from "@/config/table"
import { textToSlateDocument, slateDocumentToText } from "@/lib/text-to-slate"
import { useTableStore, type TableColumn, type TableRow } from "@/store/table-store"

type FieldItem = {
  id: string
  field: string
  value: string
  fieldValue: string
}

const FieldTypeComponent = ({
  row,
  column,
  field,
  id,
  setSelectedField,
  selectedField,
}: {
  row: TableRow
  column: TableColumn
  id: string
  field: FieldItem
  setSelectedField: (value: FieldItem[]) => void
  selectedField: FieldItem[]
}) => {
  const [enableEdit, setEnableEdit] = useState(false)
  const [value, setValue] = useState(field.value)
  const { currentTableId, updateCellObjectValue } = useTableStore()

  const inputRef = useCallback((node: HTMLInputElement | null) => {
    if (node) {
      node.focus()
      const length = node.value.length
      node.setSelectionRange(length, length)
    }
  }, [])

  const RenderPropertyField = () => {
    const handlePropertyClick = (name: string) => {
      if (name === "delete") {
        setSelectedField(selectedField.filter((f) => f.id !== id))
      }
    }

    const RenderField = () => {
      const [fieldType, setFieldType] = useState(field.field)

      const RenderEditField = () => {
        const [fieldValue, setFieldValue] = useState<string>(field.fieldValue)
        return (
          <div className="flex flex-col gap-3 text-sm">
            <label className="text-sm font-medium text-gray-700">Field Name</label>
            <Input
              placeholder="Edit field"
              value={fieldValue}
              onChange={(e) => setFieldValue(e.target.value)}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const updatedSelectedField = selectedField.map((f) =>
                  f.id === id ? { ...f, fieldValue } : f
                )
                setSelectedField(updatedSelectedField)
                updateCellObjectValue(currentTableId as string, row.id, column.key, {
                  descriptionOption: updatedSelectedField,
                })
              }}
            >
              Save
            </Button>
          </div>
        )
      }

      if (fieldType === "edit") {
        return <RenderEditField />
      }

      return (
        <div className="flex flex-col gap-3 text-sm">
          {fieldProperties.map((property) => (
            <div
              onClick={() => {
                handlePropertyClick(property.name)
                setFieldType(property.name)
              }}
              className="flex cursor-pointer items-center rounded-md p-2 hover:bg-gray-100"
              key={property.name}
            >
              {property.icon}
              {property.label}
            </div>
          ))}
        </div>
      )
    }

    return (
      <Popover>
        <PopoverTrigger>
          <div className="col-name-field cursor-pointer text-sm text-gray-700">
            {field.fieldValue}
          </div>
        </PopoverTrigger>
        <PopoverContent>
          <RenderField />
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {fieldTypes.find((f) => f.name === field.field)?.icon}
      <div className="flex items-center gap-5">
        <RenderPropertyField />
        {enableEdit ? (
          <Input
            ref={inputRef}
            onBlur={() => {
              setEnableEdit(false)
              updateCellObjectValue(currentTableId as string, row.id, column.key, {
                descriptionOption: selectedField,
              })
            }}
            onFocus={() => setEnableEdit(true)}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setSelectedField(
                selectedField.map((f) =>
                  f.id === id ? { ...f, value: e.target.value } : f
                )
              )
            }}
            placeholder={fieldTypes.find((f) => f.name === field.field)?.label}
          />
        ) : (
          <span onClick={() => setEnableEdit(true)} className="text-sm text-gray-700">
            {value}
          </span>
        )}
      </div>
    </div>
  )
}

export default function EditFields({ row, column }: { row: TableRow; column: TableColumn }) {
  const cellValue = row[column.key]
  const descriptionOption =
    typeof cellValue === "object" &&
    cellValue !== null &&
    "descriptionOption" in cellValue &&
    Array.isArray(cellValue.descriptionOption)
      ? (cellValue.descriptionOption as FieldItem[])
      : []

  const [selectedField, setSelectedField] = useState<FieldItem[]>(descriptionOption)
  const [body, setBody] = useState<Descendant[]>(() =>
    textToSlateDocument(
      typeof cellValue === "object" && cellValue !== null && "value" in cellValue
        ? String(cellValue.value ?? "")
        : ""
    )
  )

  const { currentTableId, updateCellObjectValue } = useTableStore()

  useEffect(() => {
    setSelectedField(descriptionOption)
  }, [descriptionOption])

  const handleDescriptionChange = useCallback(
    (value: Descendant[]) => {
      setBody(value)
      updateCellObjectValue(currentTableId as string, row.id, column.key, {
        value: slateDocumentToText(value),
        descriptionOption: selectedField,
      })
    },
    [column.key, currentTableId, row.id, selectedField, updateCellObjectValue]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-5">
        {selectedField.map((field) => (
          <FieldTypeComponent
            key={field.id}
            row={row}
            column={column}
            selectedField={selectedField}
            setSelectedField={setSelectedField}
            id={field.id}
            field={field}
          />
        ))}
      </div>
      <Popover>
        <PopoverTrigger className="text-left">
          <label className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-300">
            + Add a Property
          </label>
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <div className="space-y-2">
            <label className="mb-3 block text-sm font-medium text-gray-700">
              Add a Property
            </label>
            <div className="space-y-1">
              {fieldTypes.map((field, index) => (
                <div
                  key={field.name}
                  className="flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors hover:bg-gray-100"
                  onClick={() => {
                    setSelectedField([
                      ...selectedField,
                      {
                        id: uuidv4(),
                        field: field.name,
                        fieldValue: `${field.name}${index + 1}`,
                        value: "1",
                      },
                    ])
                  }}
                >
                  {field.icon}
                  <span className="text-sm text-gray-700">{field.label}</span>
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <div>
        <label className="text-sm font-medium text-gray-700">Field Description</label>
        <div className="rounded-lg border-2 border-gray-700 p-2">
          <SlateEditor
            value={body}
            onChange={handleDescriptionChange}
            placeholder="Edit description"
            showToolbar={false}
          />
        </div>
      </div>
    </div>
  )
}
