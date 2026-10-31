import Link from "next/link"

import { Breadcrumb } from "@/components/landing/breadcrumb"

export const metadata = {
  title: "利用規約 | FastBCP",
  description: "FastBCP の利用規約。サービス利用に関する条件を説明します。",
}

export default function TermsOfServicePage() {
  return (
    <div className="flex flex-col">
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-6">
          <Link href="/" className="flex items-center gap-2 font-heading text-base font-semibold tracking-tight text-primary">
            FastBCP
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">ホーム</Link>
            <Link href="/docs/privacy" className="text-sm text-muted-foreground hover:text-foreground">プライバシーポリシー</Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <nav className="mx-auto w-full max-w-5xl px-6 py-3">
          <Breadcrumb items={[
            { label: "ホーム", href: "/" },
            { label: "利用規約", href: "/docs/terms" },
          ]} />
        </nav>
        <div className="mx-auto w-full max-w-3xl px-6 py-12 sm:py-20">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl mb-6">
            利用規約
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            最終更新日：2026年10月31日
          </p>

          <section className="space-y-8 text-sm text-muted-foreground leading-relaxed">
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">1. 総則</h2>
              <p>
                本規約は、FastBCP（以下「本サービス」といいます）の利用に関する条件を定めるものです。本サービスを利用するには、本規約に同意いただく必要があります。本規約に同意いただけない場合は、本サービスを利用できません。
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">2. 定義</h2>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li>「ユーザー」：本サービスに登録し、利用する個人または法人</li>
                <li>「BCP計画」：ユーザーが本サービスを通じて作成する事業継続計画</li>
                <li>「有料プラン」：ワンタイム購入または月額サブスクリプションのいずれか</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">3. アカウント登録</h2>
              <p>
                ユーザーは、正確な情報をもってアカウントを登録するものとします。登録情報に変更が生じた場合は、速やかに更新してください。アカウントの管理責任はユーザーに帰属します。
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">4. 有料プランと決済</h2>
              <p>
                本サービスの一部機能は有料プランへの加入が必要です。決済は Stripe を通じて行われます。カード番号などの決済情報は当サービスのサーバーで保存せず、Stripe の安全な環境で処理されます。月額プランは毎月自動更新されます。解約を希望する場合は、更新日の前日までにダッシュボードから解約手続きを行ってください。
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">5. 知的財産権</h2>
              <p>
                本サービスおよび本サービスを通じて提供されるコンテンツ（ソフトウェア、画像、テキスト、ロゴ等）の知的財産権は、運営者または正当な権利者に帰属します。ユーザーは、個人利用の範囲で本サービスを利用することができ、それ以外の複製・転載・改造・頒布は禁止します。
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">6. 禁止行為</h2>
              <p>
                以下の行為を禁止します。
              </p>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li>虚偽の情報による登録</li>
                <li>他者になりすました利用</li>
                <li>本サービスのサーバーまたはネットワークに負荷をかける行為</li>
                <li>法令や公序良俗に反する行為</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">7. 免責事項</h2>
              <p>
                本サービスは、災害時の事業継続を支援するツールであり、BCP計画の策定や実行を保証するものではありません。ユーザーは自己責任で計画を策定・実行するものとし、運営者は計画の内容およびその結果について責任を負いません。
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">8. サービスの変更・廃止</h2>
              <p>
                運営者は、ユーザーに通知することなく本サービスの内容を変更、または本サービスの全部または一部を廃止することがあります。これによる損害について、運営者は責任を負いません。
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">9. 規約の変更</h2>
              <p>
                運営者は本規約を変更できるものとします。変更後の規約は、本サービス上に掲載した時点で効力を生じるものとします。
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">10. お問い合わせ</h2>
              <p>
                本規約に関するご質問は、GitHub リポジトリの Issues または本サービス内のお問い合わせフォームまでお寄せください。
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
            <Link href="/docs/privacy" className="hover:text-foreground">プライバシーポリシー</Link>
            <Link href="/docs/specified-commercial-transaction" className="hover:text-foreground">特商法表記</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
