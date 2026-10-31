/**
 * FastBCP の共有型定義。
 *
 * TODO: BCPウィザード実装時に正式なスキーマ（Zod スキーマ + 推導型）へ拡張する。
 */

/** ウィザードのステップ定義（仮） */
export type WizardStep = {
  id: string
  title: string
  description?: string
}

/** BCP計画の基本情報（仮） */
export type BcpPlanMeta = {
  /** 会社名 */
  companyName: string
  /** 業種 */
  industry?: string
  /** 代表者名 */
  representative?: string
  /** 最終更新日（ISO 8601） */
  updatedAt?: string
}
