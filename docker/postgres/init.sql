-- Chạy một lần khi container Postgres khởi tạo volume mới.
-- Bật pgvector để lưu embedding cho RAG (AI giải thích đáp án).
CREATE EXTENSION IF NOT EXISTS vector;
