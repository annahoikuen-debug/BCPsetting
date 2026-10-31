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
  FieldLabel,
} from "@/components/ui/field"
import { initialResponseSystemSchema } from "@/lib/validations/bcp"
import * as z from "zod"

interface Step5FormProps {
  defaultValues?: any
  onComplete: (data: any) => void
}

/** 役割の選択肢 */
const RESPONSE_ROLES = ["本部長", "情報班", "避難誘導"] as const

export function Step5Form({ defaultValues, onComplete }: Step5FormProps) {
  const form = useForm<any>({
    resolver: zodResolver(initialResponseSystemSchema),
    defaultValues: {
      responseHead: "",
      deputy: "",
      safetyCheckPerson: "",
      keyPartners: [
        { name: "", jobTitle: "", phone: "", email: "", roleType: "本部長" },
      ],
      ...defaultValues,
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "keyPartners",
  })

  const onSubmit = (data: any) => {
    onComplete(data)
  }

  const addPartner = () => {
    append({
      name: "",
      jobTitle: "",
      phone: "",
      email: "",
      roleType: "本部長",
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Separator orientation="horizontal" className="my-2" />
      <div className="space-y-4">
        <div>
          <FieldLabel>初動体制・緊急連絡網</FieldLabel>
          <p className="text-sm text-muted-foreground">
            対策本部長・代理・安否確認担当を指名し、緊急連絡網を登録してください。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <FieldLabel>対策本部長</FieldLabel>
            <Input
              {...form.register("responseHead")}
              placeholder="氏名を入力"
              required
            />
          </div>
          <div className="space-y-1">
            <FieldLabel>代理</FieldLabel>
            <Input
              {...form.register("deputy")}
              placeholder="氏名を入力"
              required
            />
          </div>
          <div className="space-y-1">
            <FieldLabel>安否確認担当</FieldLabel>
            <Input
              {...form.register("safetyCheckPerson")}
              placeholder="氏名を入力"
              required
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <FieldLabel>緊急連絡網</FieldLabel>
            <p className="text-sm text-muted-foreground">
              重要取引先や社内連絡先を追加・削除できます。
            </p>
          </div>

          {fields.map((field: any, index: number) => (
            <Field
              key={field.id}
              className="space-y-3 p-4 border rounded-lg bg-muted/50"
            >
              <div className="flex justify-between items-start gap-2">
                <FieldLabel>連絡先 {index + 1}</FieldLabel>
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <FieldLabel>氏名</FieldLabel>
                  <Input
                    {...form.register("keyPartners." + index + ".name")}
                    defaultValue={field.name ?? ""}
                    placeholder="山田 太郎"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <FieldLabel>役職</FieldLabel>
                  <Input
                    {...form.register("keyPartners." + index + ".jobTitle")}
                    defaultValue={field.jobTitle ?? ""}
                    placeholder="総務部長"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <FieldLabel>役割</FieldLabel>
                  <Select
                    onValueChange={(value: string) =>
                      form.setValue("keyPartners." + index + ".roleType", value)
                    }
                    defaultValue={field.roleType}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {RESPONSE_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {role}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <FieldLabel>電話番号</FieldLabel>
                  <Input
                    {...form.register("keyPartners." + index + ".phone")}
                    defaultValue={field.phone ?? ""}
                    placeholder="03-XXXX-XXXX"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <FieldLabel>メールアドレス</FieldLabel>
                  <Input
                    {...form.register("keyPartners." + index + ".email")}
                    defaultValue={field.email ?? ""}
                    placeholder="yamada@example.com"
                    type="email"
                    required
                  />
                </div>
              </div>
            </Field>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addPartner}
          >
            連絡先を追加
          </Button>
        </div>

        <div className="flex justify-end">
          <Button type="submit">次へ</Button>
        </div>
      </div>
    </form>
  )
}
