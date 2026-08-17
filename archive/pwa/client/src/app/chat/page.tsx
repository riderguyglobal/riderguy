"use client"

import { AgentChat, createAgentChat } from "@21st-sdk/nextjs"
import { useChat } from "@ai-sdk/react"
import theme from "../theme.json"

const chat = createAgentChat({
  agent: "my-agent",
  tokenUrl: "/api/an-token",
})

export default function ChatPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { messages, input, handleInputChange, handleSubmit, status, stop, error } =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useChat({ chat } as any) as any

  return (
    <AgentChat
      messages={messages}
      onSend={() => handleSubmit()}
      status={status}
      onStop={stop}
      error={error ?? undefined}
      theme={theme}
    />
  )
}
