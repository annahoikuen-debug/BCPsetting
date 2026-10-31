import Link from "next/link"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

const faqs = [
  {
    q: "BCP 計画はどこで作成できますか？",
    a: (
      <>
        ログイン後、ウィザード（<code className="font-mono text-xs">/wizard</code>）からステップ形式で計画を作成できます。作成した計画はダッシュボードで一覧・編集可能です。
      </>
    ),
  },
  {
    q: "PDF 出力は日本語に対応していますか？",
    a: (
      <>
        はい。プロジェクトに同梱した Noto Sans JP を使用し、日本語の PDF 出力が可能です。文字化けを防いでいます。
      </>
    ),
  },
  {
    q: "決済機能はどのサービスを使っていますか？",
    a: (
      <>
        Stripe を使用しています。ワンタイム購入（¥9,800 / 1ドキュメント）と月額サブスクリプション（¥1,480 / 月）から選択できます。
      </>
    ),
  },
  {
    q: "返金保証はありますか？",
    a: (
      <>
        はい。有料プランについては、購入から30日以内であれば全額返金を保証します。ダッシュボードまたはお問い合わせフォームからご申請ください。
      </>
    ),
  },
  {
    q: "作成した BCP 計画を他の形式で持ち出せますか？",
    a: (
      <>
        はい。PDF 形式に加え、ZIP 形式での一括ダウンロードに対応しています。データの vendor lock-in を防ぎ、いつでも自社で管理可能です。
      </>
    ),
  },
  {
    q: "サポート体制はどうなっていますか？",
    a: (
      <>
        GitHub Issues および本サービス内のお問い合わせフォームからご連絡いただけます。営業日3営業日以内を目安に返答いたします。
      </>
    ),
  },
  {
    q: "セキュリティはどのように確保されていますか？",
    a: (
      <>
        認証は Supabase Auth を採用し、データはユーザー単位で分離・暗号化して保存します。決済情報（カード番号等）は当サーバーに保存されず、Stripe の安全な環境で処理されます。
      </>
    ),
  },
  {
    q: "解約はできますか？いつまでに手続きすればよいですか？",
    a: (
      <>
        はい。ダッシュボードからいつでも解約できます。月額プランの場合、更新日の前日までに解約手続きを完了すれば、次回更新以降は課金されません。
      </>
    ),
  },
  {
    q: "インストールに必要なものは何ですか？",
    a: (
      <>
        開発・自己ホスティングの場合は Node.js 20 以上と npm（または pnpm / bun / yarn）が必要です。また、Supabase プロジェクトと Stripe アカウントをあらかじめ用意してください。
      </>
    ),
  },
  {
    q: "環境変数はどこに設定すればよいですか？",
    a: (
      <>
        リポジトリルートの <code className="font-mono text-xs">.env.example</code> をコピーして <code className="font-mono text-xs">.env.local</code> を作成し、Supabase / Stripe のキーを設定してください。詳細は
        <Link href="/docs/manual">マニュアルの「環境構築」</Link> を参照してください。
      </>
    ),
  },
]

export function FAQ() {
  return (
    <>
      <section id="faq" className="bg-muted/30">
      <div className="mx-auto w-full max-w-5xl px-6 py-24 sm:py-32">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            よくある質問
          </h2>
          <p className="mt-4 text-muted-foreground">
            導入・運用に関するご質問にお答えします。
          </p>
        </div>

        <div className="grid max-w-md mx-auto gap-3">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map(({ q, a }, i) => (
              <AccordionItem key={q} value={`item-${i}`}>
                <AccordionTrigger className="text-left text-sm font-medium">
                  {q}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  {a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground">
            その他のご質問は、GitHub の Issues または
          </p>
          <Link
            href="https://github.com/annahoikuen-debug/BCPsetting/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary hover:underline"
          >
            お問い合わせ
          </Link>
          <span className="text-sm text-muted-foreground">までお気軽にどうぞ。</span>
        </div>
      </div>
    </section>

    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          "mainEntity": faqs.map(({ q, a }) => ({
            "@type": "Question",
            "name": q,
            "acceptedAnswer": {
              "@type": "Answer",
              "text": String(a),
            },
          })),
        }),
      }}
    />
    </>
  )
}
