import { atom, getDefaultStore } from 'jotai'
import { atomWithStorage } from 'jotai/utils'
import type { Session } from '../../../shared/types'

// current sessionId
export const currentSessionIdAtom = atomWithStorage<string | null>('_currentSessionIdCachedAtom', null)

// Related UI state
export const sessionCleanDialogAtom = atom<Session | null>(null) // 清空会话的弹窗
export const showThreadHistoryDrawerAtom = atom<boolean | string>(false) // 显示会话历史主题的抽屉

/**
 * 临时会话 ID 集合（纯内存，不持久化）。
 *
 * 临时会话 = 对话默认不保存，内容只存在于 React Query 缓存中，关闭应用即丢失；
 * 用户点击"保存会话"后调用 saveTemporarySession 持久化，并从该集合移除。
 */
export const temporarySessionIdsAtom = atom<Set<string>>(new Set<string>())

export function isTemporarySession(sessionId: string): boolean {
  return getDefaultStore().get(temporarySessionIdsAtom).has(sessionId)
}

export function markSessionTemporary(sessionId: string) {
  const store = getDefaultStore()
  store.set(temporarySessionIdsAtom, (prev: Set<string>) => {
    if (prev.has(sessionId)) return prev
    const next = new Set(prev)
    next.add(sessionId)
    return next
  })
}

export function unmarkSessionTemporary(sessionId: string) {
  const store = getDefaultStore()
  store.set(temporarySessionIdsAtom, (prev: Set<string>) => {
    if (!prev.has(sessionId)) return prev
    const next = new Set(prev)
    next.delete(sessionId)
    return next
  })
}
