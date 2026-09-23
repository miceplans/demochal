import {
  Body,
  Controller,
  Get,
  Param,
  ParseArrayPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { AdminService } from './admin.service.js';
import { AdminRoleGuard } from './admin-role.guard.js';
import { AdPricingSlotDto } from './dto/update-ad-pricing.dto.js';
import { RejectVerificationDto } from './dto/reject-verification.dto.js';
import { ResolveReportDto } from './dto/resolve-report.dto.js';
import { SuspendUserDto } from './dto/suspend-user.dto.js';
import { VerifyCertificateDto } from './dto/verify-certificate.dto.js';

@UseGuards(AdminRoleGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  getDashboard(@Query('range') range?: string) {
    return this.adminService.getDashboard(range);
  }

  @Get('businesses')
  listBusinesses(
    @Query('q') q?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.listBusinesses(q, type, status);
  }

  @Post('verifications/:id/approve')
  approveVerification(@Param('id') id: string) {
    return this.adminService.approveVerification(id);
  }

  @Post('verifications/:id/reject')
  rejectVerification(@Param('id') id: string, @Body() dto: RejectVerificationDto) {
    return this.adminService.rejectVerification(id, dto.reason);
  }

  @Get('certificates')
  listCertificates(@Query('status') status?: string, @Query('q') q?: string) {
    return this.adminService.listCertificates(status, q);
  }

  @Post('certificates/:id/verify')
  verifyCertificate(@Param('id') id: string, @Body() dto: VerifyCertificateDto) {
    return this.adminService.verifyCertificate(id, dto);
  }

  @Get('ads')
  listAds(@Query('q') q?: string, @Query('status') status?: string) {
    return this.adminService.listAds(q, status);
  }

  @Get('ad-pricing')
  getAdPricing() {
    return this.adminService.getAdPricing();
  }

  @Put('ad-pricing')
  updateAdPricing(
    @Body(new ParseArrayPipe({ items: AdPricingSlotDto })) items: AdPricingSlotDto[],
  ) {
    return this.adminService.updateAdPricing(items);
  }

  @Get('users')
  listUsers(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('joinedWithin') joinedWithin?: string,
    @Query('position') position?: string,
  ) {
    return this.adminService.listUsers(q, status, joinedWithin, position);
  }

  @Post('users/:id/suspend')
  suspendUser(@Param('id') id: string, @Body() dto: SuspendUserDto) {
    return this.adminService.suspendUser(id, dto);
  }

  @Get('reports')
  listReports(@Query('q') q?: string, @Query('status') status?: string) {
    return this.adminService.listReports(q, status);
  }

  @Post('reports/:id/resolve')
  resolveReport(@Param('id') id: string, @Body() dto: ResolveReportDto) {
    return this.adminService.resolveReport(id, dto);
  }

  @Get('contents')
  getContents() {
    return this.adminService.getContents();
  }

  @Get('analytics')
  getAnalytics(@Query('ad') ad?: string) {
    return this.adminService.getAnalytics(ad);
  }

  @Get('settings')
  getSettings(@CurrentUser() user: AuthenticatedUser) {
    return this.adminService.getSettings(user);
  }

  @Put('settings')
  updateSettings(@Body() values: Record<string, boolean>, @CurrentUser() user: AuthenticatedUser) {
    return this.adminService.updateSettings(values, user);
  }
}
