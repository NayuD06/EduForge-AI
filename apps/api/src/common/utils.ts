import { randomBytes } from 'node:crypto';

/** "Lập trình Web cơ bản" -> "lap-trinh-web-co-ban-x7k2" */
export function slugify(input: string, withSuffix = true): string {
  const base = input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  if (!withSuffix) return base || 'item';
  return `${base || 'item'}-${randomBytes(2).toString('hex')}`;
}

export const toIso = (date: Date | null | undefined) => (date ? date.toISOString() : null);

export const round2 = (value: number) => Math.round(value * 100) / 100;
