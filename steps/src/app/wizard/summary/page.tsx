"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, CreditCard } from "lucide-react"
import Link from "next/link"
import { getBcpDraft } from "@/app/actions/bcp"
import { createClient } from "@/lib/supabase/client"

/**
 * BCP 策定ウィザード 完了サマリー画面。
 *
 * Step 1〜6 で入力した全項目をアコーディオン形式でレビュー表示し、
 * 各セクションに「編集」ボタンを配置して該当ステップへ即座に戻れる導線を作成する。
 *
 * また、生成される BCP ドキュメントのプレビュー（透かし入り）と、
 * 「BCP ドキュメントを発行する」ボタン（決済モーダル表示の下地）を配置する。
 */

interface SummaryData {
  step1: {
    companyName: string
    address: string
    industry: string
    employeeScale: string
  }
  step2: Array<{ type: string; priority: string; text: string }>
  step3: Array<{ type: string; impact: string; maxDowntimeDays: number }>
  step4: Array<{ name: string; bottleneckEquipment: string[] }>
  step5: {
    responseHead: string
    deputy: string
    safetyCheckPerson: string
    keyPartners: Array<{
      name: string
      jobTitle: string
      phone: string
      email: string
      roleType: string
    }>
  }
  step6: {
    backupMethod: string
    stockpileItems: Array<{ name: string; stocked: boolean }>
    fundingPlan: string
    hasInsurance: boolean
  }
}

const INDUSTRY_LABELS: Record<string, string> = {
  飲食: "飲食業",
  製造: "製造業",
  オフィス: "オフィス・サービス業",
  建設: "建設業",
  医療介護: "医療・介護業",
  その他: "その他",
}

const PRIORITY_LABELS: Record<string, string> = {
  高: "高",
  中: "中",
  低: "低",
}

const RISK_LABELS: Record<string, string> = {
  地震: "震度6強の地震",
  水害: "風水害（台風・大雨・洪水等）",
  感染症: "感染症のまん延",
  その他: "その他",
}

const ROLE_LABELS: Record<string, string> = {
  本部長: "本部長",
  情報班: "情報班",
  避難誘導: "避難誘導",
}

const FUNDING_LABELS: Record<string, string> = {
  自己資金: "自己資金",
  金融機関融資: "金融機関融資",
  "補助金・助成金": "補助金・助成金",
  未定: "未定",
}

export default function SummaryPage() {
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(true)
  const [paymentOpen, setPaymentOpen] = useState(false)

  const handleCheckout = async (plan: "one_time" | "monthly") => {
    setPaymentOpen(false)
    try {
      const endpoint =
        plan === "one_time" ? "/api/checkout" : "/api/subscribe/checkout"
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        ...(plan === "one_time"
          ? {}
          : { body: JSON.stringify({ plan }) }),
      })
      const result = await res.json()
      if (result.url) {
        window.location.href = result.url
      } else {
        alert(result.error ?? "決済セッションの作成に失敗しました")
      }
    } catch {
      alert("決済セッションの作成に失敗しました")
    }
  }

  useEffect(() => {
    let mounted = true
    const loadDraft = async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setLoading(false)
          return
        }
        const { data: profile } = await supabase
          .from("profiles")
          .select("company_id")
          .eq("id", user.id)
          .single()
        if (!profile?.company_id) {
          setLoading(false)
          return
        }
        const { data: draft } = await getBcpDraft(profile.company_id)
        if (mounted && draft) {
          setSummaryData(draft)
        }
      } catch {
        // エラー時はフォールバックデータを表示
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }
    loadDraft()
    return () => {
      mounted = false
    }
  }, [])

  const data: SummaryData = summaryData ?? {
    step1: { companyName: "", address: "", industry: "オフィス", employeeScale: "10-49名" },
    step2: [],
    step3: [],
    step4: [],
    step5: { responseHead: "", deputy: "", safetyCheckPerson: "", keyPartners: [] },
    step6: { backupMethod: "", stockpileItems: [], fundingPlan: "未定", hasInsurance: false },
  }

  const editLinks: Record<number, string> = {
    1: "/wizard?step=1",
    2: "/wizard?step=2",
    3: "/wizard?step=3",
    4: "/wizard?step=4",
    5: "/wizard?step=5",
    6: "/wizard?step=6",
  }

  if (loading && summaryData === null) {
    return (
      <div className="mx-auto w-full max-w-md px-6 py-12">
        <h1 className="text-2xl font-bold">読み込み中…</h1>
        <p className="text-muted-foreground mt-4">
          入力内容を取得しています。
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      {/* ヘッダー */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">入力内容の確認</h1>
          <p className="text-muted-foreground">
            入力いただいた内容をレビューし、BCP ドキュメントを発行してください。
          </p>
        </div>
        <Link href="/wizard">
          <Button variant="outline">
            <ArrowLeft className="mr-2 size-4" /> ウィザードに戻る
          </Button>
        </Link>
      </div>

      {/* 入力内容レビュー（アコーディオン） */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>入力内容レビュー</CardTitle>
          <CardDescription>
            各セクションの「編集」ボタンから、該当ステップへ戻って修正できます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            {/* Step 1 */}
            <AccordionItem value="step1">
              <AccordionTrigger className="flex items-center justify-between">
                <span className="font-medium">Step 1：会社基本情報</span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div className="flex justify-end mb-2">
                  <Link
                    href={editLinks[1]}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    編集
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">会社名</span>
                    <span className="font-medium">{data.step1.companyName}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">所在地</span>
                    <span className="font-medium">{data.step1.address}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">業種</span>
                    <span className="font-medium">
                      {INDUSTRY_LABELS[data.step1.industry] ?? data.step1.industry}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">従業員数</span>
                    <span className="font-medium">{data.step1.employeeScale}</span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Step 2 */}
            <AccordionItem value="step2">
              <AccordionTrigger className="flex items-center justify-between">
                <span className="font-medium">Step 2：基本方針</span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div className="flex justify-end mb-2">
                  <Link
                    href={editLinks[2]}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    編集
                  </Link>
                </div>
                {data.step2.map((policy, i) => (
                  <Card key={i} className="border bg-muted/50 p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        方針 {i + 1}
                      </span>
                      <Badge
                        variant="default"
                        className="text-xs px-2 py-1"
                      >
                        {PRIORITY_LABELS[policy.priority] ?? policy.priority}
                      </Badge>
                    </div>
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-xs font-medium text-muted-foreground mr-2">
                        {INDUSTRY_LABELS[policy.type] ?? policy.type}
                      </span>
                      <span className="text-sm">{policy.text}</span>
                    </div>
                  </Card>
                ))}
              </AccordionContent>
            </AccordionItem>

            {/* Step 3 */}
            <AccordionItem value="step3">
              <AccordionTrigger className="flex items-center justify-between">
                <span className="font-medium">Step 3：想定リスク</span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div className="flex justify-end mb-2">
                  <Link
                    href={editLinks[3]}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    編集
                  </Link>
                </div>
                {data.step3.map((risk, i) => (
                  <Card key={i} className="border bg-muted/50 p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        リスク {i + 1}
                      </span>
                      <span className="text-xs font-medium">
                        許容停止日数：{risk.maxDowntimeDays} 日
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-medium text-muted-foreground mr-2">
                          想定ハザード：
                        </span>
                        <span className="text-sm">
                          {RISK_LABELS[risk.type] ?? risk.type}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground block">
                          被害想定
                        </span>
                        <span className="text-sm">{risk.impact}</span>
                      </div>
                    </div>
                  </Card>
                ))}
              </AccordionContent>
            </AccordionItem>

            {/* Step 4 */}
            <AccordionItem value="step4">
              <AccordionTrigger className="flex items-center justify-between">
                <span className="font-medium">Step 4：中核事業</span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div className="flex justify-end mb-2">
                  <Link
                    href={editLinks[4]}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    編集
                  </Link>
                </div>
                {data.step4.map((business, i) => (
                  <Card key={i} className="border bg-muted/50 p-4">
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <span className="text-xs font-medium text-muted-foreground mr-2">
                          優先復旧業務：
                        </span>
                        <span className="text-sm font-medium">{business.name}</span>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs font-medium text-muted-foreground block">
                          ボトルネック設備・資材・IT ツール
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {business.bottleneckEquipment.map((eq, j) => (
                            <Badge key={j} variant="outline" className="text-xs">
                              {eq}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </AccordionContent>
            </AccordionItem>

            {/* Step 5 */}
            <AccordionItem value="step5">
              <AccordionTrigger className="flex items-center justify-between">
                <span className="font-medium">Step 5：初動体制・緊急連絡網</span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div className="flex justify-end mb-2">
                  <Link
                    href={editLinks[5]}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    編集
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">対策本部長</span>
                    <span className="font-medium">{data.step5.responseHead}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">代理</span>
                    <span className="font-medium">{data.step5.deputy}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">安否確認担当</span>
                    <span className="font-medium">{data.step5.safetyCheckPerson}</span>
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                    緊急連絡網
                  </h3>
                  <div className="space-y-3">
                    {data.step5.keyPartners.map((partner, i) => (
                      <Card key={i} className="border p-3">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-xs text-muted-foreground block">氏名</span>
                            <span className="font-medium">{partner.name}</span>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground block">役職</span>
                            <span className="font-medium">{partner.jobTitle}</span>
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground block">役割</span>
                            <span className="font-medium">
                              {ROLE_LABELS[partner.roleType] ?? partner.roleType}
                            </span>
                          </div>
                          <div className="md:col-span-2">
                            <span className="text-xs text-muted-foreground block">連絡先</span>
                            <span className="font-medium">{partner.phone}</span>
                            <span className="text-xs text-muted-foreground block mt-1">
                              {partner.email}
                            </span>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Step 6 */}
            <AccordionItem value="step6">
              <AccordionTrigger className="flex items-center justify-between">
                <span className="font-medium">Step 6：事前対策・財務</span>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div className="flex justify-end mb-2">
                  <Link
                    href={editLinks[6]}
                    className="text-xs text-muted-foreground hover:underline"
                  >
                    編集
                  </Link>
                </div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">データバックアップ方法</span>
                    <span className="font-medium">{data.step6.backupMethod}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">備蓄品チェックリスト</span>
                    <div className="flex flex-wrap gap-2">
                      {data.step6.stockpileItems.map((item) => (
                        <Badge
                          key={item.name}
                          variant={item.stocked ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {item.stocked ? "✓ " : ""}{item.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">資金手当て</span>
                    <span className="font-medium">
                      {FUNDING_LABELS[data.step6.fundingPlan] ?? data.step6.fundingPlan}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground block">保険加入状況</span>
                    <span className={`font-medium ${
                      data.step6.hasInsurance ? "text-primary" : "text-muted-foreground"
                    }`}>
                      {data.step6.hasInsurance ? "加入済み" : "未加入"}
                    </span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* ドキュメントプレビュー（透かし入り） */}
      <Card className="mb-8">
        <CardHeader className="flex items-center justify-between">
          <div>
            <CardTitle>ドキュメントプレビュー</CardTitle>
            <CardDescription>
              生成される「事業継続計画書（PDF）」および「初動対応マニュアル」のレイアウトイメージです。
            </CardDescription>
          </div>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
            プレビュー
          </span>
        </CardHeader>
        <CardContent>
          <div className="relative w-full h-[500px] bg-white border rounded-lg overflow-hidden">
            {/* プレビュー本体（レイアウトイメージ） */}
            <div className="relative w-full h-full p-8 flex flex-col">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-foreground">事業継続計画書（BCP）</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {data.step1.companyName}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium text-muted-foreground">第 1 版</div>
                  <div className="text-xs text-muted-foreground">
                    作成日：{new Date().toLocaleDateString("ja-JP")}
                  </div>
                </div>
              </div>

              <Separator className="my-6" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <Card className="p-4 border">
                  <CardTitle className="text-sm">基本情報</CardTitle>
                  <CardContent className="pt-2 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">業種</span>
                      <span>{INDUSTRY_LABELS[data.step1.industry] ?? data.step1.industry}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">従業員数</span>
                      <span>{data.step1.employeeScale}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">所在地</span>
                      <span className="truncate">{data.step1.address}</span>
                    </div>
                  </CardContent>
                </Card>
                <Card className="p-4 border">
                  <CardTitle className="text-sm">基本方針</CardTitle>
                  <CardContent className="pt-2 space-y-2 text-xs">
                    {data.step2.map((p, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="w-8 text-muted-foreground">{i + 1}.</span>
                        <span className="line-clamp-1">{p.text}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <div className="mt-8 pt-6 border-t">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">
                  想定リスクと対応
                </h3>
                <div className="space-y-2">
                  {data.step3.map((r, i) => (
                    <div key={i} className="flex gap-2 text-sm">
                      <span className="w-8 text-muted-foreground">{i + 1}.</span>
                      <div>
                        <span className="font-medium">{RISK_LABELS[r.type] ?? r.type}</span>
                        <span className="text-muted-foreground text-xs ml-2">
                          （許容停止：{r.maxDowntimeDays} 日）
                        </span>
                        <div className="text-xs text-muted-foreground mt-1">{r.impact}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 透かしオーバーレイ */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
              <div className="text-[8rem] font-black text-red-100/20 rotate-[-20deg] select-none">
                PREVIEW
              </div>
              <div className="absolute bottom-4 right-4 text-xs font-semibold text-red-100/40 bg-red-100/10 px-2 py-1 rounded border border-red-100/30">
                複製・利用禁止
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          <div className="text-xs text-muted-foreground">
            初動対応マニュアル（別冊）も同様のレイアウトで生成されます。
          </div>
          <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
            未決済のため、プレビューのみ表示可能です
          </div>
        </CardFooter>
      </Card>

      {/* 決済・発行ボタン */}
      <Card>
        <CardHeader>
          <CardTitle>BCP ドキュメントを発行する</CardTitle>
          <CardDescription>
            決済を完了すると、透かしなしの PDF 形式で事業継続計画書および初動対応マニュアルを発行できます。
          </CardDescription>
        </CardHeader>
        <CardContent className="pb-0">
          <p className="text-sm text-muted-foreground mb-4">
            発行には有料プランへの加入が必要です。プランを選択して決済にお進みください。
          </p>
          <div className="space-y-3">
            <Button
              size="lg"
              className="w-full"
              onClick={() => setPaymentOpen(true)}
            >
              <CreditCard className="mr-2 size-4" />
              決済プランを選択して発行する
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 決済モーダル */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>決済プランの選択</DialogTitle>
            <DialogDescription>
              BCP ドキュメントの発行にあたり、決済プランを選択してください。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Button
              size="lg"
              className="w-full justify-between"
              onClick={() => handleCheckout("one_time")}
            >
              <span>ワンタイム購入（1 ドキュメント）</span>
              <span className="font-medium">¥9,800</span>
            </Button>
            <Button
              size="lg"
              className="w-full justify-between border border-muted"
              onClick={() => handleCheckout("monthly")}
            >
              <span>月額サブスクリプション（無制限発行）</span>
              <span className="font-medium">¥1,480 / 月</span>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>
              キャンセル
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
