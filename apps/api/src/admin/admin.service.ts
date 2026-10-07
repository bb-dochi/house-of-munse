import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { LedgerInput, toPatch } from './ledger';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  ledger() {
    return this.prisma.game.findMany({ orderBy: { id: 'asc' }, include: { ownership: true } });
  }

  async create(input: LedgerInput) {
    const patch = toPatch({ nameKo: input.nameKo ?? '', ...input });
    if (typeof patch === 'string') throw new BadRequestException(patch);
    const g = patch.game;
    return this.prisma.game.create({
      data: {
        nameKo: g.nameKo ?? '',
        nameEn: g.nameEn ?? '',
        minPlayers: g.minPlayers ?? 1,
        maxPlayers: g.maxPlayers ?? 4,
        playTime: g.playTime ?? 0,
        weight: g.weight ?? 0,
        rating: g.rating ?? 0,
        category: g.category ?? '가족',
        description: g.description ?? '',
        ownership: { create: { status: '보유', ...patch.ownership } },
      },
      include: { ownership: true },
    });
  }

  async update(id: number, input: LedgerInput) {
    const patch = toPatch(input);
    if (typeof patch === 'string') throw new BadRequestException(patch);
    const exists = await this.prisma.game.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('그 번호의 게임이 없습니다.');
    return this.prisma.game.update({
      where: { id },
      data: {
        ...patch.game,
        ownership: { upsert: { create: { status: '보유', ...patch.ownership }, update: patch.ownership } },
      },
      include: { ownership: true },
    });
  }

  async remove(id: number) {
    const exists = await this.prisma.game.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('그 번호의 게임이 없습니다.');
    await this.prisma.game.delete({ where: { id } });
    return { ok: true };
  }
}
