/**
 * Stripe Checkout Session 作成 API。
 *
 * POST /api/checkout
 * 認証済みユーザーの company_id を metadata に付与し、
 * 9,800 円（税抜）の都度決済セッションを作成する。
 *
 * 成功後: /checkout/success?session_id={CHECKOUT_SESSION_ID}
 * キャンセル後: /wizard/summary
 */
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe"

/** ドキュメント出力権限の価格（税抜、円） */
const DOCUMENT_PRICE_JPY = 9800

/** Stripe Checkout で使用する通貨（JPY） */
const CURRENCY = "jpy"

export async function POST(req: Request) {
  try {
    const supabase = await createClient()

    // 認証状態の確認
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

    // company_id をプロフィールから取得
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

    const companyId = profile.company_id

    const stripe = getStripe()

    const origin = req.headers.get("origin") ?? "http://localhost:3000"

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: CURRENCY,
            product_data: {
              name: "BCP ドキュメント出力権限（1 ドキュメント）",
              description:
                "事業継続計画書（PDF）および初動対応マニュアル・携帯用アクションカードの出力権限",
            },
            unit_amount: DOCUMENT_PRICE_JPY, // 9,800 円（税抜）
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/wizard/summary`,
      metadata: {
        company_id: companyId,
        user_id: user.id,
      },
      customer_email: user.email ?? undefined,
    })

    return NextResponse.json({ sessionId: session.id, url: session.url })
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Checkout セッションの作成に失敗しました",
      },
      { status: 500 },
    )
  }
}
