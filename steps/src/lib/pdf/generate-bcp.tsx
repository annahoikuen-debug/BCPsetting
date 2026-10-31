/**
 * BCP ドキュメントPDF 生成ユーティリティ。
 *
 * @react-pdf/renderer の renderToBuffer を用いて、サーバーサイドで
 * 事業継続計画書 (BCP) の PDF を生成する。
 *
 * 使用例（Server Action / API Route / Route Handler）：
 *   import { generateBcpPdf } from "@/lib/pdf/generate-bcp"
 *   const buffer = await generateBcpPdf(bcpData)
 *   // buffer をクライアントに返すか、ファイルとして保存
 */
import { renderToBuffer } from "@react-pdf/renderer"
import { BcpFullDocument } from "@/components/pdf/BcpFullDocument"
import type { BcpPdfData } from "@/components/pdf/BcpFullDocument"

/**
 * BCP ドキュメントの PDF を生成し、Buffer として返す。
 *
 * @param data PDF に埋め込む BCP 入力データ
 * @returns 生成済み PDF の Buffer（application/pdf）
 * @throws レンダリングに失敗した場合はエラーをスロー
 */
export async function generateBcpPdf(
  data: BcpPdfData,
): Promise<Buffer> {
  const buffer = await renderToBuffer(<BcpFullDocument data={data} />)
  return buffer
}
