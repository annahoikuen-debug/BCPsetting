import { ArrowRight } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const steps = [
  {
    step: 1,
    title: "会社基本情報",
    description: "社名・所在地・業種・従業員数を入力します。",
  },
  {
    step: 2,
    title: "基本方針",
    description: "安全確保・雇用維持・事業再開などの方針を決めます。",
  },
  {
    step: 3,
    title: "想定リスク",
    description: "地震・水害・感染症などのハザードと被害想定を記入します。",
  },
  {
    step: 4,
    title: "中核事業",
    description: "優先復旧業務と、ボトルネックとなる設備・ITツールを整理します。",
  },
  {
    step: 5,
    title: "初動体制・緊急連絡網",
    description: "対策本部長・代理・安否確認担当と緊急連絡先を決めます。",
  },
  {
    step: 6,
    title: "事前対策・財務",
    description: "データバックアップ・備蓄品・資金手当てを確定します。",
  },
]

export function HowItWorks() {
  return (
    <section className="bg-background">
      <div className="mx-auto w-full max-w-5xl px-6 py-24 sm:py-32">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            作成の流れ
          </h2>
          <p className="mt-4 text-muted-foreground">
            ウィザード形式で、順番に入力していくだけです。
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {steps.map((step) => (
            <Card key={step.step} className="relative">
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <Badge className="flex-shrink-0">Step {step.step}</Badge>
                <span className="text-muted-foreground text-xs">
                  / 6
                </span>
              </CardHeader>
              <CardContent>
                <CardTitle>{step.title}</CardTitle>
                <CardDescription>{step.description}</CardDescription>
              </CardContent>
              <div className="absolute -top-3 -right-3 bg-primary/10 rounded-full p-1.5">
                <div className="w-2 h-2 rounded-full bg-primary" />
              </div>
              {step.step < steps.length && (
                <div className="absolute -top-2 right-1/2 -translate-x-1/2">
                  <ArrowRight className="size-4 text-muted-foreground/50" />
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
