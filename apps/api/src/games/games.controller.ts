import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { GamesService } from './games.service';
import { Mood, MOODS, TimePref, TIME_PREFS } from './logic';

@Controller()
export class GamesController {
  constructor(private readonly games: GamesService) {}

  @Get('health')
  health() {
    return { ok: true };
  }

  @Get('games')
  list(
    @Query('q') q?: string,
    @Query('players') players?: string,
    @Query('weight') weight?: string,
    @Query('category') category?: string,
    @Query('sort') sort?: string,
  ) {
    return this.games.list({ q, players, weight, category, sort });
  }

  @Get('games/:id')
  one(@Param('id') id: string) {
    const n = Number(id);
    if (!Number.isInteger(n)) throw new BadRequestException('게임 번호가 올바르지 않습니다.');
    return this.games.one(n);
  }

  @Get('recommend')
  recommend(@Query('players') players = '3', @Query('time') time = 'any', @Query('mood') mood = 'any') {
    const n = Number(players);
    if (!Number.isInteger(n) || n < 1 || n > 12) throw new BadRequestException('인원은 1~12 사이 숫자여야 합니다.');
    if (!TIME_PREFS.includes(time as TimePref)) throw new BadRequestException('시간 조건이 올바르지 않습니다.');
    if (!MOODS.includes(mood as Mood)) throw new BadRequestException('기분 조건이 올바르지 않습니다.');
    return this.games.recommend(n, time as TimePref, mood as Mood);
  }
}
