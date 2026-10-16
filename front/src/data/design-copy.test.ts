import { describe, expect, it } from 'vitest';
import legalCopy from './design-copy.json';

const LEGAL_KEYS = ['terms', 'privacy', 'advertisingPolicy', 'youthProtection'] as const;

const PLACEHOLDER_PATTERN = /20XX|OOO|\[[^\]]*\]/;

describe('design-copy legal sections', () => {
  it.each(LEGAL_KEYS)('%s has no placeholder markers', (key) => {
    const paragraphs = (legalCopy as Record<string, string[]>)[key];
    const offenders = paragraphs.filter((paragraph) => PLACEHOLDER_PATTERN.test(paragraph));
    expect(offenders).toEqual([]);
  });
});
