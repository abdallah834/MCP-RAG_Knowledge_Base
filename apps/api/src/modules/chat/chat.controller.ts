import { Controller, Post, Body, Res } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import type { Response } from "express";
import { ChatService } from "./chat.service";
import { ChatMessageDto } from "./dto/chat-message.dto";

@ApiTags("Chat")
@Controller("chat")
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post("stream")
  @ApiOperation({
    summary: "Send a message and receive a streaming SSE response (RAG + MCP)",
  })
  async chatStream(@Body() dto: ChatMessageDto, @Res() res: Response) {
    await this.chatService.chatStream(dto, res);
  }

  @Post()
  @ApiOperation({
    summary: "Send a message and receive a single JSON response",
  })
  async chat(@Body() dto: ChatMessageDto) {
    return this.chatService.chat(dto);
  }
}
