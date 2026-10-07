import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { verifyToken } from './token';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const header: string | undefined = context.switchToHttp().getRequest().headers?.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    if (!verifyToken(token, process.env.TOKEN_SECRET ?? '')) throw new UnauthorizedException('관리자 로그인이 필요합니다.');
    return true;
  }
}
