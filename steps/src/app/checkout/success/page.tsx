/**
 * 決済完了画面 (/checkout/success)
 *
 * Stripe Checkout セッション ID をクエリパラメータで受け取り、
 * 決済状態を確認した上で透かしなしの正規PDF（3種類）をレンダリング・
 * Supabase Storage に保存し、generated_documents に URL を登録する。
 *
 * 表示内容:
 *   - 決済完了メッセージ
 *   - PDF 一括ダウンロード (ZIP) ボタン
 *   - 個別ダウンロードボタン ×3
 */
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getStripe } from "@/lib/stripe"
import { redirect } from "next/navigation"
import { generateBcpPdf } from "@/lib/pdf/generate-bcp"
import { renderToBuffer } from "@react-pdf/renderer"
import { ActionManualDocument } from "@/components/pdf/ActionManualDocument"
import { PocketCardDocument } from "@/components/pdf/PocketCardDocument"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { BcpPdfData } from "@/components/pdf/BcpFullDocument"
import type { ActionManualData } from "@/components/pdf/ActionManualDocument"
import type { PocketCardData } from "@/components/pdf/PocketCardDocument"

const STORAGE_BUCKET = "bcp-documents"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

interface CompanyRow {
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

interface BcpDraftRow {
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

interface GeneratedDocRow {
  id: string
  doc_type: string
  file_url: string
  version: number
  created_at: string
}

/**
 * 決済セッションを取得し、支払いが完了しているかを確認する。
 */
async function verifyPayment(sessionId: string) {
  const stripe = getStripe()
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  })

  if (session.payment_status !== "paid") {
    return { success: false, error: "決済が完了していません" }
  }

  return {
    success: true,
    session,
    companyId: session.metadata?.company_id ?? null,
    userId: session.metadata?.user_id ?? null,
  }
}

/**
 * Supabase Storage (非公開バケット) にPDFをアップロードし、署名付きURLを返す。
 * サービスロールクライアントを使用して RLS をバイパスする。
 */
async function uploadPdfToStorage(
  companyId: string,
  docType: string,
  version: number,
  pdfBuffer: Buffer,
): Promise<{ url: string | null; error?: string }> {
  try {
    const admin = createAdminClient()
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

    // 365日の署名付きURLをDBに永続化しない（漏洩リスクのため）。
    // ストレージパスを file_url として保存し、ダウンロード時に短時間署名付きURLを発行する。
    return { url: filePath }
  } catch (err) {
    return {
      url: null,
      error: err instanceof Error ? err.message : "アップロードに失敗しました",
    }
  }
}

/**
 * ストレージパスを1時間有効の署名付きダウンロードURLに変換する。
 *
 * WHY: file_url にはストレージパス（{companyId}/{docType}_v{n}.pdf）を保存しており、
 * それをそのままリンクにすると非公開バケットのためアクセスできない（リンク切れ）。
 * ダッシュボードと同様に、ダウンロード時に短時間署名付きURLを発行する。
 */
async function signDownloadUrl(filePath: string): Promise<string> {
  const admin = createAdminClient()
  const { data } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(filePath, 60 * 60)
  return data?.signedUrl ?? filePath
}

/**
 * 文書リストの fileUrl をすべて署名付きURLに変換する。
 */
async function signDocumentUrls(
  documents: Array<{ docType: string; fileUrl: string }>,
): Promise<Array<{ docType: string; fileUrl: string }>> {
  return Promise.all(
    documents.map(async (doc) => ({
      docType: doc.docType,
      fileUrl: await signDownloadUrl(doc.fileUrl),
    })),
  )
}

/**
 * BCP 入力データを PDF 用データに変換する。
 */
function toBcpPdfData(
  company: CompanyRow,
  bcpDraft: BcpDraftRow,
  version: number,
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
          })?.keyPartners ??
          (bcpDraft.emergency_contacts as {
            keyPartners: Array<{
              name: string
              jobTitle: string
              phone: string
              email: string
              roleType: string
            }>
          })?.keyPartners ??
          []
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
function toActionManualData(data: BcpPdfData): ActionManualData {
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
function toPocketCardData(data: BcpPdfData): PocketCardData {
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

function getDocTypeLabel(docType: string): string {
  const labels: Record<string, string> = {
    bcp_full: "事業継続計画書 (BCP)",
    action_manual: "非常時初動対応マニュアル",
    pocket_card: "携帯用アクションカード",
  }
  return labels[docType] ?? docType
}

/**
 * 決済処理を実行し、PDF 生成・ストレージ保存・DB登録を行う。
 * JSX を含まない純粋なデータ処理関数。
 */
export async function processPayment(
  sessionId: string,
): Promise<{
  success: boolean
  error?: string
  companyId?: string
  companyName?: string
  documents?: Array<{ docType: string; fileUrl: string }>
  currentVersion?: number
  idempotent?: boolean
}> {
  try {
    // 1. 決済状態を確認
    const payment = await verifyPayment(sessionId)
    if (!payment.success || !payment.session) {
      return { success: false, error: payment.error ?? "決済の確認に失敗しました" }
    }

    const companyId = payment.companyId
    if (!companyId) {
      return { success: false, error: "会社IDがセッションに含まれていません" }
    }

    // 2. 認証チェック：リクエストユーザーとセッション所有者を突合
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return { success: false, error: "認証が必要です" }
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single()

    if (!profile || profile.company_id !== companyId) {
      return { success: false, error: "他社のデータにはアクセスできません" }
    }

    // セッション所有者とログインユーザーの一致も確認
    if (
      payment.session.metadata?.user_id &&
      payment.session.metadata.user_id !== user.id
    ) {
      return { success: false, error: "セッション所有者と一致しません" }
    }

    // 4. 冪等性チェック：既に処理済みのセッションなら重複発行をスキップ
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id, company_id, plan_type, status")
      .eq("stripe_session_id", sessionId)
      .single()

    // 会社情報を取得（冪等性チェック後の処理でも使用）
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("*")
      .eq("id", companyId)
      .single()

    if (existingOrder) {
      // 既存の generated_documents を最新バージョンで取得して返す
      const { data: existingDocs } = await supabase
        .from("generated_documents")
        .select("doc_type, file_url, version")
        .eq("company_id", existingOrder.company_id)
        .order("version", { ascending: false })
        .order("created_at", { ascending: false })

      const companyName = company?.name ?? ""
      return {
        success: true,
        companyId: existingOrder.company_id,
        companyName,
        documents: await signDocumentUrls(
          (existingDocs ?? []).map((d) => ({
            docType: d.doc_type,
            fileUrl: d.file_url,
          })),
        ),
        currentVersion: existingDocs?.[0]?.version ?? 0,
        idempotent: true,
      }
    }

    // orders レコードを作成（Webhook 側との重複は unique 制約でスキップ）
    // WHY: 23505 (unique_violation) は重複 webhook / 重複アクセスによるもので、
    // 正常な冪等動作として扱う。金額は Stripe セッションの実際の amount_total を記録する。
    const { error: orderError } = await supabase.from("orders").insert({
      company_id: companyId,
      stripe_session_id: sessionId,
      plan_type: "one_time",
      status: "paid",
      amount: payment.session.amount_total ?? 0,
    })

    if (orderError && orderError.code !== "23505") {
      return { success: false, error: orderError.message }
    }

    if (companyError || !company) {
      return { success: false, error: "会社情報が見つかりません" }
    }

    // 4. バージョン番号を原子的にインクリメント（楽観的ロック）
    const expectedVersion = company.document_version ?? 0
    const currentVersion = expectedVersion + 1

    // 5. BCP ドラフトデータを取得
    const { data: bcpDraft, error: draftError } = await supabase
      .from("bcp_inputs")
      .select("*")
      .eq("company_id", companyId)
      .single()

    if (draftError || !bcpDraft) {
      return { success: false, error: "BCP 策定データが見つかりません" }
    }

    // 6. PDF 用データに変換
    const bcpPdfData = toBcpPdfData(company as CompanyRow, bcpDraft as BcpDraftRow, currentVersion)

    // 7. 3種類のPDFを生成
    const actionManualData = toActionManualData(bcpPdfData)
    const pocketCardData = toPocketCardData(bcpPdfData)

    const [bcpBuffer, actionManualBuffer, pocketCardBuffer] =
      await Promise.all([
        generateBcpPdf(bcpPdfData),
        renderToBuffer(<ActionManualDocument data={actionManualData} />),
        renderToBuffer(<PocketCardDocument data={pocketCardData} />),
      ])

    // 8. Supabase Storage にアップロード
    const [bcpResult, actionResult, pocketResult] = await Promise.all([
      uploadPdfToStorage(companyId, "bcp_full", currentVersion, bcpBuffer),
      uploadPdfToStorage(
        companyId,
        "action_manual",
        currentVersion,
        actionManualBuffer,
      ),
      uploadPdfToStorage(
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
      return { success: false, error: errorMsg }
    }

    // 9. generated_documents に登録
    // 9. generated_documents に登録（DB にはストレージパスを保存。署名付きURLは
    // ダウンロード時のみ発行するため、永続化しない）
    const rawDocuments = [
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

    // 表示用リンクは1時間有効の署名付きURLに変換する
    const documents = await signDocumentUrls(rawDocuments)

    // 10. companies の document_version を更新（楽観的ロック）
    const { error: versionError } = await supabase
      .from("companies")
      .update({ document_version: currentVersion })
      .eq("id", companyId)
      .eq("document_version", expectedVersion)

    if (versionError) {
      return { success: false, error: versionError.message }
    }

    // バージョンが正しくインクリメントされたか確認
    const { data: updatedCompany } = await supabase
      .from("companies")
      .select("document_version")
      .eq("id", companyId)
      .single()

    if (updatedCompany?.document_version !== currentVersion) {
      return { success: false, error: "バージョン競合が発生しました。もう一度お試しください。" }
    }

    // 11. bcp_inputs の is_completed を true にする
    const { error: completedError } = await supabase
      .from("bcp_inputs")
      .update({ is_completed: true })
      .eq("company_id", companyId)

    if (completedError) {
      return { success: false, error: completedError.message }
    }

    return {
      success: true,
      companyId,
      companyName: company.name,
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

/**
 * 決済完了画面のレンダリング専用コンポーネント（JSX only、try/catch 外）。
 */
function SuccessView({
  companyId,
  companyName,
  documents,
  currentVersion,
}: {
  companyId: string
  companyName: string
  documents: Array<{ docType: string; fileUrl: string }>
  currentVersion: number
}) {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-12">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold">決済が完了しました</h1>
        <p className="text-muted-foreground mt-2">
          {companyName} の BCP ドキュメントが発行されました。下記よりダウンロードできます。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {documents.map((doc) => (
          <Card key={doc.docType}>
            <CardHeader>
              <CardTitle>{getDocTypeLabel(doc.docType)}</CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <Button asChild className="w-full">
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  PDF をダウンロード
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>一括ダウンロード</CardTitle>
            <CardDescription>
              全ドキュメントをZIPファイルでまとめてダウンロードします。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a
                href={`/api/download/zip?company_id=${companyId}&version=${currentVersion}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                ZIP 一括ダウンロード
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 text-center">
        <a
          href="/dashboard"
          className="inline-block text-primary hover:underline"
        >
          マイページに戻る
        </a>
      </div>
    </div>
  )
}

/**
 * エラー表示専用コンポーネント（JSX only、try/catch 外）。
 */
function ErrorView({ message }: { message: string }) {
  return (
    <div className="mx-auto w-full max-w-md px-6 py-12">
      <h1 className="text-2xl font-bold text-destructive">エラー</h1>
      <p className="text-muted-foreground mt-4">{message}</p>
      <a
        href="/wizard/summary"
        className="mt-6 inline-block text-primary hover:underline"
      >
        サマリーページに戻る
      </a>
    </div>
  )
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>
}) {
  const resolvedSearchParams = await searchParams
  const sessionId = resolvedSearchParams.session_id

  if (!sessionId) {
    redirect("/wizard/summary")
  }

  // データ処理（try/catch 内、JSX なし）
  const result = await processPayment(sessionId)

  if (!result.success) {
    return <ErrorView message={result.error ?? "処理に失敗しました"} />
  }

  if (!result.companyName || !result.documents) {
    return <ErrorView message="処理結果が不正です" />
  }

  // 成功ビュー（JSX のみ、try/catch 外）
  return (
    <SuccessView
      companyId={result.companyId ?? ""}
      companyName={result.companyName}
      documents={result.documents}
      currentVersion={result.currentVersion ?? 0}
    />
  )
}
