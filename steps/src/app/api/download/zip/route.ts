/**
 * ZIP 一括ダウンロード API Route Handler。
 *
 * GET /api/download/zip?company_id={companyId}&version={version}
 *
 * 指定された会社・バージョンの生成済みドキュメントをすべて
 * ZIPファイルにまとめて返却する。
 *
 * 認証チェック: リクエストユーザーの company_id と一致するか確認。
 */
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { Archiver as ArchiverType } from "archiver"

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const companyId = searchParams.get("company_id")
    const version = searchParams.get("version")

    if (!companyId || !version) {
      return NextResponse.json(
        { error: "company_id と version は必須です" },
        { status: 400 },
      )
    }

    const versionNum = parseInt(version, 10)

    // 認証状態の確認
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 })
    }

    // company_id がプロフィールに紐付いているか確認
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", user.id)
      .single()

    if (profileError || !profile?.company_id) {
      return NextResponse.json(
        { error: "会社情報が見つかりません" },
        { status: 404 },
      )
    }

    // 権限チェック
    if (profile.company_id !== companyId) {
      return NextResponse.json(
        { error: "他社のデータにはアクセスできません" },
        { status: 403 },
      )
    }

    // generated_documents からドキュメント一覧を取得
    const { data: documents, error: docsError } = await supabase
      .from("generated_documents")
      .select("doc_type, file_url, version")
      .eq("company_id", companyId)
      .eq("version", versionNum)
      .order("doc_type", { ascending: true })

    if (docsError || !documents || documents.length === 0) {
      return NextResponse.json(
        { error: "ドキュメントが見つかりません" },
        { status: 404 },
      )
    }

    // サービスロールクライアントでストレージからファイルをダウンロード
    const admin = createAdminClient()

    // archiver を動的インポート（CommonJS モジュール対応）
    const archiverModule = await import("archiver")
    const moduleExports = archiverModule as Record<string, unknown>
    const createArchive =
      moduleExports.default ??
      moduleExports.archiver ??
      moduleExports.create

    if (!createArchive || typeof createArchive !== "function") {
      return NextResponse.json(
        { error: "archiver モジュールの読み込みに失敗しました" },
        { status: 500 },
      )
    }

    const archive = createArchive("zip", {
      zlib: { level: 9 },
    }) as ArchiverType

    // レスポンスストリームを設定
    const headers = new Headers()
    headers.set("Content-Type", "application/zip")
    headers.set(
      "Content-Disposition",
      `attachment; filename="bcp_documents_v${versionNum}.zip"`,
    )

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        archive.on("data", (data: Buffer) => {
          controller.enqueue(data)
        })
        archive.on("end", () => {
          controller.close()
        })
        archive.on("error", (err: Error) => {
          controller.error(err)
        })
      },
    })

    // 各ドキュメントをストレージからダウンロードして ZIP に追加
    for (const doc of documents) {
      const fileName = `${doc.doc_type}_v${doc.version}.pdf`
      const filePath = `${companyId}/${fileName}`

      const { data: fileData, error: downloadError } = await admin.storage
        .from("bcp-documents")
        .download(filePath)

      if (downloadError || !fileData) {
        continue
      }

      const arrayBuffer = await fileData.arrayBuffer()
      archive.append(Buffer.from(arrayBuffer), { name: fileName })
    }

    archive.finalize()

    return new NextResponse(stream, {
      status: 200,
      headers: Object.fromEntries(headers),
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "ZIP 生成に失敗しました",
      },
      { status: 500 },
    )
  }
}
