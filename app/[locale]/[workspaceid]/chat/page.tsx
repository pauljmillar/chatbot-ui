"use client"

import { ChatHelp } from "@/components/chat/chat-help"
import { useChatHandler } from "@/components/chat/chat-hooks/use-chat-handler"
import { ChatInput } from "@/components/chat/chat-input"
import { ChatSettings } from "@/components/chat/chat-settings"
import { ChatUI } from "@/components/chat/chat-ui"
import { QuickSettings } from "@/components/chat/quick-settings"
import { Brand } from "@/components/ui/brand"
import { ChatbotUIContext } from "@/context/context"
import useHotkey from "@/lib/hooks/use-hotkey"
import { useTheme } from "next-themes"
import { useContext } from "react"

export default function ChatPage() {
  useHotkey("o", () => handleNewChat())
  useHotkey("l", () => {
    handleFocusChatInput()
  })

  const { chatMessages, profile, setUserInput } = useContext(ChatbotUIContext)
  const isUserAdmin = profile?.system_role === "admin" || false

  const { handleNewChat, handleFocusChatInput } = useChatHandler()

  const handleSuggestionClick = (suggestion: string) => {
    setUserInput(suggestion)
    handleFocusChatInput()
  }

  const { theme } = useTheme()

  return (
    <div className="h-screen">
      {chatMessages.length === 0 ? (
        <div className="relative flex h-full flex-col items-center justify-center">
          <div className="absolute left-2 top-2">
            <QuickSettings />
          </div>

          {isUserAdmin && (
            <div className="absolute right-2 top-2">
              <ChatSettings />
            </div>
          )}

          <div className="flex grow flex-col items-center justify-center" />

          <div className="absolute bottom-0 w-full min-w-[300px] items-end px-2 pb-3 pt-0 sm:w-[600px] sm:pb-8 sm:pt-5 md:w-[700px] lg:w-[700px] xl:w-[800px]">
            <div className="mb-4 grid grid-cols-2 gap-3">
              <button
                onClick={() =>
                  handleSuggestionClick(
                    "What are 5 recent themes Trump has recently tweeted about?"
                  )
                }
                className="rounded-xl border p-4 text-left hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                What are 5 themes of Trump has recently tweeted about?
              </button>
              <button
                onClick={() =>
                  handleSuggestionClick(
                    "What are 5 recent themes of Trump's tweets?"
                  )
                }
                className="rounded-xl border p-4 text-left hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                Suggestion 2
              </button>
              <button
                onClick={() => handleSuggestionClick("Suggestion 3")}
                className="rounded-xl border p-4 text-left hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                Suggestion 3
              </button>
              <button
                onClick={() => handleSuggestionClick("Suggestion 4")}
                className="rounded-xl border p-4 text-left hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                Suggestion 4
              </button>
            </div>
            <ChatInput />
          </div>

          <div className="absolute bottom-2 right-2 hidden md:block lg:bottom-4 lg:right-4">
            <ChatHelp />
          </div>
        </div>
      ) : (
        <ChatUI />
      )}
    </div>
  )
}
