import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { FilesService } from './files.service.js';
import { PresignedUploadRequest } from './dto/presigned-upload-request.dto.js';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('presign')
  requestUpload(@Body() dto: PresignedUploadRequest) {
    return this.filesService.requestUpload(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.filesService.findById(id);
  }
}
