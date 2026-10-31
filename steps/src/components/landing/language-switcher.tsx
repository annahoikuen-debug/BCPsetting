"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"

const LANGUAGES = [
  { code: "ja", label: "日本語" },
  { code: "en", label: "English" },
] as const

interface LanguageSwitcherProps {
  className?: string
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps = {}) {
  const [lang, setLang] = useState<"ja" | "en">("ja")

  const handleChange = (value: string) => {
    setLang(value as "ja" | "en")
    // TODO: i18n ルーティング導入時に、ここに言語切り替えロジックを実装
  }

  return (
    <div className={`inline-flex items-center gap-1 rounded-lg border border-border bg-muted ${className ?? ""}`}>
      {LANGUAGES.map((l) => (
        <Button
          key={l.code}
          size="xs"
          variant={lang === l.code ? "default" : "outline"}
          className="rounded-none text-xs px-3 py-1.5"
          onClick={() => handleChange(l.code)}
        >
          {l.label}
        </Button>
      ))}
    </div>
  )
}
