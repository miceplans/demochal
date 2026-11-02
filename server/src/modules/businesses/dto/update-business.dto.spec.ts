import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpdateBusinessDto } from './update-business.dto.js';

describe('UpdateBusinessDto', () => {
  it('accepts map coordinates within range', () => {
    const dto = plainToInstance(UpdateBusinessDto, {
      mapLatitude: 37.5665,
      mapLongitude: 126.978,
    });
    expect(validateSync(dto)).toHaveLength(0);
  });

  it.each([
    { mapLatitude: 91, mapLongitude: 0 },
    { mapLatitude: -91, mapLongitude: 0 },
    { mapLatitude: 0, mapLongitude: 181 },
    { mapLatitude: 0, mapLongitude: -181 },
    { mapLatitude: '37.5', mapLongitude: 0 },
    { mapLatitude: Number.NaN, mapLongitude: 0 },
  ])('rejects out-of-range or non-number coordinates %#', (value) => {
    expect(validateSync(plainToInstance(UpdateBusinessDto, value))).not.toHaveLength(0);
  });

  it('accepts an explicit null to clear the stored pin', () => {
    const dto = plainToInstance(UpdateBusinessDto, {
      mapLatitude: null,
      mapLongitude: null,
    });
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('still accepts a plain contact update without coordinates', () => {
    const dto = plainToInstance(UpdateBusinessDto, { name: '새 이름', address: '서울시 강남구' });
    expect(validateSync(dto)).toHaveLength(0);
  });
});
