import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SearchService } from './search.service';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: 'Semantic search across all knowledge base documents' })
  @ApiQuery({ name: 'q', description: 'Natural language query' })
  @ApiQuery({ name: 'topK', required: false, description: 'Number of results (default 5)' })
  async search(
    @Query('q') query: string,
    @Query('topK') topK = '5',
  ) {
    const chunks = await this.searchService.semanticSearch(query, parseInt(topK, 10));
    return { query, results: chunks };
  }
}
