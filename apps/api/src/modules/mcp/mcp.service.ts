import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SearchService, RetrievedChunk } from "../search/search.service";
import type { Tool } from "@anthropic-ai/sdk/resources/index";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Tool.InputSchema;
}

export interface ToolCallResult {
  toolName: string;
  result: unknown;
}

/**
 * McpService acts as the MCP tool registry and executor.
 *
 * Tools exposed to Claude:
 *   - search_knowledge_base  → RAG vector search
 *   - list_documents         → returns document metadata
 *   - get_document_chunks    → returns chunks for a specific doc
 *
 * In production you would expose these via the @modelcontextprotocol/sdk
 * Server class over stdio or SSE. For the API we call them directly.
 */
@Injectable()
export class McpService implements OnModuleInit {
  private readonly logger = new Logger(McpService.name);

  constructor(
    private searchService: SearchService,
    private config: ConfigService,
  ) {}

  onModuleInit() {
    this.logger.log(
      `MCP tool registry initialised with ${this.listTools().length} tools`,
    );
  }

  // ─── Tool registry ──────────────────────────────────────────────────────────

  listTools(): McpTool[] {
    return [
      {
        name: "search_knowledge_base",
        description:
          "Perform a semantic search over the company knowledge base and return the most relevant text chunks with their source documents.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The natural-language query to search for",
            },
            topK: {
              type: "number",
              description: "Number of results to return (default 5, max 20)",
              default: 5,
            },
            documentIds: {
              type: "array",
              items: { type: "string" },
              description:
                "Optional list of document IDs to restrict the search scope",
            },
          },
          required: ["query"],
        },
      },
    ];
  }

  // ─── Tool execution ─────────────────────────────────────────────────────────

  async callTool(
    name: string,
    input: Record<string, unknown>,
  ): Promise<ToolCallResult> {
    this.logger.log(`Tool call: ${name} ${JSON.stringify(input)}`);

    switch (name) {
      case "search_knowledge_base":
        return this.searchKnowledgeBase(input);
      default:
        throw new Error(`Unknown MCP tool: ${name}`);
    }
  }

  private async searchKnowledgeBase(
    input: Record<string, unknown>,
  ): Promise<ToolCallResult> {
    const query = input.query as string;
    const topK = Math.min((input.topK as number) ?? 5, 20);
    const documentIds = input.documentIds as string[] | undefined;

    const chunks: RetrievedChunk[] = await this.searchService.semanticSearch(
      query,
      topK,
      documentIds,
    );

    return {
      toolName: "search_knowledge_base",
      result: {
        query,
        chunks: chunks.map((c) => ({
          source: c.documentTitle,
          documentId: c.documentId,
          chunkIndex: c.chunkIndex,
          score: c.score,
          content: c.content,
        })),
      },
    };
  }

  /**
   * Build the Anthropic tools array for the Claude API call.
   */
  toAnthropicTools() {
    return this.listTools().map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema,
    }));
  }
}
