export interface Document {
  _id: string;
  title: string;
  originalFilename: string;
  fileType: string;
  wordCount: number;
  status: 'processing' | 'ready' | 'error';
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  toolCalls?: ToolCallEvent[];
  timestamp: Date;
}

export interface ToolCallEvent {
  tool: string;
  input?: Record<string, unknown>;
  chunks?: number;
}

export interface SearchResult {
  source: string;
  documentId: string;
  chunkIndex: number;
  score: number;
  content: string;
}
