"use client"

import Link from "next/link"
import { useActionState } from "react"
import { signupFormAction } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export default function SignupPage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-6">
      <SignupForm />
    </div>
  )
}

function SignupForm() {
  const [state, formAction, isPending] = useActionState(signupFormAction, null)
  const formError = (state as { error?: { _form?: string[] } })?.error?._form
  const errorMessage = Array.isArray(formError)
    ? formError.join("、")
    : formError
    ? String(formError)
    : null
  const requiresConfirmation = state?.requiresConfirmation === true

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">新規登録</CardTitle>
        <CardDescription>
          会社情報とアカウントを登録してください。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorMessage && (
          <p className="text-sm text-destructive text-center">{errorMessage}</p>
        )}
        {requiresConfirmation && (
          <p className="text-sm text-success-foreground text-center">
            確認メールを送信しました。メール内のリンクから本登録を完了してください。
          </p>
        )}
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="companyName">会社名</Label>
            <Input
              id="companyName"
              name="companyName"
              placeholder="株式会社サンプル"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="representativeName">代表者名</Label>
            <Input
              id="representativeName"
              name="representativeName"
              placeholder="山田 太郎"
              required
            />
          </div>
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
            {isPending ? "登録中…" : "アカウントを作成"}
          </Button>
        </form>
      </CardContent>
      <CardFooter>
        <p className="text-sm text-center text-muted-foreground">
          すでにアカウントをお持ちの方は{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            ログイン
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
