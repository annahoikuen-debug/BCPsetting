import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import Header from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL("https://fastbcp.example.com"),
  title: {
    default: "FastBCP | 質問に答えるだけでBCPが作れる",
    template: "%s | FastBCP",
  },  description:
    "FastBCPは、ウィザード形式の質問に答えるだけで事業継続計画（BCP）を作成・PDF出力できるサービスです。中小企業向け、日本語対応、最短30分で作成完了。",
  keywords: [
    "BCP",
    "事業継続計画",
    "中小企業",
    "防災",
    "PDF出力",
    "ウィザード",
    "FastBCP",
  ],
  authors: [{ name: "FastBCP 運営事務局" }],
  creator: "FastBCP 運営事務局",
  publisher: "FastBCP 運営事務局",
  robots: "index, follow",
  category: "business",
  openGraph: {
    title: {
      default: "FastBCP | 質問に答えるだけでBCPが作れる",
      template: "%s | FastBCP",
    },
    description:
      "FastBCPは、ウィザード形式の質問に答えるだけで事業継続計画（BCP）を作成・PDF出力できるサービスです。中小企業向け、日本語対応、最短30分で作成完了。",
    type: "website",
    locale: "ja_JP",
    siteName: "FastBCP",
  },
  twitter: {
    card: "summary_large_image",
    title: "FastBCP | 質問に答えるだけでBCPが作れる",
    description:
      "FastBCPは、ウィザード形式の質問に答えるだけで事業継続計画（BCP）を作成・PDF出力できるサービスです。",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Header />
        <main className="flex flex-1 flex-col">{children}</main>
        <Footer />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              "name": "FastBCP",
              "url": "https://fastbcp.example.com",
              "sameAs": [
                "https://github.com/annahoikuen-debug/BCPsetting",
              ],
            }),
          }}
        />
      </body>
    </html>
  );
}
