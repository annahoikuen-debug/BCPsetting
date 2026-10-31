import Link from "next/link"
import { AlertCircle, Home } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata = {
  title: "ページが見つかりません | FastBCP",
  description: "お探しのページは見つかりませんでした。",
}

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-3xl font-bold">404</CardTitle>
          <CardDescription>
            ページが見つかりませんでした。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-6">
            お探しのページは削除されたか、URLが変更された可能性があります。
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" asChild className="w-full sm:w-auto">
              <Link href="/">
                <Home className="mr-2 size-4" aria-hidden="true" />
                ホームに戻る
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
              <Link href="/docs/manual">
                <AlertCircle className="mr-2 size-4" aria-hidden="true" />
                マニュアルを見る
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
