import { BadGatewayException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { XMLParser } from 'fast-xml-parser';
import { PrismaService } from '../prisma.service';
import { mapSearch, mapThing } from './map';

const BASE = 'https://boardgamegeek.com/xmlapi2';

// BGG는 서버에서만 부르고, 가져온 결과는 DB에 저장해 방문자 요청 때는 다시 부르지 않습니다.
@Injectable()
export class BggService {
  private readonly parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

  constructor(private readonly prisma: PrismaService) {}

  private async get(path: string) {
    const token = process.env.BGG_TOKEN;
    if (!token) throw new ServiceUnavailableException('서버에 BGG_TOKEN이 없습니다. BGG에서 앱을 등록하고 받은 토큰을 넣어 주세요.');
    let res: Response;
    try {
      res = await fetch(BASE + path, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      throw new BadGatewayException('BGG에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.');
    }
    if (res.status === 401 || res.status === 403) throw new BadGatewayException('BGG가 토큰을 거부했습니다. 토큰과 앱 승인 상태를 확인해 주세요.');
    if (res.status === 429) throw new BadGatewayException('BGG 요청 한도를 넘었습니다. 잠시 뒤 다시 시도해 주세요.');
    if (!res.ok) throw new BadGatewayException(`BGG가 오류를 돌려줬습니다 (${res.status}).`);
    return this.parser.parse(await res.text());
  }

  async search(query: string) {
    const q = query.trim();
    if (q.length < 2) return [];
    return mapSearch(await this.get(`/search?type=boardgame&query=${encodeURIComponent(q)}`)).slice(0, 20);
  }

  /** BGG에서 한 게임을 가져와 저장합니다. 이미 있으면 정보만 새로 고칩니다. */
  async import(bggId: number) {
    const game = mapThing(await this.get(`/thing?id=${bggId}&stats=1`));
    if (!game) throw new NotFoundException('BGG에 그 번호의 게임이 없습니다.');
    const existing = await this.prisma.game.findUnique({ where: { bggId } });
    if (existing) {
      const { nameKo: _keepOurName, ...fresh } = game;
      return this.prisma.game.update({ where: { bggId }, data: fresh, include: { ownership: true } });
    }
    return this.prisma.game.create({
      data: { ...game, ownership: { create: { status: '보유', recommendedPlayers: `${game.minPlayers}–${game.maxPlayers}인` } } },
      include: { ownership: true },
    });
  }
}
