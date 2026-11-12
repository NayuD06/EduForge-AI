import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { chunkPages, type PageText } from './chunking.js';
import { EmbeddingService } from './embedding.service.js';

export interface RetrievedChunk {
  id: string;
  documentId: string;
  title: string;
  page: number | null;
  content: string;
  score: number;
}

const toVectorLiteral = (values: number[]) => `[${values.join(',')}]`;

/** Retrieval-Augmented Generation: tách PDF → đoạn văn → embedding (pgvector) → tìm đoạn liên quan. */
@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddings: EmbeddingService,
  ) {}

  async extractPages(pdf: Buffer): Promise<{ pages: PageText[]; pageCount: number }> {
    const parser = new PDFParse({ data: new Uint8Array(pdf) });
    try {
      const result = await parser.getText();
      return {
        pages: result.pages.map((p) => ({ page: p.num, text: p.text })),
        pageCount: result.total,
      };
    } finally {
      await parser.destroy();
    }
  }

  /** Tách + (nếu có) nhúng vector rồi lưu các đoạn của một tài liệu. Ghi đè dữ liệu cũ. */
  async indexDocument(documentId: string, pages: PageText[]) {
    const chunks = chunkPages(pages);
    const vectors = this.embeddings.enabled
      ? await this.embeddings.embed(
          chunks.map((c) => c.content),
          'document',
        )
      : null;

    await this.prisma.$transaction(async (tx) => {
      await tx.documentChunk.deleteMany({ where: { documentId } });
      for (const [i, chunk] of chunks.entries()) {
        const vector = vectors?.[i];
        await tx.$executeRaw`
          INSERT INTO "DocumentChunk" ("id", "documentId", "index", "page", "content", "embedding")
          VALUES (${randomUUID()}, ${documentId}, ${chunk.index}, ${chunk.page}, ${chunk.content},
                  ${vector ? toVectorLiteral(vector) : null}::vector)`;
      }
    });
    return { chunks: chunks.length, embedded: !!vectors };
  }

  /** Tìm `k` đoạn liên quan nhất trong tài liệu (đã xử lý xong) của một khóa học. */
  async search(courseId: string, query: string, k = 5): Promise<RetrievedChunk[]> {
    if (this.embeddings.enabled) {
      const hasVectors = await this.prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM "DocumentChunk" c JOIN "Document" d ON d."id" = c."documentId"
          WHERE d."courseId" = ${courseId} AND c."embedding" IS NOT NULL
        ) AS "exists"`;
      if (hasVectors[0]?.exists) {
        try {
          const [vector] = await this.embeddings.embed([query], 'query');
          const literal = toVectorLiteral(vector!);
          return await this.prisma.$queryRaw<RetrievedChunk[]>`
            SELECT c."id", c."documentId", d."title", c."page", c."content",
                   1 - (c."embedding" <=> ${literal}::vector) AS "score"
            FROM "DocumentChunk" c
            JOIN "Document" d ON d."id" = c."documentId"
            WHERE d."courseId" = ${courseId} AND d."status" = 'READY' AND c."embedding" IS NOT NULL
            ORDER BY c."embedding" <=> ${literal}::vector
            LIMIT ${k}`;
        } catch (error) {
          this.logger.warn(`Vector search lỗi, chuyển sang full-text: ${(error as Error).message}`);
        }
      }
    }
    return this.fullTextSearch(courseId, query, k);
  }

  /** Dự phòng khi chưa có embedding: full-text search (OR các từ khóa) của Postgres. */
  private async fullTextSearch(
    courseId: string,
    query: string,
    k: number,
  ): Promise<RetrievedChunk[]> {
    const terms = [
      ...new Set(
        query
          .toLowerCase()
          .split(/[^\p{L}\p{N}]+/u)
          .filter((t) => t.length > 1),
      ),
    ].slice(0, 30);
    if (!terms.length) return [];
    const tsQuery = terms.join(' | ');
    return this.prisma.$queryRaw<RetrievedChunk[]>`
      SELECT c."id", c."documentId", d."title", c."page", c."content",
             ts_rank(to_tsvector('simple', c."content"), to_tsquery('simple', ${tsQuery}))::float AS "score"
      FROM "DocumentChunk" c
      JOIN "Document" d ON d."id" = c."documentId"
      WHERE d."courseId" = ${courseId} AND d."status" = 'READY'
        AND to_tsvector('simple', c."content") @@ to_tsquery('simple', ${tsQuery})
      ORDER BY "score" DESC
      LIMIT ${k}`;
  }

  /** Dùng trong /health: kiểm tra extension pgvector đã bật. */
  async vectorExtensionReady(): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ count: bigint }>>(
      Prisma.sql`SELECT COUNT(*)::bigint AS "count" FROM pg_extension WHERE extname = 'vector'`,
    );
    return Number(rows[0]?.count ?? 0) > 0;
  }
}
