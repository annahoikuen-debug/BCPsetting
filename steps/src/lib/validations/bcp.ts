/**
 * BCP策定ウィザードの入力バリデーションスキーマ。
 *
 * Zod を用いて各ステップ（1〜6）の入力データを検証する。
 * 型定義は src/types/bcp.ts に準拠し、中小企業庁 BCP 策定ガイドライン
 * の語彙に基づいたバリデーションルールを適用する。
 */
import * as z from 'zod'

/** 業種区分のバリデーション */
export const industrySchema = z.enum([
  '飲食',
  '製造',
  'オフィス',
  '建設',
  '医療介護',
  'その他',
])

/** 優先順位のバリデーション */
export const prioritySchema = z.enum(['高', '中', '低'])

/** 基本方針の種別バリデーション */
export const policyTypeSchema = z.enum([
  '安全確保',
  '雇用維持',
  '事業再開',
  '地域貢献',
  'その他',
])

/** 想定リスクの種別バリデーション */
export const riskTypeSchema = z.enum(['地震', '水害', '感染症', 'その他'])

/** 役割のバリデーション */
export const responseRoleSchema = z.enum(['本部長', '情報班', '避難誘導'])

/** 資金手当てのバリデーション */
export const fundingPlanSchema = z.enum([
  '自己資金',
  '金融機関融資',
  '補助金・助成金',
  '未定',
])

/** ----------------------------------------------------------------
 *  Step 1: 会社基本情報
 * ---------------------------------------------------------------- */
export const companyBasicInfoSchema = z.object({
  companyName: z.string().min(1, '会社名を入力してください'),
  address: z.string().min(1, '所在地を入力してください'),
  industry: industrySchema,
  employeeScale: z.string().min(1, '従業員数を選択してください'),
})

export type CompanyBasicInfoInput = z.infer<typeof companyBasicInfoSchema>

/** ----------------------------------------------------------------
 *  Step 2: 基本方針
 * ---------------------------------------------------------------- */
export const basicPolicySchema = z.object({
  type: policyTypeSchema,
  priority: prioritySchema,
  text: z.string().min(1, '方針テキストを入力してください'),
})

export type BasicPolicyInput = z.infer<typeof basicPolicySchema>

/** ----------------------------------------------------------------
 *  Step 3: 想定リスク
 * ---------------------------------------------------------------- */
export const riskAssessmentSchema = z.object({
  type: z
    .array(riskTypeSchema)
    .min(1, '想定リスクを 1 つ以上選択してください'),
  impact: z.string().min(1, '被害想定を入力してください'),
  maxDowntimeDays: z
    .number()
    .int('許容停止日数は整数で入力してください')
    .min(1, '許容停止日数は 1 日以上で入力してください'),
})

export type RiskAssessmentInput = z.infer<typeof riskAssessmentSchema>

/** ----------------------------------------------------------------
 *  Step 4: 中核事業
 * ---------------------------------------------------------------- */
export const coreBusinessSchema = z.object({
  name: z.string().min(1, '優先継続業務名を入力してください'),
  bottleneckEquipment: z
    .array(z.string().min(1, '設備・ツール名を入力してください'))
    .min(1, 'ボトルネックとなる設備・資材・IT ツールを 1 つ以上入力してください'),
})

export type CoreBusinessInput = z.infer<typeof coreBusinessSchema>

/** ----------------------------------------------------------------
 *  Step 5: 初動体制・緊急連絡網
 * ---------------------------------------------------------------- */
export const emergencyContactSchema = z.object({
  name: z.string().min(1, '氏名を入力してください'),
  jobTitle: z.string().min(1, '役職を入力してください'),
  phone: z.string().min(1, '電話番号を入力してください'),
  email: z.string().email('有効なメールアドレスを入力してください'),
  roleType: responseRoleSchema,
})

export type EmergencyContactInput = z.infer<typeof emergencyContactSchema>

export const initialResponseSystemSchema = z.object({
  responseHead: z.string().min(1, '対策本部長を入力してください'),
  deputy: z.string().min(1, '代理を入力してください'),
  safetyCheckPerson: z.string().min(1, '安否確認担当を入力してください'),
  keyPartners: z
    .array(emergencyContactSchema)
    .min(1, '緊急連絡先を 1 つ以上入力してください'),
})

export type InitialResponseSystemInput = z.infer<
  typeof initialResponseSystemSchema
>

/** ----------------------------------------------------------------
 *  Step 6: 事前対策と財務
 * ---------------------------------------------------------------- */
export const stockpileItemSchema = z.object({
  name: z.string().min(1, '備蓄品名を入力してください'),
  stocked: z.boolean(),
})

export const preMeasureAndFinanceSchema = z.object({
  backupMethod: z.string().min(1, 'データバックアップ方法を入力してください'),
  stockpileItems: z
    .array(stockpileItemSchema)
    .min(1, '備蓄品を 1 つ以上入力してください'),
  fundingPlan: fundingPlanSchema,
  hasInsurance: z.boolean(),
})

export type PreMeasureAndFinanceInput = z.infer<typeof preMeasureAndFinanceSchema>

/** ----------------------------------------------------------------
 *  ウィザード全体の入力データスキーマ
 * ---------------------------------------------------------------- */
export const bcpWizardInputSchema = z.object({
  step1: companyBasicInfoSchema,
  step2: z.array(basicPolicySchema).min(1, '基本方針を 1 つ以上入力してください'),
  step3: z
    .array(riskAssessmentSchema)
    .min(1, '想定リスクを 1 つ以上入力してください'),
  step4: z
    .array(coreBusinessSchema)
    .min(1, '中核事業を 1 つ以上入力してください'),
  step5: initialResponseSystemSchema,
  step6: preMeasureAndFinanceSchema,
})

export type BcpWizardInput = z.infer<typeof bcpWizardInputSchema>

/** 個別ステップの検証関数（フォームごとに呼び出し用） */
export const validateStep1 = (data: unknown) =>
  companyBasicInfoSchema.safeParse(data)

export const validateStep2 = (data: unknown) =>
  z.array(basicPolicySchema).safeParse(data)

export const validateStep3 = (data: unknown) =>
  z.array(riskAssessmentSchema).safeParse(data)

export const validateStep4 = (data: unknown) =>
  z.array(coreBusinessSchema).safeParse(data)

export const validateStep5 = (data: unknown) =>
  initialResponseSystemSchema.safeParse(data)

export const validateStep6 = (data: unknown) =>
  preMeasureAndFinanceSchema.safeParse(data)

export const validateAllSteps = (data: unknown) =>
  bcpWizardInputSchema.safeParse(data)
