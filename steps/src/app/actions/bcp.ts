"use server"

import { createClient } from "@/lib/supabase/server"
import type { BcpWizardInput } from "@/types/bcp"
import {
  validateStep1,
  validateStep2,
  validateStep3,
  validateStep4,
  validateStep5,
  validateStep6,
} from "@/lib/validations/bcp"

/**
 * BCP ウィザードのドラフトデータを Supabase に UPSERT 保存する。
 *
 * 各ステップのデータは以下のテーブル・カラムにマッピングされる：
 *   - companies (name, address, industry, employee_scale) ← step1 (会社基本情報)
 *   - bcp_inputs policy          ← step2 (基本方針)
 *   - bcp_inputs risk_assessment ← step3 (想定リスク)
 *   - bcp_inputs core_business   ← step4 (中核事業)
 *   - bcp_inputs emergency_contacts ← step5 (初動体制・緊急連絡網)
 *   - bcp_inputs measures_and_finance ← step6 (事前対策・財務)
 *
 * ステップごとにバリデーションを行い、検証を通った列のみを保存する。
 * WHY: 未入力ステップの空データを一括保存すると、既存の保存済みドラフトを
 * 上書きして消してしまうため（別端末・ストレージクリア後の部分的な保存など）。
 *
 * is_completed / step_status はここでは更新しない。
 * WHY: is_completed は決済完了時（PDF 発行時）に true になる状態であり、
 * 購入済みデータの再編集・下書き保存で false に戻すべきでないため。
 *
 * @param data ウィザード全体の入力データ
 * @param companyId 保存対象の会社 ID（profiles から取得）
 * @returns 成功時は { success: true }, 失敗時は { error }
 */
export async function upsertBcpDraft(
  data: BcpWizardInput,
  companyId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient()

    // 認証状態の確認（company_id はプロフィールから取得しても良いが、
    // ここでは明示的に渡された companyId を使用）
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "認証が必要です" }
    }

    // company_id がプロフィールに紐付いているか確認
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single()

    if (profileError || !profile) {
      return { success: false, error: "プロフィールが見つかりません" }
    }

    // 権限チェック：渡された company_id が自身のプロフィールと一致するか
    if (profile.company_id !== companyId) {
      return { success: false, error: "他社のデータにはアクセスできません" }
    }

    // 編集ロック（購入後7日間）のサーバー側強制。
    // WHY: ダッシュボードのボタン無効化だけでは Server Action を直接呼ばれた場合に
    // 防げないため、ビジネスルール（都度購入者は購入後7日間のみ編集可能、
    // サブスク契約者は無制限）をここでも検証する。
    const { data: lockCompany } = await supabase
      .from("companies")
      .select("purchased_at, subscription_status")
      .eq("id", companyId)
      .maybeSingle()

    if (lockCompany?.purchased_at) {
      const subscriptionStatus = lockCompany.subscription_status as string | null
      const isSubscribed =
        subscriptionStatus === "active" || subscriptionStatus === "trialing"
      if (!isSubscribed) {
        const purchasedAtMs = new Date(lockCompany.purchased_at as string).getTime()
        const EDIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
        if (Number.isFinite(purchasedAtMs) && Date.now() - purchasedAtMs > EDIT_WINDOW_MS) {
          return {
            success: false,
            error:
              "購入後7日間を過ぎたため編集できません。継続的な編集にはサブスクリプションをご利用ください。",
          }
        }
      }
    }

    let savedAny = false
    let companiesUpdated = false
    let maxCompletedStep = 0

    // step1: 会社基本情報を companies テーブルに upsert 保存
    // （未入力の場合は上書きせず既存の会社名を保護する）
    if (validateStep1(data.step1).success) {
      const { error: companyError } = await supabase
        .from("companies")
        .upsert(
          {
            id: companyId,
            name: data.step1.companyName,
            address: data.step1.address,
            industry: data.step1.industry,
            employee_scale: data.step1.employeeScale,
          },
          { onConflict: "id" },
        )

      if (companyError) {
        return { success: false, error: companyError.message }
      }
      savedAny = true
      companiesUpdated = true
      maxCompletedStep = Math.max(maxCompletedStep, 1)
    }

    // 既存の step_status を読み取り、退行させないよう最大値を採用する
    const { data: existingBcp } = await supabase
      .from("bcp_inputs")
      .select("step_status")
      .eq("company_id", companyId)
      .maybeSingle()

    const currentStepStatus = existingBcp?.step_status ?? 0

    // step2〜6: 検証を通った列のみ bcp_inputs に upsert 保存
    const bcpUpdate: Record<string, unknown> = { company_id: companyId }
    if (validateStep2(data.step2).success) {
      bcpUpdate.policy = data.step2
      maxCompletedStep = Math.max(maxCompletedStep, 2)
    }
    if (validateStep3(data.step3).success) {
      bcpUpdate.risk_assessment = data.step3
      maxCompletedStep = Math.max(maxCompletedStep, 3)
    }
    if (validateStep4(data.step4).success) {
      bcpUpdate.core_business = data.step4
      maxCompletedStep = Math.max(maxCompletedStep, 4)
    }
    if (validateStep5(data.step5).success) {
      bcpUpdate.emergency_contacts = data.step5
      maxCompletedStep = Math.max(maxCompletedStep, 5)
    }
    if (validateStep6(data.step6).success) {
      bcpUpdate.measures_and_finance = data.step6
      maxCompletedStep = Math.max(maxCompletedStep, 6)
    }

    // step_status は既存値と今回の最大ステップの大きい方を採用し、進捗が退行しないよう保護する
    bcpUpdate.step_status = Math.max(currentStepStatus, maxCompletedStep)

    if (Object.keys(bcpUpdate).length > 1) {
      const { error } = await supabase
        .from("bcp_inputs")
        .upsert(bcpUpdate, { onConflict: "company_id" })

      if (error) {
        return { success: false, error: error.message }
      }
      savedAny = true
    }

    // step1 以外のみ更新された場合、companies.updated_at も更新する。
    // cron 年次更新リマインドは companies.updated_at を最終更新の基準にするため、
    // bcp_inputs のみ更新されると判定がズレる。triggger handle_updated_at で now() が設定される。
    if (savedAny && !companiesUpdated) {
      await supabase
        .from("companies")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", companyId)
    }

    if (!savedAny) {
      return { success: false, error: "保存可能な入力データがありません" }
    }

    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "予期しないエラーが発生しました",
    }
  }
}

/**
 * BCP ウィザードのドラフトデータを取得する。
 * サーバーサイドコンポーネントや Server Action から使用する。
 *
 * bcp_inputs の行が存在しない場合（初回保存前）でも、companies の
 * 基本情報（step1）は返す。ウィザード復元・サマリー表示で利用する。
 */
export async function getBcpDraft(companyId: string): Promise<{
  data: BcpWizardInput | null
  error?: string
}> {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { data: null, error: "認証が必要です" }
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single()

    if (profileError || !profile || profile.company_id !== companyId) {
      return { data: null, error: "プロフィールが見つからないか、権限がありません" }
    }

    const { data: bcpData, error: bcpError } = await supabase
      .from("bcp_inputs")
      .select("policy, risk_assessment, core_business, emergency_contacts, measures_and_finance")
      .eq("company_id", companyId)
      .single()

    // PGRST116 = 行が存在しない。初回保存前の正常な状態として続行する
    if (bcpError && bcpError.code !== "PGRST116") {
      return { data: null, error: bcpError.message }
    }

    // step1: 会社基本情報を companies テーブルから取得
    const { data: company } = await supabase
      .from("companies")
      .select("name, address, industry, employee_scale")
      .eq("id", companyId)
      .single()

    return {
      data: {
        step1: {
          companyName: company?.name ?? "",
          address: company?.address ?? "",
          industry: (company?.industry ?? "オフィス") as "飲食" | "製造" | "オフィス" | "建設" | "医療介護" | "その他",
          employeeScale: company?.employee_scale ?? "10-49名",
        },
        step2: bcpData?.policy ?? [],
        step3: bcpData?.risk_assessment ?? [],
        step4: bcpData?.core_business ?? [],
        step5: bcpData?.emergency_contacts ?? {},
        step6: bcpData?.measures_and_finance ?? {},
      },
      error: undefined,
    }
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "予期しないエラーが発生しました",
    }
  }
}
