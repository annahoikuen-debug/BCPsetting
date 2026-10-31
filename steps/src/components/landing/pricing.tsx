import { CreditCard, CheckCircle2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export function Pricing() {
  return (
    <section id="pricing" className="bg-muted/30">
      <div className="mx-auto w-full max-w-5xl px-6 py-24 sm:py-32">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            料金プラン
          </h2>
          <p className="mt-4 text-muted-foreground">
            発行したいドキュメント数に合わせてお選びください。すべて税込表示です。
          </p>
        </div>

        {/* 無料枠の案内 */}
        <div className="mb-12 rounded-xl border border-border bg-card p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="size-5 text-primary" aria-hidden="true" />
            <div>
              <h3 className="font-semibold text-foreground">無料で始められます</h3>
              <p className="text-sm text-muted-foreground">
                ウィザードでの BCP 策定・ドラフト保存・プレビューは無料でご利用いただけます。
              </p>
            </div>
          </div>
          <Button size="sm" asChild>
            <a href="/signup">無料アカウントを作成する</a>
          </Button>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:max-w-[720px] mx-auto">
          {/* ワンタイムプラン */}
          <div className="bg-card border rounded-2xl p-8 shadow-sm relative">
            <Badge className="absolute top-4 right-4 bg-muted/50 text-muted-foreground">
              都度払い
            </Badge>
            <h3 className="text-lg font-semibold">ワンタイム購入</h3>
            <p className="text-sm text-muted-foreground mb-6">
              1 ドキュメントだけ発行したい方向け
            </p>
            <div className="mb-6">
              <span className="text-3xl font-bold">¥9,800</span>
              <span className="text-sm text-muted-foreground"> / 1 ドキュメント（税込）</span>
            </div>
            <ul className="space-y-3 mb-8 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CreditCard className="size-4" aria-hidden="true" />
                Stripe による決済
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                PDF・ZIP 発行（透かしなし）
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                30日間返金保証
              </li>
            </ul>
            <Button size="lg" className="w-full" asChild>
              <a href="/signup">ワンタイム購入を始める</a>
            </Button>
          </div>

          {/* 月額プラン */}
          <div className="bg-primary text-primary-foreground rounded-2xl p-8 shadow-lg relative overflow-hidden border border-primary/20">
            <div className="absolute top-0 right-0 -translate-y-1/3 translate-x-1/3 bg-white/5 rounded-full blur-[100px] w-64 h-64" />
            <Badge className="bg-white/10 text-primary-foreground">
              一番人気
            </Badge>
            <h3 className="text-lg font-semibold">月額サブスクリプション</h3>
            <p className="text-sm text-primary-foreground/70 mb-6">
              無制限にドキュメントを発行したい方向け
            </p>
            <div className="mb-6">
              <span className="text-3xl font-bold">¥1,480</span>
              <span className="text-sm text-primary-foreground/70"> / 月（税込）</span>
            </div>
            <ul className="space-y-3 mb-8 text-sm text-primary-foreground/70">
              <li className="flex items-center gap-2">
                <CreditCard className="size-4" aria-hidden="true" />
                Stripe による毎月の自動決済
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                PDF・ZIP 発行 無制限
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                いつでも解約可能
              </li>
            </ul>
            <Button
              size="lg"
              className="w-full border border-white/20 bg-white text-primary"
              asChild
            >
              <a href="/signup">月額プランを始める</a>
            </Button>
          </div>

          {/* 年間プラン */}
          <div className="bg-card border border-accent rounded-2xl p-8 shadow-sm relative">
            <Badge className="absolute top-4 right-4 bg-accent text-accent-foreground">
              最もお得
            </Badge>
            <h3 className="text-lg font-semibold">年額プラン</h3>
            <p className="text-sm text-muted-foreground mb-6">
              年一括払いで月額プランより16%お得
            </p>
            <div className="mb-6">
              <span className="text-3xl font-bold">¥14,800</span>
              <span className="text-sm text-muted-foreground"> / 年（税込）</span>
            </div>
            <ul className="space-y-3 mb-8 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <CreditCard className="size-4" aria-hidden="true" />
                Stripe による年一括決済
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                PDF・ZIP 発行 無制限
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
                優先サポート対応
              </li>
            </ul>
            <Button size="lg" className="w-full" asChild>
              <a href="/signup">年額プランを始める</a>
            </Button>
          </div>
        </div>

        {/* プラン比較表 */}
        <div className="mt-16">
          <h3 className="text-lg font-semibold text-foreground mb-4">プラン比較</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-muted-foreground border-collapse border border-border">
              <thead>
                <tr className="bg-muted/50">
                  <th className="p-3 text-left text-xs font-semibold text-foreground border-b border-border">項目</th>
                  <th className="p-3 text-left text-xs font-semibold text-foreground border-b border-border">無料プラン</th>
                  <th className="p-3 text-left text-xs font-semibold text-foreground border-b border-border">ワンタイム</th>
                  <th className="p-3 text-left text-xs font-semibold text-foreground border-b border-border">月額</th>
                  <th className="p-3 text-left text-xs font-semibold text-foreground border-b border-border">年額</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="group">
                  <td className="p-3 text-foreground font-medium">BCP ウィザード利用</td>
                  <td className="p-3">✓</td>
                  <td className="p-3">✓</td>
                  <td className="p-3">✓</td>
                  <td className="p-3">✓</td>
                </tr>
                <tr className="group">
                  <td className="p-3 text-foreground font-medium">ドラフト自動保存</td>
                  <td className="p-3">✓</td>
                  <td className="p-3">✓</td>
                  <td className="p-3">✓</td>
                  <td className="p-3">✓</td>
                </tr>
                <tr className="group">
                  <td className="p-3 text-foreground font-medium">プレビュー表示</td>
                  <td className="p-3">✓</td>
                  <td className="p-3">✓</td>
                  <td className="p-3">✓</td>
                  <td className="p-3">✓</td>
                </tr>
                <tr className="group">
                  <td className="p-3 text-foreground font-medium">PDF・ZIP 発行（透かしなし）</td>
                  <td className="p-3">✕</td>
                  <td className="p-3">1 ドキュメント</td>
                  <td className="p-3">無制限</td>
                  <td className="p-3">無制限</td>
                </tr>
                <tr className="group">
                  <td className="p-3 text-foreground font-medium">発行枚数制限</td>
                  <td className="p-3">なし（プレビューのみ）</td>
                  <td className="p-3">1 枚</td>
                  <td className="p-3">無制限</td>
                  <td className="p-3">無制限</td>
                </tr>
                <tr className="group">
                  <td className="p-3 text-foreground font-medium">優先サポート</td>
                  <td className="p-3">✕</td>
                  <td className="p-3">✕</td>
                  <td className="p-3">✕</td>
                  <td className="p-3">✓</td>
                </tr>
                <tr className="group">
                  <td className="p-3 text-foreground font-medium">価格（税込）</td>
                  <td className="p-3">¥0</td>
                  <td className="p-3">¥9,800 / 1枚</td>
                  <td className="p-3">¥1,480 / 月</td>
                  <td className="p-3">¥14,800 / 年</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-xs text-muted-foreground text-center">
            表示価格はすべて税込です。月額プラン・年額プランはダッシュボードからいつでも解約・プラン変更可能です。
          </p>
        </div>
      </div>
    </section>
  )
}
