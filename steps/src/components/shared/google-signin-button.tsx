"use client"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Mail } from "lucide-react"
import { useEffect, useState } from "react"

/**
 * Google OAuth 認証ボタン。
 *
 * Supabase プロジェクト側で Google プロバイダを有効にし、
 * Redirect URLs に http://localhost:3000/auth/callback（本番は production URL）
 * を登録しておく必要があります。
 */
export function GoogleSignInButton() {
  const [error, setError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    const params = new URLSearchParams(window.location.search)
    const err = params.get("error")
    const errorDescription = params.get("error_description")
    return err ? errorDescription || err : null
  })
  const [loading, setLoading] = useState(false)

  // URL パラメータのエラーは初期状態で設定済みのため、
  // ここではブラウザのURLからエラーパラメータを除去するだけに留める
  // （useEffect 本体での setState はカスケーディングレンダーの原因となるため回避）
  useEffect(() => {
    if (error) {
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [error])

  const handleClick = async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        setError(error.message)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "予期しないエラーが発生しました")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex w-full flex-col items-center justify-center gap-2">
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <Button
        variant="outline"
        onClick={handleClick}
        disabled={loading}
        className="w-full"
      >
        {loading ? "認証中..." : (
          <>
            <Mail className="mr-2 size-4" /> Google で続ける
          </>
        )}
      </Button>
    </div>
  )
}
