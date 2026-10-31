import { Metadata } from "next"

import { Hero } from "@/components/landing/hero"
import { Features } from "@/components/landing/features"
import { HowItWorks } from "@/components/landing/how-it-works"
import { Pricing } from "@/components/landing/pricing"
import { Trust } from "@/components/landing/trust"
import { Proof } from "@/components/landing/proof"
import { FAQ } from "@/components/landing/faq"
import { CTA } from "@/components/landing/cta"
import { SocialShare } from "@/components/landing/social-share"
import { Breadcrumb } from "@/components/landing/breadcrumb"

export const metadata: Metadata = {
  title: "FastBCP | 質問に答えるだけでBCPが作れる",
  description:
    "FastBCPは、ウィザード形式の質問に答えるだけで事業継続計画（BCP）を作成・PDF出力できるサービスです。中小企業向け、日本語対応、最短30分で作成完了。",
  openGraph: {
    title: "FastBCP | 質問に答えるだけでBCPが作れる",
    description:
      "ウィザード形式の質問に答えるだけで事業継続計画（BCP）を作成・PDF出力できるサービスです。",
    type: "website",
  },
}

export default function Home() {
  return (
    <div className="flex flex-col">
      <nav className="mx-auto w-full max-w-5xl px-6 py-3">
        <Breadcrumb items={[{ label: "ホーム", href: "/" }]} />
      </nav>
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
      <Trust />
      <Proof />
      <FAQ />
      <CTA />

      <section className="bg-muted/30 py-12 sm:py-16 border-y">
        <div className="mx-auto w-full max-w-5xl px-6 text-center">
          <h3 className="text-lg font-semibold text-foreground mb-4 sm:text-xl">
            このページをシェアする
          </h3>
          <SocialShare
            title="FastBCP | 質問に答えるだけでBCPが作れる"
            url="https://fastbcp.example.com/"
          />
        </div>
      </section>
    </div>
  )
}
