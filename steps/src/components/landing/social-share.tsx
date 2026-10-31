"use client"

import { Share2, Link, MessageCircle, Copy } from "lucide-react"

import { Button } from "@/components/ui/button"

interface SocialShareProps {
  title: string
  url?: string
}

export function SocialShare({ title, url = typeof window !== "undefined" ? window.location.href : "" }: SocialShareProps) {
  const twitterUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`
  const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(`${title} ${url}`)}`
  const hatenaUrl = `https://b.hatena.ne.jp/entry/${encodeURIComponent(url)}`

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(url)
  }

  return (
    <div className="flex flex-wrap gap-2 justify-center">
      <Button
        size="sm"
        variant="outline"
        asChild
        onClick={() => window.open(twitterUrl, "_blank", "width=600,height=400")}
      >
        <Share2 className="mr-2 size-4" aria-hidden="true" />
        Xでシェア
      </Button>
      <Button
        size="sm"
        variant="outline"
        asChild
        onClick={() => window.open(facebookUrl, "_blank", "width=600,height=400")}
      >
        <Link className="mr-2 size-4" aria-hidden="true" />
        Facebookでシェア
      </Button>
      <Button
        size="sm"
        variant="outline"
        asChild
        onClick={() => window.open(lineUrl, "_blank", "width=600,height=400")}
      >
        <MessageCircle className="mr-2 size-4" aria-hidden="true" />
        LINEで送る
      </Button>
      <Button
        size="sm"
        variant="outline"
        asChild
        onClick={() => window.open(hatenaUrl, "_blank", "width=600,height=400")}
      >
        <span className="text-xs">B!</span>
        はてなブックマーク
      </Button>
      <Button
        size="sm"
        onClick={copyToClipboard}
      >
        <Copy className="mr-2 size-4" aria-hidden="true" />
        リンクをコピー
      </Button>
    </div>
  )
}
