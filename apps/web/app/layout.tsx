import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EduForge – Học và thi trực tuyến',
  description: 'Nền tảng khóa học và thi trực tuyến dành cho học viên',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
