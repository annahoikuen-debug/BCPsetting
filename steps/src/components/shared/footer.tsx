import Link from "next/link"

const footerLinks = [
  { label: "プライバシーポリシー", href: "/docs/privacy" },
  { label: "利用規約", href: "/docs/terms" },
  { label: "マニュアル", href: "/docs/manual" },
  { label: "Q&A", href: "/docs/qa" },
  { label: "特定商取引法", href: "/docs/specified-commercial-transaction" },
  { label: "お問い合わせ", href: "https://github.com/annahoikuen-debug/BCPsetting/issues" },
]

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-12 sm:py-16 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Link
            href="/"
            className="flex items-center gap-2 font-heading text-sm font-semibold tracking-tight"
          >
            <svg
              className="size-5 text-primary"
              aria-hidden="true"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            FastBCP
          </Link>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} FastBCP
          </p>
        </div>
        <nav
          className="flex flex-col gap-4 sm:flex-row sm:gap-6"
          aria-label="フッターナビゲーション"
        >
          {footerLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <nav
          className="flex items-center gap-4 sm:gap-6"
          aria-label="ユーティリティナビゲーション"
        >
          <Link
            href="/docs/manual"
            className="text-xs transition-colors hover:text-foreground"
          >
            ドキュメント
          </Link>
          <Link
            href="https://github.com/annahoikuen-debug/BCPsetting"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs transition-colors hover:text-foreground"
          >
            GitHub
          </Link>
        </nav>
      </div>
    </footer>
  )
}
