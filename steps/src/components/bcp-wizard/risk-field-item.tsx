/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Field,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { type UseFormReturn } from "react-hook-form"

const HAZARD_OPTIONS = [
  { value: "地震", label: "震度6強の地震" },
  { value: "水害", label: "風水害（台風・大雨・洪水等）" },
  { value: "感染症", label: "感染症のまん延" },
  { value: "その他", label: "その他" },
] as const

const DOWNTIME_OPTIONS = [
  { value: 1, label: "1日以内" },
  { value: 3, label: "3日以内" },
  { value: 7, label: "7日以内" },
  { value: 14, label: "14日以内" },
  { value: 30, label: "30日以内" },
] as const

interface RiskFieldItemProps {
  field: any
  index: number
  form: UseFormReturn<any>
  onRemove: () => void
}

export function RiskFieldItem({ field, index, form, onRemove }: RiskFieldItemProps) {
  // 旧データ（カンマ区切り文字列など）が来ても配列として扱う
  const getSelectedTypes = (): string[] => {
    const value = form.getValues("risks." + index + ".type")
    return Array.isArray(value) ? value : []
  }

  const toggleHazard = (type: string) => {
    const current = getSelectedTypes()
    if (current.includes(type)) {
      form.setValue("risks." + index + ".type", current.filter((t) => t !== type))
    } else {
      form.setValue("risks." + index + ".type", [...current, type])
    }
  }

  const fieldErrors = form.formState.errors as any

  return (
    <Field key={field.id} className="space-y-3 p-4 border rounded-lg bg-muted/50">
      <div className="flex justify-between items-start gap-2">
        <FieldLabel>リスク {index + 1}</FieldLabel>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={onRemove}
        >
          削除
        </Button>
      </div>

      <div className="space-y-2">
        <FieldLabel>想定ハザード</FieldLabel>
        <div className="grid grid-cols-2 gap-2">
          {HAZARD_OPTIONS.map((hazard) => (
            <Button
              key={hazard.value}
              type="button"
              variant={
                getSelectedTypes().includes(hazard.value)
                  ? "default"
                  : "outline"
              }
              size="sm"
              onClick={() => toggleHazard(hazard.value)}
              className="w-full text-left"
            >
              {hazard.label}
            </Button>
          ))}
        </div>
        <Input
          {...form.register("risks." + index + ".type")}
          className="sr-only"
          aria-hidden="true"
        />
        {fieldErrors.risks?.[index]?.type && (
          <FieldError>
            {String(fieldErrors.risks[index].type?.message ?? "")}
          </FieldError>
        )}
      </div>

      <div className="space-y-1">
        <FieldLabel>被害想定</FieldLabel>
        <Input
          {...form.register("risks." + index + ".impact")}
          defaultValue={field.impact ?? ""}
          placeholder="施設・設備・人員への影響を具体的に..."
          className="min-h-[80px]"
        />
        {fieldErrors.risks?.[index]?.impact && (
          <FieldError>
            {String(fieldErrors.risks[index].impact?.message ?? "")}
          </FieldError>
        )}
      </div>

      <div className="space-y-1">
        <FieldLabel>業務停止の許容日数</FieldLabel>
        <div className="flex gap-2">
          {DOWNTIME_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={
                field.maxDowntimeDays === option.value
                  ? "default"
                  : "outline"
              }
              size="sm"
              onClick={() =>
                form.setValue("risks." + index + ".maxDowntimeDays", option.value)
              }
            >
              {option.label}
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          業務が停止可能な最大日数を選択してください
        </p>
        {fieldErrors.risks?.[index]?.maxDowntimeDays && (
          <FieldError>
            {String(fieldErrors.risks[index].maxDowntimeDays?.message ?? "")}
          </FieldError>
        )}
      </div>
    </Field>
  )
}
