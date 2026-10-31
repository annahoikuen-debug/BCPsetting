/**
 * BCP ドキュメント発行の中核ロジック（都度決済・サブスクリプション共通）。
 *
 * 呼び出し側の責務:
 *   - 認証・権限チェック（ログインユーザーと company_id の突合）
 *   - 支払い状態の検証（都度決済: Stripe セッション / サブスク: subscription_status）
 *
 * 本モジュールの責務:
 *   - BCP 入力データの取得と PDF 変換
 *   - document_version の原子的インクリメント（RPC、service_role 経由）
 *   - PDF 生成・ストレージ保存・generated_documents 登録
 *   - 署名付き URL の発行
 *
 * WHY: 決済完了時（processPayment）とサブスク会員の再発行（Server Action）で
 * 同じ生成処理を共有するため。生成処理の順序は「検証 → バージョン採番 →
 * 生成 → 保存」とし、バージョン採番は RPC で原子的に行うことで同時実行時の
 * バージョン重複を防ぐ。
 */
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { renderToBuffer } from "@react-pdf/renderer"
import { generateBcpPdf } from "@/lib/pdf/generate-bcp"
import { ActionManualDocument } from "@/components/pdf/ActionManualDocument"
import { PocketCardDocument } from "@/components/pdf/PocketCardDocument"
import type { BcpPdfData } from "@/components/pdf/BcpFullDocument"
import type { ActionManualData } from "@/components/pdf/ActionManualDocument"
import type { PocketCardData } from "@/components/pdf/PocketCardDocument"

const STORAGE_BUCKET = "bcp-documents"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

export interface CompanyRow {
  id: string
  name: string
  representative: string | null
  industry: string
  address: string
  employee_scale: string
  created_at: string | null
  updated_at: string | null
  purchased_at: string | null
  document_version: number | null
  is_completed: boolean
}

export interface BcpDraftRow {
  id: string
  company_id: string
  step_status: number
  policy: Json
  risk_assessment: Json
  core_business: Json
  emergency_contacts: Json
  measures_and_finance: Json
  is_completed: boolean
}

export interface IssuedDocument {
  docType: string
  fileUrl: string
}

export interface IssueDocumentsResult {
  success: boolean
  error?: string
  companyId?: string
  companyName?: string
  documents?: IssuedDocument[]
  currentVersion?: number
}

/**
 * BCP 入力データを PDF 用データに変換する。
 */
export function toBcpPdfData(
  company: CompanyRow,
  bcpDraft: BcpDraftRow,
): BcpPdfData {
  return {
    company: {
      name: company.name,
      representative: company.representative ?? "",
      industry: company.industry,
      address: company.address,
      employeeScale: company.employee_scale,
      establishedDate: company.created_at
        ? new Date(company.created_at).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10),
    },
    policies: (
      (bcpDraft.policy as { type: string; priority: string; text: string }[]) ??
      []
    ).map((p) => ({
      type: p.type,
      priority: p.priority,
      text: p.text,
    })),
    risks: (
      (bcpDraft.risk_assessment as {
        type: string[]
        impact: string
        maxDowntimeDays: number
      }[]) ?? []
    ).map((r) => ({
      type: r.type,
      impact: r.impact,
      maxDowntimeDays: r.maxDowntimeDays,
    })),
    coreBusinesses: (
      (bcpDraft.core_business as {
        name: string
        bottleneckEquipment: string[]
      }[]) ?? []
    ).map((b) => ({
      name: b.name,
      bottleneckEquipment: b.bottleneckEquipment,
    })),
    responseSystem: {
      responseHead:
        (bcpDraft.emergency_contacts as {
          responseHead: string
        })?.responseHead ?? "",
      deputy: (bcpDraft.emergency_contacts as { deputy: string })?.deputy ?? "",
      safetyCheckPerson:
        (bcpDraft.emergency_contacts as {
          safetyCheckPerson: string,
        })?.safetyCheckPerson ?? "",
      keyPartners:
        (
          (bcpDraft.emergency_contacts as {
            keyPartners: Array<{
              name: string
              jobTitle: string
              phone: string
              email: string
              roleType: string
            }>
          })?.keyPartners ?? []
        ).map((kp) => ({
          name: kp.name,
          jobTitle: kp.jobTitle,
          phone: kp.phone,
          email: kp.email,
          roleType: kp.roleType,
        })),
    },
    preMeasures: {
      backupMethod:
        (bcpDraft.measures_and_finance as {
          backupMethod: string
        })?.backupMethod ?? "",
      stockpileItems:
        (
          (bcpDraft.measures_and_finance as {
            stockpileItems: Array<{ name: string; stocked: boolean }>
          })?.stockpileItems ??
          []
        ).map((si) => ({
          name: si.name,
          stocked: si.stocked,
        })),
      fundingPlan:
        (bcpDraft.measures_and_finance as {
          fundingPlan: string
        })?.fundingPlan ?? "未定",
      hasInsurance:
        (bcpDraft.measures_and_finance as {
          hasInsurance: boolean
        })?.hasInsurance ?? false,
    },
  }
}

/**
 * BcpPdfData から ActionManualData に変換する。
 */
export function toActionManualData(data: BcpPdfData): ActionManualData {
  const phases = {
    immediate: [
      "人的被害の確認と安否確認の実施",
      "被害状況の初期把握と対策本部の設置",
      "従業員・来訪者の安全確保と避難誘導",
    ],
    sameDay: [
      "被害規模の詳細評価と事業影響の判定",
      "中核事業の継続・再開判断と代替手段の検討",
      "ステークホルダー（取引先・顧客・従業員）への情報発信",
    ],
    nextDayPlus: [
      "事業再開に向けたロードマップの策定",
      "損害保険の申請と復旧資金の確保",
      "BCP の見直しと改善（教訓の反映）",
    ],
  }

  return {
    companyName: data.company.name,
    createdAt: data.company.establishedDate,
    phases,
    emergencyContacts: data.responseSystem.keyPartners.map((kp) => ({
      role: kp.roleType,
      name: kp.name,
      phone: kp.phone,
      email: kp.email,
    })),
  }
}

/**
 * BcpPdfData から PocketCardData に変換する。
 */
export function toPocketCardData(data: BcpPdfData): PocketCardData {
  const carryList = [
    ...data.preMeasures.stockpileItems.map((si) => si.name),
    "モバイルバッテリー",
    "予備マスク・消毒液",
    "筆記用具・メモ",
  ]
  const safetyCriteria = [
    "家族：安否確認ダイヤル（171）または災害用伝言板で連絡",
    "会社：対策本部へ安否を報告（メールまたは電話）",
    "勤務先への復帰時期は対策本部の指示に従う",
  ]

  return {
    companyName: data.company.name,
    createdAt: data.company.establishedDate,
    carryList,
    safetyCriteria,
    emergencyContacts: data.responseSystem.keyPartners.map((kp) => ({
      role: kp.roleType,
      name: kp.name,
      phone: kp.phone,
    })),
  }
}

/**
 * Supabase Storage（非公開バケット）に PDF をアップロードする。
 * サービスロールクライアントを使用して RLS をバイパスする。
 * 戻り値はストレージパス（署名付き URL はダウンロード時に発行する）。
 */
async function uploadPdfToStorage(
  admin: ReturnType<typeof createAdminClient>,
  companyId: string,
  docType: string,
  version: number,
  pdfBuffer: Buffer,
): Promise<{ url: string | null; error?: string }> {
  try {
    const fileName = `${docType}_v${version}.pdf`
    const filePath = `${companyId}/${fileName}`

    const { error: uploadError } = await admin.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      })

    if (uploadError) {
      return { url: null, error: uploadError.message }
    }

    return { url: filePath }
  } catch (err) {
    return {
      url: null,
      error: err instanceof Error ? err.message : "アップロードに失敗しました",
    }
  }
}

/**
 * ストレージパスを1時間有効の署名付きダウンロード URL に変換する。
 */
export async function signDownloadUrl(
  admin: ReturnType<typeof createAdminClient>,
  filePath: string,
): Promise<string | null> {
  const { data, error } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(filePath, 60 * 60)
  if (error || !data?.signedUrl) {
    return null
  }
  return data.signedUrl
}

/**
 * BCP ドキュメント 3 種を生成してストレージ・DB に登録する。
 *
 * 前提: 呼び出し側で認証・権限・支払い状態の検証が完了していること。
 *
 * 処理順序:
 *   1. companies / bcp_inputs を読み取り（未保存ならここで失敗 = 書き込みなし）
 *   2. document_version を RPC で原子的にインクリメント
 *   3. PDF 3 種を生成
 *   4. ストレージへアップロード
 *   5. generated_documents へ登録
 *   6. bcp_inputs.is_completed を true に更新
 */
export async function generateAndStoreDocuments(
  companyId: string,
): Promise<IssueDocumentsResult> {
  try {
    const supabase = await createClient()
    const admin = createAdminClient()

    // 1. 会社情報を取得
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single()

    if (companyError || !company) {
      return { success: false, error: "会社情報が見つかりません" }
    }

    // 2. BCP ドラフトデータを取得（存在チェックは他の書き込みより前に行う。
    // WHY: ドラフト未保存のまま注文レコード等が作られると、支払い済みで
    // 文書が生成されない不整合が固定化するため）
    const { data: bcpDraft, error: draftError } = await supabase
      .from("bcp_inputs")
      .select("*")
      .eq("company_id", companyId)
      .single()

    if (draftError || !bcpDraft) {
      return { success: false, error: "BCP 策定データが見つかりません" }
    }

    // 3. document_version を原子的にインクリメント（service_role 経由の RPC）。
    // 同時実行でも重複しないバージョンが採番される。
    const { data: currentVersion, error: versionError } = await admin.rpc(
      "increment_document_version",
      { p_company_id: companyId },
    )

    if (versionError || typeof currentVersion !== "number") {
      return {
        success: false,
        error: versionError?.message ?? "バージョンの採番に失敗しました",
      }
    }

    // 4. PDF 用データに変換して 3 種を生成
    const bcpPdfData = toBcpPdfData(company as CompanyRow, bcpDraft as BcpDraftRow)
    const actionManualData = toActionManualData(bcpPdfData)
    const pocketCardData = toPocketCardData(bcpPdfData)

    const [bcpBuffer, actionManualBuffer, pocketCardBuffer] =
      await Promise.all([
        generateBcpPdf(bcpPdfData),
        renderToBuffer(<ActionManualDocument data={actionManualData} />),
        renderToBuffer(<PocketCardDocument data={pocketCardData} />),
      ])

    // 5. Supabase Storage にアップロード
    const [bcpResult, actionResult, pocketResult] = await Promise.all([
      uploadPdfToStorage(admin, companyId, "bcp_full", currentVersion, bcpBuffer),
      uploadPdfToStorage(
        admin,
        companyId,
        "action_manual",
        currentVersion,
        actionManualBuffer,
      ),
      uploadPdfToStorage(
        admin,
        companyId,
        "pocket_card",
        currentVersion,
        pocketCardBuffer,
      ),
    ])

    const results = [bcpResult, actionResult, pocketResult]
    const hasError = results.some((r) => !r.url)
    if (hasError) {
      const errorMsg = results
        .filter((r) => !r.url)
        .map((r) => r.error)
        .join(", ")
      // バージョンは消費済みだが文書は未登録。再実行時は次のバージョンで
      // 生成されるため、データ不整合は発生しない。
      return { success: false, error: errorMsg }
    }

    // 6. generated_documents に登録（DB にはストレージパスを保存。署名付き URL は
    // ダウンロード時のみ発行するため、永続化しない）
    const rawDocuments: IssuedDocument[] = [
      { docType: "bcp_full", fileUrl: bcpResult.url! },
      { docType: "action_manual", fileUrl: actionResult.url! },
      { docType: "pocket_card", fileUrl: pocketResult.url! },
    ]

    const { error: insertError } = await supabase
      .from("generated_documents")
      .upsert(
        rawDocuments.map((d) => ({
          company_id: companyId,
          doc_type: d.docType,
          file_url: d.fileUrl,
          version: currentVersion,
        })),
        { onConflict: "company_id, doc_type, version" },
      )

    if (insertError) {
      return { success: false, error: insertError.message }
    }

    // 7. bcp_inputs の is_completed を true にする
    const { error: completedError } = await supabase
      .from("bcp_inputs")
      .update({ is_completed: true })
      .eq("company_id", companyId)

    if (completedError) {
      return { success: false, error: completedError.message }
    }

    // 表示用リンクは1時間有効の署名付き URL に変換する。
    // 署名に失敗した場合はエラーとして扱う（壊れたリンクを成功として
    // 返さないため）。
    const signedUrls = await Promise.all(
      rawDocuments.map((d) => signDownloadUrl(admin, d.fileUrl)),
    )
    if (signedUrls.some((u) => u === null)) {
      return {
        success: false,
        error: "ダウンロード URL の発行に失敗しました。再度お試しください。",
      }
    }
    const documents = rawDocuments.map((d, i) => ({
      docType: d.docType,
      fileUrl: signedUrls[i] as string,
    }))

    return {
      success: true,
      companyId,
      companyName: (company as CompanyRow).name,
      documents,
      currentVersion,
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "予期しないエラーが発生しました",
    }
  }
}
