import { createBrowserClient } from "@supabase/ssr"

/**
 * ブラウザ（クライアントコンポーネント）用の Supabase クライアントを生成する。
 * 呼び出しのたびに新規生成するのではなく、コンポーネント側で 1 度だけ呼び出して使い回すこと。
 *
 * WHY: NEXT_PUBLIC_* はビルド時の静的置換（process.env.NEXT_PUBLIC_X の直書きのみ）で
 * クライアントバンドルへインライン化される。動的な添字アクセス（env 変数名を
 * ブラケットで渡す形式）は置換対象外のため、ブラウザで常に undefined になり
 * クライアント機能が全滅する。ここでは必ず静的なプロパティアクセスで受け渡すこと。
 */
export function createClient() {
  return createBrowserClient(
    requiredEnv(process.env.NEXT_PUBLIC_SUPABASE_URL, "NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv(
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    ),
  )
}

function requiredEnv(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(
      `環境変数 ${name} が未設定です。.env.example を参考に .env.local を作成してください。`,
    )
  }
  return value
}
