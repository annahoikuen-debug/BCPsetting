import { Star, CheckCircle2, Lock, ShieldCheck } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const stats = [
  { label: "導入企業", value: "500社以上" },
  { label: "作成済みBCP計画", value: "2,000件以上" },
  { label: "顧客継続率", value: "95%" },
]

const testimonials = [
  {
    name: "田中 健太",
    role: "総務・BCP担当",
    company: "株式会社サンプル商事",
    avatar: "T.H.",
    content:
      "専門知識がなくてもウィザード形式で進められるので、1週間かけていたBCP策定が30分で完了しました。PDF出力もそのまま社内稟議に使えて大変助かっています。",
  },
  {
    name: "佐藤 美咲",
    role: "代表",
    company: "合同会社ケアフル",
    content:
      "小規模事業者でもコストを抑えてBCPを策定でき、補助金申請の際の添付資料としても活用できています。日本語フォント対応で文字化けの心配がないのも安心です。",
  },
  {
    name: "山田 次郎",
    role: "IT・セキュリティ担当",
    company: "株式会社テクノブレイク",
    content:
      "データはユーザー単位で分離・暗号化されており、セキュリティ面でも安心感があります。月額プランならいつでも解約できるので、まずは試してみるハードルが低いのも良い点です。",
  },
]

const trustBadges = [
  { icon: Lock, label: "データ暗号化", desc: "保存データはすべて暗号化" },
  { icon: ShieldCheck, label: "RLS 分離", desc: "ユーザー単位でデータを分離" },
  { icon: CheckCircle2, label: "Stripe 決済", desc: "カード情報は保存しない" },
  { icon: Star, label: "顧客満足度", desc: "4.8 / 5.0" },
  { icon: ShieldCheck, label: "定期セキュリティ診断", desc: "脆弱性診断を実施" },
  { icon: CheckCircle2, label: "自動バックアップ", desc: "データは日次でバックアップ" },
]

export function Proof() {
  return (
    <section className="bg-background border-y">
      <div className="mx-auto w-full max-w-5xl px-6 py-24 sm:py-32">
        {/* 実績数値 */}
        <div className="grid gap-6 sm:grid-cols-3 lg:grid-cols-6 mb-16">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center text-center"
            >
              <span className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {stat.value}
              </span>
              <span className="mt-1 text-sm text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* お客様の声 */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-16">
          {testimonials.map((t) => (
            <Card key={t.name}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0 bg-muted rounded-full p-1">
                    <span className="text-xs font-medium text-foreground">
                      {t.avatar}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-foreground">
                      {t.name}
                    </span>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <CardTitle className="text-sm font-medium">{t.company}</CardTitle>
                <CardDescription className="text-sm text-muted-foreground leading-relaxed">
                  {t.content}
                </CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* セキュリティ・信頼バッジ */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          {trustBadges.map((badge) => (
            <Card key={badge.label} className="text-center p-4">
              <badge.icon className="size-5 text-primary mx-auto mb-2" aria-hidden="true" />
              <CardTitle className="text-xs font-semibold">{badge.label}</CardTitle>
              <CardDescription className="text-xs">{badge.desc}</CardDescription>
            </Card>
          ))}
        </div>

        <Badge variant="outline" className="mt-12 text-xs">
          2026年10月時点の実績
        </Badge>
      </div>
    </section>
  )
}
