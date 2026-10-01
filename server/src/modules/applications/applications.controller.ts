import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FilesService } from '../files/files.service.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { ApplicationsService } from './applications.service.js';
import { ApplyChallengeDto } from './dto/apply-challenge.dto.js';
import { UpdateApplicationDto } from './dto/update-application.dto.js';

@Controller('applications')
@UseGuards(JwtAuthGuard)
export class ApplicationsController {
  constructor(
    private readonly applicationsService: ApplicationsService,
    private readonly filesService: FilesService,
  ) {}

  @Post()
  apply(@Body() dto: ApplyChallengeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.applicationsService.apply(dto, user.id);
  }

  @Get('me')
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.applicationsService.listForUser(user.id);
  }

  @Get('managed')
  listManaged(
    @CurrentUser() user: AuthenticatedUser,
    @Query('challengeId') challengeId?: string,
    @Query('status') status?: string,
  ) {
    return this.applicationsService.listForBusinessOwner(user.id, { challengeId, status });
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.applicationsService.findById(id, user.id);
  }

  @Get(':id/files/:fileId')
  @Header('Cache-Control', 'private, no-store')
  async attachment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('fileId', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const file = await this.applicationsService.findAttachment(id, fileId, user.id);
    return { url: await this.filesService.getPrivateReadUrl(file.key) };
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.applicationsService.update(id, dto, user.id);
  }
}
