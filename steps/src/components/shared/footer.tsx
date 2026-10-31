import Link from "next/link"

const footerLinks = [
  { label: "プライバシーポリシー", href: "#" }, // TODO: 作成後に差し替え
  { label: "利用規約", href: "#" }, // TODO: 作成後に差し替え
  { label: "お問い合わせ", href: "#" }, // TODO: 作成後に差し替え
]

export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
        <p>&copy; {new Date().getFullYear()} FastBCP</p>
        <nav
          className="flex items-center gap-6"
          aria-label="フッターナビゲーション"
        >
          {footerLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}
