"use server"

import { createClient } from "@/lib/supabase/server"
import { generateAndStoreDocuments } from "@/lib/documents/issue"
import type { IssueDocumentsResult } from "@/lib/documents/issue"

/** サブスク会員がドキュメントを発行できるステータス */
const ISSUABLE_STATUSES = new Set(["active", "trialing"])

/**
 * サブスクリプション会員によるドキュメント発行（無制限）。
 *
 * WHY: 月額プランは「無制限発行」を提供するが、従来は発行フローが
 * 都度決済（/checkout/success）にしか接続されておらず、サブスク会員が
 * 支払っても文書を受け取れない状態だった。本アクションは契約中の
 * サブスク会員に決済なしで新バージョンを発行する。
 *
 * 権限: ログインユーザーの profiles.company_id が companyId と一致し、
 * かつ companies.subscription_status が発行可能ステータスであること。
 *
 * @param companyId 発行対象の会社 ID
 */
export async function issueSubscriptionDocuments(
  companyId: string,
): Promise<IssueDocumentsResult> {
  try {
    const supabase = await createClient()

    // 認証チェック
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: "認証が必要です" }
    }

    // 会社の一致確認
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single()

    if (!profile || profile.company_id !== companyId) {
      return { success: false, error: "他社のデータにはアクセスできません" }
    }

    // サブスク契約状態の確認
    const { data: company } = await supabase
      .from("companies")
      .select("subscription_status")
      .eq("id", companyId)
      .single()

    if (!company || !ISSUABLE_STATUSES.has(company.subscription_status ?? "")) {
      return {
        success: false,
        error: "有効なサブスクリプションが見つかりません",
      }
    }

    // ドキュメント生成・保存（共通モジュール）
    return await generateAndStoreDocuments(companyId)
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "予期しないエラーが発生しました",
    }
  }
}
