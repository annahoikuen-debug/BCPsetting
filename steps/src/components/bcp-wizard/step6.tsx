/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { preMeasureAndFinanceSchema } from "@/lib/validations/bcp"
import * as z from "zod"

interface Step6FormProps {
  defaultValues?: any
  onComplete: (data: any) => void
}

/** 備蓄品のプリセット */
const STOCKPILE_PRESETS = ["水", "食料", "簡易トイレ"] as const

/** 資金手当ての選択肢 */
const FUNDING_PLANS = [
  "自己資金",
  "金融機関融資",
  "補助金・助成金",
  "未定",
] as const

export function Step6Form({ defaultValues, onComplete }: Step6FormProps) {
  const form = useForm<any>({
    resolver: zodResolver(preMeasureAndFinanceSchema),
    defaultValues: {
      backupMethod: "",
      stockpileItems: STOCKPILE_PRESETS.map((name) => ({ name, stocked: false })),
      fundingPlan: "未定",
      hasInsurance: false,
      ...defaultValues,
    },
  })

  const toggleStocked = (index: number) => {
    const current = form.getValues(
      "stockpileItems." + index + ".stocked",
    ) as boolean
    form.setValue("stockpileItems." + index + ".stocked", !current)
  }

  const onSubmit = (data: any) => {
    onComplete(data)
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Separator orientation="horizontal" className="my-2" />
      <div className="space-y-4">
        <div>
          <FieldLabel>事前対策・財務</FieldLabel>
          <p className="text-sm text-muted-foreground">
            データバックアップ方法、備蓄品の備蓄状況、資金手当て、保険加入状況を入力してください。
          </p>
        </div>

        <div className="space-y-1">
          <FieldLabel>データバックアップ方法</FieldLabel>
          <Input
            {...form.register("backupMethod")}
            placeholder="例：クラウドバックアップ、外部HDD など"
            required
          />
          <FieldDescription>日常的にデータをバックアップしている方法を入力してください</FieldDescription>
          {form.formState.errors.backupMethod && (
            <FieldError>
              {String(form.formState.errors.backupMethod.message ?? "")}
            </FieldError>
          )}
        </div>

        <div className="space-y-1">
          <FieldLabel>備蓄品チェックリスト</FieldLabel>
          <p className="text-xs text-muted-foreground">
            備蓄済みのアイテムにチェックを入れてください。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {STOCKPILE_PRESETS.map((item, index) => {
              const current = form.getValues(
                "stockpileItems." + index + ".stocked",
              ) as boolean
              return (
                <Button
                  key={item}
                  type="button"
                  variant={current ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleStocked(index)}
                  className="w-full text-left"
                >
                  {current ? "✓ " : ""}{item}
                </Button>
              )
            })}
          </div>
        </div>

        <div className="space-y-1">
          <FieldLabel>資金手当て</FieldLabel>
          <Select
            onValueChange={(value: string) =>
              form.setValue("fundingPlan", value)
            }
            defaultValue={form.getValues("fundingPlan")}
          >
            <SelectTrigger>
              <SelectValue placeholder="選択" />
            </SelectTrigger>
            <SelectContent>
              {FUNDING_PLANS.map((plan) => (
                <SelectItem key={plan} value={plan}>
                  {plan}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.fundingPlan && (
            <FieldError>
              {String(form.formState.errors.fundingPlan.message ?? "")}
            </FieldError>
          )}
        </div>

        <div className="space-y-1">
          <FieldLabel>保険加入状況</FieldLabel>
          <div className="flex items-center gap-2">
            <input
              {...form.register("hasInsurance")}
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label className="text-sm text-foreground">BCP 関連の保険に加入している</label>
          </div>
          {form.formState.errors.hasInsurance && (
            <FieldError>
              {String(form.formState.errors.hasInsurance.message ?? "")}
            </FieldError>
          )}
        </div>

        <div className="flex justify-end">
          <Button type="submit">完了</Button>
        </div>
      </div>
    </form>
  )
}
