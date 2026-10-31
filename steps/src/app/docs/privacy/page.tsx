import Link from "next/link"

import { Breadcrumb } from "@/components/landing/breadcrumb"

export const metadata = {
  title: "プライバシーポリシー | FastBCP",
  description: "FastBCP のプライバシーポリシー。個人情報の取り扱いについて説明します。",
}

export default function PrivacyPolicyPage() {
  return (
    <div className="flex flex-col">
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-6">
          <Link href="/" className="flex items-center gap-2 font-heading text-base font-semibold tracking-tight text-primary">
            FastBCP
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">ホーム</Link>
            <Link href="/docs/terms" className="text-sm text-muted-foreground hover:text-foreground">利用規約</Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <nav className="mx-auto w-full max-w-5xl px-6 py-3">
          <Breadcrumb items={[
            { label: "ホーム", href: "/" },
            { label: "プライバシーポリシー", href: "/docs/privacy" },
          ]} />
        </nav>
        <div className="mx-auto w-full max-w-3xl px-6 py-12 sm:py-20">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl mb-6">
            プライバシーポリシー
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            最終更新日：2026年10月31日
          </p>

          <section className="space-y-8 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">1. はじめに</h2>
              <p>
                FastBCP（以下「本サービス」といいます）は、ユーザーの皆様（以下「ユーザー」といいます）のプライバシーを尊重し、個人情報を適切に保護することが重要な責務と考えています。本ポリシーは、本サービスにおける個人情報の取り扱いについて説明するものです。
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">2. 取得する情報</h2>
              <p>
                本サービスでは、以下の情報を取得する場合があります。
              </p>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li>メールアドレス、パスワードなどのアカウント情報</li>
                <li>会社名、所在地、業種、従業員数などの事業情報</li>
                <li>BCP計画の入力内容（基本方針、想定リスク、中核事業、初動体制、事前対策・財務等）</li>
                <li>IPアドレス、ブラウザ種類、アクセスログなどの利用情報</li>
                <li>Stripe による決済に関連する顧客ID・決済情報（カード番号自体は当サービスで保存しません）</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">3. 利用目的</h2>
              <p>
                取得した情報は、以下の目的で利用します。
              </p>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li>本サービスの提供・運営</li>
                <li>ユーザー認証およびアカウント管理</li>
                <li>BCP計画の保存・編集・PDF発行</li>
                <li>決済処理および利用料金の請求</li>
                <li>お知らせ・サポート連絡の送付</li>
                <li>サービス改善および新機能開発のための分析</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">4. 第三者への開示・共有</h2>
              <p>
                原則として、ユーザーの同意なく個人情報を第三者に開示・提供しません。ただし、以下の場合は例外とします。
              </p>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li>ユーザーの同意がある場合</li>
                <li>法令に基づく開示要求がある場合</li>
                <li>Stripe など決済代行サービスへの決済に必要な情報の提供</li>
                <li>Supabase などクラウドサービスへのシステム運用に必要な情報の提供</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">5. データの保存とセキュリティ</h2>
              <p>
                個人情報は、不正アクセス・紛失・破壊・改ざん・漏洩などを防止するため、合理的な安全対策を講じています。データは Supabase 上の暗号化されたデータベースに保存され、アクセス制御が適用されています。
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">6. ユーザーの権利</h2>
              <p>
                ユーザーは、自己の個人情報について、開示・訂正・削除・利用停止を請求することができます。ご希望の場合は、下記のお問い合わせ窓口までご連絡ください。
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">7. お問い合わせ</h2>
              <p>
                本ポリシーに関するご質問・ご意見は、GitHub リポジトリの Issues または本サービス内のお問い合わせフォームまでお寄せください。
              </p>
            </section>
          </section>

          <nav className="mt-12 pt-8 border-t text-muted-foreground">
            <Link href="/" className="hover:text-foreground">ホームへ戻る</Link>
          </nav>
        </div>
      </main>

      <footer className="border-t mt-auto">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <p>&copy; {new Date().getFullYear()} FastBCP</p>
          <nav className="flex items-center gap-6">
            <Link href="/" className="hover:text-foreground">ホーム</Link>
            <Link href="/docs/terms" className="hover:text-foreground">利用規約</Link>
            <Link href="/docs/specified-commercial-transaction" className="hover:text-foreground">特商法表記</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
