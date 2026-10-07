import { PrismaClient } from '@prisma/client';
import { GAMES, PLAYS, WISHES } from './seed-data';

const prisma = new PrismaClient();

async function main() {
  if ((await prisma.game.count()) > 0) {
    console.log('이미 게임이 들어 있어 시드를 건너뜁니다.');
    return;
  }
  for (const g of GAMES) {
    const { own, ...game } = g;
    await prisma.game.create({ data: { ...game, iconKey: game.nameEn, ownership: { create: own } } });
  }
  for (const p of PLAYS) {
    const game = await prisma.game.findFirst({ where: { nameEn: p.gameNameEn } });
    await prisma.play.create({ data: { ...p, playedAt: new Date(p.playedAt), gameId: game?.id ?? null, isSample: true } });
  }
  for (const w of WISHES) await prisma.wish.create({ data: { ...w, isSample: true } });
  console.log(`게임 ${GAMES.length}개, 후기 ${PLAYS.length}개, 위시 ${WISHES.length}개를 넣었습니다.`);
}

main().finally(() => prisma.$disconnect());
