/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { useForm } from "react-hook-form"
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
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { companyBasicInfoSchema } from "@/lib/validations/bcp"

interface Step1FormProps {
  defaultValues?: any
  onComplete: (data: any) => void
}

const EMPLOYEE_SCALE_OPTIONS = [
  { value: "1-9名", label: "1〜9名" },
  { value: "10-49名", label: "10〜49名" },
  { value: "50-99名", label: "50〜99名" },
  { value: "100名以上", label: "100名以上" },
] as const

export function Step1Form({ defaultValues, onComplete }: Step1FormProps) {
  const form = useForm<any>({
    resolver: zodResolver(companyBasicInfoSchema),
    defaultValues: {
      companyName: "",
      address: "",
      industry: "オフィス",
      employeeScale: "10-49名",
      ...defaultValues,
    },
  })

  const onSubmit = (data: any) => {
    onComplete(data)
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Separator orientation="horizontal" className="my-2" />
      <div className="space-y-4">
        <Field>
          <FieldLabel>会社名</FieldLabel>
          <Input
            {...form.register("companyName")}
            placeholder="株式会社サンプル"
            required
          />
          <FieldDescription>正式名称を入力してください</FieldDescription>
          {form.formState.errors.companyName?.message && (
            <FieldError>
              {String(form.formState.errors.companyName.message)}
            </FieldError>
          )}
        </Field>

        <Field>
          <FieldLabel>所在地</FieldLabel>
          <Input
            {...form.register("address")}
            placeholder="東京都千代田区..."
            required
          />
          <FieldDescription>本社または主たる事業所の所在地</FieldDescription>
          {form.formState.errors.address?.message && (
            <FieldError>{String(form.formState.errors.address.message)}</FieldError>
          )}
        </Field>

        <Field>
          <FieldLabel>業種</FieldLabel>
          <Select
            onValueChange={(value: string) => form.setValue("industry", value)}
            defaultValue={form.getValues("industry")}
          >
            <SelectTrigger>
              <SelectValue placeholder="業種を選択" />
            </SelectTrigger>
            <SelectContent>
              {[
                { value: "飲食", label: "飲食業" },
                { value: "製造", label: "製造業" },
                { value: "オフィス", label: "オフィス・サービス業" },
                { value: "建設", label: "建設業" },
                { value: "医療介護", label: "医療・介護業" },
                { value: "その他", label: "その他" },
              ].map((item: any) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>事業の業種を選択してください</FieldDescription>
          {form.formState.errors.industry?.message && (
            <FieldError>{String(form.formState.errors.industry.message)}</FieldError>
          )}
        </Field>

        <Field>
          <FieldLabel>従業員数</FieldLabel>
          <Select
            onValueChange={(value: string) => form.setValue("employeeScale", value)}
            defaultValue={form.getValues("employeeScale")}
          >
            <SelectTrigger>
              <SelectValue placeholder="従業員数を選択" />
            </SelectTrigger>
            <SelectContent>
              {EMPLOYEE_SCALE_OPTIONS.map((item: any) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>従業員の規模を選択してください</FieldDescription>
          {form.formState.errors.employeeScale?.message && (
            <FieldError>
              {String(form.formState.errors.employeeScale.message)}
            </FieldError>
          )}
        </Field>
      </div>

      <div className="flex justify-end">
        <Button type="submit">次へ</Button>
      </div>
    </form>
  )
}
