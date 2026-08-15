import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  MaxLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class ChatMessageDto {
  @ApiProperty({ description: "User message / question" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message!: string;

  @ApiPropertyOptional({
    description: "Conversation history for multi-turn chat",
  })
  @IsOptional()
  @IsArray()
  history?: { role: "user" | "assistant"; content: string }[];

  @ApiPropertyOptional({
    description: "Restrict RAG search to specific document IDs",
  })
  @IsOptional()
  @IsArray()
  documentIds?: string[];
}
