import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { Public } from '../auth/public.decorator.js';
import { BusinessesService } from '../businesses/businesses.service.js';
import { AdsService } from './ads.service.js';
import { AdReportQueryDto } from './dto/ad-report-query.dto.js';
import { CreateAdDto } from './dto/create-ad.dto.js';
import { PublicAdsQueryDto } from './dto/public-ads-query.dto.js';
import { UpdateAdDto } from './dto/update-ad.dto.js';
import { RecordAdEventDto } from './dto/record-ad-event.dto.js';

@Controller('ads')
export class AdsController {
  constructor(
    private readonly adsService: AdsService,
    private readonly businessesService: BusinessesService,
  ) {}

  @Public()
  @Get('products')
  listProducts() {
    return this.adsService.listProducts();
  }

  // 홈 캐러셀용 공개 조회. ':id' 라우트보다 먼저 선언해 'public'이 id로 잡히지 않게 한다.
  @Public()
  @Get('public')
  listPublic(@Query() query: PublicAdsQueryDto) {
    return this.adsService.listPublic(query.placement);
  }

  @Get()
  async listMine(
    @Query('status') status: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const business = await this.businessesService.findByOwner(user.id);
    return this.adsService.listMine(business?.id ?? '', status);
  }

  @Post()
  async create(@Body() dto: CreateAdDto, @CurrentUser() user: AuthenticatedUser) {
    const business = await this.businessesService.findByOwner(user.id);
    if (!business) throw new UnauthorizedException('Business account required');
    return this.adsService.create(dto, business.id, user.id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAdDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adsService.updateStatus(id, dto, user);
  }

  @Get(':id/report')
  report(
    @Param('id') id: string,
    @Query() query: AdReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.adsService.report(id, query, user);
  }

  @Public()
  @Post(':id/impressions')
  recordImpression(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordAdEventDto = {}) {
    return this.adsService.recordEvent(id, 'impressions', dto);
  }

  @Public()
  @Post(':id/clicks')
  recordClick(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RecordAdEventDto = {}) {
    return this.adsService.recordEvent(id, 'clicks', dto);
  }
}
