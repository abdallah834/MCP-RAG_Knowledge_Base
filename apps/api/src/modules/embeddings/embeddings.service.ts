import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private readonly openai: OpenAI;
  private readonly model = 'text-embedding-3-small'; // 1536 dims, cost-efficient

  constructor(private config: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.config.getOrThrow<string>('OPENAI_API_KEY'),
    });
  }

  /**
   * Embed a single string.
   */
  async embed(text: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: this.model,
      input: this.sanitize(text),
    });
    return response.data[0].embedding;
  }

  /**
   * Embed a batch of strings in one API call (max 2048 items per OpenAI).
   */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    this.logger.debug(`Embedding batch of ${texts.length} texts`);

    const response = await this.openai.embeddings.create({
      model: this.model,
      input: texts.map((t) => this.sanitize(t)),
    });

    // OpenAI returns embeddings in order
    return response.data.map((d) => d.embedding);
  }

  /**
   * Strip newlines and trim — OpenAI recommends this for quality.
   */
  private sanitize(text: string): string {
    return text.replace(/\n+/g, ' ').trim().slice(0, 8000);
  }
}
