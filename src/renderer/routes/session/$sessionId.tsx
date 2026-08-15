import NiceModal from '@ebay/nice-modal-react'
import { Box, Button, Flex, Text } from '@mantine/core'
import type { ModelProvider } from '@shared/types'
import { IconAlertTriangle } from '@tabler/icons-react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useAtomValue } from 'jotai'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from 'zustand'
import { JK_PAGE_NAMES } from '@/analytics/jk-events'
import MessageList, { type MessageListRef } from '@/components/chat/MessageList'
import PendingApprovalPill from '@/components/chat/PendingApprovalPill'
import { ChatboxWelcomeCard } from '@/components/common/ChatboxWelcomeCard'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import InputBox, { type InputBoxPayload } from '@/components/InputBox/InputBox'
import Header from '@/components/layout/Header'
import Page from '@/components/layout/Page'
import ThreadHistoryDrawer from '@/components/session/ThreadHistoryDrawer'
import { useProviders } from '@/hooks/useProviders'
import { useIsSmallScreen } from '@/hooks/useScreenChange'
import useVersion from '@/hooks/useVersion'
import { defaultSessionsForCN, defaultSessionsForEN } from '@/packages/initial_data'
import * as remote from '@/packages/remote'
import { useAuthInfoStore } from '@/stores/authInfoStore'
import { temporarySessionIdsAtom } from '@/stores/atoms/sessionAtoms'
import { saveTemporarySession, updateSession as updateSessionStore, useSession } from '@/stores/chatStore'
import { applyChatboxLicenseDefaultModelToSession } from '@/stores/defaultChatModel'
import { lastUsedModelStore } from '@/stores/lastUsedModelStore'
import * as scrollActions from '@/stores/scrollActions'
import * as toastActions from '@/stores/toastActions'
import {
  countCancellableGeneratingAssistantMessages,
  getGenerationControlMessages,
} from '@/stores/session/generation-state'
import {
  modifyMessage,
  removeCurrentThread,
  removeMessage,
  startNewThread,
  stopGeneratingMessages,
  submitNewUserMessage,
} from '@/stores/sessionActions'
import { clearSessionActivity } from '@/stores/sessionActivityStore'
import { useSettingsStore } from '@/stores/settingsStore'
import { useUIStore } from '@/stores/uiStore'
import { getHomeWelcomeCardMode } from '@/utils/homeWelcomeCard'

export const Route = createFileRoute('/session/$sessionId')({
  component: RouteComponent,
})

const builtInTemplateSessionIds = new Set(
  [...defaultSessionsForEN, ...defaultSessionsForCN].map((session) => session.id)
)

function RouteComponent() {
  const { t } = useTranslation()
  const { sessionId: currentSessionId } = Route.useParams()
  const navigate = useNavigate()
  const { session: currentSession, isFetching } = useSession(currentSessionId)
  const { providers } = useProviders()
  const temporarySessionIds = useAtomValue(temporarySessionIdsAtom)
  const isTemporarySession = currentSession ? temporarySessionIds.has(currentSession.id) : false
  const [isSavingSession, setIsSavingSession] = useState(false)

  const handleSaveTemporarySession = useCallback(async () => {
    if (!currentSession || isSavingSession) return
    setIsSavingSession(true)
    try {
      await saveTemporarySession(currentSession.id)
      toastActions.add(t('Conversation saved to your chat list') || '')
    } catch (error) {
      console.error('Failed to save temporary session:', error)
      toastActions.add(t('Failed to save conversation') || '')
    } finally {
      setIsSavingSession(false)
    }
  }, [currentSession, isSavingSession, t])
  const licenseKey = useSettingsStore((s) => s.licenseKey)
  const hasLicense = Boolean(licenseKey)
  const licenseDetail = useSettingsStore((s) => s.licenseDetail)
  const licensePlanName = useSettingsStore((s) => s.licensePlanName)
  const hasExpiredLicense = useSettingsStore((s) => s.hasExpiredLicense)
  const isLoggedIn = useAuthInfoStore((s) => Boolean(s.accessToken && s.refreshToken))
  const { isExceeded, isExceededResolved } = useVersion()
  const widthFull = useUIStore((s) => s.widthFull)
  const isSmallScreen = useIsSmallScreen()
  const setLastUsedChatModel = useStore(lastUsedModelStore, (state) => state.setChatModel)
  const setLastUsedPictureModel = useStore(lastUsedModelStore, (state) => state.setPictureModel)

  useEffect(() => {
    clearSessionActivity(currentSessionId)
  }, [currentSessionId])
  const welcomeCardMode = useMemo(
    () =>
      getHomeWelcomeCardMode({
        providerCount: providers.length,
        isLoggedIn,
        hasLicense,
        hasExpiredLicense,
        hideForStoreReview: isExceeded || !isExceededResolved,
      }),
    [providers.length, isLoggedIn, hasLicense, hasExpiredLicense, isExceeded, isExceededResolved]
  )

  const generationControlMessages = useMemo(
    () => (currentSession ? getGenerationControlMessages(currentSession) : []),
    [currentSession]
  )
  const shouldShowTemplateWelcomeCard = useMemo(
    () => Boolean(currentSession && builtInTemplateSessionIds.has(currentSession.id) && welcomeCardMode !== 'none'),
    [currentSession, welcomeCardMode]
  )
  const currentSessionWithDefaultModel = useMemo(() => {
    if (!currentSession || !builtInTemplateSessionIds.has(currentSession.id)) {
      return currentSession
    }
    return applyChatboxLicenseDefaultModelToSession(currentSession, {
      licenseKey,
      hasExpiredLicense,
      licenseDetail,
      licensePlanName,
    })
  }, [currentSession, hasExpiredLicense, licenseDetail, licenseKey, licensePlanName])
  const generatingMessages = useMemo(
    () => generationControlMessages.filter((message) => message.generating),
    [generationControlMessages]
  )
  const cancellableGeneratingReplyCount = useMemo(
    () => countCancellableGeneratingAssistantMessages(generationControlMessages),
    [generationControlMessages]
  )

  const messageListRef = useRef<MessageListRef>(null)

  const goHome = useCallback(() => {
    navigate({ to: '/', replace: true })
  }, [navigate])

  useEffect(() => {
    setTimeout(() => {
      scrollActions.scrollToBottom('auto') // 每次启动时自动滚动到底部
    }, 200)
  }, [])

  // currentSession变化时（包括session settings变化），存下当前的settings作为新Session的默认值
  useEffect(() => {
    if (currentSession) {
      if (currentSession.type === 'chat' && currentSession.settings) {
        const { provider, modelId } = currentSession.settings
        if (provider && modelId) {
          setLastUsedChatModel(provider, modelId)
        }
      }
      if (currentSession.type === 'picture' && currentSession.settings) {
        const { provider, modelId } = currentSession.settings
        if (provider && modelId) {
          setLastUsedPictureModel(provider, modelId)
        }
      }
    }
  }, [currentSession?.settings, currentSession?.type, currentSession, setLastUsedChatModel, setLastUsedPictureModel])

  useEffect(() => {
    if (!currentSession || !currentSessionWithDefaultModel || currentSessionWithDefaultModel === currentSession) {
      return
    }
    void updateSessionStore(currentSession.id, {
      settings: currentSessionWithDefaultModel.settings,
    })
  }, [currentSession, currentSessionWithDefaultModel])

  const onSelectModel = useCallback(
    (provider: ModelProvider, modelId: string) => {
      if (!currentSession) {
        return
      }
      void updateSessionStore(currentSession.id, {
        settings: {
          ...(currentSession.settings || {}),
          provider,
          modelId,
        },
      })
    },
    [currentSession]
  )

  const onStartNewThread = useCallback(() => {
    if (!currentSession) {
      return false
    }
    void startNewThread(currentSession.id)
    if (currentSession.copilotId) {
      void remote
        .recordCopilotUsage({ id: currentSession.copilotId, action: 'create_thread' })
        .catch((error) => console.warn('[recordCopilotUsage] failed', error))
    }
    return true
  }, [currentSession])

  const onRollbackThread = useCallback(() => {
    if (!currentSession) {
      return false
    }
    void removeCurrentThread(currentSession.id)
    return true
  }, [currentSession])

  const onSubmit = useCallback(
    async ({ constructedMessage, needGenerating = true, onUserMessageReady }: InputBoxPayload) => {
      messageListRef.current?.setIsNewMessage(true)

      if (!currentSession) {
        return
      }
      if (currentSessionWithDefaultModel && currentSessionWithDefaultModel !== currentSession) {
        await updateSessionStore(currentSession.id, {
          settings: currentSessionWithDefaultModel.settings,
        })
      }
      messageListRef.current?.scrollToBottom('instant')

      if (currentSession.copilotId) {
        void remote
          .recordCopilotUsage({ id: currentSession.copilotId, action: 'create_message' })
          .catch((error) => console.warn('[recordCopilotUsage] failed', error))
      }

      await submitNewUserMessage(currentSession.id, {
        newUserMsg: constructedMessage,
        needGenerating,
        onUserMessageReady,
      })
    },
    [currentSession, currentSessionWithDefaultModel]
  )

  const onClickSessionSettings = useCallback(() => {
    if (!currentSession) {
      return false
    }
    void NiceModal.show('session-settings', {
      session: currentSession,
    })
    return true
  }, [currentSession])

  const onStopGenerating = useCallback(() => {
    if (!currentSession) {
      return false
    }
    void stopGeneratingMessages(currentSession.id, generatingMessages, {
      removeMessage,
      persistMessage: (sessionId, message) => modifyMessage(sessionId, message, true),
    })
    return true
  }, [currentSession, generatingMessages])

  const model = useMemo(() => {
    if (!currentSessionWithDefaultModel?.settings?.modelId || !currentSessionWithDefaultModel?.settings?.provider) {
      return undefined
    }
    return {
      provider: currentSessionWithDefaultModel.settings.provider,
      modelId: currentSessionWithDefaultModel.settings.modelId,
    }
  }, [currentSessionWithDefaultModel?.settings?.provider, currentSessionWithDefaultModel?.settings?.modelId])

  return currentSession ? (
    <div className={`flex flex-col h-full ${!isSmallScreen ? 'relative' : ''}`}>
      <Header session={currentSession} />

      {isTemporarySession && (
        <Flex
          align="center"
          gap="xs"
          px="md"
          py="xs"
          className="flex-none border-b"
          style={{
            backgroundColor: 'var(--chatbox-background-warning-secondary)',
            borderColor: 'var(--chatbox-border-warning)',
          }}
        >
          <IconAlertTriangle size={16} className="shrink-0" style={{ color: 'var(--chatbox-tint-warning)' }} />
          <Text size="sm" className="flex-1 min-w-0" truncate c="chatbox-secondary">
            {t('This conversation is temporary and not saved. Save it to keep it.')}
          </Text>
          <Button
            size="xs"
            variant="filled"
            color="chatbox-brand"
            loading={isSavingSession}
            onClick={() => void handleSaveTemporarySession()}
          >
            {t('Save conversation')}
          </Button>
        </Flex>
      )}

      {/* MessageList 设置 key，确保每个 session 对应新的 MessageList 实例 */}
      <MessageList
        ref={messageListRef}
        key={`message-list${currentSessionId}`}
        currentSession={currentSession}
        className={!isSmallScreen ? 'pt-[2px]' : undefined}
      />

      <Box className="relative">
        {shouldShowTemplateWelcomeCard && (
          // absolute — taken out of flow, doesn't affect layout of siblings
          // bottom: '100%' — positioned right above the parent box's top edge (like a tooltip anchoring upward)
          <Box className="pointer-events-none absolute left-0 right-0 z-10" style={{ bottom: '100%' }} px="sm" mb="sm">
            <Box className={widthFull ? 'w-full' : 'max-w-4xl mx-auto'}>
              <ChatboxWelcomeCard
                mode={welcomeCardMode}
                pageName={JK_PAGE_NAMES.CHAT_PAGE}
                className="pointer-events-auto w-full"
              />
            </Box>
          </Box>
        )}

        {/* 悬浮审批胶囊：审批卡片滚出视口时出现在输入框上方 */}
        <Box className="pointer-events-none absolute left-0 right-0 z-10" style={{ bottom: '100%' }} px="sm" mb="xs">
          <ErrorBoundary name="session-approval-pill">
            <PendingApprovalPill session={currentSession} />
          </ErrorBoundary>
        </Box>

        {/* <ScrollButtons /> */}
        <ErrorBoundary name="session-inputbox">
          <InputBox
            key={`input-box${currentSession.id}`}
            sessionId={currentSession.id}
            sessionType={currentSession.type}
            model={model}
            onStartNewThread={onStartNewThread}
            onRollbackThread={onRollbackThread}
            onSelectModel={onSelectModel}
            onClickSessionSettings={onClickSessionSettings}
            generating={generatingMessages.length > 0}
            generatingCount={cancellableGeneratingReplyCount}
            onSubmit={onSubmit}
            onStopGenerating={onStopGenerating}
          />
        </ErrorBoundary>
      </Box>
      <ThreadHistoryDrawer session={currentSession} />
    </div>
  ) : (
    !isFetching && (
      <Page title="">
        <div className="flex flex-1 flex-col items-center justify-center min-h-[60vh]">
          <div className="text-2xl font-semibold text-gray-700 mb-4">{t('Conversation not found')}</div>
          <Button variant="outline" onClick={goHome}>
            {t('Back to HomePage')}
          </Button>
        </div>
      </Page>
    )
  )
}
