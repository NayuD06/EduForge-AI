import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Biên dịch package dùng chung trong monorepo
  transpilePackages: ['@eduforge/shared'],
  turbopack: {
    rules: {
      '*.css': { loaders: ['@tailwindcss/turbopack'], as: '*.css' },
    },
  },
};

export default nextConfig;
