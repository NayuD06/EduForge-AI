/** Cho phép trễ vài giây do mạng khi lưu/nộp sát giờ. */
export const SUBMIT_GRACE_MS = 5_000;

/** Hạn nộp = min(bắt đầu + thời lượng, thời điểm đóng đề). */
export function computeExpiresAt(
  startedAt: Date,
  durationSec: number,
  examEndAt?: Date | null,
): Date {
  const byDuration = new Date(startedAt.getTime() + durationSec * 1000);
  return examEndAt && examEndAt < byDuration ? examEndAt : byDuration;
}

export function isExpired(expiresAt: Date, now = new Date(), graceMs = 0): boolean {
  return now.getTime() > expiresAt.getTime() + graceMs;
}

export function remainingMs(expiresAt: Date, now = new Date()): number {
  return Math.max(0, expiresAt.getTime() - now.getTime());
}
