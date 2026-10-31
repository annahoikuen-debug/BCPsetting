/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { FieldLabel } from "@/components/ui/field"
import { riskAssessmentSchema } from "@/lib/validations/bcp"
import * as z from "zod"
import { RiskFieldItem } from "@/components/bcp-wizard/risk-field-item"

interface Step3FormProps {
  defaultValues?: any[]
  onComplete: (data: any[]) => void
}

export function Step3Form({ defaultValues, onComplete }: Step3FormProps) {
  const form = useForm<any>({
    resolver: zodResolver(
      z.object({
        risks: z.array(riskAssessmentSchema),
      }),
    ),
    defaultValues: {
      risks: defaultValues ?? [
        { type: ["地震"], impact: "", maxDowntimeDays: 7 },
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "risks",
  })

  const onSubmit = (data: any) => {
    onComplete(data.risks)
  }

  const addRisk = () => {
    append({ type: ["地震"], impact: "", maxDowntimeDays: 7 })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Separator orientation="horizontal" className="my-2" />
      <div className="space-y-4">
        <div>
          <FieldLabel>想定リスク</FieldLabel>
          <p className="text-sm text-muted-foreground">
            想定するハザードを選択し、それぞれの被害想定と業務停止の許容日数を入力してください。
          </p>
        </div>

        <div className="space-y-2">
          {fields.map((field: any, index: number) => (
            <RiskFieldItem
              key={field.id}
              field={field}
              index={index}
              form={form as any}
              onRemove={() => remove(index)}
            />
          ))}

          <Button type="button" variant="outline" size="sm" onClick={addRisk}>
            リスクを追加
          </Button>
        </div>

        <div className="flex justify-end">
          <Button type="submit">次へ</Button>
        </div>
      </div>
    </form>
  )
}
