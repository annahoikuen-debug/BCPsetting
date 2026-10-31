import Link from "next/link"

import { Breadcrumb } from "@/components/landing/breadcrumb"

export const metadata = {
  title: "マニュアル | FastBCP",
  description: "FastBCP の導入方法・使い方・デプロイ方法を解説するユーザー向けマニュアルです。",
}

export default function ManualPage() {
  return (
    <div className="flex flex-col">
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-20">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-6">
          <Link href="/" className="flex items-center gap-2 font-heading text-base font-semibold tracking-tight text-primary">
            FastBCP
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
              ホーム
            </Link>
            <Link href="/docs/qa" className="text-sm text-muted-foreground hover:text-foreground">
              Q&A
            </Link>
            <Link
              href="https://github.com/annahoikuen-debug/BCPsetting"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs border border-border rounded px-2 py-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              README（開発者向け）
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <nav className="mx-auto w-full max-w-5xl px-6 py-3">
          <Breadcrumb items={[
            { label: "ホーム", href: "/" },
            { label: "マニュアル", href: "/docs/manual" },
          ]} />
        </nav>
        <div className="mx-auto w-full max-w-5xl px-6 py-12 sm:py-20">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              マニュアル（fastbcp）
            </h1>
            <p className="mt-2 text-muted-foreground">
              FastBCP の利用方法・開発方法・デプロイ方法について解説します。
            </p>

            <div className="mt-10 border rounded-xl border-border bg-card p-8">
              <h2 className="text-xl font-bold mb-6">1. はじめに</h2>
              <p>
                FastBCP は、BCP（事業継続計画）策定・運用を支援する Web アプリケーションです。Next.js 16 をベースに、Supabase をバックエンド、Stripe を決済基盤として利用します。
              </p>
              <h3 className="text-sm font-semibold text-muted-foreground mt-6 mb-2">想定ユーザー</h3>
              <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
                <li>BCP 担当者（計画の作成・閲覧）</li>
                <li>システム管理者（環境構築・運用）</li>
                <li>開発者（コードの改修・拡張）</li>
              </ul>
            </div>

            <div className="mt-10 border rounded-xl border-border bg-card p-8">
              <h2 className="text-xl font-bold mb-6">2. 環境構築</h2>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">2.1 必要なソフトウェア</h3>
              <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
                <li>Node.js 20 以上</li>
                <li>npm（または pnpm / bun / yarn）</li>
                <li>Git</li>
                <li>Supabase プロジェクト（アカウント作成済みであること）</li>
                <li>Stripe アカウント（テストモード / ライブモード）</li>
              </ul>

              <h3 className="text-sm font-semibold text-muted-foreground mt-6 mb-2">2.2 インストール</h3>
              <pre className="mb-4 p-4 rounded-lg border bg-muted text-sm font-mono overflow-x-auto">
                <code>
                  git clone https://github.com/annahoikuen-debug/BCPsetting.git
                  cd BCPsetting/steps
                  npm install
                </code>
              </pre>

              <h3 className="text-sm font-semibold text-muted-foreground mb-2">2.3 環境変数の設定</h3>
              <p className="text-sm text-muted-foreground mb-2">
                `.env.example` をコピーして `.env.local` を作成し、Supabase と Stripe のキーを設定します。
              </p>
              <pre className="mb-4 p-4 rounded-lg border bg-muted text-sm font-mono overflow-x-auto">
                <code>
                  cp .env.example .env.local
                </code>
              </pre>
              <div className="text-xs text-muted-foreground mb-4">
                `.env.local` は `.gitignore` でバージョン管理から除外されています。API キーなどの秘密情報をコミットしないようご注意ください。
              </div>

              <h3 className="text-sm font-semibold text-muted-foreground mb-2">2.4 開発サーバーの起動</h3>
              <pre className="mb-4 p-4 rounded-lg border bg-muted text-sm font-mono overflow-x-auto">
                <code>
                  npm run dev
                </code>
              </pre>
              <p className="text-sm text-muted-foreground">
                ブラウザで `http://localhost:3000` にアクセスするとアプリが表示されます。
              </p>
            </div>

            <div className="mt-10 border rounded-xl border-border bg-card p-8">
              <h2 className="text-xl font-bold mb-6">3. 主な機能の使い方</h2>
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">3.1 認証（ログイン / サインアップ）</h3>
                  <ul className="list-disc pl-6 space-y-1 text-sm text-muted-foreground">
                    <li>`/login`：既存ユーザーのログイン</li>
                    <li>`/signup`：新規ユーザーの登録</li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-1">
                    Supabase Auth を利用しています。メールアドレスとパスワードで認証を行います。
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">3.2 ダッシュボード</h3>
                  <p className="text-sm text-muted-foreground">
                    `/dashboard`：ログイン後のメイン画面。BCP 計画の一覧・作成・編集を行います。
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">3.3 BCP ウィザード</h3>
                  <p className="text-sm text-muted-foreground">
                    `/wizard`：ステップ形式のフォームで BCP 計画を作成します。入力内容は React Hook Form + Zod でバリデーションされます。
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">3.4 決済（Stripe）</h3>
                  <p className="text-sm text-muted-foreground">
                    `/checkout`：Stripe Checkout を利用した有料プランの購入フローです。
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">3.5 PDF 出力</h3>
                  <p className="text-sm text-muted-foreground">
                    `@react-pdf/renderer` を用いて、入力内容を PDF として出力できます。日本語フォント `Noto Sans JP` が `public/fonts/` に同梱されており、日本語の文字化けを防いでいます。
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-10 border rounded-xl border-border bg-card p-8">
              <h2 className="text-xl font-bold mb-6">4. ビルドとデプロイ</h2>
              <pre className="mb-4 p-4 rounded-lg border bg-muted text-sm font-mono overflow-x-auto">
                <code>
                  npm run build
                </code>
              </pre>
              <p className="text-sm text-muted-foreground mb-4">
                Next.js 公式のデプロイプラットフォームである Vercel へのデプロイが推奨されます。環境変数は Vercel プロジェクト設定の「Environment Variables」から追加してください。
              </p>
            </div>

            <div className="mt-10 pt-8 border-t text-muted-foreground">
              <p className="text-sm">
                詳しくはリポジトリの <Link href="/docs/qa">Q&A</Link> も併せてご参照ください。開発に関する詳細は
                <Link href="https://github.com/annahoikuen-debug/BCPsetting/blob/steps/README.md" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  README（開発者向け）
                </Link>
                をご覧ください。
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t mt-auto">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <p>&copy; {new Date().getFullYear()} FastBCP</p>
          <nav className="flex items-center gap-6">
            <Link href="/" className="hover:text-foreground">ホーム</Link>
            <Link href="/docs/qa" className="hover:text-foreground">Q&A</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
