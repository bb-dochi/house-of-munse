import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { GamesController } from './games/games.controller';
import { GamesService } from './games/games.service';
import { JournalController } from './journal/journal.controller';
import { AuthController } from './auth/auth.controller';
import { AdminGuard } from './auth/admin.guard';
import { AdminController } from './admin/admin.controller';
import { AdminService } from './admin/admin.service';
import { BggController } from './bgg/bgg.controller';
import { BggService } from './bgg/bgg.service';

@Module({
  controllers: [GamesController, JournalController, AuthController, AdminController, BggController],
  providers: [PrismaService, GamesService, AdminService, BggService, AdminGuard],
})
export class AppModule {}
