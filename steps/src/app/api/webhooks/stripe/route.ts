/**
 * Stripe Webhook 処理 API。
 *
 * POST /api/webhooks/stripe
 *
 * Stripe から送信される Webhook イベントを受信し、
 * 署名検証を行った上で注文・購入フラグ・サブスクリプションステータスを更新する。
 *
 * 主な処理イベント:
 *   - checkout.session.completed: 一時購入 / サブスクリプション開始
 *   - invoice.payment_succeeded: サブスクリプション継続課金成功
 *   - customer.subscription.deleted: サブスクリプション解約
 *   - customer.subscription.updated: プラン変更・ステータス変更
 *
 * ローカル開発での Stripe CLI による Webhook テスト手順：
 *   1. Stripe CLI をインストールし、アカウントにログインする。
 *      $ stripe login
 *
 *   2. ローカル開発サーバーを起動する（別ターミナル）。
 *      $ npm run dev
 *
 *   3. Webhook エンドポイントをローカルに転送する。
 *      $ stripe listen --forward-to localhost:3000/api/webhooks/stripe
 *
 *   4. 表示される Webhook Signing Secret（whsec_...）を
 *      .env.local の STRIPE_WEBHOOK_SECRET に設定する。
 *
 *   5. テスト用イベントを送信する。
 *      $ stripe trigger checkout.session.completed
 *      $ stripe trigger invoice.payment_succeeded
 *      $ stripe trigger customer.subscription.deleted
 *
 *   6. サーバー側のログで処理結果を確認し、
 *      Supabase の orders / companies テーブルが更新されていることを確認する。
 *
 * 本番運用では、Stripe ダッシュボードの Webhook エンドポイントに
 * https://<your-domain>/api/webhooks/stripe を登録し、
 * 必要なイベント（checkout.session.completed, invoice.payment_succeeded,
 * customer.subscription.deleted, customer.subscription.updated）を有効にすること。
 */
import { NextResponse } from "next/server"
import { headers } from "next/headers"
import Stripe from "stripe"
import { createAdminClient } from "@/lib/supabase/admin"
import { getStripe } from "@/lib/stripe"

/** Stripe Webhook 署名検証用シークレット（.env.local に設定） */
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

export async function POST(req: Request) {
  // Webhook 署名検証には生のリクエストボディが必要なため、
  // text() で取得する（JSON パース前）。
  const body = await req.text()
  const headerList = await headers()
  const signature = headerList.get("stripe-signature") ?? ""

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET が未設定です" },
      { status: 500 },
    )
  }

  let event: Stripe.Event
  try {
    // 署名を厳密に検証し、改ざん・リプレイ攻撃を防ぐ
    event = await getStripe().webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    return NextResponse.json(
      { error: `Webhook 署名検証に失敗しました: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 },
    )
  }

  // サービスロールクライアントを使用（Webhook は認証セッションを持たず、
  // RLS をバイパスして companies / orders を更新する必要があるため）
  const supabase = createAdminClient()

  // イベント ID の重複チェック（リプレイ攻撃・重複送信対策）
  // 同一 event.id が既に処理済みなら即座に 200 OK を返し、Stripe への再送を防ぐ
  const { data: existingEvent } = await supabase
    .from("stripe_webhook_events")
    .select("id")
    .eq("event_id", event.id)
    .single()

  if (existingEvent) {
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 })
  }

  try {

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const sessionId = session.id
        const companyId = session.metadata?.company_id ?? null

        if (!companyId) {
          return NextResponse.json(
            { error: "metadata に company_id が含まれていません" },
            { status: 400 },
          )
        }

        const isSubscription = session.mode === "subscription"

        if (isSubscription) {
          // サブスクリプション開始：顧客・サブスクリプション情報を記録
          const customerId = session.customer as string
          const subscriptionId = session.subscription as string

          await supabase.from("companies").update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_status: session.status,
            subscription_plan: (session.metadata?.plan as "monthly" | "yearly") ?? null,
          }).eq("id", companyId)
        } else {
          // 一時購入：orders テーブルに paid ステータスでレコード作成（冪等性：stripe_session_id の unique 制約で重複防止）
          const { error: orderError } = await supabase.from("orders").insert({
            company_id: companyId,
            stripe_session_id: sessionId,
            plan_type: "one_time",
            status: "paid",
            amount: session.amount_total ?? 0,
          })

          if (orderError && orderError.code !== "23505") {
            // 23505 = unique_violation（重複 webhook 送信）はスキップ
            throw orderError
          }

          // companies テーブルに purchased_at を記録（購入済みフラグ）
          await supabase
            .from("companies")
            .update({ purchased_at: new Date().toISOString() })
            .eq("id", companyId)
        }

        break
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription: string
          amount_total: number
        }
        const subscriptionId = invoice.subscription
        const customerId = invoice.customer as string

        // サブスクリプション ID から会社を特定
        const { data: company } = await supabase
          .from("companies")
          .select("id, subscription_status, subscription_plan")
          .eq("stripe_subscription_id", subscriptionId)
          .single()

        if (!company) {
          return NextResponse.json(
            { error: "対象のサブスクリプションが見つかりません" },
            { status: 404 },
          )
        }

        // サブスクリプションステータスを更新
        await supabase
          .from("companies")
          .update({
            subscription_status: "active",
            stripe_customer_id: customerId as string,
          })
          .eq("id", company.id)

        // orders テーブルに継続課金レコードを作成
        await supabase.from("orders").insert({
          company_id: company.id,
          stripe_session_id: invoice.id,
          plan_type: "subscription",
          status: "paid",
          amount: invoice.amount_total,
        })

        break
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        const subscriptionId = subscription.id

        const { data: company } = await supabase
          .from("companies")
          .select("id")
          .eq("stripe_subscription_id", subscriptionId)
          .single()

        if (company) {
          await supabase
            .from("companies")
            .update({
              subscription_status: "canceled",
              subscription_cancel_at_period_end: false,
            })
            .eq("id", company.id)
        }

        break
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription & {
          current_period_end: number
          cancel_at_period_end: boolean
        }
        const subscriptionId = subscription.id

        const { data: company } = await supabase
          .from("companies")
          .select("id")
          .eq("stripe_subscription_id", subscriptionId)
          .single()

        if (!company) {
          return NextResponse.json(
            { error: "対象のサブスクリプションが見つかりません" },
            { status: 404 },
          )
        }

        const currentPeriodEnd = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null

        await supabase
          .from("companies")
          .update({
            subscription_status: subscription.status,
            subscription_current_period_end: currentPeriodEnd,
            subscription_cancel_at_period_end:
              subscription.cancel_at_period_end ?? false,
          })
          .eq("id", company.id)

        break
      }

      default:
        // 未処理イベントは無視（200 を返して Stripe に受理完了を通知）
        break
    }

    // 処理済みイベントを記録し、重複処理・リプレイ攻撃を防止する
    await supabase.from("stripe_webhook_events").insert({
      event_id: event.id,
      event_type: event.type,
    })

    return NextResponse.json({ received: true }, { status: 200 })
  } catch (err) {
    console.error("[POST /api/webhooks/stripe] エラー:", err)
    return NextResponse.json(
      { error: "Webhook 処理に失敗しました" },
      { status: 500 },
    )
  }
}
