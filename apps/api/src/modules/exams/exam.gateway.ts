import { EXAM_SOCKET_NAMESPACE, ExamSocketEvent } from '@eduforge/shared';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import type { AuthUser, JwtPayload } from '../../common/auth.js';
import { PrismaService } from '../../prisma/prisma.service.js';

const room = (attemptId: string) => `attempt:${attemptId}`;

/**
 * Kênh realtime của phòng thi:
 *  - đồng bộ đồng hồ máy chủ cho bộ đếm thời gian
 *  - báo "đã lưu" khi tiến trình được lưu (mở bài thi trên nhiều thiết bị)
 *  - báo "đã nộp" khi hết giờ và máy chủ tự nộp bài
 * CORS của Socket.IO được cấu hình trong main.ts (SocketIoAdapter).
 */
@WebSocketGateway({ namespace: EXAM_SOCKET_NAMESPACE })
export class ExamGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ExamGateway.name);

  @WebSocketServer()
  server: Namespace;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ??
      (client.handshake.headers.authorization?.replace(/^Bearer\s+/i, '') || undefined);
    try {
      if (!token) throw new Error('missing token');
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      client.data.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
      } satisfies AuthUser;
    } catch {
      client.emit(ExamSocketEvent.ERROR, { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  @SubscribeMessage(ExamSocketEvent.JOIN)
  async join(@ConnectedSocket() client: Socket, @MessageBody() body: { attemptId?: string }) {
    const user = client.data.user as AuthUser | undefined;
    if (!user || !body?.attemptId) return { ok: false };

    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id: body.attemptId },
      select: { id: true, userId: true, status: true, expiresAt: true },
    });
    if (!attempt || (attempt.userId !== user.id && user.role === 'STUDENT')) {
      client.emit(ExamSocketEvent.ERROR, { message: 'Không tìm thấy lượt thi' });
      return { ok: false };
    }

    await client.join(room(attempt.id));
    const state = {
      attemptId: attempt.id,
      status: attempt.status,
      expiresAt: attempt.expiresAt.toISOString(),
      serverNow: new Date().toISOString(),
    };
    client.emit(ExamSocketEvent.STATE, state);
    return { ok: true, ...state };
  }

  emitSaved(attemptId: string, payload: { savedAt: string; attemptQuestionIds: string[] }) {
    this.server?.to(room(attemptId)).emit(ExamSocketEvent.SAVED, { attemptId, ...payload });
  }

  emitSubmitted(attemptId: string, payload: { status: string; autoSubmitted: boolean }) {
    this.logger.debug(`Attempt ${attemptId} submitted (auto=${payload.autoSubmitted})`);
    this.server?.to(room(attemptId)).emit(ExamSocketEvent.SUBMITTED, { attemptId, ...payload });
  }
}
