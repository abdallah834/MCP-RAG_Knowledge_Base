import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DocumentChunk, DocumentChunkDoc } from '../documents/schemas/document-chunk.schema';
import { EmbeddingsService } from '../embeddings/embeddings.service';

export interface RetrievedChunk {
  documentId: string;
  documentTitle: string;
  content: string;
  chunkIndex: number;
  score: number;
}

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);

  constructor(
    @InjectModel(DocumentChunk.name) private chunkModel: Model<DocumentChunkDoc>,
    private embeddingsService: EmbeddingsService,
  ) {}

  /**
   * Semantic vector search using MongoDB Atlas $vectorSearch.
   *
   * Prerequisites:
   *   Create an Atlas Vector Search index named "chunk_vector_index" on the
   *   document_chunks collection with:
   *   {
   *     "fields": [{
   *       "type": "vector",
   *       "path": "embedding",
   *       "numDimensions": 1536,
   *       "similarity": "cosine"
   *     }]
   *   }
   */
  async semanticSearch(
    query: string,
    topK = 5,
    filterDocumentIds?: string[],
  ): Promise<RetrievedChunk[]> {
    this.logger.debug(`Vector search: "${query.slice(0, 80)}..." topK=${topK}`);

    const queryEmbedding = await this.embeddingsService.embed(query);

    const pipeline: any[] = [
      {
        $vectorSearch: {
          index: 'chunk_vector_index',
          path: 'embedding',
          queryVector: queryEmbedding,
          numCandidates: topK * 10, // over-fetch for better recall
          limit: topK,
          ...(filterDocumentIds?.length
            ? {
                filter: {
                  documentId: {
                    $in: filterDocumentIds.map(
                      (id) => new (require('mongoose').Types.ObjectId)(id),
                    ),
                  },
                },
              }
            : {}),
        },
      },
      {
        $project: {
          _id: 0,
          documentId: 1,
          documentTitle: 1,
          content: 1,
          chunkIndex: 1,
          score: { $meta: 'vectorSearchScore' },
        },
      },
    ];

    const results = await this.chunkModel.aggregate(pipeline).exec();

    return results as RetrievedChunk[];
  }

  /**
   * Build a formatted context string from retrieved chunks,
   * suitable for injecting into an LLM prompt.
   */
  buildContext(chunks: RetrievedChunk[]): string {
    return chunks
      .map(
        (c, i) =>
          `[Source ${i + 1}: "${c.documentTitle}", chunk ${c.chunkIndex}]\n${c.content}`,
      )
      .join('\n\n---\n\n');
  }
}
