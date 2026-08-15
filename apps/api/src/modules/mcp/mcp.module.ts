import { Module } from '@nestjs/common';
import { McpService } from './mcp.service';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [SearchModule],
  providers: [McpService],
  exports: [McpService],
})
export class McpModule {}
