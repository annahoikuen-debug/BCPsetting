/**
 * BCP策定ウィザードで扱う入力データの型定義。
 *
 * 中小企業庁「中小企業等BCP策定ガイドライン」の語彙に準拠し、
 * ウィザードの各ステップ（1〜6）の入力項目を定義する。
 *
 * これらの型は `bcp_inputs` テーブルの JSONB カラム
 * (policy / risk_assessment / core_business / emergency_contacts /
 * measures_and_finance) にマッピングされることを想定する。
 */

/** 業種区分（中小企業庁 BCP 策定ガイドラインに準拠） */
export type IndustryType =
  | '飲食'
  | '製造'
  | 'オフィス'
  | '建設'
  | '医療介護'
  | 'その他'

/** 優先順位 */
export type Priority = '高' | '中' | '低'

/** 基本方針の種別 */
export type PolicyType =
  | '安全確保'
  | '雇用維持'
  | '事業再開'
  | '地域貢献'
  | 'その他'

/** 想定リスクの種別 */
export type RiskType = '地震' | '水害' | '感染症' | 'その他'

/** 役割（初動体制） */
export type ResponseRole = '本部長' | '情報班' | '避難誘導'

/** 資金手当ての選択肢 */
export type FundingPlan =
  | '自己資金'
  | '金融機関融資'
  | '補助金・助成金'
  | '未定'

/** ----------------------------------------------------------------
 *  Step 1: 会社基本情報
 * ---------------------------------------------------------------- */
export type CompanyBasicInfo = {
  /** 会社名 */
  companyName: string
  /** 所在地（本社・事業所） */
  address: string
  /** 業種 */
  industry: IndustryType
  /** 従業員数（例: "1-9名", "10-49名", "50-99名", "100名以上"） */
  employeeScale: string
}

/** ----------------------------------------------------------------
 *  Step 2: 基本方針
 * ---------------------------------------------------------------- */
export type BasicPolicy = {
  /** 方針種別 */
  type: PolicyType
  /** 優先順位 */
  priority: Priority
  /** 方針テキスト（具体的な取り組み内容） */
  text: string
}

/** ----------------------------------------------------------------
 *  Step 3: 想定リスク
 * ---------------------------------------------------------------- */
export type RiskAssessment = {
  /** リスク種別 */
  type: RiskType
  /** 被害想定（施設・設備・人員への影響等） */
  impact: string
  /** 許容停止日数（業務が停止可能な最大日数） */
  maxDowntimeDays: number
}

/** ----------------------------------------------------------------
 *  Step 4: 中核事業
 * ---------------------------------------------------------------- */
export type CoreBusiness = {
  /** 優先継続業務名 */
  name: string
  /** ボトルネックとなる設備・資材・IT ツール（プリセット＋自由記述） */
  bottleneckEquipment: string[]
}

/** ----------------------------------------------------------------
 *  Step 5: 初動体制・緊急連絡網
 * ---------------------------------------------------------------- */
export type EmergencyContact = {
  /** 氏名 */
  name: string
  /** 役職 */
  jobTitle: string
  /** 緊急連絡先（電話） */
  phone: string
  /** 緊急連絡先（メール） */
  email: string
  /** 役割 */
  roleType: ResponseRole
}

export type InitialResponseSystem = {
  /** 対策本部長 */
  responseHead: string
  /** 代理（対策本部長不在時の代理者） */
  deputy: string
  /** 安否確認担当 */
  safetyCheckPerson: string
  /** 緊急連絡網（重要取引先・社内連絡先リスト） */
  keyPartners: EmergencyContact[]
}

/** ----------------------------------------------------------------
 *  Step 6: 事前対策と財務
 * ---------------------------------------------------------------- */
export type StockpileItem = {
  /** 備蓄品名 */
  name: string
  /** 備蓄済みかどうか */
  stocked: boolean
}

export type PreMeasureAndFinance = {
  /** データバックアップ方法 */
  backupMethod: string
  /** 備蓄品チェックリスト（水・食料・簡易トイレ等） */
  stockpileItems: StockpileItem[]
  /** 資金手当ての選択 */
  fundingPlan: FundingPlan
  /** 保険加入有無 */
  hasInsurance: boolean
}

/** ----------------------------------------------------------------
 *  ウィザード全体の入力データ（各ステップの集約）
 * ---------------------------------------------------------------- */
export type BcpWizardInput = {
  step1: CompanyBasicInfo
  step2: BasicPolicy[]
  step3: RiskAssessment[]
  step4: CoreBusiness[]
  step5: InitialResponseSystem
  step6: PreMeasureAndFinance
}

/** 各ステップの完了状態 */
export type StepStatus = {
  [key: string]: boolean
}
