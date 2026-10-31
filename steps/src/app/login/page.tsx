"use client"

import Link from "next/link"
import { useActionState } from "react"
import { signinFormAction } from "@/app/actions/auth"
import { GoogleSignInButton } from "@/components/shared/google-signin-button"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(signinFormAction, null)
  const formError = state?.error?._form
  const errorMessage = Array.isArray(formError)
    ? formError.join("、")
    : formError
    ? String(formError)
    : null

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">ログイン</CardTitle>
          <CardDescription>
            メールアドレスとパスワードでログインしてください。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {errorMessage && (
            <p className="text-sm text-destructive text-center">{errorMessage}</p>
          )}
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="••••••••"
                required
              />
            </div>
            <Button type="submit" disabled={isPending} className="w-full">
              {isPending ? "ログイン中…" : "ログイン"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                または
              </span>
            </div>
          </div>

          <GoogleSignInButton />

          <p className="text-sm text-center text-muted-foreground">
            アカウントをお持ちでない方は{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              新規登録
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
