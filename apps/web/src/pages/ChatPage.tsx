import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Send, Trash2, Bot, User, Wrench, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import clsx from "clsx";
import { useChatStore } from "../store/chat.store";
import { api } from "../lib/api";
import { ChatMessage } from "../types";

export default function ChatPage() {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const {
    messages,
    isStreaming,
    addUserMessage,
    addAssistantMessage,
    appendDelta,
    appendToolCall,
    setStreaming,
    clearMessages,
  } = useChatStore();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");

    addUserMessage(text);
    const assistantMsg = addAssistantMessage();
    setStreaming(true);

    const history = messages
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));

    abortRef.current = api.chat.stream(
      { message: text, history },
      {
        onDelta: (t) => appendDelta(assistantMsg.id, t),
        onToolCall: (e) => appendToolCall(assistantMsg.id, e),
        onToolResult: (e) => appendToolCall(assistantMsg.id, e),
        onDone: () => setStreaming(false),
        onError: (msg) => {
          appendDelta(assistantMsg.id, `\n\n⚠️ Error: ${msg}`);
          setStreaming(false);
        },
      },
    );
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div>
          <h1 className="font-semibold text-gray-100">AI Chat</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Ask anything — Claude will search the knowledge base automatically
          </p>
        </div>
        <button
          onClick={clearMessages}
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
          title="Clear chat"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        {messages.length === 0 && (
          <EmptyState
            onSuggestion={(s) => {
              setInput(s);
            }}
          />
        )}

        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isStreaming={isStreaming}
            messages={messages}
          />
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-gray-800">
        <div className="flex gap-3 items-end glass rounded-xl p-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question about the knowledge base…"
            rows={1}
            className="flex-1 bg-transparent resize-none text-sm text-gray-100 placeholder-gray-500 outline-none max-h-32"
            style={{ fieldSizing: "content" } as any}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            className={clsx(
              "p-2 rounded-lg transition-colors flex-shrink-0",
              input.trim() && !isStreaming
                ? "bg-brand-600 hover:bg-brand-500 text-white"
                : "bg-gray-800 text-gray-600 cursor-not-allowed",
            )}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-600 mt-2 text-center">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  isStreaming,
  messages,
}: {
  message: ChatMessage;
  isStreaming: boolean;
  messages: ChatMessage[];
}) {
  const isUser = message.role === "user";
  return (
    <div
      className={clsx("flex gap-3 items-start", isUser && "flex-row-reverse")}
    >
      {isUser ? <UserAvatar /> : <BotAvatar />}
      <div
        className={clsx(
          "max-w-[75%] space-y-2",
          isUser && "items-end flex flex-col",
        )}
      >
        {/* Tool calls badge */}
        {(message.toolCalls ?? []).length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.toolCalls!.map((tc, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-400 border border-amber-800/40"
              >
                <Wrench className="w-3 h-3" />
                {tc.tool}
                {tc.chunks !== undefined && ` · ${tc.chunks} chunks`}
              </span>
            ))}
          </div>
        )}

        {/* Content */}
        <div
          className={clsx(
            "rounded-2xl px-4 py-3 text-sm leading-relaxed",
            isUser
              ? "bg-brand-600 text-white rounded-tr-sm"
              : "glass text-gray-100 rounded-tl-sm",
          )}
        >
          {!isUser &&
            isStreaming &&
            messages[messages.length - 1]?.content === "" && (
              <div className="flex gap-3 items-start">
                <div className="flex gap-1 pt-3">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            )}
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <ReactMarkdown
              components={{
                code: ({ children }) => (
                  <code className="bg-gray-800 rounded px-1 py-0.5 text-xs font-mono text-brand-300">
                    {children}
                  </code>
                ),
                pre: ({ children }) => (
                  <pre className="bg-gray-900 rounded-lg p-3 overflow-x-auto text-xs mt-2">
                    {children}
                  </pre>
                ),
              }}
            >
              {message.content || " "}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  );
}

function BotAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-brand-600/20 border border-brand-600/30 flex items-center justify-center flex-shrink-0">
      <Bot className="w-4 h-4 text-brand-400" />
    </div>
  );
}

function UserAvatar() {
  return (
    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0">
      <User className="w-4 h-4 text-gray-300" />
    </div>
  );
}

function EmptyState({ onSuggestion }: { onSuggestion: (s: string) => void }) {
  const suggestions = [
    "What is our remote work policy?",
    "Summarize the Q4 strategy document",
    "What are the onboarding steps for new engineers?",
    "Find anything about the product roadmap",
  ];
  return (
    <div className="flex flex-col items-center justify-center h-full pt-16 gap-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-brand-600/20 border border-brand-600/30 flex items-center justify-center">
        <Bot className="w-7 h-7 text-brand-400" />
      </div>
      <div>
        <h2 className="font-semibold text-gray-200 mb-1">How can I help?</h2>
        <p className="text-sm text-gray-500 max-w-sm">
          Ask me anything — I'll search the knowledge base and cite my sources.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 max-w-md w-full">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => onSuggestion(s)}
            className="text-left text-xs px-3 py-2.5 glass rounded-xl text-gray-400 hover:text-gray-200 hover:border-gray-600 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
