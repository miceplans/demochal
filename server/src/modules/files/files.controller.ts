import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { FilesService } from './files.service.js';
import { RequestUploadDto } from './dto/request-upload.dto.js';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('presign')
  requestUpload(@Body() dto: RequestUploadDto) {
    return this.filesService.requestUpload(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.filesService.findById(id);
  }
}
