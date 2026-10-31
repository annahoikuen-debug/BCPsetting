"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { signout } from "@/app/actions/auth"

interface MobileMenuProps {
  user: { id: string; email?: string } | null
}

const navItems = [
  { label: "機能", href: "/#features" },
  { label: "料金", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
  { label: "マニュアル", href: "/docs/manual" },
  { label: "Q&A", href: "/docs/qa" },
]

export function MobileMenu({ user }: MobileMenuProps) {
  const [loggingOut, setLoggingOut] = useState(false)

  const handleSignout = async () => {
    setLoggingOut(true)
    await signout()
    setLoggingOut(false)
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label="メニューを開く"
        >
          <Menu className="size-5" aria-hidden="true" />
          <span className="sr-only">メニューを開く</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="p-6 sm:p-8">
        <DialogHeader>
          <DialogTitle>メニュー</DialogTitle>
          <DialogDescription>
            ナビゲーションからページを選択してください。
          </DialogDescription>
        </DialogHeader>
        <nav className="space-y-4 mt-6">
          {navItems.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="block px-4 py-3 text-sm font-medium rounded-lg transition-colors hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <DialogFooter>
          <div className="flex flex-col gap-3">
            {user ? (
              <>
                <Button size="sm" asChild className="w-full">
                  <Link href="/dashboard">マイページ</Link>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={handleSignout}
                  disabled={loggingOut}
                >
                  {loggingOut ? "ログアウト中…" : "ログアウト"}
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" asChild className="w-full">
                  <Link href="/login">ログイン</Link>
                </Button>
                <Button size="sm" asChild className="w-full">
                  <Link href="/signup">新規登録</Link>
                </Button>
              </>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
