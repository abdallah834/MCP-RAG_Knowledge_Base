import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { McpModule } from '../mcp/mcp.module';

@Module({
  imports: [McpModule],
  providers: [ChatService],
  controllers: [ChatController],
})
export class ChatModule {}
