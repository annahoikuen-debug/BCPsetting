import React from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

interface BreadcrumbItem {
  label: string
  href: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav
      className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
      aria-label="パンくずリスト"
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <React.Fragment key={item.label}>
            {isLast ? (
              <span className="text-foreground">{item.label}</span>
            ) : (
              <>
                <Link
                  href={item.href}
                  className="hover:text-foreground transition-colors"
                >
                  {item.label}
                </Link>
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}
