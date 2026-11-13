import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BusinessesModule } from '../businesses/businesses.module.js';
import { DesignProductsController } from './design-products.controller.js';
import { DesignProductsService } from './design-products.service.js';

@Module({
  imports: [BusinessesModule, AuthModule],
  controllers: [DesignProductsController],
  providers: [DesignProductsService],
})
export class DesignProductsModule {}
