import Stripe from "stripe"

let stripeInstance: Stripe | null = null

/**
 * サーバー用の Stripe クライアントを返す（シングルトン）。
 * Server Action / Route Handler などサーバーサイドでのみ使用すること。
 */
export function getStripe(): Stripe {
  if (!stripeInstance) {
    const secretKey = process.env.STRIPE_SECRET_KEY
    if (!secretKey) {
      throw new Error(
        "環境変数 STRIPE_SECRET_KEY が未設定です。.env.example を参考に .env.local を作成してください。",
      )
    }
    stripeInstance = new Stripe(secretKey)
  }
  return stripeInstance
}
