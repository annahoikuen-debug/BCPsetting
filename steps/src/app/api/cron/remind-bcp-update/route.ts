/**
 * 年次更新リマインド API Route Handler。
 *
 * GET /api/cron/remind-bcp-update
 *
 * Vercel Cron または Supabase Edge Functions から定期実行されるエンドポイント。
 * CRON_SECRET で保護され、不正なリクエストは拒否される。
 *
 * 処理内容:
 *   1. 最終更新（updated_at）から 330 日（11 ヶ月）以上経過した会社を抽出
 *   2. 登録メールアドレス宛に「連絡網・備蓄品の年次見直し」を促すリマインドメールを送信
 *   3. 送信結果をログに記録
 *
 * メール送信サービス:
 *   - RESEND_API_KEY が設定されていれば Resend を使用
 *   - SENDGRID_API_KEY が設定されていれば SendGrid を使用
 *   - どちらも設定されていない場合はコンソールログのみ出力（ドライラン）
 *
 * セキュリティ:
 *   - リクエストヘッダーに Authorization: Bearer <CRON_SECRET> が必要
 *   - またはクエリパラメータ ?secret=<CRON_SECRET>
 */
import { NextResponse } from "next/server"
import { createHash, timingSafeEqual } from "node:crypto"
import { createAdminClient } from "@/lib/supabase/admin"

interface ReminderResult {
  companyId: string
  companyName: string
  email: string
  success: boolean
  error?: string
}

/**
 * シークレットを定数時間で比較する。
 * WHY: === での直接比較は早期リターンによりタイミング差が漏れるため、
 * SHA-256 ハッシュ化後に timingSafeEqual で比較する。
 */
function secretsMatch(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest()
  const b = createHash("sha256").update(expected).digest()
  return timingSafeEqual(a, b)
}

/**
 * メール送信（Resend 優先、フォールバックで SendGrid、どちらもなければコンソール出力）。
 */
async function sendReminderEmail(
  to: string,
  companyName: string,
): Promise<{ success: boolean; error?: string }> {
  const resendApiKey = process.env.RESEND_API_KEY
  const sendgridApiKey = process.env.SENDGRID_API_KEY

  // Resend を使用
  if (resendApiKey) {
    try {
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev",
          to: [to],
          subject: `[FastBCP] 連絡網・備蓄品の年次見直しのご案内（${companyName}）`,
          html: `
            <h2>連絡網・備蓄品の年次見直しのご案内</h2>
            <p>${companyName} 様</p>
            <p>最終更新から 11 ヶ月が経過しました。事業継続計画（BCP）の連絡網および備蓄品の年次見直しをご検討ください。</p>
            <ul>
              <li>緊急連絡網の最新化</li>
              <li>備蓄品（水・食料・簡易トイレ等）の期限確認・補充</li>
              <li>データバックアップの状況確認</li>
            </ul>
            <p>マイページから戦略データを編集・再発行いただけます。</p>
            <p><a href="${process.env.NEXT_PUBLIC_APP_URL || "https://example.com"}/dashboard">マイページへ</a></p>
          `,
        }),
      })

      if (resendResponse.ok) {
        return { success: true }
      }
      const errorText = await resendResponse.text()
      return { success: false, error: `Resend: ${errorText}` }
    } catch (err) {
      return {
        success: false,
        error: `Resend: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  }

  // SendGrid を使用
  if (sendgridApiKey) {
    try {
      const sgResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sendgridApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [
            {
              to: [{ email: to }],
              dynamic_template_data: {
                company_name: companyName,
                dashboard_url:
                  process.env.NEXT_PUBLIC_APP_URL || "https://example.com",
              },
            },
          ],
          from: {
            email: process.env.SENDGRID_FROM_EMAIL || "noreply@example.com",
            name: "FastBCP",
          },
          subject: `[FastBCP] 連絡網・備蓄品の年次見直しのご案内（${companyName}）`,
          content: [
            {
              type: "text/html",
              value: `
                <h2>連絡網・備蓄品の年次見直しのご案内</h2>
                <p>${companyName} 様</p>
                <p>最終更新から 11 ヶ月が経過しました。事業継続計画（BCP）の連絡網および備蓄品の年次見直しをご検討ください。</p>
                <ul>
                  <li>緊急連絡網の最新化</li>
                  <li>備蓄品（水・食料・簡易トイレ等）の期限確認・補充</li>
                  <li>データバックアップの状況確認</li>
                </ul>
                <p><a href="${process.env.NEXT_PUBLIC_APP_URL || "https://example.com"}/dashboard">マイページへ</a></p>
              `,
            },
          ],
        }),
      })

      if (sgResponse.ok) {
        return { success: true }
      }
      const errorText = await sgResponse.text()
      return { success: false, error: `SendGrid: ${errorText}` }
    } catch (err) {
      return {
        success: false,
        error: `SendGrid: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  }

  // どちらも設定されていない場合はコンソール出力のみ（ドライラン）
  console.log(
    `[DRY-RUN] リマインドメール送信: to=${to}, company=${companyName}`,
  )
  return { success: true }
}

export async function GET(req: Request) {
  // CRON_SECRET による認証（ヘッダーまたはクエリパラメータ）。
  // WHY: String.replace は null を返さないため旧実装の
  // 「replace(...) ?? searchParams.get(...)」はクエリパラメータに到達しない
  // デッドコードだった。正規表現の exec は不一致時に null を返すため
  // ?? のフォールバックが機能する。
  const authHeader = req.headers.get("authorization") ?? ""
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET が未設定です" },
      { status: 500 },
    )
  }

  const bearerMatch = /^Bearer\s+(.+)$/i.exec(authHeader)
  const providedSecret =
    bearerMatch?.[1] ?? new URL(req.url).searchParams.get("secret") ?? ""

  if (!secretsMatch(providedSecret, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // サービスロールクライアントを使用（サーバーサイド処理のため）
    const admin = createAdminClient()

    // 最終更新から 330 日（11 ヶ月）以上経過した会社を抽出
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 330)
    const cutoffIso = cutoffDate.toISOString()

    const { data: companies, error: companiesError } = await admin
      .from("companies")
      .select("id, name, updated_at, last_reminded_at")
      .is("purchased_at", null)
      .or(
        `updated_at.is.null,updated_at.lte.${cutoffIso}`,
      )
      .order("updated_at", { ascending: true })

    if (companiesError) {
      return NextResponse.json(
        { error: companiesError.message },
        { status: 500 },
      )
    }

    // 送信履歴による重複防止：同一データ（updated_at）に対するリマインドは
    // 1 回のみ。last_reminded_at が updated_at 以降なら既に送信済み。
    // WHY: 送信履歴がない場合、cron の実行頻度に関係なく毎回全員に
    // 再送されていた。
    const pendingCompanies = (companies ?? []).filter((company) => {
      if (!company.last_reminded_at) return true
      const lastSent = new Date(company.last_reminded_at as string).getTime()
      const updatedAt = company.updated_at
        ? new Date(company.updated_at as string).getTime()
        : 0
      return lastSent < updatedAt
    })

    if (pendingCompanies.length === 0) {
      return NextResponse.json({
        success: true,
        message: "リマインド対象の会社はありません",
        sent: 0,
      })
    }

    // 各会社に対してリマインドメールを送信
    const results: ReminderResult[] = []

    for (const company of pendingCompanies) {
      // プロフィールからメールアドレスを取得
      const { data: profiles } = await admin
        .from("profiles")
        .select("email")
        .eq("company_id", company.id)
        .limit(1)

      const email = profiles?.[0]?.email

      if (!email) {
        results.push({
          companyId: company.id,
          companyName: company.name,
          email: "",
          success: false,
          error: "メールアドレスが登録されていません",
        })
        continue
      }

      const result = await sendReminderEmail(email, company.name)
      results.push({
        companyId: company.id,
        companyName: company.name,
        email,
        ...result,
      })

      // 送信に成功した場合のみ履歴を記録する。
      // 失敗時は記録しないことで、次回実行時に再送を試みる。
      if (result.success) {
        await admin
          .from("companies")
          .update({ last_reminded_at: new Date().toISOString() })
          .eq("id", company.id)
      }
    }

    const successCount = results.filter((r) => r.success).length
    const failureCount = results.length - successCount

    return NextResponse.json({
      success: true,
      message: `リマインド処理が完了しました（成功: ${successCount} 件、失敗: ${failureCount} 件）`,
      sent: successCount,
      failed: failureCount,
      results,
    })
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "リマインド処理に失敗しました",
      },
      { status: 500 },
    )
  }
}
