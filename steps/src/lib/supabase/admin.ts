import { createClient } from "@supabase/supabase-js"

/**
 * サービスロールキーを用いた Supabase Admin クライアントを生成する。
 * RLS をバイパスするため、Server Component / Server Action / Route Handler の
 * サーバーサイドでのみ使用すること。ブラウザ側（クライアントコンポーネント）
 * から絶対に呼び出さないこと。
 *
 * 必要な環境変数:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */
export function createAdminClient() {
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      "環境変数 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です。.env.example を参考に .env.local を作成してください。",
    )
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
