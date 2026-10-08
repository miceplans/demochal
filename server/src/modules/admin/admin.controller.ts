import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
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
import { SendNewEmailDto, SendReplyDto } from '../email/dto/send-reply.dto.js';
import { UpdateEmailStatusDto } from '../email/dto/update-email-status.dto.js';
import { EmailService } from '../email/email.service.js';

@UseGuards(AdminRoleGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly emailService: EmailService,
  ) {}

  @Get('emails')
  listEmails(@Query('q') q?: string, @Query('status') status?: string) {
    return this.emailService.listThreads({ q, status });
  }

  // `emails/:id`보다 먼저 선언해야 'automated'가 id로 매칭되지 않는다.
  @Get('emails/automated')
  listAutomatedEmails(@Query('q') q?: string) {
    return this.emailService.listAutomated({ q });
  }

  @Post('emails')
  sendNewEmail(@Body() dto: SendNewEmailDto) {
    return this.emailService.sendNewEmail(dto.to, dto.subject, dto.text, dto.html);
  }

  @Get('emails/:id')
  getEmail(@Param('id') id: string) {
    return this.emailService.getThread(id);
  }

  @Patch('emails/:id/status')
  updateEmailStatus(@Param('id') id: string, @Body() dto: UpdateEmailStatusDto) {
    return this.emailService.updateThreadStatus(id, dto.status);
  }

  @Post('emails/:id/replies')
  sendEmailReply(@Param('id') id: string, @Body() dto: SendReplyDto) {
    return this.emailService.sendReply(id, dto.text, dto.html);
  }

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
  listCertificates(
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('category') category?: string,
  ) {
    return this.adminService.listCertificates(status, q, category);
  }

  @Post('certificates/:id/verify')
  verifyCertificate(@Param('id') id: string, @Body() dto: VerifyCertificateDto) {
    return this.adminService.verifyCertificate(id, dto);
  }

  @Get('ads')
  listAds(@Query('q') q?: string, @Query('status') status?: string) {
    return this.adminService.listAds(q, status);
  }

  @Post('challenges/:id/publish')
  publishChallenge(@Param('id') id: string) {
    return this.adminService.publishChallenge(id);
  }

  @Post('ads/:id/pause')
  pauseAd(@Param('id') id: string) {
    return this.adminService.pauseAd(id);
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
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.adminService.listUsers(
      q,
      status,
      joinedWithin,
      position,
      page ? Number.parseInt(page, 10) : undefined,
      pageSize ? Number.parseInt(pageSize, 10) : undefined,
    );
  }

  @Post('users/:id/suspend')
  suspendUser(@Param('id') id: string, @Body() dto: SuspendUserDto) {
    return this.adminService.suspendUser(id, dto);
  }

  @Get('reports')
  listReports(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('targetType') targetType?: string,
  ) {
    return this.adminService.listReports(q, status, targetType);
  }

  @Post('reports/:id/resolve')
  resolveReport(@Param('id') id: string, @Body() dto: ResolveReportDto) {
    return this.adminService.resolveReport(id, dto);
  }

  @Get('contents')
  getContents(
    @Query('teamsLimit') teamsLimit?: string,
    @Query('contestsLimit') contestsLimit?: string,
  ) {
    return this.adminService.getContents(teamsLimit, contestsLimit);
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
  updateSettings(@Body() values: Record<string, unknown>, @CurrentUser() user: AuthenticatedUser) {
    return this.adminService.updateSettings(values, user);
  }
}
