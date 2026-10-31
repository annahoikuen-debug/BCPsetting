import type { NextConfig } from "next";

/**
 * セキュリティヘッダー（全ルート共通）。
 * WHY: 以前はプロキシ（src/proxy.ts）の matcher 経由で付与していたため、
 * ランディングページや API ルートには適用されていなかった。next.config の
 * headers() で全レスポンスに適用する。
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

/**
 * Content Security Policy。
 *
 * デフォルトは Report-Only（違反をブロックせずコンソールに記録）。
 * CSP_ENFORCE=true を設定すると強制モードになる。段階的に違反を洗い出し、
 * 問題がないことを確認してから強制モードへ移行すること。
 *
 * - script-src: Next.js のハイドレーション用インラインスクリプトのため
 *   'unsafe-inline' が必要。開発時は React Refresh のため 'unsafe-eval' も必要。
 * - connect-src: Supabase（データ・認証・ストレージ）。
 * - style-src: Tailwind / shadcn/ui のインラインスタイルのため 'unsafe-inline'。
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseOrigin = (() => {
  try {
    return supabaseUrl ? new URL(supabaseUrl).origin : "https://*.supabase.co";
  } catch {
    return "https://*.supabase.co";
  }
})();

const cspDirectives = [
  "default-src 'self'",
  // 開発時のみ 'unsafe-eval'（React Refresh / turbopack HMR に必要）
  process.env.NODE_ENV === "production"
    ? "script-src 'self' 'unsafe-inline'"
    : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          ...securityHeaders,
          process.env.CSP_ENFORCE === "true"
            ? { key: "Content-Security-Policy", value: cspDirectives }
            : {
                key: "Content-Security-Policy-Report-Only",
                value: cspDirectives,
              },
        ],
      },
    ];
  },
};

export default nextConfig;
