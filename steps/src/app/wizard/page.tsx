/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"

import { Suspense, useCallback, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2, AlertCircle, ArrowLeft, ArrowRight, Save } from "lucide-react"
import { WizardProgress, STEP_LABELS } from "@/components/bcp-wizard/wizard-progress"
import { Step1Form } from "@/components/bcp-wizard/step1"
import { Step2Form } from "@/components/bcp-wizard/step2"
import { Step3Form } from "@/components/bcp-wizard/step3"
import { Step4Form } from "@/components/bcp-wizard/step4"
import { Step5Form } from "@/components/bcp-wizard/step5"
import { Step6Form } from "@/components/bcp-wizard/step6"
import { useLocalStorageDraft } from "@/hooks/useLocalStorageDraft"
import { upsertBcpDraft, getBcpDraft } from "@/app/actions/bcp"
import { ensureProfile } from "@/app/actions/auth"

const TOTAL_STEPS = 6

const EMPTY_STEP1 = { companyName: "", address: "", industry: "オフィス", employeeScale: "10-49名" }
const EMPTY_STEP2: any[] = [{ type: "安全確保", priority: "高", text: "" }]
const EMPTY_STEP3: any[] = [{ type: ["地震"], impact: "", maxDowntimeDays: 7 }]
const EMPTY_STEP4: any[] = [{ name: "", bottleneckEquipment: [] }]
const EMPTY_STEP5: any = {
  responseHead: "",
  deputy: "",
  safetyCheckPerson: "",
  keyPartners: [{ name: "", jobTitle: "", phone: "", email: "", roleType: "本部長" }],
}
const EMPTY_STEP6: any = {
  backupMethod: "",
  stockpileItems: ["水", "食料", "簡易トイレ"].map((name) => ({ name, stocked: false })),
  fundingPlan: "未定",
  hasInsurance: false,
}

type AutosaveStatus = "idle" | "saving" | "saved" | "error"

function WizardPageInner() {
  const searchParams = useSearchParams()
  const [currentStep, setCurrentStep] = useState(() => {
    // サマリーの「編集」リンク（/wizard?step=N）から該当ステップを開始する
    const parsed = Number(searchParams.get("step"))
    if (Number.isInteger(parsed) && parsed >= 1 && parsed <= TOTAL_STEPS) {
      return parsed
    }
    return 1
  })
  const [submitting, setSubmitting] = useState(false)
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("idle")
  // companyId は ref で管理（下記 companyIdRef 参照）
  const [autosaveError, setAutosaveError] = useState<string | null>(null)
  const [draftsReady, setDraftsReady] = useState(false)

  const router = useRouter()

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hydratedRef = useRef(false)
  // WHY: debouncedAutosave は useCallback([], ...) で初回クロージャを固定するため、
  // state の companyId を直接参照すると常に初回値（null）を見てしまう。
  // 自動保存が永続的に no-op になるバグを避けるため、最新値を ref でミラーする。
  const companyIdRef = useRef<string | null>(null)

  const draft1 = useLocalStorageDraft("fastbcp:wizard:step1", EMPTY_STEP1)
  const draft2 = useLocalStorageDraft("fastbcp:wizard:step2", EMPTY_STEP2)
  const draft3 = useLocalStorageDraft("fastbcp:wizard:step3", EMPTY_STEP3)
  const draft4 = useLocalStorageDraft("fastbcp:wizard:step4", EMPTY_STEP4)
  const draft5 = useLocalStorageDraft("fastbcp:wizard:step5", EMPTY_STEP5)
  const draft6 = useLocalStorageDraft("fastbcp:wizard:step6", EMPTY_STEP6)

  // DB + localStorage からドラフトを復元する
  // （setDraft は安定した useCallback、hasStored はマウント時点の
  // localStorage 状態を読めば十分なため、クロージャの初回値を使用する）
  useEffect(() => {
    let cancelled = false
    const hydrate = async () => {
      try {
        const { companyId: cid } = await ensureProfile()
        if (cancelled || !cid) return
        companyIdRef.current = cid

        if (hydratedRef.current) return
        hydratedRef.current = true

        const { data: dbDraft } = await getBcpDraft(cid)
        if (cancelled || !dbDraft) return

        // localStorage 未保存のステップのみ DB から復元する（ローカル編集を優先）
        // WHY: 別端末・ストレージクリア後に空データで上書きして
        // 保存済みドラフトを消してしまうことを防ぐ
        if (!draft1.hasStored && dbDraft.step1.companyName) {
          draft1.setDraft(dbDraft.step1)
        }
        if (!draft2.hasStored && dbDraft.step2.length > 0) {
          draft2.setDraft(dbDraft.step2)
        }
        if (!draft3.hasStored && dbDraft.step3.length > 0) {
          draft3.setDraft(dbDraft.step3)
        }
        if (!draft4.hasStored && dbDraft.step4.length > 0) {
          draft4.setDraft(dbDraft.step4)
        }
        if (!draft5.hasStored && (dbDraft.step5.keyPartners?.length ?? 0) > 0) {
          draft5.setDraft(dbDraft.step5)
        }
        if (!draft6.hasStored && dbDraft.step6.backupMethod) {
          draft6.setDraft(dbDraft.step6)
        }
      } catch {
        // 復元に失敗してもウィザードは空の状態で利用可能にする
      } finally {
        if (!cancelled) {
          setDraftsReady(true)
        }
      }
    }
    hydrate()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current)
      }
    }
  }, [])

  const handleBack = () => {
    // 戻る際にも現在のステップのドラフトを保存する（未送信入力の喪失防止）
    const currentData = {
      1: draft1.value,
      2: draft2.value,
      3: draft3.value,
      4: draft4.value,
      5: draft5.value,
      6: draft6.value,
    }[currentStep]
    if (currentData && companyIdRef.current) {
      debouncedAutosave(currentStep, currentData)
    }
    setCurrentStep((prev) => (prev > 1 ? prev - 1 : prev))
  }

  const handleNext = () => {
    const stepElement = document.querySelector(`[data-step="current"]`)
    if (!stepElement) return
    const form = stepElement.querySelector("form")
    if (form) {
      ;(form as HTMLFormElement).requestSubmit()
    }
  }

  const performAutosave = async (step: number, data: any) => {
    const cid = companyIdRef.current
    if (!cid) return

    setAutosaveStatus("saving")
    setAutosaveError(null)

    try {
      const allData = {
        step1: draft1.value,
        step2: draft2.value,
        step3: draft3.value,
        step4: draft4.value,
        step5: draft5.value,
        step6: draft6.value,
        ...(step === 1 ? { step1: data } : {}),
        ...(step === 2 ? { step2: data } : {}),
        ...(step === 3 ? { step3: data } : {}),
        ...(step === 4 ? { step4: data } : {}),
        ...(step === 5 ? { step5: data } : {}),
        ...(step === 6 ? { step6: data } : {}),
      }

      const result = await upsertBcpDraft(allData as any, cid)

      if (result.error) {
        setAutosaveStatus("error")
        setAutosaveError(result.error)
      } else {
        setAutosaveStatus("saved")
        if (autosaveTimerRef.current) {
          clearTimeout(autosaveTimerRef.current)
        }
        autosaveTimerRef.current = setTimeout(() => {
          setAutosaveStatus((prev) => (prev === "saved" ? "idle" : prev))
        }, 3000)
      }
    } catch (err) {
      setAutosaveStatus("error")
      setAutosaveError(err instanceof Error ? err.message : "保存に失敗しました")
    }
  }

  const debouncedAutosave = useCallback((step: number, data: any) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      performAutosave(step, data)
    }, 3000)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onStepComplete = (step: number, data: any) => {
    if (step === 1) draft1.setDraft(data)
    if (step === 2) draft2.setDraft(data)
    if (step === 3) draft3.setDraft(data)
    if (step === 4) draft4.setDraft(data)
    if (step === 5) draft5.setDraft(data)
    if (step === 6) draft6.setDraft(data)

    // Autosave（入力停止後3秒）
    debouncedAutosave(step, data)

    setCurrentStep((prev) => (prev < TOTAL_STEPS ? prev + 1 : prev))
  }

  const handleSubmitAll = async () => {
    const cid = companyIdRef.current
    setSubmitting(true)
    if (!cid) {
      setSubmitting(false)
      return
    }
    const allData = {
      step1: draft1.value,
      step2: draft2.value,
      step3: draft3.value,
      step4: draft4.value,
      step5: draft5.value,
      step6: draft6.value,
    }
    const result = await upsertBcpDraft(allData as any, cid)
    if (result.error) {
      setAutosaveStatus("error")
      setAutosaveError(result.error)
      setSubmitting(false)
    } else {
      setAutosaveStatus("saved")
      setSubmitting(false)
      router.push("/wizard/summary")
    }
  }

  const isLastStep = currentStep === TOTAL_STEPS

  const statusLabel = autosaveStatus === "saved" ? "下書き保存完了" : autosaveStatus === "saving" ? "保存中…" : autosaveStatus === "error" ? "保存エラー" : ""

  if (!draftsReady) {
    return (
      <div className="mx-auto w-full max-w-4xl px-6 py-12">
        <p className="text-muted-foreground">入力内容を復元しています…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                保存中…
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 size-4" />
                すべて保存して完了
              </>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>BCP 計画を保存します</DialogTitle>
            <DialogDescription>
              入力内容を Supabase に保存し、計画を確定します。この操作を実行すると、
              以降の編集はダッシュボードから行います。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" onClick={handleSubmitAll} disabled={submitting}>
              保存する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="mt-8">
        {/* Autosave ステータスインジケーター */}
        {autosaveStatus !== "idle" && (
          <Alert
            className="mb-4"
            variant={autosaveStatus === "error" ? "destructive" : "default"}
          >
            {autosaveStatus === "saved" && (
              <CheckCircle2 className="mr-2 h-4 w-4" />
            )}
            {autosaveStatus === "saving" && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {autosaveStatus === "error" && (
              <AlertCircle className="mr-2 h-4 w-4" />
            )}
            <AlertTitle>{statusLabel}</AlertTitle>
            {autosaveError && (
              <AlertDescription>{autosaveError}</AlertDescription>
            )}
          </Alert>
        )}

        <WizardProgress currentStep={currentStep as any} totalSteps={TOTAL_STEPS} />

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>{STEP_LABELS[currentStep - 1]}</CardTitle>
            <CardDescription>
              ステップ {currentStep} / {TOTAL_STEPS}
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-0">
            <div data-step="current" className="space-y-6">
              {currentStep === 1 && (
                <Step1Form
                  defaultValues={draft1.value}
                  onComplete={(data: any) => onStepComplete(1, data)}
                />
              )}
              {currentStep === 2 && (
                <Step2Form
                  defaultValues={draft2.value}
                  onComplete={(data: any) => onStepComplete(2, data)}
                />
              )}
              {currentStep === 3 && (
                <Step3Form
                  defaultValues={draft3.value}
                  onComplete={(data: any) => onStepComplete(3, data)}
                />
              )}
              {currentStep === 4 && (
                <Step4Form
                  defaultValues={draft4.value}
                  onComplete={(data: any) => onStepComplete(4, data)}
                />
              )}
              {currentStep === 5 && (
                <Step5Form
                  defaultValues={draft5.value}
                  onComplete={(data: any) => onStepComplete(5, data)}
                />
              )}
              {currentStep === 6 && (
                <Step6Form
                  defaultValues={draft6.value}
                  onComplete={(data: any) => onStepComplete(6, data)}
                />
              )}
            </div>
          </CardContent>
          <CardFooter className="flex justify-between items-center pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 1}
            >
              <ArrowLeft className="mr-2 size-4" /> 戻る
            </Button>
            {!isLastStep ? (
              <Button type="button" onClick={handleNext}>
                次へ <ArrowRight className="ml-2 size-4" />
              </Button>
            ) : (
              <Link href="/wizard/summary">
                <Button type="button" variant="default">
                  <Save className="mr-2 size-4" />
                  確認サマリーへ進む
                </Button>
              </Link>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

export default function WizardPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-4xl px-6 py-12">
          <p className="text-muted-foreground">読み込み中…</p>
        </div>
      }
    >
      <WizardPageInner />
    </Suspense>
  )
}
