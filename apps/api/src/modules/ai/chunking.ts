export interface PageText {
  page: number;
  text: string;
}

export interface TextChunk {
  index: number;
  page: number;
  content: string;
}

/**
 * Cắt văn bản theo trang thành các đoạn ~`size` ký tự, gối đầu `overlap` ký tự,
 * ưu tiên cắt ở ranh giới đoạn/câu để giữ ngữ nghĩa.
 */
export function chunkPages(pages: PageText[], size = 1200, overlap = 200): TextChunk[] {
  const chunks: TextChunk[] = [];
  for (const { page, text } of pages) {
    const clean = text
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (!clean) continue;
    let start = 0;
    while (start < clean.length) {
      let end = Math.min(clean.length, start + size);
      if (end < clean.length) {
        const window = clean.slice(start, end);
        const breakAt = Math.max(
          window.lastIndexOf('\n\n'),
          window.lastIndexOf('. '),
          window.lastIndexOf('\n'),
        );
        if (breakAt > size * 0.5) end = start + breakAt + 1;
      }
      const content = clean.slice(start, end).trim();
      if (content.length > 20) chunks.push({ index: chunks.length, page, content });
      if (end >= clean.length) break;
      start = Math.max(end - overlap, start + 1);
    }
  }
  return chunks;
}
