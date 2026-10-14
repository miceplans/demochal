import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { FilesModule } from '../files/files.module.js';
import { TeamsController } from './teams.controller.js';
import { TeamsService } from './teams.service.js';

// AuthModule: 라우트 스코프 가드(OptionalJwtAuthGuard)의 JwtService 주입에 필요.
// 라우트 스코프 JwtAuthGuard를 쓰는 다른 모듈(businesses·verifications·challenges 등)과 동일한 패턴.
@Module({
  imports: [NotificationsModule, FilesModule, AuthModule],
  controllers: [TeamsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
