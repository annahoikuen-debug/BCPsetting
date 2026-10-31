/**
 * フォームの入力内容を localStorage に自動一時保存するフック。
 *
 * ページリロードや誤って閉じた際に、入力途中のデータを失わないために使用する。
 * 保存キーは step ごとに分けることで、ステップごとの下書きを独立して管理する。
 *
 * hasStored は「localStorage にこのステップの下書きが存在するか」を示す。
 * DB からドラフトを復元する際、ローカル編集を優先するかの判断に使う。
 */
import { useCallback, useState } from "react"

interface DraftState<T> {
  value: T
  hasStored: boolean
}

export function useLocalStorageDraft<T>(key: string, initialValue: T) {
  const [state, setState] = useState<DraftState<T>>(() => {
    if (typeof window === "undefined") {
      return { value: initialValue, hasStored: false }
    }
    try {
      const stored = localStorage.getItem(key)
      if (stored) {
        return { value: JSON.parse(stored) as T, hasStored: true }
      }
    } catch {
      // localStorage からの復元に失敗した場合は初期値を使用
    }
    return { value: initialValue, hasStored: false }
  })

  const setDraft = useCallback(
    (next: T) => {
      setState({ value: next, hasStored: true })
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // localStorage 利用不可（プライベートモード等）は無視
      }
    },
    [key],
  )

  const clearDraft = useCallback(() => {
    setState({ value: initialValue, hasStored: false })
    try {
      localStorage.removeItem(key)
    } catch {
      // ignore
    }
  }, [key, initialValue])

  return { value: state.value, hasStored: state.hasStored, setDraft, clearDraft } as const
}
