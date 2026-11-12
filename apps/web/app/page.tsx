import { ApiStatus } from './api-status';

// Trang khung. Các trang dự kiến (App Router):
//   /login, /register                 – đăng nhập / đăng ký
//   /courses, /courses/[courseId]     – danh sách & chi tiết khóa học, bài học
//   /attempts/[attemptId]             – phòng thi: đồng hồ, điều hướng câu, tự lưu tiến trình
//   /attempts/[attemptId]/result      – kết quả + "AI giải thích đáp án"
export default function HomePage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-indigo-500">
          EduForge · Học viên
        </p>
        <h1 className="mt-2 text-3xl font-bold">Học và thi trực tuyến</h1>
        <p className="mt-2 text-slate-500">
          Website học viên (Next.js, cổng 3000). Giao diện sẽ được xây tiếp trên API client trong{' '}
          <code>@eduforge/shared</code>.
        </p>
      </div>
      <ApiStatus />
    </main>
  );
}
