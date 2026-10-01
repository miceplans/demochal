import { Global, Module } from '@nestjs/common';
import { DRIZZLE, createDatabase } from './drizzle.provider.js';

@Global()
@Module({
  providers: [{ provide: DRIZZLE, useFactory: createDatabase }],
  exports: [DRIZZLE],
})
export class DbModule {}
