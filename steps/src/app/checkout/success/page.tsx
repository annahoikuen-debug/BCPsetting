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
import {
  generateAndStoreDocuments,
  signDownloadUrl,
} from "@/lib/documents/issue"
import type { IssueDocumentsResult } from "@/lib/documents/issue"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

/**
 * 決済セッションを取得し、支払いが完了しているかを確認する。
 */
async function verifyPayment(sessionId: string) {
  const stripe = getStripe()
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["payment_intent"],
  })

  if (session.payment_status !== "paid") {
    return { success: false as const, error: "決済が完了していません" }
  }

  if (session.mode !== "payment") {
    // サブスクリプションセッションは /dashboard 経由の別フローで扱う
    return { success: false as const, error: "このセッションは都度決済ではありません" }
  }

  return {
    success: true as const,
    session,
    companyId: session.metadata?.company_id ?? null,
    userId: session.metadata?.user_id ?? null,
  }
}

/**
 * 決済処理を実行し、PDF 生成・ストレージ保存・DB登録を行う。
 * JSX を含まない純粋なデータ処理関数。
 *
 * 処理順序（不整合の固定化を防ぐため、書き込みは検証が全て通ってから）:
 *   1. Stripe セッションの支払い状態を検証
 *   2. 認証ユーザーとセッション所有者の突合
 *   3. BCP ドラフトの存在確認（未保存なら注文を記録せずエラー）
 *   4. 冪等性チェック（既存 orders があれば文書が存在する場合のみ冪等成功。
 *      文書が無い場合は過去の生成失敗とみなして再生成を試みる）
 *   5. orders レコード作成（Webhook 側との重複は unique 制約でスキップ）
 *   6. ドキュメント生成・保存（共通モジュール）
 */
export async function processPayment(
  sessionId: string,
): Promise<IssueDocumentsResult & { idempotent?: boolean }> {
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

    // 3. BCP ドラフトの存在確認（注文記録より前に行う）。
    // WHY: ドラフト未保存のまま orders を作ると、支払い済みで文書が生成されない
    // 状態が固定化されてしまうため。
    const { data: draftExists } = await supabase
      .from("bcp_inputs")
      .select("company_id")
      .eq("company_id", companyId)
      .maybeSingle()

    if (!draftExists) {
      return { success: false, error: "BCP 策定データが見つかりません" }
    }

    // 4. 冪等性チェック：既に処理済みのセッションなら重複発行をスキップ
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id, company_id, plan_type, status")
      .eq("stripe_session_id", sessionId)
      .maybeSingle()

    if (existingOrder) {
      // 既存の generated_documents を最新バージョンで取得
      const { data: existingDocs } = await supabase
        .from("generated_documents")
        .select("doc_type, file_url, version")
        .eq("company_id", existingOrder.company_id)
        .order("version", { ascending: false })
        .order("created_at", { ascending: false })

      if (existingDocs && existingDocs.length > 0) {
        // 文書が既に存在する → 冪等成功として再発行しない
        const { data: company } = await supabase
          .from("companies")
          .select("name")
          .eq("id", existingOrder.company_id)
          .single()

        const admin = createAdminClient()
        const signedDocs = await Promise.all(
          existingDocs.map(async (d) => ({
            docType: d.doc_type,
            fileUrl: await signDownloadUrl(admin, d.file_url),
          })),
        )

        if (signedDocs.some((d) => d.fileUrl === null)) {
          return {
            success: false,
            error: "ダウンロード URL の発行に失敗しました。再度お試しください。",
          }
        }

        return {
          success: true,
          companyId: existingOrder.company_id,
          companyName: company?.name ?? "",
          documents: signedDocs as Array<{ docType: string; fileUrl: string }>,
          currentVersion: existingDocs[0]?.version ?? 0,
          idempotent: true,
        }
      }
      // 文書が存在しない → 過去の生成失敗。orders は既に記録済みなので
      // 再 insert せず、生成のみをやり直す（ステップ 5 をスキップ）。
    } else {
      // 5. orders レコードを作成（Webhook 側との重複は unique 制約でスキップ）
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
        return { success: false, error: "注文の記録に失敗しました" }
      }
    }

    // 6. ドキュメント生成・保存（共通モジュールに委譲）
    const result = await generateAndStoreDocuments(companyId)
    return result
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "予期しないエラーが発生しました",
    }
  }
}

/**
 * 決済完了画面のレンダリング専用コンポーネント（JSX only）。
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

function getDocTypeLabel(docType: string): string {
  const labels: Record<string, string> = {
    bcp_full: "事業継続計画書 (BCP)",
    action_manual: "非常時初動対応マニュアル",
    pocket_card: "携帯用アクションカード",
  }
  return labels[docType] ?? docType
}

/**
 * エラー表示専用コンポーネント（JSX only）。
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

  // データ処理（JSX なし）
  const result = await processPayment(sessionId)

  if (!result.success) {
    return <ErrorView message={result.error ?? "処理に失敗しました"} />
  }

  if (!result.companyName || !result.documents) {
    return <ErrorView message="処理結果が不正です" />
  }

  // 成功ビュー
  return (
    <SuccessView
      companyId={result.companyId ?? ""}
      companyName={result.companyName}
      documents={result.documents}
      currentVersion={result.currentVersion ?? 0}
    />
  )
}
