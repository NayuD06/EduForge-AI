import {
  applyOptionOrder,
  type CandidateQuestion,
  generateRandomExam,
  InsufficientQuestionsError,
  shuffleOptionOrder,
} from './generator.js';
import { createRng } from './random.js';

const pool: CandidateQuestion[] = Array.from({ length: 30 }, (_, i) => ({
  id: `q${i}`,
  bankId: i < 20 ? 'bank-a' : 'bank-b',
  type: i % 2 === 0 ? 'SINGLE_CHOICE' : 'TRUE_FALSE',
  difficulty: i % 3 === 0 ? 'HARD' : 'EASY',
  tags: i < 10 ? ['chuong-1'] : ['chuong-2'],
  points: 1,
}));

describe('generateRandomExam', () => {
  it('rút đúng số câu theo từng quy tắc, không trùng lặp', () => {
    const items = generateRandomExam(
      [
        { bankId: 'bank-a', count: 5, difficulty: 'EASY' },
        { bankId: 'bank-a', count: 3, type: 'SINGLE_CHOICE', pointsPerQuestion: 2 },
        { bankId: 'bank-b', count: 4 },
      ],
      pool,
      42,
      { shuffleQuestions: true },
    );
    expect(items).toHaveLength(12);
    expect(new Set(items.map((i) => i.questionId)).size).toBe(12);
    expect(items.map((i) => i.order)).toEqual([...Array(12).keys()]);
    expect(items.filter((i) => i.points === 2)).toHaveLength(3);
  });

  it('cùng seed sinh cùng một đề, khác seed sinh đề khác', () => {
    const rules = [{ bankId: 'bank-a', count: 10 }];
    const a = generateRandomExam(rules, pool, 7, { shuffleQuestions: true });
    const b = generateRandomExam(rules, pool, 7, { shuffleQuestions: true });
    const c = generateRandomExam(rules, pool, 8, { shuffleQuestions: true });
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('lọc theo tag', () => {
    const items = generateRandomExam(
      [{ bankId: 'bank-a', count: 10, tags: ['chuong-1'] }],
      pool,
      1,
      {
        shuffleQuestions: false,
      },
    );
    expect(items.every((i) => Number(i.questionId.slice(1)) < 10)).toBe(true);
  });

  it('báo lỗi khi ngân hàng không đủ câu', () => {
    expect(() =>
      generateRandomExam([{ bankId: 'bank-b', count: 11 }], pool, 1, { shuffleQuestions: false }),
    ).toThrow(InsufficientQuestionsError);
  });
});

describe('shuffleOptionOrder / applyOptionOrder', () => {
  it('ORDERING luôn được xáo khác thứ tự đúng', () => {
    const options = { items: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] };
    const order = shuffleOptionOrder('ORDERING', options, createRng(3), false);
    expect(order?.items).toHaveLength(4);
    expect(order?.items?.join()).not.toBe('a,b,c,d');
  });

  it('áp thứ tự đã xáo lên options', () => {
    const options = {
      choices: [
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
      ],
    };
    expect(applyOptionOrder(options, { choices: ['b', 'a'] })).toEqual({
      choices: [
        { id: 'b', text: 'B' },
        { id: 'a', text: 'A' },
      ],
    });
  });
});
