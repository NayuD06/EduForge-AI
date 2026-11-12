import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EduForge Admin',
  description: 'Dashboard giảng viên: khóa học, ngân hàng câu hỏi, đề thi, phân tích và AI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
