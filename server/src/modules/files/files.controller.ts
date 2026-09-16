import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { FilesService } from './files.service.js';
import { RequestUploadDto } from './dto/request-upload.dto.js';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('presign')
  requestUpload(@Body() dto: RequestUploadDto, @CurrentUser() user: AuthenticatedUser) {
    return this.filesService.requestUpload(dto, user.id);
  }

  @Post(':id/finalize')
  finalizeUpload(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.filesService.finalizeUpload(id, user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.filesService.findById(id, user.id);
  }
}
