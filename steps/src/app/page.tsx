import Link from "next/link"
import { ArrowRight, Clock3, FileDown, ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const features = [
  {
    icon: Clock3,
    title: "最短30分で作成",
    description:
      "質問に沿って入力するだけで、BCPの全体像が整理されていきます。（仮コピー）",
  },
  {
    icon: FileDown,
    title: "PDFでそのまま提出",
    description:
      "完成した計画はPDFとして書き出し可能。社内稟議や補助金申請にそのまま使えます。（仮コピー）",
  },
  {
    icon: ShieldCheck,
    title: "専門知識ゼロでOK",
    description:
      "専門用語はウィザードがかわりに解説。BCP策定が初めての方でも安心です。（仮コピー）",
  },
]

export default function Home() {
  return (
    <div className="flex flex-col">
      {/* ファーストビュー（仮配置） */}
      <section className="border-b bg-gradient-to-b from-muted/60 to-background">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-6 py-24 text-center sm:py-32">
          <Badge variant="secondary">β版・無料で試せます</Badge>
          <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">
            FastBCP
          </h1>
          <p className="font-heading text-xl font-medium text-balance sm:text-2xl">
            質問に答えるだけで、事業継続計画（BCP）が完成
          </p>
          <p className="max-w-xl text-muted-foreground text-balance">
            専門知識がなくても大丈夫。ウィザードに沿って入力するだけで、自社のBCPを最短30分で作成・PDF出力できます。（仮コピー）
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/wizard">
                ウィザードを始める
                <ArrowRight data-icon="inline-end" aria-hidden="true" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="#features">機能を見る</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            ※ 現在はプロトタイプです。デザイン・文言はすべて仮配置です。
          </p>
        </div>
      </section>

      {/* 特徴セクション（仮配置） */}
      <section
        id="features"
        className="mx-auto w-full max-w-5xl px-6 py-16 sm:py-24"
      >
        <div className="grid gap-6 sm:grid-cols-3">
          {features.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <feature.icon
                  className="size-6 text-primary"
                  aria-hidden="true"
                />
                <CardTitle className="mt-2">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}
