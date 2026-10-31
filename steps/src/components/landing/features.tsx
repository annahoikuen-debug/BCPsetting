import { Clock3, FileDown, ShieldCheck, Zap } from "lucide-react"

import { Badge } from "@/components/ui/badge"
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
      "専門知識がなくても、ウィザードの質問に沿って入力するだけで BCP の全体像が整理されます。",
    badge: "専門知識不要",
  },
  {
    icon: FileDown,
    title: "日本語対応 PDF 出力",
    description:
      "完成した計画は Noto Sans JP 同梱の PDF として書き出し可能。社内稟議や補助金申請にそのまま使えます。",
    badge: "文字化けなし",
  },
  {
    icon: ShieldCheck,
    title: "6ステップで完結",
    description:
      "会社情報 → 基本方針 → 想定リスク → 中核事業 → 初動体制 → 事前対策・財務。漏れなく策定できます。",
    badge: "全6ステップ",
  },
  {
    icon: Zap,
    title: "入力の自動保存",
    description:
      "ウィザードの途中入力は localStorage と Supabase に自動保存。別端末・途中離脱でもデータが消えません。",
    badge: "自動保存",
  },
]

export function Features() {
  return (
    <section id="features" className="bg-muted/30">
      <div className="mx-auto w-full max-w-5xl px-6 py-24 sm:py-32">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            選ばれる理由
          </h2>
          <p className="mt-4 text-muted-foreground">
            中小企業でも無理なく導入できる、実用的な BCP 策定体験。
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => (
            <Card key={feature.title}>
              <CardHeader>
                <feature.icon
                  className="size-6 text-primary"
                  aria-hidden="true"
                />
                <Badge variant="outline" className="ml-auto">
                  {feature.badge}
                </Badge>
              </CardHeader>
              <CardContent>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
