# Knowledge Base — AI-Powered Internal Search

> A full-stack MERN application with **RAG** (Retrieval-Augmented Generation) and **MCP** (Model Context Protocol) that lets teams ask natural-language questions over their internal documents.

---

## Features

- **Upload** PDF, DOCX, TXT, MD files
- **Auto-chunking & embedding** via OpenAI `text-embedding-3-small`
- **Semantic search** with MongoDB Atlas Vector Search
- **Agentic chat** — Claude uses MCP tools to search the KB before answering
- **Streaming SSE responses** with tool-call indicators in the UI
- **Source citations** — every answer references the source document

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  React (Vite + Tailwind)          apps/web              │
│  ┌──────────────┐  ┌──────────────────────────────┐    │
│  │  Chat UI     │  │  Documents (drag-drop upload) │    │
│  └──────┬───────┘  └──────────────┬───────────────┘    │
└─────────┼────────────────────────┼────────────────────┘
          │ SSE stream             │ multipart/form-data
          ▼                        ▼
┌─────────────────────────────────────────────────────────┐
│  NestJS API              apps/api                        │
│  ┌──────────┐  ┌────────┐  ┌──────────┐  ┌──────────┐ │
│  │  Chat    │  │  Docs  │  │  Search  │  │   MCP    │ │
│  │ /stream  │  │/upload │  │  ?q=...  │  │  Tools   │ │
│  └────┬─────┘  └───┬────┘  └────┬─────┘  └────┬─────┘ │
└───────┼────────────┼────────────┼──────────────┼───────┘
        │            │            │              │
        ▼            ▼            ▼              │
   Claude API   pdf-parse   MongoDB Atlas   McpService
  (Anthropic)   mammoth     Vector Search  ────────────►
                                           calls Search
                            ▲              returns chunks
                            │
                     OpenAI Embeddings
                  (text-embedding-3-small)
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker & Docker Compose
- MongoDB Atlas account (free tier works) **or** use the local Atlas Docker image

### 1. Clone & install

```bash
git clone https://github.com/your-username/knowledge-base.git
cd knowledge-base
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in MONGODB_URI, OPENAI_API_KEY, ANTHROPIC_API_KEY
```

### 3. Start MongoDB (local dev)

```bash
docker compose -f docker/docker-compose.yml up -d
# Update MONGODB_URI in .env:
# mongodb://root:rootpassword@localhost:27017/knowledge-base?authSource=admin
```

### 4. Create the Vector Search Index

**Option A — MongoDB Atlas UI:**

1. Go to Atlas → your cluster → Search → Create Search Index
2. Choose "JSON Editor", select your collection `document_chunks`
3. Paste the contents of `docker/atlas-vector-search-index.json`

**Option B — Atlas CLI:**

```bash
atlas deployments search indexes create \
  --deploymentName <your-cluster> \
  --file docker/atlas-vector-search-index.json
```

### 5. Run in development

```bash
# Run everything in parallel
pnpm dev

# Or run services individually:
pnpm dev:api   # NestJS on :3001
pnpm dev:web   # React on :5173
```

Open [http://localhost:5173](http://localhost:5173)

---

## Project Structure

```
knowledge-base/
├── apps/
│   ├── api/                        # NestJS backend
│   │   └── src/
│   │       ├── app.module.ts
│   │       ├── main.ts
│   │       └── modules/
│   │           ├── documents/      # Upload, parse, chunk
│   │           ├── embeddings/     # OpenAI embedding wrapper
│   │           ├── search/         # MongoDB Atlas Vector Search
│   │           ├── chat/           # Agentic Claude loop (SSE)
│   │           └── mcp/            # MCP tool registry & executor
│   └── web/                        # React + Vite frontend
│       └── src/
│           ├── pages/              # ChatPage, DocumentsPage
│           ├── components/         # Layout, UI components
│           ├── store/              # Zustand state
│           └── lib/api.ts          # Typed API client
├── docker/
│   ├── docker-compose.yml
│   └── atlas-vector-search-index.json
├── .env.example
└── pnpm-workspace.yaml
```

---

## API Endpoints

| Method   | Path                          | Description          |
| -------- | ----------------------------- | -------------------- |
| `POST`   | `/api/v1/documents/upload`    | Upload a document    |
| `GET`    | `/api/v1/documents`           | List all documents   |
| `DELETE` | `/api/v1/documents/:id`       | Delete a document    |
| `GET`    | `/api/v1/search?q=...&topK=5` | Semantic search      |
| `POST`   | `/api/v1/chat`                | Chat (JSON response) |
| `POST`   | `/api/v1/chat/stream`         | Chat (SSE stream)    |

Swagger docs: [http://localhost:3001/api/docs](http://localhost:3001/api/docs)

---

## MCP Tools

| Tool                    | Description                                     |
| ----------------------- | ----------------------------------------------- |
| `search_knowledge_base` | Semantic search returning top-K relevant chunks |

Claude autonomously decides when to call tools based on the user's question.

---

## Adding More MCP Tools

Edit `apps/api/src/modules/mcp/mcp.service.ts`:

```typescript
// 1. Add to listTools()
{
  name: 'get_document_summary',
  description: 'Get a one-paragraph summary of a specific document by ID',
  inputSchema: { ... }
}

// 2. Add case to callTool()
case 'get_document_summary':
  return this.getDocumentSummary(input);
```

---

## Deployment

| Service                 | Platform                     |
| ----------------------- | ---------------------------- |
| React frontend          | Vercel                       |
| NestJS API              | Railway / Render             |
| MongoDB + Vector Search | MongoDB Atlas (M0 free tier) |

---

## License

MIT
