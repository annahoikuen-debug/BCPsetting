import { describe, expect, it } from "vitest"
import {
  companyBasicInfoSchema,
  riskAssessmentSchema,
  preMeasureAndFinanceSchema,
} from "./bcp"

describe("companyBasicInfoSchema (ステップ1)", () => {
  it("有効な入力はバリデーションを通過する", () => {
    const result = companyBasicInfoSchema.safeParse({
      companyName: "株式会社サンプル",
      address: "東京都千代田区",
      industry: "オフィス",
      employeeScale: "10-49名",
    })
    expect(result.success).toBe(true)
  })

  it("会社名が空の場合はエラーになる", () => {
    const result = companyBasicInfoSchema.safeParse({
      companyName: "",
      address: "東京都千代田区",
      industry: "オフィス",
      employeeScale: "10-49名",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const nameIssue = result.error.issues.find((i) =>
        i.path.includes("companyName"),
      )
      expect(nameIssue?.message).toContain("会社名")
    }
  })

  it("業種が列挙値外の場合はエラーになる", () => {
    const result = companyBasicInfoSchema.safeParse({
      companyName: "株式会社サンプル",
      address: "東京都千代田区",
      industry: "不明な業種",
      employeeScale: "10-49名",
    })
    expect(result.success).toBe(false)
  })
})

describe("riskAssessmentSchema (ステップ3)", () => {
  it("想定リスクを1つ以上選択すればバリデーションを通過する", () => {
    const result = riskAssessmentSchema.safeParse({
      type: ["地震"],
      impact: "施設への被害",
      maxDowntimeDays: 7,
    })
    expect(result.success).toBe(true)
  })

  it("想定リスクが空配列の場合はエラーになる", () => {
    const result = riskAssessmentSchema.safeParse({
      type: [],
      impact: "施設への被害",
      maxDowntimeDays: 7,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const typeIssue = result.error.issues.find((i) => i.path.includes("type"))
      expect(typeIssue?.message).toContain("1 つ以上")
    }
  })

  it("許容停止日数が0以下の場合はエラーになる", () => {
    const result = riskAssessmentSchema.safeParse({
      type: ["地震"],
      impact: "施設への被害",
      maxDowntimeDays: 0,
    })
    expect(result.success).toBe(false)
  })
})

describe("preMeasureAndFinanceSchema (ステップ6)", () => {
  it("備蓄品を1つ以上入力すればバリデーションを通過する", () => {
    const result = preMeasureAndFinanceSchema.safeParse({
      backupMethod: "クラウドバックアップ",
      stockpileItems: [{ name: "水", stocked: true }],
      fundingPlan: "自己資金",
      hasInsurance: false,
    })
    expect(result.success).toBe(true)
  })

  it("備蓄品が空配列の場合はエラーになる", () => {
    const result = preMeasureAndFinanceSchema.safeParse({
      backupMethod: "クラウドバックアップ",
      stockpileItems: [],
      fundingPlan: "自己資金",
      hasInsurance: false,
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const itemsIssue = result.error.issues.find((i) =>
        i.path.includes("stockpileItems"),
      )
      expect(itemsIssue?.message).toContain("1 つ以上")
    }
  })
})
