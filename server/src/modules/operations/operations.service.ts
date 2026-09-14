import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { inquiries } from '../../db/schema.js';
import type { CreateInquiryDto } from './dto/create-inquiry.dto.js';

@Injectable()
export class OperationsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async createInquiry(dto: CreateInquiryDto) {
    const [inquiry] = await this.db
      .insert(inquiries)
      .values({ name: dto.name, contact: dto.contact, content: dto.content })
      .returning({ id: inquiries.id });
    return { id: inquiry!.id, received: true };
  }
}
