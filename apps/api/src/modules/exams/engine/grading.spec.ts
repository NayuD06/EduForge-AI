import { gradeResponse, summarize } from './grading.js';

describe('gradeResponse', () => {
  it('chấm SINGLE_CHOICE đúng/sai', () => {
    expect(gradeResponse('SINGLE_CHOICE', { choiceId: 'b' }, { choiceId: 'b' }, 2)).toEqual({
      score: 2,
      isCorrect: true,
      needsManualGrading: false,
    });
    expect(gradeResponse('SINGLE_CHOICE', { choiceId: 'b' }, { choiceId: 'a' }, 2).score).toBe(0);
  });

  it('không trả lời được 0 điểm', () => {
    expect(gradeResponse('TRUE_FALSE', { value: true }, null, 1)).toEqual({
      score: 0,
      isCorrect: false,
      needsManualGrading: false,
    });
  });

  it('MULTIPLE_CHOICE chấm từng phần và trừ điểm chọn sai', () => {
    const key = { choiceIds: ['a', 'b'] };
    expect(gradeResponse('MULTIPLE_CHOICE', key, { choiceIds: ['a', 'b'] }, 1).score).toBe(1);
    expect(gradeResponse('MULTIPLE_CHOICE', key, { choiceIds: ['a'] }, 1).score).toBe(0.5);
    expect(gradeResponse('MULTIPLE_CHOICE', key, { choiceIds: ['a', 'c'] }, 1).score).toBe(0);
    expect(gradeResponse('MULTIPLE_CHOICE', key, { choiceIds: ['a'] }, 1).isCorrect).toBe(false);
  });

  it('SHORT_ANSWER bỏ qua hoa/thường và khoảng trắng thừa, giữ dấu tiếng Việt', () => {
    const key = { accepted: ['Hà Nội', 'Ha Noi'] };
    expect(gradeResponse('SHORT_ANSWER', key, { text: '  hà   nội ' }, 1).isCorrect).toBe(true);
    expect(gradeResponse('SHORT_ANSWER', key, { text: 'ha noi' }, 1).isCorrect).toBe(true);
    expect(gradeResponse('SHORT_ANSWER', key, { text: 'Hải Phòng' }, 1).isCorrect).toBe(false);
    expect(
      gradeResponse(
        'SHORT_ANSWER',
        { accepted: ['NaCl'], caseSensitive: true },
        { text: 'nacl' },
        1,
      ).isCorrect,
    ).toBe(false);
  });

  it('NUMERIC chấp nhận sai số', () => {
    expect(
      gradeResponse('NUMERIC', { value: 3.14, tolerance: 0.01 }, { value: 3.145 }, 1).isCorrect,
    ).toBe(true);
    expect(gradeResponse('NUMERIC', { value: 3.14 }, { value: 3.15 }, 1).isCorrect).toBe(false);
  });

  it('MATCHING và ORDERING chấm theo tỉ lệ', () => {
    const pairs = { l1: 'r1', l2: 'r2', l3: 'r3', l4: 'r4' };
    expect(
      gradeResponse('MATCHING', { pairs }, { pairs: { l1: 'r1', l2: 'r2', l3: 'r4', l4: 'r3' } }, 2)
        .score,
    ).toBe(1);
    expect(
      gradeResponse('ORDERING', { order: ['a', 'b', 'c'] }, { order: ['a', 'b', 'c'] }, 3),
    ).toEqual({
      score: 3,
      isCorrect: true,
      needsManualGrading: false,
    });
    expect(
      gradeResponse('ORDERING', { order: ['a', 'b', 'c'] }, { order: ['a', 'c', 'b'] }, 3).score,
    ).toBe(1);
  });

  it('ESSAY chuyển sang chấm tay', () => {
    expect(gradeResponse('ESSAY', {}, { text: 'Bài làm...' }, 5)).toEqual({
      score: null,
      isCorrect: null,
      needsManualGrading: true,
    });
    expect(gradeResponse('ESSAY', {}, { text: '   ' }, 5).score).toBe(0);
  });
});

describe('summarize', () => {
  it('tính tổng điểm, phần trăm và số câu chờ chấm tay', () => {
    const totals = summarize([
      { points: 2, outcome: { score: 2, needsManualGrading: false } },
      { points: 1, outcome: { score: 0.5, needsManualGrading: false } },
      { points: 5, outcome: { score: null, needsManualGrading: true } },
    ]);
    expect(totals).toEqual({ score: 2.5, maxScore: 8, percent: 31.25, pendingManual: 1 });
  });
});
