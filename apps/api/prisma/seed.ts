/**
 * Dữ liệu mẫu cho môi trường dev: 3 tài khoản, 1 khóa học, ngân hàng câu hỏi đủ 8 dạng, 2 đề thi.
 * Chạy: pnpm db:seed   (an toàn khi chạy lại – bỏ qua nếu dữ liệu đã có)
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/modules/auth/password.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const PASSWORD = 'Password123!';
const COURSE_SLUG = 'nhap-mon-ctdl-giai-thuat';

const questions: Array<Omit<Prisma.QuestionCreateManyInput, 'bankId'>> = [
  {
    type: 'SINGLE_CHOICE',
    difficulty: 'EASY',
    content: 'Độ phức tạp thời gian của tìm kiếm nhị phân trên mảng đã sắp xếp là?',
    options: {
      choices: [
        { id: 'a', text: 'O(n)' },
        { id: 'b', text: 'O(log n)' },
        { id: 'c', text: 'O(n log n)' },
        { id: 'd', text: 'O(1)' },
      ],
    },
    answer: { choiceId: 'b' },
    explanation: 'Mỗi bước loại bỏ một nửa không gian tìm kiếm nên số bước là log₂(n).',
    tags: ['tim-kiem', 'do-phuc-tap'],
  },
  {
    type: 'SINGLE_CHOICE',
    difficulty: 'EASY',
    content: 'Cấu trúc dữ liệu nào hoạt động theo nguyên tắc LIFO?',
    options: {
      choices: [
        { id: 'a', text: 'Hàng đợi (Queue)' },
        { id: 'b', text: 'Ngăn xếp (Stack)' },
        { id: 'c', text: 'Danh sách liên kết' },
        { id: 'd', text: 'Cây nhị phân' },
      ],
    },
    answer: { choiceId: 'b' },
    explanation: 'Stack: phần tử vào sau cùng được lấy ra trước (Last In, First Out).',
    tags: ['stack'],
  },
  {
    type: 'SINGLE_CHOICE',
    difficulty: 'MEDIUM',
    content: 'Thuật toán sắp xếp nào có độ phức tạp trung bình O(n log n) và sắp xếp tại chỗ?',
    options: {
      choices: [
        { id: 'a', text: 'Merge sort' },
        { id: 'b', text: 'Bubble sort' },
        { id: 'c', text: 'Quick sort' },
        { id: 'd', text: 'Counting sort' },
      ],
    },
    answer: { choiceId: 'c' },
    explanation: 'Quick sort trung bình O(n log n) và chỉ cần O(log n) bộ nhớ cho đệ quy.',
    tags: ['sap-xep'],
  },
  {
    type: 'SINGLE_CHOICE',
    difficulty: 'MEDIUM',
    content: 'Duyệt cây nhị phân tìm kiếm theo thứ tự nào cho dãy khóa tăng dần?',
    options: {
      choices: [
        { id: 'a', text: 'Pre-order' },
        { id: 'b', text: 'In-order' },
        { id: 'c', text: 'Post-order' },
        { id: 'd', text: 'Level-order' },
      ],
    },
    answer: { choiceId: 'b' },
    tags: ['cay'],
  },
  {
    type: 'MULTIPLE_CHOICE',
    difficulty: 'MEDIUM',
    content: 'Những cấu trúc nào truy cập phần tử theo chỉ số trong O(1)?',
    options: {
      choices: [
        { id: 'a', text: 'Mảng' },
        { id: 'b', text: 'Danh sách liên kết đơn' },
        { id: 'c', text: 'Mảng động (ArrayList)' },
        { id: 'd', text: 'Cây AVL' },
      ],
    },
    answer: { choiceIds: ['a', 'c'] },
    explanation: 'Mảng và mảng động lưu liên tiếp trong bộ nhớ nên tính được địa chỉ trực tiếp.',
    tags: ['mang'],
  },
  {
    type: 'TRUE_FALSE',
    difficulty: 'EASY',
    content: 'Hàng đợi (Queue) hoạt động theo nguyên tắc FIFO.',
    options: {},
    answer: { value: true },
    tags: ['queue'],
  },
  {
    type: 'TRUE_FALSE',
    difficulty: 'MEDIUM',
    content: 'Bảng băm (hash table) luôn đảm bảo tìm kiếm trong O(1) ở trường hợp xấu nhất.',
    options: {},
    answer: { value: false },
    explanation: 'Khi nhiều khóa đụng độ, trường hợp xấu nhất có thể là O(n).',
    tags: ['bang-bam'],
  },
  {
    type: 'SHORT_ANSWER',
    difficulty: 'EASY',
    content: 'Cấu trúc dữ liệu dùng để cài đặt thuật toán duyệt theo chiều rộng (BFS) là gì?',
    options: { placeholder: 'Nhập tên cấu trúc dữ liệu' },
    answer: { accepted: ['Hàng đợi', 'Queue', 'Hang doi'] },
    tags: ['do-thi', 'queue'],
  },
  {
    type: 'NUMERIC',
    difficulty: 'MEDIUM',
    content: 'Cây nhị phân đầy đủ có chiều cao 3 (gốc ở mức 0) có tối đa bao nhiêu nút?',
    options: { unit: 'nút' },
    answer: { value: 15, tolerance: 0 },
    explanation: 'Số nút tối đa = 2^(h+1) − 1 = 2^4 − 1 = 15.',
    tags: ['cay'],
  },
  {
    type: 'MATCHING',
    difficulty: 'MEDIUM',
    content: 'Ghép thuật toán với độ phức tạp trung bình tương ứng.',
    options: {
      left: [
        { id: 'l1', text: 'Tìm kiếm tuần tự' },
        { id: 'l2', text: 'Tìm kiếm nhị phân' },
        { id: 'l3', text: 'Merge sort' },
      ],
      right: [
        { id: 'r1', text: 'O(n)' },
        { id: 'r2', text: 'O(log n)' },
        { id: 'r3', text: 'O(n log n)' },
      ],
    },
    answer: { pairs: { l1: 'r1', l2: 'r2', l3: 'r3' } },
    tags: ['do-phuc-tap'],
  },
  {
    type: 'ORDERING',
    difficulty: 'HARD',
    content: 'Sắp xếp các độ phức tạp sau theo thứ tự tăng dần.',
    options: {
      items: [
        { id: 'i1', text: 'O(1)' },
        { id: 'i2', text: 'O(log n)' },
        { id: 'i3', text: 'O(n)' },
        { id: 'i4', text: 'O(n²)' },
      ],
    },
    answer: { order: ['i1', 'i2', 'i3', 'i4'] },
    tags: ['do-phuc-tap'],
  },
  {
    type: 'ESSAY',
    difficulty: 'HARD',
    content: 'So sánh ưu nhược điểm của mảng và danh sách liên kết. Khi nào nên dùng mỗi loại?',
    options: { minWords: 50 },
    answer: { rubric: 'Nêu được truy cập ngẫu nhiên, chi phí chèn/xóa, bộ nhớ, ví dụ ứng dụng.' },
    points: 3,
    tags: ['mang', 'danh-sach-lien-ket'],
  },
];

async function main() {
  const passwordHash = await hashPassword(PASSWORD);
  const upsertUser = (email: string, fullName: string, role: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT') =>
    prisma.user.upsert({
      where: { email },
      create: { email, fullName, role, passwordHash },
      update: {},
    });

  await upsertUser('admin@eduforge.dev', 'Quản trị viên', 'ADMIN');
  const instructor = await upsertUser(
    'instructor@eduforge.dev',
    'TS. Trần Minh Giảng',
    'INSTRUCTOR',
  );
  const student = await upsertUser('student@eduforge.dev', 'Nguyễn Văn Học', 'STUDENT');

  if (await prisma.course.findUnique({ where: { slug: COURSE_SLUG } })) {
    console.log('• Dữ liệu mẫu đã tồn tại – bỏ qua.');
    return;
  }

  const course = await prisma.course.create({
    data: {
      title: 'Nhập môn Cấu trúc dữ liệu & Giải thuật',
      slug: COURSE_SLUG,
      description:
        'Khóa học mẫu của EduForge: mảng, danh sách liên kết, ngăn xếp, hàng đợi, cây và sắp xếp.',
      status: 'PUBLISHED',
      instructorId: instructor.id,
      lessons: {
        create: [
          {
            title: 'Bài 1: Độ phức tạp thuật toán',
            order: 0,
            durationMin: 20,
            content: '# Big-O\nĐộ phức tạp mô tả tốc độ tăng chi phí theo kích thước đầu vào.',
          },
          {
            title: 'Bài 2: Mảng và danh sách liên kết',
            order: 1,
            durationMin: 30,
            content: '# Mảng\nLưu liên tiếp, truy cập O(1)...',
          },
          {
            title: 'Bài 3: Ngăn xếp và hàng đợi',
            order: 2,
            durationMin: 25,
            content: '# Stack & Queue\nLIFO và FIFO...',
          },
        ],
      },
      enrollments: { create: [{ userId: student.id }] },
    },
  });

  const bank = await prisma.questionBank.create({
    data: { name: 'CTDL – Ngân hàng chương 1-3', courseId: course.id, ownerId: instructor.id },
  });
  await prisma.question.createMany({ data: questions.map((q) => ({ ...q, bankId: bank.id })) });
  const all = await prisma.question.findMany({
    where: { bankId: bank.id },
    orderBy: { createdAt: 'asc' },
  });

  await prisma.exam.create({
    data: {
      courseId: course.id,
      title: 'Kiểm tra nhanh 10 phút (đề ngẫu nhiên)',
      description: 'Mỗi lượt thi rút ngẫu nhiên 6 câu từ ngân hàng, xáo trộn thứ tự câu và đáp án.',
      mode: 'RANDOM',
      status: 'PUBLISHED',
      durationSec: 600,
      passingPercent: 50,
      rules: {
        create: [
          { bankId: bank.id, count: 3, type: 'SINGLE_CHOICE', order: 0 },
          { bankId: bank.id, count: 1, type: 'TRUE_FALSE', order: 1 },
          { bankId: bank.id, count: 2, difficulty: 'MEDIUM', order: 2 },
        ],
      },
    },
  });

  await prisma.exam.create({
    data: {
      courseId: course.id,
      title: 'Bài tổng hợp đủ 8 dạng câu hỏi (đề cố định)',
      mode: 'FIXED',
      status: 'PUBLISHED',
      durationSec: 1800,
      shuffleQuestions: false,
      questions: { create: all.map((q, order) => ({ questionId: q.id, order })) },
    },
  });

  console.log('✓ Đã tạo dữ liệu mẫu. Tài khoản (mật khẩu: %s):', PASSWORD);
  console.log(
    '  - admin@eduforge.dev (ADMIN)\n  - instructor@eduforge.dev (INSTRUCTOR)\n  - student@eduforge.dev (STUDENT)',
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
