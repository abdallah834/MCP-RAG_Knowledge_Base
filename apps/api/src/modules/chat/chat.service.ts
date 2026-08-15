import Anthropic from "@anthropic-ai/sdk";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Response } from "express";
import { McpService } from "../mcp/mcp.service";
import { ChatMessageDto } from "./dto/chat-message.dto";

const SYSTEM_PROMPT = `You are an intelligent assistant for a company knowledge base.
You have access to a semantic search tool that retrieves relevant passages from internal documents.

Guidelines:
- Always search the knowledge base before answering questions about company information.
- Cite your sources clearly using [Source: "document title", chunk N] notation.
- If the knowledge base does not contain relevant information, say so honestly.
- Keep answers concise, factual, and grounded in retrieved content.
- If asked a general question unrelated to company knowledge, answer from your own knowledge and clarify you did not search the KB.`;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly anthropic: Anthropic;

  constructor(
    private config: ConfigService,
    private mcpService: McpService,
  ) {
    this.anthropic = new Anthropic({
      apiKey: this.config.getOrThrow<string>("ANTHROPIC_API_KEY"),
    });
  }

  /**
   * Agentic chat with streaming SSE response.
   * Flow:
   *   1. Send user message + tools to Claude
   *   2. If Claude calls a tool → execute via McpService → feed result back
   *   3. Repeat until Claude produces a final text response
   *   4. Stream each text delta to the client via SSE
   */
  async chatStream(dto: ChatMessageDto, res: Response): Promise<void> {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    const sendEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const messages: Anthropic.MessageParam[] = [
        ...(dto.history ?? []).map((h) => ({
          role: h.role as "user" | "assistant",
          content: h.content,
        })),
        { role: "user", content: dto.message },
      ];

      const tools = this.mcpService.toAnthropicTools();

      // Agentic loop — Claude may call tools multiple times
      let continueLoop = true;

      while (continueLoop) {
        const response = await this.anthropic.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          system: SYSTEM_PROMPT,
          tools,
          messages,
        });

        this.logger.debug(`Claude stop_reason: ${response.stop_reason}`);

        if (response.stop_reason === "tool_use") {
          // Push assistant turn (with tool_use blocks)
          messages.push({ role: "assistant", content: response.content });

          // Execute all tool calls in this turn
          const toolResults: Anthropic.ToolResultBlockParam[] = [];

          for (const block of response.content) {
            if (block.type !== "tool_use") continue;

            sendEvent("tool_call", { tool: block.name, input: block.input });

            const { result } = await this.mcpService.callTool(
              block.name,
              block.input as Record<string, unknown>,
            );

            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });

            sendEvent("tool_result", {
              tool: block.name,
              chunks: (result as any).chunks?.length ?? 0,
            });
          }

          // Push tool results back as user turn
          messages.push({ role: "user", content: toolResults });
        } else if (response.stop_reason === "end_turn") {
          // Stream final text back to client
          for (const block of response.content) {
            if (block.type === "text") {
              // Simulate streaming by chunking the text
              const words = block.text.split(" ");
              for (let i = 0; i < words.length; i += 5) {
                const chunk = words.slice(i, i + 5).join(" ") + " ";
                sendEvent("delta", { text: chunk });
                await new Promise((r) => setTimeout(r, 15)); // pacing
              }
            }
          }
          continueLoop = false;
        } else {
          // max_tokens or other stop reason
          continueLoop = false;
        }
      }

      sendEvent("done", { message: "Stream complete" });
      res.end();
    } catch (err) {
      this.logger.error("Chat stream error", err);
      sendEvent("error", { message: (err as Error).message });
      res.end();
    }
  }

  /**
   * Non-streaming version — useful for testing or simple integrations.
   */
  async chat(
    dto: ChatMessageDto,
  ): Promise<{ answer: string; sources: string[] }> {
    const messages: Anthropic.MessageParam[] = [
      ...(dto.history ?? []).map((h) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
      { role: "user", content: dto.message },
    ];

    const tools = this.mcpService.toAnthropicTools();
    let continueLoop = true;
    const sources: string[] = [];

    while (continueLoop) {
      const response = await this.anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        tools,
        messages,
      });

      if (response.stop_reason === "tool_use") {
        messages.push({ role: "assistant", content: response.content });
        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const block of response.content) {
          if (block.type !== "tool_use") continue;
          const { result } = await this.mcpService.callTool(
            block.name,
            block.input as Record<string, unknown>,
          );

          const typedResult = result as any;
          if (typedResult?.chunks) {
            sources.push(...typedResult.chunks.map((c: any) => c.source));
          }

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(result),
          });
        }

        messages.push({ role: "user", content: toolResults });
      } else {
        const textBlock = response.content.find((b) => b.type === "text");
        const answer = textBlock?.type === "text" ? textBlock.text : "";
        return { answer, sources: [...new Set(sources)] };
      }
    }

    return { answer: "", sources: [] };
  }
}
