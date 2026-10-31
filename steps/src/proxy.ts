import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * 認証状態に基づくルート保護プロキシ。
 *
 * - /wizard, /dashboard 以下は未認証時 /login へリダイレクト
 * - /login, /signup は認証済み時 /wizard へリダイレクト
 *
 * WHY: Next.js 16 では middleware.js は deprecated となり proxy.js への改名が
 * 推奨されている（node_modules/next/dist/docs 参照）。旧 src/middleware.ts から
 * 移行した。Cookie アクセスはプロキシの規約に従い request.cookies /
 * response.cookies を使用する（next/headers の cookies() は Server Component /
 * Server Function / Route Handler 用）。
 *
 * セキュリティヘッダー（X-Frame-Options 等）は next.config.ts の headers() で
 * 全ルートに適用されるため、ここでは認証リダイレクトのみを担う。
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next({
    request,
  })

  // 環境変数が未設定の場合（例: .env.local 未作成）は認証チェックをスキップ。
  // 本番運用時は NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY を必ず設定すること。
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return response
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // トークンリフレッシュ時に request 側にも反映して以降の呼び出しに備える
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
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
    return NextResponse.redirect(loginUrl)
  }

  // 認証済みユーザーが認証画面にアクセス → /wizard へ
  if (user && isAuthRoute) {
    return NextResponse.redirect(new URL("/wizard", request.url))
  }

  // トークンリフレッシュで更新されたクッキーを response に書き戻し、
  // ブラウザに届ける。
  return response
}

export const config = {
  matcher: [
    "/wizard/:path*",
    "/dashboard/:path*",
    "/login",
    "/signup",
  ],
}
