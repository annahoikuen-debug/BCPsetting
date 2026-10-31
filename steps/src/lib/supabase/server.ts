import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * サーバー（Server Component / Route Handler / Server Action）用の Supabase クライアントを生成する。
 * リクエストごとに生成するため、キャッシュせず都度呼び出すこと。
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server Component からの呼び出しでは Cookie 書き込みが不可。
            // セッション更新は Middleware 側で行うため、ここでは握りつぶす。
          }
        },
      },
    },
  )
}
