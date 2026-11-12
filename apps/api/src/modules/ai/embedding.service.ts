import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.js';

/** Số chiều phải khớp với cột DocumentChunk.embedding vector(1024) trong Prisma schema. */
export const EMBEDDING_DIMENSIONS = 1024;
const BATCH_SIZE = 64;

/**
 * Sinh embedding cho RAG qua Voyage AI (nhà cung cấp embedding được Anthropic khuyến nghị).
 * Không có VOYAGE_API_KEY ⇒ `enabled = false`, RagService tự chuyển sang full-text search của Postgres.
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private readonly apiKey?: string;
  private readonly model: string;

  constructor(config: ConfigService<Env, true>) {
    this.apiKey = config.get('VOYAGE_API_KEY', { infer: true });
    this.model = config.get('EMBEDDING_MODEL', { infer: true });
    if (!this.apiKey)
      this.logger.log(
        'Không có VOYAGE_API_KEY – RAG dùng full-text search thay cho vector search.',
      );
  }

  get enabled() {
    return !!this.apiKey;
  }

  async embed(texts: string[], inputType: 'document' | 'query'): Promise<number[][]> {
    if (!this.apiKey) throw new Error('Embedding chưa được cấu hình');
    const result: number[][] = [];
    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const res = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: batch,
          model: this.model,
          input_type: inputType,
          output_dimension: EMBEDDING_DIMENSIONS,
        }),
      });
      if (!res.ok) throw new Error(`Voyage API lỗi ${res.status}: ${await res.text()}`);
      const json = (await res.json()) as { data: Array<{ index: number; embedding: number[] }> };
      result.push(...json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding));
    }
    return result;
  }
}
