/**
 * Stripe Billing サブスクリプション Checkout Session 作成 API。
 *
 * POST /api/subscribe/checkout
 *
 * 月額プラン（1,480円/月）または年額プラン（14,800円/年）の
 * 定期課金 Checkout セッションを作成する。
 *
 * リクエストボディ:
 *   { plan: "monthly" | "yearly" }
 *
 * レスポンス:
 *   { sessionId: string, url: string }
 */
import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe"

type PlanType = "monthly" | "yearly"

interface SubscribeCheckoutRequestBody {
  plan: PlanType
}

/**
 * プランに対応する Stripe 価格 ID を取得する。
 */
function getPriceId(plan: PlanType): string {
  if (plan === "monthly") {
    const priceId = process.env.STRIPE_PRICE_ID_MONTHLY
    if (!priceId) {
      throw new Error("STRIPE_PRICE_ID_MONTHLY が未設定です")
    }
    return priceId
  }
  const priceId = process.env.STRIPE_PRICE_ID_YEARLY
  if (!priceId) {
    throw new Error("STRIPE_PRICE_ID_YEARLY が未設定です")
  }
  return priceId
}

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

    // リクエストボディのバリデーション
    const body: SubscribeCheckoutRequestBody = await req.json()
    const plan: PlanType = body.plan

    if (plan !== "monthly" && plan !== "yearly") {
      return NextResponse.json(
        { error: "plan は 'monthly' または 'yearly' である必要があります" },
        { status: 400 },
      )
    }

    const stripe = getStripe()

    // 既存の Stripe Customer ID を確認し、なければ作成
    const { data: company } = await supabase
      .from("companies")
      .select("stripe_customer_id, name")
      .eq("id", companyId)
      .single()

    let stripeCustomerId = company?.stripe_customer_id

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        metadata: {
          company_id: companyId,
          user_id: user.id,
        },
      })
      stripeCustomerId = customer.id

      await supabase
        .from("companies")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", companyId)
    }

    const origin =
      process.env.NEXT_PUBLIC_APP_URL ?? req.headers.get("origin") ?? "http://localhost:3000"

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      line_items: [
        {
          price: getPriceId(plan),
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/dashboard?subscription=success&plan=${plan}`,
      cancel_url: `${origin}/dashboard?subscription=canceled`,
      metadata: {
        company_id: companyId,
        user_id: user.id,
        plan,
      },
      subscription_data: {
        metadata: {
          company_id: companyId,
          user_id: user.id,
          plan,
        },
      },
    })

    return NextResponse.json({ sessionId: session.id, url: session.url })
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "サブスクリプション Checkout セッションの作成に失敗しました",
      },
      { status: 500 },
    )
  }
}
