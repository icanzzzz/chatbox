import i18n from '@/i18n'
import { isTemporarySession } from './atoms/sessionAtoms'
import * as chatStore from './chatStore'
import * as toastActions from './toastActions'

// Re-export CRUD operations from session/crud.ts
export {
  _copySession,
  clear,
  clearConversationList,
  copyAndSwitchSession,
  createEmpty,
  reorderSessions,
  switchCurrentSession,
  switchToIndex,
  switchToNext,
} from './session/crud'
// Temporary session helpers (defined in chatStore)
export { createTemporarySession, saveTemporarySession } from './chatStore'
// Re-export export operations from session/export.ts
export { exportSessionChat } from './session/export'
// Re-export fork operations from session/forks.ts
export { createNewFork, deleteFork, expandFork, switchFork, switchForkTo } from './session/forks'
// Re-export generation operations from session module
export {
  generate,
  generateMore,
  generateMoreInNewFork,
  genMessageContext,
  getMessageThreadContext,
  getSessionWebBrowsing,
  regenerateInNewFork,
} from './session/generation'
export { stopGeneratingMessages } from './session/generation-cancellation'
// Re-export message operations from session/messages.ts
export {
  insertMessage,
  insertMessageAfter,
  modifyMessage,
  removeMessage,
  submitNewUserMessage,
} from './session/messages'
// Re-export naming operations from session/naming.ts
export {
  modifyNameAndThreadName,
  modifyThreadName,
  scheduleGenerateNameAndThreadName,
  scheduleGenerateThreadName,
} from './session/naming'
export {
  continuePausedToolCall,
  disableToolCallLimitPauseAndContinue,
  isRetryableToolCallStep,
  retryFromLastToolCallAfterApiError,
  stopPausedToolCall,
} from './session/orchestration'
export { createLoadingPictures } from './session/pictures'
// Re-export thread operations from session/threads.ts
export {
  compressAndCreateThread,
  editThread,
  moveCurrentThreadToConversations,
  moveThreadToConversations,
  refreshContextAndCreateNewThread,
  removeCurrentThread,
  removeThread,
  startNewThread,
  switchThread,
} from './session/threads'

/**
 * Persist the given temporary session and surface a toast result.
 * No-op when the session is not temporary (already persisted / unknown).
 */
export async function saveTemporarySessionWithNotify(sessionId: string): Promise<void> {
  if (!isTemporarySession(sessionId)) {
    return
  }
  try {
    await chatStore.saveTemporarySession(sessionId)
    toastActions.add(i18n.t('Conversation saved to your chat list'))
  } catch (error) {
    console.error('Failed to save temporary session:', error)
    toastActions.add(i18n.t('Failed to save conversation'))
  }
}
