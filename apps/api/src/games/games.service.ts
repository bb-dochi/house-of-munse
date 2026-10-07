import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { filterGames, ListQuery, Mood, recommend, TimePref } from './logic';

// 공개 API로 나가는 필드. 가격 같은 소장 정보는 여기에 넣지 않습니다.
const PUBLIC_FIELDS = {
  id: true,
  nameKo: true,
  nameEn: true,
  minPlayers: true,
  maxPlayers: true,
  playTime: true,
  weight: true,
  rating: true,
  category: true,
  description: true,
  imageUrl: true,
  iconKey: true,
} as const;

@Injectable()
export class GamesService {
  constructor(private readonly prisma: PrismaService) {}

  /** 방출이 끝난 게임은 방문자에게 보이지 않습니다. */
  private onShelf() {
    return this.prisma.game.findMany({
      where: { OR: [{ ownership: { is: null } }, { ownership: { is: { status: { not: '방출 완료' } } } }] },
      select: PUBLIC_FIELDS,
      orderBy: { id: 'asc' },
    });
  }

  async list(query: ListQuery) {
    const all = await this.onShelf();
    return { total: all.length, items: filterGames(all, query) };
  }

  async one(id: number) {
    const game = await this.prisma.game.findUnique({ where: { id }, select: PUBLIC_FIELDS });
    if (!game) throw new NotFoundException('그 번호의 게임이 없습니다.');
    return game;
  }

  async recommend(players: number, time: TimePref, mood: Mood) {
    return recommend(await this.onShelf(), players, time, mood);
  }
}
