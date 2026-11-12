import {
  type CanActivate,
  createParamDecorator,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@eduforge/shared';
import type { Request } from 'express';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

type AuthedRequest = Request & { user?: AuthUser };

const IS_PUBLIC_KEY = 'isPublic';
const ROLES_KEY = 'roles';

/** Route không bắt buộc đăng nhập (nếu có token hợp lệ vẫn gắn req.user). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/** Giới hạn vai trò được phép gọi route. ADMIN luôn được phép. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Lấy người dùng hiện tại trong controller. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().user;
});

export function extractBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // WebSocket tự xác thực trong ExamGateway; BullMQ không đi qua guard.
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException('Bạn cần đăng nhập');
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      request.user = { id: payload.sub, email: payload.email, role: payload.role };
      return true;
    } catch {
      if (isPublic) return true;
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ hoặc đã hết hạn');
    }
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) return true;

    const user = context.switchToHttp().getRequest<AuthedRequest>().user;
    if (!user) throw new UnauthorizedException('Bạn cần đăng nhập');
    if (user.role === 'ADMIN' || roles.includes(user.role)) return true;
    throw new ForbiddenException('Bạn không có quyền thực hiện thao tác này');
  }
}

export const isStaff = (user?: AuthUser) => user?.role === 'ADMIN' || user?.role === 'INSTRUCTOR';
