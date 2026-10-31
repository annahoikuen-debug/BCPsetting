"use client"

import Link from "next/link"
import { ArrowRight, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"

export function CTA() {
  return (
    <section className="relative overflow-hidden bg-primary">
      <div className="mx-auto w-full max-w-5xl px-6 py-20 sm:py-28 relative z-10">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 sm:p-12 text-center backdrop-blur-sm">
          <div className="flex items-center justify-center gap-2 mb-4">
            <ShieldCheck className="size-5 text-white" aria-hidden="true" />
            <span className="text-xs font-semibold text-white/90 uppercase tracking-widest">
              30日間返金保証
            </span>
          </div>
          <h2 className="text-3xl font-bold text-white tracking-tight sm:text-4xl">
            まずは無料で始めてみませんか
          </h2>
          <p className="mt-4 text-primary-foreground/60 text-lg sm:text-xl leading-relaxed">
            クレジットカード登録不要。ウィザードから BCP 策定を開始できます。有料プランへの移行も、いつでも解約もダッシュボードからワンタップで完了します。
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="w-full sm:w-auto" asChild>
              <Link href="/signup">
                無料でウィザードを始める <ArrowRight className="ml-2 size-5" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="w-full sm:w-auto border-white/30 text-white hover:bg-white/10" asChild>
              <Link href="#features">機能を詳しく見る</Link>
            </Button>
          </div>
          <p className="mt-6 text-xs text-primary-foreground/50">
            30日間返金保証 · クレジットカード登録不要 · いつでも解約可能 · サインアップ後すぐウィザードを開始
          </p>
        </div>
      </div>
    </section>
  )
}
