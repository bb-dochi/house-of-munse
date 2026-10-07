import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

// 게임 후기와 위시리스트. 지금은 읽기만 제공합니다.
@Controller()
export class JournalController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('plays')
  plays() {
    return this.prisma.play.findMany({ orderBy: { playedAt: 'desc' }, include: { game: { select: { category: true, iconKey: true, imageUrl: true } } } });
  }

  @Get('wishlist')
  wishlist() {
    return this.prisma.wish.findMany({ orderBy: { priority: 'asc' } });
  }
}
