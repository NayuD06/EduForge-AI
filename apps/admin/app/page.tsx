import { ApiStatus } from './api-status';

// Trang khung. Các trang dự kiến (App Router):
//   /login                          – đăng nhập giảng viên (instructor@eduforge.dev khi dùng dữ liệu seed)
//   /courses, /courses/[id]         – quản lý khóa học & bài học
//   /question-banks, /[bankId]      – ngân hàng câu hỏi (8 dạng), duyệt câu hỏi AI ở trạng thái DRAFT
//   /exams, /exams/[id]             – tạo đề (cố định / ngẫu nhiên theo quy tắc), xem trước, mở đề
//   /exams/[id]/analytics           – phổ điểm, tỉ lệ đạt, độ khó thực tế từng câu
//   /ai                             – upload PDF, sinh câu hỏi bằng AI
export default function DashboardPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-500">
          EduForge · Admin
        </p>
        <h1 className="mt-2 text-3xl font-bold">Dashboard giảng viên</h1>
        <p className="mt-2 text-slate-500">
          Next.js, cổng 3001. Giao diện quản trị sẽ được xây tiếp.
        </p>
      </div>
      <ApiStatus />
    </main>
  );
}
