/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useForm, useFieldArray } from "react-hook-form"
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
import { coreBusinessSchema } from "@/lib/validations/bcp"
import * as z from "zod"

interface Step4FormProps {
  defaultValues?: any[]
  onComplete: (data: any[]) => void
}

/** ボトルネック設備のプリセット選択肢 */
const BOTTLENECK_PRESETS = [
  "POSレジ",
  "NC工作機械",
  "クラウドサーバー",
  "製造ライン設備",
  "配送車両",
  "冷蔵・冷凍設備",
  "その他",
] as const

export function Step4Form({ defaultValues, onComplete }: Step4FormProps) {
  const form = useForm<any>({
    resolver: zodResolver(
      z.object({ coreBusinesses: z.array(coreBusinessSchema) }),
    ),
    defaultValues: {
      coreBusinesses: defaultValues ?? [
        { name: "", bottleneckEquipment: [] },
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "coreBusinesses",
  })

  const onSubmit = (data: any) => {
    onComplete(data.coreBusinesses)
  }

  const addBusiness = () => {
    append({ name: "", bottleneckEquipment: [] })
  }

  const toggleBottleneck = (businessIndex: number, equipment: string) => {
    const current =
      (form.getValues(
        "coreBusinesses." + businessIndex + ".bottleneckEquipment",
      ) as string[]) || []
    if (current.includes(equipment)) {
      form.setValue(
        "coreBusinesses." + businessIndex + ".bottleneckEquipment",
        current.filter((e: string) => e !== equipment),
      )
    } else {
      form.setValue(
        "coreBusinesses." + businessIndex + ".bottleneckEquipment",
        [...current, equipment],
      )
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Separator orientation="horizontal" className="my-2" />
      <div className="space-y-4">
        <div>
          <FieldLabel>中核事業</FieldLabel>
          <p className="text-sm text-muted-foreground">
            優先的に復旧すべき業務と、そのボトルネックとなる設備・資材・IT ツールを入力してください。
          </p>
        </div>

        <div className="space-y-2">
          {fields.map((field: any, index: number) => (
            <Field
              key={field.id}
              className="space-y-3 p-4 border rounded-lg bg-muted/50"
            >
              <div className="flex justify-between items-start gap-2">
                <FieldLabel>業務 {index + 1}</FieldLabel>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                >
                  削除
                </Button>
              </div>

              <div className="space-y-1">
                <FieldLabel>優先復旧する業務名</FieldLabel>
                <Input
                  {...form.register("coreBusinesses." + index + ".name")}
                  defaultValue={field.name ?? ""}
                  placeholder="例：受発注業務、製造業務、配送業務..."
                  className="min-h-[40px]"
                />
                {((form.formState.errors as any).coreBusinesses?.[index]?.name) && (
                  <FieldError>
                    {String(((form.formState.errors as any).coreBusinesses[index].name?.message ?? ""))}
                  </FieldError>
                )}
              </div>

              <div className="space-y-1">
                <FieldLabel>ボトルネック設備・資材・IT ツール</FieldLabel>
                <p className="text-xs text-muted-foreground">
                  代替困難な設備を選択してください。「その他」を選んだ場合は下の入力欄に追記してください。
                </p>
                <div className="flex flex-wrap gap-2">
                  {BOTTLENECK_PRESETS.map((equipment) => {
                    const current =
                      (form.getValues(
                        "coreBusinesses." + index + ".bottleneckEquipment",
                      ) as string[]) || []
                    const isSelected = current.includes(equipment)
                    return (
                      <Button
                        key={equipment}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleBottleneck(index, equipment)}
                        className="w-full text-left"
                      >
                        {equipment}
                      </Button>
                    )
                  })}
                </div>

                {BOTTLENECK_PRESETS.includes("その他") && (
                  <div className="mt-2">
                    <Input
                      placeholder="その他の設備を記述..."
                      className="min-h-[40px]"
                      onBlur={(e) => {
                        const val = e.target.value.trim()
                        const current =
                          (form.getValues(
                            "coreBusinesses." + index + ".bottleneckEquipment",
                          ) as string[]) || []
                        if (val && !current.includes(val)) {
                          form.setValue(
                            "coreBusinesses." + index + ".bottleneckEquipment",
                            [...current, val],
                          )
                          e.target.value = ""
                        }
                      }}
                    />
                  </div>
                )}

                {((form.formState.errors as any).coreBusinesses?.[index]
                  ?.bottleneckEquipment) && (
                  <FieldError>
                    {String(((form.formState.errors as any).coreBusinesses[index].bottleneckEquipment?.message ?? ""))}
                  </FieldError>
                )}
              </div>
            </Field>
          ))}

          <Button type="button" variant="outline" size="sm" onClick={addBusiness}>
            業務を追加
          </Button>
        </div>

        <div className="flex justify-end">
          <Button type="submit">次へ</Button>
        </div>
      </div>
    </form>
  )
}
