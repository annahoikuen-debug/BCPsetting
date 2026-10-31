/**
 * マイページ・ダッシュボード (/dashboard)
 *
 * 策定済みBCPのステータス表示、発行済みドキュメントの再ダウンロード、
 * 「策定データを再編集する」ボタン（都度購入者は購入後7日間のみ
 * 編集・再発行可能、それ以降はロック）を提供する。
 */
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import Link from "next/link"
import { signout, ensureProfile } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { format } from "date-fns"
import { ShieldCheck, Download, Edit } from "lucide-react"

interface GeneratedDocument {
  id: string
  doc_type: string
  file_url: string
  version: number
  created_at: string
}

const DOC_TYPE_LABELS: Record<string, string> = {
  bcp_full: "事業継続計画書 (BCP)",
  action_manual: "非常時初動対応マニュアル",
  pocket_card: "携帯用アクションカード",
}

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const supabase = await createClient()

  // 認証状態の確認
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) {
    return (
      <div className="mx-auto w-full max-w-md px-6 py-12">
        <h1 className="text-2xl font-bold">認証が必要です</h1>
        <p className="text-muted-foreground mt-4">
          ログインしてダッシュボードをご利用ください。
        </p>
        <a
          href="/login"
          className="mt-6 inline-block text-primary hover:underline"
        >
          ログインページへ
        </a>
      </div>
    )
  }

  // 会社情報を取得（未作成なら生成する。OAuth 初回ログイン対応）
  const { companyId, error: provisionError } = await ensureProfile()

  if (!companyId) {
    return (
      <div className="mx-auto w-full max-w-md px-6 py-12">
        <h1 className="text-2xl font-bold">エラー</h1>
        <p className="text-muted-foreground mt-4">
          {provisionError ?? "会社情報が見つかりません。"}
        </p>
      </div>
    )
  }

  // 会社情報を取得（bcp_inputs の is_completed も併せて取得）
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("*, bcp_inputs(is_completed)")
    .eq("id", companyId)
    .single()

  if (companyError || !company) {
    return (
      <div className="mx-auto w-full max-w-md px-6 py-12">
        <h1 className="text-2xl font-bold">エラー</h1>
        <p className="text-muted-foreground mt-4">
          会社情報が見つかりません。
        </p>
      </div>
    )
  }

  // 生成済みドキュメントを取得（最新バージョンのみ）
  const { data: documents } = await supabase
    .from("generated_documents")
    .select("id, doc_type, file_url, version, created_at")
    .eq("company_id", companyId)
    .order("version", { ascending: false })
    .order("created_at", { ascending: false })

  // 発行済みかどうか
  const isPurchased = !!company.purchased_at
  const documentVersion = company.document_version ?? 0
  const createdAt = company.created_at
    ? new Date(company.created_at)
    : null
  const purchasedAt = company.purchased_at
    ? new Date(company.purchased_at)
    : null

  // 7日間編集可能かどうか（購入後7日間）
  // サーバーコンポーネントなので new Date() を使用
  const now = new Date()
  const isEditable =
    isPurchased &&
    purchasedAt &&
    now.getTime() - purchasedAt.getTime() <= 7 * 24 * 60 * 60 * 1000

  const latestVersionDocs = documents?.filter(
    (d) => d.version === documentVersion,
  ) || []

  // 各ドキュメントの短時間署名付きURLを発行（ストレージバケットは非公開のため、
  // ストレージパスを file_url として保存し、ダウンロード時に1時間有効のURLを発行）
  const admin = createAdminClient()
  const signedUrlMap = new Map<string, string | null>()
  await Promise.all(
    (latestVersionDocs as GeneratedDocument[]).map(async (doc) => {
      const { data } = await admin.storage
        .from("bcp-documents")
        .createSignedUrl(doc.file_url, 60 * 60)
      signedUrlMap.set(doc.id, data?.signedUrl ?? null)
    }),
  )

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="mb-8 flex flex-col gap-2">
        <h1 className="text-2xl font-bold">マイページ・ダッシュボード</h1>
        <p className="text-muted-foreground">
          会社の BCP 策定状況と発行済みドキュメントを管理します。
        </p>
      </div>

      {/* 会社情報・ステータスカード */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" /> {company.name}
          </CardTitle>
          <CardDescription>
            {company.industry}｜従業員数：{company.employee_scale}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-xs text-muted-foreground">策定ステータス</p>
            <p className="font-medium">
              {Array.isArray(company.bcp_inputs) &&
              company.bcp_inputs[0]?.is_completed
                ? "策定完了"
                : "策定中"}
            </p>
          </div>
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-xs text-muted-foreground">
              ドキュメントバージョン
            </p>
            <p className="font-medium">
              {documentVersion > 0 ? `v${documentVersion}` : "未発行"}
            </p>
          </div>
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-xs text-muted-foreground">購入状況</p>
            <p className={`font-medium ${isPurchased ? "text-green-600" : "text-muted-foreground"}`}>
              {isPurchased ? "購入済み" : "未購入"}
            </p>
          </div>
        </CardContent>
        {isPurchased && createdAt && (
          <CardFooter className="pt-4 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>策定日：</span>
              <span>{format(createdAt, "yyyy年MM月dd日")}</span>
            </div>
            {company.updated_at && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <span>最終更新：</span>
                <span>
                  {format(new Date(company.updated_at), "yyyy年MM月dd日 HH:mm")}
                </span>
              </div>
            )}
          </CardFooter>
        )}
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        {/* ウィザードカード */}
        <Card>
          <CardHeader>
            <CardTitle>BCP 策定ウィザード</CardTitle>
            <CardDescription>
              質問に答えて BCP を作成・編集します。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              ステップに沿って入力を進めます。
            </p>
          </CardContent>
          <CardFooter className="flex justify-between items-center pt-6 border-t">
            {isEditable ? (
              <Button asChild className="w-full">
                <Link href="/wizard?step=1">
                  <Edit className="mr-2 size-4" />
                  策定データを編集
                </Link>
              </Button>
            ) : (
              <Button disabled className="w-full opacity-50 cursor-not-allowed">
                <Edit className="mr-2 size-4" />
                編集期間終了（7日間）
              </Button>
            )}
            <Link href="/wizard/summary">
              <Button variant="outline">
                確認サマリーを見る
              </Button>
            </Link>
          </CardFooter>
        </Card>

        {/* 発行済みドキュメントカード */}
        <Card>
          <CardHeader>
            <CardTitle>発行済みドキュメント</CardTitle>
            <CardDescription>
              生成済みの BCP PDF を再ダウンロードできます。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {latestVersionDocs.length > 0 ? (
              <div className="space-y-3">
                {(latestVersionDocs as GeneratedDocument[]).map((doc) => (
                  <Card key={doc.id} className="border p-3">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">
                            {DOC_TYPE_LABELS[doc.doc_type] ?? doc.doc_type}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            バージョン {doc.version}
                          </p>
                        </div>
                        <Button
                          asChild
                          size="sm"
                          className="text-primary hover:bg-primary/10"
                        >
                          <a
                            href={signedUrlMap.get(doc.id) ?? doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Download className="mr-2 size-4" />
                            ダウンロード
                          </a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>まだドキュメントは発行されていません。</p>
                {!isPurchased && (
                  <p className="text-xs mt-2">
                    ドキュメント発行には決済が必要です。
                  </p>
                )}
              </div>
            )}
          </CardContent>
          {!isPurchased && (
            <CardFooter className="pt-4 border-t">
              <Button asChild className="w-full">
                <a href="/wizard/summary">ドキュメントを発行する</a>
              </Button>
            </CardFooter>
          )}
        </Card>

        {/* アカウント設定カード */}
        <Card>
          <CardHeader>
            <CardTitle>アカウント設定</CardTitle>
            <CardDescription>
              プロファイルと会社情報を管理します。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              設定画面は準備中です。
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={signout} className="w-full">
              ログアウト
            </Button>
          </CardFooter>
        </Card>
      </div>

      {isPurchased && !isEditable && (
        <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-3">
            <Edit className="size-5 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-800">
                編集期間が終了しました
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                策定後7日間を過ぎたため、策定データの編集・再発行は
                ロックされています。ドキュメントの再ダウンロードは
                引き続き可能です。
              </p>
            </div>
          </div>
        </div>
      )}

      {isEditable && (
        <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-3">
            <Edit className="size-5 text-green-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-green-800">
                編集可能期間です
              </h3>
              <p className="text-sm text-green-700 mt-1">
                購入後7日間以内のため、策定データの編集・再発行が
                可能です。
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
