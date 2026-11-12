/** Cổng mặc định của từng ứng dụng trong monorepo. */
export const PORTS = {
  api: 4000,
  web: 3000,
  admin: 3001,
  mobile: 8081,
} as const;

/** Tiền tố REST API (http://localhost:4000/api/...). */
export const API_PREFIX = 'api';

/** Namespace Socket.IO dành cho phòng thi. */
export const EXAM_SOCKET_NAMESPACE = '/exam';

/** Tên sự kiện Socket.IO giữa client và Exam Engine. */
export const ExamSocketEvent = {
  /** client -> server: vào phòng của một lượt thi */
  JOIN: 'attempt:join',
  /** server -> client: trạng thái + đồng hồ máy chủ để đồng bộ bộ đếm thời gian */
  STATE: 'attempt:state',
  /** server -> client: tiến trình vừa được lưu (đồng bộ nhiều thiết bị) */
  SAVED: 'attempt:saved',
  /** server -> client: lượt thi đã được nộp (thủ công hoặc hết giờ) */
  SUBMITTED: 'attempt:submitted',
  /** server -> client: lỗi */
  ERROR: 'attempt:error',
} as const;

/** Khoảng thời gian client tự động lưu tiến trình (ms). */
export const AUTOSAVE_INTERVAL_MS = 15_000;
