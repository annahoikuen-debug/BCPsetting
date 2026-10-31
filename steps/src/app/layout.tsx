import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import Header from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "FastBCP | 質問に答えるだけでBCPが作れる",
    template: "%s | FastBCP",
  },
  description:
    "FastBCPは、ウィザード形式の質問に答えるだけで事業継続計画（BCP）を作成・PDF出力できるサービスです。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${notoSansJP.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Header />
        <main className="flex flex-1 flex-col">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
