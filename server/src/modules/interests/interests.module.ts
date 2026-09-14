import { Module } from '@nestjs/common';
import { InterestsController } from './interests.controller.js';
import { InterestsService } from './interests.service.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [InterestsController],
  providers: [InterestsService],
})
export class InterestsModule {}
