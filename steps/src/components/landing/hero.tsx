"use client"

import Link from "next/link"
import { ArrowRight, ShieldCheck, Layers, CheckCircle2 } from "lucide-react"

import { Button } from "@/components/ui/button"

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto w-full max-w-5xl px-6 py-24 sm:py-36 lg:py-48 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-secondary-foreground">
              <ShieldCheck className="size-3.5" aria-hidden="true" />
              中小企業向け BCP 策定・PDF 発行サービス
            </div>
            <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              災害時も、<br />
              <span className="text-primary">事業を止めない。</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-lg sm:max-w-none leading-relaxed">
              質問に沿って入力するだけで、自社の事業継続計画（BCP）を最短30分で作成。
              日本語対応のPDF出力まで一貫して行え、社内稟議や補助金申請にそのまま使えます。
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" asChild className="w-full sm:w-auto">
                <Link href="/signup">
                  無料でウィザードを始める <ArrowRight className="ml-2 size-5" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
                <Link href="#features">機能を詳しく見る</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              クレジットカード登録不要 · 30分でBCP作成完了 · 30日間返金保証
            </p>
          </div>
          <div className="relative h-[400px] lg:h-[520px] flex items-center justify-center">
            {/* ウィザードUIモックアップ */}
            <div className="relative z-10 p-4 bg-card border rounded-3xl shadow-2xl ring-1 ring-border/50 max-w-sm w-full sm:max-w-md">
              <div className="absolute -top-8 -left-2 bg-primary p-2 rounded-full shadow-lg">
                <Layers className="size-5 text-white" aria-hidden="true" />
              </div>
              <div className="flex items-center justify-between mb-4 px-4">
                <span className="text-xs font-medium text-primary">ステップ 3 / 6</span>
                <CheckCircle2 className="size-4 text-primary" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-2 px-4 mb-4">
                <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-lg">
                  <div className="w-1 h-1 rounded-full bg-muted" />
                  <span className="text-xs text-muted-foreground">会社基本情報</span>
                </div>
                <div className="flex items-center gap-2 bg-muted/50 p-2 rounded-lg">
                  <div className="w-1 h-1 rounded-full bg-muted" />
                  <span className="text-xs text-muted-foreground">基本方針</span>
                </div>
                <div className="flex items-center gap-2 bg-primary/10 p-2 rounded-lg border border-primary/20">
                  <div className="w-1 h-1 rounded-full bg-primary" />
                  <span className="text-xs text-primary font-medium">想定リスク</span>
                </div>
              </div>
              <div className="space-y-3 px-4 pb-4">
                <div className="flex items-start gap-3">
                  <div className="mt-1 size-4 text-muted-foreground shrink-0">
                    <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-foreground">地震（震度6強）</div>
                    <div className="text-xs text-muted-foreground">被害想定：建物・設備・在庫の損壊</div>
                    <div className="text-xs text-muted-foreground">許容停止日数：7 日</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-1 size-4 text-muted-foreground shrink-0">
                    <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-foreground">水害（台風・大雨・洪水）</div>
                    <div className="text-xs text-muted-foreground">被害想定：浸水による設備停止</div>
                    <div className="text-xs text-muted-foreground">許容停止日数：3 日</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 border-t pt-4 text-xs text-muted-foreground">
                入力内容は自動保存され、PDF・ZIP で発行可能
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent blur-3xl -z-10" />
          </div>
        </div>
      </div>
    </section>
  )
}
