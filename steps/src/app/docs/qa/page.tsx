import Link from "next/link"

import { Breadcrumb } from "@/components/landing/breadcrumb"

export const metadata = {
  title: "Q&A | FastBCP",
  description: "FastBCP に関するよくある質問と回答をまとめました。導入・セットアップ・機能・トラブルシューティング。",
}

interface FAQItem {
  q: string
  a: React.ReactNode
}

const faqs: FAQItem[] = [
  {
    q: "インストールに必要なものは何ですか？",
    a: (
      <>
        Node.js 20 以上と、npm（または pnpm / bun / yarn）が必要です。また、Supabase プロジェクトと Stripe アカウントをあらかじめ用意してください。詳細は
        <Link href="/docs/manual">マニュアルの「環境構築」</Link> を参照してください。
      </>
    ),
  },
  {
    q: "環境変数はどこに設定すればよいですか？",
    a: (
      <>
        リポジトリルートの `.env.example` をコピーして `.env.local` を作成し、そこに設定値を記入してください。`.env.local` は `.gitignore` でバージョン管理から除外されています。
      </>
    ),
  },
  {
    q: "開発サーバーはどう起動しますか？",
    a: (
      <>
        `npm run dev` を実行し、`http://localhost:3000` にアクセスします。
      </>
    ),
  },
  {
    q: "BCP 計画はどこで作成できますか？",
    a: (
      <>
        `/wizard`（BCP ウィザード）からステップ形式で計画を作成できます。作成した計画は `/dashboard` で一覧・編集できます。
      </>
    ),
  },
  {
    q: "PDF 出力は日本語に対応していますか？",
    a: (
      <>
        はい。`public/fonts/` に同梱された Noto Sans JP (`NotoSansJP-Regular.ttf`、`NotoSansJP-Bold.ttf`) を使用し、日本語の PDF 出力が可能です。
      </>
    ),
  },
  {
    q: "決済機能はどのサービスを使っていますか？",
    a: (
      <>
        Stripe を使用しています。`/checkout` から購入フローを利用できます。
      </>
    ),
  },
  {
    q: "認証はどのように行いますか？",
    a: (
      <>
        Supabase Auth を使用し、メールアドレスとパスワードによるログイン・サインアップを行います。
      </>
    ),
  },
  {
    q: "ビルド時にエラーが出ます。どうすればよいですか？",
    a: (
      <>
        まず `npm run build` のエラーメッセージを確認し、TypeScript の型エラーや依存パッケージの不足がないか確認してください。`npm install` のやり直しや、`node_modules` の削除・再インストールを試すと解決する場合があります。
      </>
    ),
  },
  {
    q: "環境変数が反映されません。",
    a: (
      <>
        `.env.local` を修正した後は、開発サーバーを再起動してください。また、変数名のスペルミスや、`NEXT_PUBLIC_` プレフィックスの付け忘れがないか確認してください。
      </>
    ),
  },
  {
    q: "PDF が文字化けします。",
    a: (
      <>
        `public/fonts/NotoSansJP-Regular.ttf`、`NotoSansJP-Bold.ttf` が正しく配置されているか、およびフォントパスがコードで正しく指定されているか確認してください。
      </>
    ),
  },
  {
    q: "このソフトウェアを自由に使ってよいですか？",
    a: (
      <>
        本プロジェクトは「All Rights Reserved（全権利保持）」の下で配布されています。複製・改造・再配布などは、著作権者の事前の許可なく行わないでください。詳細は LICENSE を参照してください。
      </>
    ),
  },
]

export default function QAPage() {
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
            <Link href="/docs/manual" className="text-sm text-muted-foreground hover:text-foreground">
              マニュアル
            </Link>
            <Link
              href="https://github.com/annahoikuen-debug/BCPsetting"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs border border-border rounded px-2 py-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              GitHub
            </Link>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <nav className="mx-auto w-full max-w-5xl px-6 py-3">
          <Breadcrumb items={[
            { label: "ホーム", href: "/" },
            { label: "Q&A", href: "/docs/qa" },
          ]} />
        </nav>
        <div className="mx-auto w-full max-w-5xl px-6 py-12 sm:py-20">
          <div className="max-w-3xl">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Q&A（fastbcp）
            </h1>
            <p className="mt-2 text-muted-foreground">
              FastBCP に関するよくある質問とその回答をまとめました。
            </p>

            <div className="mt-10 space-y-4">
              {faqs.map(({ q, a }, i) => (
                <section key={q} className="border rounded-xl border-border bg-card p-6">
                  <h3 className="text-sm font-semibold text-foreground">
                    Q{i + 1}. {q}
                  </h3>
                  <div className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-primary">A.</span>{" "}
                    {a}
                  </div>
                </section>
              ))}
            </div>

            <div className="mt-12 pt-8 border-t text-muted-foreground">
              <p className="text-sm">
                さらに詳しい操作方法は <Link href="/docs/manual">マニュアル</Link> を、開発に関する情報は
                <Link href="https://github.com/annahoikuen-debug/BCPsetting/blob/steps/README.md" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  README（開発者向け）
                </Link>
                をご参照ください。解決しないご質問は GitHub の Issues までお寄せください。
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
            <Link href="/docs/manual" className="hover:text-foreground">マニュアル</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
