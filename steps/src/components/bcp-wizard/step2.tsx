/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { basicPolicySchema } from "@/lib/validations/bcp"
import * as z from "zod"

interface Step2FormProps {
  defaultValues?: any[]
  onComplete: (data: any[]) => void
}

const POLICY_TEMPLATES = [
  {
    type: "安全確保",
    text: "人命第一と地域共生を基本とし、従業員および来店者・顧客の安全を最優先に確保する。",
  },
  {
    type: "事業再開",
    text: "顧客供給の即時復旧を最優先とし、重要業務の早期再開を目指す。",
  },
  {
    type: "雇用維持",
    text: "従業員の雇用を維持し、事業継続による地域経済への貢献を図る。",
  },
  {
    type: "地域貢献",
    text: "地域の防災拠点として機能し、地域住民への支援・連携を行う。",
  },
] as const

export function Step2Form({ defaultValues, onComplete }: Step2FormProps) {
  const form = useForm<any>({
    resolver: zodResolver(
      z.object({ policies: z.array(basicPolicySchema) }),
    ),
    defaultValues: {
      policies: defaultValues ?? [
        { type: "安全確保", priority: "高", text: "" },
      ],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "policies",
  })

  const onSubmit = (data: any) => {
    onComplete(data.policies)
  }

  const addPolicy = () => {
    append({ type: "安全確保", priority: "中", text: "" })
  }

  const applyTemplate = (index: number, template: typeof POLICY_TEMPLATES[number]) => {
    form.setValue("policies." + index + ".type", template.type)
    form.setValue("policies." + index + ".text", template.text)
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Separator orientation="horizontal" className="my-2" />
      <div className="space-y-4">
        <div>
          <FieldLabel>基本方針</FieldLabel>
          <p className="text-sm text-muted-foreground">
            方針を追加し、それぞれの優先順位と方針テキストを入力してください。
          </p>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {POLICY_TEMPLATES.map((template) => (
            <Button
              key={template.type}
              variant="outline"
              size="sm"
              onClick={() => {
                const emptyIndex = fields.findIndex((f: any) => !f.text.trim())
                if (emptyIndex !== -1) {
                  applyTemplate(emptyIndex, template)
                } else {
                  append(template as any)
                }
              }}
            >
              {template.text.slice(0, 12)}…
            </Button>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addPolicy}>
            方針を追加
          </Button>
        </div>

        {fields.map((field: any, index: number) => (
          <Field key={field.id} className="space-y-3 p-4 border rounded-lg bg-muted/50">
            <div className="flex justify-between items-start gap-2">
              <FieldLabel>方針 {index + 1}</FieldLabel>
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <FieldLabel>方針の種別</FieldLabel>
                <Select
                  onValueChange={(value: string) =>
                    form.setValue("policies." + index + ".type", value)
                  }
                  defaultValue={field.type}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {["安全確保", "雇用維持", "事業再開", "地域貢献", "その他"].map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <FieldLabel>優先順位</FieldLabel>
                <Select
                  onValueChange={(value: string) =>
                    form.setValue("policies." + index + ".priority", value)
                  }
                  defaultValue={field.priority}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {["高", "中", "低"].map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <FieldLabel>方針テキスト</FieldLabel>
              <Input
                {...form.register("policies." + index + ".text")}
                defaultValue={field.text ?? ""}
                placeholder="方針の具体的な内容を入力..."
                className="min-h-[80px]"
              />
              {((form.formState.errors as any).policies?.[index]?.text) && (
                <FieldError>
                  {String(((form.formState.errors as any).policies[index].text?.message ?? ""))}
                </FieldError>
              )}
            </div>
          </Field>
        ))}

        <div className="flex justify-end">
          <Button type="submit">次へ</Button>
        </div>
      </div>
    </form>
  )
}
