/**
 * 日本語フォントの登録ユーティリティ。
 *
 * @react-pdf/renderer の Font.register を用いて、PDF 生成時に日本語が
 * 文字化けしないよう Noto Sans JP を登録する。
 *
 * 以下の TTF ファイルを public/fonts/ にコミットしている：
 *   - NotoSansJP-Regular.ttf
 *   - NotoSansJP-Bold.ttf
 *
 * （Noto Sans JP は SIL Open Font License 1.1 のため再配布可能）
 *
 * フォント登録に失敗した場合はフォールバック（Helvetica）を使用するが、
 * 日本語は豆腐文字（□）になる。
 *
 * サーバーサイド（Node.js）でのみ実行される。ブラウザ側では何もしない。
 */
import { Font } from "@react-pdf/renderer"
import fs from "fs"
import path from "path"

const FONT_DIR = path.join(process.cwd(), "public", "fonts")

let bcpFontFamily = "Helvetica"
let registrationAttempted = false

export function registerBcpFonts(): void {
  if (typeof window !== "undefined" || registrationAttempted) {
    return
  }
  // プロセス内で 1 度だけ試行する（複数ドキュメントからの再呼び出しで
  // 同一フォントを重複登録しないため）
  registrationAttempted = true

  const regularPath = path.join(FONT_DIR, "NotoSansJP-Regular.ttf")
  const boldPath = path.join(FONT_DIR, "NotoSansJP-Bold.ttf")

  if (!fs.existsSync(regularPath) || !fs.existsSync(boldPath)) {
    // フォントファイルが未配置の場合はフォールバック（日本語は豆腐文字になる）
    console.warn(
      "[FastBCP] フォントファイルが public/fonts/ に見つかりません。日本語は豆腐文字になります。NotoSansJP-Regular.ttf / NotoSansJP-Bold.ttf を配置してください。",
    )
    return
  }

  try {
    Font.register({
      family: "Noto Sans JP",
      fonts: [
        { src: regularPath, fontWeight: 400, fontStyle: "normal" },
        { src: boldPath, fontWeight: 700, fontStyle: "normal" },
      ],
    })
    bcpFontFamily = "Noto Sans JP"
  } catch {
    // フォント登録に失敗した場合はフォールバック（Helvetica のまま）
  }
}

/**
 * 登録済みの日本語フォントファミリ名を返す。
 *
 * WHY: このモジュールは import 時に registerBcpFonts() を実行するため、
 * PDF ドキュメントの StyleSheet 構築時には登録結果が確定している。
 * 値を export すると登録前のスナップショット（"Helvetica"）が
 * 固定されてしまうため、必ず関数経由で参照すること。
 */
export function getBcpFontFamily(): string {
  return bcpFontFamily
}

// モジュール読み込み時にフォントを登録する（サーバーサイドのみ）
registerBcpFonts()
