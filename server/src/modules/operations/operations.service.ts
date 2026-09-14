import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { operationInquiries } from '../../db/schema.js';
import type { SubmitOperationsInquiryDto } from './dto/submit-operations-inquiry.dto.js';

@Injectable()
export class OperationsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async submitInquiry(dto: SubmitOperationsInquiryDto) {
    const [inquiry] = await this.db.insert(operationInquiries).values(dto).returning();
    return { id: inquiry!.id, received: true };
  }
}
