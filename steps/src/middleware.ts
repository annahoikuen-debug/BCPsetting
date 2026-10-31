import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"

/**
 * 認証状態に基づくルート保護ミドルウェア。
 *
 * - /wizard, /dashboard 以下は未認証時 /login へリダイレクト
 * - /login, /signup は認証済み時 /wizard へリダイレクト
 *
 * src/proxy.ts と同じロジックを Next.js ミドルウェアとして配置し、
 * エッジで認証ルート保護を強制する。
 */

/** セキュリティヘッダーをレスポンスに付与する */
function withSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  return response
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: { headers: request.headers },
  })

  const cookieStore = await cookies()

  // 環境変数が未設定の場合（例: .env.local 未作成）は認証チェックをスキップ。
  // 本番運用時は NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY を必ず設定すること。
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return withSecurityHeaders(response)
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async getAll() {
          return cookieStore.getAll()
        },
        async setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthRoute =
    request.nextUrl.pathname === "/login" ||
    request.nextUrl.pathname === "/signup"
  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/wizard") ||
    request.nextUrl.pathname.startsWith("/dashboard")

  // 未認証ユーザーが保護ルートにアクセス → /login へ
  if (!user && isProtectedRoute) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", request.nextUrl.pathname)
    return withSecurityHeaders(NextResponse.redirect(loginUrl))
  }

  // 認証済みユーザーが認証画面にアクセス → /wizard へ
  if (user && isAuthRoute) {
    return withSecurityHeaders(NextResponse.redirect(new URL("/wizard", request.url)))
  }

  // トークンリフレッシュで更新されたクッキーを response に書き戻し、
  // ブラウザに届ける。
  return withSecurityHeaders(response)
}

export const config = {
  matcher: [
    "/wizard/:path*",
    "/dashboard/:path*",
    "/login",
    "/signup",
  ],
}
