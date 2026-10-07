import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { AdminService } from './admin.service';
import { LedgerInput } from './ledger';

const toId = (raw: string) => {
  const n = Number(raw);
  if (!Number.isInteger(n)) throw new BadRequestException('게임 번호가 올바르지 않습니다.');
  return n;
};

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('ledger')
  ledger() {
    return this.admin.ledger();
  }

  @Post('games')
  create(@Body() body: LedgerInput) {
    return this.admin.create(body ?? {});
  }

  @Patch('games/:id')
  update(@Param('id') id: string, @Body() body: LedgerInput) {
    return this.admin.update(toId(id), body ?? {});
  }

  @Delete('games/:id')
  remove(@Param('id') id: string) {
    return this.admin.remove(toId(id));
  }
}
