export function Trust() {
  const items = [
    {
      title: "認証付きアクセス",
      description: "Supabase Auth によるログイン・サインアップ。データはユーザー単位で分離されます。",
    },
    {
      title: "Stripe 決済",
      description: "クレジットカード情報は当サーバーに保存されず、Stripe の安全な決済環境を利用します。",
    },
    {
      title: "日本語フォント同梱",
      description: "Noto Sans JP を同梱し、PDF の日本語文字化けを防止します。",
    },
  ]

  return (
    <section className="bg-background border-y">
      <div className="mx-auto w-full max-w-5xl px-6 py-20 sm:py-24">
        <div className="grid gap-8 sm:grid-cols-3 text-center">
          {items.map((item) => (
            <div key={item.title} className="space-y-4">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {item.title}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
