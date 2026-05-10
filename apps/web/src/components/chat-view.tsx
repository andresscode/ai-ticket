import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useMemo } from 'react'
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message'
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from '@/components/ai-elements/prompt-input'
import type { SessionPayload } from '@/lib/types'
import { cn } from '@/lib/utils'
import type { CustomUIMessage } from '@/types/ui-message'
import { Shimmer } from './ai-elements/shimmer'

const SAMPLE_PROMPTS = [
  "What's on this weekend?",
  'Two seats for the Friday show, near the back.',
  'Show me the cheapest seats available.',
]

export function ChatView({ session }: { session: SessionPayload }) {
  const transport = useMemo(
    () =>
      new DefaultChatTransport<CustomUIMessage>({
        api: '/api/chat',
        credentials: 'include',
        prepareSendMessagesRequest: ({ messages }) => {
          const last = messages[messages.length - 1]
          const text = last?.parts.find((p) => p.type === 'text')?.text ?? ''
          return { body: { message: text } }
        },
      }),
    [],
  )

  const { messages, sendMessage, status, error } = useChat<CustomUIMessage>({
    transport,
  })

  const isStreaming = status === 'streaming' || status === 'submitted'
  const last = messages.at(-1)
  const showThinking =
    isStreaming && (!last || last.role === 'user' || last.parts.length === 0)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Conversation className="flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-8">
          {messages.length === 0 ? (
            <EmptyState
              session={session}
              onPick={(prompt) => sendMessage({ text: prompt })}
            />
          ) : (
            <>
              {messages.map((message) => (
                <Message
                  from={message.role}
                  key={message.id}
                  className="not-first:mt-6"
                >
                  <MessageContent className="gap-2">
                    {message.parts.map((part, idx) => {
                      const key = `${message.id}-${idx}`
                      if (part.type === 'text') {
                        return (
                          <MessageResponse key={key}>
                            {part.text}
                          </MessageResponse>
                        )
                      }
                      if (part.type === 'data-hitl') {
                        return (
                          <HitlPlaceholder
                            key={key}
                            amount={part.data.amount_cents}
                            currency={part.data.currency}
                          />
                        )
                      }
                      return null
                    })}
                  </MessageContent>
                </Message>
              ))}
              {showThinking && (
                <Message
                  from="assistant"
                  key="__thinking__"
                  className="not-first:mt-6"
                >
                  <MessageContent>
                    <ThinkingShimmer />
                  </MessageContent>
                </Message>
              )}
            </>
          )}

          {error && (
            <div className="text-destructive font-italic mt-6 text-sm italic">
              {error.message}
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <ChatComposer
        disabled={isStreaming}
        onSend={(text) => sendMessage({ text })}
      />
    </div>
  )
}

function EmptyState({
  session,
  onPick,
}: {
  session: SessionPayload
  onPick: (prompt: string) => void
}) {
  return (
    <ConversationEmptyState
      className="flex h-full flex-col items-center justify-center gap-6 py-20 text-center"
      title=""
      description=""
    >
      <span className="text-[10px] tracking-[0.36em] uppercase opacity-60">
        {session.tenantName} concierge
      </span>
      <h2
        className="font-(family-name:--font-display) text-4xl leading-tight tracking-tight sm:text-5xl"
        style={{ fontVariationSettings: '"opsz" 144, "wght" 380, "SOFT" 50' }}
      >
        How can I help you tonight?
        <span className="font-italic ml-2 italic opacity-80">
          ask me anything.
        </span>
      </h2>
      <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
        Find a show, pick seats, settle the bill — everything happens here in
        one conversation.
      </p>
      <ul className="mt-2 flex flex-wrap justify-center gap-2">
        {SAMPLE_PROMPTS.map((prompt) => (
          <li key={prompt}>
            <button
              type="button"
              onClick={() => onPick(prompt)}
              className={cn(
                'rounded-full border border-foreground/15 px-4 py-2 text-xs',
                'cursor-pointer transition-colors',
                'hover:border-foreground/40 hover:bg-foreground/5',
              )}
            >
              {prompt}
            </button>
          </li>
        ))}
      </ul>
    </ConversationEmptyState>
  )
}

function ChatComposer({
  disabled,
  onSend,
}: {
  disabled: boolean
  onSend: (text: string) => void
}) {
  return (
    <div className="border-t border-foreground/10 bg-background/80 px-4 py-4 backdrop-blur sm:px-8">
      <div className="mx-auto w-full max-w-3xl">
        <PromptInput
          onSubmit={(message) => {
            const text = message.text.trim()
            if (!text || disabled) return
            onSend(text)
          }}
        >
          <PromptInputBody>
            <PromptInputTextarea
              placeholder="Tell me what you'd like to see…"
              disabled={disabled}
              className="min-h-12"
            />
          </PromptInputBody>
          <PromptInputFooter>
            <span className="text-muted-foreground text-[10px] tracking-[0.28em] uppercase">
              ⏎ to send · ⇧⏎ for newline
            </span>
            <PromptInputSubmit
              disabled={disabled}
              status={disabled ? 'submitted' : 'ready'}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}

function HitlPlaceholder({
  amount,
  currency,
}: {
  amount: number
  currency: string
}) {
  return (
    <div className="font-italic border-foreground/20 rounded-md border-2 border-dashed p-4 text-sm italic opacity-70">
      Payment confirmation pending — {(amount / 100).toFixed(2)}{' '}
      {currency.toUpperCase()}. (Wired up in Phase 5.)
    </div>
  )
}

function ThinkingShimmer({ label = 'Thinking' }: { label?: string }) {
  return (
    <Shimmer as="span" className="font-italic text-sm italic">
      {`${label}…`}
    </Shimmer>
  )
}
