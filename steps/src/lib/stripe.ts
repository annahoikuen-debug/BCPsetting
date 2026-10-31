/**
 * Stripe API 初期化モジュール。
 *
 * src/lib/stripe/server.ts のシングルトンクライアントを再エクスポートし、
 * アプリケーション全体で統一的に Stripe クライアントを利用できるようにする。
 *
 * 使用例：
 *   import { getStripe } from "@/lib/stripe"
 *   const stripe = getStripe()
 */
export { getStripe } from "@/lib/stripe/server"
export type { Stripe } from "stripe"
