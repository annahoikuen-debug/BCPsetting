import Link from "next/link"

import { Breadcrumb } from "@/components/landing/breadcrumb"

export const metadata = {
  title: "特定商取引法に基づく表記 | FastBCP",
  description: "FastBCP の特定商取引法に基づく表記。販売事業者情報などを掲載しています。",
}

export default function SpecifiedCommercialTransactionPage() {
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
            { label: "特定商取引法", href: "/docs/specified-commercial-transaction" },
          ]} />
        </nav>
        <div className="mx-auto w-full max-w-3xl px-6 py-12 sm:py-20">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl mb-6">
            特定商取引法に基づく表記
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            最終更新日：2026年10月31日
          </p>

          <table className="w-full border-collapse border border-border text-sm text-muted-foreground leading-relaxed">
            <tbody className="divide-y divide-border">
              <tr>
                <td className="w-1/4 p-4 text-foreground font-semibold bg-muted/50">
                  販売事業者
                </td>
                <td className="w-3/4 p-4">FastBCP 運営事務局</td>
              </tr>
              <tr>
                <td className="w-1/4 p-4 text-foreground font-semibold bg-muted/50">
                  運営責任者
                </td>
                <td className="w-3/4 p-4">FastBCP 運営責任者</td>
              </tr>
              <tr>
                <td className="w-1/4 p-4 text-foreground font-semibold bg-muted/50">
                  所在地
                </td>
                <td className="w-3/4 p-4">東京都（事業所詳細はお問い合わせ時に開示）</td>
              </tr>
              <tr>
                <td className="w-1/4 p-4 text-foreground font-semibold bg-muted/50">
                  お問い合わせ
                </td>
                <td className="w-3/4 p-4">
                  GitHub リポジトリの Issues または本サービス内のお問い合わせフォーム
                </td>
              </tr>
              <tr>
                <td className="w-1/4 p-4 text-foreground font-semibold bg-muted/50">
                  販売価格
                </td>
                <td className="w-3/4 p-4">
                  各プランページに表示の通り（税込）。ワンタイム購入：¥9,800 / 1ドキュメント、月額サブスクリプション：¥1,480 / 月
                </td>
              </tr>
              <tr>
                <td className="w-1/4 p-4 text-foreground font-semibold bg-muted/50">
                  代金の支払時期・方法
                </td>
                <td className="w-3/4 p-4">
                  Stripe によるクレジットカード決済。購入時に即時決済。月額プランは毎月自動更新。
                </td>
              </tr>
              <tr>
                <td className="w-1/4 p-4 text-foreground font-semibold bg-muted/50">
                  商品の引渡時期
                </td>
                <td className="w-3/4 p-4">
                  決済完了後、直ちにダッシュボードより BCP 計画書（PDF）のダウンロードが可能になります。
                </td>
              </tr>
              <tr>
                <td className="w-1/4 p-4 text-foreground font-semibold bg-muted/50">
                  返金・キャンセル
                </td>
                <td className="w-3/4 p-4">
                  デジタルコンテンツの特性上、発行済みドキュメントの返金は原則としてお受けできません。月額プランは解約手続きにより次回更新より停止できます。解約の有効日は、更新日の前日までに手続きを完了した場合は当該更新日、それ以降の場合は次回更新日となります。
                </td>
              </tr>
              <tr>
                <td className="w-1/4 p-4 text-foreground font-semibold bg-muted/50">
                  動作環境
                </td>
                <td className="w-3/4 p-4">
                  モダンブラウザ（Chrome, Edge, Safari, Firefox の最新版）およびインターネット接続環境
                </td>
              </tr>
            </tbody>
          </table>

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
            <Link href="/docs/terms" className="hover:text-foreground">利用規約</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
