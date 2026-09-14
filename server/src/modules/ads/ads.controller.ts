import { Body, Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { AdsService } from './ads.service.js';
import { CreateAdDto } from './dto/create-ad.dto.js';

@Controller('ads')
export class AdsController {
  constructor(private readonly adsService: AdsService) {}

  @Get('products')
  listProducts() {
    return this.adsService.listProducts();
  }

  @Get()
  listMine(@Query('status') status?: string, @Headers('x-business-id') businessId = '') {
    return this.adsService.listMine(businessId, status);
  }

  @Post()
  create(@Body() dto: CreateAdDto, @Headers('x-business-id') businessId = '') {
    // TODO: replace header-based identification with an auth guard.
    return this.adsService.create(dto, businessId);
  }
}
