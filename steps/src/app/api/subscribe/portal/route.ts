/**
 * Stripe Customer Portal リダイレクト API。
 *
 * POST /api/subscribe/portal
 *
 * 認証済みユーザーの Stripe Customer ポータルセッションを作成し、
 * ポータル URL を返す。ポータルではカード変更、プラン解約などが可能。
 *
 * リクエストボディ: なし（または {}）
 *
 * レスポンス:
 *   { url: string }
 */
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe"

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

    // company_id と stripe_customer_id をプロフィール・会社情報から取得
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

    const { data: company } = await supabase
      .from("companies")
      .select("stripe_customer_id")
      .eq("id", companyId)
      .single()

    const stripeCustomerId = company?.stripe_customer_id
    if (!stripeCustomerId) {
      return NextResponse.json(
        { error: "Stripe カスタマーが登録されていません" },
        { status: 404 },
      )
    }

    const stripe = getStripe()

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ?? req.headers.get("origin") ?? "http://localhost:3000"

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${origin}/dashboard`,
    })

    return NextResponse.json({ url: portalSession.url })
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Customer ポータルセッションの作成に失敗しました",
      },
      { status: 500 },
    )
  }
}
