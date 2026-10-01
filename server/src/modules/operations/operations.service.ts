import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE, type Database } from '../../infra/db/drizzle.provider.js';
import { inquiries } from '../../infra/db/schema.js';
import type { SubmitOperationsInquiryDto } from './dto/submit-operations-inquiry.dto.js';

@Injectable()
export class OperationsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async createInquiry(dto: SubmitOperationsInquiryDto) {
    const [inquiry] = await this.db
      .insert(inquiries)
      .values({ name: dto.name, contact: dto.contact, content: dto.content })
      .returning({ id: inquiries.id });
    return { id: inquiry!.id, received: true };
  }
}
