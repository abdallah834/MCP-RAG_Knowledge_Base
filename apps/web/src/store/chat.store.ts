import { create } from 'zustand';
import { ChatMessage, ToolCallEvent } from '../types';
import { v4 as uuidv4 } from 'uuid';

// -- tiny uuid shim so we don't need uuid pkg in the browser --
const uid = () => Math.random().toString(36).slice(2, 10);

interface ChatStore {
  messages: ChatMessage[];
  isStreaming: boolean;
  addUserMessage: (content: string) => ChatMessage;
  addAssistantMessage: () => ChatMessage;
  appendDelta: (id: string, text: string) => void;
  appendToolCall: (id: string, event: ToolCallEvent) => void;
  setStreaming: (v: boolean) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isStreaming: false,

  addUserMessage: (content) => {
    const msg: ChatMessage = {
      id: uid(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    set((s) => ({ messages: [...s.messages, msg] }));
    return msg;
  },

  addAssistantMessage: () => {
    const msg: ChatMessage = {
      id: uid(),
      role: 'assistant',
      content: '',
      toolCalls: [],
      timestamp: new Date(),
    };
    set((s) => ({ messages: [...s.messages, msg] }));
    return msg;
  },

  appendDelta: (id, text) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + text } : m,
      ),
    })),

  appendToolCall: (id, event) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, toolCalls: [...(m.toolCalls ?? []), event] } : m,
      ),
    })),

  setStreaming: (v) => set({ isStreaming: v }),
  clearMessages: () => set({ messages: [] }),
}));
