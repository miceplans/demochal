import { IsIn } from 'class-validator';
import { DESIGN_PRODUCT_CODES, type DesignProductCode } from '../design-products.catalog.js';

export class CreateDesignOrderDto {
  @IsIn(DESIGN_PRODUCT_CODES)
  productCode!: DesignProductCode;
}
