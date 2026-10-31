"use client"

import { Badge } from "@/components/ui/badge"

/**
 * ウィザードのステップ進捗バー。
 * 現在のステップと総ステップ数を表示し、視覚的な進捗を示す。
 */
export const STEP_LABELS = [
  "会社基本情報",
  "基本方針",
  "想定リスク",
  "中核事業",
  "初動体制・緊急連絡網",
  "事前対策と財務",
] as const

export type WizardStepNumber = 1 | 2 | 3 | 4 | 5 | 6

interface WizardProgressProps {
  currentStep: WizardStepNumber
  totalSteps?: number
}

export function WizardProgress({ currentStep, totalSteps = 6 }: WizardProgressProps) {
  const progress = ((currentStep - 1) / (totalSteps - 1)) * 100

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-foreground">Step {currentStep} / {totalSteps}</span>
        <span className="text-muted-foreground">
          {STEP_LABELS[currentStep - 1]}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        {STEP_LABELS.map((label, i) => (
          <span
            key={label}
            className="flex items-center gap-1.5"
          >
            <Badge
              variant={i + 1 === currentStep ? "default" : "secondary"}
              className="size-2.5 px-1 py-0.5 text-[0.65rem] font-medium"
            >
              {i + 1}
            </Badge>
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
