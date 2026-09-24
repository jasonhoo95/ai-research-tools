import { zodResolver } from "@hookform/resolvers/zod"
import { useCallback, useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useStepperContext } from "@/lib/contexts"

const formSchema = z.object({
  name: z.string().min(1, "Table name is required"),
  description: z.string().min(1, "Description is required"),
})

type FormSchema = z.infer<typeof formSchema>

export default function BasicInfo() {
  const { setSubmit, stepCount, setIndex, items, setItems } = useStepperContext()

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: items.name,
      description: items.description,
    },
  })

  const { handleSubmit } = form

  const onSubmit = useCallback(
    (data: FormSchema) => {
      setItems({
        ...items,
        name: data.name,
        description: data.description,
      })
      setIndex(stepCount + 1)
    },
    [items, setItems, setIndex, stepCount]
  )

  useEffect(() => {
    setSubmit(() => {
      void handleSubmit(onSubmit)()
    })
  }, [handleSubmit, onSubmit, setSubmit])

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Table Name</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </div>
  )
}
