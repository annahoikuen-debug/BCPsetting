/**
 * PDF プレビュー・生成 API Route Handler。
 *
 * POST /api/pdf/preview
 * Body: { type: "bcp-full" | "action-manual" | "pocket-card", data: {...} }
 *
 * 指定された種類の PDF をバッファ生成し、ブラウザ上で直接表示（インライン）
 * またはダウンロード可能な形式で返却する。
 */
import { NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import { BcpFullDocument } from "@/components/pdf/BcpFullDocument"
import type { BcpPdfData } from "@/components/pdf/BcpFullDocument"
import { ActionManualDocument } from "@/components/pdf/ActionManualDocument"
import type { ActionManualData } from "@/components/pdf/ActionManualDocument"
import { PocketCardDocument } from "@/components/pdf/PocketCardDocument"
import type { PocketCardData } from "@/components/pdf/PocketCardDocument"
import { createClient } from "@/lib/supabase/server"
import * as z from "zod"

type PdfType = "bcp-full" | "action-manual" | "pocket-card"

/** レンダリング関数（JSX を try/catch の外に分離） */
async function renderPdf(type: PdfType, data: BcpPdfData | ActionManualData | PocketCardData): Promise<Buffer> {
  if (type === "bcp-full") {
    const bcpData = data as BcpPdfData
    return await renderToBuffer(<BcpFullDocument data={bcpData} />)
  }
  if (type === "action-manual") {
    const manualData = data as ActionManualData
    return await renderToBuffer(<ActionManualDocument data={manualData} />)
  }
  if (type === "pocket-card") {
    const cardData = data as PocketCardData
    return await renderToBuffer(<PocketCardDocument data={cardData} />)
  }
  throw new Error("不明な PDF 種類です")
}

/** プレビューリクエストボディのバリデーションスキーマ */
const previewRequestSchema = z.object({
  type: z.enum(["bcp-full", "action-manual", "pocket-card"]),
  data: z.record(z.string(), z.unknown()),
})

// PDF プレビューのリクエストボディサイズ制限（10MB）
const MAX_PREVIEW_BODY_BYTES = 10 * 1024 * 1024

// ---------------------------------------------------------------------------
// レート制限（PDF レンダリングは CPU 集約的なため DoS 対策として導入）
// ユーザーID ごとに直近 1 分間のリクエスト数を記録し、閾値を超えた場合は 429 を返す。
// 単一インスタンス前提のインメモリ実装。分散環境では Redis 等への移行を検討すること。
// ---------------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const RATE_LIMIT_MAX = 10
const rateLimitRecords = new Map<string, number[]>()

function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now()
  const windowStart = now - RATE_LIMIT_WINDOW_MS
  const timestamps = rateLimitRecords.get(userId) ?? []

  // 古いレコードを除外
  const recent = timestamps.filter((t) => t > windowStart)

  if (recent.length >= RATE_LIMIT_MAX) {
    const oldest = Math.min(...recent)
    return { allowed: false, retryAfter: Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - now) / 1000) }
  }

  recent.push(now)
  rateLimitRecords.set(userId, recent)
  return { allowed: true }
}

export async function POST(req: Request) {
  try {
    // リクエストボディサイズ制限（10MB）
    const contentLength = req.headers.get("content-length")
    if (contentLength && Number.parseInt(contentLength, 10) > MAX_PREVIEW_BODY_BYTES) {
      return NextResponse.json({ error: "リクエストボディが大きすぎます" }, { status: 413 })
    }

    // 認証状態の確認
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: "認証が必要です" },
        { status: 401 },
      )
    }

    // レート制限チェック（ユーザーID単位）
    const rateLimit = checkRateLimit(user.id)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "リクエストが多すぎます。しばらく経ってから再度お試しください。" },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter ?? 60) } },
      )
    }

    // リクエストボディのバリデーション
    const body = await req.json()
    const parsed = previewRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "リクエストボディが不正です: " + parsed.error.flatten().fieldErrors },
        { status: 400 },
      )
    }

    const { type, data } = parsed.data

    const buffer = await renderPdf(
      type,
      data as BcpPdfData | ActionManualData | PocketCardData,
    )

    // ブラウザ上で直接表示（インライン）するためのヘッダー
    return new NextResponse(Uint8Array.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="fastbcp-document.pdf"',
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    })
  } catch (err) {
    console.error("[POST /api/pdf/preview] エラー:", err)
    return NextResponse.json(
      { error: "PDF 生成に失敗しました" },
      { status: 500 },
    )
  }
}

export const dynamic = "force-dynamic"
