import { chunkPages } from './chunking.js';

describe('chunkPages', () => {
  it('giữ số trang và cắt văn bản dài thành nhiều đoạn gối đầu', () => {
    const long = Array.from({ length: 60 }, (_, i) => `Câu số ${i} nói về cấu trúc dữ liệu.`).join(
      ' ',
    );
    const chunks = chunkPages([
      { page: 1, text: 'Trang ngắn nhưng đủ dài để được giữ lại làm một đoạn.' },
      { page: 2, text: long },
    ]);
    expect(chunks[0]).toMatchObject({ index: 0, page: 1 });
    const page2 = chunks.filter((c) => c.page === 2);
    expect(page2.length).toBeGreaterThan(1);
    expect(page2.every((c) => c.content.length <= 1200)).toBe(true);
    expect(chunks.map((c) => c.index)).toEqual([...chunks.keys()]);
  });

  it('bỏ qua trang trống', () => {
    expect(chunkPages([{ page: 1, text: '   \n  ' }])).toEqual([]);
  });
});
