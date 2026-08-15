const BASE = '/api/v1';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message ?? 'Request failed');
  }
  return res.json();
}

// ─── Documents ──────────────────────────────────────────────────────────────

export const api = {
  documents: {
    list: () => request<any[]>('/documents'),
    upload: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return fetch(`${BASE}/documents/upload`, { method: 'POST', body: form }).then(
        (r) => r.json(),
      );
    },
    delete: (id: string) => request<void>(`/documents/${id}`, { method: 'DELETE' }),
  },

  search: {
    query: (q: string, topK = 5) =>
      request<{ query: string; results: any[] }>(`/search?q=${encodeURIComponent(q)}&topK=${topK}`),
  },

  chat: {
    /**
     * Opens an SSE stream and calls the provided callbacks as events arrive.
     */
    stream: (
      payload: { message: string; history?: any[]; documentIds?: string[] },
      callbacks: {
        onDelta: (text: string) => void;
        onToolCall: (event: any) => void;
        onToolResult: (event: any) => void;
        onDone: () => void;
        onError: (msg: string) => void;
      },
    ): AbortController => {
      const controller = new AbortController();

      fetch(`${BASE}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }).then(async (res) => {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            const lines = part.split('\n');
            let event = 'message';
            let data = '';

            for (const line of lines) {
              if (line.startsWith('event:')) event = line.slice(6).trim();
              if (line.startsWith('data:')) data = line.slice(5).trim();
            }

            if (!data) continue;
            const parsed = JSON.parse(data);

            switch (event) {
              case 'delta':       callbacks.onDelta(parsed.text);     break;
              case 'tool_call':   callbacks.onToolCall(parsed);        break;
              case 'tool_result': callbacks.onToolResult(parsed);      break;
              case 'done':        callbacks.onDone();                   break;
              case 'error':       callbacks.onError(parsed.message);   break;
            }
          }
        }
      }).catch((err) => {
        if (err.name !== 'AbortError') callbacks.onError(err.message);
      });

      return controller;
    },
  },
};
