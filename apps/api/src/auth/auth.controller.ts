import { Body, Controller, HttpCode, Post, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { issueToken, samePassword } from './token';

@Controller('auth')
export class AuthController {
  @Post('login')
  @HttpCode(200)
  login(@Body() body: { password?: string }) {
    const expected = process.env.ADMIN_PASSWORD ?? '';
    const secret = process.env.TOKEN_SECRET ?? '';
    if (!expected || !secret) throw new ServiceUnavailableException('서버에 ADMIN_PASSWORD와 TOKEN_SECRET이 설정되지 않았습니다.');
    if (!samePassword(String(body?.password ?? ''), expected)) throw new UnauthorizedException('비밀번호가 맞지 않습니다.');
    return { token: issueToken(secret) };
  }
}
