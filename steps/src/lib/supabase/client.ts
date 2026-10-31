import { createBrowserClient } from "@supabase/ssr"

/**
 * ブラウザ（クライアントコンポーネント）用の Supabase クライアントを生成する。
 * 呼び出しのたびに新規生成するのではなく、コンポーネント側で 1 度だけ呼び出して使い回すこと。
 */
export function createClient() {
  return createBrowserClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  )
}

function requiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `環境変数 ${name} が未設定です。.env.example を参考に .env.local を作成してください。`,
    )
  }
  return value
}
