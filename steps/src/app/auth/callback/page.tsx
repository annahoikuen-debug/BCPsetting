"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"

/**
 * Google OAuth 認証コールバックページ。
 * Supabase からリダイレクト後にセッションを確立し、/wizard へ遷移する。
 *
 * Supabase プロジェクトの Redirect URLs にこのページの URL を登録してください。
 * 例: http://localhost:3000/auth/callback
 */
export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const error = searchParams.get("error")
    const errorDescription = searchParams.get("error_description")
    const next = searchParams.get("next")

    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session }, error: sessionError }) => {
      if (sessionError || !session) {
        const message = errorDescription || error || "認証に失敗しました"
        router.push(`/login?error=${encodeURIComponent(message)}`)
        return
      }

      // next パラメータを same-origin チェックしてリダイレクト先に使用
      let redirectTo = "/wizard"
      if (next) {
        try {
          const nextUrl = new URL(next, window.location.origin)
          if (nextUrl.origin === window.location.origin) {
            redirectTo = nextUrl.pathname + nextUrl.search
          }
        } catch {
          // 無効な URL は無視し、デフォルトの /wizard に遷移
        }
      }
      router.push(redirectTo)
    })
  }, [router, searchParams])

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
      <p className="text-muted-foreground">認証を処理しています…</p>
    </div>
  )
}
