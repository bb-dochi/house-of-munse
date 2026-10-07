import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../auth/admin.guard';
import { BggService } from './bgg.service';

@Controller('admin/bgg')
@UseGuards(AdminGuard)
export class BggController {
  constructor(private readonly bgg: BggService) {}

  @Get('search')
  search(@Query('q') q = '') {
    return this.bgg.search(q);
  }

  @Post('import')
  import(@Body() body: { bggId?: number }) {
    const id = Number(body?.bggId);
    if (!Number.isInteger(id) || id <= 0) throw new BadRequestException('BGG 번호가 올바르지 않습니다.');
    return this.bgg.import(id);
  }
}
