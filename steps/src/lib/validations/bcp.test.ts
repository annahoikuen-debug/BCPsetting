import { describe, expect, it } from "vitest"
import {
  companyBasicInfoSchema,
  basicPolicySchema,
  riskAssessmentSchema,
  coreBusinessSchema,
  initialResponseSystemSchema,
  preMeasureAndFinanceSchema,
  validateAllSteps,
} from "./bcp"
import type { BcpWizardInput } from "./bcp"

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

describe("basicPolicySchema (ステップ2)", () => {
  it("有効な基本方針はバリデーションを通過する", () => {
    const result = basicPolicySchema.safeParse({
      type: "安全確保",
      priority: "高",
      text: "人命第一を最優先とする。",
    })
    expect(result.success).toBe(true)
  })

  it("方針テキストが空の場合はエラーになる", () => {
    const result = basicPolicySchema.safeParse({
      type: "安全確保",
      priority: "高",
      text: "",
    })
    expect(result.success).toBe(false)
  })
})

describe("coreBusinessSchema (ステップ4)", () => {
  it("有効な中核事業はバリデーションを通過する", () => {
    const result = coreBusinessSchema.safeParse({
      name: "受発注業務",
      bottleneckEquipment: ["POSレジ", "クラウドサーバー"],
    })
    expect(result.success).toBe(true)
  })

  it("ボトルネック設備が空の場合はエラーになる", () => {
    const result = coreBusinessSchema.safeParse({
      name: "受発注業務",
      bottleneckEquipment: [],
    })
    expect(result.success).toBe(false)
  })
})

describe("initialResponseSystemSchema (ステップ5)", () => {
  it("有効な初動体制はバリデーションを通過する", () => {
    const result = initialResponseSystemSchema.safeParse({
      responseHead: "山田 太郎",
      deputy: "鈴木 花子",
      safetyCheckPerson: "佐藤 次郎",
      keyPartners: [
        {
          name: "田中 一",
          jobTitle: "総務部長",
          phone: "03-XXXX-XXXX",
          email: "tanaka@example.com",
          roleType: "本部長",
        },
      ],
    })
    expect(result.success).toBe(true)
  })

  it("緊急連絡先が空の場合はエラーになる", () => {
    const result = initialResponseSystemSchema.safeParse({
      responseHead: "山田 太郎",
      deputy: "鈴木 花子",
      safetyCheckPerson: "佐藤 次郎",
      keyPartners: [],
    })
    expect(result.success).toBe(false)
  })
})

describe("validateAllSteps (ウィザード全体)", () => {
  const validInput: BcpWizardInput = {
    step1: {
      companyName: "株式会社サンプル",
      address: "東京都千代田区",
      industry: "オフィス",
      employeeScale: "10-49名",
    },
    step2: [
      { type: "安全確保", priority: "高", text: "人命第一を最優先とする。" },
    ],
    step3: [
      { type: ["地震"], impact: "施設への被害", maxDowntimeDays: 7 },
    ],
    step4: [
      { name: "受発注業務", bottleneckEquipment: ["POSレジ"] },
    ],
    step5: {
      responseHead: "山田 太郎",
      deputy: "鈴木 花子",
      safetyCheckPerson: "佐藤 次郎",
      keyPartners: [
        {
          name: "田中 一",
          jobTitle: "総務部長",
          phone: "03-XXXX-XXXX",
          email: "tanaka@example.com",
          roleType: "本部長",
        },
      ],
    },
    step6: {
      backupMethod: "クラウドバックアップ",
      stockpileItems: [{ name: "水", stocked: true }],
      fundingPlan: "自己資金",
      hasInsurance: false,
    },
  }

  it("すべてのステップが有効ならバリデーションを通過する", () => {
    const result = validateAllSteps(validInput)
    expect(result.success).toBe(true)
  })

  it("step1 の会社名が空なら失敗する", () => {
    const result = validateAllSteps({
      ...validInput,
      step1: { ...validInput.step1, companyName: "" },
    })
    expect(result.success).toBe(false)
  })

  it("step3 のリスク種別が列挙値外なら失敗する", () => {
    const result = validateAllSteps({
      ...validInput,
      step3: [{ type: ["不明なリスク"], impact: "被害", maxDowntimeDays: 7 }],
    } as unknown as BcpWizardInput)
    expect(result.success).toBe(false)
  })
})
