"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { redirect } from "next/navigation"
import * as z from "zod"

/**
 * サインアップリクエストのバリデーションスキーマ。
 */
const signupSchema = z.object({
  companyName: z.string().min(1, "会社名を入力してください"),
  representativeName: z.string().min(1, "代表者名を入力してください"),
  email: z.string().email("有効なメールアドレスを入力してください"),
  password: z.string().min(8, "パスワードは8文字以上で入力してください"),
})

export type SignupInput = z.infer<typeof signupSchema>

/**
 * 新規ユーザー登録 + 会社・プロファイル紐付け。
 *
 * フロー:
 *   1. auth.users にユーザーを作成（Supabase Auth）
 *   2. service_role クライアントで companies レコードを作成
 *   3. profiles に company_id を紐付けて登録（role = 'owner'）
 *
 * Supabase デフォルトのメール確認が有効な場合、サインアップ直後の
 * ログインは行わず、「確認メールを送信しました」と案内する。
 */
export async function signup(input: SignupInput) {
  const validated = signupSchema.safeParse(input)
  if (!validated.success) {
    return { error: validated.error.flatten().fieldErrors }
  }

  const { companyName, representativeName, email, password } = validated.data

  const supabase = await createClient()

  // 1. Auth ユーザー作成
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: representativeName,
        company_name: companyName,
      },
    },
  })

  if (authError) {
    return { error: { _form: [authError.message] } }
  }

  const user = authData.user
  if (!user) {
    return { error: { _form: ["ユーザーの作成に失敗しました"] } }
  }

  // 2-3. service_role で companies / profiles を作成（RLS バイパス）
  const admin = createAdminClient()

  let companyId: string | null = null

  try {
    const { data: company, error: companyError } = await admin
      .from("companies")
      .insert({
        name: companyName,
        // 業種・従業員数はウィザード Step 1 の保存時に上書きされるため、
        // NOT NULL 制約を満たすプレースホルダーを初期値として入れる
        industry: "その他",
        employee_scale: "10-49名",
      })
      .select("id")
      .single()

    if (companyError) {
      // companies 作成失敗：Auth ユーザーを削除してロールバック
      await admin.auth.admin.deleteUser(user.id)
      return { error: { _form: [companyError.message] } }
    }

    companyId = company.id

    const { error: profileError } = await admin.from("profiles").insert({
      id: user.id,
      company_id: company.id,
      full_name: representativeName,
      role: "owner",
    })

    if (profileError) {
      // profiles 作成失敗：companies と Auth ユーザーを削除してロールバック
      await admin.from("companies").delete().eq("id", company.id)
      await admin.auth.admin.deleteUser(user.id)
      return { error: { _form: [profileError.message] } }
    }

    // メール確認が有効な場合は自動ログインを行わない
    return {
      success: true,
      requiresConfirmation: true,
      userId: user.id,
      companyId: company.id,
    }
  } catch {
    // 予期しないエラー：作成済みリソースをロールバック
    if (companyId) {
      await admin.from("companies").delete().eq("id", companyId)
    }
    await admin.auth.admin.deleteUser(user.id).catch(() => {
      // 削除に失敗しても無視（既に削除済みの可能性）
    })
    return {
      error: { _form: ["予期しないエラーが発生しました"] },
    }
  }
}

/**
 * メール/パスワードログイン。成功したら /wizard へリダイレクト。
 */
export async function signin(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: { _form: [error.message] } }
  }

  redirect("/wizard")
}

/**
 * useActionState 用のラッパー（login 画面から使用）。
 * WHY: useActionState はクライアント専用フックのため、ページ側で
 * useActionState に渡すアクションはサーバーモジュール側に置く必要がある。
 */
export async function signinFormAction(_prevState: unknown, formData: FormData) {
  return signin(formData)
}

/**
 * useActionState 用のラッパー（signup 画面から使用）。
 */
export async function signupFormAction(_prevState: unknown, formData: FormData) {
  return signup({
    companyName: formData.get("companyName") as string,
    representativeName: formData.get("representativeName") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
  })
}

/**
 * ログアウト。/login へリダイレクト。
 */
export async function signout() {
  const supabase = await createClient()

  await supabase.auth.signOut()

  redirect("/login")
}

/**
 * ログイン済みユーザーの会社・プロフィールが存在しない場合に生成する。
 *
 * WHY: Google OAuth 等の Supabase 経由ログインは signup サーバーアクションを
 * 経由しないため companies / profiles が作られない。そのままだと companyId が
 * 取得できず、ウィザードの保存・ダッシュボード表示が機能しないため、
 * 初回アクセス時にここで生成する。
 */
export async function ensureProfile(): Promise<{
  companyId?: string
  error?: string
}> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: "認証が必要です" }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single()

  if (profile?.company_id) {
    return { companyId: profile.company_id }
  }

  const admin = createAdminClient()

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
  const companyName =
    (typeof metadata.company_name === "string" && metadata.company_name) ||
    (typeof metadata.full_name === "string" && metadata.full_name) ||
    "新規会社"
  const fullName = typeof metadata.full_name === "string" ? metadata.full_name : ""

  const { data: company, error: companyError } = await admin
    .from("companies")
    .insert({ name: companyName })
    .select("id")
    .single()

  if (companyError || !company) {
    return {
      error: companyError?.message ?? "会社情報の作成に失敗しました",
    }
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: user.id,
    company_id: company.id,
    full_name: fullName,
    role: "owner",
  })

  if (profileError) {
    // profiles 作成失敗時は companies も削除して整合性を保つ（signup と同じ方針）
    await admin.from("companies").delete().eq("id", company.id)
    return { error: profileError.message }
  }

  return { companyId: company.id }
}
