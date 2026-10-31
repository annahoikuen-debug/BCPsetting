import Link from "next/link"
import { ShieldCheck, LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"
import { signout } from "@/app/actions/auth"

const navItems = [
  { label: "機能", href: "/#features" },
  { label: "料金", href: "#" }, // TODO: 料金ページ作成後に差し替え
  { label: "FAQ", href: "#" }, // TODO: FAQページ作成後に差し替え
]

export default async function Header() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-heading text-base font-semibold tracking-tight"
        >
          <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
          FastBCP
        </Link>
        <nav
          className="hidden items-center gap-6 text-sm text-muted-foreground md:flex"
          aria-label="メインナビゲーション"
        >
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Button size="sm" asChild>
                <Link href="/dashboard">マイページ</Link>
              </Button>
              <Button size="sm" variant="outline" onClick={signout}>
                <LogOut className="mr-2 size-4" /> ログアウト
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" asChild>
                <Link href="/login">ログイン</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/signup">新規登録</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
