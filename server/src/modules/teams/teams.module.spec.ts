import { Global, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { describe, expect, it } from 'vitest';
import { DRIZZLE } from '../../db/drizzle.provider.js';
import { SqsService } from '../../queue/sqs.service.js';
import { DEFAULT_THROTTLE } from '../../common/throttling/throttling.js';
import { TeamsModule } from './teams.module.js';

// TeamsService·NotificationsService·FilesService·OutboxRelayService가 주입받는 인프라
// 클라이언트와 AuthModule의 LoginAttemptThrottlerGuard가 필요로 하는 ThrottlerModule(AppModule
// 의 forRoot와 동일)을 대역한다. 실제 TeamsModule을 컴파일·초기화해야 라우트 스코프 가드
// (OptionalJwtAuthGuard)의 DI도 함께 검증된다 — 수동 new 유닛 테스트와 앱을 부팅하지 않는
// CI로는 TeamsModule의 AuthModule 누락 같은 부팅 DI 장애를 잡을 수 없다(#583 참조).
@Global()
@Module({
  imports: [ThrottlerModule.forRoot({ throttlers: [DEFAULT_THROTTLE] })],
  providers: [
    { provide: DRIZZLE, useValue: {} },
    { provide: SqsService, useValue: {} },
  ],
  exports: [DRIZZLE, SqsService, ThrottlerModule],
})
class TestInfraModule {}

describe('TeamsModule DI', () => {
  it('컴파일·초기화에 성공한다(라우트 가드의 JwtService 포함)', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestInfraModule, TeamsModule],
    }).compile();
    await moduleRef.init();
    expect(moduleRef.get(TeamsModule)).toBeDefined();
    await moduleRef.close();
  });
});
