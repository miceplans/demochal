import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { UpdateAdContentDto } from './update-ad-content.dto.js';

const validBody = {
  imageFileId: '7b1f5f2c-2f6a-4f4f-9b3a-2d8f0c1a2b3c',
  title: '봄 이벤트 배너',
};

const errorsFor = (body: Record<string, unknown>) =>
  validateSync(plainToInstance(UpdateAdContentDto, { ...validBody, ...body }));

describe('UpdateAdContentDto', () => {
  it.each(['https://example.com/landing', 'http://example.com'])(
    'accepts an http(s) landing URL: %s',
    (landingUrl) => {
      expect(errorsFor({ landingUrl })).toHaveLength(0);
    },
  );

  it.each(['javascript:alert(1)', 'data:text/html,<script></script>', 'ftp://example.com/x'])(
    'rejects a non-http(s) landing URL: %s',
    (landingUrl) => {
      expect(errorsFor({ landingUrl })).not.toHaveLength(0);
    },
  );
});
