/**
 * インメモリレート制限ユーティリティ。
 *
 * API Route 等でエンドポイントごと・識別子（ユーザーIDやIP）ごとに
 * リクエスト数を制限し、ブルートフォースや DoS を軽減する。
 *
 * 単一インスタンス前提の実装。分散環境（複数サーバー/サーバーレス
 * 関数の並列実行）では Redis 等の外部ストアへの移行を検討すること。
 */
interface RateLimitWindow {
  identifiers: string[]
  timestamps: number[]
}

const windows = new Map<string, RateLimitWindow>()

/**
 * レート制限をチェックする。
 *
 * @param identifier ユーザーID、IPアドレス、APIキーなど一意の識別子
 * @param maxRequests 期間あたりの最大リクエスト数
 * @param windowMs 期間（ミリ秒）
 * @returns { allowed, remaining, retryAfter }
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; remaining: number; retryAfter?: number } {
  const now = Date.now()
  const windowStart = now - windowMs

  let window = windows.get(identifier)
  if (!window) {
    window = { identifiers: [], timestamps: [] }
    windows.set(identifier, window)
  }

  // 期間外のタイムスタンプを除外
  const validIndex = window.timestamps.findIndex((t) => t > windowStart)
  if (validIndex > 0) {
    // 0 から validIndex-1 までが期間外なので、それらをスプライスで削除
    window.identifiers.splice(0, validIndex)
    window.timestamps.splice(0, validIndex)
  } else if (validIndex === -1) {
    // すべて期間外ならクリア
    window.identifiers = []
    window.timestamps = []
  }
  // validIndex === 0 は最初の要素がウィンドウ内にあるため、何もしない

  const remaining = Math.max(0, maxRequests - window.timestamps.length)

  if (window.timestamps.length >= maxRequests) {
    const oldest = Math.min(...window.timestamps)
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((oldest + windowMs - now) / 1000),
    }
  }

  window.timestamps.push(now)
  return { allowed: true, remaining: remaining - 1 }
}

/**
 * ウィンドウをクリア（テスト用）。
 */
export function clearRateLimit(identifier: string): void {
  windows.delete(identifier)
}
